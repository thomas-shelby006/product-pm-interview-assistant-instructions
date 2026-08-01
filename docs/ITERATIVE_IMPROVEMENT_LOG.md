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
