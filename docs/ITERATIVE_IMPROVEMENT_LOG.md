# PMIA Iterative Improvement Log

This log records the ten post-implementation audit cycles required for PMIA 0.7. Executable tests remain deferred to the final consolidated gate.

## Cycle 1 â€” Launch and setup friction

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
- **Bug fixes:** Delivery �Caught up� no longer conflicts with a separate answer lifecycle or stale raw generation boolean.
- **New features:** independent Delivery, Answer and Verification truth rails with explicit labels, evidence and accessible live updates.
- **Implementation:** pure answer-status model, delivery-only inbox and Pace Guard state, reconciled generation display and trust-aware self-test labels.

## Cycle 42 - Recovery and SLA Controller Boundary
- **Bug fixes:** answer-state and delivery-repair ownership can no longer drift through duplicated controller helper logic.
- **New features:** one recovery coordinator owns semantic transitions, durable alarm schedules, alarm identity and duplicate-report suppression.
- **Implementation:** Runtime Pilot controller delegates repair persistence, verification/timeout scheduling, cancellation and alarm inspection while retaining routing and command ownership.

## Cycle 43 - Content Answer Orchestrator Boundary
- **Bug fixes:** answer cancellation, generation reconciliation and terminal reporting now have one owner instead of scattered tokens in content entry orchestration.
- **New features:** focused answer orchestrator with text-free state snapshots, one terminal callback and evidence-driven deadlines.
- **Implementation:** `entry.js` retains provider wiring and batch submission while the orchestrator owns tracker, lifecycle, generation truth, wake waits and timeout policy.

## Cycle 44 - Dashboard Rendering Boundary and Accessibility
- **Bug fixes:** truth-summary and role-health updates no longer depend on the monolithic queue/timeline renderer.
- **New features:** focused live-status and runtime-health render modules, 320 CSS-pixel reflow and print-safe ordering.
- **Implementation:** connection, commands, queue, timeline and diagnostics remain in `dashboard.js`; extracted renderers mutate only their owned IDs and expose no browser or transport APIs.

## Cycle 45 - Repeatable Isolated Release Evidence
- **Bug fixes:** browser smoke no longer depends on hand-built command lines, ambiguous profiles or manual cleanup.
- **New features:** repository-owned temporary-profile smoke for exact extension identity, managed roles, active self-test, Q1 plus accumulated Q2/Q3, rendered proof, outbox, sequence gap, answer capability and cleanup.
- **Implementation:** PowerShell owns quoted Edge isolation and process-tree cleanup; Node owns DevTools validation and structured synthetic evidence. Anonymous answer unavailability is reported separately from delivery proof.

## Cycle 46 - Versioned Transport Handshake
- **Bug fixes:** unversioned or incompatible direct-port frames now fail closed instead of entering request routing.
- **New features:** negotiated protocol version and shared capability set per role connection.
- **Implementation:** hub-issued handshake offer, role acceptance, explicit ready state, and fallback preservation.

## Cycle 47 - Session Epoch Fencing
- **Bug fixes:** replaced ports and stale responses cannot resolve current requests.
- **New features:** monotonic per-role connection epoch in direct transport state.
- **Implementation:** every request, response, validation decision, and pending correlation is epoch-bound.

## Cycle 48 - Reconnect-Safe Correlation Journal
- **Bug fixes:** late duplicate responses no longer resolve a newer request after reconnect.
- **New features:** bounded request/result journal with duplicate-response counting and safe replay.
- **Implementation:** independent inbound and outbound journals on the hub and content role port.

## Cycle 49 - Per-Final Attempt Leases
- **Bug fixes:** concurrent automatic and repair paths cannot submit one ledger final at the same time.
- **New features:** owner, reason, expiry, takeover count, and explicit release metadata per final.
- **Implementation:** the Delivery Ledger acquires leases before submitting and clears them on persisted fallback, proof, failure, or archive.

## Cycle 50 - Selective Sequence ACK and NACK
- **Bug fixes:** a receiver gap now identifies exact missing ranges instead of returning only a generic expected sequence.
- **New features:** contiguous ACK, buffered ranges, and selective NACK ranges in receiver acknowledgements.
- **Implementation:** feedback is derived from the authoritative contiguous buffer and contains no question text.

**Source-complete status:** Cycles 46-50 are implemented. Executable verification remains deferred until Cycle 70.

## Cycle 51 - Receiver Credit Backpressure
- **Bug fixes:** burst traffic cannot overflow the contiguous receiver buffer or enter an already held/conflicted batch path.
- **New features:** reason-coded available, backpressure, capacity, buffered, active, and retry-after credit state.
- **Implementation:** credits are derived at receiver admission; zero credit preserves the durable sender final and returns an ordered retry response.

## Cycle 52 - Adaptive Transport Lane Scoring
- **Bug fixes:** a slow or repeatedly failing direct port is no longer preferred merely because it remains connected.
- **New features:** safe 0-100 lane score, health state, reason, and preferred direct/fallback mode.
- **Implementation:** the port hub scores circuit, RTT, failures, and recent fallback evidence before each direct request.

## Cycle 53 - Jittered Reconnect and Half-Open Probe
- **Bug fixes:** role and dashboard reconnects no longer synchronize into fixed retry bursts.
- **New features:** bounded exponential delay, jitter, attempt count, and one half-open probe.
- **Implementation:** one reconnect policy owns both content role-port and dashboard reconnection state.

## Cycle 54 - Alarm Rehydration on Worker Start
- **Bug fixes:** missing recovery and outbox alarms are recreated after service-worker suspension; stale managed alarms are removed.
- **New features:** startup audit reports restored, unchanged, cleared, expected, and audited-at counts.
- **Implementation:** background reconstructs schedules from extension-session Pilot state and records a metadata-only audit.

## Cycle 55 - Durable Outbox Retry Intent
- **Bug fixes:** a pending retry survives content reload instead of depending on a page timer.
- **New features:** retry envelope identity, due time, attempt, reason, and alarm source in safe outbox state.
- **Implementation:** retry intent is derived from the persisted first outbox entry; the worker schedules `pmia-outbox` and routes it to the established retry command.

