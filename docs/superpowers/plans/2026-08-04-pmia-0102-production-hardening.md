# PMIA 0.10.2 Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete 50 evidence-driven bug-fix cycles and 50 deployment-polish cycles, verify one exact PMIA 0.10.2 commit, preserve the 0.6.1 rollback archive, replace the stable current package atomically, and remove all task traces.

**Architecture:** Preserve the existing launcher/extension/runtime boundaries. Diagnose through current tests, validators, package fixtures, and isolated Edge evidence; add the smallest regression-first fixes at owning modules. Build deployment artifacts only from the exact verified commit.

**Tech Stack:** AutoHotkey v2, JavaScript ES modules, Node test runner, PowerShell 5.1, Microsoft Edge Manifest V3, Git worktrees.

## Global Constraints

- No provider-specific workaround or weakened rendered-proof requirement.
- No direct edits to Edge Preferences or Secure Preferences.
- No push, tag, PR, publication, or cloud deployment.
- Preserve the immutable 0.6.1 archive and unrelated user work.
- Every production behavior change requires an observed failing regression first.
- Final cleanup retains only clean `main`, archive 0.6.1, current 0.10.2, one evidence package, inventory, guide, and any still-required Edge compatibility junction.

---
### Task 1: Baseline and Release-Truth Cycles 1-10

**Files:**
- `runtime/extension/manifest.json`
- `runtime/Final_2_Window_Extension.ahk`
- `runtime/PMIA_Runtime_Platform.ahk`
- `runtime/extension/tests/launcher-platform.test.js`
- `runtime/PMIA_Runtime_Platform_Smoke.ahk`
- `docs/PMIA_0102_PRODUCTION_HARDENING_CYCLES.md`

- [ ] Run the unchanged Node tests and extension validator; save exact counts.
- [ ] Audit version identity, browser executable fallback, user-data fallback, profile selection, extension path, launcher-relative resources, runtime ownership, browser flags, and profile isolation.
- [ ] For each reproduced defect, add one focused failing assertion and observe the expected failure.
- [ ] Apply only the owning root-cause fix, then rerun focused Node and AutoHotkey checks.
- [ ] Record cycles 1-10 as `fixed` or `retained` with an evidence signal.
### Task 2: Packaging and Evidence Cycles 11-20

**Files:**
- `runtime/scripts/PMIA-Deployment.Common.ps1`
- `runtime/scripts/New-PMIACurrentDeployment.ps1`
- `runtime/scripts/Test-PMIADeployment.ps1`
- `runtime/scripts/build-release-evidence-manifest.mjs`
- `runtime/extension/tests/deployment-packaging.test.js`
- `runtime/extension/tests/release-evidence-manifest.test.js`

- [ ] Audit allowlist completeness, forbidden-path rejection, canonical paths, atomic promotion, rollback, manifest counts, checksum completeness, duplicate detection, log decoding, and source binding.
- [ ] Use synthetic repositories and package fixtures for every reproduced packaging defect.
- [ ] Tamper fixtures to prove changed, missing, added, and duplicated files fail closed.
- [ ] Run the two focused packaging/evidence test files after each coherent fix batch.
- [ ] Record cycles 11-20 with exact fixture and test outcomes.
### Task 3: Admission, Outbox, and Sequence Cycles 21-30

**Files:**
- `runtime/extension/content/sender-outbox.js`
- `runtime/extension/shared/durable-ledger.js`
- `runtime/extension/shared/sequence-admission.js`
- `runtime/extension/background.js`
- Matching outbox, ledger, and sequence tests under `runtime/extension/tests`

- [ ] Audit admission latency, per-session ordering, idempotent ownership, restart recovery, ledger indexes, index repair, gap detection, gap clearing, expired lease recovery, and shutdown fencing.
- [ ] Add one real-behavior regression for every reproduced defect and observe it fail for the expected reason.
- [ ] Implement the smallest owning fix and run the focused outbox, ledger, and sequence tests.
- [ ] Record cycles 21-30 with before/after evidence.

### Task 4: Adaptive Turn and Provider Proof Cycles 31-40

**Files:**
- `runtime/extension/content/receiver-batch-runtime.js`
- `runtime/extension/content/receiver-answer-orchestrator.js`
- `runtime/extension/shared/adaptive-turn-safety.js`
- `runtime/extension/shared/batch-transaction.js`
- Matching pause, resume, batch, and rendered-proof tests

- [ ] Audit pause admission, combined draft ordering, staging credits, durable resume pending, provider submission, success finalization, protected-pause rollback, no-response resolution, exact rendered proof, and duplicate-provider-turn handling.
- [ ] Do not weaken proof or add provider-specific selectors without a reproduced cross-provider boundary defect.
- [ ] Run focused Adaptive Turn and delivery-proof tests after each fix.
- [ ] Record cycles 31-40 with exact state transitions.
### Task 5: Dashboard, Session State, and Cleanup Cycles 41-50

