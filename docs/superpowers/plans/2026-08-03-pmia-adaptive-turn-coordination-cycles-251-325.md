# PMIA Adaptive Turn Coordination Cycles 251Ã¢â‚¬â€œ325 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver final-only ChatGPT admission, lossless pause/accumulate/resume, and evidence-gated interrupted-answer carryover while reducing latency without weakening proof, privacy, or recovery.

**Architecture:** Keep the MV3 service worker, sender outbox, DeliveryLedger, contiguous sequence gate, BatchPlanner, receiver batch runtime, and rendered-turn proof as the only authorities. Add one pure turn-coordination policy/state owner that classifies authoritative turn relationships and supplies prompt mode metadata; receiver staging and interruption remain transactions of the existing planner rather than a second queue.

**Tech Stack:** Manifest V3 JavaScript modules, Chrome storage/session APIs, DOM MutationObserver-based provider adapters, Node `node:test`, AutoHotkey v2 launcher, isolated Edge smoke.

## Global Constraints

- No final transcript may be dropped, evicted, replaced by text similarity, or acknowledged before durable ownership.
- ChatGPT provider submission may start only from an authoritative finalized DOM turn; weak stable-tail fallback is disabled.
- Claude voice protocol finals remain authoritative; DOM fallback remains provider-specific and conservative.
- Ordinary later questions accumulate without stopping Window 2; automatic stop requires explicit supersession/continuation evidence.
- Pause means provider submission is blocked while durable admission and Window 2 draft mirroring continue.
- Default resume automatically submits the complete accumulated batch exactly once; Resume Without Send remains available.
- No automatic foreground activation, tab focus, broad window cleanup, external API, or new persistent transcript store.
- Question, answer, resume, JD, and combined prompt text remain session-scoped; support exports stay metadata-only.
- Event-driven observers are primary; timers are bounded watchdogs because hidden pages can throttle timers.
- Every production behavior begins with a failing test, then minimal implementation, focused green gate, and module checkpoint update.

---
## Research and owning-boundary findings

- Chrome extension service workers are ephemeral; coordinator state required after suspension must be committed through the existing runtime store, not held only in service-worker globals.
- `chrome.storage.session` is appropriate for sensitive in-session state and is cleared on extension reload/browser restart; the durable DeliveryLedger remains the recovery authority.
- MutationObserver/provider lifecycle signals must drive finalization and interruption. Hidden-page timers are only deadlines/watchdogs.
- Current ChatGPT premature submission risk is `stable_tail_fallback` after 300 ms. `rendered_user_turn` and `assistant_successor` are stronger DOM boundaries.
- Current pause already persists finals in the service worker but suppresses receiver delivery, so Window 2 cannot mirror the accumulated combined prompt.
- Current `interrupt_latest` discards the active-answer context and sends only the latest waiting final. The new carryover operation must preserve active plus waiting member identities.

## File and interface map

**Create**
- `runtime/extension/shared/turn-coordination-policy.js`: classify final authority, turn relation, pause/resume mode, and automatic-interrupt eligibility.
- `runtime/extension/shared/turn-coordination-prompt.js`: compose paused-draft and interrupted-carryover prompt variants without changing member identity.
- `runtime/extension/shared/turn-coordination-state.js`: normalize/export restart-safe metadata-only coordination state.
- `runtime/extension/dashboard/turn-coordination-model.js`: derive user-facing state, reason, counts, latency and safe actions.
- `runtime/extension/tests/pmia-0.12-turn-coordination-251-325.test.js`: focused cross-module contracts.

**Modify**
- `content/senders/provider-sender.js`, `content/senders/dom-turn-tracker.js`, `content/entry.js`
- `shared/batch-planner.js`, `content/receiver-batch-runtime.js`, `content/receiver-answer-orchestrator.js`
- `shared/runtime-pilot-state.js`, `shared/runtime-pilot-controller.js`, state schema/migrations/store
- dashboard model/render/controller, command registry/catalog/protocol, HTML/CSS
- isolated release smoke, validator, release docs and cycle plan.

---
### Task 1 Ã¢â‚¬â€ Cycles 251Ã¢â‚¬â€œ255: Authoritative ChatGPT final admission

**Files:** Modify `content/senders/provider-sender.js`, `content/senders/dom-turn-tracker.js`, `content/entry.js`; test `tests/chatgpt-turn-tracker.test.js`, `tests/provider-sender.test.js`, focused phase suite.

