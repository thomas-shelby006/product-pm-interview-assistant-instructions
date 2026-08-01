# PMIA Iterative Improvement Log

This log records the ten post-implementation audit cycles required for PMIA 0.7. Executable tests remain deferred to the final consolidated gate.

## Cycle 1 √¢‚Ç¨‚Äù Launch and setup friction

**Evidence inspected:** AutoHotkey layout state, dashboard `chrome.windows` layout commands, `Alt+Tab` hide/restore, and the two-second session-memory monitor.

**Issue/opportunity:** Dashboard-driven layouts were not represented in AutoHotkey's logical layout snapshot, so hide/restore could replay an older preset. During simultaneous transient provider reload, the monitor could clear Resume/JD/context after a single two-second sample.

**Classification:** User-facing reliability bug and recovery-safety bug.

**Implementation:** Added actual geometry capture for sender, receiver, and dashboard before hide; restore now replays exact geometry with logical layout as fallback. Added a ten-second continuous simultaneous-provider-absence grace period before clearing AHK session memory.

**Files changed:** `runtime/Final_2_Window_Extension.ahk`, `runtime/extension/tests/launcher.test.js`.

**Coverage added:** Static launcher checks for geometry capture/restore ordering and the cleanup grace threshold.

**Source review:** Geometry is scoped to exact cached HWNDs; unrelated windows are never enumerated or moved. Context still clears after genuine provider shutdown, but not during brief extension/browser recovery.

**Why this is superior:** It fixes the owning state boundary without blocking dashboard layouts or weakening privacy cleanup.

## Cycle 2 - Dashboard clarity and operator speed

**Evidence inspected:** Primary control labels, queue selection behavior, superseded queue rows, and keyboard discoverability.

**Issue/opportunity:** The dashboard always said Pause forwarding, even when paused. Superseded history was mixed with actionable finals and could still be selected for an avoidable rejected send. Keyboard controls were implemented but hidden.

**Classification:** User-facing efficiency and error-prevention improvement.

**Implementation:** Made the primary transport action mode-aware, defaulted the queue to actionable items with an All-items filter, visually de-emphasized superseded rows, blocked superseded sends in the UI, and added compact visible keyboard help.

**Files changed:** dashboard-model.js, dashboard.js, dashboard.css, index.html, and dashboard-model.test.js.

**Coverage added:** Pure-model checks for actionable queue filtering and authoritative primary action selection.

**Source review:** The service worker remains authoritative; UI filtering never deletes queue history and controller rejection remains the backstop.

**Why this is superior:** It reduces operator decisions and prevents an invalid action without weakening queue auditability.

## Cycle 3 - Queue correctness and stale-question handling

**Evidence inspected:** Operator queue retention, superseded item lifecycle, dashboard queue actions, and warning derivation.

**Issue/opportunity:** Superseded history required item-by-item cleanup, and a question waiting long enough to become contextually risky looked identical to a fresh queued final.

**Classification:** Queue safety and operator-attention improvement.

**Implementation:** Added an idempotent Clear superseded command that preserves actionable finals. The pilot snapshot now raises a critical oldest-queue warning after two minutes for non-superseded items.

**Files changed:** dashboard protocol, operator queue, pilot state/controller, dashboard UI/model, and adjacent tests.

**Coverage added:** Superseded-only cleanup and oldest-actionable-age warning checks.

**Source review:** Queue age is derived from session timestamps, not recurring storage writes. Cleanup never touches actionable items or provider conversations.

**Why this is superior:** It keeps audit history available when useful, removes it in one safe action, and surfaces when queued context is likely stale before submission.

## Cycle 4 - Sender capture latency and silence diagnostics

**Evidence inspected:** Five-second telemetry heartbeat, 90-second source-silence marker, provider voice state, and dashboard warning ownership.

**Issue/opportunity:** A fixed 90-second warning is appropriate for ordinary interview silence but far too slow when voice mode is active and transcript events have stopped.

**Classification:** Live capture diagnostics and response-time improvement.

