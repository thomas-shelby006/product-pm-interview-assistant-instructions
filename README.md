# Product PM Interview Assistant

This repository contains Sundar's live Product Management mock-interview system: Session Studio, two managed provider windows, a third Runtime Pilot Dashboard, a Manifest V3 control plane, and an optional post-session review loop.

**Current release: PMIA runtime 0.10.3 candidate.**

## Active architecture

- `runtime/Final_2_Window_Extension.ahk` owns Session Studio, provider selection, exact sender/receiver/dashboard windows, layouts, PM-only hotkeys, and in-memory setup context.
- `runtime/extension/` is the authoritative provider and dashboard runtime for ChatGPT and Claude in Microsoft Edge Stable.
- The extension service worker owns role registration, durable final ordering, transport mode, the lossless delivery ledger and live inbox, dashboard state, recovery, ephemeral logs, and deterministic cleanup.
- Content scripts own transcript previews, provider-specific final commits, receiver submission/proof, answer capture, semantic commands, telemetry, and compact overlays.
- `runtime/extension/dashboard/` is the live Runtime Pilot Dashboard; it observes state and sends validated commands but never mutates provider pages directly.
- `runtime/Session_Tracker_End_Session.ahk` optionally exports the exact session pair and sends it to the private review tracker.

The older Edge Beta, Tampermonkey, fixed-launcher, and archived assets are retained only for rollback and history. Do not enable them beside the active runtime.

## Current PMIA 0.10 capabilities

- Transcript and answer logs use `chrome.storage.session`; they are no longer written to disk-backed extension local storage.
- Startup removes legacy `pmia_log_*` local-storage records using key-only enumeration when supported, without materializing their values.
- AutoHotkey disk debug logging is disabled by default. Set `PMIA_DEBUG_LOG=1` only for explicit diagnostics; session IDs are redacted.
- Ending a session or closing its final managed tab clears registrations, the lossless ledger, batch state, role logs, dashboard state, and AHK in-memory context.
- A new managed tab can immediately replace a closed or unreachable stale owner instead of waiting for the 45-second heartbeat window.
- Receiver recovery no longer activates a tab or focuses an Edge window.
- **Check Live** / `Alt+H` runs the real sender-receiver preflight in both managed windows.
- **Fast Repair** / `Alt+Shift+R` relaunches the current route using the existing in-memory context.
- Exports use schema 2.1 and include safe session metadata plus answer-length, delivery-latency, ledger, batch, duplicate, archive, and timeout summaries.
- The third Runtime Pilot Dashboard shows Live Inbox state, Current Answer, Next Draft, Pace Guard, latency rail, role health, delivery proof, storage pressure, warnings, repair reports, and bounded timeline history.
- Pause keeps sender observation running while suppressing previews and persisting every authoritative final; Resume & Catch Up reconciles every unresolved final in sequence order.
- A newer rendered question never supersedes an older unresolved final. Every non-duplicate final remains until provider-rendered proof or explicit operator archive.

## Session flow

1. Press `Alt+R` and select the verified Edge Stable profile and provider route.
2. Enter Resume, Job Description, and optional session fields. These remain in AutoHotkey process memory.
3. Session Studio waits for sender BOOT, REGISTERED, and READY before opening and waiting for the receiver.
4. After both providers are READY, Session Studio opens the session-scoped Runtime Pilot Dashboard and waits for its exact lifecycle title.
5. Boot context is delivered only after sender, receiver, and dashboard are present.
6. Provisional transcript growth uses the disposable preview lane; one authoritative final uses the sequenced durable lane.
7. The receiver acknowledges success only after the matching provider user turn renders.
8. Use the dashboard for live health, pause/catch-up, submit selected, auto-submit, hold, submit now, explicit interrupt, archive, recovery, layouts and safe diagnostics. `Alt+D` restores it without restarting providers.

## Privacy boundary

- Session Studio persists only Edge profile directory, sender provider, receiver provider, and layout mode.
- Resume, JD, notes, prompts, answers, and session IDs are not persisted by Session Studio.
- Extension transcript logs exist only in browser-session memory and are deleted at session cleanup.
- Export is the explicit user action that writes role-scoped JSON and Markdown files.
- Setup text is fully redacted from event logs. Only company, target role, round, emphasis, answer mode, and missing-context flags may appear in the review summary.

## Shortcut surface

- `Alt+R`: open Session Studio.
- `Alt+D`: show or reopen the current Runtime Pilot Dashboard.
- `Alt+H`: check sender, receiver, and dashboard health.
- `Alt+Shift+R`: fast-repair the current route and context.
- `Alt+Esc`: resend current in-memory context.
- `Alt+Delete`: end the exact managed session and exit.
- `Alt+Tab`: hide or restore managed windows.
- `Alt+CapsLock`: cycle three-window, sender + dashboard, receiver + dashboard, and dashboard-only modes.
- `CapsLock`: cycle layouts.
- `Alt+Q`: toggle the sender microphone.
- `Alt+W`: toggle receiver scroll lock.
- `Alt+E`: export both role records.
- `Alt+Shift+E`: open the Review Studio.

## Main files

- `runtime/Final_2_Window_Extension.ahk`: active launcher and Session Studio.
- `runtime/extension/`: active Manifest V3 provider and dashboard runtime.
- `runtime/extension/dashboard/`: Runtime Pilot Dashboard.
- `docs/LEGACY_FEATURE_PARITY.md`: feature-by-feature old-to-new decision record.
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


## Verified lossless runtime foundation

The current PMIA 0.10 candidate builds on the verified lossless runtime and adds a coherent command registry, explicit-choice safety, Production evidence closure, and a new live-operator feature program.

- Per-session mutation lanes prevent stale Pilot snapshots from overwriting newer state while preserving cross-session concurrency.
- Gap Watch protects out-of-order finals until missing sequences arrive and exposes the exact missing sequence.
- Sender Outbox Retry provides ordered replay with one capped-backoff timer and a safe Retry Now action.
- Batch Proof Inspector validates the exact frozen member set and treats repeated proof idempotently.
- Memory Guard separates protected actionable bytes from safe reclaimable telemetry/proven history and withholds persistence acknowledgement under critical pressure.
- Interview Readiness Gate requires positive sender, receiver, context, adapter, heartbeat, storage, gap, and outbox evidence.
- Runtime Efficiency streams semantic deltas and heartbeat patches instead of repeated full snapshots.
- Recovery Progress requires roles, adapters, reconciliation, batch safety, and storage checks before returning to Active.
- Safe Health Report copies only operational metadata; it excludes setup context, questions, answers, and ledger text.
