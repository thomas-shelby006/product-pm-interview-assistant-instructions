# PMIA 0.12 User-Feature Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the real Stable Edge ChatGPT -> Claude + ChatGPT route and migrate the selected high-value 0.11 user-facing outcomes into PMIA 0.12 without adding a second delivery/recovery architecture.

**Architecture:** Keep the existing direct-port sender -> coordinator -> per-role FIFO -> provider adapter path unchanged except for proven root-cause fixes. Add session metadata, window commands, review inspection, markers, end-session safety, accessibility, and derived status only on the service-worker/UI side. Provider answer metrics are one-shot on Review, never continuous.

**Tech Stack:** Microsoft Edge MV3, JavaScript ES modules, chrome.runtime.Port, chrome.storage.session, chrome.windows/tabs, HTML/CSS extension pages, Node `node:test`, isolated Edge smokes, Stable Profile 1 acceptance.

## Global Constraints
- No new extension permissions, alarms, or background polling loops.
- No persistent transcript or answer text.
- No feature module may own delivery, sequencing, retry, or provider readiness.
- Keep active production <=45 HTML/CSS/JS files and <=2,500 lines.
- Preserve dirty `main`; implement only on `feature/pmia-simple-runtime`.
- Keep disabled PMIA 0.11 installed for rollback; do not delete profile/session/token data.
- Real success is provider-rendered user-turn proof in both configured answer lanes.

---
### Task 1: Close the real-route delivery blocker

**Files:**
- Modify: `runtime/extension/simple/port-router.js`
- Modify: `runtime/extension/tests/simple-port-router.test.js`
- Modify only if live evidence requires it: `runtime/extension/simple/adapters/claude.js`, `simple/claude-main-writer.js`
- Test: matching `simple-*.test.js` adapter/router tests

**Interfaces:**
- `createSimplePortRouter({coordinator,onStage,onRegister})`
- Provider delivery timeout ownership stays exclusively in `deliverTurn()`.

- [ ] Keep the existing failing-first regressions proving a slow role is not preempted by a router timer and disconnect fails pending work immediately.
- [ ] Run `node --test runtime/extension/tests/simple-port-router.test.js runtime/extension/tests/simple-reconnect.test.js`; require PASS.
- [ ] Run the exact Stable Profile 1 route in normal off-screen PMIA-owned windows with a >=120 s diagnostic wait.
- [ ] If Claude returns `submit_unavailable`, capture current Send control attributes and update only Claude `SEND` selectors/submit semantics with a focused failing fixture first.
- [ ] If Claude returns `composer_write_failed`, add a failing MAIN-writer fixture for the observed editor contract, then fix only `claude-main-writer.js`.
- [ ] If Claude returns `render_not_verified`, add a failing user-turn markup fixture, then fix only Claude rendered-turn normalization/selectors.
- [ ] Require `receiver.stage === 'rendered'` and `comparison.stage === 'rendered'`, then independently verify the exact token exists in both answer windows with foreground HWND unchanged.
### Task 2: Add bounded session metadata and window tools

**Files:**
- Create: `runtime/extension/simple/session-tools.js`
- Modify: `runtime/extension/simple/service-worker.js`
- Test: `runtime/extension/tests/simple-session-tools.test.js`

**Interfaces:**
- `buildSessionMeta({sessionId,roles,launch,startedAt}) -> {sessionId,startedAt,roles,windows,layout}`
- `deriveReadiness({meta,snapshot}) -> {state,label,detail}`
- UI message: `{type:'ui_command', command:'focus_window'|'restore_layout', role?, sessionId, requestId}`

- [ ] Write failing pure tests for session metadata, Ready/Waiting/Degraded labels, and role/window lookup.
- [ ] Persist one `chrome.storage.session` meta record after `launchSimpleSession()` resolves; include no Resume/JD/provider-page content.
- [ ] Add explicit focus commands for sender/receiver/comparison/cockpit using stored PMIA-owned window IDs.
- [ ] Add Restore layout using the stored launch geometry; no polling and no automatic focus changes.
- [ ] Verify missing/closed windows return a stable failed UI result and never affect delivery.
- [ ] Run the focused session-tools/service-worker contract tests and existing launch/layout tests.
### Task 3: Add one-shot role inspection and answer metrics

**Files:**
- Create: `runtime/extension/simple/inspection.js`
- Modify: `simple/content-runtime.js`, `adapters/chatgpt.js`, `adapters/claude.js`, `service-worker.js`
- Test: `tests/simple-inspection.test.js`, extend `simple-provider-adapters.test.js`