**Source-complete status:** Cycles 51-55 are implemented. Executable verification remains deferred until Cycle 70.

## Cycle 56 - Atomic Pilot Commit Journal
- **Bug fixes:** an interrupted multi-step session-state write is detected and rolled back to the last applied generation.
- **New features:** prepared/applied generation, state hash, recovery count, and storage audit.
- **Implementation:** Runtime Pilot Store preserves the previous applied state, writes the candidate, then marks the generation applied.

## Cycle 57 - Runtime Invariant Validator and Repair
- **Bug fixes:** deterministic duplicate ledger identities, duplicate alarm schedules, expired attempt leases, and empty-outbox retry intents are repaired at hydration.
- **New features:** metadata-only repaired and blocked findings with reason codes.
- **Implementation:** ambiguous active-batch membership is reported and preserved for operator action rather than silently changed.

## Cycle 58 - Explicit Batch Transaction State Machine
- **Bug fixes:** batch submission, proof, answer observation, terminal outcome, and release can no longer drift as unrelated booleans.
- **New features:** draft, frozen, submitting, proven, answering, terminal, and released transaction states with bounded history.
- **Implementation:** receiver batch runtime transitions one batch transaction beside the existing planner and exposes a safe snapshot.

## Cycle 59 - Provider-Aware Dynamic Batch Budgets
- **Bug fixes:** future partitions no longer use one fixed budget when provider capability or recent safe size differs.
- **New features:** provider, source, member, and character budgets with safety floors and caps.
- **Implementation:** the planner accepts a restorable budget; a single question remains indivisible.

## Cycle 60 - Deadline-Aware Batch Scheduling
- **Bug fixes:** protected partitions now expose age and urgency before delivery SLA breach.
- **New features:** normal, elevated, and critical scheduling state with a submit recommendation.
- **Implementation:** scheduling controls timing only and preserves exact ledger/member sequence; explicit hold and disabled auto-submit remain authoritative.

**Source-complete status:** Cycles 56-60 are implemented. Executable verification remains deferred until Cycle 70.

## Cycle 61 - Structural Composer Ownership Fingerprint
- **Bug fixes:** provider DOM rerenders no longer create a false manual-draft conflict when normalized composer content is unchanged.
- **New features:** text hash, length, structure hash, role, tag, and revision metadata without storing composer text in the fingerprint.
- **Implementation:** the composer arbiter adopts a new fingerprint after every owned write and conflict resolution.

## Cycle 62 - Adapter Capability Drift Detection
- **Bug fixes:** a provider surface removed after initial readiness now degrades the runtime instead of leaving a stale green capability report.
- **New features:** critical/degraded/recovering/stable drift states, removed/restored surface names, and stable recovery count.
- **Implementation:** runtime telemetry re-evaluates adapter capabilities and readiness fails closed on required-surface drift.

## Cycle 63 - Unified Page Lifecycle Coordinator
- **Bug fixes:** pageshow, pagehide, freeze, resume, online, and visibility bursts no longer create competing recovery attempts.
- **New features:** active, hidden, frozen, BFCache, and restored lifecycle phases with coalesced reasons.
- **Implementation:** runtime recovery delegates to one lifecycle coordinator and preserves background operation without focus.

## Cycle 64 - Duplicate Content Runtime Fence
- **Bug fixes:** duplicate content-script injection in one document cannot create competing observers, ports, or sender authorities.
- **New features:** document-scoped runtime generation, owner instance, acquisition result, and clean release.
- **Implementation:** startup acquires the fence before overlay and observer creation; losing instances return immediately.

## Cycle 65 - Registry Owner Election and Lease Expiry
- **Bug fixes:** stale owners can be replaced while responsive fresh owners cannot be displaced by an unrelated registration.
- **New features:** owner generation, lease expiry, deterministic election reason, renewal, and takeover evidence.
- **Implementation:** the document-fence generation travels with registration; Session Registry delegates ownership to the election policy and exposes lease state in Pilot telemetry.

**Source-complete status:** Cycles 61-65 are implemented. Executable verification remains deferred until Cycle 70.

## Cycle 66 - Recovery Budget and Escalation Control
- **Bug fixes:** repeated automatic repair can no longer thrash a degraded provider indefinitely.
- **New features:** rolling automatic-attempt allowance, exhausted state, cooldown, remaining count, and explicit manual reset.
- **Implementation:** the repair authority consumes the session budget before automatic or manual work; SLA escalation is tagged automatic and the Pilot exposes reset control.

## Cycle 67 - End-to-End Delivery Trace IDs
- **Bug fixes:** outbox, ledger, batch, proof, and answer events can now be correlated without ambiguous envelope or batch-only searches.
- **New features:** stable trace IDs and reason-coded span IDs across every mechanical stage.
- **Implementation:** envelopes receive a trace from session, envelope ID, and sequence only; Pilot records metadata-only persisted, staged, submitting, proof, and answer-terminal spans.

## Cycle 68 - Delivery SLO and Backlog Forecast
- **Bug fixes:** the operator is warned about projected backlog risk before the oldest final crosses its delivery target.
- **New features:** p50/p95 proof latency, proofs per minute, drain estimate, projected age, and clear/watch/at-risk/breached state.
- **Implementation:** the forecast is derived at snapshot time from unresolved counts and bounded timing samples only.

## Cycle 69 - Per-Final Trace Inspector and Search
- **Bug fixes:** one unresolved final no longer requires scanning the complete timeline and ledger manually.
- **New features:** search by trace ID, envelope ID, sequence, or batch ID; ordered spans and a reason-coded next action.
- **Implementation:** the Review panel contains an accessible trace list and detail view generated from safe ledger and trace metadata.

## Cycle 70 - No-Content Transport Drill and Chaos Matrix
- **Bug fixes:** handshake, direct-port, fallback, epoch, selective NACK, alarm, and invariant regressions can be detected before an interview.
- **New features:** one operator-run drill with seven structured checks, elapsed time, failed-check summary, and Safe Health Report coverage.
- **Implementation:** the controller reuses `self_test_probe`, the established one-time fallback, synthetic sequence feedback, alarm audit, and invariant audit; no prompt, answer, clipboard, or delivery state is read or mutated.

