# PMIA 0.10.3 Parallel System-Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Workstreams are isolated in Git worktrees and integrated only after independent review.

**Goal:** Complete four verified 50-cycle workstreams, integrate the smallest durable system improvements, produce PMIA 0.10.3, deploy the stable current package, preserve 0.6.1 rollback, and remove every superseded PMIA task trace.

**Architecture:** Run independent audits and focused tests in four worktrees. Runtime changes are regression-first; design work adds enforceable contracts rather than speculative rewrites; deployment work produces deterministic local artifacts. Final release identity, evidence, packaging, Edge activation, and cleanup occur only on clean integrated main.

**Tech Stack:** AutoHotkey v2, JavaScript ES modules, Node test runner, PowerShell 5.1, Microsoft Edge Manifest V3, Git worktrees, isolated Edge profiles.

## Global constraints

- Base commit is `78e38a23b5300324c252e3ca194e67dc9df9e564`.
- Target release is PMIA `0.10.3`.
- Keep normal Edge and user conversations untouched during automated validation.
- No push, tag, PR, store publication, policy installation, or cloud deployment.
- No broad rewrite of `runtime-pilot-controller.js`, `dashboard.js`, or the launcher without a reproduced ownership defect.
- Every task ends with focused tests, diff review, and a local commit.

---

### Task 1: Create and protect four worktrees

**Files:** `.gitignore`, Git worktree metadata only.

- [ ] Verify `.worktrees` is ignored and main is clean at the base commit.
- [ ] Create branches/worktrees: `hardening/pmia-0.10.3-bugfix`, `polish/pmia-0.10.3-deployment`, `design/pmia-0.10.3-hld`, and `design/pmia-0.10.3-lld`.
- [ ] Confirm each worktree has the same tree hash and no local changes.
- [ ] Run independent baseline audit commands in parallel; do not run four redundant complete gates.

### Task 2: Runtime bug-fix cycles 1-50

**Files:** deployment scripts, `runtime/extension/background.js`, sender outbox, delivery ledger, sequence admission, receiver batch runtime, runtime pilot state/controller, dashboard models, and matching tests.

- [ ] Audit ten deployment/evidence contracts: transactional rollback, source binding, checksum inventory, path containment, reparse safety, archive identity, stale exit status, evidence decoding, unexpected files, and package provenance.
- [ ] Audit ten admission/ordering contracts: idempotency, leases, gap recovery, index repair, restart restore, duplicate proof, stale acknowledgements, shutdown fencing, retry ownership, and session isolation.
- [ ] Audit ten Adaptive Turn contracts: pause admission, combined draft, resume pending, carryover, Stop failure, manual conflict, exact proof, no-response choice, restart reconciliation, and concurrent commands.
- [ ] Audit ten state/dashboard contracts: schema migration, quarantine, monotonic snapshots, semantic deltas, command replay, recovery budgets, managed windows, storage pressure, support redaction, and end-session cleanup.
- [ ] Audit ten provider/launcher contracts: visible controls, composer readiness, sender authority, profile discovery, executable fallback, unsafe flags, lifecycle titles, context memory, extension registration, and normal-profile isolation.
- [ ] Add a focused failing regression for each reproduced defect, implement the owning fix, and record exactly 50 cycle outcomes.

### Task 3: Deployment-polish cycles 1-50

**Files:** `DEPLOYMENT_GUIDE.md`, deployment PowerShell scripts, Profile Doctor, active README/status files, inventory generator, deployment HTML guide, and tests.

- [ ] Build a fail-closed `Get-PMIADeploymentReadiness.ps1` report that verifies current, archive, settings, Edge registration, version, paths, prerequisites, and manual actions without reading browser secrets.
- [ ] Build `Open-PMIAEdgeDeployment.ps1` to verify packages, copy the current extension path, open `edge://extensions`, and print reload/load-unpacked steps without editing browser preferences.
- [ ] Add deterministic inventory generation from current manifests and evidence instead of maintaining JSON by hand.
- [ ] Add issue codes and remediation text for cached version, path mismatch, missing registration, duplicate cards, missing prerequisite, checksum failure, and stale evidence.
- [ ] Audit 50 operator surfaces covering commands, paths, rollback, failure stops, accessibility, compact copy, offline use, version consistency, package integrity, and cleanup.
- [ ] Record exactly 50 polish cycles and keep historical release records unchanged.

### Task 4: High-level-design cycles 1-50

**Files:** new architecture decision record, architecture map, capability/ownership tests, release topology tests, and shared capability contract when justified.

- [ ] Model ten system boundaries: launcher, service worker, sender, receiver, dashboard, storage, provider adapters, evidence, deployment, and review tracker.
- [ ] Model ten data flows: boot context, preview, final, outbox, ledger, batch, proof, answer, export, and cleanup.
- [ ] Model ten failure domains: browser restart, worker suspension, tab replacement, provider drift, storage pressure, network loss, duplicate commands, stale evidence, package corruption, and operator interruption.
- [ ] Model ten release/deployment decisions: immutable archive, stable current path, compatibility alias, reload-first activation, manual browser boundary, no preference mutation, isolated smoke, exact commit evidence, atomic promotion, and rollback.
- [ ] Model ten non-functional decisions: latency, durability, privacy, accessibility, observability, bounded memory, deterministic testing, backward compatibility, recovery, and maintainability.
- [ ] Convert drift-prone decisions into small architecture-enforcement tests and record exactly 50 HLD cycles.

### Task 5: Low-level-design cycles 1-50

**Files:** state/model helpers, transaction classes, normalization utilities, issue-code registry, tests, and a detailed LLD record.

- [ ] Specify ten state schemas and migrations with required/default/forbidden fields.
- [ ] Specify ten transaction state machines with legal transitions and idempotent repeats.
- [ ] Specify ten collection/timer contracts with owners, bounds, cancellation, and restart behavior.
- [ ] Specify ten input/output normalization contracts for numbers, booleans, paths, identities, timestamps, and provider evidence.
- [ ] Specify ten error/remediation contracts with stable issue codes and safe operator messages.
- [ ] Extract only narrowly reusable helpers supported by failing tests; record exactly 50 LLD cycles.

### Task 6: Integrate branches and apply PMIA 0.10.3 identity

**Files:** active release identity surfaces, manifests, tests, cycle ledgers, status docs.

- [ ] Merge bugfix, rebase/merge LLD, rebase/merge HLD, then rebase/merge deployment polish.
- [ ] Resolve conflicts by preserving runtime truth and the newest verified contract, not by concatenating duplicate implementations.
- [ ] Update only active version surfaces to 0.10.3; preserve historical 0.10.1/0.10.2 evidence.
- [ ] Run focused integration tests and inspect the complete diff.

### Task 7: Final verification, deployment, and cleanup

**Files:** final evidence directory, `PMIA Deployment\current`, inventory, 0.10.3 HTML guide.

- [ ] Run one complete gate on exact final main and save counts/logs.
- [ ] Run isolated Edge smoke with the disposable profile and preserve any failed attempt as diagnostic evidence.
- [ ] Generate release, handoff, worktree, and production-object equivalence manifests.
- [ ] Atomically rebuild current from final main; verify current and 0.6.1 archive checksums.
- [ ] Run Profile Doctor and the readiness report against the normal Edge profile.
- [ ] Open `edge://extensions`; use Reload first and Load unpacked only if required. Browser-internal confirmation remains the only manual boundary.
- [ ] Remove all four worktrees/branches, superseded PMIA evidence, stale guides, task temp, and staging directories.
- [ ] Verify final retained layout, one clean main worktree, no PMIA task processes, no push/tag, and exact deployment instructions.
