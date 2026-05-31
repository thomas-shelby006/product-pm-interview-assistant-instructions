// ==UserScript==
// @name         ChatGPT Dictation Bridge
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Monitors ChatGPT textarea after voice dictation, copies text to clipboard, clears input, and signals AutoHotkey via window title.
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────
    // CONFIG
    // ─────────────────────────────────────────────
    const COMPLETION_TITLE  = 'CHATGPT_DICTATION_COMPLETE';
    const POLL_INTERVAL_MS  = 400;   // How often to check textarea while in "processing" mode
    const SIGNAL_RESET_MS   = 1200;  // How long the DICTATION_COMPLETE title stays before reset

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────
    let monitoring  = false;   // True while AHK is in "Processing" state
    let pollTimer   = null;
    let originalTitle = document.title;

    // Keep originalTitle updated as ChatGPT changes it during navigation
    new MutationObserver(() => {
        if (document.title !== COMPLETION_TITLE) {
            originalTitle = document.title;
        }
    }).observe(document.querySelector('title') || document.head, { subtree: true, characterData: true, childList: true });

    // ─────────────────────────────────────────────
    // FIND THE PROMPT TEXTAREA
    // ChatGPT uses a ProseMirror div, not a real <textarea>
    // ─────────────────────────────────────────────
    function getTextarea() {
        // Primary selector (current as of 2025)
        let el = document.querySelector('#prompt-textarea');
        if (el) return el;

        // Fallback: contenteditable div with role=textbox
        el = document.querySelector('[contenteditable="true"][data-id]');
        if (el) return el;

        // Wider fallback
        return document.querySelector('[contenteditable="true"]');
    }

    // ─────────────────────────────────────────────
    // CLEAR TEXTAREA
    // Must work with React/ProseMirror — execCommand is the safest cross-framework approach
    // ─────────────────────────────────────────────
    function clearTextarea(el) {
        el.focus();
        // Select all content
        document.execCommand('selectAll', false, null);
        // Delete selected content (triggers React synthetic event correctly)
        document.execCommand('delete', false, null);

        // Double-check: if text remains, try the nativeInputValueSetter trick for React inputs
        if (el.textContent.trim().length > 0) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'textContent');
            if (nativeSetter && nativeSetter.set) {
                nativeSetter.set.call(el, '');
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    // ─────────────────────────────────────────────
    // SIGNAL AUTOHOTKEY VIA WINDOW TITLE
    // AHK polls for WinExist(COMPLETION_TITLE)
    // ─────────────────────────────────────────────
    function signalAHK() {
        document.title = COMPLETION_TITLE;
        setTimeout(() => {
            document.title = originalTitle;
        }, SIGNAL_RESET_MS);
    }

    // ─────────────────────────────────────────────
    // MAIN: EXTRACT TEXT, COPY, CLEAR, SIGNAL
    // ─────────────────────────────────────────────
    let extracting = false;  // Re-entrancy guard

    function extractAndFinish() {
        if (extracting) return;
        extracting = true;
        const el = getTextarea();
        if (!el) {
            console.warn('[DictationBridge] Textarea not found.');
            extracting = false;
            signalAHK();  // Signal anyway so AHK doesn't hang
            return;
        }

        const text = el.textContent.trim();
        if (text.length === 0) {
            console.warn('[DictationBridge] Textarea is empty — nothing to copy.');
            extracting = false;
            signalAHK();
            return;
        }

        // 1. Copy to clipboard using GM_setClipboard (bypasses browser clipboard restrictions)
        GM_setClipboard(text);
        console.log('[DictationBridge] Copied to clipboard:', text.slice(0, 80) + '...');

        // 2. Clear the textarea
        clearTextarea(el);

        // 3. Signal AHK
        extracting = false;
        signalAHK();
    }

    // ─────────────────────────────────────────────
    // POLLING LOGIC
    // Starts when AHK sends Ctrl+Shift+D (stop).
    // ChatGPT processes all at once — textarea goes from empty → filled when done.
    // We watch for that transition.
    // ─────────────────────────────────────────────
    function startMonitoring() {
        if (monitoring) return;
        monitoring = true;
        extracting = false;  // Reset for new session
        console.log('[DictationBridge] Monitoring for dictation completion...');

        let attempts = 0;
        const maxAttempts = 150;  // 150 × 400ms = 60 seconds max wait — covers long recordings

        pollTimer = setInterval(() => {
            attempts++;

            const el = getTextarea();
            if (el && el.textContent.trim().length > 0) {
                // Text has appeared — processing complete
                stopMonitoring();
                // Small buffer so ChatGPT finishes rendering the last word
                setTimeout(extractAndFinish, 300);
                return;
            }

            if (attempts >= maxAttempts) {
                console.warn('[DictationBridge] Timed out waiting for dictation text.');
                stopMonitoring();
                signalAHK();  // Unblock AHK even on timeout
            }
        }, POLL_INTERVAL_MS);
    }

    function stopMonitoring() {
        monitoring = false;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // ─────────────────────────────────────────────
    // KEYDOWN LISTENER
    // AHK sends Ctrl+Shift+D twice:
    //   1st press → starts voice (ChatGPT handles natively), we do nothing
    //   2nd press → stops voice (ChatGPT handles natively), we start monitoring
    //
    // We track the toggle ourselves.
    // ─────────────────────────────────────────────
    let dictationActive = false;

    window.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            if (!dictationActive) {
                // Starting dictation — let ChatGPT handle it, just track state
                dictationActive = true;
                console.log('[DictationBridge] Dictation started.');
            } else {
                // Stopping dictation — start monitoring for output text
                dictationActive = false;
                console.log('[DictationBridge] Dictation stopped. Monitoring for output...');
                // Give ChatGPT 200ms to stop the mic before we start polling
                setTimeout(startMonitoring, 200);
            }
        }
    }, true);  // Capture phase so we catch it before ChatGPT's own handlers

    console.log('[DictationBridge] v2.0 loaded and ready.');
})();