**Verified status:** Cycles 46–70 are implemented and verified on committed HEAD `6682f03`. The complete gate passed 719/719 tests and validated 244 JavaScript files, 18 required runtime surfaces, 121 reachable production modules, and both active AutoHotkey programs. The isolated Edge smoke proved three synthetic finals, exact Q2/Q3 accumulation behind Q1, an empty sender outbox, clear sequence state, all seven no-content transport-drill checks, desktop and 320 CSS-pixel Pilot reflow without horizontal overflow, and complete process/profile cleanup. Normal Edge remained unchanged. The technical HTML remains deferred until the requested Cycles 71–95 mechanics phase is complete.


## Cycle 71 - Versioned Runtime State Envelope
- **Bug fixes:** extension upgrades no longer depend on an unversioned session array whose shape cannot be distinguished from future state.
- **New features:** schema version, writer version, commit time, and immutable session records in one runtime envelope.
- **Implementation:** Runtime Pilot Store reads legacy arrays as schema 1 and writes schema 2 while the commit journal remains state-shape agnostic.

## Cycle 72 - Ordered Runtime State Migrations
- **Bug fixes:** future or unsupported state cannot be partially interpreted and overwritten by an older runtime.
- **New features:** explicit one-way migration registry, applied migration path, idempotent current-schema handling, and reason-coded missing steps.
- **Implementation:** migration runs before invariant hydration; schema 1 upgrades to schema 2 and future schemas fail closed.

## Cycle 73 - Last-Known-Good State Quarantine
- **Bug fixes:** repeated startup retries can no longer replace the first ambiguous blocked snapshot or silently activate it.
- **New features:** one bounded session-only quarantine record with reason, schema, writer, timestamp, and byte count.
- **Implementation:** invalid, future, or invariant-blocked state is cloned once into `chrome.storage.session`; audits expose metadata only.

## Cycle 74 - State Integrity Digest and Recovery
- **Bug fixes:** corrupted current state is detected before hydration instead of failing later as unrelated ledger or batch symptoms.
- **New features:** canonical digest, explicit verified/sealed/recovered/blocked integrity states, and last-applied recovery.
- **Implementation:** envelopes are sealed on save; digest mismatch recovers a valid previous generation or quarantines and blocks when both fail.

## Cycle 75 - State Compatibility Operator Surface
- **Bug fixes:** blocked store hydration no longer leaves Runtime Pilot indefinitely at Connecting with no owning reason.
- **New features:** State Compatibility card and Safe Health Report section for schema path, integrity, quarantine presence, and next action.
- **Implementation:** the controller emits a metadata-only blocked snapshot; the dashboard derives compatible, migrated, recovered, or blocked state without state payloads.

**Block A verification:** 81/81 focused integration tests passed across schema, migrations, quarantine, integrity, store, invariants, compatibility, dashboard, health report, and controller. HTML atlas remains deferred.


## Cycle 76 - Ledger Identity Indexes
- **Bug fixes:** ledger ID and provider-sequence duplicate checks no longer rescan the complete ordered ledger on every final or lease operation.
- **New features:** exact ID and provider-sequence maps with deterministic rebuild statistics.
- **Implementation:** persist, get, lease acquire/release, targeted ID transitions, and compaction removal use maintained indexes while the ordered array remains the sole export/proof order.

## Cycle 77 - Batch and State Ledger Indexes
- **Bug fixes:** batch proof, state counts, and batch transitions no longer depend on repeated whole-ledger scans or duplicated audit logic.
- **New features:** batch/state membership sets, indexed counts, transition-aware updates, and deterministic mismatch audit/rebuild.
- **Implementation:** every accepted state/batch transition updates the index atomically; `ledger-index-audit` is the production audit owner.

## Cycle 78 - Indexed Rendered Proof Reconciliation
- **Bug fixes:** reconciliation no longer performs a nested pending-batch by rendered-message scan during restart or repair.
- **New features:** one-pass rendered-user index with exact fingerprints, token shingles, query statistics, and collision rejection.
- **Implementation:** candidates are indexed once per reconcile call and still pass the existing strict rendered-batch matcher before proof acceptance.

## Cycle 79 - Starvation-Free Delivery Deadlines
- **Bug fixes:** protected partitions now expose deterministic deadlines and cannot remain indefinitely invisible behind normal urgency.
- **New features:** stable deadline, age, urgency, selected partition, and reason-coded blockers.
- **Implementation:** sequence remains the primary order, `BatchPlanner` still freezes the first protected partition, and hold/active answer/auto-submit/draft conflict remain authoritative.

## Cycle 80 - Receiver Credit Hysteresis
- **Bug fixes:** short receiver bursts no longer make credits oscillate between available and backpressure, and follow-up branches now normalize `capacity` consistently.
- **New features:** immediate drop, stable recovery window, critical state, raw credit evidence, and precise retry-after metadata.
- **Implementation:** one receiver-local hysteresis owner wraps every credit response without changing selective ACK/NACK identity.

**Block B verification:** 116/116 focused integration tests passed across ledger indexes, proof reconciliation, batch planning, deadlines, sequence buffering, burst safety, flow control, and production validation. HTML atlas remains deferred.


## Cycle 81 - Canonical Semantic Fingerprints
- **Bug fixes:** object key order and nested volatile heartbeat fields no longer create false semantic changes.
- **New features:** deterministic Unicode-safe fingerprints, recursive omission rules, array-order preservation, and explicit cycle rejection.
- **Implementation:** snapshot deltas and telemetry coalescing now share one canonical fingerprint owner.

## Cycle 82 - Structural Snapshot Section Cache
- **Bug fixes:** Runtime Pilot no longer reclones every top-level section on every semantic update.
- **New features:** per-session section fingerprints, unchanged-reference reuse, changed/removed key evidence, and clean reset.
- **Implementation:** the controller caches immutable section clones at the broadcast boundary and clears them on both session-end paths.

