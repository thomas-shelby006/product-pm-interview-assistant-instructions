# PMIA Runtime Pilot Dashboard and Legacy Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly requires no executable tests during development; write coverage during each task, perform source/diff review after each phase, and run one consolidated test/validation/browser-evidence gate only after all implementation is complete.

**Goal:** Ship PMIA 0.7 as a three-window Product Manager mock-interview runtime with a live Runtime Pilot Dashboard, safe operator queue, legacy feature parity, deterministic recovery and measurable operational efficiency gains.

**Architecture:** Preserve AutoHotkey v2 + Edge Stable + Manifest V3. The service worker becomes the single authority for transport control, operator queue, health and dashboard state. Sender/receiver runtimes publish telemetry and execute semantic commands; an extension dashboard uses a long-lived port, while AHK owns initial launch and the strongest full-route repair.

**Tech Stack:** AutoHotkey v2, Microsoft Edge Stable, Manifest V3 ES modules, Chrome tabs/windows/storage/session APIs, HTML/CSS/vanilla JavaScript dashboard, Node.js built-in test runner, PowerShell validators.

## Global Constraints

- Work only in `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement`.
- Keep `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions` unchanged.
- Preserve all legacy, archive, evidence and rollback files.
- Do not restore Tampermonkey, localStorage transport, screenshot injection, code-focus overlay or DOM-removing virtual scroll.
- Previews are disposable; only final envelopes enter the operator queue.
- Provider-rendered user turns remain the only delivery proof.
- Active transcript/context state uses `chrome.storage.session`, never disk-backed extension storage.
- No executable tests, builds, validators or browser test runs until Task 12.
- Source-level inspection, `git diff`, `git diff --check`, syntax-aware editing and test authoring are allowed during development.
- Do not push or merge. Commit locally in the isolated worktree.

---

### Task 1: Preserve and finish the 0.7 reliability foundation

**Files:**
- Existing modified reliability files from `2026-08-01-pmia-0.7-reliability-coherence.md`
- Tests: existing 0.7 reliability test additions

**Interfaces:**
- Produces: ephemeral log store, safe session-context extraction, deterministic session removal, dead-owner probing, background-safe wake, schema 2.1 exports, `Alt+H`, and `Alt+Shift+R`.

- [ ] Audit current uncommitted changes against the earlier plan and design.
- [ ] Correct incomplete cleanup, registration and export edge cases discovered by the audit.
- [ ] Preserve historical 0.6.1 evidence while updating active release surfaces only.
- [ ] Mark the earlier plan tasks complete without running their tests.
- [ ] Commit the reliability foundation as one coherent local commit.

### Task 2: Define dashboard protocol and runtime state model

**Files:**
- Create: `runtime/extension/shared/dashboard-protocol.js`
- Create: `runtime/extension/shared/operator-queue.js`
- Create: `runtime/extension/shared/runtime-pilot-state.js`
- Create: `runtime/extension/tests/dashboard-protocol.test.js`
- Create: `runtime/extension/tests/operator-queue.test.js`
- Create: `runtime/extension/tests/runtime-pilot-state.test.js`

**Interfaces:**
- Produces: `DASHBOARD_PORT_PREFIX`, `normalizeDashboardCommand`, `OperatorQueue`, `RuntimePilotState`, `buildPilotSnapshot`, bounded timeline and warning helpers.
- Queue item shape: `{ id, envelope, queuedAt, reason, attempts, status }`.
- Pilot mode: `active | paused | repairing | degraded | ended`.

- [ ] Define allow-listed commands and strict command payload validation.
- [ ] Implement a 20-item final-envelope queue with enqueue, select, send-mark, discard and clear operations.
- [ ] Implement session snapshot state for roles, latest preview/final, transport, queue, warnings, metrics and timeline.
- [ ] Make updates idempotent by command/request ID and envelope ID.
- [ ] Bound timeline to 200 events and warnings to current actionable conditions.
- [ ] Add unit coverage without executing it.

### Task 3: Add service-worker dashboard authority

**Files:**
- Modify: `runtime/extension/background.js`
- Modify: `runtime/extension/shared/session-registry.js`
- Modify: `runtime/extension/shared/session-status.js`
- Modify: `runtime/extension/shared/delivery.js`
- Modify: `runtime/extension/manifest.json`
- Create: `runtime/extension/tests/dashboard-background.test.js`

**Interfaces:**
- Consumes: Task 2 state and queue modules.
- Produces: dashboard ports, `PMIA_RUNTIME_TELEMETRY`, `PMIA_DASHBOARD_COMMAND`, `PMIA_RUNTIME_COMMAND`, snapshot broadcasts and browser-window actions.

