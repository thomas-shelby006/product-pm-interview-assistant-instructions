# PMIA Adaptive Turn Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build lossless Pause/Resume forwarding, protected combined drafts, correlated interruption carryover, throughput/latency evidence, and operator controls over PMIA’s existing owners.

**Architecture:** Add pure coordination, prompt, correlation, and performance models. Persist only bounded metadata in schema v5. Keep envelopes in `DeliveryLedger`/`BatchPlanner`, provider writes in `receiver-batch-runtime`, commands in `runtime-pilot-controller`, and DOM operations in provider adapters.

**Tech Stack:** JavaScript ES modules, Node `node:test`, Manifest V3 extension runtime, browser session storage, AutoHotkey v2 launcher, isolated Edge smoke.

## Global Constraints

- No second queue, ledger, persistence store, submission owner, answer tracker, or browser lifecycle manager.
- Finalized DOM turns are authoritative; previews never become durable finals.
- Pause blocks provider writes but never durable sender admission.
- Manual composer conflicts block automatic release.
- Stop actions require correlated source evidence and exact active-batch membership.
- No fixed hot-path sleep; only bounded verification/watchdog timing.
- No foreground activation during automatic runtime operations.
- Final standalone HTML is generated only after exact green release evidence.

---

### Task 1: Pure coordination, combined prompt, and interruption contracts

**Files:**
- Create: `runtime/extension/shared/adaptive-turn-coordination.js`
- Create: `runtime/extension/shared/adaptive-combined-prompt.js`
- Create: `runtime/extension/shared/source-interruption-correlator.js`
- Test: `runtime/extension/tests/pmia-adaptive-turn-coordination.test.js`

**Interfaces:**
- Produces `normalizeAdaptiveTurnState`, `transitionForwardingHold`, `recordHeldMember`, `recordCombinedDraft`, `beginInterruptionChain`, `updateInterruptionStop`, `resolveInterruptionChain`.
- Produces `composeAdaptiveCombinedPrompt({ entries, reason })`.
- Produces `createSourceInterruptionCorrelator()` with `observeGeneration`, `observeAssistantFinal`, and `observeFinalTurn`.
- [ ] Write tests for normalization, idempotent Pause/Resume, identity-preserving held members, exact combined prompt wording, ordinary-final non-interruption, bounded continuation classification, and stale stop-token rejection.
- [ ] Run the focused test and verify RED failures name missing production exports.
- [ ] Implement the minimal pure models.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit pure coordination contracts.

### Task 2: Schema v5 and durable Pilot metadata

**Files:**
- Modify: `runtime/extension/shared/runtime-state-schema.js`
- Modify: `runtime/extension/shared/runtime-state-migrations.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-store.js`
- Test: `runtime/extension/tests/pmia-adaptive-turn-persistence.test.js`

**Interfaces:**
- Adds `adaptiveTurns` to every normalized session.
- Adds Pilot methods `setForwardingHold`, `recordAdaptiveHeldMember`, `setAdaptiveCombinedDraft`, `setInterruptionChain`, `recordTurnPerformance`, and `resolveAdaptiveTurns`.

- [ ] Write schema migration and restart-continuity tests first.
- [ ] Verify schema-4 sessions migrate to schema 5 with safe defaults and no delivery mutation.
- [ ] Implement normalization, mutation methods, snapshots, export/restore, and bounded content-free performance samples.
- [ ] Run migration, store, quarantine, state, and focused persistence suites.
- [ ] Commit schema and Pilot state.

### Task 3: Receiver hold, release, and carryover runtime

**Files:**
- Modify: `runtime/extension/shared/batch-planner.js`
- Modify: `runtime/extension/content/receiver-batch-runtime.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/pmia-adaptive-receiver-runtime.test.js`

**Interfaces:**
- `BatchPlanner.freezeNext(now, { promptFactory, source })` supports exact adaptive prompts while retaining normal batching defaults.
- Receiver commands: `set_forwarding_hold`, `resume_forwarding`, `send_held_now`, `correlate_source_interruption`.

- [ ] Write failing runtime tests for pause admission, combined projection, resume-and-send, resume-without-send, send-held-now, manual conflict, one-shot Stop, failed Stop retention, and three-segment carryover.
- [ ] Verify each failure is caused by missing adaptive behavior.
- [ ] Implement minimal receiver coordination over existing planner and adapter owners.
- [ ] Run existing batching, queue-only, answer, proof, sequence, and new adaptive runtime suites.
- [ ] Commit receiver behavior.
### Task 4: Controller, protocol, commands, and end/export safety

