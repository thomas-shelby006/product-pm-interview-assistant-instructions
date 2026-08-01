# PMIA Live Operator Cycles 96-195 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Tests are authored first but executed only after Cycle 195 because the user explicitly requested deferred consolidated testing.

**Goal:** Add 50 substantial live-operator cycles, then harden them through 50 substantial reliability cycles without weakening lossless delivery.

**Architecture:** Extend Runtime Pilot through focused pure models, one versioned operator-state section inside Runtime Pilot State, existing dashboard commands, and the established controller mutation lane. Optional Edge/Chrome side-panel hosting reuses the same dashboard application. The delivery ledger, sequence buffer, provider adapters, and rendered-proof boundary remain unchanged.

**Tech Stack:** Manifest V3 extension service worker, `chrome.storage.session`, long-lived ports with one-time-message fallback, `chrome.alarms`, optional `sidePanel`, dependency-free HTML/CSS/JavaScript, AutoHotkey v2 launcher.

## Global constraints
- No provider-content fields in new metadata or exports.
- No automatic provider-window activation or focus.
- No delivery reordering; priority is advisory metadata only.
- No executable test command until all tasks are source-complete.
- Current condensed HTML is updated once, after final verification.
- Original checkout remains unchanged; no push, merge, or tag.

---

### Task 1: Cycles 96-100 - Session Phase Navigator
**Files:** create `shared/session-phase-model.js`, `dashboard/session-phase-model.js`; modify Pilot State, controller, dashboard HTML/JS/CSS; test `cycles-96-100-session-phase.test.js`.
**Produces:** versioned phase state, prerequisite checklist, next-safe-action model, phase history, manual phase checkpoint command.
- [ ] Write five regression contracts for derived phase, blockers, transition history, manual checkpoint, and privacy.
- [ ] Implement pure phase derivation from readiness, ledger, answer, and recovery metadata.
- [ ] Persist only phase/checkpoint metadata in Runtime Pilot State.
- [ ] Add Live-panel navigator with current phase, completed phases, blockers, and next action.
- [ ] Record Cycle 96-100 evidence and commit.

### Task 2: Cycles 101-105 - Incident Center
**Files:** create `shared/incident-center.js`, `dashboard/incident-center-model.js`; modify state/controller/protocol/dashboard; test `cycles-101-105-incident-center.test.js`.
**Produces:** deduplicated incidents, severity/owner/action, acknowledge, snooze, resolve, and incident history.
- [ ] Write five contracts for deduplication, severity escalation, acknowledgement, snooze expiry, and content stripping.
- [ ] Derive incidents from warnings, root cause, policy, storage, gap, proof, and recovery state.
- [ ] Persist bounded incident metadata and expose reason-coded commands.
- [ ] Add accessible non-blocking incident region and explicit blocking dialog only for destructive ambiguity.
- [ ] Record Cycle 101-105 evidence and commit.

### Task 3: Cycles 106-110 - Command Palette
**Files:** create `dashboard/command-palette-model.js`, `shared/operator-command-catalog.js`; modify dashboard/protocol; test `cycles-106-110-command-palette.test.js`.
**Produces:** searchable safe command catalog, context availability, keyboard navigation, command preview, recent commands.
- [ ] Write five contracts for search ranking, availability, keyboard loop, safe preview, and recent-command ordering.
- [ ] Centralize command labels, shortcuts, danger level, required state, and confirmation policy.
- [ ] Add Ctrl/Cmd+K palette with focus return and no execution on search.
- [ ] Route execution through existing request IDs and Operation Guard.
- [ ] Record Cycle 106-110 evidence and commit.

### Task 4: Cycles 111-115 - Operator Markers
**Files:** create `shared/operator-markers.js`, `dashboard/operator-markers-model.js`; modify state/controller/protocol/dashboard; test `cycles-111-115-operator-markers.test.js`.
**Produces:** metadata-only bookmarks, categories, timestamps, trace association, and review export.
- [ ] Write five contracts for bookmark identity, category validation, trace linking, bounded retention, and text exclusion.
- [ ] Persist labels from an allow-list only; no freeform question/answer text.
- [ ] Add mark-current-question, mark-answer, and review-filter actions.
- [ ] Include markers in Safe Health and support exports as codes/timestamps only.
- [ ] Record Cycle 111-115 evidence and commit.

