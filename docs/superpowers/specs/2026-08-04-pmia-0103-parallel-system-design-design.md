# PMIA 0.10.3 Parallel System-Design Hardening

## Objective

Advance the verified PMIA 0.10.2 runtime to a local-only 0.10.3 release through four isolated workstreams: 50 bug-fix cycles, 50 deployment-polish cycles, 50 high-level-design cycles, and 50 low-level-design cycles. Integrate only verified changes, preserve the immutable 0.6.1 rollback archive, rebuild the stable current package, and leave one clean source checkout plus the archive and current deployment.

## Accepted constraints

- Work autonomously from repository evidence and the existing approved plan.
- Use multiple Git worktrees and parallel read/test workflows.
- Do not weaken provider-rendered delivery proof or lossless ownership.
- Do not edit Edge Preferences, Secure Preferences, cookies, or session data.
- Do not push, tag, publish, create a PR, or perform cloud deployment.
- Normal Edge must remain untouched during automated browser evidence.
- Browser-internal extension activation remains a manual Edge boundary.
- Remove only verified task-created or superseded PMIA traces after replacement verification.

## Workstream architecture

### Runtime bug-fix worktree

Owns reproduced defects in admission, outbox, ledger, sequence recovery, Adaptive Turn, provider proof, dashboard truth, state migration, session end, deployment transactions, and evidence binding. Every behavior change starts with a failing regression.

### Deployment-polish worktree

Owns operator-facing deployment scripts, readiness reports, version/path diagnostics, reload-first instructions, one-command package verification, Profile Doctor workflow, rollback UX, inventory generation, and the final standalone HTML guide. It must not modify core transport semantics.

### High-level-design worktree

Owns architectural boundaries, capability ownership, failure domains, release topology, session lifecycle, browser isolation, data-retention rules, and integration contracts. It may add architecture-enforcement tests or small shared contracts when they prevent drift, but it must not perform broad refactors.

### Low-level-design worktree

Owns module interfaces, state schemas, normalization rules, invariants, error codes, transaction transitions, timer ownership, collection bounds, and detailed tests. It may extract narrowly reusable helpers where duplicated normalization or state interpretation causes proven ambiguity.

## Integration order

1. Integrate runtime bug fixes.
2. Rebase and integrate low-level contracts.
3. Rebase and integrate high-level architecture enforcement.
4. Rebase and integrate deployment/operator polish.
5. Apply 0.10.3 release identity in one integration batch.
6. Run the complete gate and isolated browser smoke on one exact final commit.
7. Atomically replace the stable current package, verify 0.6.1 archive integrity, update inventory and guide, then remove all task worktrees and superseded artifacts.

## Success evidence

- Four cycle ledgers contain exactly 50 ordered entries each.
- All reproduced production defects have red-before-green regression evidence.
- Complete Node, extension, AutoHotkey, package, and worktree gates pass on final main.
- Isolated Edge smoke proves rendered delivery, Adaptive Turn, transport, UI, and cleanup or a fail-closed production-object equivalence record explains a provider-only fluctuation.
- Final deployment root contains only archive, current, inventory, and the 0.10.3 guide.
- Source contains one clean main worktree and no task branches.
