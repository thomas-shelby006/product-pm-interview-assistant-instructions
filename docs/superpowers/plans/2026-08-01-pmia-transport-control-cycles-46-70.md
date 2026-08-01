# PMIA Transport-Control Cycles 46–70 Implementation Plan

Date: 2026-08-01
Branch: `improvement/pmia-0.7.0`
Baseline: `8c0a2a0`
Design: `docs/superpowers/specs/2026-08-01-pmia-transport-control-cycles-46-70-design.md`

## Execution rules

- Preserve the Delivery Ledger and provider-rendered proof as the only delivery authorities.
- Write regression contracts before each production block; defer executable tests until all 25 cycles are source-complete.
- Do not focus or activate provider tabs, inspect normal Edge tabs, or use real user content.
- Keep all new state in `chrome.storage.session` or document memory and metadata-only.
- Commit each five-cycle block independently. Do not push, merge, tag, or modify the original checkout.
- Update the existing condensed HTML only after final runtime and browser verification.

## Block A — Protocol Identity and Selective Repair, Cycles 46–50

### Tests first
Create:
- `runtime/extension/tests/transport-protocol.test.js`
- `runtime/extension/tests/request-correlation-journal.test.js`
- `runtime/extension/tests/delivery-attempt-lease.test.js`
- `runtime/extension/tests/sequence-feedback.test.js`

Contracts:
- handshake rejects incompatible versions and intersects capabilities;
- stale epoch frames and late responses are ignored;
- correlation results replay only for the same epoch/request;
- one final has one live attempt lease and takeover requires expiry;
- sequence feedback reports contiguous ACK, buffered ranges, and exact NACK ranges.

### Production
Create:
- `runtime/extension/shared/transport-protocol.js`
- `runtime/extension/shared/request-correlation-journal.js`
- `runtime/extension/shared/delivery-attempt-lease.js`
- `runtime/extension/shared/sequence-feedback.js`

Modify:
- `runtime/extension/shared/runtime-port-hub.js`
- `runtime/extension/content/runtime-role-port.js`
- `runtime/extension/shared/delivery-ledger.js`
- `runtime/extension/shared/contiguous-sequence-buffer.js`
- `runtime/extension/content/receiver-batch-runtime.js`
- `runtime/extension/content/entry.js`
- `runtime/extension/manifest.json`

Acceptance:
- direct requests require a completed version/capability handshake;
- all frames carry epoch and correlation identity;
- stale responses cannot resolve current requests;
- ledger lease metadata is safe and exported;
- receiver acknowledgements expose selective feedback without text.

Commit: `feat: version transport and add selective repair`

## Block B — Backpressure, Lane Selection, and Durable Wake, Cycles 51–55

### Tests first
Create:
- `runtime/extension/tests/receiver-flow-control.test.js`
- `runtime/extension/tests/transport-lane-score.test.js`
- `runtime/extension/tests/reconnect-policy.test.js`
- `runtime/extension/tests/alarm-rehydration.test.js`
- `runtime/extension/tests/outbox-retry-intent.test.js`

Contracts:
- credits reach zero before buffer overflow and recover after proof/confirm;
- lane score penalizes timeout/open circuit and rewards low RTT success;
- reconnect uses capped exponential delay, jitter, and one half-open probe;
- missing alarms are recreated from persisted due times and stale alarms removed;
- sender outbox retry intent survives reload and is cleared only after success or empty state.

### Production
Create:
- `runtime/extension/shared/receiver-flow-control.js`
- `runtime/extension/shared/transport-lane-score.js`
- `runtime/extension/shared/reconnect-policy.js`
- `runtime/extension/shared/alarm-rehydration.js`

Modify:
- `runtime/extension/shared/runtime-port-hub.js`
- `runtime/extension/content/runtime-role-port.js`
- `runtime/extension/content/sender-outbox.js`
- `runtime/extension/content/session-storage-adapter.js`
- `runtime/extension/content/receiver-batch-runtime.js`
- `runtime/extension/shared/runtime-pilot-controller.js`
- `runtime/extension/shared/runtime-pilot-state.js`
- `runtime/extension/background.js`
- `runtime/extension/dashboard/transport-lane-model.js`
- `runtime/extension/manifest.json`

