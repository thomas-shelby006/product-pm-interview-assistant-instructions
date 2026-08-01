# PMIA Lossless Runtime Hardening Cycles 11-20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PMIA 0.7.0 lossless runtime release-ready under concurrency, sequence gaps, restart replay, storage pressure, and live operator use.

**Architecture:** Keep the existing sender outbox, session delivery ledger, receiver batch runtime, and Runtime Pilot as the only state owners. Add focused helpers for session mutation serialization, contiguous sequence admission, quota accounting, readiness derivation, and recovery-state reconciliation. Do not add a second queue, pending registry slot, or foreground browser-control path.

**Tech Stack:** Manifest V3 extension JavaScript, Node test runner, AutoHotkey v2 launcher, Microsoft Edge Stable, `chrome.storage.session`.

## Global Constraints

- Preserve every unique authoritative final until verified rendered proof or confirmed operator archive.
- Ordinary finals never stop an active receiver answer.
- Do not focus or activate provider tabs.
- Keep sensitive setup and question text out of disk-backed storage.
- Work only in `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement`.
- Do not push, merge, tag, install over the active runtime, or change the original checkout.
- Author tests cycle by cycle; defer executable verification until Task 20.

---


## Mandatory three-bucket cycle contract

Every Task 11-20 must deliver and document all three categories below before its commit:

- **Bug fixes:** correct a concrete defect in the existing system.
- **New features:** introduce one useful live operator capability tied to that defect/risk.
- **Implementation:** improve the owning architecture, speed, reliability, cleanup, or maintainability.

The per-cycle feature additions are: verification diagnostics, operation activity, Gap Watch, Outbox Retry, Batch Proof Inspector, Memory Guard, Readiness Gate, Runtime Efficiency, Recovery Progress, and Safe Health Report. These surfaces derive from existing authoritative state; none becomes a new state owner.

---

### Task 11: Repair the verification contract

**Files:**
- Modify: `runtime/extension/tests/validation.test.js`
- Modify: `runtime/extension/tests/dashboard-model.test.js`
- Modify: `runtime/extension/tests/dashboard-usability.test.js`
- Modify: `runtime/extension/tests/release-0.7.0.test.js`
- Modify: `runtime/extension/tests/runtime.test.js`
- Modify: `runtime/extension/tests/sequence.test.js`
- Modify: `runtime/extension/tests/preview.test.js`
- Modify: `runtime/extension/tests/lossless-burst.test.js`
- Modify: `runtime/extension/tests/preflight-responder.test.js`
- Modify: `runtime/extension/content/adapter-health.js` only if a production capability mismatch is confirmed.

**Produces:** A syntactically valid test suite whose assertions describe ledger, batch, archive, and current receiver semantics.

- [x] Replace malformed string literals in `validation.test.js` with `join('\n')`.
- [x] Replace deleted discard/supersede control assertions with `archiveSelected`, `archiveProven`, and `archiveAll` confirmations.
- [x] Assert warning codes separately from warning label rendering.
- [x] Update release documentation assertions to current Runtime Pilot terminology.
- [x] Replace legacy stop-generation and direct-provider-delivery sequence assertions with batch-runtime admission and explicit interrupt-only assertions.
- [x] Fix burst fixtures so each persisted final uses the current ledger schema and proof path.
- [x] Source-review all edits without executing tests.
- [x] Commit as `test: align release gate with lossless runtime`.

### Task 12: Serialize per-session mutations

**Files:**
- Create: `runtime/extension/shared/session-mutation-coordinator.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/background.js`
- Test: `runtime/extension/tests/session-mutation-coordinator.test.js`
- Test: `runtime/extension/tests/runtime-pilot-controller.test.js`

**Interfaces:**
- Produces: `createSessionMutationCoordinator()` with `run(sessionId, operation)` and `pending(sessionId)`.

- [x] Write tests for same-session FIFO ordering, cross-session concurrency, rejection recovery, and no stale outer-state overwrite.
- [x] Implement a keyed promise tail that removes settled lanes.
- [x] Route controller commands, telemetry transitions, reconciliation, and end-session cleanup through one session lane.
- [x] Ensure one command loads registry/state once and commits once.
- [x] Source-review for nested coordinator deadlocks.
- [x] Commit as `fix: serialize session state mutations`.

### Task 13: Admit receiver sequences contiguously