### Task 5: Cycles 116-120 - Sequence-Safe Question Triage
**Files:** create `shared/question-triage.js`, `dashboard/question-triage-model.js`; modify ledger projection/state/controller/dashboard; test `cycles-116-120-question-triage.test.js`.
**Produces:** urgency, pin, defer, focus-latest visibility, and advisory reason without sequence mutation.
- [ ] Write contracts proving triage never changes provider sequence or ledger order.
- [ ] Add metadata overlay keyed by ledger item ID with bounded values.
- [ ] Show pinned/deferred/urgent state in Inbox and active/next batch summaries.
- [ ] Add safe commands to set/clear triage metadata.
- [ ] Record Cycle 116-120 evidence and commit.

### Task 6: Cycles 121-125 - Guided Stabilize Runbook
**Files:** create `shared/stabilization-runbook.js`, `dashboard/stabilization-runbook-model.js`; modify controller/protocol/dashboard; test `cycles-121-125-stabilization-runbook.test.js`.
**Produces:** evidence-led diagnose, verify, reconcile, repair, and confirm steps with cancellation and bounded escalation.
- [ ] Write contracts for step selection, no-op healthy run, cancellation, budget exhaustion, and queue-only preservation.
- [ ] Compose existing self-test, Check Live, consistency audit, reconcile, and cause-driven repair commands.
- [ ] Persist runbook progress and last successful checkpoint only.
- [ ] Add one Stabilize control and step-by-step progress surface.
- [ ] Record Cycle 121-125 evidence and commit.

### Task 7: Cycles 126-130 - Delivery SLO History
**Files:** create `shared/slo-history.js`, `dashboard/slo-history-model.js`; modify Pilot metrics/dashboard; test `cycles-126-130-slo-history.test.js`.
**Produces:** bounded p50/p95 history, backlog slope, drain projection, breach streak, and trend status.
- [ ] Write contracts for sample bucketing, bounded retention, slope, breach streak, and no-content snapshots.
- [ ] Record semantic metric samples only when proof/backlog state changes.
- [ ] Derive watch/at-risk/breached/recovering trend without adding timers.
- [ ] Add compact accessible trend view and threshold explanation.
- [ ] Record Cycle 126-130 evidence and commit.

### Task 8: Cycles 131-135 - Provider Health History
**Files:** create `shared/provider-health-history.js`, `dashboard/provider-health-model.js`; modify telemetry/state/dashboard; test `cycles-131-135-provider-health.test.js`.
**Produces:** role health transitions, drift episodes, scheduler mode, transport lane, and recovery duration history.
- [ ] Write contracts for transition-only recording, episode coalescing, bounded retention, recovery duration, and privacy.
- [ ] Store provider/role/reason/state metadata only.
- [ ] Add per-role health timeline and last stable period.
- [ ] Feed recurring provider drift into incident ownership without automatic reload.
- [ ] Record Cycle 131-135 evidence and commit.

### Task 9: Cycles 136-140 - Optional Side-Panel Pilot
**Files:** create `dashboard/side-panel-host.js`; modify manifest, background, dashboard CSS/JS, launcher docs; test `cycles-136-140-side-panel.test.js`.
**Produces:** user-triggered side-panel mode, same dashboard app, tab/window scoping, lifecycle telemetry, and fallback to dashboard window.
- [ ] Write contracts for manifest packaging, user-action-only open, shared app route, close/open telemetry, and fallback.
- [ ] Add `sidePanel` permission and default path without changing automatic launch behavior.
- [ ] Add explicit Open in sidebar action from Pilot/extension command context.
- [ ] Adapt layout for narrow persistent panel and preserve managed-window mode.
- [ ] Record Cycle 136-140 evidence and commit.