**Interfaces:**
- `answerMetrics(text, speakingWpm=129) -> {wordCount,estimatedSpeakingMs}`
- Adapter method: `readLatestAssistantText() -> string`
- Role request: `{type:'inspect_request', requestId, scope:'review'|'latest_question'}`
- Role result contains sender `recentQuestions` or answer-role metrics; raw answer text is never posted off the provider page.

- [ ] Write failing tests for ChatGPT/Claude assistant-turn selectors using current semantic fixtures.
- [ ] Write failing tests proving `answerMetrics()` handles empty text, punctuation, and deterministic 129-WPM speaking estimates.
- [ ] Add content-runtime inspection handling that bypasses the delivery FIFO and does not call `deliverTurn()`.
- [ ] Add service-worker fan-in with short UI-only request timeouts; unavailable inspection returns `available:false` and does not alter role registration.
- [ ] Cap recent sender turns at 20 and return them only for explicit inspection; do not write them to storage.
- [ ] Run inspection, adapter, content-runtime, and delivery tests together to prove no delivery contract changed.
### Task 4: Add bounded review markers and review model

**Files:**
- Create: `runtime/extension/simple/markers.js`
- Modify: `simple/service-worker.js`, `simple/session-summary.js`
- Test: `tests/simple-markers.test.js`, extend `simple-session-summary.test.js`

**Interfaces:**
- `normalizeMarkers(values, limit=50)`
- `upsertMarker(values,{sessionId,turnId,category,at})`
- Categories: `strong_answer | needs_review | follow_up`
- UI commands: `mark_question`, `get_review_data`

- [ ] Write failing tests for metadata-only marker shape, dedupe by session/turn/category, update semantics, and 50-record cap.
- [ ] Store markers under a session-scoped `chrome.storage.session` key; reject payloads containing question/answer text fields.
- [ ] Extend session summary with delivery success counts/rates and marker counts using existing bounded stages plus marker metadata.
- [ ] `get_review_data` combines current snapshot, summary, markers, unresolved count, session meta, and one-shot inspection; it must not persist inspection text.
- [ ] Run marker/summary/service-worker tests and assert no new storage key contains transcript or answer text.
### Task 5: Build the compact Tools & Review experience

**Files:**
- Modify: `runtime/extension/cockpit/index.html`, `cockpit.css`, `cockpit.js`
- Create: `runtime/extension/cockpit/tools.js`
- Test: extend `tests/simple-cockpit.test.js`; create `tests/simple-cockpit-tools.test.js`

**Interfaces:**
- Keep five primary controls: Auto, Pause/Resume, Send gathered, Export, Help.
- Tools sections: Status, Windows, Review, Display, End session, Shortcuts.

- [ ] Write failing markup tests proving no new primary button is added and the six secondary sections exist.
- [ ] Render Ready/Waiting/Degraded from `deriveReadiness`; show configured route and one elapsed-session clock.
- [ ] Add explicit Focus W1/W2/W3/Cockpit and Restore buttons using `ui_command`; do not auto-focus any window.
- [ ] Add Review refresh that renders <=20 recent questions, <=20 recent stage events, delivery summary, receiver/comparison word count and speaking estimate.
- [ ] Add Strong / Needs review / Follow-up marker buttons for the selected recent question.
- [ ] Add Copy latest question; call one-shot inspection and copy only on the explicit user gesture.
- [ ] Add session-only Reduced motion, Large text, and High contrast preferences applied only to Studio/cockpit UI.
- [ ] Extend keyboard help without intercepting keys while an input, textarea, select, or dialog text control has focus.
### Task 6: Add graceful end and richer safe export

**Files:**
- Modify: `simple/service-worker.js`, `cockpit/tools.js`, `cockpit/cockpit.js`
- Test: `tests/simple-session-end.test.js`, extend `simple-session-summary.test.js`

**Interfaces:**
- `prepare_end` -> `{blocked,unresolvedCount,windowCount}`
- `end_session` -> `{ok,closed,failed}` with `force:true` required when unresolved exists.
- Export schema includes version, route, readiness, bounded stages, delivery summary, answer metrics when available, and marker metadata; no raw answer text.

