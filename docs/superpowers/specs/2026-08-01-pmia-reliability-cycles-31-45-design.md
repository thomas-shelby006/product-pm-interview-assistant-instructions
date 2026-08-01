# PMIA Reliability Cycles 31–45 Design

Date: 2026-08-01
Status: Approved follow-on design
Branch: `improvement/pmia-0.7.0`

## Objective

Harden the verified PMIA 0.7 lossless runtime after the Cycle 30 automated and isolated-browser gates. Preserve every existing capability while fixing the browser-observed mismatch between rendered delivery proof, answer generation, timeout handling, recovery escalation, and dashboard truth. Reduce runtime churn and split the three oversized orchestration owners only where the new behavior requires clearer boundaries.

## Evidence base

The post–Cycle 30 gate passed 607/607 tests, extension reachability/security validation, and both AutoHotkey validators. The isolated anonymous ChatGPT smoke then proved three synthetic finals end to end: Q1 as a rendered source turn and Q2/Q3 as an ordered accumulated batch with Q3 marked highest priority. All three ledger entries reached exact rendered proof, the sender outbox cleared, sequence continuity held, and storage remained normal.

The same smoke exposed four material weaknesses:

1. receiver telemetry could remain `generating` after the page no longer exposed a stop control;
2. a rendered and proven batch remained active until a fixed 120-second answer timeout;
3. Delivery SLA escalated into repair even though no unresolved delivery remained;
4. registration and repair transitions produced repetitive timeline/storage churn.

Source inspection also found three oversized orchestration files: `runtime-pilot-controller.js`, `content/entry.js`, and `dashboard/dashboard.js`. Decomposition is permitted only around the new answer, recovery, and rendering responsibilities; unrelated refactoring is out of scope.

## Architectural direction

The lossless ledger and rendered-turn proof remain the delivery authority. Answer observation becomes a separate lifecycle with explicit states: `waiting`, `streaming`, `complete`, `no_response`, `timed_out`, and `cancelled`. Delivery proof can close ledger membership immediately; answer lifecycle controls only answer metrics and when the next protected batch may submit.

A provider-state reconciler combines adapter generation evidence, stop-control evidence, assistant-text growth, and final hints. Stale `generating` telemetry cannot survive contradictory current evidence. An answer policy chooses bounded deadlines by observed state rather than one global timeout.

Delivery SLA evaluates unresolved delivery only. A proven batch awaiting answer observation is not a delivery failure and cannot trigger repair. Recovery and registration telemetry use semantic fingerprints and cooldowns so repeated heartbeats do not generate duplicate durable events.

Readiness uses a short active self-test lease extended by fresh direct-port and heartbeat evidence, without claiming a new self-test was run. The dashboard clearly distinguishes “actively verified,” “evidence-fresh,” and “verification stale.”

## Cycles

### Cycle 31 — Generation Truth Reconciler
- **Bug fixes:** clear stale generation when the adapter no longer exposes generation or stop evidence.
- **New features:** reason-coded generation confidence and last-evidence timestamp.
- **Implementation:** pure `generation-truth.js` model integrated into receiver telemetry and answer observation.

### Cycle 32 — Explicit Answer Lifecycle
- **Bug fixes:** stop treating rendered delivery proof as equivalent to answer completion.
- **New features:** persisted safe answer-state summary per active batch.
- **Implementation:** `answer-lifecycle.js` state machine with text-free checkpoints.

### Cycle 33 — Adaptive Answer Deadlines
- **Bug fixes:** replace the unconditional 120-second wait for pages that never begin answering.
- **New features:** separate start, stream-stall, and hard deadlines with reason codes.
- **Implementation:** `answer-timeout-policy.js`; preserve longer bounds for genuinely streaming answers.

### Cycle 34 — Delivery SLA Scope Correction
- **Bug fixes:** prevent repair escalation after every ledger member already has rendered proof.
- **New features:** explicit `answer_waiting` informational state outside delivery SLA.
- **Implementation:** SLA policy consumes ledger/actionable state only and ignores proven active batches.

### Cycle 35 — Answer-Safe Batch Advancement
- **Bug fixes:** prevent a proven batch from remaining active indefinitely after `no_response` or timeout.
- **New features:** deterministic terminal answer outcomes that release the next protected batch.
- **Implementation:** receiver batch runtime completes active ownership on every terminal answer state while retaining proof.

### Cycle 36 — Repair Event Coalescing
- **Bug fixes:** remove millisecond-scale duplicate `repair_report` events and writes.
- **New features:** semantic repair transition fingerprint and suppressed-count diagnostics.
- **Implementation:** pure coalescer at the recovery owner; final transition always persists.

### Cycle 37 — Registration Heartbeat Coalescing
- **Bug fixes:** stop recording routine 15-second re-registration heartbeats as durable timeline events.
- **New features:** compact role-lease heartbeat counters and last-seen state.
- **Implementation:** distinguish ownership transition from same-instance heartbeat in controller/state.

