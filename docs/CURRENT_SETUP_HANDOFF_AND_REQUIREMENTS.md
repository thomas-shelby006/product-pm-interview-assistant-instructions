# Current Setup Handoff and Requirements Ledger

Last updated: 2026-08-04

## Objective

Operate a low-latency, exactly-once Product Management mock-interview assistant with a managed sender, receiver and Runtime Pilot Dashboard, structured in-memory setup context, lossless final ledger, non-preemptive receiver batching, fast operational recovery, and an explicit post-session review loop.

## Active architecture

- **Browser:** Microsoft Edge Stable, one selected profile verified by Profile Doctor.
- **Launcher:** `runtime/Final_2_Window_Extension.ahk`.
- **Provider/dashboard runtime:** `runtime/extension/`, Manifest V3 version 0.10.4 candidate.
- **Transport:** disposable preview plus sender outbox, durable lossless final ledger, session-level pause, direct role ports and active/next receiver batching through the extension service worker.
- **Dashboard:** `runtime/extension/dashboard/`, a session-scoped third Edge app window connected by a long-lived runtime port.
- **Providers:** ChatGPT and Claude independently selectable as sender or receiver.
- **Session setup:** Resume, Job Description, Target company, Target role, Interview round, Emphasis, Avoid mentioning, Answer mode, and Additional notes.
- **Review companion:** `runtime/Session_Tracker_End_Session.ahk` plus exact resolver and private tracker push scripts.

The old Edge Beta/Tampermonkey runtime, fixed launcher, and archives are preserved but inactive.

## Data and privacy boundaries

- Session Studio stores sensitive context only in the running AutoHotkey process.
- `settings.ini` contains only profile directory, sender provider, receiver provider, and layout mode.
- Extension registry, transcript logs, Runtime Pilot state, delivery ledger, safe batch checkpoint and timeline use `chrome.storage.session`.
- No transcript or answer log falls back to `chrome.storage.local`.
- Service-worker startup removes legacy `pmia_log_*` local records.
- Boot/setup event text is fully replaced by a redaction placeholder before logging.
- Review metadata permits only company, target role, interview round, emphasis, answer mode, and missing Resume/JD flags.
- Explicit export is the only action that writes role-scoped transcript/answer material to files.
- End-session and final-provider cleanup remove registry, sender outbox, delivery ledger, batch state, pilot state, receiver sequence state, both role logs, dashboard window and AHK in-memory setup context.

## Runtime lifecycle

1. Session Studio verifies Edge Stable profile, unpacked extension path, and version.
2. Sender progresses through BOOT, REGISTERED, and READY.
3. Receiver opens only after sender READY and progresses through the same phases.
4. Dashboard opens after both roles are READY and must reach `PMIA_DASHBOARD_<SESSION>`.
5. Boot context is sent only after all three managed windows exist.
6. Preview updates are disposable and never enter the lossless ledger or submit.
7. Each authoritative final enters the sender outbox and is removed only after the service worker returns `persisted: true`.
8. The delivery ledger retains every non-duplicate final without count eviction. Paused, unavailable and busy-receiver finals remain unresolved.
9. Window 2 keeps one immutable active batch and one mutable next batch. New arrivals during generation update the next composer draft without stopping the active answer.
10. A single waiting question is submitted unchanged. Multiple questions preserve all text and explicitly mark the latest question as highest priority.
11. Receiver success requires a newly rendered matching provider user turn; one batch proof maps to every frozen member ID.
12. Duplicate identity is acknowledged without resubmission. A newer proof never deletes an older unresolved final.
13. Restore events and heartbeats re-register managed tabs, restore safe batch identity, reconcile existing rendered batches, and replay unresolved finals in sequence order.
14. A role conflict probes the current owner; only a missing or non-responsive owner is replaced.

## Recovery and health

- Delivery recovery keeps the managed tab in the background. It disables discard, reloads only an actually discarded tab, and never activates/focuses Edge.
- `Check Live` / `Alt+H` verifies sender and receiver reachability plus dashboard presence. Dashboard health separately reports heartbeat, composer, generation and source-silence state.
- Dashboard **Repair runtime** requests semantic recovery, reloads an unresponsive owned tab, or reopens a role from its known provider URL. `Fast Repair` / `Alt+Shift+R` remains the full AHK relaunch using current in-memory context.
- A healthy competing role remains a terminal `ROLE CONFLICT`; a dead owner is replaced immediately and recorded as `registration_recovered` without transcript data.

## Operational controls

- `Alt+R`: Session Studio.
- `Alt+D`: show or reopen dashboard.
- `Alt+H`: sender/receiver/dashboard health check.
- `Alt+Shift+R`: fast repair.
- `Alt+Esc`: resend current in-memory context.
- `Alt+Delete`: end exact managed session and exit.
- `Alt+Tab`: hide/restore.
- `Alt+CapsLock`: three-window, sender + dashboard, receiver + dashboard, dashboard-only mode.
- `CapsLock`: layout preset.
- `Alt+Q`: sender microphone.
- `Alt+W`: receiver scroll lock.
- `Alt+E`: export both role records.
- `Alt+Shift+E`: Review Studio.

## Export and review contract

The dashboard Review view and Copy Diagnostics exclude transcript/setup text. Schema 2.1 preserves the existing Markdown `Session:` and `Window:` headers. Each role export includes safe context, arm state, question/answer counts, answer-length statistics, receiver delivery timing, ledger and batch counts, duplicates, explicit archives, answer timeouts, Pace Guard evidence, and bounded role events. Full setup text, Resume, JD, avoid text, and freeform notes are not exported as event text.

Review Studio detects one exact READY pair, exports both roles through `PMIA_RUNTIME_CONTROL_V1`, validates one fresh matching Markdown pair, and pushes to the private tracker only after explicit user action.

## Repositories and paths

- System repository: `thomas-shelby006/product-pm-interview-assistant-instructions`.
- Canonical source: `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions`, branch `main`.
- Stable deployment: `C:\Users\Sundar\Documents\PMIA Deployment\current`.
- Immutable rollback: `C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed`.
- Four temporary 0.10.4 worktrees exist only until exact final verification and cleanup.
- Private tracker: `thomas-shelby006/pm-interview-session-tracker`.
- Local tracker: `C:\Users\Sundar\Documents\pm-interview-session-tracker`.

## Verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The exact candidate tree must pass Node tests, JavaScript validation, main-launcher validation, Review Studio validation, diff/encoding review, and any required browser-evidence smoke before publication. The current task authorizes a local fast-forward of `main` after exact verification. Do not push, tag, publish, or deploy to cloud infrastructure.
