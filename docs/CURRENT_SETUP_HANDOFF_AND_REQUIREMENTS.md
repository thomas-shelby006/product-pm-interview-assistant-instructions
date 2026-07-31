# Current Setup Handoff and Requirements Ledger

Last updated: 2026-08-01

## Objective

Operate a low-latency, exactly-once Product Management mock-interview assistant with one managed sender, one managed receiver, structured in-memory session context, fast operational recovery, and an explicit post-session review loop.

## Active architecture

- **Browser:** Microsoft Edge Stable, one selected profile verified by Profile Doctor.
- **Launcher:** `runtime/Final_2_Window_Extension.ahk`.
- **Provider runtime:** `runtime/extension/`, Manifest V3 version 0.7.0.
- **Transport:** disposable latest-only preview plus durable sequenced final through the extension service worker.
- **Providers:** ChatGPT and Claude independently selectable as sender or receiver.
- **Session setup:** Resume, Job Description, Target company, Target role, Interview round, Emphasis, Avoid mentioning, Answer mode, and Additional notes.
- **Review companion:** `runtime/Session_Tracker_End_Session.ahk` plus exact resolver and private tracker push scripts.

The old Edge Beta/Tampermonkey runtime, fixed launcher, and archives are preserved but inactive.

## Data and privacy boundaries

- Session Studio stores sensitive context only in the running AutoHotkey process.
- `settings.ini` contains only profile directory, sender provider, receiver provider, and layout mode.
- Extension registry and transcript logs use `chrome.storage.session`.
- No transcript or answer log falls back to `chrome.storage.local`.
- Service-worker startup removes legacy `pmia_log_*` local records.
- Boot/setup event text is fully replaced by a redaction placeholder before logging.
- Review metadata permits only company, target role, interview round, emphasis, answer mode, and missing Resume/JD flags.
- Explicit export is the only action that writes role-scoped transcript/answer material to files.
- End-session and final-tab cleanup remove registry, pending final, sequence state, and both role logs.

## Runtime lifecycle

1. Session Studio verifies Edge Stable profile, unpacked extension path, and version.
2. Sender progresses through BOOT, REGISTERED, and READY.
3. Receiver opens only after sender READY and progresses through the same phases.
4. Boot context is sent only after both roles are READY.
5. Preview updates are disposable and never submit.
6. Provider-specific final boundaries create one sequence-gated envelope.
7. Receiver success requires a newly rendered matching provider user turn.
8. Replays are duplicate-acknowledged; stale sequences are discarded; only the latest unavailable final is retained.
9. Restore events and heartbeats re-register managed tabs.
10. A role conflict probes the current owner; only a missing or non-responsive owner is replaced.

## Recovery and health

- Delivery recovery keeps the managed tab in the background. It disables discard, reloads only an actually discarded tab, and never activates/focuses Edge.
- `Check Live` / `Alt+H` verifies the exact READY pair and requests the authorized counterpart preflight in both managed windows.
- `Fast Repair` / `Alt+Shift+R` uses the current in-memory session context and existing route; it does not create a parallel repair mechanism.
- A healthy competing role remains a terminal `ROLE CONFLICT`; a dead owner is replaced immediately and recorded as `registration_recovered` without transcript data.

## Operational controls

- `Alt+R`: Session Studio.
- `Alt+H`: live link check.
- `Alt+Shift+R`: fast repair.
- `Alt+Esc`: resend current in-memory context.
- `Alt+Delete`: end exact managed session and exit.
- `Alt+Tab`: hide/restore.
- `Alt+CapsLock`: visibility mode.
- `CapsLock`: layout preset.
- `Alt+Q`: sender microphone.
- `Alt+W`: receiver scroll lock.
- `Alt+E`: export both role records.
- `Alt+Shift+E`: Review Studio.

## Export and review contract

Schema 2.1 preserves the existing Markdown `Session:` and `Window:` headers. Each role export includes safe context, arm state, question/answer counts, answer-length statistics, receiver delivery timing, queued finals, ignored duplicate/stale deliveries, answer timeouts, and bounded role events. Full setup text, Resume, JD, avoid text, and freeform notes are not exported as event text.

Review Studio detects one exact READY pair, exports both roles through `PMIA_RUNTIME_CONTROL_V1`, validates one fresh matching Markdown pair, and pushes to the private tracker only after explicit user action.

## Repositories and paths

- System repository: `thomas-shelby006/product-pm-interview-assistant-instructions`.
- Active isolated candidate: `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement`.
- Original checkout: `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions`.
- Private tracker: `thomas-shelby006/pm-interview-session-tracker`.
- Local tracker: `C:\Users\Sundar\Documents\pm-interview-session-tracker`.

## Verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The exact candidate tree must pass Node tests, JavaScript validation, main-launcher validation, Review Studio validation, diff/encoding review, and any required browser-evidence smoke before publication. Do not push, merge, tag, or alter canonical main as part of this candidate unless separately authorized.
