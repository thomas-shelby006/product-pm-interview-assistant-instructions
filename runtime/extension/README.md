# PM Interview Dual-Provider Runtime 0.5.2

Manifest V3 extension used by `runtime/Final_2_Window_Extension.ahk`.

## Architecture

- AutoHotkey owns provider selection, exact managed windows, layout, screenshots, and global hotkeys.
- The service worker owns role registration, sender authorization, durable final ordering, latest-only recovery, acknowledgements, and role-scoped logs.
- Content scripts own provisional transcript previews, provider-specific finalization, receiver prefill/submission, answer capture, recovery events, status UI, and export.
- Provider adapters own semantic composer discovery, message extraction, submit readiness, generation controls, and microphone controls.
- Provider APIs, cookies, authorization headers, and raw audio are never used by the runtime.

Normal ChatGPT and Claude tabs without PMIA runtime configuration are untouched.

## Preview and commit lanes

Provisional text and final questions use separate paths.

- Preview updates are disposable, in-memory, latest-only, and never queued or persisted.
- Same-task transcript growth is collapsed to the newest value with a microtask, not a timer.
- Each sender page has a unique preview stream ID, so sender reloads can safely restart preview sequence numbers.
- Receiver preview state is bounded and the exact provisional turn is removed after a successful final submission.
- Final envelopes remain durable, sequenced, acknowledged, and latest-only when a receiver is unavailable.
- A replayed envelope is acknowledged as `duplicate_ack` without writing or submitting the prompt again; stale envelopes are acknowledged and discarded.
## Provider boundaries

### ChatGPT

- ChatGPT remains DOM-first because the supplied voice export did not expose a dependable per-turn transcript protocol.
- Distinct growth of the latest rendered user message is mirrored immediately to the receiver composer.
- The following assistant turn is the preferred final boundary.
- A 650-millisecond stable-tail fallback is allowed only when voice is inactive and the sender composer is empty.
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
- Final submission completes before durable receiver telemetry begins.
- Provider observation reacts to child/text mutations, ignores attribute churn, and keeps a 500-millisecond rebind watchdog.
- Answer capture is mutation-driven with a 250-millisecond stability window and a 90-second hard timeout.
- `pageshow`, network reconnection, and returning to a visible tab trigger immediate role re-registration and observer rebind.
- The 15-second heartbeat remains a fallback, not the primary recovery path.

## Runtime health and diagnostics

- Each managed tab shows a stable link state: `LINK OK`, a missing sender/receiver, `FINAL QUEUED`, or an explicit runtime/composer fault.
- Transient states such as `FORWARDED`, `QUEUED`, and `SENT` return to the latest stable link state instead of assuming `READY`.
- `Ctrl+Shift+F11` actively pings the opposite content runtime through the authorized service worker. A registered but non-responsive tab reports `RUNTIME UNREACHABLE`.
- Closing either managed tab immediately updates the remaining tab instead of waiting for the registration heartbeat.
- Dynamic-import and startup exceptions render an assertive on-page fatal banner with the runtime version and recovery action. Error details are reduced to the error class so transcript or credential text is not exposed.
- An invalidated extension context remains visibly `RELOAD TAB`; it does not revert to an earlier healthy status.

## Session Studio

`runtime/Final_2_Window_Extension.ahk` opens a branded Session Studio before launching managed tabs.

- Choose any of the four ChatGPT/Claude sender and receiver routes.
- Swap the route in one action.
- Add Resume, Job Description, and optional session notes in memory only.
- Context counters show readiness before launch.
- The short-context confirmation is owned by the Studio, so it remains in front instead of opening behind the launcher.
- Diagnostics are written under `%LOCALAPPDATA%\PMInterviewAssistant\logs`, never into the repository.

## Keyboard bridge

- `Ctrl+Shift+F5`: route boot/context and submit it through provider readiness.
- `Ctrl+Shift+F6`: toggle the sender microphone control.
- `Ctrl+Shift+F7`: direct receiver boot/context delivery.
- `Ctrl+Shift+F8`: export the current role's JSON and Markdown log.
- `Ctrl+Shift+F9`: focus the receiver composer.
- `Ctrl+Shift+F10`: toggle receiver auto-scroll.
- `Ctrl+Shift+F11`: actively ping the opposite managed runtime and report `LINK OK`, a missing role, `FINAL QUEUED`, `RUNTIME UNREACHABLE`, or `COMPOSER NOT READY`.
- `Ctrl+Shift+F12`: force-forward the current sender candidate.
- `Ctrl+Alt+0`: pause or resume the managed tab.

## Load in Edge

1. Open `edge://extensions` in the Edge Default profile.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `runtime/extension` directory.
5. Keep the extension enabled and launch managed windows with `runtime/Final_2_Window_Extension.ahk`.

After updating an unpacked build, use the extension card's **Reload** action and reload any already-open managed tabs. A `RUNTIME LOAD FAILED`, `RUNTIME START FAILED`, or `RELOAD TAB` banner means the current page must not be trusted as operational until this recovery is completed.

The launcher closes only exact PMIA-titled windows. It does not close unrelated Edge windows.

## Verification

From the repository root:

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Manual release checks should cover all four sender/receiver provider combinations, both native-voice senders, long-question growth, interruption, receiver reload, missing receiver recovery, preflight status, and a long-session soak.

The older fixed launcher, Tampermonkey transport, historical archives, and rollback assets are intentionally retained and are not modified by the 0.5 runtime.