- [ ] Persist pilot state under one `chrome.storage.session` key separate from the role registry.
- [ ] Accept dashboard ports named `pmia-dashboard:<sessionId>` and immediately send a full snapshot.
- [ ] Broadcast snapshots only when meaningful state changes; heartbeat age is derived client-side.
- [ ] Route active finals normally; while paused, enqueue validated finals and suppress previews.
- [ ] Implement resume-latest, resume-without-send, send-selected, discard-selected and discard-all.
- [ ] Record delivery attempts, acknowledgement, queue transitions and answer outcomes in the pilot timeline.
- [ ] Add service-worker commands for preflight, runtime recovery, boot resend, mic, scroll, export, end and browser layouts.
- [ ] Add `windows` permission and safe popup/window creation for missing-role repair.
- [ ] Clear pilot state and dashboard ports during explicit end or orphan cleanup.
- [ ] Add coverage without executing it.

### Task 4: Publish sender and receiver telemetry

**Files:**
- Create: `runtime/extension/content/runtime-telemetry.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/status-overlay.js`
- Modify: provider adapters only where semantic state is missing
- Create: `runtime/extension/tests/runtime-telemetry.test.js`

**Interfaces:**
- Produces telemetry: role, provider, phase, composerReady, generating, voiceActive, micState, scrollLocked, paused, latestPreview, latestFinal, latestAnswer, lastActivityAt and pageUrl.
- Receives semantic runtime commands and returns structured results.

- [ ] Publish initial telemetry, meaningful state transitions and a five-second heartbeat.
- [ ] Keep full text only for latest preview/final in active session memory; overlays display short safe summaries.
- [ ] Track sender silence separately from runtime heartbeat and composer readiness.
- [ ] Add 90-second no-source warning and clear it on real activity.
- [ ] Store the latest boot text only in sender runtime memory for semantic resend.
- [ ] Implement commands: pause-local, resume-local, recover, resend-context, toggle-mic, toggle-scroll, focus-composer and export.
- [ ] Make role overlays show transport mode, queue count and fault state without covering provider controls.
- [ ] Add generic receiver overflow-safe CSS without code-focus behavior.
- [ ] Add coverage without executing it.

### Task 5: Build the Runtime Pilot Dashboard UI

**Files:**
- Create: `runtime/extension/dashboard/index.html`
- Create: `runtime/extension/dashboard/dashboard.css`
- Create: `runtime/extension/dashboard/dashboard.js`
- Create: `runtime/extension/dashboard/dashboard-model.js`
- Create: `runtime/extension/tests/dashboard-model.test.js`
- Modify: `runtime/extension/manifest.json`

**Interfaces:**
- Consumes: Task 3 snapshots and commands over a long-lived port.
- Produces: no direct provider mutation; all actions go through validated service-worker commands.

- [ ] Build a compact operational dashboard optimized for a narrow third window.
- [ ] Add overview cards for session, route, transport, sender, receiver, queue, delivery and answer health.
- [ ] Add queue table with selection, age, source, sequence, status and text preview.
- [ ] Add bounded virtualized timeline with filters for transport, health, control, warning and answer events.
- [ ] Add controls for all supported runtime operations and confirmations for destructive actions.
- [ ] Add Overview, Queue, Timeline and Review views.
- [ ] Add reconnect/backoff behavior and stale-dashboard warning.
- [ ] Derive heartbeat ages locally once per second instead of writing storage every second.
- [ ] Defend the dashboard title as `PMIA_DASHBOARD_<SESSION_ID>`.
- [ ] Add keyboard shortcuts inside the dashboard and visible shortcut help.
- [ ] Add model coverage without executing it.

### Task 6: Launch and manage the third window from AutoHotkey

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Modify: `runtime/Browser_Profile_Doctor.ps1` only if extension-ID output is insufficient
- Modify: `runtime/Validate_Extension_Runtime.ps1`
- Modify: `runtime/extension/tests/launcher.test.js`

**Interfaces:**
- Produces: `g_hDashboard`, dashboard lifecycle detection, dashboard URL construction, three-window layout, dashboard-only mode and exact-session cleanup.

- [ ] Add dashboard HWND and lifecycle title matching without changing sender/receiver identity rules.
- [ ] Build `chrome-extension://<extensionId>/dashboard/index.html?session=<sessionId>` from the selected profile record.
- [ ] Launch the dashboard after both roles register and before boot delivery is declared READY.
- [ ] Add a narrow three-window default layout plus dashboard-only and existing two-window modes.
- [ ] Include the dashboard in hide, restore, recovery and exact-session shutdown.
- [ ] Add `Alt+D` to show/focus the dashboard and dashboard lifecycle status to Session Studio.
- [ ] Keep `Alt+Shift+R` as the strongest full relaunch using in-memory context.
- [ ] Update launcher/static coverage without executing it.

### Task 7: Implement useful legacy parity without legacy mechanisms

**Files:**
- Modify: `runtime/extension/content/entry.js`
- Modify: dashboard files
- Create: `docs/LEGACY_FEATURE_PARITY.md`
- Add focused tests for each retained feature

**Interfaces:**
- Consumes semantic commands from Tasks 3–5.
- Produces retained features: pause, queue, selected flush, silence health, scroll lock, mic toggle, boot resend, export, live status and overflow safety.

