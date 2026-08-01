# PMIA Live Interview UX Cycles 96–145 Design

Date: 2026-08-02
Branch: `improvement/pmia-0.7.0`

## Goal

Turn the verified lossless transport runtime into an operator-grade live mock-interview cockpit. The expansion must reduce navigation time, make one current action obvious, preserve every captured final, and never activate a provider window without an explicit user gesture.

## Architecture decision

- Keep the Delivery Ledger, rendered proof, Session Registry, provider adapters, and Runtime Pilot controller as existing authorities.
- Add pure metadata models for interview phase, runbooks, incidents, triage, markers, navigation, accessibility, and performance.
- Persist only bounded session-only metadata. Prompt, answer, setup, credential, and clipboard content remain outside the new models.
- Route mutations through the existing per-session controller lane and allow-listed dashboard protocol.
- Route focus/layout changes only through explicit operator actions; recovery remains background-safe.
- Source and regression contracts are completed block-by-block. Executable tests remain deferred until Cycle 145 source work is complete.

## Interaction model

The Pilot has five live concepts: **Now**, **Next**, **Attention**, **Navigate**, and **Review**. The user can reach every live command from the command palette, toolbar, or accessible keyboard path. Derivation never executes commands. Destructive or focus-changing commands show a preview and require an explicit operator gesture.

## Cycle contracts

### Cycle 96 — Explicit Interview Phase Machine
- **Bug fixes:** Ambiguous setup/live/debrief state lets controls drift.
- **New features:** Setup, Ready, Active, Paused, Debrief, and Ended stages.
- **Implementation:** Persist one legal phase transition history in session-only Pilot state.

### Cycle 97 — Guided Start Runbook
- **Bug fixes:** Users must infer which prerequisite blocks the mock interview.
- **New features:** One ordered checklist with one owning next action.
- **Implementation:** Derive the runbook from readiness, context, storage, delivery, and consistency evidence.

### Cycle 98 — Start Mock Transaction
- **Bug fixes:** Starting can partially change timers or controls before prerequisites are proven.
- **New features:** One Start Mock action with a preview of blockers and effects.
- **Implementation:** Apply phase, clock, activity, and focus state atomically through the controller mutation lane.

### Cycle 99 — Session and Segment Clocks
- **Bug fixes:** A single wall-clock timer cannot distinguish paused time or interview sections.
- **New features:** Session elapsed/remaining time and current segment timer.
- **Implementation:** Store monotonic timestamps and paused totals; derive display time without heartbeat writes.

### Cycle 100 — Interviewer Silence Classifier
- **Bug fixes:** Normal interviewer thinking time is confused with capture failure.
- **New features:** Normal, quiet, long silence, and capture-issue states.
- **Implementation:** Combine interviewer activity timestamps with sender health and voice evidence.

### Cycle 101 — Single Attention Target
- **Bug fixes:** Many warnings compete without identifying the one thing to inspect.
- **New features:** One severity-ranked attention target with owner and role.
- **Implementation:** Rank root cause, incidents, delivery, answer, and readiness evidence deterministically.

### Cycle 102 — One Recommended Next Action
- **Bug fixes:** Operators must translate diagnostics into a command.
- **New features:** One safe next command with availability and explanation.
- **Implementation:** Map attention/runbook state to allow-listed commands without executing during derivation.

### Cycle 103 — Command Palette
- **Bug fixes:** Controls are scattered across tabs and panels.
- **New features:** Searchable keyboard command palette with previews.
- **Implementation:** Index the allow-listed command catalog and keep search side-effect free.

### Cycle 104 — Keyboard-Complete Navigation
- **Bug fixes:** Mouse-only toolbar movement is slow during a live interview.
- **New features:** Arrow/Home/End/Enter/Escape navigation and visible shortcut help.
- **Implementation:** Use roving tabindex and normal command feedback paths.

