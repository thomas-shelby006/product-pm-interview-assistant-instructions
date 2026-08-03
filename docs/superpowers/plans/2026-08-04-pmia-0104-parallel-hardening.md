# PMIA 0.10.4 Parallel Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Four terminal sessions execute isolated Git worktrees; integration and deployment occur only on clean `main`.

**Goal:** Deliver PMIA 0.10.4 with a safe swallowed-submit retry, bounded recovery state, four-lane release evidence, deterministic browser verification, preserved 0.6.1 rollback, Edge activation, and complete task cleanup.

**Architecture:** Runtime, LLD, HLD, and deployment work are isolated. Runtime proof remains fail-closed; deterministic extension/browser evidence is a release gate; live provider rendering is a separate canary; normal-profile activation is a final explicit gate.

**Tech Stack:** JavaScript ES modules, Node test runner, PowerShell 5.1, AutoHotkey v2, Microsoft Edge Manifest V3, Chrome DevTools Protocol, Git worktrees.

## Global Constraints

- Base commit: `feca2fc60cac5096f9c83ffede93a634c36c8a31`.
- Target version: `0.10.4`.
- No dependency changes, remote APIs, store publication, enterprise policy, cloud deployment, push, tag, or PR.
- Preserve rendered-turn proof, exact sequence admission, ledger durability, pause/resume semantics, user Edge data, and the 0.6.1 archive.
- Keep worktree ownership non-overlapping; integration resolves contracts, not duplicate implementations.

---

### Task 1: Commit design and establish four worktrees

**Files:** spec and this plan; Git metadata only.

- [ ] Verify `main` is clean, `.worktrees` is ignored, and no task process owns the repository.
- [ ] Commit the spec and plan as `docs: plan PMIA 0.10.4 parallel hardening`.
- [ ] Create branches/worktrees `hardening/pmia-0.10.4-submit`, `design/pmia-0.10.4-lld`, `design/pmia-0.10.4-hld`, and `polish/pmia-0.10.4-deployment`.
- [ ] Run focused baseline suites in four parallel terminal sessions and record outputs under `ChatGPT Work\Temp\pmia-0104`.
### Task 2: Runtime bugfix — swallowed submit after composer clear