**Implementation:** Added a pure adaptive silence classifier: active voice becomes slow after six seconds and stalled after fifteen seconds; inactive sessions keep the 90-second warning. Warning derivation moved into the authoritative pilot snapshot.

**Files changed:** runtime telemetry, pilot state, dashboard model/controller rendering, and telemetry/state tests.

**Coverage added:** Classifier thresholds and critical voice-stall warning checks.

**Source review:** No extra polling or storage writes were added. Existing five-second heartbeat and meaningful preview events feed the classifier.

**Why this is superior:** It distinguishes an actual capture failure from normal interviewer silence and surfaces the failure up to 75 seconds earlier.

## Cycle 5 - Receiver submission and proof robustness

**Evidence inspected:** Receiver stop/supersede flow, composer readiness, retry baseline IDs, rendered-turn confirmation, Boolean delivery result, and dashboard evidence.

**Issue/opportunity:** A Boolean result hid whether delivery used an existing rendered turn, confirmed a new rendered turn, failed to stop generation, lacked a composer, or never produced proof.

**Classification:** Exactly-once proof diagnostics and future-adapter safety improvement.

**Implementation:** Added structured receiver proof callbacks while preserving the Boolean transport contract. Proof records now identify existing/new rendered turns, verification status, and owning failure reason. Pilot state retains the latest proof and raises an error for failed or unverified proof.

**Files changed:** receiver runtime, content orchestration, pilot state, dashboard model/view, and runtime/state tests.

**Coverage added:** Verified rendered-turn proof, composer-missing failure reason, and unverified-proof health warning.

**Source review:** Both supported provider adapters expose conversation-message IDs, so supported routes remain provider-rendered-proof capable. Submit-action-only fallback is explicitly unhealthy rather than silently trusted.

**Why this is superior:** It preserves the existing transport API while making the actual proof boundary observable and auditable.

## Cycle 6 - Recovery and service-worker restart behavior

**Evidence inspected:** Browser-native repair actions, role telemetry, pilot mode transitions, dashboard port reconnect, and pending command promises.

**Issue/opportunity:** Repair was labeled successful after issuing a recover/reload action, before both roles returned healthy. A service-worker disconnect left dashboard commands waiting for their full timeout.

**Classification:** Recovery truthfulness and reconnection responsiveness bug.

**Implementation:** Repair now remains in repairing mode with pending verification. Healthy telemetry from both roles or an explicit live check completes verification; failures enter degraded mode. Dashboard port disconnect immediately fails outstanding commands and reconnects.

**Files changed:** Runtime Pilot controller/state, dashboard model/controller, and controller/state/manifest tests.

**Coverage added:** Repair remains pending after one role, completes after both, exposes repairing/degraded warnings, and calls the pending-command failure path on disconnect.

**Source review:** Verification is driven by the existing heartbeat/telemetry path, so it survives worker restart and adds no new timer or polling loop.

**Why this is superior:** It reports recovered state only after observed health and gives the operator immediate feedback when the control channel restarts.

## Cycle 7 - Privacy, cleanup, and export boundaries

**Evidence inspected:** Legacy extension-log cleanup, storage.local access, AutoHotkey operational logging, session identifiers, and active privacy documentation.

**Issue/opportunity:** Legacy cleanup materialized every local-storage value to discover PMIA keys. AutoHotkey wrote operational logs containing session identifiers to disk by default.

**Classification:** Persistent-data minimization and diagnostics privacy improvement.

**Implementation:** Legacy cleanup now uses storage key-only enumeration when supported, with a compatibility fallback. AutoHotkey disk logging is opt-in through PMIA_DEBUG_LOG=1, always redacts session identifiers, and keeps non-persistent OutputDebug diagnostics available.

**Files changed:** Session log store, AutoHotkey launcher, privacy documentation, and adjacent tests.

**Coverage added:** Proves key-only cleanup does not call value reads, and persistent AHK logging is gated before FileAppend with session redaction.

**Source review:** Runtime delivery and diagnostics do not depend on persistent logging. Explicit export remains the only normal user-visible transcript write.

**Why this is superior:** It reduces data exposure at discovery and logging boundaries without sacrificing recoverability or diagnosability.