## Cycle 83 - Cached Ledger Views
- **Bug fixes:** unresolved, pending, proven, archived, and failed views no longer refilter and resort the ledger on every read.
- **New features:** ordered clone-safe view caches, hit/miss/invalidations metrics, and transition-scoped invalidation.
- **Implementation:** cached ID lists are maintained by the existing ledger index and resolved through exact indexed entries.

## Cycle 84 - Persistence Urgency Policy
- **Bug fixes:** independent preview and batch timers no longer compete or create duplicate safe writes.
- **New features:** immediate/coalesced/heartbeat classification, one timer per session, merged commit reasons, flush, and cancel.
- **Implementation:** preview and batch checkpoints share one mutation-coordinated lane; final ownership, proof, storage pressure, commands, and shutdown remain immediate.

## Cycle 85 - Runtime Performance Budget
- **Bug fixes:** performance regressions can now be identified by deterministic operation and payload budgets instead of anecdotal timing.
- **New features:** operation counts, payload bytes, cache efficiency, commit reasons, bounded violations, Pilot card, and Safe Health Report data.
- **Implementation:** commit metrics persist in session state while snapshot-cache counters remain controller-local and are injected without mutating state during broadcast.

**Block C verification:** 97/97 focused integration tests passed across canonical fingerprints, snapshot deltas, telemetry, section reuse, cached ledger views, persistence lanes, Pilot state/controller, dashboard, health report, and performance budgets. HTML atlas remains deferred.


## Cycle 86 - Provider Capability Probation
- **Bug fixes:** one transient provider-surface miss no longer disables delivery, while repeated missing required surfaces cannot remain falsely writable.
- **New features:** probation, blocked, recovering, and healthy states with stable-sample counters and reason-coded evidence.
- **Implementation:** content telemetry owns a hysteresis-based capability probation state and readiness fails closed only after the configured critical threshold.

## Cycle 87 - Deterministic Runtime Root Cause
- **Bug fixes:** storage, registration, transport, provider, sequence, batch, and proof symptoms no longer trigger unrelated competing repairs.
- **New features:** one primary owner, severity, evidence, next action, and a suppressed-symptom list.
- **Implementation:** a pure precedence classifier is shared by readiness, recovery, support export, and Safe Health reporting.

## Cycle 88 - Cause-Driven Recovery Escalation
- **Bug fixes:** repair no longer reloads every role for a single-owner failure or consumes automatic budget on non-repairable conditions.
- **New features:** reconcile, reconnect, re-register, managed reload, queue-only, and operator-handoff actions selected from one cause.
- **Implementation:** the existing repair authority delegates action choice to one bounded policy while preserving active-answer safety and recovery budgets.

## Cycle 89 - Queue-Only Degraded Delivery
- **Bug fixes:** finals are no longer written into an unhealthy provider composer during storage, compatibility, registration, or provider-capability failure.
- **New features:** visible protected-delivery mode with reason, resume condition, and one-click recheck.
- **Implementation:** persistence remains active, provider writes are blocked at forward, reconciliation, manual submit, batching, and SLA escalation boundaries, and the mode clears only after the underlying blocker clears.

## Cycle 90 - Runtime Consistency Watchdog
- **Bug fixes:** missing alarms, stale indexes, expired attempt leases, and registry/Pilot drift no longer remain silent until delivery fails.
- **New features:** metadata-only consistency result with deterministic repair instructions and blocked ambiguity reporting.
- **Implementation:** semantic commits, worker startup, and alarm wake use the same audit owner; safe repairs are automatic and ambiguous batch membership fails closed.

## Cycles 86-95: runtime safety and release evidence

### Cycle 86 - Provider capability probation
- **Bug fix:** transient provider DOM loss no longer immediately disables the runtime or permits unsafe writes after repeated loss.
- **New feature:** readiness and support evidence expose healthy, probation, blocked, and recovering capability states.
- **Implementation:** capability hysteresis is metadata-only and blocks provider writes only after the configured critical threshold.

### Cycle 87 - One runtime root cause
- **Bug fix:** secondary warnings no longer compete as independent repair triggers.
- **New feature:** the Pilot readiness summary names the primary cause while preserving suppressed evidence.
- **Implementation:** a deterministic precedence classifier owns state, storage, registration, transport, provider, sequence, batch, and proof causes.

### Cycle 88 - Cause-driven recovery
- **Bug fix:** broad repair loops no longer reload both roles for unrelated failures.
- **New feature:** repair reports expose the selected action and reason.
- **Implementation:** recovery chooses exactly one bounded action: reconcile, reconnect, re-register, managed reload, queue-only, or operator handoff.

### Cycle 89 - Queue-only degraded mode
- **Bug fix:** unsafe provider state no longer blocks Window 1 persistence or allows Window 2 mutation.
- **New feature:** a visible protected-delivery banner explains why writes are blocked and when they resume.
- **Implementation:** queue-only is separate from manual Hold, survives receiver reload, and clears after compatibility and capabilities recover.

### Cycle 90 - Consistency watchdog
- **Bug fix:** stale indexes, expired attempt leases, and missing managed alarms are detected and safely repaired.
- **New feature:** Safe Health Report includes the latest consistency result.
- **Implementation:** audits run on startup, alarm wake, and semantic commits, never by polling provider content.

## Cycle 91 - Deterministic Fault Scenario Harness
- **Bug fixes:** fault-path validation no longer depends on ad hoc scripts with inconsistent cleanup or evidence shapes.
- **New features:** ordered scenario steps, before/after metadata, first-failure location, and guaranteed cleanup.
- **Implementation:** the harness lives under the test-only import boundary and strips question, answer, setup, clipboard, credential, and token fields from evidence.

## Cycle 92 - Restart Continuity Proof
- **Bug fixes:** worker restart can no longer be considered safe without proving ledger order, batch membership, owner identity, outbox order, alarms, and index integrity.
- **New features:** deterministic before/after continuity checks for every persisted mechanical owner.
- **Implementation:** the scenario reconstructs Runtime Pilot State and Session Registry from exported state and reports exact failing invariants without provider content.

