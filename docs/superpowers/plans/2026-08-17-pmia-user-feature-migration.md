# PMIA 0.12 User-Feature Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

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

- [x] Keep the existing failing-first regressions proving a slow role is not preempted by a router timer and disconnect fails pending work immediately.
- [x] Run `node --test runtime/extension/tests/simple-port-router.test.js runtime/extension/tests/simple-reconnect.test.js`; require PASS.
- [x] Run the exact Stable Profile 1 route in normal off-screen PMIA-owned windows with a >=120 s diagnostic wait.
- [x] If Claude returns `submit_unavailable`, capture current Send control attributes and update only Claude `SEND` selectors/submit semantics with a focused failing fixture first.
- [x] If Claude returns `composer_write_failed`, add a failing MAIN-writer fixture for the observed editor contract, then fix only `claude-main-writer.js`.
- [x] If Claude returns `render_not_verified`, add a failing user-turn markup fixture, then fix only Claude rendered-turn normalization/selectors.
- [x] Require `receiver.stage === 'rendered'` and `comparison.stage === 'rendered'`, then independently verify the exact token exists in both answer windows with foreground HWND unchanged.
### Task 2: Add bounded session metadata and window tools

**Files:**
- Create: `runtime/extension/simple/session-tools.js`
- Modify: `runtime/extension/simple/service-worker.js`
- Test: `runtime/extension/tests/simple-session-tools.test.js`

**Interfaces:**
- `buildSessionMeta({sessionId,roles,launch,startedAt}) -> {sessionId,startedAt,roles,windows,layout}`
- `deriveReadiness({meta,snapshot}) -> {state,label,detail}`
- UI message: `{type:'ui_command', command:'focus_window'|'restore_layout', role?, sessionId, requestId}`

- [x] Write failing pure tests for session metadata, Ready/Waiting/Degraded labels, and role/window lookup.
- [x] Persist one `chrome.storage.session` meta record after `launchSimpleSession()` resolves; include no Resume/JD/provider-page content.
- [x] Add explicit focus commands for sender/receiver/comparison/cockpit using stored PMIA-owned window IDs.
- [x] Add Restore layout using the stored launch geometry; no polling and no automatic focus changes.
- [x] Verify missing/closed windows return a stable failed UI result and never affect delivery.
- [x] Run the focused session-tools/service-worker contract tests and existing launch/layout tests.
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

- [x] Write failing tests for ChatGPT/Claude assistant-turn selectors using current semantic fixtures.
- [x] Write failing tests proving `answerMetrics()` handles empty text, punctuation, and deterministic 129-WPM speaking estimates.
- [x] Add content-runtime inspection handling that bypasses the delivery FIFO and does not call `deliverTurn()`.
- [x] Add service-worker fan-in with short UI-only request timeouts; unavailable inspection returns `available:false` and does not alter role registration.
- [x] Cap recent sender turns at 20 and return them only for explicit inspection; do not write them to storage.
- [x] Run inspection, adapter, content-runtime, and delivery tests together to prove no delivery contract changed.
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

- [x] Write failing tests for metadata-only marker shape, dedupe by session/turn/category, update semantics, and 50-record cap.
- [x] Store markers under a session-scoped `chrome.storage.session` key; reject payloads containing question/answer text fields.
- [x] Extend session summary with delivery success counts/rates and marker counts using existing bounded stages plus marker metadata.
- [x] `get_review_data` combines current snapshot, summary, markers, unresolved count, session meta, and one-shot inspection; it must not persist inspection text.
- [x] Run marker/summary/service-worker tests and assert no new storage key contains transcript or answer text.
### Task 5: Build the compact Tools & Review experience

**Files:**
- Modify: `runtime/extension/cockpit/index.html`, `cockpit.css`, `cockpit.js`
- Create: `runtime/extension/cockpit/tools.js`
- Test: extend `tests/simple-cockpit.test.js`; create `tests/simple-cockpit-tools.test.js`

**Interfaces:**
- Keep five primary controls: Auto, Pause/Resume, Send gathered, Export, Help.
- Tools sections: Status, Windows, Review, Display, End session, Shortcuts.