**Interfaces:** Produce `finalAuthority(boundary, provider) -> { authoritative, reason }`; ChatGPT accepts `rendered_user_turn`, `assistant_successor`, and explicit copied final, never `stable_tail_fallback`.

- [x] Write failing tests proving a stable ChatGPT tail and interim preview cannot emit or submit a final, while a stable-ID rendered user turn can.
- [x] Run focused tests and confirm RED on current 300 ms fallback behavior.
- [x] Add provider-specific `allowPreview` and final-authority policy; keep Claude protocol final behavior unchanged.
- [x] Run focused sender/runtime tests; verify no ordinary receiver stop call and no lost explicit copied final.
- [x] Update this plan checkpoint and commit `feat: require authoritative ChatGPT final turns`.

### Task 2 Ã¢â‚¬â€ Cycles 256Ã¢â‚¬â€œ260: Pause accumulation state machine

**Files:** Create `shared/turn-coordination-state.js`; modify runtime state/schema/migrations and `runtime-pilot-controller.js`; test focused phase suite and state migration tests.

**Interfaces:** Produce `normalizeTurnCoordination(value)` with `mode`, `pausedAt`, `resumeAction`, `stagedMemberIds`, `activeCarryover`, `lastReason`, `revision`.

- [x] Write failing tests for pause persistence, restart restore, bounded metadata, and no raw transcript text.
- [x] Verify RED because current pause is only a mode Boolean.
- [x] Implement schema-v5 migration and state transitions through the existing per-session mutation lane.
- [x] Verify pause/reload/resume preserves ledger ownership and exact member IDs.
- [x] Update checkpoint and commit `feat: persist turn coordination state`.

### Task 3 Ã¢â‚¬â€ Cycles 261Ã¢â‚¬â€œ265: Provider-free paused staging

**Files:** Modify `runtime-pilot-controller.js`, `background.js`, `content/entry.js`, `content/receiver-batch-runtime.js`; test controller, runtime and receiver batch suites.

**Interfaces:** Add internal delivery metadata `coordinationMode: 'paused_stage'`; receiver accepts it only from the managed service-worker route, forces queue-only, and mirrors the next prompt without provider submission.

- [x] Write failing tests that a paused final is durable, delivered to receiver staging, visible in the draft, and never calls `submitBatch`.
- [x] Confirm RED because paused finals currently remain only in the service-worker ledger.
- [x] Implement staged delivery after persistence; duplicate reconcile remains idempotent.
- [x] Verify sender/receiver disconnect, missing receiver and storage failure keep unresolved ownership.
- [x] Update checkpoint and commit `feat: mirror paused finals without submission`.

### Task 4 Ã¢â‚¬â€ Cycles 266Ã¢â‚¬â€œ270: Paused and combined prompt variants

**Files:** Create `shared/turn-coordination-prompt.js`; modify `shared/batch-planner.js` and receiver draft mirroring; test batch planner and prompt contracts.

**Interfaces:** Produce `composeCoordinatedPrompt({ entries, mode })`; modes `ordinary`, `paused`, `carryover`; returned member IDs and member fingerprint remain entry-derived and exact.

- [x] Write failing tests for one/many paused questions, latest-focus copy, exact order, Unicode, size partitioning and no identity change.
- [x] Confirm RED because current prompts have no pause/carryover semantics.
- [x] Implement prompt modes as presentation metadata on planner batches, not new queue entries.
- [x] Verify rendered-proof fingerprints use the final submitted prompt, while the paused draft may carry a non-submitted banner.
- [x] Update checkpoint and commit `feat: add coordinated batch prompts`.

### Task 5 Ã¢â‚¬â€ Cycles 271Ã¢â‚¬â€œ275: Atomic resume and latency budgets

**Files:** Modify receiver runtime, controller, dashboard protocol; create coordination latency metrics in state/model; test pause/resume races.

**Interfaces:** `resume_catch_up` clears pause staging and submits once; `resume_without_send` clears transport pause but retains hold/draft; operation returns exact staged/submitted member IDs and latency.

- [x] Write failing tests for repeated resume, resume during persistence, resume during generation, and service-worker replay.
- [x] Confirm RED on current command split and missing staged-draft submission contract.
- [x] Implement one idempotent resume transaction ordered by the session mutation coordinator.
- [ ] Record observeÃ¢â€ â€™persist, persistÃ¢â€ â€™stage, resumeÃ¢â€ â€™submit and stopÃ¢â€ â€™resubmit latency without transcript text.
- [ ] Update checkpoint and commit `feat: resume paused batches atomically`.