**Files:**
- Modify: `runtime/extension/shared/operator-command-registry.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/shared/session-end-guard.js`
- Modify: `runtime/extension/shared/session-export.js`
- Test: `runtime/extension/tests/pmia-adaptive-control-plane.test.js`

**Interfaces:**
- Dashboard commands: `pause_forwarding`, `resume_forwarding`, `send_held_now`, `set_interruption_profile`, `resolve_adaptive_recovery`.
- Runtime command payloads are strict, bounded, and content-free except the existing provider-owned planner prompt.

- [ ] Write failing protocol/registry/controller tests before edits.
- [ ] Prove duplicate commands replay the original result and rapid Pause/Resume serializes deterministically.
- [ ] Block route changes, export readiness, and end-session while actionable adaptive state exists.
- [ ] Implement command routing and safe export summary.
- [ ] Run command reachability, protocol, controller, export, and end-guard suites; commit.

### Task 5: Runtime Pilot features, accessibility, and operator projections

**Files:**
- Create: `runtime/extension/dashboard/adaptive-turns-model.js`
- Create: `runtime/extension/dashboard/render-adaptive-turns.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Modify: `runtime/extension/dashboard/shortcut-help-model.js`
- Test: `runtime/extension/tests/pmia-adaptive-dashboard.test.js`

**Interfaces:**
- Renders status, count, age, chain, prompt preview metadata, recovery action, throughput, and latency.
- Controls map only to registered commands and use existing confirmation, focus, and announcement owners.

- [ ] Write failing DOM/model/command/accessibility tests.
- [ ] Add compact card, paused banner evidence, primary/secondary actions, profiles, chain inspector, timeline markers, throughput meter, and latency rail.
- [ ] Add keyboard bindings with conflict detection and deduplicated announcements.
- [ ] Verify desktop, 320px, 280px, print, unique IDs, ARIA targets, and command reachability.
- [ ] Commit user-facing adaptive controls.
### Task 6: Throughput, latency, system-design, and bug campaigns

**Files:**
- Create: `runtime/extension/shared/turn-performance-model.js`
- Test: `runtime/extension/tests/pmia-adaptive-throughput.test.js`
- Test: `runtime/extension/tests/pmia-adaptive-system-design-cycles.test.js`
- Test: `runtime/extension/tests/pmia-adaptive-bug-campaign.test.js`

**Interfaces:**
- `recordTurnStage`, `deriveTurnPerformance`, and `evaluateTurnAcceptance` return deterministic p50/p95/max, current turns/minute, dominant delay owner, and budget failures.

- [ ] Write deterministic 20-turn/60-second and 100-turn burst tests.
- [ ] Add the 25 system-design checks in five ownership/event/restart/backpressure/release blocks.
- [ ] Add all 25 reproducing bug-cycle tests and owning-boundary fixes.
- [ ] Run each five-cycle block focused, update the master plan, and commit at meaningful checkpoints.
- [ ] Require zero loss, exact order, no wording dedupe, no unnecessary Stop, no manual overwrite, and all latency budgets.

### Task 7: Full release proof and final HTML

**Files:**
- Modify isolated smoke and release evidence only where needed for adaptive assertions.
- Update the existing standalone technical HTML in its canonical project location.
- Update: `docs/superpowers/plans/2026-08-02-pmia-0.11-session-navigator-cycles-151-250.md`.

- [ ] Run all focused adaptive suites.
- [ ] Run complete `runtime/Validate_Extension_Runtime.ps1` and require exit 0.
- [ ] Run exact-HEAD isolated browser proof for Pause, release, carryover, restart, throughput, no focus theft, and cleanup across supported provider routes.
- [ ] Generate deterministic release/handoff evidence bound to HEAD; verify clean candidate worktree, untouched original checkout, and no push/merge/tag.
- [ ] Update and validate the standalone HTML last, including architecture, state transitions, trade-offs, measured benchmarks, limitations, and evidence.
- [ ] Remove only current-task assistant-created temporary files from the designated temp directory.

## Execution decision

Inline execution is selected by the user’s instruction to continue the existing plan in this session without stopping. Use test-driven development for every production behavior change.