**Files:**
- `runtime/extension/dashboard/dashboard.js`
- `runtime/extension/dashboard/managed-window-model.js`
- `runtime/extension/dashboard/turn-coordination-model.js`
- `runtime/extension/shared/session-end-transaction.js`
- Matching dashboard, state, storage, and session-end tests

- [ ] Audit startup null safety, monotonic resync, semantic deltas, control projection, managed windows, command fencing, state migration, storage pressure, end-session cleanup, and profile/process cleanup.
- [ ] Add regression-first fixes only for reproduced defects.
- [ ] Run the focused dashboard/state/session matrix.
- [ ] Record cycles 41-50 and close the defect phase with a widened test gate.

### Task 6: Operator UX and Accessibility Polish Cycles 51-60

**Files:**
- `runtime/extension/dashboard/index.html`
- `runtime/extension/dashboard/dashboard.css`
- `runtime/extension/dashboard/dashboard.js`
- Accessibility, focus, toolbar, and visual-preference tests

- [ ] Audit keyboard order, visible focus, dialog trapping, live regions, labels, compact widths, print layout, reduced motion, status hierarchy, actionable copy, and control discoverability.
- [ ] Preserve existing semantics; add tests before any behavior or markup change.
- [ ] Validate desktop, 320-pixel, 280-pixel, and print layouts.
- [ ] Record cycles 51-60 with accessibility and layout evidence.

### Task 7: Diagnostics and Observability Polish Cycles 61-70

**Files:**
- `runtime/extension/shared/runtime-telemetry.js`
- `runtime/extension/shared/command-result-journal.js`
- `runtime/extension/dashboard/diagnostics-model.js`
- `runtime/extension/dashboard/trace-inspector-model.js`
- Diagnostics, trace, telemetry, and support-bundle tests

- [ ] Audit correlation IDs, result journals, trace search, proof detail, health summaries, recovery reasons, redaction, support-bundle completeness, event coalescing, and stale-diagnostic clearing.
- [ ] Add regression-first fixes for any misleading or missing operator signal.
- [ ] Run focused diagnostics and support-bundle tests.
- [ ] Record cycles 61-70.
### Task 8: Performance and Storage Polish Cycles 71-80

**Files:**
- `runtime/extension/shared/snapshot-delta.js`
- `runtime/extension/shared/storage-pressure.js`
- `runtime/extension/shared/telemetry-coalescer.js`
- `runtime/extension/dashboard/render-scheduler.js`
- Performance, storage, snapshot, and scheduler tests

- [ ] Audit hot-path allocations, repeated serialization, snapshot delta scope, render coalescing, idle work, memory guards, storage accounting, pruning order, retry pacing, and background throttling resilience.
- [ ] Preserve correctness and durability before latency or memory improvements.
- [ ] Add focused performance-contract tests before optimization changes.
- [ ] Record cycles 71-80 with deterministic counters rather than wall-clock claims where possible.

### Task 9: Deployment Tooling and Documentation Polish Cycles 81-90

**Files:**
- `DEPLOYMENT_GUIDE.md`
- `runtime/README_INSTALL_TEST.md`
- Deployment PowerShell scripts and their tests
- `docs/PMIA_0102_PRODUCTION_HARDENING_CYCLES.md`

- [ ] Audit reload-first Edge instructions, fallback load-unpacked path, Profile Doctor expectations, package commands, rollback, compatibility junction, manifest terminology, evidence locations, troubleshooting, and operator stop conditions.
- [ ] Align active release surfaces to version 0.10.2 without rewriting historical records.
- [ ] Run documentation path/version assertions and package fixture tests.
- [ ] Record cycles 81-90.

### Task 10: Release, Promotion, and Cleanup Cycles 91-100

**Files:**
- Final release and handoff manifests under the final evidence directory
- `PMIA Deployment\DEPLOYMENT_INVENTORY.json`
- `PMIA Deployment\PMIA_0.10.2_DEPLOYMENT_AND_TECHNICAL_GUIDE.html`

- [ ] Complete cycles 91-95 with exact release identity, complete gate, package validation, AutoHotkey validation, and isolated Edge smoke.
- [ ] Complete cycles 96-100 with worktree accounting, local main fast-forward, atomic current replacement, archive re-verification, guide audit, and allowlist cleanup.
- [ ] Require one exact final commit and preserve failed smoke artifacts as diagnostics.
- [ ] Remove the temporary hardening worktree and branch after verified main promotion.
- [ ] Verify final retained directories, no task processes, no staging paths, and no superseded candidate/evidence versions.
