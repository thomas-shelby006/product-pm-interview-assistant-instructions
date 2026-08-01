# PMIA Reliability Cycles 31–45 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Separate rendered delivery proof from answer lifecycle, eliminate stale/noisy runtime state, decompose the affected orchestration owners, and add a repeatable isolated-browser release gate.

**Architecture:** The lossless ledger remains the sole delivery authority. New pure models own generation truth, answer lifecycle, timeout policy, recovery-event coalescing, registration heartbeat state, and verification trust. Focused coordinators integrate those models into the existing content, service-worker, and dashboard paths without adding a second runtime.

**Tech Stack:** Manifest V3 extension, modern JavaScript modules, Node test runner, PowerShell 5.1-compatible release tooling, AutoHotkey v2, Microsoft Edge Stable.

## Global Constraints

- Work only in `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement` on `improvement/pmia-0.7.0`.
- Preserve the original checkout, normal Edge windows/profile, rollback assets, and private tracker.
- Do not push, merge, tag, publish, or replace the installed extension.
- Preserve every non-duplicate final until exact rendered proof or explicit archive.
- Do not add disk-backed runtime storage for Resume, JD, prompts, questions, answers, session IDs, or provider data.
- Write tests during each task but defer executable test runs until Task 15 source work is complete.
- Update the standalone technical atlas once, after final runtime verification.

---

### Task 1 / Cycle 31: Generation Truth Reconciler

**Files:**
- Create: `runtime/extension/content/generation-truth.js`
- Modify: `runtime/extension/content/runtime-telemetry.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/generation-truth.test.js`

**Interfaces:**
- Produces: `reconcileGenerationTruth({ adapterGenerating, stopAvailable, textChanged, finalHintChanged, previous, now }) -> { state, generating, confidence, reason, observedAt }`.
- Consumed by: Tasks 2, 3, 11, and 13.

- [x] Write tests for active generation, contradictory stale generation, unknown evidence, and final-hint completion.
- [x] Implement the pure reconciler without reading DOM directly.
- [x] Publish safe generation state and reason in receiver telemetry.
- [x] Replace direct long-lived `adapter.isGenerating()` assumptions in answer observation with reconciled state.
- [x] Review diff for provider independence and commit `fix: reconcile receiver generation truth`.

### Task 2 / Cycle 32: Explicit Answer Lifecycle

**Files:**
- Create: `runtime/extension/content/answer-lifecycle.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/batch-event-policy.js`
- Test: `runtime/extension/tests/answer-lifecycle.test.js`
- Test: `runtime/extension/tests/runtime-pilot-state.test.js`

**Interfaces:**
- Produces: `createAnswerLifecycle(initial?)` with `transition(event)` and `snapshot()`.
- Snapshot fields: `{ batchId, state, startedAt, firstTokenAt, completedAt, lastEvidenceAt, reason, wordCount, elapsedMs }`.

- [x] Write transition tests for waiting, streaming, complete, no_response, timed_out, cancelled, and idempotent terminal events.
- [x] Implement the text-free lifecycle state machine.
- [x] Add `answerState` to normalized/exported Pilot session state.
- [x] Permit safe answer lifecycle fields through batch/telemetry policy while excluding text.
- [x] Commit `feat: separate answer lifecycle from delivery proof`.

### Task 3 / Cycle 33: Adaptive Answer Deadlines

**Files:**
- Create: `runtime/extension/content/answer-timeout-policy.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/answer-timeout-policy.test.js`

**Interfaces:**
- Produces: `deriveAnswerDeadline({ state, startedAt, firstTokenAt, lastEvidenceAt, now, limits? }) -> { terminal, state, reason, nextCheckMs, deadlineAt }`.
- Defaults: start grace 8 seconds, stream stall 20 seconds, hard cap 120 seconds.

- [x] Write tests for never-started response, active stream, stalled stream, hard cap, and configured limits.
- [x] Implement deadline policy with exact reason codes.
- [x] Use the policy in answer capture; preserve the hard cap for genuine streaming.
- [x] Emit `no_response` separately from `timed_out`.
- [x] Commit `fix: use evidence-driven answer deadlines`.

