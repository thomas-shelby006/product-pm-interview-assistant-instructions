# PMIA Lossless Delivery and Live Pilot Design

## Objective

Guarantee that every authoritative, non-duplicate Window 1 final remains recoverable until Window 2 proves that it rendered. While Window 2 is generating, new finals accumulate without interrupting the active answer. The receiver composer mirrors the pending batch and, when the batch contains multiple questions, instructs the provider to focus on the latest question first.

## Non-negotiable invariants

1. A final is never removed because a newer final arrived.
2. A final is acknowledged to Window 1 only after the service worker persists it in the session ledger.
3. A final leaves the actionable ledger only after provider-rendered proof, or an explicit confirmed operator archive.
4. Duplicate means the same session plus envelope ID or accepted sequence; identical wording at a later sequence is not a duplicate.
5. Preview text is disposable and can never overwrite a persisted receiver batch.
6. New finals do not stop an answer by default.
7. Browser tabs are never activated or focused by background delivery, batching, repair, or inspection.
8. Resume, JD, notes, and full setup context remain outside disk-backed extension storage.

## Chosen architecture

Use a dual-ack delivery pipeline with three state owners:

- Sender Outbox: page-session memory plus sessionStorage retains each final until the service worker returns `persisted: true`.
- Delivery Ledger: `chrome.storage.session` is the authoritative session record across service-worker suspension.
- Receiver Batch Scheduler: one immutable in-flight batch plus one mutable next batch. New arrivals always enter the next batch.

The service worker can terminate at any time. All authoritative delivery and batch state therefore reconstructs from storage. Long-lived runtime ports provide the fast path; one-time messages remain the recovery fallback.
## Ledger model

Each final has one ledger entry with these states:

`persisted -> staged -> batched -> submitting -> proven -> archived`

Retryable failures return the entry to `persisted` or `staged`; they never delete it. Entries retain envelope identity, sequence, timestamps, attempt count, batch ID, proof data, and last error. The ledger has no automatic item-count eviction. It measures `storage.session` bytes and raises warnings at 70%, 85%, and 95%. If a write approaches quota, the sender outbox keeps the final and retries after proven history is compacted.

Proven entries are compacted into bounded aggregate history; actionable text is retained until proof. Explicit discard becomes `operator_archived`, preserving an audit record instead of silently removing the message.

## Receiver batching

The scheduler maintains:

- `activeBatch`: frozen after submission begins; new messages cannot mutate it.
- `nextBatch`: ordered persisted finals waiting behind the active answer.
- `draftRevision`: monotonically increasing composer revision.

When the receiver is idle, one pending final submits immediately. When it is generating, the next batch is mirrored into the composer without submitting. Each later final is appended to that draft. When generation ends, the frozen next batch submits automatically.

For one question, the payload contains the staged context and the single live question. For two or more questions, it includes numbered questions, marks the latest, and adds:

> Multiple interviewer questions arrived while you were answering. Focus on the latest question first. Use earlier questions as context and address them only when useful.

A single rendered receiver user turn proves the immutable batch payload. That proof marks every member of the batch proven.
## Fast path and arbitration

Sender and receiver content runtimes open named long-lived ports to the service worker. The sender posts finals through the port and waits for a persisted acknowledgement. The receiver receives ledger/batch snapshots through its port and returns staged/submitted/proven events. Port disconnect immediately falls back to one-time messaging and reconnects without losing ledger state.

Rendered user turns are authoritative finals and should forward immediately. A newly rendered sender user turn is emitted without waiting for the sender provider's assistant answer. Stable-tail fallback remains only for providers or voice paths that do not expose a rendered turn.

Preview arbitration rules:

- No actionable backlog and receiver idle: preview may mirror into the composer.
- Actionable backlog or active generation: preview is retained as telemetry only.
- Persisted batch text always outranks preview text.
- Manual receiver-composer divergence pauses draft mirroring and raises a conflict instead of overwriting user edits.

## Pilot redesign

The Pilot becomes an interview operations console rather than a generic status page. Its primary surface contains:

- Live Inbox with each final's ledger state and batch membership.
- Current Answer card showing generation, active batch, latest-focus question, and elapsed time.
- Next Draft card showing the exact pending question count and whether the composer is synchronized.
- Latency rail: observed, persisted, staged, submitted, proven, answer captured.
- Catch-up status: caught up, accumulating, held, blocked, or degraded.
- Storage-pressure and recovery warnings.

New controls:

- Auto-submit after current answer, enabled by default.
- Hold after current answer while continuing to capture.
- Interrupt and answer latest now, preserving all earlier finals in the next batch.
- Submit pending batch now when idle.
- Copy latest question.
- Archive a selected item with confirmation and retained audit status.

Existing pause, repair, context, microphone, scroll, focus, export, layout, hide/restore, and end-session features remain.
## Code boundaries and cleanup

Large files are split only where the new feature requires a clearer owner:

- `shared/delivery-ledger.js`: ledger transitions and deduplication.
- `shared/batch-planner.js`: active/next batch state and deterministic prompt composition.
- `shared/runtime-port-hub.js`: role-port lifecycle and fallback delivery.
- `content/sender-outbox.js`: sender persistence acknowledgement and retry.
- `content/receiver-batch-runtime.js`: composer synchronization, idle scheduling, submission, and proof.
- `dashboard/live-inbox-model.js`: view-only derived state.

`runtime-pilot-controller.js` becomes orchestration, not the home of queue mechanics. `entry.js` delegates sender and receiver delivery responsibilities. The old dropping OperatorQueue, default supersede-on-generation path, and duplicate command implementations are removed after migration. Compatibility adapters remain only where current dashboard or export contracts need them.

## Ten implementation cycles

1. Lossless ledger and sender persisted acknowledgement.
2. Non-preemptive receiver active/next batch scheduler.
3. Deterministic multi-question prompt and batch proof mapping.
4. Long-lived role ports with fallback messaging.
5. Immediate rendered-turn sender finalization and preview arbitration.
6. Restart reconciliation, quota pressure, and exact recovery.
7. Pilot visual redesign around Live Inbox and Current/Next Batch.
8. Real-time operator features: auto, hold, interrupt latest, submit now, copy latest.
9. Architecture cleanup, dead-code removal, and file-boundary reduction.
10. Performance hardening, documentation, release evidence, and final consolidated verification.

## Verification policy

Tests and browser scenarios are authored beside each cycle but not executed until all ten cycles are implemented. The final gate runs the complete Node suite, extension validator, both AutoHotkey validators, and isolated off-screen browser scenarios for sequential questions, accumulation during generation, worker restart, receiver reload, duplicate delivery, hold/resume, and multi-question latest-focus behavior.

## Completion criteria

The work is complete only when no automatic path drops a persisted final, every proven receiver batch maps to all member finals, the sender and dashboard can reconstruct state after worker restart, the Pilot displays actionable batch truth, and the final automated plus isolated-browser gate passes.