### Cycle 105 — Live Focus Mode
- **Bug fixes:** The dashboard exposes too much information while answering.
- **New features:** Compact Now/Next view that hides noncritical detail.
- **Implementation:** Apply a reversible UI-only focus mode during Active or Paused phases.

### Cycle 106 — Incident Center
- **Bug fixes:** Warnings, root cause, and consistency failures appear in separate places.
- **New features:** One ordered incident inbox.
- **Implementation:** Normalize and merge warning/root-cause/audit evidence by owner, code, and role.

### Cycle 107 — Incident Acknowledge and Snooze
- **Bug fixes:** Repeated known warnings obscure new problems.
- **New features:** Acknowledge, snooze, clear, and automatic re-open on escalation.
- **Implementation:** Persist only metadata controls; never suppress a higher-severity recurrence.

### Cycle 108 — Incident Severity and Ownership
- **Bug fixes:** Generic errors do not show which subsystem owns recovery.
- **New features:** Critical/Error/Warning/Info severity with Transport, Provider, State, Delivery, or Operator owner.
- **Implementation:** Use a stable severity lattice and deterministic owner classification.

### Cycle 109 — Incident Runbooks
- **Bug fixes:** An incident code alone does not tell the user what to do next.
- **New features:** Stepwise safe runbook with progress and one current step.
- **Implementation:** Map incident/root-cause codes to allow-listed checks, queue-only, reconnect, reconcile, or handoff.

### Cycle 110 — Quiet Attention Mode
- **Bug fixes:** Nonurgent notifications interrupt the interview.
- **New features:** Quiet mode that surfaces only critical incidents and current next action.
- **Implementation:** Filter presentation only; preserve all incident state and audit history.

### Cycle 111 — Question Triage States
- **Bug fixes:** Every captured final looks equally urgent.
- **New features:** Pin, Normal, Defer, and Answer Later classifications.
- **Implementation:** Store triage metadata beside ledger identity without changing sequence or proof authority.

### Cycle 112 — Duplicate and Follow-up Linking
- **Bug fixes:** Repeated or follow-up questions are hard to recognize under pressure.
- **New features:** Suggested duplicate/follow-up links with explicit confirmation.
- **Implementation:** Use normalized fingerprints and temporal adjacency; never auto-delete or merge finals.

### Cycle 113 — Batch Preview and Grouping
- **Bug fixes:** The user cannot see what the receiver will submit next.
- **New features:** Exact next-batch membership, grouping, size, and latest-priority preview.
- **Implementation:** Derive from immutable planner partitions and provider budget metadata.

### Cycle 114 — Safe Queue Search and Filters
- **Bug fixes:** Large sessions require scanning every final.
- **New features:** Search by safe ID/sequence/state/triage/batch and preset filters.
- **Implementation:** Index metadata only; question text remains visible only in the existing live queue surface.

### Cycle 115 — Priority Without Reordering
- **Bug fixes:** Urgency controls can accidentally violate delivery order.
- **New features:** Deadline/triage emphasis that preserves sequence.
- **Implementation:** Schedule due partitions and highlight priority while member order remains immutable.

### Cycle 116 — Operator Markers
- **Bug fixes:** Users cannot mark a key interview moment for later review.
- **New features:** Timestamped bookmarks with typed labels.
- **Implementation:** Persist bounded metadata-only markers tied to phase, sequence, or batch.

### Cycle 117 — Interviewer Activity Markers
- **Bug fixes:** Long silence and question arrival lack review landmarks.
- **New features:** Automatic safe activity markers for question arrival, answer start, and silence transitions.
- **Implementation:** Emit deduplicated marker types without copying transcript content.

### Cycle 118 — Phase Checkpoints and Resume
- **Bug fixes:** Reload/recovery leaves the operator unsure where to continue.
- **New features:** Last safe checkpoint and Resume From Checkpoint action.
- **Implementation:** Checkpoint phase, active batch identity, clock, and attention state in session storage.