### Task 4 / Cycle 34: Delivery SLA Scope Correction

**Files:**
- Modify: `runtime/extension/shared/delivery-sla-policy.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Test: `runtime/extension/tests/delivery-sla-policy.test.js`
- Test: `runtime/extension/tests/runtime-pilot-controller.test.js`

**Interfaces:**
- SLA consumes only unresolved ledger entries and transport/storage state.
- Produces informational `answerWaiting` separately; it never returns a repair action.

- [x] Add failing cases for proven active batch, answer timeout after proof, and genuinely unresolved delivery.
- [x] Remove active-answer age from delivery escalation inputs.
- [x] Record answer waiting as safe informational state, not repair state.
- [x] Verify existing catch-up/live-check/repair sequence remains unchanged for unresolved finals.
- [x] Commit `fix: keep answer waits outside delivery SLA`.

### Task 5 / Cycle 35: Answer-Safe Batch Advancement

**Files:**
- Modify: `runtime/extension/content/receiver-batch-runtime.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/receiver-batch-runtime.test.js`

**Interfaces:**
- `answerComplete(batchId, { answerState, answer, proof })` accepts every terminal answer state exactly once.
- Proven delivery remains attached to `lastCompleted` even when answer state is `no_response` or `timed_out`.

- [x] Add tests for no-response, stream-timeout, cancelled stale batch, duplicate terminal event, and next-batch advancement.
- [x] Normalize old timeout payloads into the new lifecycle states.
- [x] Release active ownership on every terminal state while retaining exact proof.
- [x] Ensure later protected partitions submit sequentially once.
- [x] Commit `fix: release proven batches on terminal answer state`.

### Task 6 / Cycle 36: Repair Event Coalescing

**Files:**
- Create: `runtime/extension/shared/repair-event-coalescer.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Test: `runtime/extension/tests/repair-event-coalescer.test.js`

**Interfaces:**
- Produces: `createRepairEventCoalescer({ cooldownMs })` with `accept(report, now) -> { persist, report, suppressed }`.
- Phase, error, verification completion, timeout, and check-set changes always persist.

- [x] Write tests for duplicate suppression, semantic transitions, final healthy report, and suppressed count.
- [x] Implement semantic fingerprinting without transcript data.
- [x] Route repair timeline recording through the coalescer.
- [x] Expose cumulative suppressed count in safe repair diagnostics.
- [x] Commit `perf: coalesce duplicate recovery transitions`.

### Task 7 / Cycle 37: Registration Heartbeat Coalescing

**Files:**
- Create: `runtime/extension/shared/registration-heartbeat.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Test: `runtime/extension/tests/registration-heartbeat.test.js`

**Interfaces:**
- Produces: `classifyRegistration(previous, incoming) -> ownership_transition | instance_replacement | lease_migration | heartbeat`.
- Pilot role state gains `{ registrationHeartbeatCount, lastRegistrationAt }`.

- [x] Test all registration classes and same-instance heartbeat behavior.
- [x] Record durable timeline events only for ownership/instance/lease transitions.
- [x] Increment safe heartbeat counters without adding timeline rows.
- [x] Preserve role conflict and revocation behavior.
- [x] Commit `perf: coalesce registration heartbeats`.

### Task 8 / Cycle 38: Self-Test Trust Lease

**Files:**
- Create: `runtime/extension/dashboard/self-test-trust-model.js`
- Modify: `runtime/extension/dashboard/self-test-model.js`
- Modify: `runtime/extension/dashboard/health-report-model.js`
- Test: `runtime/extension/tests/self-test-trust-model.test.js`

**Interfaces:**
- Produces: `deriveSelfTestTrust(snapshot, now, limits?) -> { state, source, expiresAt, ageMs, detail }`.
- States: `active`, `evidence_fresh`, `stale`, `failed`, `missing`.

- [x] Test pulse freshness, fresh direct/heartbeat extension, stale evidence, and failed pulse.
- [x] Implement trust lease without modifying the original self-test result.
- [x] Update self-test card and health report with source and expiry.
- [x] Keep manual Run self-test control unchanged.
- [x] Commit `feat: add active verification trust lease`.

### Task 9 / Cycle 39: Readiness Evidence Fusion

**Files:**
- Modify: `runtime/extension/dashboard/readiness-model.js`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Test: `runtime/extension/tests/readiness-model.test.js`

**Interfaces:**
- Readiness consumes `deriveSelfTestTrust` and returns `{ evidenceSource, evidenceExpiresAt }`.
- Context-arm and storage-critical requirements remain independent blockers.

- [x] Add tests for active pulse, evidence-fresh roles, stale roles, failed pulse, and context-unarmed state.
- [x] Replace the fixed 30-second self-test blocker with trust-state evaluation.
- [x] Render the evidence source in concise readiness detail.
- [x] Ensure no passive evidence can override a failed active pulse.
- [x] Commit `fix: fuse active evidence into readiness`.

### Task 10 / Cycle 40: Delivery and Answer Metrics Separation

**Files:**
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/dashboard/dashboard-model.js`
- Modify: `runtime/extension/dashboard/health-report-model.js`
- Test: `runtime/extension/tests/runtime-pilot-state.test.js`
- Test: `runtime/extension/tests/dashboard-model.test.js`

