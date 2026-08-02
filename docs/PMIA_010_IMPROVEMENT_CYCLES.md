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