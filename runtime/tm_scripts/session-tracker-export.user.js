// ==UserScript==
// @name         ChatGPT PM Session Tracker Export (2-Window Companion)
// @namespace    pm-interview-helper
// @version      0.1.0
// @description  Companion exporter: writes win1_sender.md / win2_receiver.md from the bridge's pm_session_log for the ChatGPT Review Lab. Does NOT write to GitHub and holds no token.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * Companion to bridge.user.js (v1.3.9). Read-only with respect to the bridge:
 * it only READS localStorage 'pm_session_log' and exports a per-window Markdown file.
 * It never changes bridge behavior, never touches GitHub, and never stores a token.
 *
 *   Win1 (sender)   -> <session_id>_win1_sender.md   (transcript / input / blocked / forwarding)
 *   Win2 (receiver) -> <session_id>_win2_receiver.md (received questions / answers / manual Win2 prompts)
 *
 * Triggers:
 *   - Ctrl+Shift+F9 : export THIS window's file.
 *   - localStorage 'pm_session_tracker_export_request' changes -> BOTH windows export their own file.
 */

(function () {
    'use strict';

    const EXPORTER_VERSION = '0.1.0';
    const SESSION_LOG_KEY = 'pm_session_log';
    const SESSION_CONTEXT_KEY = 'pm_session_context';
    const EXPORT_REQUEST_KEY = 'pm_session_tracker_export_request';

    // ── Role detection (mirrors bridge.user.js) ────────────
    function getRole() {
        const fromSession = sessionStorage.getItem('vb_role');
        if (fromSession === 'sender' || fromSession === 'receiver') return fromSession;
        const t = (document.title || '').toUpperCase();
        if (t.includes('VB_SENDER')) return 'sender';
        if (t.includes('VB_RECEIVER')) return 'receiver';
        return null;
    }

    // ── Safe storage reads ─────────────────────────────────
    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    function readSessionLog() {
        const log = readJSON(SESSION_LOG_KEY, null);
        if (!log || !Array.isArray(log.events)) {
            return { session: {}, events: [], qa_pairs: [], summary: {}, runtime_metadata: {} };
        }
        log.session = log.session || {};
        log.events = log.events || [];
        log.qa_pairs = log.qa_pairs || [];
        log.summary = log.summary || {};
        return log;
    }

    // ── Helpers ────────────────────────────────────────────
    function pad(n) { return String(n).padStart(2, '0'); }

    function localStamp(date) {
        const d = date || new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            '_' + pad(d.getHours()) + '-' + pad(d.getMinutes());
    }

    function sessionId(log) {
        const sid = log.session && log.session.session_id;
        if (sid) return String(sid);
        return 'pm_session_' + localStamp(new Date());
    }

    // Which events belong in this window's file.
    // Win1 (sender): transcript capture, blocked/suppressed transcript, forwarding evidence, win1 context/errors.
    // Win2 (receiver): received questions, answers, regenerations, armed, manual win2 prompts, win2 errors.
    function eventBelongsToRole(event, role) {
        const src = (event.source || '').toLowerCase();
        const type = (event.type || '').toLowerCase();
        if (role === 'sender') {
            if (src === 'win1') return true;
            if (src === 'bridge' && type !== 'session_armed') return true; // forwarded_question, context_loaded, bridge errors
            return false;
        }
        // receiver
        if (src === 'win2') return true;
        if (type === 'session_armed') return true;
        return false;
    }

    // Map an event to a human status + optional block reason.
    function deriveStatus(event) {
        const type = (event.type || '').toLowerCase();
        const meta = event.metadata || {};
        const filter = meta.filter || '';
        if (type.includes('suppressed') || /partial|filler|empty/.test(filter)) {
            return { status: 'blocked', reason: meta.reason || filter || type };
        }
        if (type === 'error') return { status: 'error', reason: filter || '' };
        if (type === 'warning') return { status: 'warning', reason: filter || '' };
        if (type === 'raw_transcript') return { status: 'captured', reason: '' };
        if (type === 'forwarded_question') return { status: 'forwarded', reason: '' };
        if (type === 'received_question') return { status: meta.setup_prompt ? 'received_setup' : 'received', reason: '' };
        if (type === 'answer') return { status: 'answered', reason: '' };
        if (type === 'regeneration') return { status: 'regenerated', reason: '' };
        if (type === 'session_armed') return { status: 'armed', reason: '' };
        if (type === 'context_loaded') return { status: 'context_loaded', reason: '' };
        return { status: type || 'event', reason: filter || '' };
    }

    function metaLine(meta) {
        if (!meta) return '';
        const parts = [];
        if (meta.word_count != null) parts.push('word_count=' + meta.word_count);
        if (meta.length_flag) parts.push('length_flag=' + meta.length_flag);
        if (meta.route_guess) parts.push('route_guess=' + meta.route_guess);
        if (meta.company_anchor_guess) parts.push('company_anchor_guess=' + meta.company_anchor_guess);
        return parts.join(' · ');
    }

    function fence(text) {
        const t = (text == null ? '' : String(text));
        // Avoid breaking the code fence if the text contains backticks.
        const safe = t.replace(/```/g, '` ` `');
        return '```text\n' + safe + '\n```';
    }

    // ── Visible DOM messages (backup section) ──────────────
    function hashText(s) {
        let h = 0;
        const str = s || '';
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        }
        return String(h);
    }

    function visibleMessages() {
        const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
        const out = [];
        const seen = new Set();
        let seq = 0;
        for (const node of nodes) {
            const role = node.getAttribute('data-message-author-role') || 'unknown';
            const text = (node.textContent || '').trim();
            if (!text) continue;
            const key = role + '|' + hashText(text);
            if (seen.has(key)) continue; // dedupe obvious repeats
            seen.add(key);
            seq += 1;
            out.push({ seq, role, text });
        }
        return out;
    }

    // ── Markdown builders ──────────────────────────────────
    function metadataBlock(log, role) {
        const s = log.session || {};
        const rt = log.runtime_metadata || {};
        const ctx = readJSON(SESSION_CONTEXT_KEY, {}) || {};
        const lines = [];
        lines.push('## Session metadata');
        lines.push('');
        lines.push('- session_id: ' + (s.session_id || '(none)'));
        lines.push('- window: ' + (role === 'sender' ? 'win1_sender' : 'win2_receiver'));
        lines.push('- session_type / mode: ' + (s.mode || ctx.mode || '(unset)'));
        lines.push('- export_time: ' + new Date().toISOString());
        lines.push('- started_at: ' + (s.started_at || '(unknown)'));
        lines.push('- ended_at: ' + (s.ended_at || '(open)'));
        lines.push('- company: ' + (s.company || ctx.company || '(unset)'));
        lines.push('- target_role: ' + (s.target_role || ctx.target_role || '(unset)'));
        lines.push('- round: ' + (s.interview_round || ctx.interview_round || '(unset)'));
        lines.push('- emphasis: ' + (s.emphasis || ctx.emphasis || '(unset)'));
        lines.push('- project_used: ' + (s.project_files_version || rt.project || '(unknown)'));
        lines.push('- prompt_version: ' + (s.prompt_version || '(unknown)'));
        lines.push('- bridge_runtime: ' + (rt.runtime || '(unknown)') + (rt.bridge_script ? ' (' + rt.bridge_script + ')' : ''));
        lines.push('- tracker_exporter_version: ' + EXPORTER_VERSION);
        return lines.join('\n');
    }

    function eventsBlock(log, role) {
        const events = (log.events || []).filter(e => eventBelongsToRole(e, role));
        const lines = [];
        lines.push('## Events (' + (role === 'sender' ? 'Win1 sender' : 'Win2 receiver') + ')');
        lines.push('');
        if (!events.length) {
            lines.push('_No events recorded for this window._');
            return lines.join('\n');
        }
        let seq = 0;
        for (const e of events) {
            seq += 1;
            const st = deriveStatus(e);
            const meta = e.metadata || {};
            lines.push('### ' + String(seq).padStart(3, '0') + ' · ' + (e.type || 'event') + ' · ' + st.status);
            lines.push('- event_seq: ' + seq);
            lines.push('- event_id: ' + (e.event_id || ''));
            lines.push('- time: ' + (e.ts || ''));
            lines.push('- window: ' + (role === 'sender' ? 'win1' : 'win2'));
            lines.push('- source: ' + (e.source || ''));
            lines.push('- type: ' + (e.type || ''));
            lines.push('- status: ' + st.status);
            if (st.reason) lines.push('- block_reason: ' + st.reason);
            if (e.related_event_id) lines.push('- related_event_id: ' + e.related_event_id);
            const ml = metaLine(meta);
            if (ml) lines.push('- signals: ' + ml);
            lines.push('');
            lines.push(fence(e.text));
            lines.push('');
        }
        return lines.join('\n');
    }

    function visibleBlock() {
        const msgs = visibleMessages();
        const lines = [];
        lines.push('## Visible DOM messages (backup)');
        lines.push('');
        lines.push('_Deduped snapshot of on-screen messages, in case structured capture missed anything._');
        lines.push('');
        if (!msgs.length) {
            lines.push('_No visible messages found._');
            return lines.join('\n');
        }
        for (const m of msgs) {
            lines.push('### v' + String(m.seq).padStart(3, '0') + ' · ' + m.role);
            lines.push('');
            lines.push(fence(m.text));
            lines.push('');
        }
        return lines.join('\n');
    }

    function buildMarkdown(log, role) {
        const title = role === 'sender'
            ? '# Win1 Sender — Interviewer Transcript / Input / Forwarding'
            : '# Win2 Receiver — Questions / Answers / Manual Prompts';
        return [
            title,
            '',
            metadataBlock(log, role),
            '',
            eventsBlock(log, role),
            '',
            visibleBlock(log, role),
            ''
        ].join('\n');
    }

    // ── Download ───────────────────────────────────────────
    function download(filename, text) {
        try {
            const blob = new Blob([text], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return true;
        } catch (_) {
            return false;
        }
    }

    // ── Tiny toast (separate from the bridge's dot) ────────
    function toast(msg, ok) {
        try {
            let el = document.getElementById('pm-tracker-toast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'pm-tracker-toast';
                el.style.cssText =
                    'position:fixed;bottom:14px;right:14px;z-index:2147483647;' +
                    'padding:6px 12px;border-radius:10px;font:600 12px monospace;' +
                    'pointer-events:none;transition:opacity .3s;';
                document.body.appendChild(el);
            }
            el.textContent = msg;
            el.style.background = ok ? '#00e5a022' : '#ff444422';
            el.style.color = ok ? '#00e5a0' : '#ff4444';
            el.style.border = '1px solid ' + (ok ? '#00e5a055' : '#ff444455');
            el.style.opacity = '1';
            clearTimeout(el._t);
            el._t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
        } catch (_) {}
    }

    function exportThisWindow() {
        const role = getRole();
        if (!role) {
            toast('TRACKER: no vb_role', false);
            return false;
        }
        const log = readSessionLog();
        const sid = sessionId(log);
        const suffix = role === 'sender' ? 'win1_sender' : 'win2_receiver';
        const filename = sid + '_' + suffix + '.md';
        const md = buildMarkdown(log, role);
        const ok = download(filename, md);
        toast(ok ? ('TRACKER ✓ ' + suffix) : 'TRACKER export failed', ok);
        return ok;
    }

    // ── Triggers ───────────────────────────────────────────
    // Hotkey: Ctrl+Shift+F9
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'F9' || e.code === 'F9')) {
            e.preventDefault();
            exportThisWindow();
        }
    }, true);

    // Shared trigger: both windows export when the request key changes.
    let lastRequest = localStorage.getItem(EXPORT_REQUEST_KEY) || '';
    window.addEventListener('storage', (e) => {
        if (e.key !== EXPORT_REQUEST_KEY) return;
        if (e.newValue && e.newValue !== lastRequest) {
            lastRequest = e.newValue;
            // small stagger so the two downloads don't collide
            setTimeout(exportThisWindow, getRole() === 'receiver' ? 250 : 0);
        }
    });

    // Expose a manual hook for debugging (no token, read-only).
    try { window.pmTrackerExport = exportThisWindow; } catch (_) {}
})();
