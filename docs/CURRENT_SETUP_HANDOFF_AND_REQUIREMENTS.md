# Current Setup Handoff and Requirements Ledger

Last updated: 2026-07-30

## Objective

Operate a low-latency, exactly-once Product Management interview assistant with one managed sender provider, one managed receiver provider, structured session context, and optional post-session review tracking.

## Active architecture

- **Browser:** Microsoft Edge Stable, one selected profile verified by Profile Doctor.
- **Launcher:** `runtime/Final_2_Window_Extension.ahk`.
- **Provider runtime:** `runtime/extension/`, Manifest V3.
- **Transport:** disposable preview lane plus durable sequenced final lane through the extension service worker.
- **Providers:** ChatGPT and Claude independently selectable as sender or receiver.
- **Session setup:** Resume, Job Description, Target company, Target role, Interview round, Emphasis, Avoid mentioning, Answer mode, and Additional notes.
- **Tracker companion:** `runtime/Session_Tracker_End_Session.ahk` plus `runtime/scripts/push-session-to-tracker.ps1`.

Edge Beta, Tampermonkey, `Final_2_Window_Fixed.ahk`, archived scripts, and the old localStorage bridge are preserved rollback/reference assets. They are not active requirements.

## Data and privacy boundaries

- Resume, JD, structured metadata, notes, prompts, answers, and session IDs remain in the running process/runtime only.
- Session Studio persists only profile directory, sender provider, receiver provider, and layout mode.
- The extension does not read cookies, authorization headers, provider APIs, or raw audio.
- Release testing uses synthetic content.
- Tracker pushes are explicit and target the separate private tracker repository.

## Runtime lifecycle

1. Session Studio validates Edge Stable profile, unpacked extension path, and version.
2. Managed tabs progress through `PMIA_BOOT_*`, `PMIA_REGISTERED_*`, and final `PMIA_*` READY titles.
3. Boot context is sent only after both roles are ready.
4. Sender previews are disposable and latest-only.
5. Provider-specific final boundaries create one sequenced envelope.
6. Receiver submission is acknowledged only after a matching provider user turn renders.
7. Replays are duplicate-acknowledged; stale sequences are discarded; only the latest unavailable final is retained.
8. Page lifecycle, reconnect, wake, and heartbeat paths restore runtime registration.

## Operational controls

- `Alt+R`: Session Studio / launch or relaunch.
- `Alt+Esc`: resend current in-memory context.
- `Alt+Delete`: end the exact managed session and exit launcher.
- `Alt+Tab`: hide or restore managed windows.
- `Alt+CapsLock`: sender/receiver/two-window visibility mode.
- `CapsLock`: layout preset.
- `Alt+Q`: sender microphone.
- `Alt+W`: receiver scroll lock.
- `Alt+E`: export both role records.
- `Alt+Shift+E`: open the optional tracker companion.

## Repositories

- System: `thomas-shelby006/product-pm-interview-assistant-instructions`
- Private evidence tracker: `thomas-shelby006/pm-interview-session-tracker`
- Local tracker: `C:\Users\Sundar\Documents\pm-interview-session-tracker`

The tracker repository stores session evidence and review output. It must not automatically modify the system repository from one session.

## Verification commands

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Also validate `Session_Tracker_End_Session.ahk --validate` and run the tracker push script with synthetic files and `-DryRun` before a live tracker push.

## Current release work

PMIA 0.6.1 completes structured Session Studio controls and migrates the tracker helper to the current Edge Stable/Manifest V3 lifecycle and export contract. Release only after exact feature-tree and merged-main gates pass, the canonical unpacked extension is reloaded, and GitHub issue #7 is closed as obsolete/completed.