- [ ] Write failing tests for clean end, blocked end, force end, missing window IDs, and closing only PMIA-owned windows.
- [ ] `prepare_end` reads unresolved storage only on demand and never archives or deletes provider conversations.
- [ ] End UI offers Export, Cancel, and End anyway only when unresolved work exists.
- [ ] Extend Export to request current review metadata once; if inspection is unavailable, export operational data with `inspectionAvailable:false` rather than failing.
- [ ] Verify export contains no Resume, JD, credentials, cookies, raw provider URLs, or raw answer text.
- [ ] Verify ending does not clear Edge profile data or unrelated tabs/windows.
### Task 7: Enforce architecture and performance budgets

**Files:**
- Modify: `tests/simple-active-runtime.test.js`, `tests/simple-layout-performance.test.js`
- Create: `tests/simple-feature-budget.test.js`

**Interfaces:**
- Feature modules are reachable only from service-worker/cockpit UI edges, never from delivery primitives.

- [ ] Add a failing reachability test if `session-tools`, `inspection`, `markers`, or cockpit tooling is imported by `sender.js`, `fanout.js`, `role-queue.js`, or `deliver-turn.js`.
- [ ] Add source-budget assertions: <=45 active HTML/CSS/JS production files and <=2,500 active production lines.
- [ ] Assert manifest permissions are unchanged and no `chrome.alarms`/background interval is introduced.
- [ ] Keep the existing 1000-turn synthetic fan-out benchmark and require the <25 ms in-memory dispatch target with no intentional W2/W3 serialization.
- [ ] Run the focused architecture/performance tests before the full suite.
### Task 8: Full verification, installed transition, and cleanup

**Files:**
- No new production files unless a verification failure proves a scoped defect.
- Deployment copy: `runtime/extension/__pmia012_deploy` in the preserved main repo, excluded from Git.

- [ ] Run `npm test`; require every active 0.12 test PASS.
- [ ] Run `npm run validate` / `Validate_Extension_Runtime.ps1`; require active-graph, MV3 transport/reconnect, provider fixture, and AHK parse gates PASS.
- [ ] Run `git diff --check` and inspect the complete feature-branch diff against its current HEAD.
- [ ] Measure final production file count, line count, synthetic dispatch, fixture render times, and skew against Task 7 budgets.
- [ ] Sync the installed deployment copy byte-for-byte from the verified feature worktree and self-reload only PMIA 0.12.
- [ ] Run exact Stable Profile 1 ChatGPT -> Claude + ChatGPT acceptance with PMIA-owned windows off-screen but not minimized; verify both answer roles `rendered` and foreground HWND unchanged.
- [ ] Run one two-window Stable acceptance with comparison Off.
- [ ] Restore any temporary smoke harness byte-for-byte, close only task-created PMIA windows, and remove task-owned screenshots/temp files.
- [ ] Verify PMIA 0.12 is On, PMIA 0.11 remains Off but installed, browser profile/session/token data is untouched, dirty main remains preserved, and the feature worktree contains only intended task changes.
### Task 9: Source-control handoff

- [ ] Leave `main` untouched and do not merge/rebase the 0.12 work into it.
- [ ] Do not stage, commit, amend, or push the new migration changes unless the user separately authorizes that source-control action.
- [ ] Report the existing published 0.12 baseline SHA, the new local diff, verification evidence, installed extension state, and any remaining provider/environment limitation.

## Completion evidence
A complete run must show: real three-window route PASS, two-window route PASS, all automated gates PASS, selected user-facing features functional, active source within budget, no new delivery owner/timer/polling layer, deployment copy equal to verified source, temporary harness restored, dirty main unchanged, and old 0.11 preserved for rollback.
## Plan self-review
- **Spec coverage:** Task 1 real route; Task 2 readiness/window/session meta; Task 3 one-shot questions/answer metrics; Task 4 markers/review model; Task 5 compact UX/accessibility/copy; Task 6 end/export; Task 7 architecture/performance budgets; Task 8 deployment/real browser verification; Task 9 source-control boundary.
- **Placeholder scan:** no TBD/TODO/placeholder instructions remain.
- **Interface consistency:** `ui_command` owns window/end actions, role `inspect_request` owns one-shot page inspection, markers are metadata-only, and no new interface wraps or replaces delivery primitives.
- **Scope check:** all migrated features share the same active-session/cockpit contract; no separate subsystem needs an independent spec.
- **Authorization check:** Edge deployment is in scope; dirty `main` is read-only; no new staging/commit/push is planned.
## 2026-08-17 production-parity rework update

