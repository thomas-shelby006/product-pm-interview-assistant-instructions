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
