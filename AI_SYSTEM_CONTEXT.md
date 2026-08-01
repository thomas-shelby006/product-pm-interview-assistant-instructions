# AI System Context — PM Interview Assistant

This file is the active technical context for reviewing Sundar's Product Management mock-interview system. It describes PMIA runtime 0.7.0, not the preserved legacy implementation.

## Product objective

The system converts a live interviewer question into a fast, speakable PM answer while keeping session setup, transport, recovery, and post-session review reliable under interview pressure.

The engineering priority order is:

1. do not lose any non-duplicate authoritative question final;
2. preserve sequence and batch membership while preventing partial transcript submission;
3. keep sender, receiver, and dashboard recoverable without disturbing unrelated browser windows;
4. keep Resume, JD, notes, prompts, answers, and session identifiers out of persistent runtime storage;
5. make operational failure visible and repairable in one action;
6. produce useful explicit exports for mock review.

## Active local architecture

- **Browser:** Microsoft Edge Stable, one profile selected and verified by Profile Doctor.
- **Launcher:** `runtime/Final_2_Window_Extension.ahk`, AutoHotkey v2.
- **Provider/dashboard runtime:** `runtime/extension/`, Manifest V3.
- **Providers:** ChatGPT and Claude independently selectable as sender or receiver.
- **Windows:** one managed sender, one managed receiver, and one session-scoped Runtime Pilot Dashboard.
- **Transport:** disposable preview lane plus sender outbox, durable lossless final ledger, direct role ports, session-level pause, and active/next receiver batching through the extension service worker.
- **Review:** `runtime/Session_Tracker_End_Session.ahk` plus exact Markdown pairing and private tracker push scripts.

Edge Beta, Tampermonkey, `Final_2_Window_Fixed.ahk`, and archives are inactive rollback/reference assets.

## Ownership boundaries

### AutoHotkey launcher

Owns Session Studio, profile/route/layout preferences, three-window Edge launch, exact lifecycle-window discovery, layout/hide controls, dashboard recovery, boot-context delivery, AHK memory cleanup, and global PM hotkeys. Sensitive session context remains only in the current AutoHotkey process.

### Extension service worker

Owns role registration, ownership conflict resolution, persisted-final admission, lossless ledger, batch reconciliation, transport mode, direct role ports, final routing, Runtime Pilot state/ports, counterpart status, browser-native recovery/layout commands, ephemeral role logs, export control, and deterministic cleanup.

### Content runtime

Owns provider observation, provisional preview, authoritative finalization, sender outbox, composer arbitration, receiver accumulation/submission/proof, explicit-only generation interruption, answer capture, source-silence/heartbeat/batch telemetry, semantic runtime commands, compact status overlay, health response, and role-scoped export.

### Provider adapters

Own semantic DOM discovery and provider-specific operations: composer reads/writes, send readiness, submitted-turn confirmation, generation stop, assistant text, microphone control, and provider onboarding-dialog handling.

## Lifecycle and readiness

Managed tabs progress through deterministic titles:

- `PMIA_BOOT_<ROLE>_<PROVIDER>_<SESSION>` — content runtime loaded;
- `PMIA_REGISTERED_<ROLE>_<PROVIDER>_<SESSION>` — service-worker ownership accepted;
- `PMIA_<ROLE>_<PROVIDER>_<SESSION>` — provider composer available and role ready.

The launcher opens the sender first and waits for READY before opening the receiver. After both roles are READY it opens `PMIA_DASHBOARD_<SESSION>`. Boot context is sent only after all three managed windows exist.

Each registration heartbeat refreshes ownership. A competing fresh role is normally rejected. PMIA 0.7 probes the current owner first; a missing or non-responsive runtime is replaced immediately, while a healthy duplicate remains blocked.

## Question transport

### Preview lane

Provisional transcript growth is disposable, in-memory, coalesced, and never queued. Each page has its own preview stream identity. Preview state may prefill the receiver composer but cannot submit.

### Final lane

Every authoritative provider boundary creates a sequenced envelope and stores it in the sender outbox. Window 1 retains the envelope until the service worker confirms `persisted: true`. The service worker persists every non-duplicate final in the lossless delivery ledger before attempting Window 2 delivery. No count-based eviction, latest-only replacement or automatic supersession is permitted.

When transport is active and Window 2 is idle, the final can submit immediately. When paused, unavailable or generating, the final remains unresolved and is accumulated into the next batch. Duplicate identity is acknowledged without resubmission. A newer proof never deletes an older unresolved final.

### ChatGPT boundary

Rendered user-turn growth is preview-only. The following assistant turn is the preferred final boundary; bounded ChatGPT-specific fallback exists for provider behavior where the authoritative boundary is delayed. Message-ID replacement during navigation is suppressed by turn identity and canonical text.

### Claude boundary