### Task 10: Cycles 141-145 - Session Checkpoints and Rehearsal
**Files:** create `shared/session-checkpoints.js`, `dashboard/rehearsal-model.js`; modify state/controller/protocol/dashboard; test `cycles-141-145-session-checkpoints.test.js`.
**Produces:** safe mechanical checkpoint, rehearsal reset, readiness rehearsal, transport rehearsal, and checkpoint comparison.
- [ ] Write contracts for metadata-only checkpoints, bounded history, rehearsal isolation, reset safety, and comparison.
- [ ] Capture ledger counts, phase, health, policy, proof metrics, and commands without content.
- [ ] Add Rehearse mechanics command that never submits provider content.
- [ ] Add checkpoint compare view and explicit discard of rehearsal state.
- [ ] Record Cycle 141-145 evidence and commit.

---

### Task 11: Cycles 146-150 - Active Session Guard
**Files:** create `shared/active-session-guard.js`; modify registry/background/launcher/dashboard; test `cycles-146-150-session-guard.test.js`.
**Produces:** one active interview lease, collision detection, takeover confirmation, stale lease recovery, and session switcher.
- [ ] Write contracts for fresh conflict, stale takeover, explicit transfer, cleanup, and no cross-session command routing.
- [ ] Persist an active-session lease in extension session storage.
- [ ] Block accidental second active session while allowing explicit rehearsal sessions.
- [ ] Add Pilot session switch/transfer surface with exact session IDs.
- [ ] Record Cycle 146-150 evidence and commit.

### Task 12: Cycles 151-155 - Command Safety and Undo
**Files:** create `shared/command-safety-policy.js`, `shared/reversible-command-journal.js`, dashboard models; modify controller/protocol/dashboard; test `cycles-151-155-command-safety.test.js`.
**Produces:** command risk classification, precondition preview, reversible result token, undo deadline, and non-reversible confirmation.
- [ ] Write contracts for safe/reversible/destructive classes, stale preconditions, one-use undo, expiry, and replay idempotency.
- [ ] Allow undo only for hold, pause, layout, marker, triage, and incident acknowledgement operations.
- [ ] Keep archive/end/interrupt non-reversible and explicitly confirmed.
- [ ] Add last reversible action and Undo control to Operation Guard.
- [ ] Record Cycle 151-155 evidence and commit.

### Task 13: Cycles 156-160 - Durable Incident State
**Files:** extend incident center/state migration/store; test `cycles-156-160-incident-durability.test.js`.
**Produces:** restart-safe acknowledgements, snooze alarms, recurrence count, stale acknowledgement clearing, and incident digest.
- [ ] Write contracts for persistence, alarm rehydration, recurrence, resolved cleanup, and digest stability.
- [ ] Persist incident control state separately from derived incident symptoms.
- [ ] Rehydrate snooze deadlines through `chrome.alarms`.
- [ ] Ensure a higher-severity recurrence breaks snooze and becomes visible.
- [ ] Record Cycle 156-160 evidence and commit.

### Task 14: Cycles 161-165 - Provider Throttle and Admission Control
**Files:** create `shared/provider-admission-policy.js`; modify receiver batching, telemetry, state/dashboard; test `cycles-161-165-provider-admission.test.js`.
**Produces:** provider cooldown, recent failure window, credit cap, retry-after, and recovery hysteresis.
- [ ] Write contracts for burst failures, cooldown entry, bounded credit, stable recovery, and active-answer preservation.
- [ ] Combine capability probation, transport score, recent submit failures, and receiver credit.
- [ ] Block only provider writes; continue durable intake.
- [ ] Add admission state and retry estimate to Pilot.
- [ ] Record Cycle 161-165 evidence and commit.

### Task 15: Cycles 166-170 - Aging-Aware Batch Fairness
**Files:** create `shared/batch-fairness-policy.js`; modify planner projections/dashboard; test `cycles-166-170-batch-fairness.test.js`.
**Produces:** oldest-item protection, urgency aging, defer ceiling, fairness reason, and starvation proof.
- [ ] Write contracts proving order preservation and bounded defer metadata.
- [ ] Use triage urgency only as an explanatory flag; sequence remains primary.
- [ ] Surface oldest protected item and fairness reason in active/next batch views.
- [ ] Add deterministic starvation audit to transport drill.
- [ ] Record Cycle 166-170 evidence and commit.