Acceptance:
- sender retains every final when receiver credits are zero;
- direct/fallback choice is evidence-based and reason-coded;
- reconnect storms are bounded;
- startup audits and restores alarms;
- retry intent is visible in safe outbox telemetry.

Commit: `feat: add receiver credits and durable wake intent`

## Block C — Atomic State and Batch Control, Cycles 56–60

### Tests first
Create:
- `runtime/extension/tests/state-commit-journal.test.js`
- `runtime/extension/tests/runtime-invariants.test.js`
- `runtime/extension/tests/batch-transaction.test.js`
- `runtime/extension/tests/provider-batch-budget.test.js`
- `runtime/extension/tests/batch-scheduling-policy.test.js`

Contracts:
- prepared but unapplied commits recover to the last applied generation;
- invariant validator repairs only deterministic metadata and blocks ambiguity;
- batch transaction rejects illegal transitions and is idempotent at terminal states;
- provider budgets have safe floors/caps and never split one question;
- scheduling increases urgency without changing ledger sequence order.

### Production
Create:
- `runtime/extension/shared/state-commit-journal.js`
- `runtime/extension/shared/runtime-invariants.js`
- `runtime/extension/shared/batch-transaction.js`
- `runtime/extension/shared/provider-batch-budget.js`
- `runtime/extension/shared/batch-scheduling-policy.js`

Modify:
- `runtime/extension/shared/runtime-pilot-store.js`
- `runtime/extension/shared/runtime-pilot-controller.js`
- `runtime/extension/shared/runtime-pilot-state.js`
- `runtime/extension/content/receiver-batch-runtime.js`
- `runtime/extension/shared/batch-planner.js`
- `runtime/extension/content/entry.js`
- `runtime/extension/manifest.json`

Acceptance:
- every Pilot save has a generation and applied marker;
- startup invariant audit emits repaired/blocked counts;
- active batches expose one legal transaction state;
- batch budgets adapt by provider and recent evidence;
- old partitions become urgent without reordering membership.

Commit: `refactor: make state and batch control transactional`

## Block D — Provider and Lifecycle Ownership, Cycles 61–65

### Tests first
Create:
- `runtime/extension/tests/composer-fingerprint.test.js`
- `runtime/extension/tests/adapter-capability-drift.test.js`
- `runtime/extension/tests/page-lifecycle-coordinator.test.js`
- `runtime/extension/tests/runtime-instance-fence.test.js`
- `runtime/extension/tests/owner-election.test.js`

Contracts:
- structural rerender with identical ownership is not a manual conflict;
- capability removal degrades readiness and stable restoration clears drift;
- lifecycle bursts produce one reconcile action and preserve hidden operation;
- one document has one active runtime generation;
- stale owner leases are replaceable while live higher-generation owners win.

### Production
Create:
- `runtime/extension/content/composer-fingerprint.js`
- `runtime/extension/content/adapter-capability-drift.js`
- `runtime/extension/content/page-lifecycle-coordinator.js`
- `runtime/extension/content/runtime-instance-fence.js`
- `runtime/extension/shared/owner-election.js`

Modify:
- `runtime/extension/content/composer-arbiter.js`
- `runtime/extension/content/adapter-health.js`
- `runtime/extension/content/runtime-recovery.js`
- `runtime/extension/content/entry.js`
- `runtime/extension/shared/session-registry.js`
- `runtime/extension/shared/runtime-pilot-controller.js`
- `runtime/extension/shared/runtime-pilot-state.js`
- `runtime/extension/dashboard/readiness-model.js`
- `runtime/extension/manifest.json`

Acceptance:
- provider rerenders do not create false draft conflicts;
- drift state is safe, persistent, and recoverable;
- BFCache/freeze/resume use one coordinator;
- duplicate injected instances self-supersede before registration;
- owner election is deterministic and lease-aware.

Commit: `fix: fence provider lifecycle and runtime ownership`

## Block E — Recovery Budgets, Traceability, SLO, and Drill, Cycles 66–70

### Tests first
Create:
- `runtime/extension/tests/recovery-budget.test.js`
- `runtime/extension/tests/delivery-trace.test.js`
- `runtime/extension/tests/backlog-forecast.test.js`
- `runtime/extension/tests/trace-inspector-model.test.js`
- `runtime/extension/tests/transport-drill.test.js`

