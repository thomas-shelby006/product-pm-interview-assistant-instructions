# PMIA Runtime Pilot Dashboard Design

## Objective

Turn the current PM mock-interview runtime into a three-window operational system: a sender, a receiver, and a Runtime Pilot Dashboard. The dashboard must expose live transport state, health, queueing, recovery and the useful legacy controls without restoring the legacy localStorage/Tampermonkey architecture.

## Source basis

The design is based on the current Manifest V3 runtime, the older `product-pm-interview-assistant-instructions-clean-repo-v2.zip`, and the PMIA v0.6 technical implementation atlas. The current extension remains authoritative for identity, ordering, retries, role ownership and provider-rendered delivery proof.

## Architecture

- AutoHotkey Session Studio launches and recovers the three managed Edge app windows.
- The extension service worker owns session control, transport mode, operator queue, health, event timeline and dashboard commands.
- Sender and receiver content runtimes publish structured telemetry and receive semantic commands.
- A trusted extension dashboard page connects through a long-lived runtime port and receives complete snapshots plus incremental updates.
- `chrome.storage.session` retains active state across service-worker suspension but nothing survives browser shutdown unless explicitly exported.

## Transport and queue rules

- Preview objects are disposable and are never placed in the operator queue.
- Only validated final envelopes can enter the queue.
- Pausing transport stops preview delivery and final delivery without stopping source observation.
- The queue is bounded at 20 finals and preserves envelope identity and sequence.
- Resume Latest sends the newest queued final and retains older entries for inspection.
- Resume Without Sending changes mode only.
- Send Selected sends one queued final through the normal receiver sequence and rendered-turn proof path.
- Discard actions remove queue entries without modifying provider conversations.
- Duplicate or stale queue commands are idempotent.

## Dashboard

The dashboard shows session identity, uptime, route, transport mode, role health, heartbeat age, lifecycle phase, composer/generation/microphone/scroll state, latest preview, latest final, queue, delivery attempts, acknowledgements, answer capture, warnings and a bounded event timeline.

Controls include pause, resume latest, resume without sending, send selected, discard selected/all, check live, runtime repair, resend boot context, toggle sender microphone, toggle receiver scroll lock, export, end session and browser-window layouts. A Review view summarizes current session evidence without exposing Resume, JD, Avoid mentioning or notes.

## Legacy feature classification

Port and improve: pause/resume, bounded buffering, selected/manual flush, silence detection, status indicators, scroll lock, microphone toggle, boot resend, export, code-overflow safety and live telemetry.

Do not port: screenshot injection, code-focus overlay, DOM-removing virtual-scroll, localStorage transport, prompt route heuristics and intentional no-op shortcuts.

## Recovery

- Dashboard refresh reconnects and receives a full session snapshot.
- Service-worker restart reloads registry, pilot state and queue from `chrome.storage.session`.
- Runtime Repair pings existing tabs, requests re-registration, reloads unresponsive owned tabs and can reopen a missing role from its last known provider URL.
- AutoHotkey Fast Repair remains the full route relaunch fallback with the original in-memory context.
- Closing the dashboard never stops sender/receiver transport.

## Privacy

Full question text may exist only in provider state, active content-runtime memory, final envelopes, operator queue in `chrome.storage.session`, and explicit exports. No Resume, JD, notes, Avoid mentioning text, prompt body, answer or session ID is written to disk-backed extension storage.

## Acceptance criteria

- Three managed windows launch for a new session and the dashboard reaches READY.
- The dashboard updates without manual refresh and reconnects after reload.
- Pause, queue, resume, selected send and discard semantics preserve final identity and rendered-turn proof.
- Health markers distinguish missing, stale, unresponsive, composer-missing, generating and healthy roles.
- Useful legacy runtime features are present through semantic extension commands or dashboard controls.
- Rejected legacy features are documented and absent from the active runtime.
- Existing 0.7 reliability/privacy work remains intact.
- One final consolidated verification gate passes after all implementation is complete.
