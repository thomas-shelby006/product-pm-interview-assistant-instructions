# PMIA Transport-Control Cycles 46–70 Design

Date: 2026-08-01
Status: Approved continuation design
Branch: `improvement/pmia-0.7.0`
Baseline commit: `8c0a2a0`

## Objective

Strengthen the verified PMIA 0.7 mechanics after Cycles 31–45 without replacing the proven lossless ledger, provider adapters, or three-window operating model. Improve transport correctness, reconnect behavior, Manifest V3 restart recovery, throughput under bursts, lifecycle safety, operator diagnosis, and user confidence. Prompt content is out of scope except for short transport-owned wrapper text already required for batching.

## Evidence base

The current system passed 664/664 Node tests, extension validation across 197 JavaScript files, 18 required runtime surfaces, 98 reachable production modules, both AutoHotkey validators, and the repository-owned isolated Edge smoke. The smoke proved three ordered synthetic finals, exact provider-rendered proof, protected Q2/Q3 accumulation, a clear sender outbox, no sequence gap, active self-test success, answer availability, and exact temporary-profile cleanup.

Source inspection still shows mechanical risk concentrated in the port protocol, service-worker restart boundaries, retry intent, state commit atomicity, ledger/batch invariant repair, provider capability drift, page lifecycle transitions, owner fencing, and the operator’s ability to trace one final through every stage. The largest orchestration owners remain `runtime-pilot-controller.js`, `content/entry.js`, `dashboard/dashboard.js`, and `runtime-pilot-state.js`; extraction is allowed only where a new responsibility requires a durable boundary.

## Architectural direction

The Delivery Ledger remains the sole durable question authority. Provider-rendered proof remains the delivery completion authority. The new transport-control layer adds explicit protocol identity, epochs, capabilities, correlation, selective sequence feedback, receiver credits, lane scoring, durable wake intent, and trace metadata around those authorities.

Every direct-port frame carries a protocol version, role/session identity, connection epoch, request correlation ID, and safe capability summary. A stale epoch cannot mutate current state. One-time runtime messaging remains the fallback lane, not a second owner. Receiver credits limit admission without dropping or reordering finals. ACK/NACK feedback identifies missing sequence ranges and permits selective replay from the sender outbox or ledger.

Service-worker state is reconstructed from `chrome.storage.session` and durable alarms. Retry intent, recovery deadlines, owner leases, and commit generations survive worker suspension. Pilot writes use a small commit journal so interrupted writes can be detected and repaired rather than silently accepted.

Provider and page lifecycle state become explicit. Composer ownership uses a structural fingerprint, adapter capabilities are compared over time, duplicate content-runtime instances are fenced, and freeze/resume/BFCache transitions reconcile instead of creating competing observers.

The Pilot gains per-final trace search, transport SLO/backlog forecasting, capability-drift warnings, recovery-budget state, and a no-content transport drill. All new diagnostics are metadata-only unless the existing ledger already owns the question text.

## Non-negotiable invariants

1. No final is dropped, truncated, reordered, or marked delivered without exact provider-rendered proof.
2. No recovery, drill, or lifecycle path focuses or activates a provider tab.
3. One-time messaging remains a fallback to the direct role port; it never becomes a parallel delivery authority.
4. A stale epoch, owner lease, content instance, alarm, command response, or batch transaction cannot mutate the active session.
5. Storage compaction never removes actionable ledger entries, outbox entries, active batch members, or unresolved trace state.
6. New telemetry contains reason codes, timings, counts, hashes, and IDs only; prompt and answer text remain inside existing authorized stores.
7. HTML documentation is updated only after Cycles 46–70 pass the complete automated and isolated-browser gates.

## Cycles

### Cycle 46 — Versioned Transport Handshake
- **Bug fixes:** reject unversioned or incompatible direct-port frames instead of interpreting them optimistically.
- **New features:** negotiated protocol version and safe capability set per role connection.
- **Implementation:** `transport-protocol.js`; handshake required before request traffic in hub and role port.

### Cycle 47 — Session Epoch Fencing
- **Bug fixes:** prevent a replaced or resumed stale port from acknowledging current requests.
- **New features:** monotonically increasing connection epoch exposed in transport telemetry.
- **Implementation:** epoch authority at the hub; every frame and pending request is epoch-bound.

### Cycle 48 — Reconnect-Safe Correlation Journal
- **Bug fixes:** stop late duplicate responses from resolving a newer request after reconnect.
- **New features:** bounded request/result correlation journal with duplicate-response counters.
- **Implementation:** `request-correlation-journal.js` used by hub and role port.

### Cycle 49 — Per-Final Attempt Leases
- **Bug fixes:** prevent two recovery paths from submitting the same final concurrently.
- **New features:** short delivery-attempt lease with owner, expiry, and reason-coded takeover.
- **Implementation:** extend ledger entries through `delivery-attempt-lease.js`; proof or failure releases the lease.