**Files:**
- Create: `runtime/extension/shared/contiguous-sequence-buffer.js`
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/receiver-batch-runtime.js`
- Modify: `runtime/extension/shared/delivery-reconciler.js`
- Test: `runtime/extension/tests/contiguous-sequence-buffer.test.js`
- Test: `runtime/extension/tests/sequence.test.js`

**Interfaces:**
- Produces: `createContiguousSequenceBuffer({ lastAcceptedSeq, maxBuffered, gapTimeoutMs })` with `offer(envelope)`, `drain()`, `snapshot()`, and `restore(snapshot)`.

- [x] Write tests for in-order delivery, duplicate acknowledgement, 3-before-2 buffering, gap refill, bounded buffer rejection without deletion, and restart restore.
- [x] Admit only the next expected sequence to the batch runtime.
- [x] Keep higher sequences in the safe checkpoint and request ledger refill after gap timeout.
- [x] Return explicit `buffered_gap` and `duplicate_ack` outcomes.
- [x] Source-review that no buffered final is archived or discarded.
- [x] Commit as `fix: preserve out-of-order receiver finals`.

### Task 14: Harden sender outbox replay

**Files:**
- Modify: `runtime/extension/content/sender-outbox.js`
- Modify: `runtime/extension/content/runtime-role-port.js`
- Modify: `runtime/extension/content/runtime.js`
- Test: `runtime/extension/tests/sender-outbox.test.js`
- Test: `runtime/extension/tests/runtime-role-port.test.js`

**Interfaces:**
- Produces: ordered `replayPending()` and capped `nextRetryDelay(attempt, random)` behavior.

- [x] Write tests for persisted acknowledgement removal, receiver-only failure retention, reload restoration, sequence-order replay, capped jitter, and immediate reset after healthy port acknowledgement.
- [x] Separate service-worker persistence acknowledgement from receiver proof.
- [x] Replay only unpersisted entries; never duplicate persisted ledger ownership.
- [x] Add one timer per outbox, not one timer per final.
- [x] Source-review sessionStorage keys and cleanup.
- [x] Commit as `fix: harden sender outbox replay`.

### Task 15: Make batch proof idempotent

**Files:**
- Modify: `runtime/extension/shared/batch-planner.js`
- Modify: `runtime/extension/content/receiver-batch-runtime.js`
- Modify: `runtime/extension/shared/delivery-ledger.js`
- Modify: `runtime/extension/shared/delivery-reconciler.js`
- Test: `runtime/extension/tests/batch-planner.test.js`
- Test: `runtime/extension/tests/receiver-batch-runtime.test.js`
- Test: `runtime/extension/tests/delivery-ledger.test.js`

**Interfaces:**
- Produces: stable batch fingerprint, member-set equality, and repeatable `markBatchProven(batchId, proof)`.

- [x] Write tests for duplicate stage, duplicate submit callback, duplicate rendered proof, reordered member arrays, partial proof rejection, and replay after reload.
- [x] Freeze active batch membership and fingerprint before composer submission.
- [x] Treat repeated matching proof as success without incrementing metrics twice.
- [x] Reject mismatched or partial proof while preserving all members unresolved.
- [x] Source-review that proof closes only verified rendered members.
- [x] Commit as `fix: make receiver batch proof idempotent`.

### Task 16: Add quota-aware backpressure

**Files:**
- Modify: `runtime/extension/shared/storage-pressure.js`
- Modify: `runtime/extension/shared/runtime-pilot-store.js`
- Modify: `runtime/extension/shared/delivery-ledger.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Test: `runtime/extension/tests/storage-pressure.test.js`
- Test: `runtime/extension/tests/runtime-pilot-store.test.js`

**Interfaces:**
- Produces: `classifyStorageUsage(usage)` and `buildCompactionPlan(state, targetBytes)`.

- [x] Write tests for normal/warn/high/critical classification, safe compaction order, actionable-text protection, and acknowledgement withholding at critical pressure.
- [x] Measure registry, actionable ledger, proven detail, telemetry, and snapshots separately.
- [x] Compact expired telemetry, redundant snapshots, then proven detail; never actionable entries.
- [x] Return `persisted: false, error: 'storage_pressure'` when the safety write cannot complete.
- [x] Source-review that sender outbox remains owner on failed persistence.
- [x] Commit as `fix: protect lossless delivery under storage pressure`.

