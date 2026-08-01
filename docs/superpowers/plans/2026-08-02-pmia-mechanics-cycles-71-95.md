# PMIA Mechanics Hardening Cycles 71–95 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned recovery-safe state, indexed lossless delivery, lower-cost snapshots, bounded degraded mode, and deterministic release evidence without replacing the proven PMIA transport.

**Architecture:** Small pure modules own schema, indexes, policies, diagnosis, and evidence. Existing authorities remain: `RuntimePilotStore` persists, `DeliveryLedger` owns final state, `BatchPlanner` owns active/next batches, provider adapters own DOM actions, and Pilot renders derived truth.

**Tech Stack:** Manifest V3 JavaScript modules, Node test runner, PowerShell 5.1-compatible scripts, AutoHotkey v2, Chrome/Edge extension APIs, CDP isolated smoke.

## Global Constraints

- No alternate delivery transport or prompt rewriting.
- No provider activation or normal-profile automation.
- No disk-backed prompt, answer, resume, JD, transcript, or session-content persistence.
- Final ownership and rendered proof remain durable-immediate.
- Explicit hold, exact sequence order, and active answer remain authoritative.
- Each cycle uses red-green TDD and ends with a commit.
- HTML remains untouched until Cycle 95 and final verification are complete.

---

### Task 71: Versioned Runtime State Envelope

**Files:** Create `runtime/extension/shared/runtime-state-schema.js`; modify `runtime-pilot-store.js`; test `runtime-state-schema.test.js`.
**Interfaces:** `normalizeRuntimeEnvelope(raw, metadata) -> {ok, envelope, legacy, reason}`; `encodeRuntimeEnvelope(sessions, metadata) -> envelope`.
- [ ] Write tests for legacy array normalization and schema-2 encoding with `schemaVersion`, `writerVersion`, `committedAt`, and `sessions`.
- [ ] Run `node --test runtime/extension/tests/runtime-state-schema.test.js` and confirm missing-module failure.
- [ ] Implement immutable envelope normalization; reject non-array `sessions`.
- [ ] Store schema-2 envelopes while preserving legacy-array reads.
- [ ] Re-run the focused test and `runtime-pilot-store.test.js`.
- [ ] Commit: `feat: version runtime state envelope`.

### Task 72: Ordered State Migration Registry

**Files:** Create `runtime/extension/shared/runtime-state-migrations.js`; modify `runtime-state-schema.js`, `runtime-pilot-store.js`; test `runtime-state-migrations.test.js`.
**Interfaces:** `migrateRuntimeEnvelope(envelope, targetVersion) -> {ok, envelope, applied, reason}`.
- [ ] Write tests for schema 1→2, idempotent schema 2, missing migration, and future-schema rejection.
- [ ] Run the focused test and confirm failure.
- [ ] Implement an ordered migration map with exact source/target versions.
- [ ] Make store hydration migrate before invariants and never overwrite a future schema.
- [ ] Re-run migration, schema, and store tests.
- [ ] Commit: `feat: add ordered runtime state migrations`.

### Task 73: Last-Known-Good State Quarantine

**Files:** Create `runtime/extension/shared/state-quarantine.js`; modify `runtime-pilot-store.js`; test `state-quarantine.test.js`.
**Interfaces:** `createStateQuarantine(record, reason, now) -> safe session-storage record`; `selectRecoverableState(current, previous, quarantine) -> decision`.
- [ ] Write tests for one bounded quarantine record, metadata-only audit, and non-overwrite of an existing blocked snapshot.
- [ ] Run the focused test and confirm failure.
- [ ] Implement clone-safe quarantine with reason, schema, digest, size, and captured state in `chrome.storage.session` only.
- [ ] Persist quarantine when migration or invariant validation blocks activation.
- [ ] Re-run quarantine, invariant, and store tests.
- [ ] Commit: `feat: quarantine blocked runtime state`.

### Task 74: State Integrity Digest and Compatibility Gate

