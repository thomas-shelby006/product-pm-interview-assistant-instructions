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

- [ ] Write ledger tests for ID/sequence dedupe, repeated identical wording at later sequence, no count eviction, retry states, proof archive, and quota-write rejection.
- [ ] Write sender-outbox tests proving a final remains until `persisted: true` and replays after port/message failure.
- [ ] Implement immutable ledger transitions and compact proven-history aggregates.
- [ ] Change sender forwarding acknowledgement from delivered to persisted ownership.
- [ ] Add storage byte-pressure telemetry using `getBytesInUse`.
- [ ] Remove automatic oldest-item dropping from the authoritative path.
- [ ] Review source and diff without executing tests.
- [ ] Commit `feat: add lossless delivery ledger and sender outbox`.

### Task 2: Non-preemptive receiver batch scheduler

**Files:** Create `shared/batch-planner.js`, `content/receiver-batch-runtime.js`; modify receiver orchestration and tests.

**Interfaces:** `BatchPlanner.add(entry)`, `freezeNext()`, `completeActive(proof)`, `setHold(value)`, `snapshot()`; receiver accepts complete batch snapshots rather than independent stop-and-submit calls.

- [ ] Write tests for one active batch plus one accumulating next batch.
- [ ] Prove arrivals during generation append to next batch and never mutate active submission.
- [ ] Implement event-driven idle scheduling with a bounded watchdog.
- [ ] Mirror next batch to the composer while generation continues.
- [ ] Preserve existing explicit stop capability only for the new interrupt command.
- [ ] Remove default stop-generation/supersede behavior for ordinary finals.
- [ ] Review source and diff without executing tests.
- [ ] Commit `feat: accumulate finals behind active receiver answers`.

### Task 3: Deterministic multi-question prompt and proof mapping

**Files:** Modify `batch-planner.js`, receiver runtime, proof telemetry, Pilot state, export schema, and tests.

**Interfaces:** `composeBatchPrompt({ context, entries })` returns `{ text, memberIds, focusId, questionCount, fingerprint }`.

- [ ] Write exact prompt tests for zero, one, and multiple pending questions.
- [ ] Mark the latest question and add the latest-focus instruction only when multiple finals exist.
- [ ] Freeze member IDs and fingerprint before submission.
- [ ] Map one rendered user-turn proof to every batch member.
- [ ] Reconcile existing rendered batch turns after receiver reload.
- [ ] Surface per-member batch proof in Pilot state and export.
- [ ] Review source and diff without executing tests.
- [ ] Commit `feat: submit deterministic latest-focused question batches`.

### Task 4: Fast long-lived runtime ports

**Files:** Create `shared/runtime-port-hub.js`; modify `background.js`, `entry.js`, manifest contracts, and tests.

**Interfaces:** named ports `pmia-role:<session>:<role>:<instance>` carrying `final`, `persisted`, `batch_snapshot`, `receiver_event`, and `heartbeat_patch` messages.

- [ ] Write port lifecycle tests for connect, disconnect, duplicate frames, reconnect, and fallback.
- [ ] Implement sender and receiver ports without relying on them as state storage.
- [ ] Use the port fast path for finals and batch snapshots.
- [ ] Keep one-time messages as idempotent fallback after disconnect.
- [ ] Fail pending port requests immediately and replay from ledger/outbox.
- [ ] Coalesce heartbeats without delaying finals or proofs.
- [ ] Review source and diff without executing tests.
- [ ] Commit `perf: add direct runtime ports with lossless fallback`.

### Task 5: Immediate sender finalization and preview arbitration

**Files:** Modify sender tracker, ChatGPT/Claude adapters, preview scheduler, receiver draft runtime, and tests.

- [ ] Add tests for immediate final emission when a new rendered user turn appears.
- [ ] Retain stable-tail fallback only where no rendered turn boundary exists.
- [ ] Prevent previews from replacing a persisted batch or manual receiver edit.
- [ ] Detect receiver composer divergence and raise a draft-conflict state.
- [ ] Reduce safe finalization and delivery delays based on rendered semantic evidence.
- [ ] Review source and diff without executing tests.
- [ ] Commit `perf: forward rendered sender turns immediately`.

### Task 6: Restart reconciliation and storage pressure

**Files:** Modify ledger store/controller, registration recovery, receiver runtime, Pilot warnings, and tests.

- [ ] Write worker-restart, sender-reload, receiver-reload, and interrupted-submit reconciliation tests.
- [ ] Reconstruct ledger, batches, and ports from session storage and runtime telemetry.
- [ ] Query rendered receiver turns before retrying an uncertain active batch.
- [ ] Add 70/85/95 percent storage-pressure states and proven-history compaction.
- [ ] Keep unpersisted finals in sender outbox when storage writes reject.
- [ ] Add dashboard recovery actions scoped to exact blocked state.
- [ ] Review source and diff without executing tests.
- [ ] Commit `fix: reconcile lossless delivery across runtime restarts`.

### Task 7: Pilot Live Inbox redesign

**Files:** Create `dashboard/live-inbox-model.js`; modify dashboard HTML, CSS, JS, dashboard model, and tests.

- [ ] Add model tests for live inbox grouping, active/next batch, latency milestones, catch-up state, and warnings.
- [ ] Replace queue-first layout with Live Inbox, Current Answer, Next Draft, and Latency Rail.
- [ ] Preserve compact health cards and every existing control.
- [ ] Display exact counts and states without requiring provider-window focus.
- [ ] Make the layout responsive for narrow third-window and dashboard-only modes.
- [ ] Keep full setup context out of dashboard diagnostics.
- [ ] Review source and diff without executing tests.
- [ ] Commit `feat: redesign Pilot around live delivery truth`.

### Task 8: Real-time operator controls

**Files:** Modify dashboard protocol/controller/UI, batch planner/runtime, status overlays, and tests.

- [ ] Add commands for auto-submit, hold-after-answer, interrupt-latest, submit-now, copy-latest, and archive-selected.
- [ ] Preserve earlier finals when interrupting; only the latest moves to the interrupt batch.
- [ ] Confirm destructive archive actions and retain audit state.
- [ ] Add keyboard shortcuts that use the same semantic command path.
- [ ] Show command acknowledgement and resulting authoritative state.
- [ ] Review source and diff without executing tests.
- [ ] Commit `feat: add live batch controls to Runtime Pilot`.

### Task 9: Architecture cleanup and stale-code removal

**Files:** Split `runtime-pilot-controller.js` and `entry.js` responsibilities; remove obsolete queue/supersede paths; update imports, manifest, validator, docs, and tests.

- [ ] Inventory every production module and exported symbol referenced by manifest or imports.
- [ ] Move command routing, port routing, ledger orchestration, and repair into focused modules.
- [ ] Remove the dropping OperatorQueue after compatibility migration.
- [ ] Remove default supersede-on-generation code and duplicated command implementations.
- [ ] Remove unused imports, obsolete tests, stale documentation, and dead compatibility branches.
- [ ] Keep public extension messages and export schema backward compatible where still active.
- [ ] Review source, dependency graph, and diff without executing tests.
- [ ] Commit `refactor: simplify lossless runtime ownership boundaries`.

### Task 10: Performance hardening and final verification

**Files:** Modify latency constants, validator, release docs, improvement ledger, implementation plan checkboxes, and any failing owner-boundary code.

- [ ] Add final scenarios for rapid sequential finals, accumulation during generation, multiple-question latest focus, duplicates, hold/resume, interrupt, worker restart, receiver reload, quota rejection, and dashboard reconnect.
- [ ] Review all timeouts and replace avoidable polling with semantic events plus bounded watchdogs.
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
