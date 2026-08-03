# PM Interview Dual-Provider Runtime 0.10.2

Manifest V3 provider and Runtime Pilot Dashboard extension used by `runtime/Final_2_Window_Extension.ahk`.

## Architecture

- AutoHotkey owns provider selection, exact sender/receiver/dashboard windows, initial layout, full-route repair, and PM-only global hotkeys.
- The service worker owns role registration, sender authorization, durable final ordering, transport pause, the lossless delivery ledger and live inbox, dashboard state, acknowledgements, recovery, and session cleanup.
- Content scripts own provisional transcript previews, provider-specific finalization, receiver prefill/submission/proof, answer capture, semantic commands, telemetry, compact status UI, and export.
- `dashboard/` is a trusted extension page connected by a long-lived port. It receives snapshots and sends validated commands; it never writes provider DOM directly.
- Provider adapters own semantic composer discovery, message extraction, submit readiness, generation controls, and microphone controls.
- Provider APIs, cookies, authorization headers, and raw audio are never used by the runtime.

Normal ChatGPT and Claude tabs without PMIA runtime configuration are untouched.

## PMIA 0.10 state, recovery, and operator controls

- Registry and role-scoped transcript logs use `chrome.storage.session`. Transcript and answer events are never written to disk-backed extension local storage.
- Startup removes legacy `pmia_log_*` local-storage records. Explicit end-session and final-tab closure remove the complete session registry, sender outbox, lossless ledger, batch state, receiver sequence state, Pilot state and both role logs.
- A fresh registration probes a conflicting owner. Missing or non-responsive owners are replaced immediately; healthy duplicate roles remain blocked.
- Receiver wake recovery is background-safe: it disables discard and reloads only a discarded tab without activating the tab or focusing Edge.
- Session Studio exposes **Check Live** (`Alt+H`) and **Fast Repair** (`Alt+Shift+R`). Check Live uses the authorized counterpart preflight in both managed windows; Fast Repair reuses the current in-memory route and context.
- Exports use schema 2.1 with safe session metadata and mock-review summaries. Full setup text, Resume, JD, avoid text, and notes are redacted from event text.


## Runtime Pilot Dashboard

Session Studio opens `dashboard/index.html?session=<SESSION>` as the third managed Edge app window after both provider roles are ready. Its defended title is `PMIA_DASHBOARD_<SESSION>`.

- Live shows catch-up state, Current Answer, Next Draft, Pace Guard, latency rail, storage pressure, route, role health, heartbeat, source silence, composer/generation/microphone/scroll state, warnings and delivery metrics.
- Lossless Inbox shows every session final with age, sequence, ledger state, batch ID and text. Previews never enter the ledger.
- Timeline virtualizes the latest 200 operational events.
- Review shows only safe session metadata and runtime outcomes. Resume, JD, avoid text and notes are excluded.
- Controls cover pause, Resume & Catch Up, resume without sending, submit selected, auto-submit, hold after answer, submit now, explicit interrupt for latest, archive, live check, runtime repair, context resend, microphone, scroll, composer focus, export, layouts, hide/restore and end session.
- Dashboard refresh or service-worker suspension recovers from `chrome.storage.session`. Closing only the dashboard does not stop provider transport; `Alt+D` reopens it.

### Lossless ledger semantics

- Pause does not stop sender observation. Preview delivery is suppressed and every authoritative final is persisted in the ledger.
- Resume & Catch Up reconciles every unresolved final in sequence order; it never selects only the newest one.
- A newer delivered final never supersedes or deletes an older unresolved final.
- A final leaves the unresolved inbox only after duplicate identity, provider-rendered batch proof or explicit operator archive.
- While Window 2 generates, new finals accumulate in the next composer draft without interrupting the current answer.
- If more than one final accumulates, all questions remain in the submitted batch and the latest question is marked highest priority.

## Preview and commit lanes

Provisional text and final questions use separate paths.

- Preview updates are disposable, in-memory, and never entered into the lossless ledger.
- Same-task transcript growth is collapsed to the newest value with a microtask, not a timer.
- Each sender page has a unique preview stream ID, so sender reloads can safely restart preview sequence numbers.
- Receiver preview state is bounded and the exact provisional turn is removed after a successful final submission.
- Final envelopes remain durable, sequenced, acknowledged, and lossless when a receiver is unavailable.
- A replayed envelope is acknowledged as `duplicate_ack` without writing or submitting the prompt again. Any unresolved older final remains protected until duplicate identity or rendered proof is established.
## Provider boundaries

### ChatGPT