## Cycle 8 - Provider-adapter resilience and selector risk

**Evidence inspected:** ChatGPT and Claude adapter exports, active preflight response, runtime telemetry, and dashboard role health.

**Issue/opportunity:** A composer-ready result did not reveal whether message reading, composer writing, submission, generation state, stop, microphone, and voice capabilities were still present after provider or adapter changes.

**Classification:** Provider-change observability and release-safety improvement.

**Implementation:** Added a semantic adapter capability reporter. Preflight and heartbeat telemetry publish required/optional capabilities; pilot health raises role-specific errors for missing required surfaces; dashboard role cards show Complete or the exact missing capabilities.

**Files changed:** New adapter-health module, preflight responder, telemetry, pilot state/controller, dashboard, manifest, and adjacent tests.

**Coverage added:** Complete and incomplete receiver capability reports, preflight response contract, and packaged-resource assertions.

**Source review:** The capability probe checks function presence only and never reads conversations, writes composers, submits, stops generation, or toggles microphones.

**Why this is superior:** It detects adapter contract drift before a live question reaches the submission boundary without adding brittle selector-specific checks or side effects.

## Cycle 9 - Long-session performance and memory bounds

**Evidence inspected:** Five-second role heartbeats, pilot storage commits, full dashboard snapshot broadcasts, existing queue/timeline/metric bounds, and client-side age rendering.

**Issue/opportunity:** Unchanged heartbeats caused two full session-storage writes and full snapshots every five seconds, despite heartbeat age already being derived in the dashboard.

**Classification:** Long-session storage, messaging, and rendering efficiency improvement.

**Implementation:** Added telemetry fingerprinting that excludes volatile heartbeat age fields. Meaningful transitions and events still persist/broadcast full snapshots; heartbeat-only changes use a lightweight role patch over the existing dashboard port and skip storage writes.

**Files changed:** New telemetry coalescer, Runtime Pilot controller, dashboard port handler, and coalescer/controller tests.

**Coverage added:** Heartbeat-only equality, meaningful-state detection, safe lightweight patch shape, and controller coalescing after state establishment.

**Source review:** Queue, timeline, and metric bounds remain unchanged. Lightweight patches contain no transcript, queue, timeline, or setup payload.

**Why this is superior:** It cuts steady-state session-storage writes and full-snapshot traffic by roughly the heartbeat frequency while preserving immediate semantic updates and restart-safe state.


## Cycle 10 - End-to-end dashboard usability and release polish

**Evidence inspected:** Dashboard visible text, session-ended lifecycle, reconnect behavior, destructive actions, keyboard commands, command-result feedback, tab accessibility, and extension validation scope.

**Issue/opportunity:** Active dashboard/status strings contained genuine mojibake. A session-ended dashboard could reconnect and present controls as usable, keyboard commands bypassed normal feedback, and destructive queue actions were not consistently confirmed.

**Classification:** Release-blocking UI correctness, accessibility, and operator-safety improvement.

**Implementation:** Normalized active visible runtime strings to ASCII-safe text, added a mojibake release guard, made session end terminal for reconnect/control state, added explicit destructive confirmations, unified keyboard and button command feedback, and exposed tab/tabpanel selection semantics.

**Files changed:** Dashboard model/controller/markup, session status, extension validator, and adjacent regression tests.

**Coverage added:** Command-result labels, terminal session-end behavior, confirmation contracts, keyboard repeat prevention, tab accessibility, and active-surface mojibake rejection.

**Source review:** The new validator scans packaged runtime surfaces but excludes tests and scripts that intentionally contain negative-test markers. No transport, provider, queue, or privacy ownership boundary changed.

**Why this is superior:** It removes a visible release defect and makes control outcomes safer and clearer without adding a second UI or runtime path.


## Reliability cycles 21-30

Each cycle was constrained to **Bug fixes**, **New features**, and **Implementation**. Regression coverage was written with the source and execution was deferred until all ten cycles were source-complete.