---
## Phase B Ã¢â‚¬â€ Cycles 276Ã¢â‚¬â€œ300: bug-fixing and race hardening

### Task 6 Ã¢â‚¬â€ Cycles 276Ã¢â‚¬â€œ280: Turn relation and supersession policy

**Files:** Create `shared/turn-coordination-policy.js`; test same-turn revision, continuation, independent question and stale replay cases.

**Interfaces:** `classifyTurnRelation({ active, incoming, now, policy }) -> { relation, confidence, autoInterrupt, reasons }`; only `supersedes` or `continues_active` may auto-interrupt.

- [x] Write failing table tests using stable turn IDs, text extension, boundary strength, sequence and time window.
- [x] Verify RED because no relation classifier exists.
- [x] Implement deterministic evidence scoring with no semantic model or network dependency.
- [x] Verify independent later questions return `accumulate`, and ambiguous evidence fails closed.
- [x] Update checkpoint and commit `feat: classify interviewer turn relationships`.

### Task 7 Ã¢â‚¬â€ Cycles 281Ã¢â‚¬â€œ285: Active-answer carryover transaction

**Files:** Modify `shared/batch-planner.js`, `content/receiver-batch-runtime.js`, `content/receiver-answer-orchestrator.js`; test planner and receiver runtime.

**Interfaces:** Add `planner.createCarryover(now, metadata)` that freezes active entries plus eligible next entries in sequence order and returns old/new batch identities; no member is removed from known ownership.

- [x] Write failing tests proving active + waiting members are retained, ordinary next entries remain when excluded, and failed stop restores original state.
- [x] Confirm RED because `interruptLatest` currently sends only the newest waiting final.
- [x] Implement prepare/stop/commit rollback semantics around the existing BatchTransaction.
- [x] Settle the old answer as `cancelled: superseded_turn` exactly once before observing the new batch.
- [x] Update checkpoint and commit `feat: carry interrupted answers into combined batch`.

### Task 8 Ã¢â‚¬â€ Cycles 286Ã¢â‚¬â€œ290: Automatic evidence-gated interruption

**Files:** Modify `content/entry.js`, receiver runtime and controller; test end-to-end content runtime commands.

**Interfaces:** Incoming authoritative final calls the relation classifier against the active batch; automatic carryover requires policy enabled, active generation, no manual draft conflict, and exact relation evidence.

- [x] Write failing tests for same-turn continuation auto-stop, independent question no-stop, stop failure, stop timeout and duplicate incoming final.
- [x] Verify RED while current runtime only supports token-confirmed operator interruption.
- [x] Implement automatic internal command with reason-coded telemetry and no dashboard confirmation token.
- [x] Preserve manual `interrupt_latest` as an explicit latest-only operator action.
- [x] Update checkpoint and commit `feat: auto-interrupt superseded interviewer turns`.

### Task 9 Ã¢â‚¬â€ Cycles 291Ã¢â‚¬â€œ295: Restart, hidden-page and deadline repair

**Files:** Modify runtime store/state recovery, receiver page lifecycle coordinator and alarm schedule; test suspension/reload/hidden tab paths.

**Interfaces:** Persist only coordination metadata and rely on ledger/planner export for members; recovery reconstructs staged/carryover state and schedules the nearest semantic deadline.

- [x] Write failing tests for service-worker termination after persist, receiver reload while paused, hidden stop watchdog, and stale alarm generation.
- [x] Confirm RED where coordination state is not yet recoverable.
- [x] Rehydrate through existing schema/store and use MutationObserver/lifecycle pulses before timer watchdogs.
- [x] Verify no foreground activation, no repeated submit, and no global service-worker memory authority.
- [x] Update checkpoint and commit `fix: recover coordinated turns across lifecycle changes`.

### Task 10 Ã¢â‚¬â€ Cycles 296Ã¢â‚¬â€œ300: Proof, storage, draft and command races

**Files:** Modify proof reconciliation, composer arbiter integration, command journal and storage accounting; test conflict/replay/compaction cases.

**Interfaces:** A carryover batch has exact member-set proof and its own prompt fingerprint; paused drafts remain PMIA-owned but manual edits trigger the existing conflict workspace.