## Cycle 93 - Expanded No-Content Chaos Drill
- **Bug fixes:** state compatibility, ledger indexes, capability probation, queue-only policy, and restart continuity can no longer regress outside the operator drill.
- **New features:** twelve structured no-content checks instead of seven, with isolated-smoke enforcement.
- **Implementation:** the drill reuses existing self-test, fallback, sequence, alarm, state, index, policy, and continuity owners and never reads prompt or answer content.

## Cycle 94 - Privacy-Safe Support Bundle
- **Bug fixes:** support evidence no longer requires copying raw diagnostics or exposing provider URLs and conversation content.
- **New features:** one-click JSON export containing version, reason-coded state, role health, transport metadata, ledger identities, audits, performance, drill results, and source hashes.
- **Implementation:** a pure allow-list builder excludes questions, answers, setup context, clipboard data, credentials, and raw URLs; the Pilot downloads the result locally.

## Cycle 95 - Commit-Bound Release Evidence Manifest
- **Bug fixes:** a passing test log and browser smoke can no longer be attached to a different source commit or incomplete cleanup result.
- **New features:** deterministic SHA-256 source inventory, gate counts, smoke outcomes, cleanup evidence, and one manifest hash.
- **Implementation:** the validator optionally generates the evidence manifest only when gate log, isolated-smoke evidence, and output path are supplied together.

**Source-complete status:** Cycles 86-95 are implemented. Executable verification remains deferred until the complete requested development program is finished. The HTML atlas remains untouched.

### Cycle 91 - Test-only fault scenario harness
- **Bug fix:** fault experiments can no longer leak into production entry points or leave cleanup ambiguous.
- **New feature:** named metadata-only scenarios capture ordered before/result/after evidence.
- **Implementation:** the validator rejects any production import of `runtime/extension/testing`.

### Cycle 92 - Restart continuity proof
- **Bug fix:** restart validation now checks ledger order, active/next batch membership, outbox intent, owner generations, alarms, and index integrity together.
- **New feature:** one deterministic restart report identifies the exact failed continuity check.
- **Implementation:** the scenario reconstructs Pilot state and registry owners only from serialized session data.

### Cycle 93 - Expanded no-content drill
- **Bug fix:** the previous seven-check drill did not exercise compatibility, indexes, probation, queue-only policy, or restart continuity.
- **New feature:** the Pilot drill now reports twelve ordered control-plane checks.
- **Implementation:** all drill evidence is reason-coded metadata and explicitly records `contentAccessed: false`.

### Cycle 94 - Safe support bundle
- **Bug fix:** support collection no longer depends on screenshots, raw URLs, prompts, answers, setup context, or credentials.
- **New feature:** Review can download one metadata-only JSON bundle with runtime, compatibility, root cause, lanes, audits, trace IDs, budgets, and drill results.
- **Implementation:** caller-supplied fields are stripped; source hashes remain exclusive to release evidence.

### Cycle 95 - Deterministic release evidence
- **Bug fix:** release claims can no longer mix a gate, smoke, or cleanup result from another commit.
- **New feature:** the final validator can emit one commit-bound evidence manifest.
- **Implementation:** sorted source SHA-256 hashes, gate counts, smoke proof, cleanup state, and a deterministic manifest hash form the release identity.

**Development status:** source and regression contracts complete. Executable block and repository gates remain deferred until all later development cycles are source-complete.


## Cycle 96 - Explicit Interview Phase State
- **Bug fixes:** interview mode is no longer inferred from transport pause, answer state, or scattered readiness flags.
- **New features:** Setup, Ready, Active, Paused, Debrief, and Ended phases with transition history.
- **Implementation:** one normalized `liveSession` section owns phase and clock metadata; partial updates merge without resetting phase.

## Cycle 97 - Ordered Interview Runbook
- **Bug fixes:** preflight blockers are no longer distributed across unrelated cards with no owning order.
- **New features:** seven-step runbook with completion count, next incomplete step, and exact action.
- **Implementation:** a pure runbook model derives role, composer, capability, context, self-test, storage, and delivery prerequisites.

## Cycle 98 - Start Mock Orchestration
- **Bug fixes:** a session cannot start while prerequisites are missing or forwarding is paused.
- **New features:** one Start mock action that verifies the runbook, enters Ready, starts the clock, enters Active, and resumes both roles.
- **Implementation:** the controller performs one mutation-coordinated command through the existing role command path.

## Cycle 99 - Session and Segment Clock
- **Bug fixes:** elapsed time no longer advances while the mock is paused, and segment timing is no longer detached from session timing.
- **New features:** session elapsed, planned duration, segment elapsed, and remaining time.
- **Implementation:** pure pause/resume clock transforms adjust accumulated pause and segment origin deterministically.

## Cycle 100 - Interviewer Silence Distinction
- **Bug fixes:** interviewer pauses are no longer conflated with sender capture failure or disconnected telemetry.
- **New features:** recent activity, quiet, long silence, inactive, and capture-issue states.
- **Implementation:** the silence model uses explicit interviewer activity plus capture health and never treats missing capture as human silence.

## Cycle 101 - Current Attention Target
- **Bug fixes:** the operator no longer has to infer urgency from warning count or card color.
- **New features:** one ranked attention target with reason, severity, action, evidence, and three secondary signals.
- **Implementation:** a pure priority model ranks root cause, protected delivery, draft conflict, waiting questions, answer failure, and setup state.

## Cycle 102 - Next-Best Action
- **Bug fixes:** a warning no longer leaves the operator to map a reason code to a command manually.
- **New features:** one context-aware recommended command and human-readable label.
- **Implementation:** the action model combines attention ownership and runbook readiness without executing anything automatically.

## Cycle 103 - Searchable Command Palette
- **Bug fixes:** pressure-time actions no longer require scanning a large fixed control grid.
- **New features:** Ctrl/Cmd+K search, ranked results, availability, risk preview, recent commands, and Enter execution.
- **Implementation:** one centralized command catalog supplies labels, groups, shortcuts, risk, preconditions, and blocked reasons.