- ChatGPT remains DOM-first because the supplied voice export did not expose a dependable per-turn transcript protocol.
- Distinct growth of the latest rendered user message is mirrored immediately to the receiver composer.
- The following assistant turn is the preferred final boundary.
- Transient or growing user text is preview-only. Production never timer-finalizes a ChatGPT question; the following assistant turn is the authoritative commit boundary.
- Existing submitted messages are baselined on startup and composer drafts are never auto-forwarded.

### Claude

- A passive main-world observer reads only string frames from the existing `/api/ws/voice/` WebSocket.
- Each distinct `transcript_interim` value is mirrored immediately; repeated frames are coalesced.
- `transcription_start` activates the native-voice gate. `user_input_end` is a boundary hint, not a final.
- `server_interrupt` preserves the current growing utterance. The supplied export shows it repeatedly inside one long transcript.
- `transcript_empty` clears the provisional turn. Provider errors also clear provisional state.
- Only a human `message_complete` commits native-voice text.
- The first near-term DOM shadow of that authoritative final is suppressed even when Claude prepends a compact accessibility echo.
- Assistant `message_stop` wakes answer capture immediately.

Binary microphone and playback frames are ignored.
## Latency and recovery

- Ready receivers submit immediately after the final composer update; there is no fixed 60-millisecond wait.
- A late-mounted composer or send control gets a bounded microtask readiness window; ready providers still submit on the first pass with no fixed delay.
- A receiver acknowledges success only after a new matching provider user turn renders; a synthetic click or Enter event is not treated as delivery.
- Composer and send-control discovery ignores hidden stale nodes left by provider navigation.
- After a confirmed provider turn, PMIA clears the receiver composer only when it still exactly matches the submitted question; a newer manual draft is preserved.
- Final submission completes before durable receiver telemetry begins.
- Provider observation reacts to child/text mutations, ignores attribute churn, and keeps a 500-millisecond rebind watchdog.
- Answer capture is mutation-driven with a 250-millisecond stability window and a 90-second hard timeout.
- `pageshow`, network reconnection, and returning to a visible tab trigger immediate role re-registration and observer rebind.
- The 15-second heartbeat remains a fallback, not the primary recovery path.

## Runtime health and diagnostics

- Each managed tab shows a stable link state: `LINK OK`, a missing sender/receiver, `FINAL PERSISTED`, or an explicit runtime/composer fault.
- Transient states such as `PERSISTED`, `STAGED`, and `SENT` return to the latest stable link state instead of assuming `READY`.
- `Ctrl+Shift+F11` actively pings the opposite content runtime through the authorized service worker. A registered but non-responsive tab reports `RUNTIME UNREACHABLE`.
- Closing either managed tab immediately updates the remaining tab instead of waiting for the registration heartbeat.
- Dynamic-import and startup exceptions render an assertive on-page fatal banner with the runtime version and recovery action. Error details are reduced to the error class so transcript or credential text is not exposed.
- An invalidated extension context remains visibly `RELOAD TAB`; it does not revert to an earlier healthy status.

## Session Studio

`runtime/Final_2_Window_Extension.ahk` opens a 960-by-900 operational Session Studio before launching the two provider tabs and the dashboard.

- Microsoft Edge Stable is the only supported browser executable.
- The profile doctor reads Edge profile metadata and unpacked-extension registration without reading cookies, account data, or provider conversation content.
- A saved valid profile is preferred; otherwise the launcher recommends the profile with the matching PMIA extension, then falls back to `Default`.
- **Run Preflight** validates the selected profile, extension path, and extension version before launch.
- The route, selected profile directory, and initial layout are persisted. Resume, Job Description, session notes, session IDs, prompts, and answers are never persisted by the Studio.
- Resume, Job Description, and optional session notes remain only in the current AutoHotkey process memory.
- Session Studio also exposes **Target company**, **Target role**, **Interview round**, **Emphasis**, **Avoid mentioning**, and **Answer mode** as structured memory-only controls; freeform notes remain available.
- Structured metadata is assembled into the boot prompt but is not persisted to `settings.ini`.
- Short context uses an inline two-step action: the first click arms **Launch Anyway** for ten seconds; the second click proceeds. No modal confirmation is used.
- Launch progress is explicit: `PREFLIGHT`, `LAUNCHING`, `WAITING_BOOT`, `WAITING_REGISTRATION`, `WAITING_COMPOSER`, `WAITING_DASHBOARD`, `READY`, or `ERROR`.
- **Fast Repair** opens the selected profile's PMIA extension page for registration/path/version failures, or retries the same session route after a partial lifecycle failure.
- Diagnostics are written under `%LOCALAPPDATA%\PMInterviewAssistant\logs`, never into the repository.