- [x] Write failing tests for partial proof, old-batch late terminal event, manual edit during pause, compact/reload, repeated command and stale confirmation.
- [x] Confirm RED on each reproduced regression before implementation.
- [x] Fix the owning boundary; do not add compatibility whitelists or text-only duplicate suppression.
- [x] Run all coordination, batch, ledger, answer and state tests after each fix block.
- [x] Update checkpoint and commit `fix: harden coordinated turn races`.

---

## Phase C Ã¢â‚¬â€ Cycles 301Ã¢â‚¬â€œ325: inferred user-facing features

### Task 11 Ã¢â‚¬â€ Cycles 301Ã¢â‚¬â€œ305: Turn Coordination cockpit

**Files:** Create `dashboard/turn-coordination-model.js`; modify dashboard HTML/CSS/render and Navigator Now rail.

**Interfaces:** Show mode, staged count, active/carryover count, latest safe action, reason, auto-send state and latency without transcript text in telemetry cards.

- [x] Write failing model/render tests for active, paused, carryover, blocked and recovered states.
- [x] Implement one compact live card and responsive/print behavior; no duplicate controls.
- [x] Add Pause, Resume and Resume Without Send actions through the command registry.
- [x] Verify keyboard focus, ARIA status and 320/280 px layouts.
- [x] Update checkpoint and commit `feat: add turn coordination cockpit`.

### Task 12 Ã¢â‚¬â€ Cycles 306Ã¢â‚¬â€œ310: Coordination policy presets

**Files:** Modify production controls/state, command catalog and cockpit; test policy application and preview confirmation.

**Interfaces:** Presets `conservative`, `adaptive`, `manual`; default `adaptive` disables weak finalization and permits only evidence-gated same-turn carryover.

- [x] Write failing tests for preset impact, invalid policy, persistence and containment interaction.
- [x] Implement policy preview before changing automatic interruption behavior.
- [x] Keep provider final authority non-overridable; presets may only become more conservative.
- [x] Verify profile changes cannot unpause, submit or interrupt by themselves.
- [x] Update checkpoint and commit `feat: add coordination policy presets`.

### Task 13 Ã¢â‚¬â€ Cycles 311Ã¢â‚¬â€œ315: Pause draft banner and resume preview

**Files:** Modify composer arbiter, receiver batch preview, cockpit and dashboard dialog.

**Interfaces:** Paused composer shows a clear non-submitted banner, protected-question count, latest-focus statement, and whether resume sends or retains the draft.

- [x] Write failing tests for banner replacement, no duplicate banner, manual conflict, one-question and partitioned drafts.
- [x] Implement banner as prompt presentation, never as an extra ledger member.
- [x] Add a metadata-only resume preview listing counts, IDs and expected partitions.
- [x] Verify resume replaces the UI-only banner with the final combined-turn instruction before proof.
- [x] Update checkpoint and commit `feat: preview paused resume behavior` (`80122f0`, plus dashboard preview follow-up `ded5fe4`).

### Task 14 Ã¢â‚¬â€ Cycles 316Ã¢â‚¬â€œ320: Interruption explanation and recovery controls

**Files:** Extend interruption recovery card, command history, Navigator events and support-bundle metadata.

**Interfaces:** Expose reason codes, relation evidence, old/new batch IDs, preserved count, stop latency and recovery action; never expose question or answer text.

- [x] Write failing tests for successful carryover, blocked ambiguity, stop failure, late old-answer event and restart recovery.
- [x] Implement explanation model and safe Retry Carryover / Keep Accumulating actions.
- [ ] Record a bookmarkable evidence event for review without transcript content.
- [ ] Verify support-bundle redaction and command replay idempotency.
- [ ] Update checkpoint and commit `feat: explain turn interruptions and recovery`.

### Task 15 Ã¢â‚¬â€ Cycles 321Ã¢â‚¬â€œ325: Efficiency scorecard and release evidence

**Files:** Extend performance budget/scorecard, isolated smoke, validator, release docs and handoff manifest.

**Interfaces:** Report p50/p95 final admission, pause-stage, resume-submit and stop-resubmit latency; target processing capacity is measured from runtime events, not claimed from cycle-writing speed.

- [ ] Write failing tests for bounded metrics, no text leakage, stale sample handling and scorecard thresholds.
- [ ] Add isolated smoke scenarios: ChatGPT final-only; pause two finals and auto-resume; same-turn continuation carryover; ordinary new-question accumulation; restart recovery.
- [ ] Run focused suites, full Node suite, extension validator, three AutoHotkey checks, fresh isolated Edge smoke and exact cleanup.
- [ ] Update release/handoff evidence from exact HEAD; remove only assistant-created task-temp files.
- [ ] Mark every task checkpoint complete and commit `feat: complete adaptive turn coordination`.