`transcript_interim` is preview-only. `user_input_end` is a hint. `server_interrupt` preserves the utterance. `transcript_empty` clears it. A human `message_complete` is the authoritative voice final.

## Receiver behavior

Window 2 owns one immutable active batch and one mutable next batch. Ordinary new finals never stop or mutate an active answer. They are added to the next batch and mirrored into the receiver composer under composer ownership arbitration; a manual edit blocks automatic overwrite and raises a draft conflict.

A single waiting question submits unchanged. When multiple questions accumulate, all are preserved in sequence order and the prompt tells the answer model to answer all while focusing primarily on the latest question. A batch is acknowledged only after a matching provider user turn renders; one frozen batch proof maps to every member final.

**Interrupt for latest** is the sole normal path allowed to stop active generation. It submits only the newest waiting final and preserves every earlier waiting final in the next batch. Restart reconciliation checks already-rendered receiver turns before replaying unresolved ledger entries.

Delivery recovery is background-safe. The service worker disables tab discard and reloads only an actually discarded managed tab; it does not activate the tab or focus the Edge window.

## Runtime privacy

- Session Studio persists only profile directory, sender provider, receiver provider, and layout mode.
- Registry, role logs, lossless ledger, safe batch checkpoint, dashboard snapshot and timeline use `chrome.storage.session`, not disk-backed extension local storage.
- Legacy `pmia_log_*` local records are removed at service-worker startup.
- Setup events are replaced by `[Session setup redacted from session log]`.
- Only company, target role, interview round, emphasis, answer mode, and missing Resume/JD flags are allowed into review metadata.
- Ending the session or closing both provider tabs removes registrations, sender outbox, lossless ledger, batch state, Pilot state, receiver sequence state, both role logs, dashboard, and AHK setup context.
- Explicit export is the only supported path that writes transcript or answer material to files.

## User-facing operations

- `Alt+R` opens Session Studio.
- `Alt+D` shows or reopens the current dashboard without relaunching providers.
- `Alt+H` verifies both provider runtimes and dashboard presence.
- `Alt+Shift+R` runs Fast Repair using the current in-memory context and existing route.
- `Alt+Esc` resends current context.
- `Alt+Delete` closes the exact managed session and exits the launcher.
- `Alt+Tab`, `Alt+CapsLock`, and `CapsLock` control three-window, sender + dashboard, receiver + dashboard, dashboard-only and preserved two-provider layouts.
- `Alt+Q` controls sender microphone; `Alt+W` controls receiver auto-scroll.
- `Alt+E` exports both role records; `Alt+Shift+E` opens Review Studio.

Normal health states include `LINK OK`, `FORWARDING PAUSED`, lossless inbox counts, Current Answer, Next Draft, Pace Guard, storage pressure, missing/unresponsive sender/receiver, source silence, `FINAL PERSISTED`, and `COMPOSER NOT READY`. Session Studio launch states include `PREFLIGHT`, `LAUNCHING`, `WAITING_BOOT`, `WAITING_REGISTRATION`, `WAITING_COMPOSER`, `WAITING_DASHBOARD`, `READY`, and `ERROR`.

## Export and review

Each role exports JSON and Markdown schema 2.1. The existing `Session:` and `Window:` Markdown headers remain compatible with the exact-pair resolver. Exports include:

- safe session metadata;
- whether the session armed;
- observed question and captured-answer counts;
- average/maximum answer word count and answers over 180 words;
- average/maximum receiver delivery time;
- ledger and batch counts, duplicate acknowledgements, explicit archives, Pace Guard evidence, and answer-timeout counts;
- bounded role events with full setup text redacted.

Review Studio detects exactly one complete READY pair, requests both role exports through the launcher control channel, validates fresh matching files, and pushes only after explicit user action.

## Main failure modes to review

1. Provider DOM or voice protocol changes break semantic observation.
2. A provider composer remains mounted but not actually submit-ready.
3. A discarded or invalidated tab fails to recover.
4. Duplicate ownership is accepted or a healthy owner is incorrectly replaced.
5. A final is acknowledged before the provider renders the user turn.
6. Setup text or transcript data reaches persistent extension storage.
7. Ending or manually closing a session leaves orphaned registry/log state.
8. Health or repair controls use a separate workaround rather than the production lifecycle.
9. Launcher or dashboard layout actions affect unrelated Edge windows.
10. Dashboard reconnect, service-worker restart, or command idempotency recreates stale/ghost state.
11. Any non-duplicate final disappears, is archived automatically, or is marked proven without matching batch/rendered proof.

## Verification contract

Automated verification must run the complete Node suite, JavaScript validator, and silent validation of both active AutoHotkey programs from the exact worktree. Browser evidence is required before claiming real-provider rendering, focus behavior, downloads, storage behavior, or action timing. Use synthetic interview content for release checks and preserve unrelated browser state.
