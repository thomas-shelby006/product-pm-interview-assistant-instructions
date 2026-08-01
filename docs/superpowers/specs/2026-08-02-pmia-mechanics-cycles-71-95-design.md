# PMIA Mechanics Hardening — Cycles 71–95 Design

Date: 2026-08-02
Branch: `improvement/pmia-0.7.0`
Baseline: verified HEAD `bdd7a69`

## Objective

Improve the proven PMIA 0.7.0 runtime at its mechanical boundaries: persisted-state compatibility, delivery lookup cost, snapshot/write efficiency, degraded-mode control, and deterministic release evidence. Preserve lossless ordering, exact rendered proof, one active/next batch authority, hidden receiver operation, and the current provider adapters.

## User outcome

The operator should see fewer unexplained repair loops, faster Pilot updates under long sessions, deterministic recovery after extension upgrades or worker restarts, and one safe evidence package that explains readiness or the exact blocker. The system must remain usable without the operator understanding internal queues or state schemas.

## Non-goals

- No alternate delivery transport.
- No prompt rewriting or answer-quality changes.
- No provider tab activation or normal-profile automation.
- No disk-backed transcript, prompt, answer, resume, JD, or session-content persistence.
- No wholesale rewrite of the service worker, content runtime, or Pilot.
- No HTML atlas work until all 25 cycles and verification are complete.

## Approaches considered

1. **Dashboard-first expansion:** fastest visible output, but leaves unversioned state and repeated scans as hidden failure sources. Rejected.
2. **Core rewrite:** could simplify file sizes, but would replace a path already proven by 719 tests and isolated browser evidence. Rejected.
3. **Owner-bound mechanical hardening:** add small versioned/indexed/policy modules, integrate them at existing authorities, and expose only decisive operator truth. Selected.

## Block A — Versioned state and upgrade recovery (Cycles 71–75)

### Cycle 71 — Runtime state envelope
Persist a versioned envelope with schema version, writer version, commit time, and session records. Legacy arrays remain readable as schema 1.

### Cycle 72 — Ordered migration registry
Apply explicit one-way migrations in sequence. Unknown future schemas fail closed and are never overwritten by an older runtime.

### Cycle 73 — Last-known-good quarantine
Retain one bounded session-storage quarantine snapshot when migration or invariant validation blocks activation. Never delete or silently repair ambiguous state.

### Cycle 74 — Integrity digest and compatibility gate
Bind the envelope to a canonical digest and expose `compatible`, `migrated`, `recovered`, or `blocked` status. A digest mismatch uses the prior applied generation when possible.

### Cycle 75 — State Compatibility operator surface
Show schema, migration path, digest result, and one reason-coded next action in Pilot and Safe Health Report. No state payload or session text is displayed.

## Block B — Indexed delivery and starvation-free scheduling (Cycles 76–80)

### Cycle 76 — Ledger identity indexes
Maintain O(1) maps for ledger ID and provider-sequence identity while preserving one ordered entry array for export and proof order.

### Cycle 77 — Batch and state indexes
Maintain batch membership and state-count indexes through persist, transition, proof, archive, and compaction. Rebuild indexes deterministically after hydration.

### Cycle 78 — Indexed proof reconciliation
Index rendered fingerprints and ledger batch identity so reconciliation does not rescan every rendered turn for every pending batch.

### Cycle 79 — Deadline queue with stable order
Select the oldest due unresolved partition without changing sequence order inside the selected batch. Explicit hold and active answer remain authoritative.

### Cycle 80 — Credit hysteresis and burst smoothing
Prevent receiver credits from oscillating during short bursts. Credits fall immediately on danger and recover only after a stable low-pressure window.

## Block C — Snapshot, telemetry, and write efficiency (Cycles 81–85)

### Cycle 81 — Canonical section fingerprints
Replace repeated whole-section `JSON.stringify` comparisons with canonical fingerprints that ignore known volatile fields and preserve semantic equality.

### Cycle 82 — Structural snapshot cache
Cache fingerprints and immutable clones per top-level snapshot section. Unchanged sections are reused; dashboard deltas copy only changed sections.