### Cycle 50 — Selective Sequence ACK/NACK
- **Bug fixes:** replace generic gap failure with exact missing-range feedback.
- **New features:** contiguous ACK, buffered ranges, and selective NACK ranges.
- **Implementation:** `sequence-feedback.js` derived from the contiguous buffer and returned in receiver acknowledgements.

### Cycle 51 — Receiver Credit Backpressure
- **Bug fixes:** prevent burst delivery from overfilling the receiver buffer or provider composer path.
- **New features:** dynamic credits for immediate, buffered, and held admissions.
- **Implementation:** `receiver-flow-control.js`; sender respects zero-credit and retries from durable state.

### Cycle 52 — Adaptive Transport Lane Scoring
- **Bug fixes:** avoid repeatedly preferring a slow direct port over a healthy fallback.
- **New features:** rolling lane score from RTT, timeout, circuit, and recent success evidence.
- **Implementation:** `transport-lane-score.js`; direct remains preferred only while its score is healthy.

### Cycle 53 — Jittered Reconnect and Half-Open Probe
- **Bug fixes:** remove synchronized reconnect bursts after worker or network recovery.
- **New features:** bounded exponential backoff with deterministic jitter and one half-open probe.
- **Implementation:** `reconnect-policy.js` integrated into content role ports and dashboard reconnects.

### Cycle 54 — Alarm Rehydration on Worker Start
- **Bug fixes:** recreate missing recovery, timeout, and retry alarms after service-worker suspension.
- **New features:** startup alarm audit with restored, unchanged, and stale counts.
- **Implementation:** `alarm-rehydration.js` invoked from background startup using persisted schedules.

### Cycle 55 — Durable Outbox Retry Intent
- **Bug fixes:** preserve an outstanding retry even when the content script reloads before its timer fires.
- **New features:** persisted retry intent with due time, attempt, reason, and alarm source.
- **Implementation:** sender outbox exports retry intent; background schedules and dispatches the wake.

### Cycle 56 — Atomic Pilot Commit Journal
- **Bug fixes:** detect an interrupted or partially applied Pilot save.
- **New features:** monotonic commit generation, prepared/applied markers, and recovery diagnostics.
- **Implementation:** `state-commit-journal.js` wrapped around Runtime Pilot store writes.

### Cycle 57 — Runtime Invariant Validator and Repair
- **Bug fixes:** repair safe state mismatches among ledger, batch, outbox summary, sequence, and trace indexes.
- **New features:** reason-coded invariant report with repaired and blocked findings.
- **Implementation:** `runtime-invariants.js`; only deterministic metadata repairs are automatic.

### Cycle 58 — Explicit Batch Transaction State Machine
- **Bug fixes:** eliminate ambiguous batch combinations such as submitted without proof identity or terminal answer without release.
- **New features:** `draft`, `frozen`, `submitting`, `proven`, `answering`, `terminal`, and `released` transaction states.
- **Implementation:** `batch-transaction.js` becomes the transition authority used by receiver batch runtime.

### Cycle 59 — Provider-Aware Dynamic Batch Budgets
- **Bug fixes:** stop using one fixed character budget for different providers and composer conditions.
- **New features:** bounded budget derived from provider, capability evidence, recent submit size, and safety floor.
- **Implementation:** `provider-batch-budget.js`; never splits one question.

### Cycle 60 — Deadline-Aware Batch Scheduling
- **Bug fixes:** prevent an old protected partition from waiting behind avoidable non-urgent holds.
- **New features:** urgency classification and next-submit recommendation without changing sequence order.
- **Implementation:** `batch-scheduling-policy.js` controls timing only; ledger order remains authoritative.

### Cycle 61 — Structural Composer Ownership Fingerprint
- **Bug fixes:** distinguish provider rerenders from genuine operator edits.
- **New features:** text hash plus structural, role, and revision fingerprint.
- **Implementation:** `composer-fingerprint.js` integrated with composer arbiter and conflict diagnostics.

### Cycle 62 — Adapter Capability Drift Detection
- **Bug fixes:** identify when a provider DOM change removes a capability after readiness.
- **New features:** drift severity, changed surfaces, first/last seen, and stable recovery count.
- **Implementation:** `adapter-capability-drift.js`; readiness and Pilot consume the result.

### Cycle 63 — Unified Page Lifecycle Coordinator
- **Bug fixes:** prevent duplicate recovery from `pageshow`, freeze, resume, visibility, and online events.
- **New features:** explicit active, hidden, frozen, BFCache, discarded-reload, and restored phases.
- **Implementation:** `page-lifecycle-coordinator.js` owns lifecycle signals and emits one reconciliation request.

### Cycle 64 — Duplicate Content Runtime Fence
- **Bug fixes:** prevent two injected content runtimes in one document from registering competing observers and ports.
- **New features:** document-scoped runtime generation and supersession reason.
- **Implementation:** `runtime-instance-fence.js` acquired before startup; losing instances shut down cleanly.