### Lifecycle readiness

Managed tabs expose title phases that the launcher treats as a deterministic handshake:

- `PMIA_BOOT_<ROLE>_<PROVIDER>_<SESSION>`: the content runtime started.
- `PMIA_REGISTERED_<ROLE>_<PROVIDER>_<SESSION>`: the tab registered with the background service.
- `PMIA_<ROLE>_<PROVIDER>_<SESSION>`: the provider composer is available and the tab is ready.

The dashboard adds `PMIA_DASHBOARD_<SESSION>`. Boot context is sent only after sender, receiver, and dashboard reach their lifecycle boundary. Polling is condition-driven at 100 milliseconds; the launcher no longer treats a browser window merely opening as runtime readiness.

### Persistence boundary

The extension registry and role logs use browser-session-only `chrome.storage.session`. Ending the session or closing its final managed tab clears the complete session state. Explicit export is the only path that writes transcript or answer material to files.

`%LOCALAPPDATA%\PMInterviewAssistant\settings.ini` contains only:

- `ProfileDirectory`
- `SenderProvider`
- `ReceiverProvider`
- `LayoutMode`

No Resume, Job Description, notes, prompt, answer, session identifier, cookie, token, or provider account data is written there.
## Keyboard bridge

- `Ctrl+Shift+F5`: route boot/context and submit it through provider readiness.
- `Ctrl+Shift+F6`: toggle the sender microphone control.
- `Ctrl+Shift+F7`: direct receiver boot/context delivery.
- `Ctrl+Shift+F8`: export the current role's JSON and Markdown log.
- `Ctrl+Shift+F9`: focus the receiver composer.
- `Ctrl+Shift+F10`: toggle receiver auto-scroll.
- `Ctrl+Shift+F11`: actively ping the opposite managed runtime and report `LINK OK`, a missing role, `FINAL PERSISTED`, `RUNTIME UNREACHABLE`, or `COMPOSER NOT READY`.
- `Ctrl+Alt+0`: pause or resume the session-level transport through the same dashboard command path.

## Session tracker companion

`runtime/Session_Tracker_End_Session.ahk` is the optional post-session Review Studio. It detects one exact READY sender/receiver pair, requests export/end through the launcher's registered Windows-message control channel, validates one fresh role-scoped Markdown pair with `resolve-pmia-session-exports.ps1`, pushes through a structured JSON result contract, and opens the configured Review Lab only after success. Missing, ambiguous, stale, malformed, duplicate, and mismatched sessions fail precisely.

The push script supports `-DryRun` and a separate output path. Dry run validates inputs and creates the session package without checkout, commit, branch, merge, push, or remote deletion.

## Load in Edge

1. Open `edge://extensions` in the same Edge Stable profile selected in Session Studio.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `runtime/extension` directory.
5. Return to Session Studio and choose **Run Preflight**. The profile health line must report the expected path and version before launch.
6. Launch managed windows with `runtime/Final_2_Window_Extension.ahk`.

After updating an unpacked build, use the extension card's **Reload** action and reload any already-open managed tabs. A `RUNTIME LOAD FAILED`, `RUNTIME START FAILED`, `RELOAD TAB`, path mismatch, or version mismatch means the current page must not be trusted as operational until preflight is green.

The launcher closes only PMIA lifecycle windows. It does not close unrelated Edge windows or edit Edge preference files.
## Verification

From the repository root:

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Manual release checks should cover applicable provider combinations, dashboard connect/reconnect, one-at-a-time delivery, accumulation during generation, latest-focused multi-question submission, duplicate suppression, pause/catch-up, selected submission, hold, submit-now, explicit interrupt, context resend, repair, layouts, export, full three-window shutdown, receiver reload and a long-session soak.

The older fixed launcher, Tampermonkey transport, historical archives, and rollback assets are intentionally retained and are not modified by the 0.10.2 runtime.


## New live safety surfaces

The Runtime Pilot now includes grouped diagnostics, Operation Guard, Gap Watch, Sender Outbox Retry, Batch Proof Inspector, Memory Guard, Interview Readiness, Runtime Efficiency, and Recovery Progress.

Before an interview, the Readiness Gate must show **Ready**. A merely open tab is not sufficient. During operation:

- Gap Watch means later finals are protected while a missing sequence is recovered.
- Sender Outbox means Window 1 still owns one or more finals pending durable acknowledgement.
- Memory Guard never compacts unresolved final text; Compact Proven affects transient/proven history only.
- Recovery remains Repairing until all six semantic checks pass.
- `G` copies a Safe Health Report. `D` retains the lower-level safe diagnostics export.
