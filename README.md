# Product PM Interview Assistant

This repository contains Sundar's live Product Management mock-interview system: a structured Session Studio, a Manifest V3 dual-provider runtime, and an optional post-session review loop.

**Current release: PMIA runtime 0.7.0.**

## Active architecture

- `runtime/Final_2_Window_Extension.ahk` owns Session Studio, provider selection, exact managed Edge windows, layouts, and PM-only hotkeys.
- `runtime/extension/` is the authoritative provider runtime for ChatGPT and Claude in Microsoft Edge Stable.
- The extension service worker owns role registration, durable final ordering, latest-only recovery, ephemeral role logs, and deterministic session cleanup.
- Content scripts own transcript previews, provider-specific final commits, receiver submission, answer capture, status overlays, health checks, and export.
- `runtime/Session_Tracker_End_Session.ahk` optionally exports the exact session pair and sends it to the private review tracker.

The older Edge Beta, Tampermonkey, fixed-launcher, and archived assets are retained only for rollback and history. Do not enable them beside the active runtime.

## PMIA 0.7 improvements

- Transcript and answer logs use `chrome.storage.session`; they are no longer written to disk-backed extension local storage.
- Startup removes legacy `pmia_log_*` local-storage records without exposing their contents.
- Ending a session or closing its final managed tab clears registrations, pending work, sequence state, and both role logs.
- A new managed tab can immediately replace a closed or unreachable stale owner instead of waiting for the 45-second heartbeat window.
- Receiver recovery no longer activates a tab or focuses an Edge window.
- **Check Live** / `Alt+H` runs the real sender-receiver preflight in both managed windows.
- **Fast Repair** / `Alt+Shift+R` relaunches the current route using the existing in-memory context.
- Exports use schema 2.1 and include safe session metadata plus answer-length, delivery-latency, queue, duplicate/stale, and timeout summaries.

## Session flow

1. Press `Alt+R` and select the verified Edge Stable profile and provider route.
2. Enter Resume, Job Description, and optional session fields. These remain in AutoHotkey process memory.
3. Session Studio waits for sender BOOT, REGISTERED, and READY before opening and waiting for the receiver.
4. Boot context is delivered only after both provider composers are ready.
5. Provisional transcript growth uses the disposable preview lane; one authoritative final uses the sequenced durable lane.
6. The receiver acknowledges success only after the matching provider user turn renders.
7. Use `Alt+H` to check the live link or `Alt+Shift+R` to repair the current session without re-entering context.

## Privacy boundary

- Session Studio persists only Edge profile directory, sender provider, receiver provider, and layout mode.
- Resume, JD, notes, prompts, answers, and session IDs are not persisted by Session Studio.
- Extension transcript logs exist only in browser-session memory and are deleted at session cleanup.
- Export is the explicit user action that writes role-scoped JSON and Markdown files.
- Setup text is fully redacted from event logs. Only company, target role, round, emphasis, answer mode, and missing-context flags may appear in the review summary.

## Shortcut surface

- `Alt+R`: open Session Studio.
- `Alt+H`: check the live sender/receiver link.
- `Alt+Shift+R`: fast-repair the current route and context.
- `Alt+Esc`: resend current in-memory context.
- `Alt+Delete`: end the exact managed session and exit.
- `Alt+Tab`: hide or restore managed windows.
- `Alt+CapsLock`: cycle two-window, sender-only, and receiver-only modes.
- `CapsLock`: cycle layouts.
- `Alt+Q`: toggle the sender microphone.
- `Alt+W`: toggle receiver scroll lock.
- `Alt+E`: export both role records.
- `Alt+Shift+E`: open the Review Studio.

## Main files

- `runtime/Final_2_Window_Extension.ahk`: active launcher and Session Studio.
- `runtime/extension/`: active Manifest V3 runtime.
- `runtime/README_INSTALL_TEST.md`: installation, operation, recovery, and verification.
- `runtime/Session_Tracker_End_Session.ahk`: optional Review Studio.
- `project_upload_bundle/`: recommended ChatGPT Project upload bundle.
- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md`: compact Project contract.
- `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`: current operational ledger.
- `docs/superpowers/specs/2026-08-01-pmia-0.7-reliability-coherence-design.md`: 0.7 design record.

## Verification

Run one complete gate from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The validator runs the Node suite, JavaScript syntax/security validation, and silent validation for both active AutoHotkey programs. Browser evidence is required for final release claims about real provider rendering, focus behavior, or live interaction.