**Files:** Create `runtime/extension/shared/state-integrity.js`; modify `runtime-state-schema.js`, `runtime-pilot-store.js`; test `state-integrity.test.js`.
**Interfaces:** `digestRuntimeEnvelope(envelope) -> eight-character canonical digest`; `verifyRuntimeEnvelope(envelope) -> {ok, expected, actual, reason}`.
- [ ] Write tests for key-order independence, content mutation detection, prior-generation recovery, and blocked digest mismatch.
- [ ] Run the focused test and confirm failure.
- [ ] Implement deterministic canonical serialization and digest calculation excluding the digest field itself.
- [ ] Verify before hydration; use previous applied state only when its digest is valid.
- [ ] Re-run integrity, commit-journal, schema, and store tests.
- [ ] Commit: `feat: verify runtime state integrity`.

### Task 75: State Compatibility Pilot Surface

**Files:** Create `runtime/extension/dashboard/state-compatibility-model.js`; modify `runtime-pilot-store.js`, `runtime-pilot-controller.js`, `dashboard/index.html`, `dashboard/dashboard.js`, `dashboard/dashboard.css`, `dashboard/health-report-model.js`; test `state-compatibility-model.test.js`, `dashboard-usability.test.js`.
**Interfaces:** store `audit()` adds `schema`, `migration`, `integrity`, `compatibility`; `deriveStateCompatibility(snapshot) -> {state,label,detail,nextAction}`.
- [ ] Write model and source-contract tests for compatible, migrated, recovered, future-schema, and digest-blocked states.
- [ ] Run focused tests and confirm failure.
- [ ] Expose metadata-only compatibility audit in snapshots and Safe Health Report.
- [ ] Add one compact Review card with state, schema path, digest result, and next action.
- [ ] Re-run compatibility, dashboard, health-report, and store tests.
- [ ] Commit: `feat: expose runtime state compatibility`.

### Task 76: Ledger Identity Indexes

**Files:** Create `runtime/extension/shared/delivery-ledger-index.js`; modify `delivery-ledger.js`; test `delivery-ledger-index.test.js`.
**Interfaces:** `DeliveryLedgerIndex` supports `byId(id)`, `bySequence(provider,seq)`, `insert(entry)`, `remove(entry)`, `rebuild(entries)`.
- [ ] Write tests for exact ID and provider-sequence lookup, duplicate detection, rebuild, and compaction removal.
- [ ] Run the focused test and confirm failure.
- [ ] Implement maps that reference ordered ledger entries without cloning content.
- [ ] Route `persist`, `get`, lease acquire/release, and item transitions through the index.
- [ ] Re-run ledger, lease, burst, and reconciliation tests.
- [ ] Commit: `perf: index ledger identity lookups`.

### Task 77: Batch and State Ledger Indexes

**Files:** Modify `delivery-ledger-index.js`, `delivery-ledger.js`; create `runtime/extension/shared/ledger-index-audit.js`; test `ledger-index-audit.test.js`.
**Interfaces:** index adds `idsForBatch(batchId)`, `idsForState(state)`, `counts()`, `audit(entries)`.
- [ ] Write tests for transition-safe batch/state membership, cached counts, mismatch detection, and deterministic rebuild.
- [ ] Run focused tests and confirm failure.
- [ ] Extend the index with batch and state sets updated after every accepted transition.
- [ ] Replace batch scans and `counts()` scans with indexed reads; rebuild after hydration and compaction.
- [ ] Re-run all delivery-ledger and runtime-invariant tests.
- [ ] Commit: `perf: index ledger batch and state views`.

### Task 78: Indexed Proof Reconciliation

**Files:** Create `runtime/extension/shared/proof-reconciliation-index.js`; modify `content/receiver-batch-runtime.js`; test `proof-reconciliation-index.test.js`, `receiver-batch-runtime.test.js`.
**Interfaces:** `buildRenderedProofIndex(messages) -> {matches(prompt), size}` using frozen prompt and member fingerprints.
- [ ] Write tests for exact frozen prompt match, normalization match, collision rejection, and one-pass message indexing.
- [ ] Run focused tests and confirm failure.
- [ ] Build one rendered-user index per reconcile call.
- [ ] Replace nested batch×message scanning while preserving exact proof identity.
- [ ] Re-run receiver reconciliation, proof, and lossless burst tests.
- [ ] Commit: `perf: index rendered proof reconciliation`.