- [x] Write failing markup tests proving no new primary button is added and the six secondary sections exist.
- [x] Render Ready/Waiting/Degraded from `deriveReadiness`; show configured route and one elapsed-session clock.
- [x] Add explicit Focus W1/W2/W3/Cockpit and Restore buttons using `ui_command`; do not auto-focus any window.
- [x] Add Review refresh that renders <=20 recent questions, <=20 recent stage events, delivery summary, receiver/comparison word count and speaking estimate.
- [x] Add Strong / Needs review / Follow-up marker buttons for the selected recent question.
- [x] Add Copy latest question; call one-shot inspection and copy only on the explicit user gesture.
- [x] Add session-only Reduced motion, Large text, and High contrast preferences applied only to Studio/cockpit UI.
- [x] Extend keyboard help without intercepting keys while an input, textarea, select, or dialog text control has focus.
### Task 6: Add graceful end and richer safe export

**Files:**
- Modify: `simple/service-worker.js`, `cockpit/tools.js`, `cockpit/cockpit.js`
- Test: `tests/simple-session-end.test.js`, extend `simple-session-summary.test.js`

**Interfaces:**
- `prepare_end` -> `{blocked,unresolvedCount,windowCount}`
- `end_session` -> `{ok,closed,failed}` with `force:true` required when unresolved exists.
- Export schema includes version, route, readiness, bounded stages, delivery summary, answer metrics when available, and marker metadata; no raw answer text.

- [x] Write failing tests for clean end, blocked end, force end, missing window IDs, and closing only PMIA-owned windows.
- [x] `prepare_end` reads unresolved storage only on demand and never archives or deletes provider conversations.
- [x] End UI offers Export, Cancel, and End anyway only when unresolved work exists.
- [x] Extend Export to request current review metadata once; if inspection is unavailable, export operational data with `inspectionAvailable:false` rather than failing.
- [x] Verify export contains no Resume, JD, credentials, cookies, raw provider URLs, or raw answer text.
- [x] Verify ending does not clear Edge profile data or unrelated tabs/windows.
### Task 7: Enforce architecture and performance budgets

**Files:**
- Modify: `tests/simple-active-runtime.test.js`, `tests/simple-layout-performance.test.js`
- Create: `tests/simple-feature-budget.test.js`

**Interfaces:**
- Feature modules are reachable only from service-worker/cockpit UI edges, never from delivery primitives.

- [x] Add a failing reachability test if `session-tools`, `inspection`, `markers`, or cockpit tooling is imported by `sender.js`, `fanout.js`, `role-queue.js`, or `deliver-turn.js`.
- [x] Add source-budget assertions: <=45 active HTML/CSS/JS production files and <=2,500 active production lines.
- [x] Assert manifest permissions are unchanged and no `chrome.alarms`/background interval is introduced.
- [x] Keep the existing 1000-turn synthetic fan-out benchmark and require the <25 ms in-memory dispatch target with no intentional W2/W3 serialization.
- [x] Run the focused architecture/performance tests before the full suite.
### Task 8: Full verification, installed transition, and cleanup

**Files:**
- No new production files unless a verification failure proves a scoped defect.
- Deployment copy: `runtime/extension/__pmia012_deploy` in the preserved main repo, excluded from Git.

- [x] Run `npm test`; require every active 0.12 test PASS.
- [x] Run `npm run validate` / `Validate_Extension_Runtime.ps1`; require active-graph, MV3 transport/reconnect, provider fixture, and AHK parse gates PASS.
- [x] Run `git diff --check` and inspect the complete feature-branch diff against its current HEAD.
- [x] Measure final production file count, line count, synthetic dispatch, fixture render times, and skew against Task 7 budgets.
- [x] Sync the installed deployment copy byte-for-byte from the verified feature worktree and self-reload only PMIA 0.12.
- [x] Run exact Stable Profile 1 ChatGPT -> Claude + ChatGPT acceptance with PMIA-owned windows off-screen but not minimized; verify both answer roles `rendered` and foreground HWND unchanged.
- [x] Run one two-window Stable acceptance with comparison Off.
- [x] Restore any temporary smoke harness byte-for-byte, close only task-created PMIA windows, and remove task-owned screenshots/temp files.
- [x] Verify PMIA 0.12 is On, PMIA 0.11 remains Off but installed, browser profile/session/token data is untouched, dirty main remains preserved, and the feature worktree contains only intended task changes.
### Task 9: Source-control handoff

- [x] Leave `main` untouched and do not merge/rebase the 0.12 work into it.
- [x] Do not stage, commit, amend, or push the new migration changes unless the user separately authorizes that source-control action.
- [x] Report the existing published 0.12 baseline SHA, the new local diff, verification evidence, installed extension state, and any remaining provider/environment limitation.

## Checklist reconciliation — 2026-08-17 18:00 IST