### Cycle 119 — Interruption Recovery Card
- **Bug fixes:** A reload or provider interruption requires several disconnected actions.
- **New features:** One recovery card with current checkpoint and exact safe resume steps.
- **Implementation:** Compose from lifecycle, outbox, ledger, batch, and owner evidence.

### Cycle 120 — Session Timeline Landmarks
- **Bug fixes:** The timeline is event-heavy but not interview-oriented.
- **New features:** Phase, marker, question, answer, incident, and recovery landmarks.
- **Implementation:** Project bounded metadata events into a virtualizable review timeline.

### Cycle 121 — Managed Window Navigator
- **Bug fixes:** Users must Alt-Tab among sender, receiver, and Pilot.
- **New features:** Explicit Focus Sender, Focus Receiver, and Focus Pilot commands.
- **Implementation:** Route user-gesture commands through background window ownership; never auto-activate.

### Cycle 122 — Live Layout Presets
- **Bug fixes:** Manual resizing slows setup and recovery.
- **New features:** Three-window, Dashboard Focus, Provider Focus, and Restore Previous layouts.
- **Implementation:** Reuse launcher/window geometry owners and store only session-scoped bounds.

### Cycle 123 — Role Spotlight
- **Bug fixes:** The user needs one large provider surface while retaining health visibility.
- **New features:** Sender spotlight, Receiver spotlight, and Pilot spotlight.
- **Implementation:** Apply layout and dashboard focus state only after explicit operator command.

### Cycle 124 — Focus History and Back
- **Bug fixes:** After inspecting a provider, returning to prior layout is manual.
- **New features:** Back to Previous View command.
- **Implementation:** Maintain a bounded navigation/layout stack independent of browser history.

### Cycle 125 — User-Gesture Focus Safety
- **Bug fixes:** Background recovery must never steal focus.
- **New features:** Visible focus-intent preview and short-lived gesture authorization.
- **Implementation:** Issue one-use focus tokens from dashboard clicks/keys and reject expired background requests.

### Cycle 126 — Shortcut Customization
- **Bug fixes:** Fixed shortcuts conflict with user/browser habits.
- **New features:** Session-only remappable dashboard shortcuts with conflict warnings.
- **Implementation:** Normalize key chords, reserve destructive actions, and keep provider hotkeys unchanged.

### Cycle 127 — Shortcut Discovery Overlay
- **Bug fixes:** Users cannot remember all live commands.
- **New features:** Searchable shortcut/help overlay.
- **Implementation:** Generate help from the same command catalog and shortcut bindings.

### Cycle 128 — Reduced Motion Mode
- **Bug fixes:** Animated state changes can distract or cause discomfort.
- **New features:** System-aware and explicit reduced-motion setting.
- **Implementation:** Gate transitions/animations through one UI preference and CSS media query.

### Cycle 129 — Large Text and High Contrast
- **Bug fixes:** Dense operational text is hard to read quickly.
- **New features:** Large-text and high-contrast display modes.
- **Implementation:** Apply root data attributes and preserve 320-pixel reflow.

### Cycle 130 — Screen-Reader Announcements
- **Bug fixes:** State changes are visible but not consistently announced.
- **New features:** Polite status updates and assertive critical-incident announcements.
- **Implementation:** Centralize deduplicated ARIA live messages by semantic state fingerprint.

### Cycle 131 — Preflight Wizard
- **Bug fixes:** Readiness shows blockers but not an ordered setup flow.
- **New features:** Wizard for route, roles, composers, context, self-test, storage, and delivery policy.
- **Implementation:** Reuse existing checks and expose one step at a time without duplicating authority.

### Cycle 132 — Emergency Hold
- **Bug fixes:** During a provider anomaly the user needs one immediate safe action.
- **New features:** Hold All Delivery command with visible retained-final count.
- **Implementation:** Pause transport and queue provider writes while preserving every outbox/ledger final.

### Cycle 133 — Safe Resume Checklist
- **Bug fixes:** Resume can release queued work before the system is ready.
- **New features:** Resume preview showing backlog, batch plan, receiver state, and first action.
- **Implementation:** Require current readiness/consistency/probation evidence before resuming automatic delivery.

