# PMIA Lossless Delivery and Live Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Tests are authored during tasks but executed only in Task 10 per the user's explicit final-only verification constraint.

**Goal:** Deliver every non-duplicate sender final without automatic loss, accumulate questions behind an active receiver answer, submit deterministic latest-focused batches, and upgrade the Pilot for real-time operation.

**Architecture:** A sender outbox receives a persisted acknowledgement from a session-scoped delivery ledger. The service worker owns ledger and batch truth across suspension. The receiver owns only composer synchronization, submission, and rendered-turn proof for one immutable active batch plus one mutable next batch.

**Tech Stack:** Manifest V3, JavaScript ES modules, `chrome.storage.session`, runtime ports, ChatGPT/Claude semantic adapters, AutoHotkey v2, Node test runner.

## Global Constraints

- Do not activate, focus, foreground, or move provider windows during background work.
- Do not automatically drop, supersede, or evict a persisted non-duplicate final.
- Do not store Resume, JD, notes, or full setup context in disk-backed extension storage.
- Preserve all existing dashboard, shortcut, export, repair, layout, and privacy features.
- Write tests beside implementation but run no executable tests until Task 10.
- Commit each completed cycle locally; do not push, merge, or tag.

---

## File structure

- Create `runtime/extension/shared/delivery-ledger.js`: authoritative ledger transitions and deduplication.
- Create `runtime/extension/shared/batch-planner.js`: active/next batch state and prompt composition.
- Create `runtime/extension/shared/runtime-port-hub.js`: named role-port lifecycle and fallback.
- Create `runtime/extension/content/sender-outbox.js`: persisted acknowledgement and retry.
- Create `runtime/extension/content/receiver-batch-runtime.js`: composer draft, idle submit, and proof.
- Create `runtime/extension/dashboard/live-inbox-model.js`: derived Pilot inbox and latency view.
- Modify `background.js`, `entry.js`, Pilot state/controller/store, dashboard files, adapters, manifest, docs, and tests.

### Task 1: Lossless ledger and sender persisted acknowledgement

**Files:** Create `shared/delivery-ledger.js`, `content/sender-outbox.js`; modify `background.js`, `entry.js`, pilot store/state, and adjacent tests.

**Interfaces:** `DeliveryLedger.persist(envelope)`, `markStaged(ids)`, `markSubmitting(batchId)`, `markProven(batchId, proof)`, `retryable()`, `snapshot()`; `SenderOutbox.enqueue(envelope)`, `ackPersisted(id)`, `replay()`.

- [x] Write ledger tests for ID/sequence dedupe, repeated identical wording at later sequence, no count eviction, retry states, proof archive, and quota-write rejection.
- [x] Write sender-outbox tests proving a final remains until `persisted: true` and replays after port/message failure.
- [x] Implement immutable ledger transitions and compact proven-history aggregates.
- [x] Change sender forwarding acknowledgement from delivered to persisted ownership.
- [x] Add storage byte-pressure telemetry using `getBytesInUse`.
- [x] Remove automatic oldest-item dropping from the authoritative path.
- [x] Review source and diff without executing tests.
- [x] Commit `feat: add lossless delivery ledger and sender outbox`.

### Task 2: Non-preemptive receiver batch scheduler

**Files:** Create `shared/batch-planner.js`, `content/receiver-batch-runtime.js`; modify receiver orchestration and tests.

**Interfaces:** `BatchPlanner.add(entry)`, `freezeNext()`, `completeActive(proof)`, `setHold(value)`, `snapshot()`; receiver accepts complete batch snapshots rather than independent stop-and-submit calls.

- [x] Write tests for one active batch plus one accumulating next batch.
- [x] Prove arrivals during generation append to next batch and never mutate active submission.
- [x] Implement event-driven idle scheduling with a bounded watchdog.
- [x] Mirror next batch to the composer while generation continues.
- [x] Preserve existing explicit stop capability only for the new interrupt command.
- [x] Remove default stop-generation/supersede behavior for ordinary finals.
- [x] Review source and diff without executing tests.
- [x] Commit `feat: accumulate finals behind active receiver answers`.

### Task 3: Deterministic multi-question prompt and proof mapping

**Files:** Modify `batch-planner.js`, receiver runtime, proof telemetry, Pilot state, export schema, and tests.

**Interfaces:** `composeBatchPrompt({ context, entries })` returns `{ text, memberIds, focusId, questionCount, fingerprint }`.

- [x] Write exact prompt tests for zero, one, and multiple pending questions.
- [x] Mark the latest question and add the latest-focus instruction only when multiple finals exist.
- [x] Freeze member IDs and fingerprint before submission.
- [x] Map one rendered user-turn proof to every batch member.
- [x] Reconcile existing rendered batch turns after receiver reload.
- [x] Surface per-member batch proof in Pilot state and export.
- [x] Review source and diff without executing tests.
- [x] Commit `feat: submit deterministic latest-focused question batches`.

### Task 4: Fast long-lived runtime ports

**Files:** Create `shared/runtime-port-hub.js`; modify `background.js`, `entry.js`, manifest contracts, and tests.

**Interfaces:** named ports `pmia-role:<session>:<role>:<instance>` carrying `final`, `persisted`, `batch_snapshot`, `receiver_event`, and `heartbeat_patch` messages.

