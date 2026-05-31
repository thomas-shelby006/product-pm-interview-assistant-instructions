// ==UserScript==
// @name         ChatGPT Interview Bridge (2-Window)
// @version      0.2.4
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @updateURL    http://127.0.0.1:8123/bridge.user.js
// @downloadURL  http://127.0.0.1:8123/bridge.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ── Auto-Registration via URL ──────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const urlRole = urlParams.get('vb_role');
    if (urlRole) {
        sessionStorage.setItem('vb_role', urlRole);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const MAX_BUFFER = 5;
    const MAX_CODING_BUFFER = 20;
    const FOCUS_OPEN_KEY = 'vb_focus_open';
    const FLUSH_WRAPPER = [
        'This is buffered conversation from the coding section.',
        '',
        'Some lines may be filler, partial transcription,',
        'or already answered verbally.',
        '',
        'Prioritize the latest actionable question or request.',
        'Use earlier lines only as context.',
        'Ignore filler and already-resolved remarks.',
        '',
        'If there is no actionable request,',
        'respond only with:',
        'No action needed.',
        '',
        'Buffered transcript:',
        ''
    ].join('\n');

    const FILLER_PHRASES = new Set([
        'ok',
        'okay',
        'yes',
        'yeah',
        'yep',
        'fine',
        'good',
        'correct',
        'right',
        'sure',
        'continue',
        'go on',
        'go ahead',
        'thank you',
        'thanks',
        'that works',
        'looks good',
        'alright',
        'mhm',
        'uh huh'
    ]);

    const TECHNICAL_INTENT_RE =
        /\b(why|how|what|can you|could you|add|change|fix|explain|implement|optimise|optimize)\b/i;

    let role    = sessionStorage.getItem('vb_role') || null;
    let paused  = false;
    let scrollLock = false;
    let seq     = 0;
    let codingBufferMode = localStorage.getItem(FOCUS_OPEN_KEY) === '1';
    let codingBuffer = [];
    let pendingCodingContext = '';
    let flushCodingBuffer = () => {};

    // ── Defend Title for AHK Detection ─────────────────────
    if (role) {
        const targetTitle = "VB_" + role.toUpperCase();
        document.title = targetTitle;
        new MutationObserver(() => {
            if (document.title !== targetTitle) {
                document.title = targetTitle;
            }
        }).observe(document.querySelector('head'), { childList: true, subtree: true, characterData: true });
    }

    const CODE_WRAP_FALLBACK_CLASS = 'vb-code-wrap-fallback';
    const WRAP_OVERFLOW_THRESHOLD = 18;

    // ── Code Wrapping CSS (Win2 only) ──────────────────────
    // Injected early so code blocks wrap before fallback scroll.
    if (role === 'receiver') {
        const style = document.createElement('style');
        style.textContent = `
            pre,
            pre code,
            code {
                max-width: 100% !important;
                min-width: 0 !important;
                white-space: pre-wrap !important;
                overflow-wrap: anywhere !important;
                word-break: break-all !important;
                overflow-x: visible !important;
                box-sizing: border-box !important;
            }
            div:has(> pre),
            div:has(pre),
            [class*="overflow-x-auto"],
            [class*="overflow-x-scroll"] {
                max-width: 100% !important;
                min-width: 0 !important;
                overflow-x: visible !important;
                box-sizing: border-box !important;
            }
            pre span,
            pre code span,
            code span {
                white-space: inherit !important;
                overflow-wrap: inherit !important;
                word-break: inherit !important;
            }
            .${CODE_WRAP_FALLBACK_CLASS},
            .${CODE_WRAP_FALLBACK_CLASS} pre,
            .${CODE_WRAP_FALLBACK_CLASS} code,
            pre.${CODE_WRAP_FALLBACK_CLASS},
            pre.${CODE_WRAP_FALLBACK_CLASS} code,
            code.${CODE_WRAP_FALLBACK_CLASS} {
                overflow-x: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    function getCodeFallbackOwner(pre) {
        if (!(pre instanceof HTMLElement)) return null;
        return pre.parentElement instanceof HTMLElement
            ? pre.parentElement
            : pre;
    }

    function clearReceiverCodeFallbacks() {
        if (role !== 'receiver') return;
        document.querySelectorAll(`.${CODE_WRAP_FALLBACK_CLASS}`)
            .forEach(el => el.classList.remove(CODE_WRAP_FALLBACK_CLASS));
    }

    function hasMaterialHorizontalOverflow(el) {
        if (!(el instanceof HTMLElement)) return false;
        return el.scrollWidth > el.clientWidth + WRAP_OVERFLOW_THRESHOLD;
    }

    function auditReceiverCodeOverflow() {
        if (role !== 'receiver') return;

        const pres = Array.from(document.querySelectorAll('pre'))
            .filter(el => el instanceof HTMLElement);

        for (const pre of pres) {
            const code = pre.querySelector('code');
            const wrapper = getCodeFallbackOwner(pre);
            const candidates = [pre, code]
                .filter(el => el instanceof HTMLElement);

            if (candidates.some(hasMaterialHorizontalOverflow)) {
                pre.classList.add(CODE_WRAP_FALLBACK_CLASS);
                if (wrapper) {
                    wrapper.classList.add(CODE_WRAP_FALLBACK_CLASS);
                }
            }
        }
    }

    let receiverWrapAuditTimer = null;
    function scheduleReceiverCodeWrapAudit() {
        if (role !== 'receiver') return;
        clearTimeout(receiverWrapAuditTimer);
        requestAnimationFrame(() => {
            clearReceiverCodeFallbacks();
            receiverWrapAuditTimer = setTimeout(() => {
                auditReceiverCodeOverflow();
            }, 140);
        });
    }

    // ── Indicator Dot ──────────────────────────────────────
    const dot = document.createElement('div');
    dot.style.cssText = `
        position:fixed;top:14px;left:14px;z-index:2147483647;
        padding:4px 10px;border-radius:12px;font-size:11px;
        font-family:monospace;font-weight:600;pointer-events:none;
        transition:background 0.3s;
        display:none;
    `;

    function placeDot() {
        if (role !== 'sender') return;

        const overlay = document.getElementById('vb-focus-overlay');
        const isOpen = overlay?.classList.contains('vb-open');
        const target = isOpen ? overlay : document.body;

        if (dot.parentElement !== target) {
            target.appendChild(dot);
        }
    }

    function setDot(text, bg, color) {
        placeDot();
        dot.style.display = 'block';
        dot.textContent = text;
        dot.style.background = bg;
        dot.style.color = color;
        dot.style.border = `1px solid ${color}44`;
    }

    function hideDot() {
        dot.style.display = 'none';
        dot.textContent = '';
        placeDot();
    }

    function resetDot() {
        if (paused) {
            setDot('PAUSED', '#ff444422', '#ff4444');
        } else if (role === 'sender') {
            if (codingBufferMode) {
                const label = codingBuffer.length
                    ? `BUFFER (${codingBuffer.length})`
                    : 'CODING MODE';
                setDot(label, '#ffaa0033', '#ffaa00');
            } else {
                hideDot();
            }
        } else if (role === 'receiver') {
            hideDot();
        } else {
            hideDot();
        }
    }

    resetDot();
    if (role === 'sender') {
        placeDot();
    }

    // ── Teleprompter Scroll Lock (Win2 Only) ───────────────
    const _origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
        if (role === 'receiver' && scrollLock && (this.tagName === 'DIV' || this.tagName === 'SPAN')) return;
        _origScrollIntoView.apply(this, args);
    };

    const _origScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
        if (role === 'receiver' && scrollLock && (this.tagName === 'DIV' || this.tagName === 'MAIN')) return;
        _origScrollTo.apply(this, args);
    };

    const _origWindowScrollTo = window.scrollTo;
    window.scrollTo = function (...args) {
        if (role === 'receiver' && scrollLock) return;
        _origWindowScrollTo.apply(this, args);
    };

    // ── Text Injection ─────────────────────────────────────
    function injectText(text, submit = false) {
        const el = document.querySelector('div[contenteditable="true"][role="textbox"]');
        if (!el) return;
        el.focus();
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        if (submit) {
            setTimeout(() => {
                el.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                    bubbles: true, cancelable: true
                }));
            }, 50);
        }
    }

    function isGenerating() {
        return !!document.querySelector('button[aria-label="Stop streaming"], button[aria-label="Stop generating"]');
    }

    function normalizeTranscript(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isFillerTranscript(text) {
        const normalized = normalizeTranscript(text);
        if (!normalized) return true;
        if (TECHNICAL_INTENT_RE.test(normalized)) return false;
        return FILLER_PHRASES.has(normalized);
    }

    function joinTranscriptLines(lines) {
        return lines
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n');
    }

    function buildFlushPayload() {
        return FLUSH_WRAPPER + joinTranscriptLines(codingBuffer);
    }

    function buildPendingPayload(latestText) {
        return [
            'Context from the previous coding section:',
            pendingCodingContext,
            '',
            'Now answer the latest question:',
            latestText
        ].join('\n');
    }

    function syncCodingBufferModeFromFocus() {
        const focusOpen = localStorage.getItem(FOCUS_OPEN_KEY) === '1';
        if (focusOpen === codingBufferMode) return;

        if (!focusOpen && codingBuffer.length) {
            const unsent = joinTranscriptLines(codingBuffer);
            pendingCodingContext = pendingCodingContext
                ? pendingCodingContext + '\n' + unsent
                : unsent;
            codingBuffer = [];
        }

        codingBufferMode = focusOpen;
        placeDot();
        resetDot();
    }

    function findMainScrollContainer() {
        const selectors = [
            'main',
            '[role="main"]',
            '[class*="overflow-y-auto"]',
            '[class*="overflow-y-scroll"]'
        ];
        const candidates = Array.from(document.querySelectorAll(selectors.join(',')))
            .filter(el => el instanceof HTMLElement)
            .filter(el => el.scrollHeight > el.clientHeight + 20);
        candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
        return candidates[0] || document.scrollingElement || null;
    }

    function scrollSenderToLatest() {
        if (paused || role !== 'sender') return;

        const run = () => {
            const scroller = findMainScrollContainer();
            if (scroller) scroller.scrollTop = scroller.scrollHeight;

            const doc = document.scrollingElement;
            if (doc) doc.scrollTop = doc.scrollHeight;

            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'auto'
            });
        };

        requestAnimationFrame(run);
        setTimeout(run, 160);
    }

    // ── Keyboard Shortcuts ─────────────────────────────────
    document.addEventListener('keydown', (e) => {

        // Ctrl+Alt+0 — Pause/resume bridge
        if (e.ctrlKey && e.altKey && e.key === '0') {
            e.preventDefault();
            paused = !paused;
            resetDot();
        }

        // Ctrl+Shift+F1 — Code sync to Win2 (clipboard injected verbatim; AHK prepends full prompt)
        if (e.ctrlKey && e.shiftKey && e.key === 'F1') {
            e.preventDefault();
            if (role !== 'receiver') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                localStorage.setItem('vb_code', text);
                injectText(text, true);
                setDot('🔄 CODE SYNC', '#5b8fff33', '#5b8fff');
                setTimeout(resetDot, 1000);
            });
        }

        // Ctrl+Shift+F2 — Reset / rebuild context (Alt+W from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F2') {
            e.preventDefault();
            if (role !== 'receiver') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                injectText(text, true);
                setDot('🔁 RESET', '#aa88ff33', '#aa88ff');
                setTimeout(resetDot, 1000);
            });
        }

        // Ctrl+Shift+F4 — Explain code from clipboard (Alt+A from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F4') {
            e.preventDefault();
            if (role !== 'receiver') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                injectText(text, true);
                setDot('📋 EXPLAIN', '#aa88ff33', '#aa88ff');
                setTimeout(resetDot, 1000);
            });
        }

        // Ctrl+Shift+F5 — Boot/silence sender (Alt+Esc from AHK → Win1)
        if (e.ctrlKey && e.shiftKey && e.key === 'F5') {
            e.preventDefault();
            if (role !== 'sender') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                injectText(text, true);
                setDot('🚀 BOOT', '#00e5a033', '#00e5a0');
                setTimeout(resetDot, 1500);
            });
        }

        // Ctrl+Shift+F7 — Boot receiver (legacy, kept for safety)
        if (e.ctrlKey && e.shiftKey && e.key === 'F7') {
            e.preventDefault();
            if (role !== 'receiver') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                injectText(text, true);
                setDot('🚀 BOOT', '#00e5a033', '#00e5a0');
                setTimeout(resetDot, 1500);
            });
        }

        // Ctrl+Shift+F9 — Focus textbox (for screenshot paste)
        if (e.ctrlKey && e.shiftKey && e.key === 'F9') {
            e.preventDefault();
            if (role !== 'receiver') return;
            const el = document.querySelector('div[contenteditable="true"][role="textbox"]');
            if (el) el.focus();
            setDot('📸 SCREENSHOT', '#aa88ff33', '#aa88ff');
            setTimeout(resetDot, 1000);
        }

        // Ctrl+Shift+F10 — Toggle scroll lock (Alt+X from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F10') {
            e.preventDefault();
            if (role !== 'receiver') return;
            scrollLock = !scrollLock;
            if (scrollLock) setDot('🔒 SCROLL LOCKED', '#ffaa0033', '#ffaa00');
            else setDot('🔓 SCROLL FREE', '#00e5a033', '#00e5a0');
            setTimeout(resetDot, 1500);
        }

        // Ctrl+Shift+F12 — Flush mock coding buffer (Alt+Shift from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F12') {
            e.preventDefault();
            if (role !== 'sender' || paused) return;
            flushCodingBuffer();
        }
    });

    // ── Start Role ─────────────────────────────────────────
    if (role === 'sender') {
        startSender();
    } else if (role === 'receiver') {
        localStorage.setItem('vb_reset', Date.now().toString());
        startReceiver();
    }

    // ══════════════════════════════════════════════════════════
    //  WIN1 — SENDER
    //  Polls for new voice transcription text and forwards
    //  it to Win2 via localStorage immediately on change.
    // ══════════════════════════════════════════════════════════
    function startSender() {
        let lastVoiceText   = "";
        let seenVoiceStates = new Set();

        function forwardPayload(textToSend) {
            const buffer = JSON.parse(localStorage.getItem('vb_buffer') || '[]');
            buffer.push({ id: Date.now(), text: textToSend });
            if (buffer.length > MAX_BUFFER) buffer.shift();
            localStorage.setItem('vb_buffer', JSON.stringify(buffer));
            localStorage.setItem('vb_payload', JSON.stringify({
                id: `${Date.now()}-${++seq}`,
                text: textToSend
            }));
            setDot('📤 SENT', '#00e5a055', '#00e5a0');
            setTimeout(resetDot, 600);
        }

        function bufferTranscript(textToBuffer) {
            codingBuffer.push(textToBuffer);
            if (codingBuffer.length > MAX_CODING_BUFFER) {
                codingBuffer.shift();
            }
            resetDot();
        }

        flushCodingBuffer = () => {
            syncCodingBufferModeFromFocus();
            if (!codingBuffer.length) {
                setDot('NO BUFFER', '#ffaa0033', '#ffaa00');
                setTimeout(resetDot, 1000);
                return;
            }

            const payload = buildFlushPayload();
            forwardPayload(payload);
            codingBuffer = [];
            setDot('FLUSHED', '#00e5a055', '#00e5a0');
            setTimeout(resetDot, 1200);
        };

        function handleVoiceTick() {
            if (paused) return;
            syncCodingBufferModeFromFocus();

            const nodes = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
            if (!nodes.length) return;

            const lastNode = nodes[nodes.length - 1];
            const currentText = lastNode.textContent?.trim() || "";

            // Ignore empty or loading states
            if (!currentText || /transcrib|listening/i.test(currentText)) return;

            // Ignore silence marker
            if (currentText.includes('[SYSTEM_SILENCE_WIN1]')) {
                if (lastVoiceText !== "SILENCED") {
                    setDot('🤫 IGNORED', '#ffaa0033', '#ffaa00');
                    setTimeout(resetDot, 1500);
                    lastVoiceText = "SILENCED";
                }
                return;
            }

            if (isFillerTranscript(currentText)) {
                lastVoiceText = currentText;
                resetDot();
                return;
            }

            if (currentText !== lastVoiceText) {
                lastVoiceText = currentText;
                if (!seenVoiceStates.has(lastVoiceText)) {
                    seenVoiceStates.add(lastVoiceText);
                    // Trim seen set to prevent memory growth
                    if (seenVoiceStates.size > 20) {
                        seenVoiceStates.delete(seenVoiceStates.keys().next().value);
                    }

                    if (codingBufferMode) {
                        bufferTranscript(lastVoiceText);
                    } else {
                        const textToSend = pendingCodingContext
                            ? buildPendingPayload(lastVoiceText)
                            : lastVoiceText;
                        pendingCodingContext = '';
                        forwardPayload(textToSend);
                    }

                    scrollSenderToLatest();
                }
            }
        }

        // Poll at 150ms — safe, deduplication is immediate
        setInterval(handleVoiceTick, 150);
        setInterval(syncCodingBufferModeFromFocus, 150);

        // Also forward manual copy selections from Win1
        document.addEventListener('copy', () => {
            if (paused) return;
            setTimeout(() => {
                syncCodingBufferModeFromFocus();
                const text = window.getSelection()?.toString()?.trim();
                if (!text || isFillerTranscript(text)) return;
                if (codingBufferMode) bufferTranscript(text);
                else forwardPayload(text);
            }, 50);
        });
    }

    // ══════════════════════════════════════════════════════════
    //  WIN2 — RECEIVER
    //  Listens for vb_payload in localStorage and injects
    //  into the ChatGPT input, queuing if generation is active.
    // ══════════════════════════════════════════════════════════
    function startReceiver() {
        let lastId            = null;
        let pendingPreview    = '';
        let submitting        = false;
        let generationWatcher = null;
        let previewDebounce   = null;
        let receiverWrapObserver = null;

        function waitForGenerationEnd() {
            if (generationWatcher) return;
            generationWatcher = new MutationObserver(() => {
                if (!isGenerating()) {
                    generationWatcher.disconnect();
                    generationWatcher = null;
                    if (!pendingPreview) return;
                    const final = pendingPreview;
                    pendingPreview = '';
                    setTimeout(() => {
                        injectText(final, true);
                        resetDot();
                    }, 50);
                }
            });
            generationWatcher.observe(document.body, { childList: true, subtree: true });
        }

        function processPayload(text) {
            if (isGenerating()) {
                pendingPreview = pendingPreview ? pendingPreview + '\n' + text : text;
                clearTimeout(previewDebounce);
                previewDebounce = setTimeout(() => {
                    injectText(pendingPreview, false);
                }, 80);
                setDot('📥 QUEUED', '#ffaa0033', '#ffaa00');
                waitForGenerationEnd();
            } else {
                if (submitting) return;
                submitting = true;
                setTimeout(() => {
                    injectText(text, true);
                    resetDot();
                    setTimeout(() => { submitting = false; }, 300);
                }, 30);
            }
        }

        window.addEventListener('storage', (e) => {
            if (e.key !== 'vb_payload' || paused) return;
            try {
                const payload = JSON.parse(e.newValue);
                if (!payload?.id || payload.id === lastId) return;
                lastId = payload.id;
                processPayload(payload.text);
            } catch (_) {}
        });

        scheduleReceiverCodeWrapAudit();
        receiverWrapObserver = new MutationObserver(() => {
            scheduleReceiverCodeWrapAudit();
        });
        receiverWrapObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

})();
