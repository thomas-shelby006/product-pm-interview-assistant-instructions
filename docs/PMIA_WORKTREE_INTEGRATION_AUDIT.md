# PMIA Worktree Integration Audit

Date: 2026-08-03
Integration branch: `improvement/pmia-0.7.0`
Lane-merge checkpoint: `4bf4851`
Target branch: `main`

## Registered PMIA worktrees

| Worktree | Branch / state | Reconciliation |
|---|---|---|
| `product-pm-interview-assistant-instructions` | `main` at `66ea17e`, clean | Ancestor of integration; target remains unchanged pending final verification. |
| `pmia-clean-smoke-e1203b4` | detached `e1203b4`, clean | Historical clean smoke checkpoint; ancestor of integration. |
| `.worktrees/pmia-final-evidence` | `release/pmia-final-evidence` at `92e1d99`, clean | Five-scenario release evidence contract merged at `613b2ea`. |
| `.worktrees/pmia-final-integration` | `improvement/pmia-0.7.0` at `2a2a0fc`, clean before this documentation checkpoint | Authoritative combined verification worktree. |
| `.worktrees/pmia-main-integration` | `test/pmia-main-integration` at `da1a5ad`, clean | Content-sensitive worktree readiness manifest merged at `4bf4851`. |
| `product-pm-interview-assistant-improvement` | `fix/pmia-admission-lane` at `685c859`; assistant task temp remains | Admission repair merged at `8d32f66`; temp cleanup is deferred until evidence is retained. |
| `.worktrees/pmia-0.11-completion` | `improvement/pmia-0.11-completion` at `8290d0b`; one untracked short design | Committed head is included. Dirty content is exactly fingerprinted and classified `superseded_preserved`; the fuller integrated design is authoritative. |
| `.worktrees/runtime-0.6-session-review-loop` | `feature/runtime-0.6-session-review-loop` at `9bfae74`; historical dirty review-loop work | Committed head is included. Dirty content is exactly fingerprinted and classified `superseded_preserved`; current tracker/review files and later fixes are authoritative. |

## Machine-verifiable disposition rule

`runtime/scripts/build-worktree-integration-manifest.mjs` emits `pmia-worktree-integration/v2`. A dirty worktree is accounted only when a disposition matches its branch, exact HEAD, tracked binary diff, and SHA-256 hashes of every untracked file. The disposition must identify integrated replacement commits and files, and those commits/files must exist in the integration branch. Stale or unused dispositions block readiness.

The exact historical records are in `docs/evidence/2026-08-03-pmia-worktree-dispositions.json`. They preserve old work without backward-merging stale implementations or deleting host-owned worktrees.

## Merge record

1. Admission lane merged at `8d32f66`.
2. Release Evidence lane merged at `613b2ea`.
3. Main Integration lane merged at `4bf4851`.

The lane file sets were non-overlapping and the integration worktree is clean.

## Automated verification

Exact commit `31a8c0f` passed 1,315/1,315 tests, extension validation across 513 JavaScript files, 18 required runtime surfaces, 287 reachable production modules, and all three AutoHotkey validations. The complete log is retained outside the repository under `PMIA-Evidence-Archive\adaptive-turn-31a8c0f-20260803-final`.

The first browser attempt at `c71315f` exposed a stale smoke-observer boundary, not a transport regression: runtime proof and answer completion succeeded, but the external reader omitted compact ChatGPT message nodes. Commit `c609d19` aligns the smoke reader with production transcript selectors; 86/86 focused tests passed.

Exact `8d8d375` then passed the complete automated gate. The next browser run exposed a real state-ownership race: a late receiver restore event carrying older `live` coordination rolled back a newer operator Pause before Q2. Commit `7779cd1` makes coordination/checkpoint merges monotonic while preserving meaningful recovery over a default placeholder. The owning and adjacent matrix passed 98/98.

The third browser attempt then preserved Pause and admitted Q2 but exposed another acceptance boundary: sender outbox state still used global generic background serialization, delaying persistence acknowledgement and blocking Q3. Commit `a9840e3` moves sender outbox GET/SET/REMOVE to the per-session acceptance lane; 82/82 focused tests passed.

The fourth browser attempt proved durable Q2/Q3 ownership and an empty outbox but exposed receiver admission backpressure during Pause. Commit `94c298f` permits staging-only credits during `paused_accumulating` while retaining all hard safety/capacity blocks; 69/69 focused tests passed.

The fifth attempt proved local receiver coordination can lag the controller decision. Commit `06b010c` carries `paused_stage` only on the scheduled delivery copy so receiver staging is explicit without mutating the durable ledger envelope; 113/113 focused tests passed.

The sixth attempt exposed one final propagation omission: the smoothing wrapper dropped `stagingOnly`. Commit `74a3956` forwards it through hysteresis; 114/114 focused tests passed.

Exact `3d84ddd` passed the full automated gate with 1,326/1,326 tests and all validators. The seventh browser run then proved Q2 staged ownership, durable Q3, empty outbox, and stable Pause, but an older empty receiver telemetry checkpoint overwrote the newer `next_batch_draft` projection. Commit `2a2a0fc` makes batch checkpoint restoration causal by comparing telemetry capture time with the latest semantic batch-event time. Both stale preservation and newer explicit clearing are covered; the owning matrix passed 47/47 and the widened matrix passed 212/212.

## Final acceptance

Readiness remains blocked until:

1. the complete Node, extension, and AutoHotkey gate passes on exact committed integration HEAD;
2. fresh isolated Edge evidence passes all Adaptive Turn, delivery, UI, profile-isolation, and cleanup conditions;
3. assistant-created task temp is removed after evidence retention;
4. the v2 manifest reports all eight worktrees included and accounted, clean target/integration, no tag at integration, and explicit no-push confirmation;
5. the verified tree is integrated into `main` and reverified;
6. the final technical atlas is updated last.

This audit does not authorize deletion of any worktree.