**Interfaces:**
- Metrics add `answersCompleted`, `answersNoResponse`, `answersTimedOut`, `answersCancelled`, and `answerAvailabilityRate`.
- `deliverySuccessRate` remains based only on rendered proof outcomes.

- [x] Write metric tests proving answer failure cannot reduce delivery success.
- [x] Record terminal answer states once per batch.
- [x] Extend safe review and health report with answer availability.
- [x] Preserve historical metric migration defaults.
- [x] Commit `feat: separate delivery and answer metrics`.

### Task 11 / Cycle 41: Coherent Live Dashboard State

**Files:**
- Create: `runtime/extension/dashboard/answer-status-model.js`
- Modify: `runtime/extension/dashboard/live-inbox-model.js`
- Modify: `runtime/extension/dashboard/pace-guard-model.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Test: `runtime/extension/tests/answer-status-model.test.js`
- Test: `runtime/extension/tests/dashboard-usability.test.js`

**Interfaces:**
- Produces separate Delivery, Answer, and Verification view models.
- “Caught up” refers only to delivery; answer state is independently labeled.

- [x] Test coherent combinations for proven/waiting, streaming, no-response, timeout, and idle.
- [x] Add a compact Answer rail beside Delivery and Verification.
- [x] Remove ambiguous use of receiver `generating` when generation truth is stale.
- [x] Keep controls, queue, Pace Guard, and latency rail intact.
- [x] Commit `feat: separate live delivery answer and verification state`.

### Task 12 / Cycle 42: Recovery/SLA Controller Boundary

**Files:**
- Create: `runtime/extension/shared/runtime-recovery-coordinator.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/scripts/validate-extension.mjs`
- Test: `runtime/extension/tests/runtime-recovery-coordinator.test.js`

**Interfaces:**
- Coordinator owns `evaluateSla`, `repair`, `handleAlarm`, `cancelSchedules`, and `liveCheckTransition` through injected callbacks.
- Controller remains command/routing owner.

- [x] Write coordinator unit tests with fake clock, alarms, roles, and Pilot mutations.
- [x] Extract policy orchestration without changing public command names or result shapes.
- [x] Remove duplicated repair/SLA helper state from controller.
- [x] Add import-reachability and no-focus validation.
- [x] Commit `refactor: isolate recovery and SLA coordination`.

### Task 13 / Cycle 43: Content Answer Orchestrator Boundary

**Files:**
- Create: `runtime/extension/content/receiver-answer-orchestrator.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/manifest.json`
- Test: `runtime/extension/tests/receiver-answer-orchestrator.test.js`

**Interfaces:**
- `createReceiverAnswerOrchestrator({ adapter, wake, telemetry, log, now, policy })` exposes `start`, `cancel`, `observe`, and `snapshot`.
- Returns only text to the existing role log path; Pilot receives safe metadata.

- [x] Test completion, no-response, stream timeout, cancellation, stale generation reconciliation, and one terminal callback.
- [x] Move token/wake/tracker/deadline logic out of `entry.js`.
- [x] Integrate batch submission and answer completion through the orchestrator.
- [x] Package the module and verify no second observer/timer loop is introduced.
- [x] Commit `refactor: isolate receiver answer orchestration`.

### Task 14 / Cycle 44: Dashboard Rendering Boundary and Accessibility

**Files:**
- Create: `runtime/extension/dashboard/render-live-status.js`
- Create: `runtime/extension/dashboard/render-runtime-health.js`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Test: `runtime/extension/tests/dashboard-render-boundaries.test.js`
- Test: `runtime/extension/tests/dashboard-usability.test.js`

**Interfaces:**
- Render modules receive `{ document, snapshot, now, text, formatDuration }` and mutate only owned section IDs.
- `dashboard.js` remains connection, command, queue, timeline, and composition owner.

- [x] Write source-boundary and DOM-fixture tests for independent render ownership.
- [x] Extract live status and health rendering without changing IDs consumed by tests/controls.
- [x] Add `aria-live` and explicit headings for Delivery, Answer, and Verification rails.
- [x] Add CSS assertions for 320-pixel reflow and print-safe ordering.
- [x] Commit `refactor: split Pilot rendering into focused sections`.

### Task 15 / Cycle 45: Repeatable Isolated Release Evidence

**Files:**
- Create: `runtime/scripts/run-isolated-release-smoke.ps1`
- Create: `runtime/scripts/isolated-release-smoke.mjs`
- Create: `runtime/extension/tests/isolated-release-smoke.test.js`
- Modify: `runtime/Validate_Extension_Runtime.ps1`
- Modify: `docs/ITERATIVE_IMPROVEMENT_LOG.md`
- Modify: `docs/CURRENT_STATUS_DASHBOARD.md`
- Create after verification: `docs/evidence/2026-08-01-pmia-cycles-31-45-verification.md`

**Interfaces:**
- PowerShell parameters: `-ExtensionPath`, `-EvidenceDirectory`, `-BrowserPath`, `-SkipLiveAnswer`.
- Evidence schema: `{ version, isolatedProfile, extensions, session, selfTest, finals, batches, ledger, outbox, gap, answerCapability, cleanup, ok, limitations }`.

- [x] Write static tests for isolation flags, synthetic-only questions, exact extension identity, cleanup, and structured evidence.
- [x] Implement temporary-profile launch with quoted paths, unique debugging port, and exact process-tree ownership.
- [x] Implement registration, self-test, Q1 plus accumulated Q2/Q3, rendered proof, outbox/gap, and cleanup checks.
- [x] Distinguish anonymous-provider answer unavailability from delivery failure.
- [x] Document all 15 cycles under Bug fixes, New features, and Implementation.
- [x] Run the complete validator for the first time after Task 15 source completion.
- [x] Resolve failures from exact output and rerun the entire validator.
- [x] Run isolated release smoke and record structured evidence.
- [x] Verify original checkout and normal Edge remain untouched; verify no push/merge/tag.
- [x] Commit `test: add isolated PMIA release evidence gate`.

## Final HTML Atlas Update

**Files:**
- Locate and reuse the current condensed PMIA technical atlas outside or inside the repository.
- Update only architecture, flows, dashboard states, comparison, cycles, verification evidence, and limitations changed by Cycles 21–45.

- [ ] Preserve the current information architecture and remove obsolete claims rather than appending raw cycle logs.
- [ ] Add diagrams for delivery-versus-answer lifecycle, trust lease, quiet recovery/registration, and isolated release evidence.
- [ ] Validate HTML structure, script syntax, internal links, keyboard interaction, offline use, desktop layout, 320 CSS-pixel reflow, and print.
- [ ] Save one versioned final HTML file and do not create intermediate atlas versions.

## Plan self-review

Every spec requirement maps to one task. Interfaces use consistent names across tasks. No placeholders remain. The plan preserves the lossless ledger and provider adapters, restricts decomposition to affected owners, defers executable tests until Cycle 45, and includes the single final atlas update after verification.