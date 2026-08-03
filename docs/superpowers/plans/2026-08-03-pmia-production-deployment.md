# PMIA Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete 25 production-readiness cycles, promote the verified candidate to local `main`, preserve exactly one installed-version rollback archive, and prepare one independently verified current browser deployment.

**Architecture:** Deployment is produced from a clean exact Git commit through deterministic PowerShell scripts. Archive and current trees are checksum-bound, built outside the repository, and verified before cleanup or source promotion changes the installed path.

**Tech Stack:** Git worktrees, Node test runner, PowerShell 5.1+, AutoHotkey v2, Microsoft Edge Manifest V3, SHA-256 inventories.

## Global Constraints

- Do not push, tag, publish, deploy to cloud, create a public remote, or alter unrelated repositories.
- Preserve the installed 0.6.1 tree until its verified archive exists.
- Keep normal Edge and its profile untouched during automated verification.
- Remove only explicitly inventoried PMIA versions, worktrees, evidence, and assistant-created task traces.
- Final deployment root must contain one previous archive and one current version.

---

### Task 1: Deployment design and cycle ledger

**Files:**
- Create: `docs/superpowers/specs/2026-08-03-pmia-production-deployment-design.md`
- Create: `docs/superpowers/plans/2026-08-03-pmia-production-deployment.md`
- Modify: existing Adaptive Turn plan, handoff, and integration audit at checkpoints.

- [ ] Record installed version, registered path, target root, exclusions, cleanup boundaries, and all 25 cycles.
- [ ] Self-review for placeholders, contradictions, and missing acceptance conditions.
- [ ] Commit the design and implementation plan.

### Task 2: Browser configuration resilience

**Files:**
- Modify: `runtime/PMIA_Runtime_Platform.ahk`
- Modify: `runtime/PMIA_Runtime_Platform_Smoke.ahk`
- Modify: `runtime/extension/tests/launcher.test.js`

- [ ] Add failing assertions that malformed or missing saved executable and user-data paths fall back to family defaults.
- [ ] Implement `FileExist` and `DirExist` recovery without overwriting valid custom paths.
- [ ] Run platform smoke and launcher tests; commit the fix.

### Task 3: Deterministic deployment tooling

**Files:**
- Create: `runtime/scripts/New-PMIAInstalledArchive.ps1`
- Create: `runtime/scripts/New-PMIACurrentDeployment.ps1`
- Create: `runtime/scripts/Test-PMIADeployment.ps1`
- Create: `runtime/extension/tests/deployment-packaging.test.js`

- [ ] Write failing contract tests for explicit parameters, staging, allowlist, exclusions, manifests, checksums, and verification.
- [ ] Implement installed archive creation from an explicit registered/resolved extension path.
- [ ] Implement atomic current package creation from a clean source commit.
- [ ] Implement independent checksum and required-file verification.
- [ ] Run focused tests and PowerShell syntax checks; commit tooling.
### Task 4: Release identity and operator guide

**Files:**
- Modify: `runtime/extension/manifest.json`
- Create: `DEPLOYMENT_GUIDE.md`
- Modify: `README.md`
- Modify: `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
- Modify: `docs/CURRENT_STATUS_DASHBOARD.md`
- Modify: version-bearing active release documents and tests.

- [ ] Bump the patch release to `0.10.1` only after production fixes are complete.
- [ ] Add exact Edge load-unpacked, reload, Profile Doctor, launcher, rollback, and uninstall-old-entry steps.
- [ ] Replace stale candidate paths and status claims with commit-bound wording.
- [ ] Run release-surface and documentation tests; commit release identity.

### Task 5: Finish integration evidence

**Files:**
- Generate: deterministic release evidence manifest outside or under the designated evidence path.
- Generate: handoff manifest.
- Generate: worktree integration manifest.
- Modify: plan, handoff, and worktree audit with exact results.

- [ ] Preserve the successful isolated evidence from exact source commit.
- [ ] Generate deterministic manifests and require all five Adaptive Turn scenarios.
- [ ] Verify both dirty historical worktrees have exact current-content dispositions.
- [ ] Remove only the admission lane `.pmia-task-temp` after retained evidence exists.
- [ ] Commit the final integration checkpoint.

### Task 6: Archive installed 0.6.1

**Files:**
- Create externally: `C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed`
- Create externally: archive manifest and checksum inventory.

- [ ] Run Profile Doctor against the installed registration and capture the exact extension ID, profile, registered path, resolved path, and version.
- [ ] Copy the complete installed source snapshot before modifying canonical `main`.
- [ ] Generate and verify SHA-256 inventory.
- [ ] Confirm the archive reports source commit `66ea17e` when the repository identity is available.

### Task 7: Promote exact candidate to local main

**Files:**
- Modify only Git references and canonical working tree through a normal local merge.

- [ ] Confirm integration worktree clean, original main clean, no staged changes, and no active PMIA process.
- [ ] Merge the exact verified integration branch into local `main` without rebase, amend, push, or tag.
- [ ] Run the complete repository gate on merged `main`.
- [ ] Inspect final diff/history and confirm unrelated repositories are untouched.

### Task 8: Build and verify current deployment

**Files:**
- Create externally: `C:\Users\Sundar\Documents\PMIA Deployment\current`
- Create externally: `deployment-manifest.json`, `checksums.sha256`, and deployment inventory.

- [ ] Build from the exact clean promoted-main commit through a temporary staging directory.
- [ ] Verify required runtime, launcher, review, profile doctor, manifest, tests, and guide files.
- [ ] Run the complete validation script from the deployment copy.
- [ ] Run Profile Doctor against the deployment extension and report the expected path mismatch until the user loads it in Edge.

### Task 9: Remove superseded PMIA work traces

**Files/paths:**
- Remove registered auxiliary PMIA worktrees after merge and disposition verification.
- Remove assistant-created `PMIA-Task-Temp`, superseded evidence roots, obsolete release-evidence directory, and temporary diagnostic monitor.
- Retain canonical repository and `PMIA Deployment` only as version-bearing PMIA trees.

- [ ] Generate a dry-run inventory with ownership and reason for every removal candidate.
- [ ] Exclude browser settings/profile, private tracker, canonical source, current deployment, rollback archive, and unrelated repositories.
- [ ] Remove worktrees through `git worktree remove` or prune only after content disposition passes.
- [ ] Delete only confirmed superseded external traces and verify each path no longer exists.
- [ ] Remove obsolete local branches only when their commits are ancestors of promoted `main`.

### Task 10: Final deployment acceptance

**Files:**
- Modify: `DEPLOYMENT_GUIDE.md` with final commit/version/path.
- Create externally: `C:\Users\Sundar\Documents\PMIA Deployment\DEPLOYMENT_INVENTORY.json`.
- Modify: final plan/handoff/status documents.

- [ ] Confirm exactly one archive directory and one current directory.
- [ ] Confirm current manifest version, source commit, checksums, and complete gate.
- [ ] Confirm old browser registration remains 0.6.1 until the manual Edge load/reload step.
- [ ] Confirm normal Edge was not automated or modified.
- [ ] Report the exact manual steps required to load current, validate, and remove the old entry.

## Plan self-review

- All user requirements map to Tasks 2 through 10.
- The installed version is archived before local `main` changes its resolved path.
- Cleanup is sequenced after source promotion and deployment verification.
- No placeholder, public-write, cloud-deploy, or test-weakening step remains.
- The final manual browser-internal action is documented rather than bypassed through preference-file editing.
