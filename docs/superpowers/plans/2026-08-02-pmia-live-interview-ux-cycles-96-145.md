# PMIA Live Interview UX Cycles 96–145 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an operator-grade live mock-interview cockpit on the verified lossless runtime.

**Architecture:** Pure metadata models derive interview phase, attention, incidents, triage, navigation, accessibility, and performance. Runtime mutations remain in the existing per-session controller and versioned session state. Provider focus/layout changes require explicit user gestures.

**Tech Stack:** Manifest V3 extension, ES modules, Node test runner, Chrome session storage/alarms/windows APIs, AutoHotkey v2 launcher.

## Global Constraints

- Preserve Delivery Ledger and provider-rendered proof as delivery authorities.
- Persist new data in session storage or document memory only.
- Never store prompt, answer, setup, credential, or clipboard content in new models.
- Never activate a provider window without an explicit operator gesture.
- Write regression contracts with each block but defer executable tests until Cycle 145 source completion.
- No HTML atlas work in this phase.
- No push, merge, or tag.

---

### Task 1: Cycles 96–100 — Interview State and Time

**Files:**
- Create/complete: `runtime/extension/shared/live-session-state.js`
- Create/complete: `runtime/extension/shared/session-phase-model.js`
- Create/complete: `runtime/extension/shared/interview-runbook.js`
- Create/complete: `runtime/extension/shared/session-clock.js`
- Create/complete: `runtime/extension/shared/interviewer-silence.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-96-105-live-operations.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add explicit live interview state and timing`.

### Task 2: Cycles 101–105 — Attention, Next Action, Palette, Navigation, Focus

**Files:**
- Create/complete: `runtime/extension/shared/attention-model.js`
- Create/complete: `runtime/extension/shared/next-action-model.js`
- Create/complete: `runtime/extension/shared/operator-command-catalog.js`
- Create/complete: `runtime/extension/dashboard/command-palette-model.js`
- Create/complete: `runtime/extension/dashboard/toolbar-navigation.js`
- Create/complete: `runtime/extension/dashboard/focus-mode-model.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-96-105-live-operations.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add live attention and command navigation`.

### Task 3: Cycles 106–110 — Incident Center and Quiet Attention

**Files:**
- Create/complete: `runtime/extension/shared/incident-center.js`
- Create/complete: `runtime/extension/shared/incident-runbook.js`
- Create/complete: `runtime/extension/shared/quiet-attention-policy.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-106-110-incident-center.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add incident center and quiet attention`.

### Task 4: Cycles 111–115 — Question Triage and Queue Navigation

**Files:**
- Create/complete: `runtime/extension/shared/question-triage.js`
- Create/complete: `runtime/extension/shared/question-relation-model.js`
- Create/complete: `runtime/extension/shared/batch-preview-model.js`
- Create/complete: `runtime/extension/shared/queue-search-index.js`
- Create/complete: `runtime/extension/shared/priority-emphasis.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-111-115-question-triage.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add lossless question triage and batch preview`.

### Task 5: Cycles 116–120 — Markers, Checkpoints, Recovery Card, Landmarks

**Files:**
- Create/complete: `runtime/extension/shared/operator-markers.js`
- Create/complete: `runtime/extension/shared/activity-markers.js`
- Create/complete: `runtime/extension/shared/session-checkpoint.js`
- Create/complete: `runtime/extension/shared/interruption-recovery-card.js`
- Create/complete: `runtime/extension/shared/session-landmarks.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-116-120-session-landmarks.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add live markers and resumable checkpoints`.

### Task 6: Cycles 121–125 — Managed Window Navigation and Gesture Safety

**Files:**
- Create/complete: `runtime/extension/shared/window-navigation-intent.js`
- Create/complete: `runtime/extension/shared/layout-history.js`
- Create/complete: `runtime/extension/shared/focus-gesture-token.js`
- Create/complete: `runtime/extension/dashboard/managed-window-model.js`
- Modify: `runtime/extension/background.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Test: `runtime/extension/tests/cycles-121-125-window-navigation.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add explicit managed window navigation`.

### Task 7: Cycles 126–130 — Keyboard and Accessibility Preferences

**Files:**
- Create/complete: `runtime/extension/shared/shortcut-bindings.js`
- Create/complete: `runtime/extension/dashboard/shortcut-help-model.js`
- Create/complete: `runtime/extension/dashboard/accessibility-preferences.js`
- Create/complete: `runtime/extension/dashboard/live-announcer.js`
- Create/complete: `runtime/extension/dashboard/dialog-focus-coordinator.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Test: `runtime/extension/tests/cycles-126-130-accessibility.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add keyboard-complete accessible live controls`.

### Task 8: Cycles 131–135 — Preflight, Hold, Resume, Boundary, Crash Recovery

**Files:**
- Create/complete: `runtime/extension/shared/preflight-wizard.js`
- Create/complete: `runtime/extension/shared/resume-guard.js`
- Create/complete: `runtime/extension/shared/crash-resume-model.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Modify: `runtime/extension/shared/session-end-guard.js`
- Test: `runtime/extension/tests/cycles-131-135-session-safety.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add guided preflight and safe live recovery`.

### Task 9: Cycles 136–140 — Operational Review and Performance Health

**Files:**
- Create/complete: `runtime/extension/shared/operational-event-filter.js`
- Create/complete: `runtime/extension/shared/trace-explanation.js`
- Create/complete: `runtime/extension/shared/slo-history.js`
- Create/complete: `runtime/extension/shared/stabilization-runbook.js`
- Create/complete: `runtime/extension/shared/performance-health.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Test: `runtime/extension/tests/cycles-136-140-operational-review.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `feat: add operational review and stabilization guidance`.

### Task 10: Cycles 141–145 — Search, Virtualization, Rendering, Idle Work, Budgets

**Files:**
- Create/complete: `runtime/extension/shared/command-search-index.js`
- Create/complete: `runtime/extension/dashboard/virtual-list-model.js`
- Create/complete: `runtime/extension/dashboard/render-scheduler.js`
- Create/complete: `runtime/extension/dashboard/idle-work-coordinator.js`
- Create/complete: `runtime/extension/shared/live-ux-memory-budget.js`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Test: `runtime/extension/tests/cycles-141-145-live-performance.test.js`

**Interfaces:**
- Consumes: `RuntimePilotState.snapshot(sessionId)`, controller mutation lane, allow-listed dashboard commands, Session Registry ownership, current layout/window APIs.
- Produces: bounded JSON-safe metadata models and dashboard views. Derivation functions must be side-effect free; commands mutate only through controller/background owners.

- [ ] Write or complete the block regression contract before finishing production integration.
- [ ] Implement all five cycle contracts from the matching design document.
- [ ] Integrate every new production module into an existing reachable owner or remove it.
- [ ] Review privacy, bounded collections, focus safety, and 320-pixel layout.
- [ ] Update the cycle log with Bug fixes / New features / Implementation.
- [ ] Commit as `perf: bound live cockpit search render and memory`.

## Consolidated Cycle 96–145 gate

- [ ] Run all block regression files after all source blocks are complete.
- [ ] Run the complete repository validator.
- [ ] Classify and fix production defects before stale contracts.
- [ ] Commit verification corrections only after focused suites pass.
- [ ] Do not run isolated browser smoke yet if Cycles 146–170 immediately follow; browser evidence is consolidated after Cycle 170.

## Self-review

- Spec coverage: every Cycle 96–145 is mapped to exactly one task.
- Placeholder scan: no deferred implementation language; only executable-test timing is deferred by user instruction.
- Type consistency: every model returns JSON-safe metadata and every mutation is routed through existing controller/background owners.