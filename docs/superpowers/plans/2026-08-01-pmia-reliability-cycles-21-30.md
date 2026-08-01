# PMIA Reliability Cycles 21–30 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ten reliability-first PMIA cycles, verify the runtime in automation and an isolated hidden browser profile, then update the technical systems atlas from the verified system.

**Architecture:** Extend the existing lossless ledger, active/next batch planner, direct role ports, Runtime Pilot state and provider-rendered proof. Add no parallel transport or persistent sensitive-data path.

**Tech Stack:** AutoHotkey v2, Manifest V3, JavaScript ES modules, Chrome extension APIs, Node test runner, standalone HTML/CSS/SVG/JavaScript.

## Global Constraints

- Work only in the existing linked worktree on `improvement/pmia-0.7.0`.
- Preserve all current features and every non-duplicate final.
- Keep provider-window work background-safe and focus-independent.
- Store new runtime state only in `chrome.storage.session` or page session memory.
- Write tests per cycle; execute no tests until Task 10 is source-complete.
- Do not push, merge, tag, publish or replace the installed extension.
- Update the HTML atlas only after final runtime verification.

---
### Task 1: Cycle 21 — Hidden Runtime Guard

**Files:**
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/adapters/chatgpt.js`
- Modify: `runtime/extension/content/runtime-telemetry.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/dashboard/index.html`, `dashboard.js`, `dashboard.css`
- Test: `runtime/extension/tests/runtime.test.js`, `adapters.test.js`, `runtime-telemetry.test.js`, `dashboard-usability.test.js`

**Produces:** `yieldToProvider()` returns wake-source metadata; receiver telemetry exposes visibility, wait reason and wake source.

- [ ] Add failing coverage for hidden rAF suspension, timer throttling, DOM-mutation wake, missing ChatGPT Send control, and safe scheduler telemetry.
- [ ] Implement mutation-first yielding and real-control readiness without changing provider focus.
- [ ] Add the Hidden Runtime Guard card and source-only audit for question-text leakage.
- [ ] Commit as `fix: keep hidden receiver submission progressing`.

### Task 2: Cycle 22 — Command Result Journal

**Files:**
- Create: `runtime/extension/shared/command-result-journal.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`, `runtime-pilot-controller.js`
- Modify: `runtime/extension/dashboard/index.html`, `dashboard.js`, `dashboard.css`
- Test: new `command-result-journal.test.js`; update Pilot controller/state/dashboard tests.

**Produces:** bounded `lookup(requestId)` and `record(requestId, command, result, durationMs)` APIs.

- [ ] Add coverage proving duplicate request IDs return the original result after reconnect.
- [ ] Replace ID-only command deduplication with the bounded journal.
- [ ] Render the latest five commands with outcome, duration and replay marker.
- [ ] Commit as `fix: replay exact dashboard command results`.
### Task 3: Cycle 23 — Transport Circuit Guard

**Files:**
- Create: `runtime/extension/shared/transport-circuit.js`
- Modify: `runtime/extension/shared/runtime-port-hub.js`, `runtime-pilot-state.js`
- Modify: `runtime/extension/background.js`
- Create: `runtime/extension/dashboard/transport-lane-model.js`
- Modify: dashboard markup, rendering and styles.
- Test: new `transport-circuit.test.js`, `transport-lane-model.test.js`; update port-hub, background protocol and usability tests.

**Produces:** `recordSuccess`, `recordFailure`, `canAttemptDirect`, `beginProbe`, and transport telemetry by role.

- [ ] Add coverage for opening after consecutive timeouts, immediate fallback, cooldown probing and successful closure.
- [ ] Integrate the circuit without bypassing the existing one-time-message fallback.
- [ ] Render Direct, Fallback, Open Circuit and Probing states with RTT.
- [ ] Commit as `perf: bypass unhealthy role ports immediately`.

### Task 4: Cycle 24 — Lossless Batch Partitioning

**Files:**
- Create: `runtime/extension/shared/batch-partitioner.js`
- Modify: `runtime/extension/shared/batch-planner.js`
- Modify: `runtime/extension/content/receiver-batch-runtime.js`
- Create: `runtime/extension/dashboard/batch-plan-model.js`
- Modify: dashboard markup/rendering/styles.
- Test: new partitioner/model tests; update batch-planner, receiver-runtime, lossless-burst and proof tests.

**Produces:** deterministic `partitionEntries(entries, limits)` and planner snapshot fields `next.partitionCount`, `next.firstPartitionCount`, and `next.remainingCount`.

- [ ] Add coverage for character/member budgets, single oversized questions, exact sequence, zero loss and proof membership.
- [ ] Freeze only the first safe partition and leave every remaining entry in the next queue.
- [ ] Show protected questions and planned sequential batches.
- [ ] Commit as `fix: partition oversized lossless batches safely`.
### Task 5: Cycle 25 — Draft Conflict Resolver

**Files:**
- Modify: `runtime/extension/content/composer-arbiter.js`, `receiver-batch-runtime.js`, `entry.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`, `runtime-pilot-state.js`, `runtime-pilot-controller.js`
- Create: `runtime/extension/dashboard/draft-conflict-model.js`
- Modify: dashboard markup/rendering/styles.
- Test: update arbiter, receiver-runtime, protocol and controller tests; add model/usability coverage.

**Produces:** explicit commands `resolve_draft_keep_manual`, `resolve_draft_restore_pmia`, and `resolve_draft_merge`; arbiter methods preserve, restore and merge without implicit overwrite.

- [ ] Add coverage for conflict detection, each resolution path, sequence preservation and no automatic manual overwrite.
- [ ] Implement recoverable conflict state and receiver commands.
- [ ] Add an actionable conflict panel to Runtime Pilot.
- [ ] Commit as `feat: resolve receiver draft conflicts explicitly`.

### Task 6: Cycle 26 — Delivery SLA Guard

**Files:**
- Create: `runtime/extension/shared/delivery-sla-policy.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`, `runtime-pilot-controller.js`
- Create: `runtime/extension/dashboard/delivery-sla-model.js`
- Modify: dashboard markup/rendering/styles and readiness diagnostics.
- Test: new policy/model tests; update Pilot controller/state/readiness tests.

**Produces:** deterministic escalation states `healthy`, `catch_up_due`, `check_due`, `repair_due`, `cooldown`, and `suppressed`.

- [ ] Add coverage for age thresholds, paused/critical suppression, cooldown and idempotent escalation.
- [ ] Evaluate the policy only inside the session mutation lane and record reason-coded actions.
- [ ] Show oldest age, target, phase and next action.
- [ ] Commit as `feat: escalate stalled lossless delivery safely`.
### Task 7: Cycle 27 — Durable Recovery Scheduling

**Files:**
- Create: `runtime/extension/shared/recovery-schedule.js`
- Modify: `runtime/extension/manifest.json`, `background.js`, `runtime-pilot-state.js`, `runtime-pilot-controller.js`
- Create: `runtime/extension/dashboard/recovery-schedule-model.js`
- Modify: dashboard markup/rendering/styles.
- Test: new schedule/model tests; update manifest, background, recovery and controller tests.

**Produces:** persisted recovery deadline records and stable alarm names derived from session ID; `onAlarm` resumes verification inside the session lane.

- [ ] Add coverage for schedule creation, alarm resume, stale-alarm rejection, cancellation and event-driven catch-up.
- [ ] Add `alarms` permission and replace recovery verification/timeout timers with durable schedules.
- [ ] Show next verification deadline and source.
- [ ] Commit as `fix: make recovery scheduling service-worker durable`.

### Task 8: Cycle 28 — Reload-Safe Sender Outbox

**Files:**
- Create: `runtime/extension/content/session-storage-adapter.js`
- Modify: `runtime/extension/content/sender-outbox.js`, `entry.js`
- Modify: `runtime/extension/background.js`, `manifest.json`
- Modify: outbox dashboard model/rendering.
- Test: new storage-adapter tests; update sender-outbox, entry protocol, manifest and outbox model tests.

**Produces:** asynchronous session-only key/value adapter using `chrome.storage.session`, migration from legacy page sessionStorage, restored-count telemetry and cleanup.

- [ ] Add coverage for migration, reload restoration, instance replacement, storage failure and exact cleanup.
- [ ] Expose session storage to isolated content scripts using the minimum Chrome API access level and migrate the outbox.
- [ ] Show restored count and source without envelope text.
- [ ] Commit as `fix: restore sender outbox across runtime reloads`.
### Task 9: Cycle 29 — Safe Session Termination

**Files:**
- Create: `runtime/extension/shared/session-end-guard.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`, `runtime-pilot-state.js`, `runtime-pilot-controller.js`
- Modify: `runtime/extension/content/entry.js`
- Create: `runtime/extension/dashboard/session-end-model.js`
- Modify: dashboard markup/rendering/styles.
- Modify: `runtime/Final_2_Window_Extension.ahk` for blocked-end feedback.
- Test: new guard/model tests; update controller, protocol, entry and launcher tests.

**Produces:** `prepare_end_session` result with actionable counts and short-lived token; confirmed end requires token or an empty actionable set.

- [ ] Add coverage for clean end, blocked end, token expiry, explicit archive-and-end and Alt+Delete refusal when unresolved.
- [ ] Split prepare/confirm termination while preserving exact cleanup after confirmation.
- [ ] Add the end-session safety sheet and clear operator choices.
- [ ] Commit as `fix: guard session end with unresolved finals`.

### Task 10: Cycle 30 — Active Runtime Self-Test and Release Closure

**Files:**
- Create: `runtime/extension/shared/runtime-self-test.js`
- Create: `runtime/extension/dashboard/self-test-model.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`, `runtime-pilot-state.js`, `runtime-pilot-controller.js`, `background.js`
- Modify: `runtime/extension/content/entry.js`, `preflight-responder.js`
- Modify: dashboard markup/rendering/styles and readiness model.
- Modify: validation script, release tests, active docs and cycle log.
- Test: new self-test/model tests plus integration, privacy and usability coverage.

**Produces:** `run_self_test` command with sender RTT, receiver RTT, storage round-trip, dashboard state and overall result; readiness requires a fresh passing result.

- [ ] Add coverage for passing, partial, stale and privacy-safe self-tests.
- [ ] Implement no-content probes and integrate the result into readiness.
- [ ] Complete stale-module/import/terminology audits and update Cycles 21–30 evidence documentation.
- [ ] Run the complete automated gate once, fix owning-boundary failures, and rerun from the beginning until exit zero.
- [ ] Run isolated hidden-browser evidence and record verified results.
- [ ] Remove only inventoried assistant-created temporary validation logs after evidence replacement.
- [ ] Commit runtime evidence and documentation without push, merge or tag.
### Task 11: Update and Verify the Technical Systems Atlas

**Files:**
- Read: verified runtime source, current evidence record, and `PMIA_Technical_Systems_Atlas_Condensed_20260801.html`
- Create: a new versioned standalone HTML artifact in `/mnt/data`.

**Produces:** a concise, source-backed atlas that documents Cycles 21–30, updated message/recovery flows, new dashboard capabilities, verification evidence and remaining limitations.

- [ ] Replace obsolete architecture, feature and evidence claims; preserve useful Baseline versus Improved comparison content.
- [ ] Add or revise diagrams for hidden scheduling, circuit fallback, partitioned batching, durable recovery, reload-safe outbox, safe termination and self-test.
- [ ] Keep the condensed reading model; remove repetition rather than appending an unedited cycle log.
- [ ] Validate HTML structure, JavaScript, internal links, interactions, offline use, desktop rendering, 320 CSS-pixel reflow and print behavior.
- [ ] Deliver the versioned HTML download link with the verified runtime status and any remaining limitation.

## Deferred-test execution note

Tasks 1–10 write their tests before implementation but do not run them individually. The first executable run occurs only after Task 10 source work is complete, as explicitly required by the user.

## Plan self-review

All ten cycles map one-to-one to the design and include Bug fixes, New features and Implementation. The plan preserves the current owners, uses no disk-backed sensitive storage, includes the HTML update after system verification, and has no placeholders or open design decisions.
## Follow-on phase: Cycles 31�45

After Cycles 21�30 are fully implemented and verified, perform a fresh architecture, browser, failure-mode and stale-code audit against the resulting system. Define and implement fifteen additional substantive cycles, numbered 31�45, under the same three mandatory buckets: Bug fixes, New features and Implementation. Do not preselect low-value work before the post�Cycle 30 evidence is available.

The technical systems atlas must be updated only once, after Cycle 45 verification. Use the current condensed atlas as the base, preserve unchanged material, and revise only sections, diagrams, comparisons, features and evidence affected by Cycles 21�45.
