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
- [x] Record observe→persist, persist→stage, resume→submit and stop→resubmit latency without transcript text.
- [ ] Update checkpoint and commit the completed latency work with Task 15.

**Task 5 latency checkpoint:** The existing Pilot state now owns a bounded metadata-only sample store. The four stage samples are emitted only after durable final commit, first receiver staging, actual Resume submission start, and actual Stop-to-replacement submission start. Stage/correlation replay is idempotent and raw question, answer and prompt fields are not accepted.

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
- [x] Record a bookmarkable evidence event for review without transcript content.
- [x] Verify support-bundle redaction and command replay idempotency.
- [x] Update checkpoint and commit `feat: explain turn interruptions and recovery` (`f41d5db`).

**Task 14 checkpoint:** `turn-coordination-evidence.js` derives one bounded metadata-only evidence object from the existing coordination state and matching timeline event. The safe support bundle now includes chain/batch identities, reason codes, preserved count, stop latency and recommended recovery without question or answer text. Duplicate `retry_carryover` and `keep_accumulating` requests replay the stored result and reach the receiver exactly once. Focused integration gate: **27/27 passed**, including the existing support-bundle privacy suite.

### Task 15 Ã¢â‚¬â€ Cycles 321Ã¢â‚¬â€œ325: Efficiency scorecard and release evidence

**Files:** Extend performance budget/scorecard, isolated smoke, validator, release docs and handoff manifest.

**Interfaces:** Report p50/p95 final admission, pause-stage, resume-submit and stop-resubmit latency; target processing capacity is measured from runtime events, not claimed from cycle-writing speed.

- [x] Write failing tests for bounded metrics, no text leakage, stale sample handling and scorecard thresholds.
- [x] Add isolated smoke scenarios: ChatGPT final-only; pause two finals and auto-resume; same-turn continuation carryover; ordinary new-question accumulation; restart recovery.
- [ ] Run focused suites, full Node suite, extension validator, three AutoHotkey checks, fresh isolated Edge smoke and exact cleanup.
- [ ] Update release/handoff evidence from exact HEAD; remove only assistant-created task-temp files.

**Task 15 automated-gate checkpoint:** Focused release contracts passed **69/69** before the harness correction. The exact committed `7b0e4bb` repository gate passed **1,306/1,306 tests**, extension validation checked **512 JavaScript files**, **18 required runtime surfaces**, and **287 reachable production modules**, and all three AutoHotkey validators passed with exit **0**. Two fresh isolated Edge attempts produced actionable evidence; the latest exposed durable-admission head-of-line blocking while preserving Q2 in the ledger and sender outbox. Task 15 remains open until the acceptance-lane repair and a fully green fresh smoke.
- [x] Commit the completed coordination feature block (`8257e04`) and MV3 smoke-boundary correction (`7b0e4bb`).
- [x] Commit the durable-admission repair after focused verification (`2cbec6f`).
- [ ] Complete exact-HEAD isolated browser evidence, release integration, cleanup, and final atlas update.


---

## Live execution and takeover status — 2026-08-03

**Integration branch:** `improvement/pmia-0.7.0`
**Lane-merge checkpoint:** `4bf4851` (Admission, Release Evidence, and Main Integration merged)
**Target after exact verification:** `main`
**Detailed takeover file:** `docs/superpowers/handoffs/2026-08-03-pmia-adaptive-turn-takeover.md`

### User requirement and inferred system requirement

The user requires every PMIA implementation from every registered worktree to be incorporated, all original Adaptive Turn requirements completed, and the work continued without restarting or dropping completed scope. The system requirement is lossless final ownership: durable admission must not wait for receiver submission, provider answer observation, dashboard commands, self-tests, reconciliation, or other slow operational work.

### Worktree reconciliation

The five pre-parallel committed PMIA worktree heads are contained in the integration history. The parallel PMIA 0.11 completion head was explicitly reconciled and merged at `86f9ae0`. There are now eight registered worktrees because Admission, Release Evidence, and Main Integration verification lanes were added. Uncommitted historical work was also inspected: the shorter PMIA 0.11 Adaptive Turn spec is superseded by the fuller current spec, and the old `Session_Review_Studio.ahk` implementation is superseded by the committed `Session_Tracker_End_Session.ahk` flow with UTC pairing, validation, dry-run, and tracker safeguards. Those historical worktrees remain untouched and are not backward-merged.

### Completed since the prior checkpoint

- Task 14 interruption/recovery evidence, safe support projection, and replay-idempotent Retry/Keep actions committed at `f41d5db`.
- Worktree reconciliation committed at `dc3bc8f`; PMIA 0.11 ancestry merged at `86f9ae0`.
- Task 15 metrics, throughput proof, paused staging correction, and five-scenario isolated smoke committed at `8257e04`.
- MV3 smoke helper corrected to run browser module scenarios in the packaged dashboard page at `7b0e4bb`.
- Exact `7b0e4bb` automated gate passed 1,306/1,306 tests, 512 JavaScript files, 18 required runtime surfaces, 287 reachable production modules, and all three AutoHotkey checks.