### Task 79: Starvation-Free Delivery Deadline Queue

**Files:** Create `runtime/extension/shared/delivery-deadline-queue.js`; modify `batch-scheduling-policy.js`, `receiver-batch-runtime.js`; test `delivery-deadline-queue.test.js`.
**Interfaces:** `selectDuePartition(partitions,{now,hold,active}) -> {selected,reason,ageMs,deadlineAt}`.
- [ ] Write tests for oldest-deadline selection, stable member order, explicit hold, active-answer suppression, and tie breaking by sequence.
- [ ] Run focused tests and confirm failure.
- [ ] Implement a stable min-heap or sorted due list over partition metadata only.
- [ ] Use the result for the next eligible partition without changing planner membership order.
- [ ] Re-run scheduling, batching, interruption, and answer-lifecycle tests.
- [ ] Commit: `feat: schedule batches without starvation`.

### Task 80: Receiver Credit Hysteresis

**Files:** Create `runtime/extension/shared/receiver-credit-hysteresis.js`; modify `receiver-flow-control.js`, `content/entry.js`; test `receiver-credit-hysteresis.test.js`.
**Interfaces:** `ReceiverCreditHysteresis.update(rawCredits,{now,critical}) -> {credits,state,stableSince,reason}`.
- [ ] Write tests for immediate drop, delayed recovery, critical zero, no oscillation, and exact configured recovery window.
- [ ] Run focused tests and confirm failure.
- [ ] Implement stateful hysteresis over numeric credits and reason codes.
- [ ] Apply it before selective ACK feedback; never suppress ACK/NACK identity.
- [ ] Re-run flow-control, sequence, burst, and runtime entry tests.
- [ ] Commit: `feat: smooth receiver credit recovery`.

### Task 81: Canonical Semantic Fingerprints

**Files:** Create `runtime/extension/shared/canonical-fingerprint.js`; modify `snapshot-delta.js`, `telemetry-coalescer.js`; test `canonical-fingerprint.test.js`.
**Interfaces:** `canonicalFingerprint(value,{omitKeys}) -> string`; `canonicalize(value,{omitKeys}) -> JSON-safe value`.
- [ ] Write tests for key-order independence, volatile omission, array-order preservation, Unicode, and cyclic-value rejection.
- [ ] Run focused tests and confirm failure.
- [ ] Implement deterministic canonical traversal and FNV-1a digest.
- [ ] Replace repeated ad hoc stable-object/JSON string comparisons.
- [ ] Re-run snapshot-delta and telemetry-coalescer tests.
- [ ] Commit: `perf: canonicalize semantic fingerprints`.

### Task 82: Structural Snapshot Section Cache

**Files:** Create `runtime/extension/shared/snapshot-section-cache.js`; modify `runtime-pilot-controller.js`, `snapshot-delta.js`; test `snapshot-section-cache.test.js`.
**Interfaces:** `SnapshotSectionCache.update(snapshot) -> {snapshot,changedKeys,reusedKeys}`.
- [ ] Write tests for clone safety, reference reuse of unchanged sections, changed-key detection, removal, and reset.
- [ ] Run focused tests and confirm failure.
- [ ] Cache fingerprints and immutable clones per top-level key.
- [ ] Use cached sections before building dashboard deltas; keep full snapshots on first connection.
- [ ] Re-run controller, snapshot-delta, dashboard lifecycle, and efficiency tests.
- [ ] Commit: `perf: reuse unchanged snapshot sections`.

### Task 83: Cached Ledger Views

**Files:** Modify `delivery-ledger-index.js`, `delivery-ledger.js`; test `delivery-ledger-view-cache.test.js`.
**Interfaces:** index exposes clone-safe `view(stateGroup)` and `viewStats()` with hit/miss counters.
- [ ] Write tests for unresolved, pending, proven, cache invalidation, and clone isolation.
- [ ] Run focused tests and confirm failure.
- [ ] Cache ordered ID lists by state group and invalidate only affected groups.
- [ ] Route `unresolved`, `pending`, `proven`, `size`, and snapshot counts through cached views.
- [ ] Re-run ledger, storage-accounting, Pilot state, and memory-guard tests.
- [ ] Commit: `perf: cache ledger state views`.

