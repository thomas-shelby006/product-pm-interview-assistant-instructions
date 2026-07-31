# AI System Context — PM Interview Assistant

This file is the active technical context for reviewing Sundar's Product Management mock-interview system. It describes PMIA runtime 0.7.0, not the preserved legacy implementation.

## Product objective

The system converts a live interviewer question into a fast, speakable PM answer while keeping session setup, transport, recovery, and post-session review reliable under interview pressure.

The engineering priority order is:

1. do not lose or duplicate the latest actionable question;
2. do not submit stale or partial transcript text;
3. keep the managed sender and receiver recoverable without disturbing unrelated browser windows;
4. keep Resume, JD, notes, prompts, answers, and session identifiers out of persistent runtime storage;
5. make operational failure visible and repairable in one action;
6. produce useful explicit exports for mock review.

## Active local architecture

- **Browser:** Microsoft Edge Stable, one profile selected and verified by Profile Doctor.
- **Launcher:** `runtime/Final_2_Window_Extension.ahk`, AutoHotkey v2.
- **Provider runtime:** `runtime/extension/`, Manifest V3.
- **Providers:** ChatGPT and Claude independently selectable as sender or receiver.
- **Windows:** exactly one managed sender and one managed receiver.
- **Transport:** disposable preview lane plus durable sequenced final lane through the extension service worker.
- **Review:** `runtime/Session_Tracker_End_Session.ahk` plus exact Markdown pairing and private tracker push scripts.

Edge Beta, Tampermonkey, `Final_2_Window_Fixed.ahk`, and archives are inactive rollback/reference assets.

## Ownership boundaries

### AutoHotkey launcher

Owns Session Studio, profile/route/layout preferences, managed Edge process launch, exact lifecycle-window discovery, layout/hide controls, boot-context delivery, and global PM hotkeys. Sensitive session context remains only in the current AutoHotkey process.

### Extension service worker

Owns role registration, ownership conflict resolution, durable sequence admission, final routing, latest-only queueing, counterpart status, ephemeral role logs, export control, and deterministic cleanup.

### Content runtime

Owns provider observation, provisional transcript preview, authoritative finalization, receiver composer staging/submission, generation supersede, answer capture, status overlay, health preflight response, and role-scoped export.

### Provider adapters

Own semantic DOM discovery and provider-specific operations: composer reads/writes, send readiness, submitted-turn confirmation, generation stop, assistant text, microphone control, and provider onboarding-dialog handling.

## Lifecycle and readiness

Managed tabs progress through deterministic titles:

- `PMIA_BOOT_<ROLE>_<PROVIDER>_<SESSION>` — content runtime loaded;
- `PMIA_REGISTERED_<ROLE>_<PROVIDER>_<SESSION>` — service-worker ownership accepted;
- `PMIA_<ROLE>_<PROVIDER>_<SESSION>` — provider composer available and role ready.

The launcher opens the sender first and waits for READY before opening the receiver. Boot context is sent only after both roles are READY.

Each registration heartbeat refreshes ownership. A competing fresh role is normally rejected. PMIA 0.7 probes the current owner first; a missing or non-responsive runtime is replaced immediately, while a healthy duplicate remains blocked.

## Question transport

### Preview lane

Provisional transcript growth is disposable, in-memory, coalesced, and never queued. Each page has its own preview stream identity. Preview state may prefill the receiver composer but cannot submit.

### Final lane

Authoritative provider boundaries create a sequenced envelope. The background accepts each increasing sequence once, routes it to the registered receiver, and retains only the latest final when delivery is unavailable. A replay is duplicate-acknowledged; stale work is discarded.

### ChatGPT boundary

Rendered user-turn growth is preview-only. The following assistant turn is the preferred final boundary; bounded ChatGPT-specific fallback exists for provider behavior where the authoritative boundary is delayed. Message-ID replacement during navigation is suppressed by turn identity and canonical text.

### Claude boundary

`transcript_interim` is preview-only. `user_input_end` is a hint. `server_interrupt` preserves the utterance. `transcript_empty` clears it. A human `message_complete` is the authoritative voice final.

## Receiver behavior

The receiver stages boot context without submitting it. For a question, it stops an older generating answer when possible, waits for the provider to become idle, writes/submits the latest question, and acknowledges only after a new matching user turn renders. A newer delivery invalidates older receiver work.

Delivery recovery is background-safe. The service worker disables tab discard and reloads only an actually discarded managed tab; it does not activate the tab or focus the Edge window.

## Runtime privacy

- Session Studio persists only profile directory, sender provider, receiver provider, and layout mode.
- Role logs use `chrome.storage.session`, not `chrome.storage.local`.
- Legacy `pmia_log_*` local records are removed at service-worker startup.
- Setup events are replaced by `[Session setup redacted from session log]`.
- Only company, target role, interview round, emphasis, answer mode, and missing Resume/JD flags are allowed into review metadata.
- Ending the session or closing its final managed tab removes registrations, pending final, sequence state, and both role logs.
- Explicit export is the only supported path that writes transcript or answer material to files.

## User-facing operations

- `Alt+R` opens Session Studio.
- `Alt+H` opens Session Studio, verifies the exact READY pair, and requests the authorized F11 counterpart preflight in both managed windows.
- `Alt+Shift+R` runs Fast Repair using the current in-memory context and existing route.
- `Alt+Esc` resends current context.
- `Alt+Delete` closes the exact managed session and exits the launcher.
- `Alt+Tab`, `Alt+CapsLock`, and `CapsLock` control visibility and layout.
- `Alt+Q` controls sender microphone; `Alt+W` controls receiver auto-scroll.
- `Alt+E` exports both role records; `Alt+Shift+E` opens Review Studio.

Normal health states include `LINK OK`, missing sender/receiver, `FINAL QUEUED`, `RUNTIME UNREACHABLE`, and `COMPOSER NOT READY`. Session Studio launch states include `PREFLIGHT`, `LAUNCHING`, `WAITING_BOOT`, `WAITING_REGISTRATION`, `WAITING_COMPOSER`, `READY`, and `ERROR`.

## Export and review

Each role exports JSON and Markdown schema 2.1. The existing `Session:` and `Window:` Markdown headers remain compatible with the exact-pair resolver. Exports include:

- safe session metadata;
- whether the session armed;
- observed question and captured-answer counts;
- average/maximum answer word count and answers over 180 words;
- average/maximum receiver delivery time;
- queued final, duplicate/stale, and answer-timeout counts;
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
9. Launcher actions affect unrelated Edge windows.

## Verification contract

Automated verification must run the complete Node suite, JavaScript validator, and silent validation of both active AutoHotkey programs from the exact worktree. Browser evidence is required before claiming real-provider rendering, focus behavior, downloads, storage behavior, or action timing. Use synthetic interview content for release checks and preserve unrelated browser state.
