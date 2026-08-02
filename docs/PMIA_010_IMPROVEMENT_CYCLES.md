# PMIA 0.10 Improvement Program

## Control-plane coherence foundation — verified

Commit scope: canonical command registry, command reachability audit, repaired Pilot controls, explicit-choice safety, stale-safe policy impact model, Production UI release gating, and active-version alignment.

### Confirmed defects fixed

- `compact_proven` and `retry_outbox` now pass the standard dashboard protocol and reach their existing controller owners.
- Duplicate `openShortcutHelp` dashboard ID was removed; both shortcut-help triggers use the shared focus coordinator.
- No-response and draft-conflict Decision Center items no longer execute implicit defaults. They navigate to explicit choice surfaces.
- Release evidence now requires Production desktop, 320-pixel, 280-pixel, print, accessibility, control, command-registry, and command-reachability proof.
- Active runtime, installation, setup, context, status, and release surfaces identify PMIA 0.10.0 candidate.

### Architecture changes

- `operator-command-registry.js` is the canonical command metadata source.
- `dashboard-protocol.js` derives its allow-list from the registry while retaining payload sanitizers.
- `command-reachability-audit.js` verifies visible controls, registry entries, controller owners, and unique DOM IDs.
- `operator-choice-model.js` fingerprints unresolved human choices and rejects stale selections.
- `policy-impact-preview.js` derives protected-count, provider-write, post-answer, risk, eligibility, and expiry evidence.

### Verification

- Focused foundation gate: 102/102 tests passed.
- Complete foundation gate: 963/963 tests passed.
- Extension validation: 425 JavaScript files, 18 required runtime surfaces, 242 reachable production modules.
- Main launcher and Session Review companion passed silent validation.
- Complete gate exit code: 0.

## Next phase

Ten user-facing live-interview cycles are authorized. Their source work begins only from this verified foundation. The thirty-cycle bug campaign follows after all ten features are source-complete and feature-verified. The standalone technical HTML remains deferred until the entire PMIA 0.10 program is complete.
## Ten user-facing live-interview cycles — verified

1. Persistent Live Action Dock across Live, Inbox, Timeline, Review, Assist, and Production views.
2. Stale-safe Policy Impact Preview for Safe/Balanced/Fast profiles and containment changes.
3. Explicit Choice Workspace for no-response and draft-conflict decisions.
4. Interview Milestone Navigator with recovery and Back-to-live landmarks.
5. Sequence-safe Operator Inbox Triage Board for urgent, stale, deferred, pinned, follow-up, and proof-pending questions.
6. Provider Route Doctor separating composer, adapter, write-safety, visibility, and scheduler conditions.
7. Recovery Runbook Console with checks, deadline, retry budget, automatic eligibility, and one current action.
8. Searchable Command History with result, duration, replay count, affected state, and bounded metadata undo.
9. Live Performance and Backlog Forecast separating intake, proof throughput, provider delay, internal render cost, and catch-up time.
10. Guided Preflight and Handoff Wizard reusing current readiness, self-test, end guard, export, privacy, and cleanup owners.

### Feature architecture

- One `render-live-assist.js` renderer owns the Assist workspace.
- The Action Dock and all Assist cards are projections over the authoritative snapshot.
- `resolve_operator_choice` validates the exact choice ID and snapshot fingerprint in the controller before delegating to existing receiver commands.
- Operating-profile and containment mutations require a current policy-impact preview.
- No feature reorders, removes, edits, or fabricates ledger entries.

### Feature verification

- Focused feature gate: 83/83 tests passed.
- Complete feature gate: 974/974 tests passed.
- Extension validation: 446 JavaScript files, 18 required runtime surfaces, 253 reachable production modules.
- Main launcher and Session Review companion passed silent validation.
- Complete gate exit code: 0.

## Next phase

The thirty-cycle bug campaign now hardens the complete PMIA 0.10 control plane and live-assist system. The technical HTML remains deferred until the campaign and final isolated-browser evidence are complete.
## Seventy-cycle hardening and reliability extension — source complete

The completed campaign contains the approved thirty bug cycles, twenty additional bug cycles, and twenty user-facing Reliability Center improvements.

### Control, lifecycle, and lossless mechanics

- Command payloads use strict allow-lists for consequential actions.
- Dashboard operations clear timers, coalesce duplicate requests, fail pending work once, and invalidate stale policy previews.
- Runtime injection uses generation-safe stale-lease takeover and blocks healthy duplicates.
- Frozen, discarded, prerendered, and terminated pages cannot own provider writes.
- Alarm schedules deduplicate deterministically and expose overdue catch-up.
- Cleanup transactions enforce ordered, retryable continuation.
- Sender replay fails closed when attempt-state persistence fails.
- Ledger indexes expose deterministic duplicate repair and audit results.
- Sequence gaps provide metadata-only NACK evidence without mutating buffered finals.
- Receiver credits clamp to capacity and recover through hysteresis.
- Fair scheduling promotes starved partitions without changing sequence order.
- Interrupt confirmation fingerprints every active, preserved, and latest member.
- Manual merge remains idempotent and retains one protected PMIA prompt.
### Storage, rendering, privacy, and release