### Task 84: Persistence Urgency Policy

**Files:** Create `runtime/extension/shared/persistence-urgency-policy.js`; modify `runtime-pilot-controller.js`; test `persistence-urgency-policy.test.js`, `runtime-pilot-controller.test.js`.
**Interfaces:** `classifyPersistence(event) -> immediate|coalesced|heartbeat`; `createCoalescedCommitLane({commit,delayMs})` with `schedule`, `flush`, `cancel`.
- [ ] Write tests proving final persistence/proof/session end are immediate and telemetry/checkpoints coalesce without crossing sessions.
- [ ] Run focused tests and confirm failure.
- [ ] Implement pure classification and one timer per session.
- [ ] Replace scattered preview/batch semantic timers with the lane; flush before end, export, or destructive actions.
- [ ] Re-run controller, storage-failure, preview, batch, and session-end tests.
- [ ] Commit: `perf: classify and coalesce safe persistence`.

### Task 85: Runtime Performance Budget

**Files:** Create `runtime/extension/shared/runtime-performance-budget.js`; modify `runtime-pilot-state.js`, `dashboard/index.html`, `dashboard/dashboard.js`, `health-report-model.js`; test `runtime-performance-budget.test.js`, `dashboard-usability.test.js`.
**Interfaces:** `RuntimePerformanceBudget.record(sample)`; `snapshot() -> {state,operations,bytes,cacheHitRate,violations}`.
- [ ] Write deterministic operation-count tests for 10,000 ledger entries, 200 timeline events, and repeated unchanged snapshots.
- [ ] Run focused tests and confirm failure.
- [ ] Record index rebuilds, lookup scans, commit reasons, payload bytes, and cache hits without timing dependence.
- [ ] Add a compact Performance Budget card and safe report section.
- [ ] Re-run performance, dashboard, health-report, and large-burst tests.
- [ ] Commit: `feat: enforce runtime performance budgets`.

### Task 86: Provider Capability Probation

**Files:** Create `runtime/extension/content/capability-probation.js`; modify `adapter-capability-drift.js`, `runtime-telemetry.js`, `dashboard/readiness-model.js`; test `capability-probation.test.js`.
**Interfaces:** `CapabilityProbation.observe(report,now) -> {state,criticalSamples,healthySamples,writeSafe,reason}`.
- [ ] Write tests for transient loss, repeated critical loss, stable recovery, optional-surface loss, and exact thresholds.
- [ ] Run focused tests and confirm failure.
- [ ] Implement critical-sample and healthy-sample hysteresis over capability names only.
- [ ] Publish probation metadata; readiness blocks automatic writes only when `writeSafe` is false.
- [ ] Re-run adapter drift, telemetry, readiness, and provider adapter tests.
- [ ] Commit: `feat: add provider capability probation`.

### Task 87: Runtime Root-Cause Classifier

**Files:** Create `runtime/extension/shared/runtime-root-cause.js`; modify `dashboard/readiness-model.js`, `health-report-model.js`; test `runtime-root-cause.test.js`.
**Interfaces:** `classifyRuntimeRootCause(snapshot,now) -> {owner,code,severity,evidence,nextAction,suppressed}`.
- [ ] Write tests for precedence across state compatibility, storage, registration, transport, provider, sequence, batch, and proof.
- [ ] Run focused tests and confirm failure.
- [ ] Implement deterministic precedence and suppression of secondary symptoms.
- [ ] Use one root cause in readiness and Safe Health Report while retaining detailed warnings.
- [ ] Re-run readiness, diagnostics, health-report, and recovery tests.
- [ ] Commit: `feat: identify one runtime root cause`.

### Task 88: Recovery Escalation Matrix

**Files:** Create `runtime/extension/shared/recovery-escalation-policy.js`; modify `runtime-pilot-controller.js`; test `recovery-escalation-policy.test.js`, `runtime-pilot-controller.test.js`.
**Interfaces:** `selectRecoveryAction(rootCause,{budget,attempts,roleHealth}) -> {action,automatic,reason}`.
- [ ] Write tests for reconcile, reconnect, re-register, managed reload, queue-only, and operator handoff.
- [ ] Run focused tests and confirm failure.
- [ ] Implement one bounded action per root cause with recovery-budget enforcement.
- [ ] Replace broad repair loops with policy-selected action and reason-coded audit.
- [ ] Re-run controller, recovery-state, alarm, and registration-recovery tests.
- [ ] Commit: `refactor: make recovery cause driven`.

