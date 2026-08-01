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