## Cycle 104 - Roving Keyboard Navigation
- **Bug fixes:** repeated Tab presses no longer traverse every phase and toolbar control.
- **New features:** arrow, Home, and End navigation with one toolbar tab stop and focus return from the palette.
- **Implementation:** a reusable roving-tabindex owner manages visible enabled controls and the command dialog traps focus while open.

## Cycle 105 - Compact Focus Mode
- **Bug fixes:** diagnostic and setup controls no longer dominate the screen during an active question.
- **New features:** explicit Focus mode retaining phase, clock, delivery, current answer, next draft, and attention state.
- **Implementation:** one persisted preference drives a CSS-only projection; hidden diagnostic state remains connected and unchanged.

**Source-complete status:** Cycles 96-105 are implemented. Executable verification remains deferred until the complete Phase A source program is finished.


## Cycle 106 - Question Navigator
- **Bug fixes:** live question handling no longer depends on a flat ledger table with mixed delivery states.
- **New features:** Current, Waiting, Delivered, and Archived groups with counts and one selected question.
- **Implementation:** a projection groups immutable ledger entries without changing sequence or delivery order.

## Cycle 107 - Pinned Questions
- **Bug fixes:** important questions no longer disappear visually inside long sessions.
- **New features:** pin and unpin metadata with a visible row rail and Pinned-only filter.
- **Implementation:** pin state is a bounded operator metadata overlay keyed by ledger ID.

## Cycle 108 - Explicit Deferral
- **Bug fixes:** delaying a question no longer requires archiving or losing its delivery state.
- **New features:** defer until current answer completes, manual resume, or a bounded time.
- **Implementation:** defer readiness is advisory metadata; the canonical ledger and provider sequence remain unchanged.

## Cycle 109 - Priority Bands
- **Bug fixes:** waiting questions no longer appear equally urgent during a fast interview.
- **New features:** Low, Normal, High, and Critical priority metadata and filtering.
- **Implementation:** priority is an operator-facing overlay only and never participates in delivery sorting.

## Cycle 110 - Follow-up Relationships
- **Bug fixes:** follow-up questions no longer lose their link to the earlier discussion.
- **New features:** parent/follow-up relationship with inspector visibility.
- **Implementation:** relationships require another existing ledger ID, reject self-links, and remain reversible metadata.

## Cycle 111 - Duplicate Explanation
- **Bug fixes:** duplicate suppression is no longer visible only as a metric count.
- **New features:** retained identity, reason, occurrence count, and last duplicate event in the inspector.
- **Implementation:** a metadata-only timeline index explains duplicate decisions without creating duplicate ledger rows.

## Cycle 112 - Canonical Question Status
- **Bug fixes:** the Inbox, active batch, and inspector no longer derive different labels for the same ledger entry.
- **New features:** Current answer, Next batch, Waiting, Submitting, Delivered, Needs attention, and Archived labels.
- **Implementation:** one status model maps ledger and batch state to group, label, and actionability.

## Cycle 113 - Indexed Question Search
- **Bug fixes:** large sessions no longer require linear visual scanning for a question.
- **New features:** search by question text, ledger ID, sequence, batch, state, priority, pin, defer, and parent.
- **Implementation:** a reusable normalized query index applies search and filters without modifying source entries.

## Cycle 114 - Detailed Question Inspector
- **Bug fixes:** selecting a row no longer exposes only submit/archive controls.
- **New features:** exact status, trace, duplicate history, relationship, priority, defer state, and question text.
- **Implementation:** the inspector is a pure projection from the selected question and existing trace metadata.

## Cycle 115 - Bounded Metadata Undo
- **Bug fixes:** an accidental pin, priority, defer, or relationship change no longer requires manual reconstruction.
- **New features:** one-use five-minute undo with visible last action.
- **Implementation:** a 32-entry metadata-only undo journal stores before/after operator state and never stores question text.

**Source-complete status:** Cycles 106-115 are implemented. Executable verification remains deferred until the complete Phase A source program is finished.

## Live interview UX cycles 106–115

### Cycle 106 — Incident Center
- **Bug fixes:** warnings, root cause, and consistency failures no longer require three separate inspections.
- **New features:** one severity-ordered incident inbox with owner, role, age, and current action.
- **Implementation:** current evidence is projected into a bounded incident model; no parallel warning authority or transcript copy is created.

### Cycle 107 — Incident Acknowledge and Snooze
- **Bug fixes:** known incidents no longer obscure new failures, and escalation reopens an acknowledged incident.
- **New features:** acknowledge, five-minute snooze, clear, occurrence count, and first/last-seen metadata.
- **Implementation:** only bounded control metadata is persisted in the versioned session state.

### Cycle 108 — Incident Severity and Ownership
- **Bug fixes:** generic warnings no longer hide the responsible subsystem.
- **New features:** deterministic Info, Warning, Error, and Critical severity with Runtime, Provider, Transport, State, Delivery, or Operator ownership.
- **Implementation:** a stable severity lattice orders incidents without mutating source warnings.

### Cycle 109 — Incident Runbooks
- **Bug fixes:** an incident code no longer leaves the operator to infer a recovery sequence.
- **New features:** one current safe step and ordered runbook per incident class.
- **Implementation:** runbook steps reuse existing allow-listed commands and never execute during derivation.

### Cycle 110 — Quiet Attention Mode
- **Bug fixes:** acknowledged low-priority incidents no longer distract during a live answer.
- **New features:** quiet mode keeps critical incidents and unacknowledged actionable incidents visible.
- **Implementation:** quiet mode filters presentation only; all incident evidence remains available and escalation always reopens visibility.

### Cycle 111 — Question Triage States
- **Bug fixes:** every captured final no longer appears equally urgent.
- **New features:** pin, Low/Normal/High/Critical priority, and explicit defer conditions.
- **Implementation:** operator metadata is stored beside immutable ledger identity with a bounded single-use undo journal.