- Storage accounting protects actionable ownership and handles malformed Unicode deterministically.
- Render scheduling cancels stale work, coalesces sections, and contains renderer exceptions.
- Virtual lists remain bounded under invalid or extreme dimensions.
- Route readiness requires live roles, composer evidence, context, write safety, and successful self-test evidence.
- Route transitions freeze writes while active or waiting protected batches exist.
- Backlog forecasts distinguish insufficient evidence from real delivery breach.
- Accessibility audits cover duplicate IDs, controlled targets, labels, dialogs, live regions, focus return, and narrow layouts.
- Support bundles recursively remove content-bearing keys and credential-like values.
- Release handoff fails closed without clean source, exact commit binding, automated/browser/Assist evidence, privacy, cleanup, and no unresolved ownership.

### Reliability Center improvements

The Assist workspace now includes twenty grouped operator projections: Command Health, Replay Guard, Route Transition Preview, Session Safety, Backlog Confidence, Triage Summary, Recovery ETA, Choice Freshness, Action Dock Density, Disabled-action Explanations, Incident Trend, Milestone Quality, Batch Fairness, Storage Reclaim, Lifecycle Wake History, Proof Coverage, Keyboard Readiness, Release Readiness, Interview Pacing, and Evidence Export Summary.

These are view-only projections over authoritative state. They do not create a second command bus, state store, transport owner, proof owner, or recovery owner.

### Consolidated automated verification

- New 70-cycle regression gate: 71/71 tests passed.
- Complete repository Node gate: 1,075/1,075 tests passed.
- Extension validation: 451 JavaScript files, 18 required runtime surfaces, and 255 reachable production modules.
- Complete validator process exited 0.

Fresh exact-commit validation, isolated Edge evidence, deterministic release/handoff manifests, cleanup verification, and the final PMIA 0.10 technical HTML remain the closing gates.
## Operations Lab Cycles 71–150 — source complete

### Bug cycles 71–90: transport, proof, persistence, and operator safety

- Epoch-safe request correlation, bounded pending capacity, and atomic response claims.
- Fingerprinted generation-ordered dashboard deltas with full-resync requirements.
- Lossless in-flight commit follow-up and deterministic all-session flushing.
- ABA-safe delivery leases and stronger rendered-turn identity.
- Consumable proof records, corrected partial-proof recovery, and deterministic bounded proof retry.
- Required-capability drift, future-evidence rejection, single-owner circuit probes, bounded reconnect guidance, broader end counts, state-fingerprinted undo, and race-safe live announcements.

### Improvement cycles 91–110: Operations Lab foundation

- Flow: Question Flow Map, Queue Aging Bands, Decision SLA, Bottleneck Attribution.
- Transport: Hop Trace, Circuit Countdown, Profile Explanation, Degraded-Mode Explainer.
- Proof: Provenance Explorer, Partial Repair Preview, Duplicate Capture Detector, Export Readiness.
- Recovery: Checkpoint Timeline, read-only Recovery Simulation, Safe Action Checklist, Attention Budget.
- Closure: Pacing Signal, Silence Window, Alert Suppression Summary, Closure Preview.
### Bug cycles 111–130: production integration and Lab hardening

- Checked snapshot synchronization is active in the dashboard, with controller generations, heartbeat-compatible bases, stale-full rejection, explicit resync, and bounded resync evidence.
- Dashboard pending commands are capped while identical pending operations retain promise reuse.
- Operations Lab local state resets by session, validates views and scenarios, follows keyboard tab semantics, and never dispatches a runtime command.
- Ages and countdowns clamp safely, timestamp zero remains valid, output is privacy-audited, selected-view rendering remains bounded, and release evidence requires all Operations Lab layouts.

### Improvement cycles 131–150: operator insight expansion

- Signals: Change Radar, Confidence Ledger, Attention Saturation, Decision Queue.
- Forecast: Queue Projection, Proof ETA, Recovery ETA, Interview Pace.
- Plans: Route Switch Plan, Containment Exit Plan, Resume Plan, End Session Plan.
- Evidence: Evidence Coverage, Missing Proof Matrix, Support Bundle Preview, Release Delta.
- Review: Milestone Trail, Incident Outcome Review, Decision Effectiveness, Next Mock Checklist.

Operations Lab is a read-only, metadata-only projection inside Assist. It exposes ten local views, five recovery scenarios, forty bounded capabilities, four cards per selected view, and no second state, transport, command, provider-write, proof, or recovery owner. Executable verification remains deferred until all source work is complete.
