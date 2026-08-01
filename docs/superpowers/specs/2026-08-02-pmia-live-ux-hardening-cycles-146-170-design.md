# PMIA Live UX Hardening Cycles 146–170 Design

Date: 2026-08-02
Branch: `improvement/pmia-0.7.0`

## Goal

Harden the expanded live-interview cockpit against duplicate commands, lifecycle replacement, accessibility regressions, large-session load, restart, and evidence drift.

## Architecture decision

- Harden existing owners; do not create parallel command, state, window, or persistence authorities.
- Extend the versioned session envelope and migration chain for new UX metadata.
- Keep browser focus user-gesture-bound and all fault/drill data content-free.
- Write regression contracts with source work and defer execution until Cycle 170 source completion.

## Cycle contracts

### Cycle 146 — Command Idempotency and Replay
- **Bug fixes:** Repeated clicks/reconnects can execute one UX command twice.
- **New features:** Visible replay result for duplicate commands.
- **Implementation:** Bind every new command to the existing command-result journal and request ID.

### Cycle 147 — Focus Gesture Expiry
- **Bug fixes:** Delayed background focus requests can act after intent has changed.
- **New features:** One-use, short-lived focus authorization status.
- **Implementation:** Validate session, target, action, issued time, expiry, and consumption.

### Cycle 148 — Incident Control Durability
- **Bug fixes:** Acknowledgements/snoozes can vanish across worker restart.
- **New features:** Restart-safe incident controls.
- **Implementation:** Persist bounded control metadata in versioned session state and migrate safely.

### Cycle 149 — Marker Deduplication and Bounds
- **Bug fixes:** Repeated lifecycle signals can flood markers.
- **New features:** Marker coalescing and dropped-count telemetry.
- **Implementation:** Fingerprint marker type/identity/time window and enforce hard bounds.

### Cycle 150 — Triage Invariant Repair
- **Bug fixes:** Triage links can reference missing or archived finals.
- **New features:** Safe repair report and operator-visible blocked ambiguity.
- **Implementation:** Repair deterministic orphan links; preserve ambiguous relations for review.

### Cycle 151 — Palette and Dialog Lifecycle Recovery
- **Bug fixes:** BFCache/reload can leave stale focus traps or open state.
- **New features:** Clean reopen at the last safe palette query.
- **Implementation:** Serialize only safe UI state and recreate listeners/focus ownership on pageshow.

### Cycle 152 — Live Session Restart Continuity
- **Bug fixes:** Worker restart can lose phase/clock/runbook coherence.
- **New features:** Verified continuity report for phase, clocks, incidents, triage, and markers.
- **Implementation:** Extend versioned state hydration and restart scenario checks.

### Cycle 153 — Window Replacement Navigation Recovery
- **Bug fixes:** Edge can replace tab/window IDs during recovery.
- **New features:** Navigator automatically rebinds managed targets without activating them.
- **Implementation:** Resolve current registry ownership before every explicit focus/layout action.

### Cycle 154 — Monotonic Clock Recovery
- **Bug fixes:** System clock changes or reload can corrupt elapsed time.
- **New features:** Clock anomaly warning and stable elapsed calculation.
- **Implementation:** Use stored active segments, nonnegative deltas, and bounded anomaly correction.

### Cycle 155 — Layout State Restoration
- **Bug fixes:** Display changes can make saved layouts invalid.
- **New features:** Validated restore with visible fallback.
- **Implementation:** Clamp bounds to current displays and preserve a reversible previous layout.

### Cycle 156 — Shortcut Conflict Detection
- **Bug fixes:** Custom bindings can shadow browser/system or destructive commands.
- **New features:** Conflict matrix and safe suggested replacement.
- **Implementation:** Normalize chords and compare reserved, duplicate, platform, and accessibility conflicts.

### Cycle 157 — Automated Accessibility Audit Model
- **Bug fixes:** New UI can regress labels, focusability, and live-region ownership.
- **New features:** Pre-release accessibility findings in Pilot evidence.
- **Implementation:** Run DOM metadata checks without reading provider content.