### Cycle 112 — Duplicate and Follow-up Linking
- **Bug fixes:** repeated-question evidence and follow-up relationships no longer require manual timeline inspection.
- **New features:** duplicate explanation and explicit follow-up-to-parent relationships.
- **Implementation:** relationship validation rejects missing parents, self-links, and cycles; no final is auto-deleted or merged.

### Cycle 113 — Exact Batch Preview
- **Bug fixes:** the operator no longer submits a protected batch without knowing exact membership.
- **New features:** current/next member IDs, counts, characters, latest member, provider budget, hold, and auto-submit state.
- **Implementation:** the preview is derived from immutable planner membership and ledger identity.

### Cycle 114 — Safe Queue Search and Filters
- **Bug fixes:** long sessions no longer require scanning every ledger row.
- **New features:** search by question text, ID, sequence, batch, state, priority, pinned, and actionable status.
- **Implementation:** the text-bearing search index exists only in dashboard memory; no second durable transcript copy is created.

### Cycle 115 — Priority Without Reordering
- **Bug fixes:** visual urgency can no longer be confused with delivery order changes.
- **New features:** pinned, due, and priority emphasis in the queue and inspector.
- **Implementation:** emphasis decorates the original sequence and explicitly reports sequence preservation.

## Live interview UX cycles 116–120

### Cycle 116 — Operator Markers
- **Bug fixes:** important interview moments no longer require transcript notes or memory.
- **New features:** bounded Follow-up, Strong answer, Weak answer, Needs review, Metric gap, and Execution gap markers.
- **Implementation:** markers reference only session, envelope, batch, or trace identity and never copy prompt or answer text.

### Cycle 117 — Interviewer Activity Markers
- **Bug fixes:** question arrival, answer boundaries, silence changes, and recovery transitions no longer disappear inside generic telemetry.
- **New features:** automatic safe activity landmarks reconstructed from existing timeline metadata.
- **Implementation:** semantic event/category/identity fingerprints deduplicate activity without adding storage writes.

### Cycle 118 — Phase Checkpoints and Resume
- **Bug fixes:** reload or recovery no longer leaves the operator unsure which phase, clock, or protected batch to resume.
- **New features:** one compact last-safe checkpoint with phase, mode, clock, active/next batch identity, and unresolved count.
- **Implementation:** semantic commits refresh one session-only checkpoint; preview and transient batch commits are excluded.

### Cycle 119 — Interruption Recovery Card
- **Bug fixes:** a live interruption no longer requires disconnected checks across readiness, self-test, repair, and resume.
- **New features:** one recovery card with retained-final count, checkpoint age, ordered steps, and one current safe action.
- **Implementation:** the card is a pure projection over checkpoint, lifecycle, delivery policy, role, and verification evidence.

### Cycle 120 — Session Timeline Landmarks
- **Bug fixes:** the operational timeline no longer hides interview-oriented review points.
- **New features:** merged phase, question, answer, incident, recovery, and operator marker landmarks.
- **Implementation:** bounded metadata landmarks are sorted by timestamp while the existing virtualized timeline remains authoritative.

## Live interview UX cycles 121–125

### Cycle 121 — Managed Window Navigator
- **Bug fixes:** switching among Window 1, Window 2, and Runtime Pilot no longer depends on blind Alt+Tab order.
- **New features:** explicit Focus Window 1, Focus Window 2, Focus Pilot, and Back commands.
- **Implementation:** every target is resolved from current Session Registry ownership before the existing windows API is used.

### Cycle 122 — Live Layout Presets
- **Bug fixes:** manual resizing no longer blocks setup or recovery.
- **New features:** three-window, Window 1 spotlight, Window 2 spotlight, and Pilot spotlight layouts.
- **Implementation:** presets reuse the existing non-focused layout owner and session-scoped geometry state.

### Cycle 123 — Role Spotlight
- **Bug fixes:** the operator no longer needs separate resize and focus actions to inspect one role.
- **New features:** one-command spotlight for Window 1, Window 2, or Runtime Pilot.
- **Implementation:** spotlight applies the existing safe layout first, then performs one validated focus action.

### Cycle 124 — Focus History and Back
- **Bug fixes:** returning from a spotlight no longer requires reconstructing the previous view manually.
- **New features:** bounded managed-layout/focus history and Back to Previous View.
- **Implementation:** only mode, focused role, and timestamp are retained; the history is capped at twelve entries.

### Cycle 125 — User-Gesture Focus Safety
- **Bug fixes:** delayed or replayed focus commands can no longer steal focus after the user’s intent has expired.
- **New features:** one-use focus-intent tokens bound to session, target, action, issue time, and expiry.
- **Implementation:** the only new `focused: true` update is guarded by intent validation and one-use consumption; recovery remains non-focused.

## Receiver-flow mechanics companion improvements

- **Bug fixes:** answer completion no longer always releases the next batch; no-response no longer silently falls through; interrupt cannot execute without a fresh exact-member preview token.
- **New features:** pause-after-answer, drain one/all, submit-on-idle, answer acknowledgement, no-response wait/retry/continue, deadline view, interrupt preview, and compact answer handoff.
- **Implementation:** one receiver delivery-policy owner and one metadata-only answer-operations module extend the existing batch runtime; ledger order and rendered proof remain authoritative.

**Source-complete status:** Receiver-flow mechanics and managed-window navigation are implemented. Executable verification remains deferred until Cycle 145 source completion.

## Live interview UX cycles 126–130

### Cycle 126 — Remappable Shortcut Safety
- **Bug fixes:** fixed-key handlers no longer hide collisions or allow unsafe destructive single-key bindings.
- **New features:** session-scoped shortcut bindings with conflict, reserved-key, and destructive-action validation.
- **Implementation:** one canonical chord parser and command resolver owns keyboard dispatch.

### Cycle 127 — Grouped Shortcut Help
- **Bug fixes:** the footer key paragraph no longer serves as the only keyboard reference.
- **New features:** searchable/grouped keyboard help organized by Delivery, Recovery, Provider, Review, and Navigation.
- **Implementation:** help rows derive from the active binding map and command catalog.