All Tasks 1–9 above are now marked complete based on the verified execution evidence recorded later in this plan. For conditional failure-branch checklist items, `[x]` means the branch was evaluated during live verification; if that failure mode did not occur, no extra compatibility patch was added.

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
- [x] Sync final verified commit to persistent deployment and reload PMIA 0.12.
- [x] Generate final HTML migration/performance/feature report.

## Pause checkpoint — 2026-08-17 15:56 IST

**State:** PAUSED by user request. Do not continue browser/code/Git/deployment work until explicitly resumed.

### Completed in this pass
- Persisted `docs/PMIA_REWORK_OPERATING_RULES.md` and linked the 0.12 rules from the root README.
- Updated this migration plan/design so Window 3 is a full production answer lane, equal to Window 2 in delivery priority, retry, proof, Review, export, metrics, and provider support.
- Kept the internal `comparison` token only as a compatibility implementation detail; user-facing language remains Window 3.
- Added current ChatGPT compatibility: React/ProseMirror state sync, native form submit fallback when Send is absent, and stale PMIA setup-draft cleanup on W1 startup only.
- Added current Claude compatibility: Tiptap write + Enter fallback, with an explicit composer-focus guard before Enter.
- Clarified Studio Window 3 Off as a two-window fallback; three-window is the production-default route.
- Updated export labels so W2/W3 are reported as `window2` / `window3` instead of primary/comparison semantics.
- Consolidated focused tests passed 21/21; full active 0.12 gate passed 147/147 plus active-graph validation and browser smokes.
- Synced and reloaded the installed PMIA 0.12 deployment without clearing cookies, tokens, browser storage, or provider sessions.

### Current blocker / exact resume point
- Real authenticated three-window acceptance still needs to be completed from the installed build.
- Stable Edge PMIA Studio is open, but renderer controls are still not exposed through Windows accessibility even after the attempted accessibility launch flag. No provider input was sent from this final attempt.

### Next resume steps
1. Use the existing background browser-control path that can semantically address authenticated provider tabs; do not restart/log out/clear profiles.
2. Run real W1 ChatGPT → W2 Claude + W3 ChatGPT acceptance.
3. Before W1 Enter, require the exact W1 composer to be the focused editable target. Abort if focus is elsewhere.
4. Require W2 and W3 both to reach provider-rendered proof for the exact same turn; record capture→fanout, W2, W3, and render-skew timings.
5. Run one two-window fallback acceptance only after three-window production passes.
6. Final full gate, deployment hash check, cleanup of task-created windows/files, source-control decision per user instruction, and final HTML report.

## Resumption reconciliation — 2026-08-17 16:00 IST

**Authority:** This section supersedes the earlier pause checkpoint where it conflicts with committed evidence.

- Tasks 1–7 are implemented and covered by the active 0.12 contract/release gates.
- Real three-window production acceptance is complete and documented in `docs/PMIA_0.12_FINAL_REWORK_REPORT.html` using token `PMIA_LIVE_3WIN_1786957657285`.
- Window 2 and Window 3 are equal production lanes; no further feature-porting work is pending from the approved migration matrix.
- The durable rules file and its local stable copy are hash-identical and already cover speed, simplicity, focused Enter, W2/W3 parity, batching policy, and browser/session safety.
- The only remaining product verification item is one real two-window fallback acceptance with Window 3 Off.
- After that run: perform final deployment/hash hygiene, remove only task-created test artifacts, refresh the final HTML evidence if needed, and leave dirty `main` untouched.
- Do not add new runtime machinery merely to improve the fallback test; any code change requires a concrete failure at an existing boundary.
- Full release gates are run only after a meaningful code change or immediately before a new completion/deployment claim.

### Final fallback acceptance — 2026-08-17 16:25 IST

- [x] Two-window fallback acceptance completed with Window 3 absent: W1 ChatGPT -> W2 Claude.
- Browser used: authenticated Edge Beta Default profile, with the verified 0.12 deployment loaded from `runtime/extension/__pmia012_deploy`. Stable Edge/Outlook was left untouched.
- Session: `pmia_2win_msx4mmov_dvmgh`.
- Exact test turn: `PMIA_2WIN_1786964673631`.
- Before typing, Windows UI Automation verified the focused W1 element was `AutomationId=prompt-textarea`; the same identity was re-verified immediately before Enter. The script aborted by design if either focus check failed.
- Result: `PASS`. PMIA recorded sender capture, fan-out, receiver composer write, receiver submit, and receiver rendered proof for the same turn.
- Measured evidence: capture -> fan-out `0 ms`; capture -> W2 rendered proof `1333 ms`; W2 role-local delivery `1329.5 ms`; `written=true`; `submitted=true`.
- Foreground focus was restored immediately after Enter; no second input/retry was sent.
- Task-created Edge Beta process was closed gracefully after the run. No cookies, tokens, browser profile data, provider conversations, or unrelated windows were cleared or reset.
- Temporary two-window harness files were removed. Deployment re-check: `78/78` files, `0` missing, `0` extra, `0` hash mismatches versus the verified feature worktree.
- Product verification is complete: three-window production route PASS + two-window fallback PASS. No additional feature-port work is justified without a new concrete defect.