### Task 17: Add the Pilot Readiness Gate

**Files:**
- Create: `runtime/extension/dashboard/readiness-model.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Test: `runtime/extension/tests/readiness-model.test.js`
- Test: `runtime/extension/tests/dashboard-usability.test.js`

**Interfaces:**
- Produces: `deriveReadiness(snapshot, now)` returning `{ state, label, blockers, actions }`.

- [x] Write tests for ready, sender missing, receiver stale, adapter incomplete, context unarmed, storage critical, repairing, and disconnected states.
- [x] Render one decisive Ready / Not ready / Repairing card with exact blockers.
- [x] Link blockers to existing Check Live and Repair commands without new provider focus operations.
- [x] Add `aria-live` status and keyboard-safe focus order.
- [x] Source-review narrow-window overflow and destructive-action confirmations.
- [x] Commit as `feat: add interview readiness gate`.

### Task 18: Reduce steady-state work

**Files:**
- Modify: `runtime/extension/shared/telemetry-coalescer.js`
- Create: `runtime/extension/shared/snapshot-delta.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Test: `runtime/extension/tests/telemetry-coalescer.test.js`
- Test: `runtime/extension/tests/snapshot-delta.test.js`

**Interfaces:**
- Produces: `buildSnapshotDelta(previous, next)` and `applySnapshotDelta(current, delta)`.

- [x] Write tests for heartbeat-only coalescing, semantic-change delivery, batch checkpoint change, timeline append, and delta round-trip.
- [x] Broadcast deltas after the initial full snapshot.
- [x] Persist semantic changes immediately and transient heartbeats on the existing coalesced schedule.
- [x] Skip dashboard rerenders for unchanged sections.
- [x] Source-review for dropped warnings or stale readiness state.
- [x] Commit as `perf: reduce steady-state Pilot work`.

### Task 19: Harden recovery state transitions

**Files:**
- Create: `runtime/extension/shared/recovery-state-machine.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/content/runtime-recovery.js`
- Modify: `runtime/extension/shared/delivery-reconciler.js`
- Test: `runtime/extension/tests/recovery-state-machine.test.js`
- Test: `runtime/extension/tests/runtime-recovery.test.js`

**Interfaces:**
- Produces: `transitionRecovery(state, event, now)` with explicit `healthy`, `degraded`, `repairing`, and `blocked` phases.

- [x] Write tests for role disconnect, repair request, one-role recovery, full recovery, repeated failure, storage block, and timeout.
- [x] Keep Repairing until both roles, adapters, ledger reconciliation, and batch checkpoint are healthy.
- [x] Prevent heartbeat-only telemetry from clearing a semantic blocker.
- [x] Emit one recovery timeline transition per phase change.
- [x] Source-review that repair never focuses provider tabs.
- [x] Commit as `fix: make runtime recovery state explicit`.

### Task 20: Release hardening and consolidated verification

**Files:**
- Modify: `runtime/extension/scripts/validate-extension.mjs`
- Modify: `runtime/Validate_Extension_Runtime.ps1`
- Modify: `README.md`
- Modify: `AI_SYSTEM_CONTEXT.md`
- Modify: `runtime/README_INSTALL_TEST.md`
- Modify: `runtime/extension/README.md`
- Modify: `docs/CURRENT_STATUS_DASHBOARD.md`
- Modify: `docs/LOSSLESS_DELIVERY_ITERATIVE_IMPROVEMENT_LOG.md`
- Create: `docs/LOSSLESS_RUNTIME_HARDENING_CYCLES_11_20_LOG.md`
- Create: `docs/evidence/2026-08-01-pmia-runtime-v0.7-lossless-hardening-verification.md`

- [ ] Add every new production module to validation/import reachability.
- [ ] Document Cycles 11-20, readiness behavior, exact recovery states, and storage backpressure.
- [ ] Run `git diff --check`, import reachability, and active-doc stale-term scans.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1` and save complete output.
- [ ] Fix failures at the owning boundary and rerun the complete gate until green.
- [ ] Read `BROWSER_EVIDENCE_CAPTURE_PROFILE.md`, then run isolated synthetic browser proof for supported scenarios without touching normal Edge windows.
- [ ] Record exact automated and browser evidence, limitations, branch, commit, and original-checkout status.
- [ ] Commit as `chore: verify lossless runtime hardening`.