### Revised production model
- Three-window mode is the default production topology: W1 source, W2 answer lane A, W3 answer lane B.
- W2 and W3 are peers. The legacy internal role name `comparison` does not imply lower priority or best-effort behavior.
- W2/W3 must share the same FIFO, reconnect replay, rendered-proof success rule, inspection, markers, export, window tools, and performance budget.
- Either answer lane may use ChatGPT or Claude.
- Two-window mode remains a supported fallback, not the primary design target.

### Focused submit invariant
- Keyboard submit is allowed only when the intended provider composer is the focused editable target.
- Never send Enter to browser chrome, another control, another window, or an unrelated editable.
- Provider-native submit/form APIs are preferred when they operate on the exact verified composer.
- Terminal success remains a new rendered user turn containing the exact text.

### Revised implementation order
1. Persist `docs/PMIA_REWORK_OPERATING_RULES.md` and keep it current for future agents.
2. Finish current ChatGPT compatibility work: MAIN-world ProseMirror/React write, submit fallback, and PMIA-stale-draft cleanup on sender startup only.
3. Audit the active graph for any receiver/comparison asymmetry; remove W3 best-effort semantics and enforce production parity.
4. Audit submit/focus behavior for ChatGPT and Claude; add the smallest provider-specific focus/submit guard needed.
5. Reconcile selected 0.11 user-facing features against the migration matrix; do not restore retired control-plane machinery.
6. Verify performance/complexity budgets after the implementation batch rather than after every edit.
7. Run full automated gates, isolated provider/MV3 smokes, then real three-window acceptance; run two-window acceptance afterward.
8. Sync the persistent 0.12 deployment, keep 0.11 rollback, clean task-created artifacts, and produce the final HTML report.

### Plan review — correctness
- Boot context must never be routed through W1.
- W1 must start with a clean composer; cleanup is allowed only for the exact known PMIA setup-prefix residue.
- W2 and W3 have identical terminal success semantics: provider-rendered exact user turn.
- No queue/backend/composer-only state can be called delivered.

### Plan review — performance
- Keep the hot path browser-native: sender content runtime -> one long-lived MV3 port -> concurrent W2/W3 port writes.
- Do not add AHK, clipboard, polling, analytics, export, markers, Review, or UI work before fan-out.
- W2 and W3 start concurrently; a slow lane cannot delay the other lane.
- Provider readiness/submit waits are role-local only.
- Measure PMIA capture/fan-out/delivery separately from model generation latency.

### Plan review — simplicity/debuggability
- Preserve one owner for capture, fan-out, role FIFO, provider delivery, and rendered proof.
- No new global sequence, batch planner, Runtime Pilot, resync engine, recovery scheduler, or duplicate ledger.
- Keep the diagnostic path to six stages: captured, fanout, composer_written, submitted, rendered, failed.
- Add no new background timer except the cockpit-local elapsed-time clock already accepted.
- Prefer deleting/stopping stale code paths over wrapping them with compatibility layers.

### Current checkpoint
- Existing live provider compatibility fixes are in the working tree and previously passed the release gate.
- One failing TDD regression remains intentionally red: sender startup does not yet clear an exact PMIA legacy setup draft.
- Implementation resumes at that regression, followed by W2/W3 production-parity audit.

## 2026-08-17 execution status
- [x] Persist durable PMIA rework operating rules for future agents.
- [x] Current ChatGPT ProseMirror/React write compatibility fixed and production entry covered.
- [x] ChatGPT no-Send-button form submission fallback live-proven.
- [x] Claude Tiptap write + Enter fallback live-proven; keyboard fallback now verifies composer focus and fails closed otherwise.
- [x] Legacy PMIA setup draft is cleared only on ChatGPT W1 startup and only for the exact PMIA setup prefix; arbitrary drafts are preserved.
- [x] W2/W3 parity audited: same concurrent fan-out, FIFO, reconnect replay, boot proof, Review, export, window tools, and terminal rendered-proof rule.
- [x] W3 promoted in product semantics; Studio defaults to W3 enabled and labels Off only as a two-window fallback.
- [x] Cockpit/export use Window 1 / Window 2 / Window 3 user-facing labels.
- [x] Duplicate terminal rendered log entries removed; delivery remains single-owner.
- [x] Full active 0.12 release gate passes after final implementation batch.
- [x] Real three-window Stable Edge acceptance passed with exact token rendered in W1, W2 Claude, and W3 ChatGPT.
- [x] Real stage timing captured for PMIA vs provider settlement separation.
- [ ] Sync final verified commit to persistent deployment and reload PMIA 0.12.
- [ ] Generate final HTML migration/performance/feature report.