### Cycle 83 — Cached ledger views and counts
Serve unresolved, pending, proven, and count views from maintained indexes. Invalidate only the affected view after a transition.

### Cycle 84 — Persistence urgency policy
Classify writes as durable-immediate, semantic-coalesced, or heartbeat-only. Final ownership and proof remain immediate; safe telemetry/checkpoints share one bounded flush.

### Cycle 85 — Runtime performance budget
Record operation counts, payload bytes, cache hits, and commit reasons. Add deterministic complexity budgets for large ledgers and long timelines; avoid flaky wall-clock thresholds.

## Block D — Bounded degraded mode and causal recovery (Cycles 86–90)

### Cycle 86 — Capability probation and quarantine
A provider surface that disappears enters probation. Automatic writes pause only after repeated critical samples; recovery requires consecutive healthy samples.

### Cycle 87 — Root-cause classifier
Rank one owning blocker across storage, registration, transport, provider capability, sequence, batch, and proof. Suppress secondary symptoms from triggering parallel repairs.

### Cycle 88 — Recovery escalation matrix
Map the owning cause to one bounded action: reconcile, reconnect, re-register, reload managed tab, queue-only mode, or operator handoff. Respect the existing recovery budget.

### Cycle 89 — Queue-only degraded mode
When provider writes are unsafe, continue durable sender persistence and exact sequencing but block composer mutation/submission. Resume only after compatibility and capability stability.

### Cycle 90 — Consistency watchdog
Run a lightweight no-content audit on startup, alarm wake, and meaningful state changes. Repair deterministic metadata; block and surface ambiguous state without polling provider content.

## Block E — Deterministic fault and release evidence (Cycles 91–95)

### Cycle 91 — Fault scenario harness
Create an in-memory, test-only scenario runner for storage interruption, stale epoch, port loss, capability loss, sequence gap, and worker restart boundaries. Production behavior has no fault switch.

### Cycle 92 — Restart continuity scenario
Exercise committed state, outbox intent, alarms, registry leases, ledger indexes, and active/next batch recovery across a reconstructed service-worker state.

### Cycle 93 — Expanded no-content chaos drill
Run safe control-plane scenarios and return structured pass/fail evidence. The drill must not inject provider messages, read conversations, or mutate delivery content.

### Cycle 94 — Safe support bundle
Generate one metadata-only diagnostic package containing compatibility, owning blocker, transport lanes, invariant audit, trace spans, performance budget, drill results, and checksums.

### Cycle 95 — Release evidence manifest
Generate a deterministic manifest with commit, extension version, source hashes, automated-gate summary, smoke evidence hashes, and cleanup status. The release gate rejects missing or mismatched evidence.

## Architecture and ownership

- `runtime-state-schema` owns envelope normalization, canonical digest, and migration order.
- `RuntimePilotStore` remains the sole persistence authority.
- `DeliveryLedger` remains the sole final-state authority and owns its indexes.
- `BatchPlanner` remains the sole active/next partition authority.
- `RuntimePilotController` coordinates policies but does not own schema, indexes, or diagnosis rules.
- Provider adapters remain the only DOM selectors and actions.
- Pilot renders safe derived models; it does not infer delivery truth from DOM.

## Error handling

- Future schema: block with `future_schema`, preserve raw state, do not save.
- Digest mismatch: recover prior applied generation when valid; otherwise quarantine and block.
- Index inconsistency: rebuild deterministically from the ordered ledger and record an audit.
- Capability instability: enter probation, then queue-only mode if critical instability persists.
- Exhausted recovery: stop automatic mutation and require one explicit operator action.
- Fault drill failure: record the failed stage; never run the corresponding destructive production action.

## Testing and completion

Each cycle starts with a focused failing contract and ends with its focused suite green. Each five-cycle block receives an integration audit and commit. The final phase requires the complete repository validator, isolated browser smoke, expanded no-content drill, restart continuity evidence, desktop and 320 CSS-pixel Pilot checks, clean original checkout, no push/merge/tag, and updated evidence. Only then may the standalone HTML atlas be edited.