### Cycle 128 — Accessible Visual Preferences
- **Bug fixes:** motion, text scale, and contrast no longer depend only on browser defaults or ad hoc CSS.
- **New features:** System/Reduced/Full motion, Normal/Large text, and Normal/High contrast controls.
- **Implementation:** one versioned session preference owner drives document data attributes and print-safe CSS.

### Cycle 129 — Bounded Live Announcements
- **Bug fixes:** important command outcomes no longer rely only on visual toast content.
- **New features:** polite and assertive live regions with repeated-message suppression.
- **Implementation:** one announcer routes severity-aware status without duplicating timeline evidence.

### Cycle 130 — Unified Dialog Focus
- **Bug fixes:** modal focus containment is no longer implemented separately for each dialog.
- **New features:** Escape close, circular Tab/Shift+Tab, first-control focus, and trigger restoration.
- **Implementation:** one focus coordinator owns the command palette and shortcut-help dialog contract.

**Source-complete status:** Cycles 126–130 are implemented. Executable verification remains deferred until Cycle 145 source completion.

## Live interview UX cycles 131–135

### Cycle 131 — Guided Preflight
- **Bug fixes:** starting no longer depends on interpreting independent readiness cards.
- **New features:** an ordered seven-check preflight with the exact current blocker and safe action.
- **Implementation:** a pure wizard projection reuses role, adapter, context, self-test, storage, sequence, and dashboard evidence.

### Cycle 132 — Resume Guard
- **Bug fixes:** resume no longer bypasses storage, sequence, outbox, self-test, or draft-conflict blockers.
- **New features:** one Resume safely decision with explicit blocker codes.
- **Implementation:** one guard validates the boundary before phase or provider state changes.

### Cycle 133 — Explicit Resume Boundary
- **Bug fixes:** checkpoint restoration no longer mutates phase before runtime safety is proven.
- **New features:** guarded active/paused/debrief restoration with retained-final count.
- **Implementation:** the existing checkpoint and role-resume owners remain authoritative.

### Cycle 134 — Crash Resume Card
- **Bug fixes:** service-worker or managed-role interruption no longer leaves a silent resumable session.
- **New features:** checkpoint age, retained-final count, Resume safely, and Dismiss.
- **Implementation:** visibility derives from checkpoint generation, interruption state, and bounded dismissal metadata.

### Cycle 135 — Live Session End Boundary
- **Bug fixes:** a clean ledger can no longer end an Active or Paused mock accidentally.
- **New features:** end-session summary includes live phase as an explicit blocker.
- **Implementation:** the existing tokenized two-phase end guard now includes the live-session phase.

**Source-complete status:** Cycles 131–135 are implemented. Executable verification remains deferred until Cycle 145 source completion.

## Live interview UX cycles 136–140

### Cycle 136 — Operational Event Filters
- **Bug fixes:** review no longer mixes every heartbeat, control, answer, recovery, and delivery event in one undifferentiated stream.
- **New features:** Delivery, Answer, Recovery, Operator, and System filters with severity and text search.
- **Implementation:** one pure classifier decorates bounded timeline events without changing the source log.

### Cycle 137 — Plain-Language Trace Explanation
- **Bug fixes:** raw per-final spans no longer require knowledge of internal stage names.
- **New features:** ordered explanations from observation through rendered proof and answer terminal state.
- **Implementation:** trace explanation is a presentation projection over existing immutable spans.

### Cycle 138 — SLO History and Trend
- **Bug fixes:** delivery health no longer depends only on the latest point-in-time forecast.
- **New features:** bounded trend, breach streak, p50/p95, backlog slope, and drain estimate.
- **Implementation:** semantically identical samples coalesce and the history is capped at 120 entries.

### Cycle 139 — Stabilization Runbook
- **Bug fixes:** complex degraded sessions no longer require guessing the safe repair sequence.
- **New features:** one verified step at a time across self-test, live check, consistency, reconciliation, repair, and final verification.
- **Implementation:** the runbook reuses existing allow-listed command owners and persists metadata only.

### Cycle 140 — Performance Health
- **Bug fixes:** harmless background cost is no longer reported as equivalent to delivery-impacting degradation.
- **New features:** user-impact classification across storage, commit wait, cache efficiency, transport RTT, and delivery SLO.
- **Implementation:** one pure health model produces reason-coded watch/degraded states and a safe recommendation.

**Source-complete status:** Cycles 136–140 are implemented. Executable verification remains deferred until Cycle 145 source completion.

## Live interview UX cycles 141–145

### Cycle 141 — Indexed Command Search
- **Bug fixes:** command-palette search no longer rescans and normalizes the full catalog on every keystroke.
- **New features:** deterministic relevance-ranked command results.
- **Implementation:** one reusable normalized index is cached with palette state.

### Cycle 142 — Bounded Virtual Lists
- **Bug fixes:** long Inbox and review collections no longer require rendering every row.
- **New features:** exact visible ranges with top/bottom spacer metadata.
- **Implementation:** one pure virtual-list model bounds DOM work without truncating source collections.

### Cycle 143 — Coalesced Render Scheduler
- **Bug fixes:** multiple transport updates in one frame no longer trigger repeated full render passes.
- **New features:** semantic-section render batching.
- **Implementation:** one animation-frame scheduler merges changed sections and preserves synchronous user navigation.

### Cycle 144 — Idle Work Coordinator
- **Bug fixes:** noncritical index and review rebuilds no longer compete with live delivery rendering.
- **New features:** bounded idle-only background work with cancellation.
- **Implementation:** one queue uses idle callbacks with a timer fallback and never owns authoritative state.

### Cycle 145 — Live UX Memory Budget
- **Bug fixes:** search, timeline, traces, queue rows, and idle work no longer grow without an explicit cockpit budget.
- **New features:** exact usage, breach, and safe-action reporting in Review.
- **Implementation:** one budget model bounds presentation collections while the complete ledger remains authoritative.

**Source-complete status:** Cycles 96–145 are implemented. The deferred Phase A executable gate is now required before hardening work proceeds.
