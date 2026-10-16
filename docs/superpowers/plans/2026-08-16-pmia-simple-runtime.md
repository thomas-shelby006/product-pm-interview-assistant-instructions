# PMIA Simple Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PMIA delivery hot path with one small extension-native fan-out pipeline that writes and submits every Window 1 turn to Window 2 and optional Window 3 concurrently, with a compact Studio/cockpit and six-stage diagnostics.

**Architecture:** AutoHotkey remains only as process/window bootstrap. A new simple extension runtime owns capture, direct port fan-out, per-role FIFO delivery, provider write/submit/rendered proof, and a bounded stage log. Boot/context is sent directly to answer roles and is not part of live question sequencing.

**Tech Stack:** Microsoft Edge MV3 extension, JavaScript ES modules, chrome.runtime.Port, chrome.storage.session, chrome.scripting MAIN-world execution for provider-native editor updates, AutoHotkey v2 only for bootstrap/layout, HTML/CSS extension pages, Node `node:test`.

## Global Constraints
- Optimize internal question-transfer latency ahead of development-time viewport constraints.
- Success means provider-rendered user-turn proof; backend receipt or composer fill alone is not success.
- Window 2 and Window 3 delivery starts concurrently.
- Do not route boot/context through Window 1.
- No clipboard, WinActivate, or OS keystroke dependency in the live question-delivery path.
- Keep the existing dirty `main` worktree untouched; implementation happens only on `feature/pmia-simple-runtime`.
- Do not delete the legacy 0.11 runtime until the new runtime passes focused tests and isolated Edge smoke.
- Diagnostic log contains no duplicated transcript text.

---

### Task 1: Lock the core delivery contract

**Files:**
- Create: `runtime/extension/simple/protocol.js`
- Create: `runtime/extension/simple/fanout.js`
- Create: `runtime/extension/tests/simple-runtime-core.test.js`

**Interfaces:**
- `makeTurn({sessionId, turnId, text, kind}) -> immutable turn`
- `fanOutTurn({turn, roles, deliver}) -> {receiver, comparison}`
- Role result stages: `queued | composer_written | submitted | rendered | failed`

- [ ] Write failing tests proving W2/W3 delivery starts concurrently, comparison failure cannot delay W2, and only `rendered` counts as success.
- [ ] Run `node --test runtime/extension/tests/simple-runtime-core.test.js` and verify RED because modules do not exist.
- [ ] Implement the minimal immutable turn/result/fan-out functions.
- [ ] Rerun and verify GREEN.

### Task 2: Build one answer-role FIFO owner

**Files:**
- Create: `runtime/extension/simple/role-queue.js`
- Create: `runtime/extension/tests/simple-role-queue.test.js`

**Interfaces:**
- `createRoleQueue({role, deliverOne, onStage})`
- `.push(turn)` deduplicates `{sessionId, turnId, role}` and processes exactly once in FIFO order.

- [ ] Write failing tests for ordered delivery, duplicate suppression, role-local failure, and independent W2/W3 progress.
- [ ] Verify RED.
- [ ] Implement the smallest FIFO queue using one promise chain per role.
- [ ] Verify GREEN.

### Task 3: Build minimal provider write/submit/render proof

**Files:**
- Create: `runtime/extension/simple/adapters/chatgpt.js`
- Create: `runtime/extension/simple/adapters/claude.js`
- Create: `runtime/extension/simple/claude-main-writer.js`
- Modify: `runtime/extension/manifest.json`
- Create: `runtime/extension/tests/simple-provider-adapters.test.js`

**Interfaces:**
- `write(text)`
- `verifyComposer(text)`
- `submit()`
- `verifyRenderedTurn(text, {timeoutMs})`

**ChatGPT:** current semantic `section[data-turn="user"]` and current composer/send controls.

**Claude:** MAIN-world `chrome.scripting.executeScript` updates Claude's own Tiptap/editor state; isolated runtime then uses the real provider submit control. No raw DOM write may report ready unless provider state matches.

- [ ] Write failing fixtures for current ChatGPT semantic turn markup and Claude Tiptap composer behavior.
- [ ] Verify RED.
- [ ] Implement only selectors/state transitions necessary for the four-method contract.
- [ ] Verify GREEN.

### Task 4: Replace live sender hot path

**Files:**
- Create: `runtime/extension/simple/sender.js`
- Create: `runtime/extension/simple/content-entry.js`
- Modify: `runtime/extension/content/main.js`
- Create: `runtime/extension/tests/simple-sender.test.js`

**Interfaces:**
- Sender emits only newly rendered submitted user turns.
- Sender sends `turn` frames over one long-lived port.
- Sender keeps a tiny unacknowledged map until both configured roles reach terminal rendered/failed state.

- [ ] Write failing tests proving historical turns are baselined, one new turn emits once, and capture is not blocked by analytics/storage.
- [ ] Verify RED.
- [ ] Implement minimal MutationObserver + provider turn reader using current semantic IDs.
- [ ] Verify GREEN.

### Task 5: Build simple service-worker session/fan-out coordinator