**Files:**
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/adapters/chatgpt.js`
- Modify: `runtime/extension/content/adapters/claude.js`
- Test: `runtime/extension/tests/runtime.test.js`
- Create: `docs/evidence/2026-08-04-pmia-0104-bugfix-cycles.md`

**Interfaces:** Adapter adds `getComposerText(): string`. `submitComposerWhenReady` retains its boolean result and accepts `retryAfterEmptyComposerMs` with a safe default.

- [ ] Add a failing test where submit clears the composer, no user turn appears, generation remains false, and the second attempt succeeds.
- [ ] Add a failing test proving no retry occurs while generation is active or after the delivery identity is superseded.
- [ ] Implement composer-state sampling and one guarded empty-composer retry using the original baseline identities.
- [ ] Preserve the final `rendered_turn_not_confirmed` failure when the second attempt has no rendered proof.
- [ ] Record exactly 50 bug-review cycles with Retain, Adapt, Fix, or No-change outcomes.
- [ ] Run `node --test runtime/extension/tests/runtime.test.js runtime/extension/tests/adapters.test.js` and commit.

### Task 3: Low-level design — bounded recovery-attempt storage

**Files:**
- Modify: `runtime/extension/shared/recovery-budget.js`
- Test: `runtime/extension/tests/recovery-budget.test.js`
- Create: `docs/design/PMIA_0104_LOW_LEVEL_DESIGN.md`
- Create: `docs/evidence/2026-08-04-pmia-0104-lld-cycles.md`

**Interfaces:** `RecoveryBudget` accepts `maxStoredAttempts`; snapshots expose only the newest bounded attempts while preserving all automatic attempts needed for the active budget window.

- [ ] Add failing tests for rapid manual attempts, automatic-budget preservation, restore normalization, and snapshot immutability.
- [ ] Implement deterministic pruning: retain every active automatic attempt up to the enforced budget and only the newest manual entries within the storage limit.
- [ ] Keep existing state/reason strings and cooldown behavior unchanged.
- [ ] Document schemas, invariants, transitions, bounds, and 50 LLD review outcomes.
- [ ] Run `node --test runtime/extension/tests/recovery-budget.test.js` and commit.
### Task 4: High-level design — release verification topology

**Files:**
- Create: `docs/architecture/PMIA_0104_RELEASE_VERIFICATION_TOPOLOGY.md`
- Create: `runtime/extension/tests/release-verification-topology.test.js`
- Create: `docs/evidence/2026-08-04-pmia-0104-hld-cycles.md`

**Interfaces:** The architecture test recognizes four named lanes: `sourcePackage`, `deterministicBrowser`, `providerCanary`, and `normalProfileActivation`.

- [ ] Document owners, inputs, outputs, failure authority, retry authority, and manual boundaries for all four lanes.
- [ ] Add tests that reject evidence schemas which collapse provider canary into deterministic browser success or claim activation without Profile Doctor proof.
- [ ] Add import/topology assertions that deployment scripts remain outside extension production dependency roots.
- [ ] Record exactly 50 HLD decisions across boundaries, flows, failure domains, deployment, and non-functional requirements.
- [ ] Run the new topology test plus architecture-boundary tests and commit.

### Task 5: Deployment polish — deterministic smoke and provider canary

**Files:**
- Modify: `runtime/scripts/isolated-release-smoke.mjs`
- Modify: `runtime/scripts/run-isolated-release-smoke.ps1`
- Modify: `runtime/scripts/build-release-evidence-manifest.mjs`
- Modify: `runtime/scripts/Get-PMIADeploymentReadiness.ps1`
- Modify: `runtime/scripts/New-PMIADeploymentInventory.ps1`
- Modify: `runtime/DEPLOYMENT_GUIDE.md`
- Test: `runtime/extension/tests/isolated-release-smoke.test.js`
- Test: `runtime/extension/tests/release-evidence-manifest.test.js`
- Create: `docs/evidence/2026-08-04-pmia-0104-deployment-polish-cycles.md`

**Interfaces:** Smoke evidence emits `deterministicBrowser` and `providerCanary`. Provider canary status is `passed`, `limited`, `failed`, or `skipped`. Release readiness is never `ready` when deterministic browser proof fails.

- [ ] Add failing schema tests for lane separation and dishonest success aggregation.
- [ ] Refactor the smoke runner so deterministic module/UI/transport/cleanup evidence continues even when the provider canary is limited.
- [ ] Keep the live provider canary exact and fail-closed; preserve its raw diagnostic evidence and reason.
- [ ] Update evidence, readiness, inventory, and guide copy to expose the four-lane status and manual acceptance action.
- [ ] Record exactly 50 deployment-polish cycles.
- [ ] Run focused smoke/evidence/deployment tests and commit.
### Task 6: Integrate and apply 0.10.4 identity

**Files:** active manifest/version surfaces, status docs, and integration evidence.

- [ ] Review each branch diff and focused test output independently.
- [ ] Integrate LLD, runtime bugfix, HLD, then deployment polish; resolve only contract-level dependencies.
- [ ] Update active release identity to 0.10.4 while preserving historical evidence.
- [ ] Run focused cross-stream tests and verify no production module is unreachable.
- [ ] Commit the integrated identity batch.

### Task 7: Final verification, deployment, Edge activation, and cleanup

**Files:** `PMIA Deployment\current`, inventory v3, standalone 0.10.4 HTML guide, temporary evidence.

- [ ] Run one complete `runtime\Validate_Extension_Runtime.ps1` gate on exact final `main`.
- [ ] Run deterministic isolated Edge smoke and the live provider canary; preserve exact status without relabeling.
- [ ] Generate release, handoff, worktree, production-object, and package manifests bound to the final commit.
- [ ] Atomically rebuild and verify `current`; verify the 0.6.1 archive; parse all packaged AutoHotkey programs.
- [ ] Run Profile Doctor and readiness against Edge Default profile.
- [ ] Open `edge://extensions`, use Reload first, refresh managed pages, and use Load unpacked only when the existing card cannot update. Do not edit Preferences or Secure Preferences.
- [ ] Run a normal-profile preflight and one real-provider manual acceptance flow when browser security/UI permits.
- [ ] Generate and audit the self-contained 0.10.4 deployment/technical HTML at desktop, 320 CSS px, and print.
- [ ] Remove all four worktrees and branches, 0.10.3/0.10.4 temp evidence after hashes are embedded, obsolete current guides, staging directories, and task-owned processes.
- [ ] Confirm final retained layout contains only canonical source, 0.6.1 archive, 0.10.4 current, inventory, and the 0.10.4 guide; retain a compatibility alias only while Edge still references it.

## Final completion evidence

The final report must state root cause, exact commits, changed files, cycle ledgers, focused and complete checks, deterministic browser status, provider-canary status, Edge activation status, cleanup survivors, limitations, and any remaining user-only browser action.