# PM Interview Dual-Provider Runtime

Manifest V3 extension used by `runtime/Final_2_Window_Extension.ahk`.

## Architecture

- AutoHotkey owns provider selection, session launch, exact window handles, layout, hide/restore, screenshots, and global hotkeys.
- The service worker owns durable role registration, sender authorization, final-envelope sequence idempotency, latest-message queueing, delivery acknowledgement, and role-scoped logs.
- The service worker also exposes a direct ephemeral preview lane that bypasses durable serialization, persistence, final queues, and logs.
- Provider adapters own semantic composer/message discovery, submit, generation detection, stop, and microphone controls.
- Content scripts own provisional transcript previews, authoritative finalization, receiver prefill/submit, mutation-driven answer capture, status UI, and export.
- Provider APIs, cookies, authorization headers, and raw audio are never used by the runtime.

## Provider combinations

- ChatGPT sender → ChatGPT receiver
- ChatGPT sender → Claude receiver
- Claude sender → ChatGPT receiver
- Claude sender → Claude receiver

Normal ChatGPT or Claude tabs without PMIA runtime parameters are untouched.

## Preview and commit behavior

- ChatGPT remains DOM-first because the supplied evidence did not expose a stable per-turn RTC data-channel schema.
- Each distinct rendered ChatGPT user-text growth is mirrored to the receiver composer immediately as a provisional preview.
- A following ChatGPT assistant turn is the authoritative final boundary; a 1.2-second stable-tail fallback is allowed only outside active voice mode.
- Claude has a passive main-world observer for the existing `/api/ws/voice/` socket.
- Each distinct Claude `transcript_interim` value is mirrored to the receiver composer; repeated interim frames are coalesced.
- Binary microphone and PCM frames are ignored. `user_input_end`, `server_interrupt`, and `transcript_empty` never submit a question.
- A human Claude `message_complete` is the only native-voice commit signal. Interruption or empty-transcript events clear stale provisional text.
- Receiver previews only prefill text. They never stop generation or press Send. The authoritative final replaces the preview and submits exactly once.
- Assistant `message_stop` wakes answer capture immediately but does not replace semantic DOM extraction.

## Reliability rules

- One live sender and receiver own each session.
- A duplicate live role is rejected; stale takeover is allowed after the registration timeout.
- Every final sender envelope carries a monotonic sequence. Duplicate or stale final sequences are rejected by both service worker and receiver.
- Preview updates use a separate monotonic sequence and per-turn revision. Stale previews are ignored and previews are never queued or persisted.
- Only explicit receiver acknowledgement counts as final delivery. A rejected or transport-failed final leaves only the latest envelope queued.
- Provider observation watches child/text changes only, coalesces mutation bursts, and uses a 500-millisecond rerender watchdog.
- Answer capture is mutation-driven, uses a 250-millisecond stability window, and retains a 90-second hard timeout.

## Load in Edge

1. Open `edge://extensions` in the existing Edge Default profile.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `runtime/extension` directory.
5. Keep the extension enabled and use `runtime/Final_2_Window_Extension.ahk` to launch managed windows.

The launcher creates session-suffixed titles and closes only older windows whose title matches a PMIA sender/receiver pattern. It never closes unrelated Edge windows.

## Keyboard bridge

- `Ctrl+Shift+F5`: sender boot/context route and local provider submission.
- `Ctrl+Shift+F6`: toggle sender microphone control.
- `Ctrl+Shift+F7`: direct receiver boot/context delivery.
- `Ctrl+Shift+F8`: export the current managed window's JSON and Markdown log.
- `Ctrl+Shift+F9`: focus receiver composer.
- `Ctrl+Shift+F10`: toggle receiver auto-scroll.
- `Ctrl+Shift+F12`: force-forward current sender candidate.
- `Ctrl+Alt+0`: pause/resume the managed tab.

## Verification

From repository root:

```powershell
npm test
npm run validate
powershell -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Manual browser validation remains a separate release gate:

- Run all four provider combinations in text mode.
- Run native voice with ChatGPT and Claude as sender.
- Verify long-question finalization, interruption/latest-wins behavior, receiver reload recovery, and a 45-minute soak.
- Disable the legacy Tampermonkey transport before testing the extension to avoid duplicate routing.

The legacy Tampermonkey and AHK runtime remain an archived fallback until manual parity is confirmed.