**Files:**
- Create: `runtime/extension/simple/coordinator.js`
- Simplify entry routing in: `runtime/extension/background.js`
- Create: `runtime/extension/tests/simple-coordinator.test.js`

**Interfaces:**
- Roles register `{sessionId, role, tabId, provider}`.
- Sender frame `turn` is dispatched concurrently to receiver and configured comparison ports.
- Only unresolved role deliveries are retained in `chrome.storage.session`.
- Stage updates are forwarded to Studio/cockpit asynchronously.

- [ ] Write failing tests for exact session ownership, concurrent fan-out, receiver-only mode, three-window mode, unresolved-only persistence, and no generic Pilot/batch dependency on the fast path.
- [ ] Verify RED.
- [ ] Implement coordinator and route existing background startup to it.
- [ ] Verify GREEN.

### Task 6: Separate boot/context from live questions

**Files:**
- Extend: `runtime/extension/simple/coordinator.js`
- Create: `runtime/extension/simple/studio-controller.js`
- Create: `runtime/extension/tests/simple-boot.test.js`

**Interfaces:**
- `sendBoot({sessionId, text})` fans directly to answer roles with `kind:'boot'`, no live sequence number.
- Live question sequence always starts at `1`.

- [ ] Write failing tests proving boot never visits sender and never consumes question sequence.
- [ ] Verify RED.
- [ ] Implement direct answer-role boot dispatch.
- [ ] Verify GREEN.

### Task 7: Replace AHK Studio with extension web Studio

**Files:**
- Create: `runtime/extension/studio/index.html`
- Create: `runtime/extension/studio/studio.css`
- Create: `runtime/extension/studio/studio.js`
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Create: `runtime/extension/tests/simple-studio.test.js`

**Default Studio:** sender provider, receiver provider, comparison Off/provider, Resume, JD, Launch. One `More` disclosure for optional metadata/profile/layout.

**AHK:** launch Studio and apply provider/cockpit geometry only. Remove boot clipboard delivery from the new path.

- [ ] Write failing markup/launcher tests for the reduced contract.
- [ ] Verify RED.
- [ ] Implement Studio and minimal AHK bootstrap.
- [ ] Verify GREEN including AHK parse.

### Task 8: Replace full dashboard with compact bottom cockpit

**Files:**
- Create: `runtime/extension/cockpit/index.html`
- Create: `runtime/extension/cockpit/cockpit.css`
- Create: `runtime/extension/cockpit/cockpit.js`
- Create: `runtime/extension/simple/stage-log.js`
- Create: `runtime/extension/tests/simple-cockpit.test.js`

**Default controls:** Auto Forward, Pause/Resume, Manual Gather, Export, Help.

**Path row:** `W1 Captured | W2 Written/Submitted/Rendered | W3 Written/Submitted/Rendered` with elapsed times and one stable reason code on failure.

- [ ] Write failing tests for five controls, no flashing/resync loop, six-stage bounded log, and no transcript text in diagnostics.
- [ ] Verify RED.
- [ ] Implement compact dock and bounded stage log.
- [ ] Verify GREEN.

### Task 9: Layout and performance contract

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Create: `runtime/extension/tests/simple-layout-performance.test.js`

**Contract:** three provider windows occupy the main work area; cockpit is a short bottom strip. Two-window mode expands W1/W2 but keeps the same bottom dock.

- [ ] Write failing tests for fixed geometry and absence of delivery-path clipboard/focus calls.
- [ ] Add a deterministic fan-out benchmark asserting no intentional serial wait between role dispatches and <25 ms in-memory dispatch overhead under a 1000-turn synthetic run.
- [ ] Implement minimal geometry/bootstrap changes.
- [ ] Verify GREEN.

### Task 10: Switch manifest to simple runtime and remove dead hot-path dependencies

**Files:**
- Modify: `runtime/extension/manifest.json`
- Modify: `runtime/extension/content/main.js`
- Modify: `runtime/extension/background.js`
- Remove only imports/modules proven unreachable from the active simple entry points.
- Update: `runtime/extension/README.md`

- [ ] Write a failing reachability test that rejects legacy Pilot/batch/outbox modules from the active delivery import graph.
- [ ] Verify RED.
- [ ] Switch active entry points.
- [ ] Remove only now-unreachable hot-path code; keep export/analytics modules reachable from explicit export paths if still needed.
- [ ] Verify GREEN.

### Task 11: Final verification

- [ ] Run focused simple-runtime tests.
- [ ] Run full `npm test` and classify legacy tests that intentionally target retired architecture; migrate/remove only tests whose production owner is gone.
- [ ] Run `powershell -File runtime/Validate_Extension_Runtime.ps1`.
- [ ] Run `git diff --check`.
- [ ] Run isolated Edge smoke in a temporary profile with two-window and three-window scenarios.
- [ ] Measure capture->fanout dispatch and role write/submit/proof timing.
- [ ] Reload only the PMIA unpacked extension in Profile 1 after all automated checks pass.
- [ ] Leave final local Studio/runtime available for user testing without changing unrelated browser/profile state.
