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
| `.worktrees/pmia-final-integration` | `improvement/pmia-0.7.0` at `4bf4851`, clean | Authoritative combined verification worktree. |
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

## Final acceptance

Readiness remains blocked until:

1. the complete Node, extension, and AutoHotkey gate passes on exact committed integration HEAD;
2. fresh isolated Edge evidence passes all Adaptive Turn, delivery, UI, profile-isolation, and cleanup conditions;
3. assistant-created task temp is removed after evidence retention;
4. the v2 manifest reports all eight worktrees included and accounted, clean target/integration, no tag at integration, and explicit no-push confirmation;
5. the verified tree is integrated into `main` and reverified;
6. the final technical atlas is updated last.

This audit does not authorize deletion of any worktree.