### Cycle 65 — Registry Owner Election and Lease Expiry
- **Bug fixes:** prevent dead or stale owner records from blocking a valid replacement.
- **New features:** lease expiry, election score, takeover proof, and owner generation.
- **Implementation:** `owner-election.js` integrated with session registry registration and recovery.

### Cycle 66 — Recovery Budget and Escalation Control
- **Bug fixes:** stop repeated automatic repairs from thrashing a degraded provider.
- **New features:** rolling repair budget, cooldown, exhausted state, and manual reset.
- **Implementation:** `recovery-budget.js` enforced by recovery coordinator and surfaced in Pilot.

### Cycle 67 — End-to-End Delivery Trace IDs
- **Bug fixes:** remove ambiguity when correlating outbox, ledger, batch, proof, and answer events.
- **New features:** stable trace ID and span IDs across every mechanical stage.
- **Implementation:** `delivery-trace.js`; IDs propagate in envelope metadata and safe telemetry.

### Cycle 68 — Delivery SLO and Backlog Forecast
- **Bug fixes:** replace reactive queue warnings with predicted risk before SLA breach.
- **New features:** rolling proof latency percentiles, throughput, drain-time estimate, and risk state.
- **Implementation:** `backlog-forecast.js` and safe metrics in Pilot state.

### Cycle 69 — Per-Final Trace Inspector and Search
- **Bug fixes:** make it possible to diagnose one unresolved final without reading the entire timeline.
- **New features:** search by trace, envelope, sequence, or batch; ordered mechanical spans and next action.
- **Implementation:** `trace-inspector-model.js` plus a focused Pilot panel and accessible search.

### Cycle 70 — No-Content Transport Drill and Chaos Matrix
- **Bug fixes:** expose protocol, epoch, fallback, credit, alarm, and recovery regressions before an interview.
- **New features:** operator-run drill covering direct request, forced fallback, reconnect, selective NACK, alarm audit, and invariant check.
- **Implementation:** `transport-drill.js`, dashboard command, structured drill report, and deterministic synthetic failure matrix.

## Implementation blocks

- **Block A, Cycles 46–50:** protocol, epoch, correlation, attempt lease, selective feedback.
- **Block B, Cycles 51–55:** credits, lane scoring, reconnect policy, alarm rehydration, retry intent.
- **Block C, Cycles 56–60:** atomic commits, invariants, batch transaction, dynamic budgets, scheduling.
- **Block D, Cycles 61–65:** composer, adapter drift, lifecycle, instance fence, owner election.
- **Block E, Cycles 66–70:** recovery budgets, traces, SLO forecast, inspector, transport drill.

Each block is committed separately after source and contract review. Regression tests are written before production changes, but executable runs remain deferred until Cycle 70 source work is complete, preserving the accepted test-timing rule.

## Data and privacy

All new runtime state remains in `chrome.storage.session` or in-memory page state. Trace IDs are random or deterministic hashes of existing IDs, never hashes of raw prompt text. Capability, lifecycle, credit, epoch, lease, SLO, and drill records contain metadata only. The transport drill uses no prompt, answer, clipboard, credential, account, or provider conversation content.

## Error handling

- Incompatible handshakes fail closed to the established one-time fallback.
- Epoch and lease mismatches return explicit stale-owner errors and never mutate state.
- Credit exhaustion preserves durable sender state and schedules a bounded retry.
- Commit-journal recovery chooses the last applied generation; ambiguous actionable state blocks automatic repair.
- Invariant repair changes only derivable metadata. Text-bearing or membership ambiguity requires operator action.
- Capability drift degrades readiness but never deletes ledger or outbox state.
- Recovery-budget exhaustion stops automation and preserves a direct manual repair command.
- Drill failures are isolated to synthetic no-content frames and cannot alter delivery data.

## Verification

After Cycle 70 source completion:

1. run the complete Node suite;
2. run extension syntax, security, manifest, and import-reachability validation;
3. run both AutoHotkey validators;
4. run focused protocol, restart, lifecycle, invariant, and drill suites;
5. run the repository-owned isolated browser smoke with three synthetic finals;
6. run the no-content transport drill in the isolated profile;
7. verify no normal Edge/profile state changed;
8. verify original checkout and unrelated files are untouched;
9. update the condensed technical atlas once from the verified final source and evidence;
10. validate the standalone HTML at desktop, 320 CSS pixels, print, interactions, internal links, and offline mode.

## Completion test

The work is complete only when all 25 cycles are implemented, documented, and committed; the full automated gate and both isolated browser gates pass; direct and fallback transport, exact proof, gap repair, credits, restart rehydration, lifecycle fencing, tracing, and drill reporting are evidenced; no unresolved runtime defects remain; the repository is clean except explicitly preserved pre-existing logs; and the updated downloadable HTML accurately reflects the verified system.

## Spec self-review

No placeholders remain. Every cycle maps to a mechanical owner and a concrete failure mode. The design preserves the existing lossless authority, provider adapters, privacy model, launcher behavior, and no-push/no-merge/no-tag constraint. Features that could create a parallel authority, reorder questions, activate provider tabs, or persist new text were rejected.