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

- [ ] Replace malformed string literals in `validation.test.js` with `join('\n')`.
- [ ] Replace deleted discard/supersede control assertions with `archiveSelected`, `archiveProven`, and `archiveAll` confirmations.
- [ ] Assert warning codes separately from warning label rendering.
- [ ] Update release documentation assertions to current Runtime Pilot terminology.
- [ ] Replace legacy stop-generation and direct-provider-delivery sequence assertions with batch-runtime admission and explicit interrupt-only assertions.
- [ ] Fix burst fixtures so each persisted final uses the current ledger schema and proof path.
- [ ] Source-review all edits without executing tests.
- [ ] Commit as `test: align release gate with lossless runtime`.

### Task 12: Serialize per-session mutations

**Files:**
- Create: `runtime/extension/shared/session-mutation-coordinator.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/background.js`
- Test: `runtime/extension/tests/session-mutation-coordinator.test.js`
- Test: `runtime/extension/tests/runtime-pilot-controller.test.js`

**Interfaces:**
- Produces: `createSessionMutationCoordinator()` with `run(sessionId, operation)` and `pending(sessionId)`.

- [ ] Write tests for same-session FIFO ordering, cross-session concurrency, rejection recovery, and no stale outer-state overwrite.
- [ ] Implement a keyed promise tail that removes settled lanes.
- [ ] Route controller commands, telemetry transitions, reconciliation, and end-session cleanup through one session lane.
- [ ] Ensure one command loads registry/state once and commits once.
- [ ] Source-review for nested coordinator deadlocks.
- [ ] Commit as `fix: serialize session state mutations`.

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

- [ ] Write tests for in-order delivery, duplicate acknowledgement, 3-before-2 buffering, gap refill, bounded buffer rejection without deletion, and restart restore.
- [ ] Admit only the next expected sequence to the batch runtime.
- [ ] Keep higher sequences in the safe checkpoint and request ledger refill after gap timeout.
- [ ] Return explicit `buffered_gap` and `duplicate_ack` outcomes.
- [ ] Source-review that no buffered final is archived or discarded.
- [ ] Commit as `fix: preserve out-of-order receiver finals`.

### Task 14: Harden sender outbox replay

**Files:**
- Modify: `runtime/extension/content/sender-outbox.js`
- Modify: `runtime/extension/content/runtime-role-port.js`
- Modify: `runtime/extension/content/runtime.js`
- Test: `runtime/extension/tests/sender-outbox.test.js`
- Test: `runtime/extension/tests/runtime-role-port.test.js`

**Interfaces:**
- Produces: ordered `replayPending()` and capped `nextRetryDelay(attempt, random)` behavior.

- [ ] Write tests for persisted acknowledgement removal, receiver-only failure retention, reload restoration, sequence-order replay, capped jitter, and immediate reset after healthy port acknowledgement.
- [ ] Separate service-worker persistence acknowledgement from receiver proof.
- [ ] Replay only unpersisted entries; never duplicate persisted ledger ownership.
- [ ] Add one timer per outbox, not one timer per final.
- [ ] Source-review sessionStorage keys and cleanup.
- [ ] Commit as `fix: harden sender outbox replay`.

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

- [ ] Write tests for duplicate stage, duplicate submit callback, duplicate rendered proof, reordered member arrays, partial proof rejection, and replay after reload.
- [ ] Freeze active batch membership and fingerprint before composer submission.
- [ ] Treat repeated matching proof as success without incrementing metrics twice.
- [ ] Reject mismatched or partial proof while preserving all members unresolved.
- [ ] Source-review that proof closes only verified rendered members.
- [ ] Commit as `fix: make receiver batch proof idempotent`.

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

- [ ] Write tests for normal/warn/high/critical classification, safe compaction order, actionable-text protection, and acknowledgement withholding at critical pressure.
- [ ] Measure registry, actionable ledger, proven detail, telemetry, and snapshots separately.
- [ ] Compact expired telemetry, redundant snapshots, then proven detail; never actionable entries.
- [ ] Return `persisted: false, error: 'storage_pressure'` when the safety write cannot complete.
- [ ] Source-review that sender outbox remains owner on failed persistence.
- [ ] Commit as `fix: protect lossless delivery under storage pressure`.

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

- [ ] Write tests for ready, sender missing, receiver stale, adapter incomplete, context unarmed, storage critical, repairing, and disconnected states.
- [ ] Render one decisive Ready / Not ready / Repairing card with exact blockers.
- [ ] Link blockers to existing Check Live and Repair commands without new provider focus operations.
- [ ] Add `aria-live` status and keyboard-safe focus order.
- [ ] Source-review narrow-window overflow and destructive-action confirmations.
- [ ] Commit as `feat: add interview readiness gate`.

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

- [ ] Write tests for heartbeat-only coalescing, semantic-change delivery, batch checkpoint change, timeline append, and delta round-trip.
- [ ] Broadcast deltas after the initial full snapshot.
- [ ] Persist semantic changes immediately and transient heartbeats on the existing coalesced schedule.
- [ ] Skip dashboard rerenders for unchanged sections.
- [ ] Source-review for dropped warnings or stale readiness state.
- [ ] Commit as `perf: reduce steady-state Pilot work`.

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

- [ ] Write tests for role disconnect, repair request, one-role recovery, full recovery, repeated failure, storage block, and timeout.
- [ ] Keep Repairing until both roles, adapters, ledger reconciliation, and batch checkpoint are healthy.
- [ ] Prevent heartbeat-only telemetry from clearing a semantic blocker.
- [ ] Emit one recovery timeline transition per phase change.
- [ ] Source-review that repair never focuses provider tabs.
- [ ] Commit as `fix: make runtime recovery state explicit`.

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
