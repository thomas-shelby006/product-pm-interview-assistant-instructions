# PMIA Worktree Integration Audit

Date: 2026-08-03
Integration branch: `improvement/pmia-0.7.0`
Target branch: `main`

## Registered PMIA worktrees

| Worktree | Branch / state | Inclusion decision |
|---|---|---|
| `product-pm-interview-assistant-instructions` | `main` at `66ea17e` | Ancestor of the integration branch; fully included. |
| `pmia-clean-smoke-e1203b4` | detached at `e1203b4` | Ancestor of both active completion branches; fully included. |
| `product-pm-interview-assistant-improvement` | `improvement/pmia-0.7.0` | Authoritative integration worktree. |
| `.worktrees/pmia-0.11-completion` | `improvement/pmia-0.11-completion` at `8290d0b` | Parallel branch; explicitly reconciled and merged. |
| `.worktrees/runtime-0.6-session-review-loop` | `feature/runtime-0.6-session-review-loop` at `9bfae74` | Ancestor of `main`; fully included. |

## Parallel PMIA 0.11 reconciliation

The active and completion branches share `e1203b4` as their merge base. The completion branch has two unique commits; the active branch has the full PMIA 0.11 implementation plus twelve newer Adaptive Turn commits.

Tree comparison showed no missing production subsystem. Differences were limited to checkpoint documentation and one platform-smoke fixture. The active branch retains its newer plans and completion records. The stronger focus-safe smoke detail—creating the unrelated synthetic window hidden atomically—was incorporated before the ancestry merge.

## Merge acceptance

The reconciliation is accepted only when:

1. Every registered PMIA worktree HEAD is an ancestor of the integration branch, or is documented as historical and already contained.
2. The integration tree passes the complete Node, extension, AutoHotkey and isolated-browser gates.
3. The merged `main` result passes the same repository gate.
4. No unrelated repository, browser profile, normal Edge window, push or tag is changed.
5. Assistant-created temporary audit scripts and task artifacts are removed after evidence is recorded.

This audit records implementation inclusion, not permission to delete host-owned worktrees. Existing worktrees remain until the verified `main` integration is complete.