### Cycle 134 — Enhanced Session Boundary
- **Bug fixes:** End-session safety does not summarize live UX state.
- **New features:** Boundary sheet includes markers, incidents, triage, clocks, checkpoint, and pending focus state.
- **Implementation:** Extend two-phase termination counts without copying transcript content.

### Cycle 135 — Crash/Reload Resume Prompt
- **Bug fixes:** Restored state can resume silently after a browser restart.
- **New features:** Resume, Inspect, or End Safely prompt.
- **Implementation:** Detect reconstructed active/paused sessions and require explicit operator continuation.

### Cycle 136 — Operational Event Filters
- **Bug fixes:** The timeline mixes high-value and background events.
- **New features:** Owner, severity, phase, type, and time-range filters.
- **Implementation:** Filter the bounded event projection without changing stored history.

### Cycle 137 — Trace Explanation
- **Bug fixes:** Trace IDs exist but mechanical state is hard to interpret.
- **New features:** Plain technical explanation of each stage and next expected transition.
- **Implementation:** Map trace spans and ledger/batch states to reason-coded explanations.

### Cycle 138 — SLO History and Trends
- **Bug fixes:** Current forecast lacks trend context.
- **New features:** Rolling proof latency, throughput, backlog, and answer-availability history.
- **Implementation:** Store bounded numeric samples and derive trend direction without transcript content.

### Cycle 139 — Stabilization Runbook
- **Bug fixes:** A degraded session needs a safe operating mode before repair.
- **New features:** Hold, inspect, test, repair, verify, and resume sequence.
- **Implementation:** Combine root cause, incidents, queue-only, drill, and readiness into one guarded runbook.

### Cycle 140 — Performance Health Surface
- **Bug fixes:** Performance budgets exist but are not actionable.
- **New features:** Cache, write, render, queue, and memory budget status with next action.
- **Implementation:** Aggregate deterministic counters and violations by owner.

### Cycle 141 — Command Search Index
- **Bug fixes:** Palette search rescans the catalog on every keystroke.
- **New features:** Instant ranked search across commands, incidents, markers, and traces.
- **Implementation:** Build a reusable normalized token index with scoped invalidation.

### Cycle 142 — Virtualized Live Lists
- **Bug fixes:** Large queues/incidents/markers can render too many nodes.
- **New features:** Bounded viewport rendering with total counts and keyboard continuity.
- **Implementation:** Use pure slice models and stable row keys for queue, incidents, markers, and timeline.

### Cycle 143 — Coalesced Dashboard Rendering
- **Bug fixes:** Burst telemetry can trigger repeated full renders.
- **New features:** One frame/microtask render commit with semantic dirty sections.
- **Implementation:** Batch snapshot/heartbeat changes and render only affected owners.

### Cycle 144 — Idle Diagnostics Work
- **Bug fixes:** Nonurgent analysis competes with live interaction.
- **New features:** Deferred cache/index/report work with cancellation.
- **Implementation:** Use requestIdleCallback when available and bounded timer fallback; never delay delivery.

### Cycle 145 — Live UX Memory Budgets
- **Bug fixes:** New UI histories can grow across long sessions.
- **New features:** Explicit counts and reclaimable categories for incidents, markers, bindings, filters, and navigation.
- **Implementation:** Bound each collection, compact resolved history, and expose deterministic budget telemetry.

## Non-goals

- No large prompt redesign.
- No automatic answer coaching or content generation changes.
- No replacement transport or external relay.
- No automatic focus stealing, provider tab activation, or normal-profile inspection.
- No persistent transcript storage beyond existing explicit export.

## Acceptance boundary

Cycle 145 is source-complete only when all 50 cycle contracts are reachable from production owners, all new collections are bounded, and the dashboard remains keyboard-complete and 320-pixel responsive. Verification runs only after source completion.