- [ ] Document every old shortcut/feature as Ported, Replaced, Already Superior or Rejected.
- [ ] Map `Ctrl+Alt+0` to session-level transport pause rather than tab-local pause.
- [ ] Replace F12 force flush with dashboard send-selected/resume-latest through normal final delivery proof.
- [ ] Preserve `Alt+Esc`, `Alt+Q`, `Alt+W`, `Alt+E`, `Alt+H`, `Alt+Shift+R` and `Alt+Delete` behavior.
- [ ] Keep intentional no-op shortcuts absent.
- [ ] Confirm screenshot injection, focus overlay and DOM-removing virtual scroll remain absent.
- [ ] Add coverage without executing it.

### Task 8: Add operational efficiency improvements

**Files:**
- Modify: pilot state, background, telemetry and dashboard modules
- Add corresponding tests

**Interfaces:**
- Produces: latency metrics, health score, adaptive warnings, coalesced updates and one-click recovery diagnostics.

- [ ] Measure source-final-to-forward, forward-to-receiver, receiver-submit-to-proof and question-to-answer latency.
- [ ] Show rolling delivery success, average proof latency, queue age and answer timeout rate.
- [ ] Coalesce preview telemetry and dashboard broadcasts to avoid high-frequency UI/storage work.
- [ ] Avoid waking/focusing provider windows for normal dashboard status reads.
- [ ] Add a Repair Report summarizing exact actions and unresolved blockers.
- [ ] Add a one-click Copy Diagnostics action containing no transcript or setup text.
- [ ] Add coverage without executing it.

### Task 9: Bug audit and owning-boundary fixes

**Files:**
- Runtime files discovered by audit
- Tests adjacent to each fixed owner

**Interfaces:**
- Produces: corrected lifecycle behavior without one-off workarounds.

- [ ] Trace launch, registration, preview, final, retry, queue, proof, answer, export, recovery and shutdown flows end to end.
- [ ] Inspect race conditions around pause during delivery, role replacement, service-worker restart, dashboard reconnect and session end.
- [ ] Fix stale queue state, duplicate commands, sequence rollback, missing telemetry and title conflicts at their owning boundary.
- [ ] Review provider adapter selectors and semantic controls for hidden/stale-node risks.
- [ ] Review privacy boundaries for accidental local storage or dashboard rendering of setup text.
- [ ] Add regression coverage without executing it.

### Task 10: Documentation, release and operator guidance

**Files:**
- Modify: `README.md`, `FILE_MAP.md`, `AI_SYSTEM_CONTEXT.md`
- Modify: `runtime/README_INSTALL_TEST.md`, `runtime/extension/README.md`
- Modify: active status/handoff/setup tracker docs
- Modify: `project_upload_bundle/03_SESSION_RUNTIME_AND_CONTEXT.md`
- Modify: version assertions and release tests

**Interfaces:**
- Produces: one accurate active setup path and dashboard operating guide.

- [ ] Update active architecture from two managed windows to sender + receiver + dashboard.
- [ ] Add dashboard controls, queue semantics, recovery ladder and privacy boundaries.
- [ ] Include the legacy parity matrix and rejected-feature rationale.
- [ ] Update active release to 0.7.0 without rewriting historical 0.6.x evidence.
- [ ] Remove stale Edge Beta/Tampermonkey/operator instructions from active docs.

### Task 11: Source review and completion audit

**Files:**
- All changed files

- [ ] Review the complete diff by subsystem and remove duplication, dead code and accidental prompt changes.
- [ ] Verify the original checkout status and commit remain unchanged.
- [ ] Run `git diff --check` only as a whitespace/source integrity check; do not run executable validation yet.
- [ ] Confirm every approved feature maps to code, UI, documentation and coverage.
- [ ] Confirm every rejected feature is absent from manifest and active runtime.

### Task 12: One consolidated final verification gate

**Files:**
- All tests and validators
- Browser evidence outputs in the designated evidence directory only

- [ ] Run the complete Node test suite once.
- [ ] Run extension validation once.
- [ ] Run AutoHotkey validation and runtime PowerShell validation in the same chained gate.
- [ ] Resolve failures from exact output and rerun the entire consolidated gate until clean.
- [ ] Load the extension in the selected Edge Stable profile and perform all four provider-route checks.
- [ ] Capture browser evidence for dashboard connect, live telemetry, pause/queue/resume, selected send, repair, reconnect, layout, export and end session.
- [ ] Verify one rendered receiver user turn per final envelope and no duplicate submissions.
- [ ] Verify no transcript/setup state remains after end session or browser restart.
- [ ] Commit the final implementation locally; do not push or merge.

## Completion Test

The work is complete only when the isolated worktree contains the full dashboard and parity implementation, the original checkout is unchanged, every retained legacy capability is routed through the new architecture, rejected mechanisms remain absent, all final automated and browser gates pass, and the final report identifies changes, evidence, remaining provider-owned risks and the exact commit.