Contracts:
- automatic repair stops at budget exhaustion and manual reset is explicit;
- trace and span IDs stay stable across outbox, ledger, batch, proof, and answer;
- forecast reports throughput, drain estimate, and risk without prompt text;
- trace inspector returns ordered spans and a reason-coded next action;
- drill covers handshake, direct, fallback, reconnect, NACK, alarm audit, and invariants with no content.

### Production
Create:
- `runtime/extension/shared/recovery-budget.js`
- `runtime/extension/shared/delivery-trace.js`
- `runtime/extension/shared/backlog-forecast.js`
- `runtime/extension/dashboard/trace-inspector-model.js`
- `runtime/extension/shared/transport-drill.js`

Modify:
- `runtime/extension/shared/protocol.js`
- `runtime/extension/content/sender-outbox.js`
- `runtime/extension/shared/delivery-ledger.js`
- `runtime/extension/content/receiver-batch-runtime.js`
- `runtime/extension/content/receiver-answer-orchestrator.js`
- `runtime/extension/shared/runtime-recovery-coordinator.js`
- `runtime/extension/shared/runtime-pilot-controller.js`
- `runtime/extension/shared/runtime-pilot-state.js`
- `runtime/extension/dashboard/index.html`
- `runtime/extension/dashboard/dashboard.css`
- `runtime/extension/dashboard/dashboard.js`
- `runtime/extension/dashboard/health-report-model.js`
- `runtime/extension/manifest.json`

Acceptance:
- recovery cannot thrash indefinitely;
- one final is traceable through every mechanical stage;
- Pilot predicts backlog risk before breach;
- operator can search one final without scanning the timeline;
- no-content drill produces a structured pass/fail report and mutates no delivery data.

Commit: `feat: add traceable SLO control and transport drill`

## Final runtime verification

1. Run all focused Cycle 46–70 tests.
2. Run `runtime/Validate_Extension_Runtime.ps1` and record exact counts.
3. Run repository-owned isolated release smoke with three synthetic finals.
4. Run the no-content transport drill in the isolated session.
5. Inspect Pilot at desktop and 320 CSS pixels for trace, forecast, drift, budget, and drill surfaces.
6. Confirm process/profile cleanup and normal Edge isolation.
7. Write `docs/evidence/2026-08-01-pmia-cycles-46-70-verification.md`.
8. Update active status, iteration log, and this plan with exact evidence.
9. Commit verification corrections and evidence.
10. Rerun the complete gate on final committed HEAD.

## Final HTML update — last task only

Use `/mnt/data/PMIA_Technical_Systems_Atlas_Condensed_20260801.html` as the base. Preserve its design and interactions. Change only sections affected by Cycles 21–70 and verified evidence:
- system topology and transport lanes;
- protocol handshake, epochs, correlation, credits, and selective repair;
- restart/alarm/outbox/commit recovery;
- batch transaction and provider-aware scheduling;
- lifecycle, drift, instance fencing, and owner election;
- recovery budgets, tracing, SLO forecast, and transport drill;
- Baseline versus Improved comparison;
- verification counts and isolated-browser evidence.

Validate the standalone artifact for HTML structure, JavaScript syntax, internal links, search/filter/detail controls, diagram enlargement, desktop, 320 CSS pixels, print, and offline operation. Copy the final verified file to `/mnt/data` and provide one download link.

## Completion checklist

- [x] Cycles 46–50 implemented and committed.
- [x] Cycles 51–55 implemented and committed.
- [x] Cycles 56–60 implemented and committed.
- [x] Cycles 61–65 implemented and committed.
- [x] Cycles 66–70 implemented and committed.
- [x] Complete automated gate passed: 719/719 tests; 244 JavaScript files; 18 required surfaces; 121 reachable production modules.
- [x] Isolated browser smoke passed with three proven synthetic finals and complete cleanup.
- [x] No-content transport drill passed all seven checks.
- [x] Evidence and active documentation updated.
- [x] Final committed HEAD `6682f03` reverified with exit code 0.
- [x] Original checkout unchanged; no push/merge/tag.
- [ ] Condensed HTML updated once, validated, and delivered. Deferred until Cycles 71–95 are complete.