### Cycle 38 — Self-Test Trust Lease
- **Bug fixes:** avoid presenting a successful active pulse as simply stale after 30 seconds despite fresh control evidence.
- **New features:** `active`, `evidence_fresh`, `stale`, and `failed` trust states.
- **Implementation:** pure trust-lease model combining pulse age, role heartbeat, and direct-port samples.

### Cycle 39 — Readiness Evidence Fusion
- **Bug fixes:** remove contradictory Ready blockers when current active evidence proves both roles reachable.
- **New features:** reason-coded readiness evidence source and expiry.
- **Implementation:** readiness model consumes the trust lease without fabricating a self-test result.

### Cycle 40 — Delivery and Answer Metrics Separation
- **Bug fixes:** answer timeout no longer degrades delivery success or implies a missing question.
- **New features:** answer availability, no-response, stream-timeout, and completed-answer rates.
- **Implementation:** extend safe metrics and review derivation without storing answer text in Pilot state.

### Cycle 41 — Coherent Live Dashboard State
- **Bug fixes:** eliminate combinations such as “Caught up,” “Answering,” and stale `generating` that refer to different truths without explanation.
- **New features:** separate Delivery, Answer, and Verification status rails.
- **Implementation:** pure dashboard models and concise labels driven by the new states.

### Cycle 42 — Recovery/SLA Controller Boundary
- **Bug fixes:** reduce cross-coupling that allowed answer state to trigger delivery repair.
- **New features:** focused `runtime-recovery-coordinator.js` interface.
- **Implementation:** extract SLA evaluation, repair scheduling, and alarm handling from `runtime-pilot-controller.js` while preserving commands.

### Cycle 43 — Content Answer Orchestrator Boundary
- **Bug fixes:** centralize token cancellation, wake handling, generation reconciliation, and terminal answer reporting.
- **New features:** focused `receiver-answer-orchestrator.js`.
- **Implementation:** extract answer capture from `content/entry.js`; no provider-specific branching outside adapters/models.

### Cycle 44 — Dashboard Rendering Boundary and Accessibility
- **Bug fixes:** reduce monolithic rerender coupling and verify 320 CSS-pixel reflow for new rails.
- **New features:** independently rendered delivery, answer, verification, and diagnostics sections with accessible live labels.
- **Implementation:** extract focused render modules; preserve one dashboard and all existing controls.

### Cycle 45 — Repeatable Isolated Release Evidence
- **Bug fixes:** remove ad hoc browser-smoke ambiguity and ensure assistant-created browser state is cleaned safely.
- **New features:** repository-owned synthetic smoke runner and structured evidence schema for registration, self-test, accumulation, proof, outbox, gap, and cleanup.
- **Implementation:** PowerShell/Node tooling that creates a temporary profile, never uses credentials, never touches normal Edge, and reports unsupported anonymous-answer generation separately from delivery proof.

## Data and privacy

No new disk-backed runtime storage is allowed. Pilot checkpoints remain in `chrome.storage.session` and contain no question or answer text beyond the existing lossless ledger. New answer-state, generation-confidence, repair-coalescing, registration-heartbeat, and self-test-trust records are metadata only. The release smoke uses fixed synthetic text and writes evidence only to the designated temporary/evidence directory.

## Error handling

- Contradictory provider evidence resolves conservatively to `unknown` or `no_response`, never false `complete`.
- Rendered proof remains sufficient for delivery success even when answer text is unavailable.
- Every terminal answer outcome releases batch ownership exactly once.
- Recovery coalescing never suppresses a phase change, error change, verification completion, or timeout.
- Registration coalescing never suppresses ownership replacement, role conflict, tab migration, or instance change.
- Smoke tooling fails closed when the candidate extension, isolated profile, exact session, or proof set cannot be verified.

## Verification

Write regression coverage during each cycle, but defer execution until Cycle 45 source work is complete. Then run:

1. the complete Node suite;
2. extension syntax, security, manifest, and import-reachability validation;
3. both silent AutoHotkey validators;
4. the repository-owned isolated browser smoke;
5. a final clean-branch and untouched-original-checkout audit;
6. standalone HTML atlas validation after the single end-state update.

## Completion test

The phase is complete only when all 15 cycles are documented and committed, the full automated gate passes, the isolated smoke proves ordered lossless delivery and exact batch proof, the dashboard states are mutually coherent, no normal Edge/profile state changed, the original checkout remains untouched, and the current condensed technical atlas is updated once with verified source and evidence.

## Spec self-review

No placeholders remain. Delivery proof and answer completion are explicitly separated. Every cycle maps to an observed failure or an owning-boundary improvement required by that failure. The scope preserves the lossless ledger, existing controls, provider adapters, launcher, privacy model, rollback assets, and no-push/no-merge constraint.