### Task 89: Queue-Only Degraded Mode

**Files:** Create `runtime/extension/shared/queue-only-policy.js`; modify `runtime-pilot-state.js`, `runtime-pilot-controller.js`, `content/entry.js`, `dashboard/dashboard.js`; test `queue-only-policy.test.js`.
**Interfaces:** `deriveQueueOnlyPolicy(snapshot,rootCause) -> {active,reason,resumeWhen}`; snapshot adds `deliveryPolicy`.
- [ ] Write tests for durable sender persistence, blocked receiver mutation, safe recovery, explicit hold interaction, and no content loss.
- [ ] Run focused tests and confirm failure.
- [ ] Persist queue-only policy as metadata and return staged ownership without provider writes.
- [ ] Resume only after compatibility and capability probation become healthy; show one Pilot banner.
- [ ] Re-run sender outbox, delivery, receiver, readiness, and dashboard tests.
- [ ] Commit: `feat: add safe queue only mode`.

### Task 90: No-Content Consistency Watchdog

**Files:** Create `runtime/extension/shared/consistency-watchdog.js`; modify `background.js`, `runtime-pilot-controller.js`; test `consistency-watchdog.test.js`.
**Interfaces:** `runConsistencyAudit({snapshot,storeAudit,registry,alarms,now}) -> {ok,repairs,blocked,reason}`.
- [ ] Write tests for startup, alarm wake, stale lease, missing alarm, index mismatch, and ambiguous batch block.
- [ ] Run focused tests and confirm failure.
- [ ] Implement metadata-only audit with deterministic repair instructions.
- [ ] Trigger on worker startup, managed alarm wake, and meaningful state commits; never poll provider content.
- [ ] Re-run background, alarm, invariant, recovery, and session cleanup tests.
- [ ] Commit: `feat: add runtime consistency watchdog`.

### Task 91: Test-Only Fault Scenario Harness

**Files:** Create `runtime/extension/testing/fault-scenario-runner.js`; test `fault-scenario-runner.test.js`; modify validator allow-list if required.
**Interfaces:** `runFaultScenario(name,steps,context) -> {ok,name,steps,failedAt,evidence}`; module is never imported by production entry points.
- [ ] Write tests for storage interruption, stale epoch, port loss, capability loss, sequence gap, and deterministic cleanup.
- [ ] Run focused tests and confirm failure.
- [ ] Implement explicit named steps with before/after snapshots and no global fault switch.
- [ ] Add validation proving no production module imports `runtime/extension/testing`.
- [ ] Re-run fault and validation tests.
- [ ] Commit: `test: add isolated fault scenario harness`.

### Task 92: Restart Continuity Scenario

**Files:** Create `runtime/extension/testing/restart-continuity-scenario.js`; test `restart-continuity-scenario.test.js`.
**Interfaces:** `runRestartContinuityScenario({state,outbox,registry,alarms}) -> {ok,before,after,checks}`.
- [ ] Write a failing scenario with committed ledger, pending outbox intent, recovery alarm, owner lease, and active/next batches.
- [ ] Run the focused test and confirm failure.
- [ ] Reconstruct store, registry, indexes, alarm audit, and batch checkpoint from serialized state.
- [ ] Assert exact identities, ordering, no duplicate ownership, and no lost wake intent.
- [ ] Re-run store, registry, alarm, batch, and outbox suites.
- [ ] Commit: `test: prove service worker restart continuity`.

### Task 93: Expanded No-Content Chaos Drill