### Cycle 21 - Hidden Runtime Guard
- **Bug fixes:** hidden Window 2 no longer depends on background-throttled animation frames or timers; ChatGPT waits for its real enabled Send control.
- **New features:** Pilot shows visibility, submit wait reason, and the last scheduler wake source.
- **Implementation:** DOM-mutation-first provider yield with frame/timer fallbacks and content-free scheduler telemetry.

### Cycle 22 - Command Result Journal
- **Bug fixes:** a retried dashboard request now receives its original result instead of a generic duplicate acknowledgement.
- **New features:** Pilot shows the five latest commands, outcomes, durations, and replay counts.
- **Implementation:** bounded session-only command-result journal with migration from legacy processed IDs.

### Cycle 23 - Transport Circuit Guard
- **Bug fixes:** repeated unhealthy direct-port waits no longer add full timeout latency.
- **New features:** Pilot shows Direct, Fallback, Open Circuit, and Probing states with RTT.
- **Implementation:** per-role circuit state that preserves the existing one-time-message fallback.

### Cycle 24 - Lossless Batch Partitioning
- **Bug fixes:** accumulated drafts cannot grow into one impractical provider submission.
- **New features:** Pilot shows protected question count and sequential batch plan.
- **Implementation:** deterministic eight-member/approximately 12,000-character partitions without splitting, truncating, reordering, or dropping a question.

### Cycle 25 - Draft Conflict Resolver
- **Bug fixes:** a manual Window 2 edit no longer leaves delivery ambiguously deadlocked.
- **New features:** Keep Manual, Restore PMIA Draft, and Merge PMIA Below Manual.
- **Implementation:** recoverable composer ownership with explicit operator resolution and unchanged proof membership.


### Cycle 26 - Delivery SLA Guard
- **Bug fixes:** protected finals no longer remain silently stalled without bounded escalation.
- **New features:** Pilot shows oldest unresolved age, delivery target, escalation phase, and next action.
- **Implementation:** heartbeat-driven catch-up, live-check, and repair policy with answering, pause, storage, and cooldown suppression.

### Cycle 27 - Durable Recovery Scheduling
- **Bug fixes:** recovery verification and timeout no longer disappear when the Manifest V3 worker sleeps.
- **New features:** Pilot shows the next persisted recovery deadline, source, and attempt.
- **Implementation:** session-persisted `chrome.alarms`, stale-alarm rejection, success cancellation, and mutation-lane execution.

### Cycle 28 - Reload-Safe Sender Outbox
- **Bug fixes:** an unpersisted Window 1 final survives sender reload and runtime-instance replacement.
- **New features:** Pilot shows restored count, recovery source, and storage failure state.
- **Implementation:** background-authorized extension-session adapter, async rollback-safe outbox commits, ordered replay, migration, and fail-closed forwarding.

### Cycle 29 - Safe Session Termination
- **Bug fixes:** shutdown cannot delete unresolved, in-flight, or unpersisted finals without an explicit archive-and-end decision.
- **New features:** end-session safety sheet with exact counts, Export First, Archive and End, and Cancel.
- **Implementation:** authoritative outbox read, short-lived confirmation token, two-phase controller cleanup, recovery-alarm cancellation, and background AHK request.

### Cycle 30 - Active Runtime Self-Test
- **Bug fixes:** passive heartbeat and capability evidence alone can no longer produce Ready.
- **New features:** no-content Self-Test Pulse with Window 1, Window 2, storage, dashboard, RTT, and freshness results.
- **Implementation:** role command probes, storage round trip, session-only result state, Readiness Gate integration, Safe Health Report fields, and release-validator reachability.

**Source-complete status:** Cycles 21-30 are implemented. Automated and isolated-browser evidence must come from the forthcoming consolidated gate; it is not inferred from source review.

## Cycle 31 - Generation Truth Reconciler
- **Bug fixes:** stale receiver `generating` state now expires when current stop, text-growth and final-hint evidence contradict it.
- **New features:** reason-coded generation confidence and evidence timestamps.
- **Implementation:** pure generation reconciler shared by receiver answer observation and telemetry; provider adapters expose stop-control evidence.

