# PMIA Adaptive Turn Coordination Design

**Status:** Approved through the existing PMIA 0.11 plan and the instruction to continue that plan without interruption.

## Goal

Add lossless Pause/Resume forwarding, protected combined drafts, correlated source-interruption carryover, deterministic throughput evidence, and operator-facing controls without creating a second queue, persistence store, transport, answer tracker, or browser lifecycle owner.

## Existing authoritative owners

- `DeliveryLedger` remains the durable identity and delivery-state owner.
- `BatchPlanner` remains the ordered active/next membership and prompt-partition owner.
- `receiver-batch-runtime` remains the only receiver submission and Stop-control owner.
- `RuntimePilotState` remains the durable session-metadata owner.
- `runtime-pilot-controller` remains the only dashboard command owner.
- Provider adapters remain the only DOM composer, Send, generation, and Stop surface owners.
- Finalized provider DOM turns remain the only durable question-admission boundary; previews never enter the ledger.

## Chosen architecture

Introduce a pure `adaptive-turn-coordination` model that normalizes and transitions metadata only. It is not a runtime owner. The model is persisted inside the existing session envelope and projected into receiver runtime state. `BatchPlanner` continues to hold the actual ordered envelopes.

Introduce a pure combined-prompt builder that consumes existing planner entries and a reason (`forwarding_hold` or `interrupted_answer`). The prompt is frozen only when a release batch is selected. Draft projection may update while held, but proof identity always uses the frozen prompt and exact member fingerprint.

Introduce a pure source-interruption correlator. It consumes content-free lifecycle evidence plus finalized source member IDs. It emits a carryover decision only when an incomplete source answer is followed by a finalized continuation inside a bounded window and the active receiver batch contains the interrupted source members.
## Persisted coordination state

`forwardingHold`:
- `active`, `activatedAt`, `reason`, `heldMemberIds`, `releaseMode`, `updatedAt`.
- `heldMemberIds` is bounded, deduplicated by identity, and sorted by source sequence through planner membership.
- Pause blocks provider writes and receiver credits, never durable admission.

`combinedDraft`:
- `memberIds`, `fingerprint`, `memberFingerprint`, `reason`, `projectedAt`, `manualConflictState`.
- It stores identity and fingerprints only in Pilot persistence; transcript text stays in the existing session-only planner/runtime surfaces.

`interruptionChain`:
- `id`, `memberIds`, `cancelledBatchId`, `sourceEvidence`, `receiverStopState`, `createdAt`, `updatedAt`.
- `sourceEvidence` contains timestamps, provider, generation token, continuation member ID, and reason codes, never answer text.
- A chain is actionable until an exact carryover batch is proven or explicitly archived at session end.

`turnPerformance`:
- bounded stage samples for `admission`, `projection`, `pause_block`, `resume_submit`, and `interrupt_stop`.
- rolling finalized-turn timestamps for the last 60 seconds.

## State transitions

1. **Pause:** set `forwardingHold.active=true`; set receiver hold; zero provider-write credits; preserve outbox and ledger admission.
2. **Held final:** admit normally, add to planner, project one combined draft, append member identity to hold state.
3. **Resume and send:** clear hold only after command acceptance; require no manual conflict; freeze current partition with combined prompt; wait for real Send readiness; submit once.
4. **Resume without sending:** clear persisted hold but keep planner auto-submit disabled and retain protected draft.
5. **Send held now:** submit one frozen held partition and reactivate hold after submission ownership is established.
6. **Correlated interruption:** verify source evidence and active-batch membership; issue one Stop token; preserve active members; merge active plus continuation members into the planner’s next set; submit carryover when safe.
7. **Failure:** retain exact members, reason code, and one recovery action. Never prove, archive, or supersede on failed stop/projection/submit.
## Combined prompt contract

For held or carried-over members, use this exact leading instruction:

> Forwarding was paused or the previous answer was interrupted and should be treated as not delivered. Use every question segment below as one combined context. Preserve relevant earlier context, focus primarily on the latest question, and answer the combined request. Do not assume the previous answer reached the user.

Segments are numbered in exact source order. The latest segment is marked as highest priority. Repeated wording remains distinct when member identity or sequence differs.

## Safety and concurrency

- Pause/Resume commands are idempotent and serialized by the existing per-session mutation lane.
- Durable sender acknowledgement precedes receiver coordination.
- Ordinary later finals never stop an active receiver answer.
- Stop ownership is bound to `batchId + generationToken + chainId`; stale or repeated tokens fail closed.
- Manual composer content blocks automatic overwrite and release submission.
- Route changes, export, and end-session are blocked while a hold or interruption chain is actionable unless the existing archive-and-end flow explicitly resolves it.
- Service-worker restart reconstructs coordination metadata from schema state and reconstructs envelopes from the existing ledger/planner checkpoints.
- Provider/page reload uses the existing role lease and reconciliation path; no focus activation is allowed.

## User experience

Runtime Pilot adds a compact Adaptive Turns card showing active/paused state, held count, oldest age, chain size, latest reason, route readiness, throughput, and stage latency. Primary actions are `Pause forwarding`, `Resume and send`, `Resume without sending`, and `Send held now`. Recovery actions appear only when stop, projection, or submit verification fails.

The receiver overlay shows `FORWARDING PAUSED · N SEGMENTS` while held. Accessibility announcements are deduplicated and include pause, collection count, interruption, release, and failure states.

## Performance acceptance

- 20 finalized turns in 60 seconds with zero loss and exact sequence.
- 100-turn burst with zero loss, bounded partitions, and eventual exact proof.
- p95 final-to-durable admission ≤100 ms awake and ≤350 ms with one wake/reconnect.
- p95 durable admission-to-draft projection ≤200 ms while idle.
- p95 pause-to-write-block ≤100 ms.
- p95 ready Resume-to-submit invocation ≤200 ms.
- p95 correlated interruption-to-Stop invocation ≤150 ms.
- No fixed hot-path sleep; timers are watchdogs, debounce boundaries, or bounded verification loops.

## Verification

Use focused model/runtime/controller/dashboard tests, restart and migration tests, deterministic throughput tests, the complete Node/extension/AHK gate, and fresh isolated browser evidence on exact HEAD. Final HTML remains last.