**Files:** Modify `shared/transport-drill.js`, `runtime-pilot-controller.js`, `runtime/scripts/isolated-release-smoke.mjs`; test `transport-drill.test.js`, `isolated-release-smoke.test.js`.
**Interfaces:** drill adds `state_compatibility`, `index_audit`, `capability_probation`, `queue_only_policy`, and `restart_continuity` checks while retaining existing seven checks.
- [ ] Write tests for the expanded check set, content-access prohibition, and failed-stage reporting.
- [ ] Run focused tests and confirm failure.
- [ ] Add synthetic metadata-only checks using pure policy/audit modules.
- [ ] Update isolated smoke to require the exact expanded check count and save evidence.
- [ ] Re-run drill, smoke-source, controller, and privacy tests.
- [ ] Commit: `test: expand no content chaos drill`.

### Task 94: Safe Support Bundle

**Files:** Create `runtime/extension/shared/support-bundle.js`; modify `runtime-pilot-controller.js`, `dashboard-protocol.js`, `dashboard/index.html`, `dashboard/dashboard.js`; test `support-bundle.test.js`, `dashboard-usability.test.js`.
**Interfaces:** `buildSafeSupportBundle(snapshot,{manifest,sourceHashes}) -> metadata-only object`; command `export_support_bundle`.
- [ ] Write privacy tests that reject setup, question, answer, clipboard, credential, and raw URL content.
- [ ] Run focused tests and confirm failure.
- [ ] Include compatibility, root cause, lanes, audits, safe trace IDs, performance budget, drill, and checksums.
- [ ] Add one Review action that downloads the JSON through the existing content-safe download path.
- [ ] Re-run support, protocol, dashboard, export, and privacy tests.
- [ ] Commit: `feat: export safe runtime support bundle`.

### Task 95: Deterministic Release Evidence Manifest

**Files:** Create `runtime/scripts/build-release-evidence-manifest.mjs`; modify `runtime/Validate_Extension_Runtime.ps1`; test `release-evidence-manifest.test.js`, `validation.test.js`.
**Interfaces:** script accepts `--repo`, `--gate-log`, `--smoke-evidence`, `--output`; writes `{commit,version,sourceHashes,gate,smoke,cleanup,manifestHash}`.
- [ ] Write tests for stable hashes, missing evidence rejection, commit mismatch, smoke cleanup failure, and deterministic output.
- [ ] Run focused tests and confirm failure.
- [ ] Implement SHA-256 hashing with sorted relative paths and metadata-only evidence extraction.
- [ ] Add an optional final validator stage that generates and verifies the manifest after automated and smoke gates.
- [ ] Re-run release-evidence, validation, smoke-source, and packaging tests.
- [ ] Commit: `feat: generate deterministic release evidence`.

## Block review gates

- [ ] After Task 75: run schema, migration, quarantine, integrity, store, dashboard, and health-report suites; audit no content in compatibility metadata.
- [ ] After Task 80: run all ledger, batching, sequence, burst, proof, and flow-control suites; audit exact ordering and no hidden eviction.
- [ ] After Task 85: run snapshot, telemetry, controller, storage, dashboard, and performance suites; audit immediate durability for finals and proof.
- [ ] After Task 90: run provider, readiness, recovery, background, queue-only, and watchdog suites; audit no activation/focus paths.
- [ ] After Task 95: run fault, restart, drill, support, release-evidence, validation, and smoke-source suites.

## Final verification

- [ ] Run `runtime\Validate_Extension_Runtime.ps1` and record exact tests, JavaScript files, required surfaces, reachable modules, and exit code.
- [ ] Run the repository-owned isolated Edge smoke with fixed synthetic Q1–Q3.
- [ ] Verify exact proven ledger membership, outbox 0, clear gap, expanded no-content drill, restart continuity, and support-bundle privacy.
- [ ] Verify Pilot desktop and 320 CSS-pixel layouts with no horizontal overflow.
- [ ] Verify disposable process/profile cleanup and unchanged normal Edge tab handles.
- [ ] Write `docs/evidence/2026-08-02-pmia-cycles-71-95-verification.md` and preserve structured evidence/screenshots.
- [ ] Update `docs/ITERATIVE_IMPROVEMENT_LOG.md`, `docs/CURRENT_STATUS_DASHBOARD.md`, and this checklist.
- [ ] Re-run the complete validator on final committed HEAD.
- [ ] Verify original checkout clean and no push, merge, or tag.
- [ ] Only then update and validate the standalone technical HTML.
