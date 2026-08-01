# PMIA Lossless Runtime Hardening: Cycles 11-20 Design

## Objective

Extend the approved lossless-delivery architecture through ten additional bounded cycles. The extension must convert the current implementation candidate into a release-ready system under concurrency, out-of-order events, service-worker suspension, receiver reload, storage pressure, and operator error. It must not reopen product direction or weaken the existing invariants.

## Preserved invariants

1. Every unique authoritative Window 1 final remains recoverable until verified receiver-rendered proof or explicit operator archive.
2. Ordinary new questions never interrupt an active Window 2 answer.
3. Identical wording at a later sequence is still a distinct final.
4. Background work never activates, focuses, or rearranges provider tabs.
5. Sensitive setup context and question text remain in session-scoped memory only.
6. The original checkout remains untouched; no push, merge, tag, or production install occurs.
7. Each cycle must materially improve correctness, speed, operability, or user capability.

## Chosen approach

Use owning-boundary hardening rather than adding another compatibility layer. The service worker gains a per-session mutation coordinator, the receiver gains contiguous sequence admission with bounded gap recovery, the sender outbox gains deterministic replay/backoff, and the Pilot gains a readiness decision model. Existing modules remain the source of truth; no duplicate queue, registry pending slot, or second recovery system is introduced.

## Alternatives rejected

- **Patch only the failing tests:** fast but leaves the concurrency and restart hazards unaddressed.
- **Replace the runtime wholesale:** too risky after the lossless migration and would invalidate proven provider adapters.
- **Add more dashboard features first:** visible but does not improve the highest-risk delivery guarantees.


## Required cycle buckets

Every cycle is planned, reviewed, logged, and accepted under exactly three buckets:

1. **Bug fixes:** defects or failure modes in the existing runtime.
2. **New features:** practical operator capabilities tied directly to the defect or operational risk addressed in that cycle.
3. **Implementation:** owning-boundary architecture, speed, cleanup, testability, and maintainability work.

A cycle is not complete unless all three buckets contain meaningful work. New features may expose state, provide a safe control, or reduce operator effort, but they may not duplicate state ownership or weaken lossless-delivery invariants.

## Cycles 11-20 bucket map

| Cycle | Bug fixes | New features | Implementation |
|---|---|---|---|
| 11 | Repair malformed/stale release assertions | Add categorized verification diagnostics for failures | Align the gate with ledger/batch ownership |
| 12 | Prevent stale session snapshots overwriting newer state | Show live operation activity and blocked command state in Pilot | Keyed per-session mutation coordinator |
| 13 | Preserve out-of-order finals and missing sequence gaps | Add Gap Watch with missing sequence and buffered count | Contiguous sequence buffer and ledger refill |
| 14 | Prevent replay loss, storms, and ambiguous acknowledgement | Add Outbox Retry status and safe Retry Now control | Ordered replay with capped jittered backoff |
| 15 | Prevent duplicate/partial proof from closing the wrong finals | Add Batch Proof Inspector | Stable member-set fingerprint and idempotent proof transitions |
| 16 | Prevent quota pressure from dropping actionable text | Add Memory Guard and safe compact-proven control | Category-level byte accounting and backpressure |
| 17 | Prevent false Ready signals | Add decisive Interview Readiness Gate | Pure readiness model and accessible rendering |
| 18 | Prevent redundant writes and full-dashboard rerenders | Add live Runtime Efficiency indicator | Snapshot deltas, section invalidation, and event coalescing |
| 19 | Prevent heartbeat-only recovery and repair-state lies | Add Recovery Progress checklist | Explicit recovery state machine and reconciliation gates |
| 20 | Fix final integration/browser defects | Add one-click Safe Health Report | Release validation, evidence capture, documentation, and cleanup |

## Architecture additions

### Session mutation coordinator

All read-modify-write operations for one session execute through one keyed async lane. Commands for different sessions remain concurrent. A mutation receives one loaded registry/state pair and commits once, preventing stale outer snapshots from overwriting reconciliation or telemetry updates.

### Contiguous receiver admission

The receiver accepts the next expected sequence immediately. Higher sequences enter a bounded in-memory/session checkpoint gap buffer and are released in order when missing members arrive. Duplicate accepted sequences return an explicit idempotent acknowledgement. Gap timeout raises a blocked state but never archives or drops entries; reconciliation can refill the gap from the ledger.

### Deterministic sender replay

The outbox records persisted acknowledgement separately from receiver proof, replays unacknowledged finals in sequence order, applies capped jittered backoff, and resets delay on a healthy role-port acknowledgement. Page reload restores only unresolved outbox entries for the active session.

### Storage pressure policy

Storage accounting distinguishes actionable text, proven-history aggregates, telemetry, and dashboard snapshots. Compaction order is: expired telemetry, redundant snapshots, proven detail, then warning-only. Actionable finals are never compacted. At critical pressure, sender acknowledgement is withheld so the outbox remains the safety owner.

### Readiness Gate

The Pilot derives a single go/no-go state from sender health, receiver health, adapter completeness, context armed state, dashboard connection, storage pressure, unresolved recovery state, and recent heartbeat. It shows the exact blockers and provides Check Live / Repair actions; it does not mutate provider focus.

## Ten cycles

11. Repair the verification contract and remove stale latest-only test assumptions.
12. Add per-session mutation serialization and stale-snapshot protection.
13. Add contiguous receiver sequence admission with gap buffering and refill.
14. Harden sender outbox replay, acknowledgement, and backoff.
15. Make batch membership, submission, and rendered proof fully idempotent.
16. Add quota-aware storage accounting, safe compaction, and backpressure.
17. Add the Pilot Readiness Gate and exact blocker explanations.
18. Reduce steady-state work through event coalescing, snapshot deltas, and bounded rendering.
19. Harden recovery with explicit degraded/repairing/healthy transitions and chaos-state reconciliation.
20. Clean architecture/docs, run the consolidated gate, run isolated synthetic browser proof where supported, and record release evidence.

## Verification policy

Implementation and tests are written cycle by cycle. Executable verification is deferred until Cycle 20. The final gate must run the complete Node suite, packaged-extension validator, both AutoHotkey validators, import reachability, diff/encoding checks, and isolated synthetic browser scenarios. Any failure is fixed at its owning boundary and the complete gate is rerun.

## Completion criteria

The extension is complete only when all ten cycles are documented and committed, the full automated gate passes, no unresolved final can be dropped by concurrency/gap/restart/quota paths, Readiness Gate reports truthful blockers, the original checkout is unchanged, and any browser-evidence limitation is reported explicitly.