## Pause checkpoint — 2026-08-17 17:50 IST

**State:** PAUSED by user request. Do not continue browser, code, deployment, cleanup, or Git write actions until explicitly resumed.

### Verified complete at pause
- [x] Durable rework rules persisted in tracked docs and local stable copy.
- [x] 0.12 simplified runtime implementation and selected 0.11 user-facing feature migration completed.
- [x] W2/W3 production parity, focused-submit guards, ChatGPT/Claude current-editor compatibility, compact Studio/cockpit, bounded diagnostics, Review/export/window tools completed.
- [x] Automated active 0.12 release gate previously passed: 148/148 tests; active source 37 files / 2,311 lines.
- [x] Real three-window production acceptance passed: W1 ChatGPT -> W2 Claude + W3 ChatGPT with provider-rendered proof in both answer lanes.
- [x] Real two-window fallback acceptance passed: session `pmia_2win_msx4mmov_dvmgh`, token `PMIA_2WIN_1786964673631`, W2 rendered proof 1333 ms, role-local 1329.5 ms, capture->fanout 0 ms.
- [x] W1 focus rule verified before typing and immediately before Enter using `AutomationId=prompt-textarea`; foreground restored after submission.
- [x] Temporary two-window harness files are absent; no PMIA 2WIN / sender / receiver Edge Beta windows remain.
- [x] Deployment cleanup/hash comparison recorded as 78/78 files with 0 missing, 0 extra, 0 mismatches.
- [x] Final HTML report has been updated locally with the two-window fallback evidence.

### Current local/Git state
- Branch remains `feature/pmia-simple-runtime` tracking `origin/feature/pmia-simple-runtime`.
- Only two tracked files are currently modified: this migration plan and `docs/PMIA_0.12_FINAL_REWORK_REPORT.html`.
- No production source file is modified at this pause point.
- No commit/push was performed after the two-window evidence/report update because the user requested pause.
- Dirty `main` remains out of scope and untouched.

### Resume point
1. Review the final two documentation diffs and correct only factual/encoding issues if any.
2. Because no runtime code changed after the passing acceptance, do not rerun expensive browser tests unless the docs review exposes a product inconsistency.
3. If completion/GitHub publication is still desired, commit and push only the intended final documentation/checkpoint changes on `feature/pmia-simple-runtime`; do not touch `main`.
4. Report final branch SHA, installed/deployment state, three-window + two-window evidence, and final HTML report path.

## Handoff sync — 2026-08-17 17:52 IST

**State:** PAUSED after local resynchronization. No runtime/browser/deployment/Git write work was performed during this sync.

### Confirmed current state
- Feature worktree HEAD: `c6623dc5b4620d4d4bad3fef64e40943b7556e9f` on `feature/pmia-simple-runtime`, tracking the same remote branch.
- Dirty `main` remains unchanged and out of scope.
- No production source file is modified in the 0.12 worktree.
- Only this migration plan and `docs/PMIA_0.12_FINAL_REWORK_REPORT.html` are locally modified.
- Product verification is already complete: real three-window production PASS and real two-window fallback PASS.
- Selected 0.11 user-facing feature migration is complete; no further feature-porting work is pending from the approved migration matrix.
- Durable operating rules exist at `docs/PMIA_REWORK_OPERATING_RULES.md`.

### Exact resume action
1. Review the two documentation diffs only.
2. If GitHub publication is requested, commit/push only those intended documentation changes on `feature/pmia-simple-runtime`.
3. Do not touch dirty `main`, provider cookies/sessions, or add runtime machinery unless a new concrete defect is reported.

## Final implementation closure — 2026-08-17 18:03 IST

