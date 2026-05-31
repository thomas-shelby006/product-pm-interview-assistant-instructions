// ==UserScript==
// @name         ChatGPT PM Session Tracker Export
// @version      0.1.0
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @updateURL    http://127.0.0.1:8123/tm_scripts/session-tracker-export.user.js
// @downloadURL  http://127.0.0.1:8123/tm_scripts/session-tracker-export.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const SESSION_LOG_KEY = 'pm_session_log';
    const EXPORT_REQUEST_KEY = 'pm_session_tracker_export_request';
    const SCRIPT_VERSION = '0.1.0';
    let lastRequestId = '';

    function getRole() {
        const stored = sessionStorage.getItem('vb_role');
        if (stored) return stored;
        const title = document.title || '';
        if (/VB_SENDER/i.test(title)) return 'sender';
        if (/VB_RECEIVER/i.test(title)) return 'receiver';
        return 'unknown';
    }

    function getWindowName() {
        const role = getRole();
        if (role === 'sender') return 'win1_sender';
        if (role === 'receiver') return 'win2_receiver';
        return 'unknown_window';
    }

    function pad(n, width = 2) {
        return String(n).padStart(width, '0');
    }

    function localStamp(date = new Date()) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    }

    function readLog() {
        try {
            const raw = localStorage.getItem(SESSION_LOG_KEY);
            if (!raw) return { session: {}, runtime_metadata: {}, events: [], qa_pairs: [], summary: {} };
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.events)) return { session: {}, runtime_metadata: {}, events: [], qa_pairs: [], summary: {} };
            parsed.session ||= {};
            parsed.runtime_metadata ||= {};
            parsed.events ||= [];
            parsed.qa_pairs ||= [];
            parsed.summary ||= {};
            return parsed;
        } catch (err) {
            return {
                session: {},
                runtime_metadata: {},
                events: [{
                    event_id: 'tracker_export_parse_error',
                    ts: new Date().toISOString(),
                    source: getWindowName(),
                    type: 'export_error',
                    text: String(err && err.message ? err.message : err),
                    metadata: {}
                }],
                qa_pairs: [],
                summary: {}
            };
        }
    }

    function norm(text) {
        return (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    }

    function indentBlock(text) {
        const value = (text || '').replace(/\r\n/g, '\n');
        if (!value.trim()) return ['  '];
        return value.split('\n').map(line => `  ${line}`);
    }

    function isWin1Event(event) {
        const source = String(event.source || '').toLowerCase();
        const type = String(event.type || '').toLowerCase();
        if (source === 'win1' || source === 'sender') return true;
        return /raw_transcript|forwarded_question|blocked|ignored|filler|partial|duplicate|stale/.test(type);
    }

    function isWin2Event(event) {
        const source = String(event.source || '').toLowerCase();
        const type = String(event.type || '').toLowerCase();
        if (source === 'win2' || source === 'receiver') return true;
        return /received_question|answer|regeneration|manual|error/.test(type);
    }

    function includeEventForCurrentWindow(event) {
        const windowName = getWindowName();
        if (windowName === 'win1_sender') return isWin1Event(event);
        if (windowName === 'win2_receiver') return isWin2Event(event);
        return true;
    }

    function statusFor(event) {
        const type = String(event.type || '').toLowerCase();
        const meta = event.metadata || {};
        if (meta.block_reason || /blocked|ignored|filler|partial|duplicate|stale/.test(type)) return 'blocked_or_ignored';
        if (type === 'forwarded_question') return 'forwarded';
        if (type === 'received_question') return 'received';
        if (type === 'answer' || type === 'regeneration') return 'answered';
        if (type === 'error' || type === 'export_error') return 'error';
        return 'recorded';
    }

    function blockReasonFor(event) {
        const type = String(event.type || '').toLowerCase();
        const meta = event.metadata || {};
        if (meta.block_reason) return meta.block_reason;
        if (type.includes('filler')) return 'filler_only';
        if (type.includes('partial')) return 'partial_transcript';
        if (type.includes('duplicate')) return 'duplicate_transcript';
        if (type.includes('stale')) return 'stale_question_dropped';
        if (type.includes('blocked') || type.includes('ignored')) return type;
        return '';
    }

    function safeMetadataValue(value) {
        if (value === undefined || value === null || value === '') return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        try { return JSON.stringify(value); } catch (_) { return String(value); }
    }

    function visibleMessages() {
        const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
        const seen = new Set();
        const out = [];
        for (const node of nodes) {
            const author = node.getAttribute('data-message-author-role') || 'unknown';
            const text = norm(node.textContent || '');
            if (!text) continue;
            const key = `${author}:${text}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ author, text });
        }
        return out;
    }

    function addHeader(lines, log) {
        const session = log.session || {};
        const windowName = getWindowName();
        const role = getRole();
        lines.push(`# ${windowName === 'win1_sender' ? 'WIN1 SENDER LOG' : windowName === 'win2_receiver' ? 'WIN2 RECEIVER LOG' : 'UNKNOWN WINDOW LOG'}`);
        lines.push('');
        lines.push('SESSION_META');
        lines.push(`session_id: ${session.session_id || ''}`);
        lines.push(`session_type: ${session.session_type || session.mode || ''}`);
        lines.push(`date_exported: ${new Date().toISOString()}`);
        lines.push(`started_at: ${session.started_at || ''}`);
        lines.push(`ended_at: ${session.ended_at || ''}`);
        lines.push(`company: ${session.company || ''}`);
        lines.push(`target_role: ${session.target_role || ''}`);
        lines.push(`round: ${session.interview_round || ''}`);
        lines.push(`mode: ${session.mode || ''}`);
        lines.push(`project_used: ${session.project_used || ''}`);
        lines.push(`bridge_version: ${session.bridge_version || (log.runtime_metadata && log.runtime_metadata.bridge_script) || 'bridge.user.js'}`);
        lines.push(`tracker_exporter_version: ${SCRIPT_VERSION}`);
        lines.push('');
        lines.push('WINDOW_ROLE');
        lines.push(`window: ${windowName}`);
        lines.push(`role: ${role}`);
        lines.push(`source_of_truth: ${windowName === 'win1_sender' ? 'interviewer_transcript_forwarding_and_win1_visible_output' : 'receiver_questions_answers_and_manual_win2_prompts'}`);
        lines.push('');
    }

    function addEvent(lines, event, index) {
        const meta = event.metadata || {};
        lines.push('---');
        lines.push(`event_seq: ${pad(index + 1, 4)}`);
        lines.push(`event_id: ${event.event_id || ''}`);
        lines.push(`time: ${event.ts || ''}`);
        lines.push(`window: ${getWindowName()}`);
        lines.push(`source: ${event.source || ''}`);
        lines.push(`type: ${event.type || ''}`);
        lines.push(`status: ${statusFor(event)}`);
        const blockReason = blockReasonFor(event);
        if (blockReason) lines.push(`block_reason: ${blockReason}`);
        if (event.related_event_id) lines.push(`related_event_id: ${event.related_event_id}`);
        for (const key of ['question_id', 'answer_id', 'word_count', 'length_flag', 'route_guess', 'company_anchor_guess', 'control_output']) {
            const value = safeMetadataValue(meta[key]);
            if (value) lines.push(`${key}: ${value}`);
        }
        lines.push('text: |');
        lines.push(...indentBlock(event.text || ''));
        lines.push('---');
        lines.push('');
    }

    function buildMarkdown() {
        const log = readLog();
        const lines = [];
        addHeader(lines, log);
        lines.push('EVENTS');
        lines.push('');
        const events = (log.events || []).filter(includeEventForCurrentWindow);
        if (!events.length) {
            lines.push('<!-- No matching bridge events found for this window. See visible messages below. -->');
            lines.push('');
        }
        events.forEach((event, index) => addEvent(lines, event, index));

        lines.push('VISIBLE_CHAT_MESSAGES');
        lines.push('');
        const messages = visibleMessages();
        if (!messages.length) {
            lines.push('<!-- No visible ChatGPT messages captured. -->');
            lines.push('');
        }
        messages.forEach((msg, index) => {
            lines.push('---');
            lines.push(`visible_seq: ${pad(index + 1, 4)}`);
            lines.push(`window: ${getWindowName()}`);
            lines.push(`author: ${msg.author}`);
            lines.push('text: |');
            lines.push(...indentBlock(msg.text));
            lines.push('---');
            lines.push('');
        });

        lines.push('REVIEW_HINTS_FOR_CHATGPT');
        lines.push('- Treat this file as raw evidence for this one window only.');
        lines.push('- Compare it with the paired other-window file before scoring the session.');
        if (getWindowName() === 'win1_sender') {
            lines.push('- Evaluate transcript capture, blocked/ignored events, and forwarding quality.');
        } else if (getWindowName() === 'win2_receiver') {
            lines.push('- Evaluate received questions, answers, answer length, story choice, and truth safety.');
        }
        lines.push('');
        return lines.join('\n');
    }

    function download(filename, text) {
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportCurrentWindow(trigger) {
        const log = readLog();
        const sessionId = (log.session && log.session.session_id ? log.session.session_id : `pm_session_${localStamp()}`).replace(/[^a-zA-Z0-9_.-]+/g, '_');
        const filename = `${sessionId}_${getWindowName()}.md`;
        download(filename, buildMarkdown());
        try { console.info('[Session Tracker Export]', filename, trigger); } catch (_) {}
    }

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.code === 'F9') {
            event.preventDefault();
            exportCurrentWindow('hotkey');
        }
    }, true);

    function checkStorageRequest() {
        try {
            const value = localStorage.getItem(EXPORT_REQUEST_KEY) || '';
            if (value && value !== lastRequestId) {
                lastRequestId = value;
                exportCurrentWindow('storage_request');
            }
        } catch (_) {}
    }

    window.addEventListener('storage', (event) => {
        if (event.key === EXPORT_REQUEST_KEY && event.newValue && event.newValue !== lastRequestId) {
            lastRequestId = event.newValue;
            exportCurrentWindow('storage_event');
        }
    });

    setInterval(checkStorageRequest, 1000);
})();