### Cycle 158 — Focus Trap and Escape Hardening
- **Bug fixes:** Dialogs can strand keyboard focus.
- **New features:** Deterministic initial focus, loop, Escape, and return focus.
- **Implementation:** One dialog-focus coordinator owns palette, help, preflight, boundary, and recovery sheets.

### Cycle 159 — Reduced-Motion and Contrast Proof
- **Bug fixes:** Preferences can be applied inconsistently.
- **New features:** Evidence of effective visual preference state.
- **Implementation:** Centralize root attributes and validate animation/contrast tokens.

### Cycle 160 — Responsive and Zoom Proof
- **Bug fixes:** Small screens and browser zoom can hide controls.
- **New features:** Release evidence at 320px, 400% zoom-equivalent width, desktop, and print.
- **Implementation:** Expand isolated smoke layout assertions and screenshots.

### Cycle 161 — Ten-Thousand-Item UX Load Budget
- **Bug fixes:** Large queue/trace histories can stall the Pilot.
- **New features:** Deterministic load-budget report.
- **Implementation:** Exercise pure indices, virtualization, and render plans against 10k metadata records.

### Cycle 162 — Command Index Performance Budget
- **Bug fixes:** Search indexing can rebuild unnecessarily.
- **New features:** Hit/miss/rebuild telemetry and bounded query operations.
- **Implementation:** Cache normalized tokens and invalidate only affected command/incident/marker sections.

### Cycle 163 — Virtualized Timeline Memory Budget
- **Bug fixes:** Scrolled history can retain detached nodes.
- **New features:** Mounted-row and retained-key telemetry.
- **Implementation:** Recycle row views and cap selection/focus memory independent of history size.

### Cycle 164 — Persistence Write Budget for UX State
- **Bug fixes:** Frequent UI changes can increase session-storage churn.
- **New features:** Commit reason and coalescing telemetry for UX mutations.
- **Implementation:** Classify urgent versus coalescible UX writes and use one session lane.

### Cycle 165 — Idle Work Cancellation
- **Bug fixes:** Deferred diagnostics can run after session end or state replacement.
- **New features:** Visible cancelled/stale idle-work counts.
- **Implementation:** Fence tasks by session generation and cancel on close/reload/new snapshot.

### Cycle 166 — Live UX Fault Matrix
- **Bug fixes:** New navigation and incident features lack deterministic fault injection.
- **New features:** Scenario suite for disconnect, stale focus, invalid triage, clock anomaly, and render overload.
- **Implementation:** Extend test-only fault runner; production imports remain forbidden.

### Cycle 167 — Expanded Restart Continuity Proof
- **Bug fixes:** Current restart proof covers mechanics but not UX metadata.
- **New features:** Continuity checks for phase, clock, incidents, triage, markers, bindings, filters, and layout.
- **Implementation:** Round-trip versioned state and rebuild derived indices before comparison.

### Cycle 168 — Expanded No-Content Operator Drill
- **Bug fixes:** Transport drill does not exercise navigation/readiness UX.
- **New features:** Additional checks for command replay, focus token rejection, incident escalation, resume guard, and accessibility model.
- **Implementation:** Use synthetic metadata and no provider conversation access.

### Cycle 169 — Browser Evidence for Live Operations
- **Bug fixes:** Automated tests cannot prove actual focus, keyboard, and responsive behavior.
- **New features:** Isolated evidence for palette, navigator, hold/resume, incidents, markers, and layouts.
- **Implementation:** Extend disposable-profile smoke with synthetic session state and screenshots.

### Cycle 170 — Deterministic Final Release Evidence
- **Bug fixes:** Multiple evidence files can disagree about source and UX state.
- **New features:** One source-bound release manifest and safe support bundle index.
- **Implementation:** Hash final sources, tests, browser evidence, screenshots, accessibility, load budgets, cleanup, and no-normal-profile proof.

## Acceptance boundary

Cycle 170 is complete only after full automated validation, isolated browser evidence, restart and privacy proof, final source-bound evidence manifest, repository cleanup, and original-checkout/no-push verification. The technical HTML begins only after this boundary passes.