- [x] Write port lifecycle tests for connect, disconnect, duplicate frames, reconnect, and fallback.
- [x] Implement sender and receiver ports without relying on them as state storage.
- [x] Use the port fast path for finals and batch snapshots.
- [x] Keep one-time messages as idempotent fallback after disconnect.
- [x] Fail pending port requests immediately and replay from ledger/outbox.
- [x] Coalesce heartbeats without delaying finals or proofs.
- [x] Review source and diff without executing tests.
- [x] Commit `perf: add direct runtime ports with lossless fallback`.

### Task 5: Immediate sender finalization and preview arbitration

**Files:** Modify sender tracker, ChatGPT/Claude adapters, preview scheduler, receiver draft runtime, and tests.

- [x] Add tests for immediate final emission when a new rendered user turn appears.
- [x] Retain stable-tail fallback only where no rendered turn boundary exists.
- [x] Prevent previews from replacing a persisted batch or manual receiver edit.
- [x] Detect receiver composer divergence and raise a draft-conflict state.
- [x] Reduce safe finalization and delivery delays based on rendered semantic evidence.
- [x] Review source and diff without executing tests.
- [x] Commit `perf: forward rendered sender turns immediately`.

### Task 6: Restart reconciliation and storage pressure

**Files:** Modify ledger store/controller, registration recovery, receiver runtime, Pilot warnings, and tests.

- [x] Write worker-restart, sender-reload, receiver-reload, and interrupted-submit reconciliation tests.
- [x] Reconstruct ledger, batches, and ports from session storage and runtime telemetry.
- [x] Query rendered receiver turns before retrying an uncertain active batch.
- [x] Add 70/85/95 percent storage-pressure states and proven-history compaction.
- [x] Keep unpersisted finals in sender outbox when storage writes reject.
- [x] Add dashboard recovery actions scoped to exact blocked state.
- [x] Review source and diff without executing tests.
- [x] Commit `fix: reconcile lossless delivery across runtime restarts`.

### Task 7: Pilot Live Inbox redesign

**Files:** Create `dashboard/live-inbox-model.js`; modify dashboard HTML, CSS, JS, dashboard model, and tests.

- [x] Add model tests for live inbox grouping, active/next batch, latency milestones, catch-up state, and warnings.
- [x] Replace queue-first layout with Live Inbox, Current Answer, Next Draft, and Latency Rail.
- [x] Preserve compact health cards and every existing control.
- [x] Display exact counts and states without requiring provider-window focus.
- [x] Make the layout responsive for narrow third-window and dashboard-only modes.
- [x] Keep full setup context out of dashboard diagnostics.
- [x] Review source and diff without executing tests.
- [x] Commit `feat: redesign Pilot around live delivery truth`.

### Task 8: Real-time operator controls

**Files:** Modify dashboard protocol/controller/UI, batch planner/runtime, status overlays, and tests.

- [x] Add commands for auto-submit, hold-after-answer, interrupt-latest, submit-now, copy-latest, and archive-selected.
- [x] Preserve earlier finals when interrupting; only the latest moves to the interrupt batch.
- [x] Confirm destructive archive actions and retain audit state.
- [x] Add keyboard shortcuts that use the same semantic command path.
- [x] Show command acknowledgement and resulting authoritative state.
- [x] Review source and diff without executing tests.
- [x] Commit `feat: add live batch controls to Runtime Pilot`.

### Task 9: Architecture cleanup and stale-code removal

**Files:** Split `runtime-pilot-controller.js` and `entry.js` responsibilities; remove obsolete queue/supersede paths; update imports, manifest, validator, docs, and tests.

- [x] Inventory every production module and exported symbol referenced by manifest or imports.
- [x] Move command routing, port routing, ledger orchestration, and repair into focused modules.
- [x] Remove the dropping OperatorQueue after compatibility migration.
- [x] Remove default supersede-on-generation code and duplicated command implementations.
- [x] Remove unused imports, obsolete tests, stale documentation, and dead compatibility branches.
- [x] Keep public extension messages and export schema backward compatible where still active.
- [x] Review source, dependency graph, and diff without executing tests.
- [x] Commit `refactor: simplify lossless runtime ownership boundaries`.

### Task 10: Performance hardening and final verification

**Files:** Modify latency constants, validator, release docs, improvement ledger, implementation plan checkboxes, and any failing owner-boundary code.

- [x] Add final scenarios for rapid sequential finals, accumulation during generation, multiple-question latest focus, duplicates, hold/resume, interrupt, worker restart, receiver reload, quota rejection, and dashboard reconnect.
- [x] Review all timeouts and replace avoidable polling with semantic events plus bounded watchdogs.
- [ ] Run the complete Node suite once.
- [ ] Run extension validation and both AutoHotkey silent validators.
- [ ] Fix every failure at its owning boundary and rerun the entire gate from the beginning.
- [ ] Launch an isolated off-screen Edge profile with the candidate extension.
- [ ] Verify one-at-a-time delivery and accumulated multi-question delivery without foregrounding user windows.
- [ ] Verify exactly-once proof, no missing ledger entries, Pilot controls, responsive layout, and cleanup.
- [ ] Update release evidence and mark all plan/cycle items complete.
- [ ] Commit `feat: complete PMIA lossless live interview runtime`.

## Plan self-review

- Every non-negotiable invariant maps to Tasks 1 through 6.
- Pilot redesign and useful real-time features map to Tasks 7 and 8.
- Stale-code cleanup maps to Task 9 after compatibility migration, not before.
- Speed work appears in Tasks 4, 5, and 10 and cannot weaken persistence or proof.
- Final-only executable verification is isolated to Task 10.
- No placeholders or unresolved interface names remain.
