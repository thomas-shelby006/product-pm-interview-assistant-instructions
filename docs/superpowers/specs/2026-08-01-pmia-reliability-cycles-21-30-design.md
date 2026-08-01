# PMIA Reliability Cycles 21–30 Design

## Objective

Extend the PMIA 0.7 candidate with ten reliability-first cycles. Every cycle must contain exactly three buckets: **Bug fixes**, **New features**, and **Implementation**. The system must preserve every non-duplicate authoritative final, remain background-safe, avoid provider-window focus theft, keep sensitive state session-only, and retain all existing features.

## Accepted execution constraints

- Work only in `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement` on `improvement/pmia-0.7.0`.
- Preserve the original checkout, normal Edge windows, rollback assets, and private tracker.
- Do not push, merge, tag, publish, or replace the installed extension.
- Write regression coverage during each cycle, but do not execute tests until Cycle 30 is source-complete.
- Use isolated, off-screen browser profiles for material live-browser evidence.
- Update the technical systems atlas only after the runtime is verified.

## Architectural direction

The existing lossless ledger, sender outbox, active/next batch planner, direct role ports, Runtime Pilot state, and provider-rendered proof remain the owning architecture. The next phase closes lifecycle gaps around those owners rather than introducing a parallel transport or dashboard state system.
## Cycle design

### Cycle 21 — Hidden Runtime Guard

- **Bug fixes:** prevent hidden/background receivers from stalling when `requestAnimationFrame` or timers are throttled; require ChatGPT’s real enabled Send control before submission readiness.
- **New features:** show receiver visibility, current submit wait reason, and last scheduler wake source in Runtime Pilot.
- **Implementation:** use DOM-mutation-first provider yielding with frame and timer fallbacks; emit safe scheduler telemetry without question text.

### Cycle 22 — Command Result Journal

- **Bug fixes:** prevent a dashboard reconnect or retry from losing the result of an already-executed command.
- **New features:** show the latest five operator commands with result, duration, and replay status.
- **Implementation:** replace ID-only deduplication with a bounded session-only command journal that returns the original result for duplicate request IDs.

### Cycle 23 — Transport Circuit Guard

- **Bug fixes:** avoid paying the full role-port timeout repeatedly after a port becomes unhealthy.
- **New features:** expose Direct, Fallback, Open Circuit, and Probing transport-lane status with current round-trip time.
- **Implementation:** add per-session/role circuit state, immediate one-time-message fallback while open, bounded probe recovery, and telemetry.
### Cycle 24 — Lossless Batch Partitioning

- **Bug fixes:** prevent an unbounded accumulated draft from exceeding practical provider composer limits or causing one oversized submission failure.
- **New features:** show how many protected questions and sequential submission batches are waiting.
- **Implementation:** partition waiting finals deterministically by character and member limits while preserving sequence, full text, exact membership, and latest-question priority within each batch.

### Cycle 25 — Draft Conflict Resolver

- **Bug fixes:** prevent a manual composer edit from deadlocking automatic delivery indefinitely.
- **New features:** add explicit Keep Manual, Restore PMIA Draft, and Merge PMIA Below Manual actions.
- **Implementation:** extend composer ownership with a recoverable conflict state and deterministic merge semantics; never overwrite manual text without an explicit operator action.

### Cycle 26 — Delivery SLA Guard

- **Bug fixes:** prevent unresolved finals from remaining silently stalled without escalation.
- **New features:** show oldest unresolved age, target delivery window, escalation phase, and next automatic action.
- **Implementation:** add a session-only SLA policy that performs catch-up, live check, and repair escalation with cooldowns while preserving the ledger as authority.

### Cycle 27 — Durable Recovery Scheduling

- **Bug fixes:** replace service-worker `setTimeout` recovery assumptions that can disappear when Manifest V3 suspends the worker.
- **New features:** show the next scheduled recovery verification and its source.
- **Implementation:** persist recovery deadlines and use `chrome.alarms` plus event-driven resume checks; keep provider windows unfocused.
### Cycle 28 — Reload-Safe Sender Outbox

- **Bug fixes:** prevent an unpersisted sender final from disappearing when Window 1 reloads or its content runtime is replaced during the same browser session.
- **New features:** show restored-outbox count and recovery source after sender startup.
- **Implementation:** migrate the outbox to a session-only extension storage adapter keyed by session and runtime instance, with backward migration from page `sessionStorage` and deterministic cleanup.

### Cycle 29 — Safe Session Termination

- **Bug fixes:** prevent session cleanup from silently deleting unresolved finals.
- **New features:** add an end-session safety gate showing unresolved, in-flight, and unpersisted counts with explicit Export, Archive and End, or Cancel choices.
- **Implementation:** split termination into prepare and confirm phases; require a short-lived confirmation token when actionable state exists.

### Cycle 30 — Active Runtime Self-Test

- **Bug fixes:** prevent the Readiness Gate from declaring Ready using passive heartbeat and capability evidence when command transport is unhealthy.
- **New features:** add a non-invasive Self-Test Pulse showing sender/receiver control RTT, storage round-trip, dashboard connection, and final pass/fail state.
- **Implementation:** add an authorized no-content probe protocol, bounded timing samples, readiness integration, release validation, stale-code cleanup, and final evidence capture.

## Shared state and privacy rules

No new feature may write Resume, Job Description, notes, prompts, questions, answers, or session IDs to disk-backed extension storage. New telemetry stores only timestamps, counts, states, reason codes, durations, bounded identifiers, and safe operational metadata in `chrome.storage.session`.
## Failure handling

Every operation must return a reason-coded result. A failed optimization must fall back to the existing durable path rather than dropping or auto-archiving a final. Automatic recovery is bounded, idempotent, and suppressed while the operator has paused transport or while storage is critical.

## Verification contract

After Cycle 30 is source-complete:

1. run the complete Node suite;
2. run extension syntax, security, manifest, and import-reachability validation;
3. silently validate both active AutoHotkey programs;
4. launch a fresh isolated Edge profile with the candidate extension;
5. verify hidden receiver submission, multi-question accumulation, partitioned catch-up, command replay, circuit fallback, recovery scheduling, outbox restoration, self-test, and safe termination;
6. confirm normal Edge windows and the original checkout remain untouched;
7. update the condensed technical systems atlas from the verified source and evidence only.

## Completion test

The phase is complete only when all ten cycles are implemented under the three required buckets, the full automated gate exits zero, the isolated browser evidence proves the material live behavior, temporary task logs are removed after evidence replacement, the worktree is clean, and the updated standalone HTML atlas is verified at desktop and 320 CSS pixels.