## Cycle 32 - Explicit Answer Lifecycle
- **Bug fixes:** rendered delivery proof is no longer treated as answer completion.
- **New features:** text-free waiting, streaming, complete, no-response, timed-out and cancelled answer states.
- **Implementation:** pure answer lifecycle with session-state serialization and safe telemetry checkpoints.

## Cycle 33 - Adaptive Answer Deadlines
- **Bug fixes:** pages that never begin answering no longer hold a proven batch for the full hard timeout.
- **New features:** separate answer-start, stream-stall and hard-cap deadlines with reason codes.
- **Implementation:** evidence-driven timeout policy integrated into answer capture while retaining a 120-second cap for genuine streams.

## Cycle 34 - Delivery SLA Scope Correction
- **Bug fixes:** a proven active batch awaiting answer observation cannot trigger delivery repair for protected later finals.
- **New features:** explicit informational `answer_waiting` SLA state.
- **Implementation:** delivery policy recognizes verified active proof and answer lifecycle separately from unresolved transport failure.

## Cycle 35 - Answer-Safe Batch Advancement
- **Bug fixes:** no-response, timeout and cancellation terminal states release active batch ownership exactly once.
- **New features:** terminal answer outcome is retained beside exact delivery proof in completed-batch state.
- **Implementation:** receiver batch runtime maps terminal answer states to distinct events and advances the next protected partition deterministically.

## Cycle 36 - Repair Event Coalescing
- **Bug fixes:** repeated semantically identical repair reports no longer flood the timeline or session writes.
- **New features:** safe suppressed-transition count on the next persisted repair report.
- **Implementation:** per-session semantic repair fingerprint with a one-second cooldown; phase, checks, error and verification changes always persist.

## Cycle 37 - Registration Heartbeat Coalescing
- **Bug fixes:** routine 15-second same-instance registration no longer creates a durable registration event.
- **New features:** role registration heartbeat count, last-registration time and transition classification.
- **Implementation:** ownership, instance replacement and lease migration remain durable; same ownership updates only the in-memory Pilot cache until another semantic commit.

## Cycle 38 - Self-Test Trust Lease
- **Bug fixes:** a successful pulse is no longer reduced to a generic stale label while fresh role and direct-port evidence remains available.
- **New features:** active, evidence-fresh, stale, failed and missing verification trust states with evidence source and expiry.
- **Implementation:** pure trust model leaves the original self-test result immutable and extends trust only when both roles and the dashboard remain current.

## Cycle 39 - Readiness Evidence Fusion
- **Bug fixes:** readiness no longer raises a contradictory self-test-stale blocker when current role and transport evidence is valid.
- **New features:** readiness reports the verification evidence source and expiry.
- **Implementation:** failed active pulses remain authoritative; context, adapter, gap, outbox and storage blockers remain independent.

## Cycle 40 - Delivery and Answer Metrics Separation
- **Bug fixes:** no-response and answer timeout outcomes cannot reduce rendered delivery success.
- **New features:** completed, no-response, timed-out, cancelled and answer-availability metrics.
- **Implementation:** terminal answer outcomes deduplicate by batch ID and remain text-free in Pilot state and Safe Health reporting.

## Cycle 41 - Coherent Live Dashboard State
- **Bug fixes:** Delivery ìCaught upî no longer conflicts with a separate answer lifecycle or stale raw generation boolean.
- **New features:** independent Delivery, Answer and Verification truth rails with explicit labels, evidence and accessible live updates.
- **Implementation:** pure answer-status model, delivery-only inbox and Pace Guard state, reconciled generation display and trust-aware self-test labels.

## Cycle 42 - Recovery and SLA Controller Boundary
- **Bug fixes:** answer-state and delivery-repair ownership can no longer drift through duplicated controller helper logic.
- **New features:** one recovery coordinator owns semantic transitions, durable alarm schedules, alarm identity and duplicate-report suppression.
- **Implementation:** Runtime Pilot controller delegates repair persistence, verification/timeout scheduling, cancellation and alarm inspection while retaining routing and command ownership.
