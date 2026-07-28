# Evidence-Driven Dual-Provider Runtime Hardening Plan

## Evidence boundary

Use only preserved ChatGPT/Claude capture JSON, saved DOM/UIAutomation snapshots, PMIA session logs, screenshots, and the local repository. Do not use or automate the live browser for this pass.

## Confirmed behavior

- ChatGPT text submission uses conversation preparation, a conversation POST with event-stream output, user WebSocket activity, and a durable stream-complete signal.
- Claude text submission uses conversation-scoped completion POSTs; the userscript could not clone the streamed response, so durable output is recovered from subsequent conversation reads and visible DOM.
- Claude evidence contains `voice_session_started` and `voice_session_ended` events with connection, playback, duration, mute, interruption, reconnect, underrun, and turn counters.
- ChatGPT UI evidence exposes `Start dictation`, `Start Voice`, `Turn off microphone`, and `End Voice` controls.
- The failed PMIA session log contains repeated registration events but no sender-text event, proving routing registration worked while transcript extraction failed.
- Manifest V3 service-worker suspension invalidated an in-memory registry; persisted session state is required.
## Audit findings to fix

1. Delivery is considered successful when `tabs.sendMessage` resolves, even if the receiver responds `{ ok: false }`.
2. Any managed tab can forward for a session; stale or duplicate sender tabs are not rejected.
3. Repeated registration heartbeats create noisy logs and duplicate-role tabs can replace each other indefinitely.
4. A prior submitted user message masks a newly populated composer, which breaks dictation/manual text forwarding.
5. The single stability window treats final conversation turns and still-changing composer text identically.
6. ChatGPT voice selectors do not include the captured `Start Voice` and `Turn on/off microphone` labels.
7. Claude assistant extraction starts with an unscoped `[data-is-streaming="false"]` selector, risking unrelated page text.
8. Receiver supersession waits a fixed 180 ms instead of verifying that generation actually stopped.
9. Edge app launches can reuse stale app windows; the launcher does not close unknown prior PMIA windows or force a new app window.
10. Extension reload errors are reported generically rather than telling the operator to reload the managed tab.

## Implementation slices

1. Add registry ownership, queue-latest, stale pruning, and heartbeat-change semantics with unit tests.
2. Make background delivery inspect receiver acknowledgement and requeue rejected envelopes.
3. Add source-aware sender candidates and source-specific stabilization thresholds.
4. Align voice controls and Claude message selectors with captured evidence.
5. Poll for receiver idle after stop before injecting the replacement prompt.
6. Harden AHK launch cleanup and add `--new-window`.
7. Run Node tests, extension validation, AHK validation, and review the diff for unrelated changes.
8. Produce a sanitized HTML architecture/audit report and evidence manifest.

## Non-goals

- No private ChatGPT or Claude API calls.
- No browser profile replacement or automated live-browser testing in this pass.
- No deletion of the legacy Tampermonkey/AHK fallback.
- No prompt-content redesign.
