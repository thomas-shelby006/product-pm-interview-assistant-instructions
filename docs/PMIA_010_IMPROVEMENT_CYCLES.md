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