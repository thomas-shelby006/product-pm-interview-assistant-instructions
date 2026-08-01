# PMIA Live UX Hardening Cycles 146–170 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the expanded live-interview cockpit is restart-safe, keyboard-complete, bounded under load, focus-safe, and release-verifiable.

**Architecture:** Harden the Cycle 96–145 owners rather than adding parallel state or command paths. Extend versioned session state and test-only scenarios. Final browser evidence runs only in a disposable profile.

**Tech Stack:** Manifest V3, ES modules, Node test runner, DevTools Protocol isolated smoke, PowerShell, AutoHotkey v2.

## Global Constraints

- New fault and load modules remain under `testing/` and are forbidden from production imports.
- Focus remains explicit-user-gesture-only.
- All evidence and support bundles are content-free and source-bound.
- Execute tests only after Cycle 170 source work is complete.
- HTML atlas remains last.

---

### Task 1: Cycles 146–150 — Command, Focus, Incident, Marker, and Triage Integrity

**Files:**
- Create/complete: `runtime/extension/shared/focus-gesture-token.js`
- Create/complete: `runtime/extension/shared/incident-center.js`
- Create/complete: `runtime/extension/shared/operator-markers.js`
- Create/complete: `runtime/extension/shared/question-triage.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-146-150-command-integrity.test.js`

**Interfaces:**
- Consumes: final Cycle 145 live cockpit state, existing command-result journal, versioned store, isolated smoke, deterministic release builder.
- Produces: integrity checks, lifecycle recovery, accessibility/load evidence, and source-bound final release evidence.

- [ ] Write the block regression contract.
- [ ] Implement all five cycle contracts from the hardening design.
- [ ] Audit production reachability and test-only isolation.
- [ ] Update cycle logs and evidence requirements.
- [ ] Commit as `fix: harden live command and metadata integrity`.

### Task 2: Cycles 151–155 — Lifecycle, Restart, Clock, and Layout Continuity

**Files:**
- Create/complete: `runtime/extension/dashboard/dialog-focus-coordinator.js`
- Create/complete: `runtime/extension/shared/restart-continuity.js`
- Create/complete: `runtime/extension/shared/monotonic-session-clock.js`
- Create/complete: `runtime/extension/shared/layout-restoration.js`
- Modify: `runtime/extension/content/page-lifecycle-coordinator.js`
- Modify: `runtime/extension/shared/runtime-pilot-store.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/background.js`
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Test: `runtime/extension/tests/cycles-151-155-lifecycle-continuity.test.js`

**Interfaces:**
- Consumes: final Cycle 145 live cockpit state, existing command-result journal, versioned store, isolated smoke, deterministic release builder.
- Produces: integrity checks, lifecycle recovery, accessibility/load evidence, and source-bound final release evidence.

- [ ] Write the block regression contract.
- [ ] Implement all five cycle contracts from the hardening design.
- [ ] Audit production reachability and test-only isolation.
- [ ] Update cycle logs and evidence requirements.
- [ ] Commit as `fix: preserve live cockpit continuity across lifecycle changes`.

### Task 3: Cycles 156–160 — Accessibility and Responsive Proof

**Files:**
- Create/complete: `runtime/extension/shared/shortcut-conflict-model.js`
- Create/complete: `runtime/extension/dashboard/accessibility-audit.js`
- Create/complete: `runtime/extension/dashboard/visual-preference-proof.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/scripts/isolated-release-smoke.mjs`
- Test: `runtime/extension/tests/cycles-156-160-accessibility-proof.test.js`

**Interfaces:**
- Consumes: final Cycle 145 live cockpit state, existing command-result journal, versioned store, isolated smoke, deterministic release builder.
- Produces: integrity checks, lifecycle recovery, accessibility/load evidence, and source-bound final release evidence.

- [ ] Write the block regression contract.
- [ ] Implement all five cycle contracts from the hardening design.
- [ ] Audit production reachability and test-only isolation.
- [ ] Update cycle logs and evidence requirements.
- [ ] Commit as `fix: harden accessibility focus and responsive behavior`.

### Task 4: Cycles 161–165 — Load, Cache, Render, Persistence, and Idle Budgets

**Files:**
- Create/complete: `runtime/extension/testing/live-ux-load-scenario.js`
- Create/complete: `runtime/extension/shared/command-search-index.js`
- Create/complete: `runtime/extension/dashboard/virtual-list-model.js`
- Create/complete: `runtime/extension/dashboard/render-scheduler.js`
- Create/complete: `runtime/extension/dashboard/idle-work-coordinator.js`
- Modify: `runtime/extension/shared/performance-budget.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Test: `runtime/extension/tests/cycles-161-165-live-load.test.js`

**Interfaces:**
- Consumes: final Cycle 145 live cockpit state, existing command-result journal, versioned store, isolated smoke, deterministic release builder.
- Produces: integrity checks, lifecycle recovery, accessibility/load evidence, and source-bound final release evidence.

- [ ] Write the block regression contract.
- [ ] Implement all five cycle contracts from the hardening design.
- [ ] Audit production reachability and test-only isolation.
- [ ] Update cycle logs and evidence requirements.
- [ ] Commit as `perf: enforce live cockpit load and write budgets`.

### Task 5: Cycles 166–170 — Fault, Restart, Drill, Browser, and Release Evidence

**Files:**
- Create/complete: `runtime/extension/testing/live-ux-fault-matrix.js`
- Create/complete: `runtime/extension/testing/live-ux-restart-scenario.js`
- Modify: `runtime/extension/testing/fault-scenario-runner.js`
- Modify: `runtime/extension/testing/restart-continuity-scenario.js`
- Modify: `runtime/extension/shared/transport-drill.js`
- Modify: `runtime/scripts/isolated-release-smoke.mjs`
- Modify: `runtime/scripts/build-release-evidence-manifest.mjs`
- Modify: `runtime/Validate_Extension_Runtime.ps1`
- Modify: `runtime/extension/shared/support-bundle.js`
- Test: `runtime/extension/tests/cycles-166-170-release-evidence.test.js`

**Interfaces:**
- Consumes: final Cycle 145 live cockpit state, existing command-result journal, versioned store, isolated smoke, deterministic release builder.
- Produces: integrity checks, lifecycle recovery, accessibility/load evidence, and source-bound final release evidence.

- [ ] Write the block regression contract.
- [ ] Implement all five cycle contracts from the hardening design.
- [ ] Audit production reachability and test-only isolation.
- [ ] Update cycle logs and evidence requirements.
- [ ] Commit as `test: prove live cockpit fault and release evidence`.

## Final consolidated verification

- [ ] Run all Cycle 96–170 block suites.
- [ ] Run complete repository validator on committed HEAD.
- [ ] Run isolated Edge smoke with synthetic finals, expanded no-content drill, command palette, navigator, incidents, markers, hold/resume, accessibility, desktop/320px/zoom-equivalent/print evidence.
- [ ] Run restart continuity and privacy/support-bundle checks.
- [ ] Generate deterministic release evidence manifest bound to the exact commit.
- [ ] Remove assistant-created temporary logs/profiles and verify normal Edge unchanged.
- [ ] Verify original checkout clean and no push/merge/tag.
- [ ] Update technical HTML last and validate offline/desktop/mobile/print/interactions.