### Task 16: Cycles 171-175 - Dashboard Offline and Reconnect Truth
**Files:** create `dashboard/dashboard-cache.js`, `shared/dashboard-connection-state.js`; modify dashboard/controller; test `cycles-171-175-dashboard-offline.test.js`.
**Produces:** last-known-safe snapshot, stale badge, reconnect age, pending-command cancellation, and no false Live state.
- [ ] Write contracts for disconnect, cached snapshot, stale age, reconnect replacement, and command rejection offline.
- [ ] Keep cached dashboard state in extension page session memory only.
- [ ] Render stale data read-only with exact timestamp and disabled mutation controls.
- [ ] Restore live delta baseline only after a fresh full snapshot.
- [ ] Record Cycle 171-175 evidence and commit.

### Task 17: Cycles 176-180 - Worker Wake Lease and Alarm Audit V2
**Files:** create `shared/worker-wake-lease.js`; modify background/store/alarm audit/dashboard; test `cycles-176-180-worker-wake.test.js`.
**Produces:** wake reason, lease generation, expected work, completion, abandoned-work detection, and startup recovery.
- [ ] Write contracts for overlapping wake events, expiry, completion, restart recovery, and metadata privacy.
- [ ] Wrap alarm, port command, forward, and startup work in one session-scoped wake lease.
- [ ] Persist only lease metadata needed to identify interrupted work.
- [ ] Add wake health to consistency audit and Safe Health Report.
- [ ] Record Cycle 176-180 evidence and commit.

### Task 18: Cycles 181-185 - Crash-Safe Operator State
**Files:** create `shared/operator-state-checkpoint.js`; modify state migrations/store/controller; test `cycles-181-185-operator-checkpoint.test.js`.
**Produces:** atomic operator-feature checkpoint, schema migration, integrity digest, last-known-good rollback, and quarantine.
- [ ] Write contracts for phase/incident/marker/triage/runbook state continuity.
- [ ] Store operator metadata in a versioned nested envelope with canonical digest.
- [ ] Recover last applied operator state independently of delivery ledger state.
- [ ] Quarantine ambiguous operator metadata without blocking final persistence.
- [ ] Record Cycle 181-185 evidence and commit.

### Task 19: Cycles 186-190 - Accessibility and Narrow-Mode Hardening
**Files:** modify dashboard HTML/CSS/JS and accessibility models; test `cycles-186-190-accessibility.test.js`.
**Produces:** focus-contained dialogs, polite status, assertive blocking alerts, keyboard landmarks, reduced motion, and 320-pixel reflow.
- [ ] Write contracts for dialog focus loop/return, live-region roles, shortcut labels, reduced motion, and no overflow.
- [ ] Keep routine incidents non-modal; reserve alertdialog for destructive ambiguity.
- [ ] Add landmark navigation and visible focus treatment.
- [ ] Verify side-panel and managed-window layouts share the same semantics.
- [ ] Record Cycle 186-190 evidence and commit.

### Task 20: Cycles 191-195 - Deterministic Release and Support V2
**Files:** extend fault matrix, isolated smoke, support bundle, evidence manifest, validator, docs; test `cycles-191-195-release-v2.test.js`.
**Produces:** user-feature fault scenarios, support bundle v2, evidence manifest v2, UI screenshots, and exact cleanup proof.
- [ ] Add deterministic scenarios for incident state, command undo, side panel, offline cache, wake lease, and operator checkpoint.
- [ ] Expand isolated smoke to exercise command palette, phase navigator, incident acknowledgement, Stabilize, and side-panel fallback without content access.
- [ ] Bind support bundle v2 and evidence manifest v2 to operator-state schema and source hashes.
- [ ] Run one consolidated test/validator/AHK/browser campaign only after all source work is complete.
- [ ] Update the current condensed technical HTML once from final evidence, validate wide/narrow/print/interactions, and deliver.