### Fresh browser evidence

Run 1 at `8257e04` failed before provider windows because dynamic `import()` was attempted in `ServiceWorkerGlobalScope`; cleanup passed and `7b0e4bb` fixed the harness boundary.

Run 2 at `7b0e4bb` passed exact extension identity, command reachability, module carryover, independent accumulation, restart recovery, managed lifecycle, and active self-test. It failed while waiting for Q3 durable admission. Evidence: `C:\Users\Sundar\Documents\PMIA-Evidence-Archive\adaptive-turn-7b0e4bb-20260803\pmia-isolated-release-evidence.json`.

Q2 was safely persisted and the sender outbox retained one replaying item, so no data was lost. Persistence took about 13.2 seconds because controller `beforeForward` shares the general per-session mutation coordinator with slow operational work. The sender correctly refused to advance to Q3 until durable acknowledgement.

### Admission repair checkpoint

The root cause was confirmed from fresh browser evidence and reproduced in a focused test: `beforeForward` shared the general operational mutation lane, so an active self-test could delay durable final acknowledgement by about 13.2 seconds.

The repair is committed at `2cbec6f` on `fix/pmia-admission-lane`:

- non-boot final admission uses a dedicated per-session acceptance coordinator;
- the urgent durable write bypasses derived-policy refresh, checkpoint derivation, storage accounting, dashboard broadcast, and receiver work;
- store writes and clear operations are serialized through one write lane;
- post-admission maintenance returns to the existing coalesced operational lane;
- exact-session prepare/end/removal are fenced through the acceptance lane;
- a fresh registry ownership check rejects finals after session end instead of recreating state;
- failed persistence resets and reloads the prior committed state before sender retry.

The focused owning matrix passed **91/91** tests across controller, store recovery, background durable acceptance, end-session guards, state journal/integrity/quarantine, and Adaptive Turn coordination, carryover, recovery, safety, and performance.


### Parallel lane integration checkpoint

- Admission lane commits `2cbec6f` and `685c859` merged at `8d32f66`.
- Release Evidence commit `92e1d99` merged at `613b2ea`. Its focused release matrix passed **58/58**.
- Main Integration commit `da1a5ad` merged at `4bf4851`. Its focused disposition/readiness matrix passed **5/5**.
- The v2 worktree manifest accounts for dirty historical work only through exact branch, HEAD, tracked-diff, and untracked-content hashes plus verified integrated replacement commits/files.
- The real pre-merge manifest correctly recognized both preserved historical worktrees while blocking on the still-unmerged or dirty active lanes.
- Integration is clean.
- Complete automated gate on exact commit `31a8c0f` passed **1,315/1,315 tests**, **513 JavaScript files**, **18 required runtime surfaces**, **287 reachable production modules**, and all three AutoHotkey validations.
- Fresh isolated browser evidence remains pending.

### Remaining in scope

1. Run the complete repository gate on the exact combined integration HEAD.
2. Run fresh isolated Edge evidence and require all five Adaptive Turn scenarios, three exact rendered proofs, empty outbox, clear sequence state, 12/12 transport drill, all UI layouts, and exact cleanup.
3. Generate release, handoff, and worktree-integration manifests; verify original checkout, normal Edge, tags, push state, and preserved historical worktrees.
4. Remove only assistant-created task-temp files after their evidence is retained, then regenerate the readiness manifest.
5. Merge the exact verified result into `main`, rerun the repository gate if the commit context changes, then update the technical atlas once at the end.

### Parallel execution map

The remaining work is split into isolated branches/worktrees:

| Lane | Branch | Worktree | Owned scope |
|---|---|---|---|
| Admission | `fix/pmia-admission-lane` | `product-pm-interview-assistant-improvement` | Controller acceptance lane, store write serialization, concurrency tests, current plan/handoff updates. |
| Release evidence | `release/pmia-final-evidence` | `.worktrees/pmia-final-evidence` | Exact-HEAD release manifest, Adaptive Turn evidence requirements, browser-evidence binding. |
| Main integration | `test/pmia-main-integration` | `.worktrees/pmia-main-integration` | Registered-worktree ancestry proof, target-main cleanliness, no-push/tag/merge-state verification, cleanup manifest. |
| Integration | `improvement/pmia-0.7.0` | `.worktrees/pmia-final-integration` | Receives reviewed green commits only; runs combined gates and final browser verification. |

Merge order: Admission → Release evidence → Main integration. If branches touch the same file, do not auto-merge; review and reconcile manually in the integration worktree. The technical atlas remains deferred until the merged `main` result is verified.

### Synchronization rule

After every major block—parallel branch completion, integration merge, full gate, isolated browser, release integration, and atlas update—update this plan and the takeover handoff before proceeding. The documents must describe actual repository/evidence state, not intended future state.

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