---

## Current status at requested pause ? 2026-08-03

**Feature implementation HEAD:** `ded5fe4` on `improvement/pmia-0.7.0`. This status update intentionally pauses implementation; it does not claim Tasks 14?15 are complete.

### Original requirement reconciliation

**Completed**
- ChatGPT now admits only authoritative finalized DOM turns; weak stable-tail submission is disabled while Claude protocol finals remain unchanged.
- Pause blocks Window 2 provider submission but keeps sender observation, durable admission, exact sequence ownership, and Window 2 draft mirroring active.
- One or many paused questions remain one ordered BatchPlanner-owned draft with exact member IDs, partition safety, a clear non-submitted banner, and explicit latest-question priority.
- Default Resume submits the accumulated batch exactly once; Resume Without Send retains the protected draft; Send Held Now is available without silently losing pause state.
- Same-turn authoritative continuations can automatically stop the active answer, cancel the superseded answer once, and resubmit active plus continuation members. Independent or ambiguous later questions accumulate without automatic Stop.
- Stop failure, timeout, reload, hidden-page recovery, duplicate commands, late old-answer terminals, draft conflicts, storage pressure, session end, provider-route change, and release handoff retain safe ownership.
- The Turn Coordination cockpit shows live, paused, carryover, blocked, and recovered states; policy presets are `adaptive`, `conservative`, and `manual` with preview confirmation.
- Paused banner replacement and metadata-only resume preview are complete and committed. Focused Task 13 gate passed 7/7; extension validation passed with 508 JavaScript files, 18 required runtime surfaces, and 285 reachable production modules.

**Still pending from the original requirement**
1. Finish metadata-only latency instrumentation for `observe?persist`, `persist?stage`, `resume?submit`, and `stop?resubmit`; add bounded/stale-sample scorecard thresholds. This is the remaining Task 5 work and closes with Task 15.
2. Finish Task 14 evidence export: add a bookmarkable interruption evidence locator and coordination summary to the safe support bundle, then prove coordination-specific redaction and duplicate Retry/Keep command replay. Recovery behavior itself is already implemented.
3. Complete Task 15 release evidence: five isolated scenarios (authoritative ChatGPT final; pause two finals and resume; same-turn carryover; independent-question accumulation; restart recovery).
4. Run the exact final gates from committed HEAD: focused suites, full Node suite, extension validator, all three AutoHotkey checks, fresh isolated Edge smoke, and exact process/profile cleanup.
5. Update release/handoff evidence, remove only assistant-created task-temp files, mark all remaining checkpoints complete, and create the final coordination completion commit.

### Paused worktree state

- No tracked production change is intentionally left pending at this pause point.
- Untracked `runtime/extension/tests/adaptive-turn-evidence.test.js` is a started RED test for Task 14 evidence export; production support-bundle implementation has not been added.
- Untracked `.pmia-task-temp/` contains assistant-created task files and must be removed only during final verified cleanup.
- Normal Edge, the original checkout, and unrelated files remain out of scope and must not be changed.

---

## Completion test

The phase is complete only when the exact committed HEAD proves all of the following: no ChatGPT weak-tail submission; paused finals remain durable and visible as a combined Window 2 draft; default resume submits once; Resume Without Send retains the draft; same-turn continuation stops and carries the previous active question forward; independent questions do not auto-stop; restart/reload preserves ownership; support data is text-free; full validation and fresh isolated-browser evidence exit zero; original worktree and normal browser remain untouched.


## Checkpoint Ã¢â‚¬â€ Cycles 256Ã¢â‚¬â€œ300 core coordination and hardening

- Schema v5 persists metadata-only turn coordination through the existing Pilot state envelope.
- Pause keeps sender observation and durable admission active while receiver submission is held.
- Paused prompts use the existing BatchPlanner and retain exact ordered member identity.
- Evidence-gated same-turn revisions stop once, cancel the old answer as `superseded_turn`, and carry only eligible members.
- Receiver reload restores pause before ledger replay; hidden Stop timeout and concurrent Resume preserve ownership.
- Focused gates: 131/131 coordination tests, 23/23 lifecycle tests, and 48/48 proof/race/storage/end-session tests.
- Remaining in Task 5: metadata-only coordination latency samples and thresholds, completed with Task 15 release evidence.