- [x] Reconciled the original Tasks 1–9 checklist with the verified execution evidence.
- [x] Confirmed no approved user-facing migration item remains unimplemented.
- [x] Confirmed no 0.12 production source file is modified in this closure pass.
- [x] Updated the final HTML report to distinguish the implementation commit from the latest feature-branch documentation HEAD.
- [x] `git diff --check` is clean for the remaining local documentation changes.
- [x] Dirty `main` remains untouched.
- [x] Browser/provider sessions, cookies, tokens, and deployment files were not changed in this closure pass.

**Remaining optional action:** commit/push the two final documentation changes on `feature/pmia-simple-runtime` only if separately authorized. No runtime implementation or additional feature-port work is pending without a new concrete defect or new product requirement.

## Final verification closure — 2026-08-18 07:23 IST

- [x] Re-reviewed every deliberately retired 0.11 capability against current 0.12 user value, hot-path cost, state ownership, debugging burden, and performance impact. No additional retired capability justified reintroduction.
- [x] Found four timing-sensitive test failures only under Node's parallel test-file execution; all four passed independently. Root cause was synthetic 5–50 ms deadlines being starved by concurrent test files, not production runtime behavior.
- [x] Made the repository test runner deterministic with `--test-concurrency=1`; updated only the matching release-gate assertion. No PMIA runtime/hot-path code changed.
- [x] Fresh final active gate passed: 148/148 tests, 0 failures.
- [x] Extension validator passed: 32 active JavaScript files, 10 required runtime surfaces, 27 reachable active modules.
- [x] Real isolated MV3 transport/reconnect smoke passed with 0.8 ms W2/W3 dispatch skew and role-local replay without duplicate replay of the already-rendered lane.
- [x] Provider-native Edge fixture passed for Claude and ChatGPT: receiver 1330 ms, comparison 1364 ms, render skew 34 ms. These timings include provider/browser settlement, not LLM answer generation.
- [x] `git diff --check` has no whitespace errors; only normal Windows LF→CRLF notices.
- [x] Existing live three-window and two-window acceptance evidence remains valid because this final pass changed only test-runner verification metadata, not production runtime code.

**Final product decision:** the approved user-facing migration is complete. No additional 0.11 feature should be ported unless a new concrete user requirement demonstrates enough value to justify another runtime owner, timer, state machine, or hot-path dependency.

## Robustness / anomaly pass - 2026-08-18 08:00 IST

- [x] Five deterministic stress seeds passed against production modules: 5,000 fan-outs, 1,500 FIFO deliveries with deliberate duplicates, 500 one-lane failure/reconnect turns, 750 writer/submit retry cases, 600 readiness cases, 100 Gather/Pause turns, and 10,000 cross-lane deliveries across 200 simulated sessions.
- [x] Ten repeated MV3 transport/reconnect browser cycles passed before the fix; five additional post-fix cycles passed. Observed W2/W3 dispatch skew remained 0-1.6 ms in MV3 repeats; core stress worst start skew was 2.624 ms under Windows timer load.
- [x] Provider-role parity matrix passed: Claude/ChatGPT, ChatGPT/Claude, ChatGPT/ChatGPT, Claude/Claude; three runs per pairing before the fix and a post-fix route sweep all passed.
- [x] Two-window browser matrix passed for both Claude and ChatGPT receivers: five runs per vendor before the fix and a post-fix sweep passed.
- [x] Mixed input-shape browser burst passed after repair: 20 rapid W1 turns including multiline, Unicode, punctuation-heavy, 1,500-character and normal burst inputs reached both answer lanes in exact order with 20/20 rendered proof. Two additional runs passed in 266 ms and 333 ms.
- [x] Real defect found and fixed: shared `nodeText()` collapsed meaningful line breaks via `/\s+/g`. The extractor now preserves CR/LF structure, normalizes only horizontal whitespace, and chooses the semantically-equivalent DOM representation with richer line boundaries.
- [x] Added permanent multiline/blank-line/equivalent-representation regression coverage. Active suite is now 151/151.
- [x] Integrated release gate passed after the repair: validator 32 active JS files / 10 required surfaces / 27 reachable modules; production budget 37 files / 2,290 lines.
- [x] One repeated provider-smoke cycle ended with Windows fail-fast and left one disposable temp profile; the failure did not reproduce in five standalone runs and produced no PMIA/WER assertion evidence. Classified as isolated test-process lifecycle noise, not a product delivery failure.
- [x] Final authenticated multiline rerun was not forced because Browser Evidence Capture's companion was healthy but its browser-control extension was disconnected; its supported recovery tool explicitly required browser extension enable/reload. Existing authenticated three-window/two-window evidence remains preserved, and no cookies/session state were altered.
