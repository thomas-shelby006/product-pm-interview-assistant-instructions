// ==UserScript==
// @name         ChatGPT PM Interview Bridge (2-Window)
// @version      1.3.6
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @updateURL    http://127.0.0.1:8123/tm_scripts/bridge.user.js
// @downloadURL  http://127.0.0.1:8123/tm_scripts/bridge.user.js
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
    const MAX_PM_BUFFER = 20;
    const FOCUS_OPEN_KEY = 'vb_focus_open';
    const SESSION_LOG_KEY = 'pm_session_log';
    const SESSION_CONTEXT_KEY = 'pm_session_context';
    const SILENCE_WARNING_KEY = 'vb_silence_warning';
    const SILENCE_WARNING_MS = 90000;
    const SILENCE_WARNING_REPEAT_MS = 60000;
    const PROMPT_VERSION = 'pm_boot_prompt_resume_jd_gui_v1';
    const PROJECT_FILES_VERSION = 'pm_interview_sources_resume_jd_gui_v1';
    const WPM_BASELINE = 127;
    const DEFAULT_WORD_TARGET = 'question-type-specific; 180 hard cap; behavioral 120-150';
    const CAREER_POSITIONING = 'PM/product positioning based only on provided Resume/JD; no fake second employer or unsupported company history';
    const TARGET_DOMAIN = 'Use the target domain implied by the provided Job Description; do not convert target-domain strategy into claimed work history';
    const FLUSH_WRAPPER = [
        'This is buffered interviewer transcript from the PM interview session.',
        '',
        'Some lines may be filler, partial transcription, or already answered.',
        'Identify the latest actionable interviewer question.',
        'Use earlier lines only as context.',
        'If there is no actionable PM interview question, respond only:',
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
    let pmBufferMode = localStorage.getItem(FOCUS_OPEN_KEY) === '1';
    let pmBuffer = [];
    let pendingPmContext = '';
    let flushPmBuffer = () => {};


    // ── PM session logging/export ─────────────────────────────
    function safeLocalStorageSet(key, value, context = '') {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (err) {
            try {
                console.warn('[PM Bridge] localStorage write failed', key, context, err);
            } catch (_) {}
            return false;
        }
    }

    function safeLocalStorageGet(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    }

    function createSessionId() {
        const d = new Date();
        return 'pm_session_' + formatLocalDateTime(d).replace(':', '-');
    }

    function emptySessionLog() {
        const storedContext = readStoredSessionContext();
        return {
            schema_version: '1.2',
            runtime_metadata: {
                runtime: 'AHK + Tampermonkey',
                bridge_script: 'tm_scripts/bridge.user.js',
                virtual_scroll_script: 'tm_scripts/virtual-scroll.user.js',
                transport: 'localStorage vb_payload',
                export_trigger: 'Alt+E / Ctrl+Shift+F8'
            },
            answer_length_policy: {
                wpm_baseline: WPM_BASELINE,
                effective_wpm_range: '127-130',
                hard_cap_words: 180,
                limits: {
                    follow_up_or_clarification: '30-55 words',
                    simple_conceptual: '55-75 words',
                    comparison_or_tradeoff: '75-100 words',
                    standard_pm_execution_metrics_prioritization: '90-130 words',
                    product_sense_strategy: '130-180 words',
                    estimation: '130-160 words',
                    behavioral_story: '120-150 words',
                    system_design_or_deeper_walkthrough: '150-180 words hard cap'
                }
            },
            session: {
                session_id: createSessionId(),
                started_at: new Date().toISOString(),
                ended_at: '',
                mode: storedContext.mode || '',
                target_role: storedContext.target_role || '',
                company: storedContext.company || '',
                interview_round: storedContext.interview_round || '',
                prompt_version: PROMPT_VERSION,
                project_files_version: PROJECT_FILES_VERSION,
                wpm_baseline: WPM_BASELINE,
                default_word_target: DEFAULT_WORD_TARGET,
                career_positioning: CAREER_POSITIONING,
                target_domain: TARGET_DOMAIN,
                resume_id: storedContext.resume_id || '',
                jd_id: storedContext.jd_id || '',
                notes: ''
            },
            events: [],
            qa_pairs: [],
            summary: {}
        };
    }

    function readStoredSessionContext() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_CONTEXT_KEY) || '{}') || {};
        } catch (_) {
            return {};
        }
    }

    function readSessionLog() {
        try {
            const raw = safeLocalStorageGet(SESSION_LOG_KEY, null);
            if (!raw) return emptySessionLog();
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.events)) return emptySessionLog();
            parsed.session ||= emptySessionLog().session;
            parsed.summary ||= {};
            return parsed;
        } catch (_) {
            return emptySessionLog();
        }
    }

    function writeSessionLog(log) {
        safeLocalStorageSet(SESSION_LOG_KEY, JSON.stringify(log), 'session_log');
    }

    function appendSessionEvent(source, type, text, metadata = {}, relatedEventId = '') {
        const log = readSessionLog();
        const eventId = 'evt_' + String(log.events.length + 1).padStart(6, '0');
        const event = {
            event_id: eventId,
            ts: new Date().toISOString(),
            source,
            type,
            text: text || '',
            related_event_id: relatedEventId || '',
            metadata: metadata || {}
        };
        log.events.push(event);
        if (type === 'context_loaded') {
            Object.assign(log.session, metadata || {});
        }
        writeSessionLog(log);
        return eventId;
    }

    function maybeUpdateSessionContextFromText(text) {
        if (!text || !/session context/i.test(text)) return;
        const meta = extractSessionMetadata(text);
        if (!Object.keys(meta).length) return;
        try {
            const existing = readStoredSessionContext();
            const merged = { ...existing, ...meta };
            safeLocalStorageSet(SESSION_CONTEXT_KEY, JSON.stringify(merged), 'session_context');
            const log = readSessionLog();
            Object.assign(log.session, meta);
            writeSessionLog(log);
            appendSessionEvent('bridge', 'context_loaded', 'Session context loaded', meta);
        } catch (_) {}
    }

    function extractSessionMetadata(text) {
        const meta = {};
        const fields = [
            ['target_role', /^\s*Target role:\s*(.+)$/gim],
            ['company', /^\s*Company:\s*(.+)$/gim],
            ['interview_round', /^\s*Interview round:\s*(.+)$/gim],
            ['mode', /^\s*Mode:\s*(.+)$/gim],
            ['resume_id', /^\s*Resume ID:\s*(.+)$/gim],
            ['jd_id', /^\s*(?:JD ID|Job description ID):\s*(.+)$/gim]
        ];
        for (const [key, re] of fields) {
            let match;
            let value = '';
            while ((match = re.exec(text))) value = (match[1] || '').trim();
            if (value && !/^\[.*\]$/.test(value)) meta[key] = value;
        }
        return meta;
    }

    function isSetupPrompt(text) {
        return /Sundar’s PM Interview Assistant|Sundar's PM Interview Assistant/i.test(text || '');
    }

    function isRegenerationPrompt(text) {
        return /^\s*Regenerate the latest answer for a PM interview\./i.test(text || '');
    }

    function stripCodeLikeContent(text) {
        return (text || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`[^`]*`/g, ' ');
    }

    function wordCount(text) {
        return stripCodeLikeContent(text).trim().split(/\s+/).filter(Boolean).length;
    }

    function isControlOutput(text) {
        const normalized = (text || '').trim().replace(/\s+/g, ' ');
        return normalized === '— [pause] —' || normalized === 'No action needed.';
    }

    function guessRoute(text) {
        const t = (text || '').toLowerCase();
        if (/tell me about yourself|walk me through|why pm|why product|why this role|why this company|why should we hire/.test(t)) return 'WHY-PM';
        if (/tell me about a time|example|conflict|failure|mistake|ambiguity|stakeholder|influence|leadership/.test(t)) return 'BEHAVIORAL';
        if (/metric|measure|north star|activation|retention|conversion|drop|declined|success/.test(t)) return 'METRICS';
        if (/prioriti[sz]e|roadmap|launch|execute|dependency|rollout|tradeoff/.test(t)) return 'EXECUTION';
        if (/improve|design|build|product sense|mvp|user segment|feature/.test(t)) return 'PRODUCT-SENSE';
        if (/market size|estimate|how many|opportunity size|sizing/.test(t)) return 'ESTIMATION';
        if (/strategy|competition|pricing|go to market|growth|market entry/.test(t)) return 'STRATEGY';
        if (/api|integration|latency|reliability|data quality|architecture|technical|engineering|system design/.test(t)) return 'TECH-TO-PM';
        if (/backlog|user story|acceptance criteria|sprint|agile|product owner/.test(t)) return 'PO-AGILE';
        if (/ai|automation|model|hallucination|fallback|accuracy|decision support/.test(t)) return 'AI-PM';
        return 'UNKNOWN';
    }

    function guessCompanyAnchor(text) {
        const t = (text || '').toLowerCase();
        if (/pemo|fintech|b2b saas|onboarding|expense|approval|corporate card|spend|finance workflow|receipt|kyc/.test(t)) return 'Pemo';
        if (/tpi|manufacturing|quality|inspection|defect|production|wind blade|internal tool|operations dashboard|rework/.test(t)) return 'TPI Composites';
        if (/datacaliper|analytics|dashboard|data trust|decision support|erp|netsuite|odoo|admin tool|enterprise workflow|client delivery/.test(t)) return 'DataCaliper';
        if (/tell me about yourself|background|career|common theme/.test(t)) return 'Cross-company';
        return 'Unknown';
    }

    function getLengthFlag(wordCountValue, routeGuess = 'UNKNOWN') {
        if (!Number.isFinite(wordCountValue) || wordCountValue <= 0) return 'unknown';
        const route = routeGuess || 'UNKNOWN';
        let max = 130;
        if (route === 'BEHAVIORAL') max = 150;
        else if (route === 'PRODUCT-SENSE' || route === 'STRATEGY') max = 180;
        else if (route === 'ESTIMATION') max = 160;
        else if (route === 'TECH-TO-PM' || route === 'AI-PM') max = 150;
        else if (route === 'CLARIFY') max = 55;
        if (wordCountValue > 180) return 'too_long';
        if (wordCountValue > max) return 'slightly_long';
        if (wordCountValue < 30 && route !== 'CLARIFY') return 'too_short';
        return 'good_length';
    }

    function getLatestAssistantText() {
        const nodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
        const last = nodes[nodes.length - 1];
        return last?.textContent?.trim() || '';
    }

    function captureAnswerAfterGeneration(relatedEventId, options = {}) {
        if (role !== 'receiver' || options.skipAnswerCapture) return;
        const beforeText = getLatestAssistantText();
        const startedAt = Date.now();
        let sawGenerating = false;
        let stableSince = 0;
        let lastCandidate = '';

        const timer = setInterval(() => {
            const generating = isGenerating();
            if (generating) {
                sawGenerating = true;
                stableSince = 0;
                return;
            }

            const candidate = getLatestAssistantText();
            const hasNewAnswer = candidate && candidate !== beforeText;
            const enoughTimePassed = Date.now() - startedAt > 2500;

            if (hasNewAnswer && (sawGenerating || enoughTimePassed)) {
                if (candidate !== lastCandidate) {
                    lastCandidate = candidate;
                    stableSince = Date.now();
                    return;
                }

                if (Date.now() - stableSince >= 900) {
                    clearInterval(timer);
                    const controlOutput = isControlOutput(candidate);
                    const wc = controlOutput ? 0 : wordCount(candidate);
                    appendSessionEvent(
                        'win2',
                        options.regeneration ? 'regeneration' : 'answer',
                        candidate,
                        {
                            word_count: wc,
                            estimated_seconds_at_127_wpm: Math.round((wc / WPM_BASELINE) * 60),
                            length_flag: controlOutput ? 'control_output' : getLengthFlag(wc, 'UNKNOWN'),
                            answer_capture: 'best_effort',
                            route_visible_to_user: false,
                            control_output: controlOutput
                        },
                        relatedEventId
                    );
                    scheduleReceiverAutoScroll();
                    if (!controlOutput) {
                        setDot(`WIN2 · ${wc}w`, '#00e5a033', '#00e5a0');
                        setTimeout(resetDot, 2200);
                    }
                }
            }

            if (Date.now() - startedAt > 90000) {
                clearInterval(timer);
                appendSessionEvent('win2', 'error', 'Answer capture timed out', {
                    answer_capture: 'timeout'
                }, relatedEventId);
            }
        }, 500);
    }

    function formatLocalDateTime(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join('-') + '_' + [
            pad(date.getHours()),
            pad(date.getMinutes())
        ].join('-');
    }

    function buildMarkdownExport(log) {
        const lines = [];
        lines.push('# PM Interview Session Export');
        lines.push('');
        lines.push(`Session ID: ${log.session?.session_id || ''}`);
        lines.push(`Started: ${log.session?.started_at || ''}`);
        lines.push(`Ended: ${log.session?.ended_at || ''}`);
        lines.push(`Target role: ${log.session?.target_role || ''}`);
        lines.push(`Company: ${log.session?.company || ''}`);
        lines.push(`Interview round: ${log.session?.interview_round || ''}`);
        lines.push(`Mode: ${log.session?.mode || ''}`);
        lines.push(`Prompt version: ${log.session?.prompt_version || PROMPT_VERSION}`);
        lines.push(`WPM baseline: ${log.session?.wpm_baseline || WPM_BASELINE}`);
        lines.push(`Default word target: ${log.session?.default_word_target || DEFAULT_WORD_TARGET}`);
        lines.push(`Career positioning: ${log.session?.career_positioning || CAREER_POSITIONING}`);
        lines.push(`Target domain: ${log.session?.target_domain || TARGET_DOMAIN}`);
        lines.push('');
        lines.push('## Q&A Pairs');
        for (const qa of log.qa_pairs || []) {
            lines.push('');
            lines.push(`### ${qa.qa_id}`);
            lines.push(`- Route guess: ${qa.route_guess || 'UNKNOWN'}`);
            lines.push(`- Company anchor guess: ${qa.company_anchor_guess || 'Unknown'}`);
            lines.push(`- Word count: ${qa.word_count || 0}`);
            lines.push(`- Length flag: ${qa.length_flag || 'unknown'}`);
            lines.push('');
            lines.push('**Question:**');
            lines.push('');
            lines.push(qa.cleaned_question || '');
            lines.push('');
            lines.push('**Answer:**');
            lines.push('');
            lines.push(qa.assistant_answer || '[missing]');
        }
        lines.push('');
        lines.push('## Events');
        for (const event of log.events || []) {
            lines.push('');
            lines.push(`### ${event.event_id} — ${event.type}`);
            lines.push(`- Time: ${event.ts}`);
            lines.push(`- Source: ${event.source}`);
            if (event.related_event_id) lines.push(`- Related: ${event.related_event_id}`);
            lines.push('');
            lines.push('```text');
            lines.push(event.text || '');
            lines.push('```');
        }
        return lines.join('\n');
    }

    function downloadTextFile(filename, text, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function buildQaPairs(log) {
        const events = log.events || [];
        const answersByRelated = new Map();
        for (const event of events) {
            if ((event.type === 'answer' || event.type === 'regeneration') && event.related_event_id) {
                if (!answersByRelated.has(event.related_event_id)) answersByRelated.set(event.related_event_id, event);
            }
        }

        const qaPairs = [];
        for (const event of events) {
            if (event.type !== 'received_question') continue;
            const answer = answersByRelated.get(event.event_id) || null;
            const routeGuess = event.metadata?.route_guess || guessRoute(event.text || '');
            const companyGuess = event.metadata?.company_anchor_guess || guessCompanyAnchor(event.text || '');
            const wc = answer?.metadata?.word_count || 0;
            qaPairs.push({
                qa_id: 'qa_' + String(qaPairs.length + 1).padStart(4, '0'),
                timestamp_start: event.ts || '',
                timestamp_end: answer?.ts || '',
                cleaned_question: event.text || '',
                assistant_answer: answer?.text || '',
                answer_capture_status: answer ? 'captured' : 'missing',
                word_count: wc,
                estimated_read_seconds_at_127_wpm: wc ? Math.round((wc / WPM_BASELINE) * 60) : 0,
                route_guess: routeGuess,
                company_anchor_guess: companyGuess,
                length_flag: answer ? getLengthFlag(wc, routeGuess) : 'unknown',
                truth_risk_flags: [],
                notes: answer ? [] : ['Answer capture missing or not related by event id.']
            });
        }
        return qaPairs;
    }

    function exportPmSession() {
        const log = readSessionLog();
        log.session ||= emptySessionLog().session;
        log.session.ended_at = new Date().toISOString();
        log.session.wpm_baseline = log.session.wpm_baseline || WPM_BASELINE;
        log.session.default_word_target = log.session.default_word_target || DEFAULT_WORD_TARGET;
        log.session.career_positioning = log.session.career_positioning || CAREER_POSITIONING;
        log.session.target_domain = log.session.target_domain || TARGET_DOMAIN;
        log.qa_pairs = buildQaPairs(log);
        const answerWordCounts = (log.qa_pairs || []).map(q => q.word_count || 0).filter(Boolean);
        const routeGuesses = [...new Set((log.qa_pairs || []).map(q => q.route_guess).filter(Boolean))];
        log.summary = {
            total_events: log.events.length,
            raw_transcripts: log.events.filter(e => e.type === 'raw_transcript').length,
            forwarded_questions: log.events.filter(e => e.type === 'forwarded_question').length,
            received_questions: log.events.filter(e => e.type === 'received_question').length,
            answers: log.events.filter(e => e.type === 'answer').length,
            regenerations: log.events.filter(e => e.type === 'regeneration').length,
            qa_pairs: log.qa_pairs.length,
            average_word_count: answerWordCounts.length ? Math.round(answerWordCounts.reduce((a, b) => a + b, 0) / answerWordCounts.length) : 0,
            too_long_count: (log.qa_pairs || []).filter(q => q.length_flag === 'too_long' || q.length_flag === 'slightly_long').length,
            route_guesses: routeGuesses,
            answer_capture: 'best_effort'
        };
        writeSessionLog(log);

        const base = 'pm_interview_session_' + formatLocalDateTime(new Date());
        downloadTextFile(base + '.json', JSON.stringify(log, null, 2), 'application/json');
        downloadTextFile(base + '.md', buildMarkdownExport(log), 'text/markdown');
        setDot('EXPORT', '#00e5a033', '#00e5a0');
        setTimeout(resetDot, 1200);
    }

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
        const overlay = document.getElementById('vb-focus-overlay');
        const isOpen = role === 'sender' && overlay?.classList.contains('vb-open');
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
            if (pmBufferMode) {
                const label = pmBuffer.length
                    ? `PM BUFFER (${pmBuffer.length})`
                    : 'PM BUFFER';
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
        if (!el) {
            appendSessionEvent('bridge', 'error', 'Injection failed: ChatGPT textbox not found', {
                filter: 'inject_failed_no_textbox'
            });
            setDot('INJECT FAIL', '#ff444433', '#ff4444');
            setTimeout(resetDot, 2500);
            return false;
        }
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
        return true;
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

    function isLikelyPartialTranscript(text) {
        const raw = (text || '').trim();
        if (!raw) return true;
        const words = raw.split(/\s+/).filter(Boolean);
        if (/[.!?]$/.test(raw)) return false;
        if (/[-–—]$/.test(raw)) return true;
        if (/\b(and|or|but|because|about|with|without|for|to|the|a|an|like|that|this|would|could|should|how you would|what you would)$/i.test(raw)) return true;
        if (words.length < 8 && !/^(why|what|how|when|where|who|which|can|could|would|should|tell|describe|explain|walk|give|do|did|are|is|was|were|improve|design|measure|prioriti[sz]e)\b/i.test(raw)) {
            return true;
        }
        return false;
    }

    function joinTranscriptLines(lines) {
        return lines
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n');
    }

    function buildFlushPayload() {
        return FLUSH_WRAPPER + joinTranscriptLines(pmBuffer);
    }

    function buildPendingPayload(latestText) {
        return [
            'Context from the previous PM interview transcript segment:',
            pendingPmContext,
            '',
            'Now answer the latest interviewer question:',
            latestText
        ].join('\n');
    }

    function syncPmBufferModeFromFocus() {
        const focusOpen = localStorage.getItem(FOCUS_OPEN_KEY) === '1';
        if (focusOpen === pmBufferMode) return;

        if (!focusOpen && pmBuffer.length) {
            const unsent = joinTranscriptLines(pmBuffer);
            pendingPmContext = pendingPmContext
                ? pendingPmContext + '\n' + unsent
                : unsent;
            pmBuffer = [];
        }

        pmBufferMode = focusOpen;
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


    let receiverAutoScrollTimer = null;
    function scrollReceiverToLatest() {
        if (paused || role !== 'receiver' || scrollLock) return;

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
        setTimeout(run, 180);
        setTimeout(run, 650);
    }

    function scheduleReceiverAutoScroll() {
        if (role !== 'receiver' || scrollLock) return;
        clearTimeout(receiverAutoScrollTimer);
        receiverAutoScrollTimer = setTimeout(scrollReceiverToLatest, 120);
    }

    // ── Keyboard Shortcuts ─────────────────────────────────
    document.addEventListener('keydown', (e) => {

        // Ctrl+Alt+0 — Pause/resume bridge
        if (e.ctrlKey && e.altKey && e.key === '0') {
            e.preventDefault();
            paused = !paused;
            resetDot();
        }

        // They are intentionally not handled in PM mode and are not mapped from AHK.

        // Ctrl+Shift+F5 — Initial PM boot/context send from AHK launch flow → Win1
        if (e.ctrlKey && e.shiftKey && e.key === 'F5') {
            e.preventDefault();
            if (role !== 'sender') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                maybeUpdateSessionContextFromText(text);
                appendSessionEvent('win1', 'context_loaded', 'PM boot/context sent to Win1', { hotkey: 'Ctrl+Shift+F5' });
                injectText(text, true);
                setDot('BOOT', '#00e5a033', '#00e5a0');
                setTimeout(resetDot, 1500);
            });
        }

        // Ctrl+Shift+F7 — Direct PM boot/context resend to Win2 (Alt+Esc from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F7') {
            e.preventDefault();
            if (role !== 'receiver') return;
            navigator.clipboard.readText().then(text => {
                if (!text) return;
                maybeUpdateSessionContextFromText(text);
                appendSessionEvent('win2', 'context_loaded', 'PM boot/context sent directly to Win2', { hotkey: 'Ctrl+Shift+F7' });
                injectText(text, true);
                setDot('BOOT', '#00e5a033', '#00e5a0');
                setTimeout(resetDot, 1500);
            });
        }

        // Ctrl+Shift+F8 — Export PM session (Alt+E from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F8') {
            e.preventDefault();
            if (role !== 'receiver') return;
            appendSessionEvent('win2', 'hotkey', 'Export PM session', { hotkey: 'Ctrl+Shift+F8', action: 'export_session' });
            exportPmSession();
        }

        // Ctrl+Shift+F9 — Focus textbox for screenshot/context paste (Alt+S from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F9') {
            e.preventDefault();
            if (role !== 'receiver') return;
            const el = document.querySelector('div[contenteditable="true"][role="textbox"]');
            if (el) el.focus();
            setDot('📸 SCREENSHOT', '#aa88ff33', '#aa88ff');
            setTimeout(resetDot, 1000);
        }

        // Ctrl+Shift+F10 — Toggle scroll lock (Alt+W from AHK)
        if (e.ctrlKey && e.shiftKey && e.key === 'F10') {
            e.preventDefault();
            if (role !== 'receiver') return;
            scrollLock = !scrollLock;
            appendSessionEvent('win2', 'hotkey', 'Scroll lock toggled', { hotkey: 'Ctrl+Shift+F10', scroll_lock: scrollLock });
            if (scrollLock) setDot('SCROLL LOCKED', '#ffaa0033', '#ffaa00');
            else setDot('SCROLL FREE', '#00e5a033', '#00e5a0');
            setTimeout(resetDot, 1500);
        }

        // Ctrl+Shift+F12 — Flush buffered PM interview transcript
        if (e.ctrlKey && e.shiftKey && e.key === 'F12') {
            e.preventDefault();
            if (role !== 'sender' || paused) return;
            flushPmBuffer();
        }
    });

    // ── Start Role ─────────────────────────────────────────
    if (role === 'sender') {
        startSender();
    } else if (role === 'receiver') {
        safeLocalStorageSet('vb_reset', Date.now().toString(), 'receiver_reset');
        startReceiver();
    }

    // ══════════════════════════════════════════════════════════
    //  WIN1 — SENDER
    //  Polls for new PM interviewer transcription text and forwards
    //  it to Win2 via localStorage immediately on change.
    // ══════════════════════════════════════════════════════════
    function startSender() {
        let lastVoiceText   = "";
        let seenVoiceStates = new Set();
        let voiceSeen = false;
        let lastVoiceActivityAt = Date.now();
        let lastSilenceWarningAt = 0;

        function noteVoiceActivity() {
            voiceSeen = true;
            lastVoiceActivityAt = Date.now();
        }

        function emitSilenceWarningIfNeeded() {
            if (paused || !voiceSeen) return;
            const now = Date.now();
            if (now - lastVoiceActivityAt < SILENCE_WARNING_MS) return;
            if (now - lastSilenceWarningAt < SILENCE_WARNING_REPEAT_MS) return;
            lastSilenceWarningAt = now;
            try {
                safeLocalStorageSet(SILENCE_WARNING_KEY, JSON.stringify({
                    id: `${now}-${++seq}`,
                    ts: new Date().toISOString(),
                    silent_ms: now - lastVoiceActivityAt
                }), 'silence_warning');
            } catch (_) {}
            setDot('SILENCE 90s', '#ff444422', '#ff4444');
            setTimeout(resetDot, 3500);
        }

        function forwardPayload(textToSend, metadata = {}) {
            const payloadId = `${Date.now()}-${++seq}`;
            const buffer = JSON.parse(safeLocalStorageGet('vb_buffer', '[]') || '[]');
            buffer.push({ id: Date.now(), text: textToSend });
            if (buffer.length > MAX_BUFFER) buffer.shift();
            safeLocalStorageSet('vb_buffer', JSON.stringify(buffer), 'vb_buffer');

            const forwardedEventId = appendSessionEvent(
                'bridge',
                'forwarded_question',
                textToSend,
                {
                    payload_id: payloadId,
                    deduped: true,
                    buffered: !!metadata.buffered,
                    setup_prompt: isSetupPrompt(textToSend),
                    route_guess: guessRoute(textToSend),
                    company_anchor_guess: guessCompanyAnchor(textToSend)
                },
                metadata.rawEventId || ''
            );

            maybeUpdateSessionContextFromText(textToSend);

            const payloadWritten = safeLocalStorageSet('vb_payload', JSON.stringify({
                id: payloadId,
                text: textToSend,
                related_event_id: forwardedEventId
            }), 'vb_payload');
            if (payloadWritten) {
                setDot('SENT', '#00e5a055', '#00e5a0');
                setTimeout(resetDot, 600);
            } else {
                appendSessionEvent('bridge', 'error', 'Failed to write vb_payload to localStorage', {
                    filter: 'forward_payload_write_failed',
                    payload_id: payloadId
                }, metadata.rawEventId || '');
                setDot('SEND FAIL', '#ff444433', '#ff4444');
                setTimeout(resetDot, 2500);
            }
        }

        function bufferTranscript(textToBuffer, rawEventId = '') {
            pmBuffer.push(textToBuffer);
            if (pmBuffer.length > MAX_PM_BUFFER) {
                pmBuffer.shift();
            }
            if (!rawEventId) {
                appendSessionEvent('win1', 'raw_transcript', textToBuffer, {
                    voice_mode: true,
                    buffered: true
                });
            }
            resetDot();
        }

        flushPmBuffer = () => {
            syncPmBufferModeFromFocus();
            if (!pmBuffer.length) {
                setDot('NO BUFFER', '#ffaa0033', '#ffaa00');
                setTimeout(resetDot, 1000);
                return;
            }

            const payload = buildFlushPayload();
            forwardPayload(payload, { buffered: true });
            pmBuffer = [];
            setDot('FLUSHED', '#00e5a055', '#00e5a0');
            setTimeout(resetDot, 1200);
        };

        function handleVoiceTick() {
            if (paused) return;
            syncPmBufferModeFromFocus();

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
                if (currentText !== lastVoiceText) noteVoiceActivity();
                lastVoiceText = currentText;
                resetDot();
                return;
            }

            if (currentText !== lastVoiceText) {
                noteVoiceActivity();
                lastVoiceText = currentText;
                if (!seenVoiceStates.has(lastVoiceText)) {
                    seenVoiceStates.add(lastVoiceText);
                    // Trim seen set to prevent memory growth
                    if (seenVoiceStates.size > 20) {
                        seenVoiceStates.delete(seenVoiceStates.keys().next().value);
                    }

                    if (isLikelyPartialTranscript(lastVoiceText)) {
                        appendSessionEvent('win1', 'transcript_suppressed_partial', lastVoiceText, {
                            voice_mode: true,
                            filter: 'bridge_partial_transcript',
                            word_count: wordCount(lastVoiceText)
                        });
                        resetDot();
                        return;
                    }

                    const rawEventId = appendSessionEvent('win1', 'raw_transcript', lastVoiceText, {
                        voice_mode: true,
                        is_partial: false
                    });

                    if (pmBufferMode) {
                        bufferTranscript(lastVoiceText, rawEventId);
                    } else {
                        const textToSend = pendingPmContext
                            ? buildPendingPayload(lastVoiceText)
                            : lastVoiceText;
                        pendingPmContext = '';
                        forwardPayload(textToSend, { rawEventId, buffered: false });
                    }

                    scrollSenderToLatest();
                }
            }
        }

        // Poll at 150ms — safe, deduplication is immediate
        setInterval(handleVoiceTick, 150);
        setInterval(syncPmBufferModeFromFocus, 150);
        setInterval(emitSilenceWarningIfNeeded, 5000);

        // Also forward manual copy selections from Win1
        document.addEventListener('copy', () => {
            if (paused) return;
            setTimeout(() => {
                syncPmBufferModeFromFocus();
                const text = window.getSelection()?.toString()?.trim();
                if (!text || isFillerTranscript(text) || isLikelyPartialTranscript(text)) return;
                if (pmBufferMode) bufferTranscript(text);
                else {
                    const rawEventId = appendSessionEvent('win1', 'raw_transcript', text, { manual_copy: true });
                    forwardPayload(text, { rawEventId, buffered: false });
                }
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
                    const eventId = appendSessionEvent('win2', 'received_question', final, {
                        queued: true,
                        route_guess: guessRoute(final),
                        company_anchor_guess: guessCompanyAnchor(final)
                    });
                    setTimeout(() => {
                        injectText(final, true);
                        scheduleReceiverAutoScroll();
                        captureAnswerAfterGeneration(eventId, { skipAnswerCapture: isSetupPrompt(final) });
                        resetDot();
                    }, 50);
                }
            });
            generationWatcher.observe(document.body, { childList: true, subtree: true });
        }

        function processPayload(text, payload = {}) {
            if (isGenerating()) {
                pendingPreview = pendingPreview ? pendingPreview + '\n' + text : text;
                clearTimeout(previewDebounce);
                previewDebounce = setTimeout(() => {
                    injectText(pendingPreview, false);
                }, 80);
                setDot('QUEUED', '#ffaa0033', '#ffaa00');
                waitForGenerationEnd();
            } else {
                if (submitting) return;
                submitting = true;
                const eventId = appendSessionEvent(
                    'win2',
                    'received_question',
                    text,
                    {
                        payload_id: payload.id || '',
                        queued: false,
                        setup_prompt: isSetupPrompt(text),
                        route_guess: guessRoute(text),
                        company_anchor_guess: guessCompanyAnchor(text)
                    },
                    payload.related_event_id || ''
                );
                setTimeout(() => {
                    injectText(text, true);
                    scheduleReceiverAutoScroll();
                    captureAnswerAfterGeneration(eventId, {
                        skipAnswerCapture: isSetupPrompt(text),
                        regeneration: isRegenerationPrompt(text)
                    });
                    resetDot();
                    setTimeout(() => { submitting = false; }, 300);
                }, 30);
            }
        }

        window.addEventListener('storage', (e) => {
            if (paused) return;

            if (e.key === SILENCE_WARNING_KEY) {
                try {
                    const warning = JSON.parse(e.newValue || '{}');
                    appendSessionEvent('win2', 'warning', 'Win1 transcript has been silent for 90 seconds', {
                        warning_type: 'win1_silence_detector',
                        warning_id: warning.id || ''
                    });
                    setDot('SILENCE 90s', '#ff444422', '#ff4444');
                    setTimeout(resetDot, 3500);
                } catch (_) {}
                return;
            }

            if (e.key !== 'vb_payload') return;
            try {
                const payload = JSON.parse(e.newValue);
                if (!payload?.id || payload.id === lastId) return;
                lastId = payload.id;
                processPayload(payload.text, payload);
            } catch (err) {
                appendSessionEvent('win2', 'error', 'Failed to parse incoming vb_payload', {
                    filter: 'payload_parse_failed',
                    error: String(err && err.message ? err.message : err)
                });
                setDot('PAYLOAD ERR', '#ff444433', '#ff4444');
                setTimeout(resetDot, 2500);
            }
        });

        scheduleReceiverCodeWrapAudit();
        receiverWrapObserver = new MutationObserver(() => {
            scheduleReceiverCodeWrapAudit();
            scheduleReceiverAutoScroll();
        });
        receiverWrapObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

})();
