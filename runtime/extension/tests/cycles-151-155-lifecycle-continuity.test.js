import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRestartContinuity, evaluateRestartContinuity } from '../shared/restart-continuity.js';
import { monotonicElapsed, pauseMonotonicClock, reanchorMonotonicClock, resumeMonotonicClock } from '../shared/monotonic-session-clock.js';
import { restoreManagedLayout, restoreWindowBounds } from '../shared/layout-restoration.js';

test('Cycles 151-152: restart continuity preserves owner generation and unresolved counts', () => {
  const before = buildRestartContinuity({ sessionId: 's1', registryGeneration: 4, ledgerCounts: { pending: 2 }, senderOutboxState: { count: 1 }, liveSession: { phase: 'active' } }, 10);
  const after = buildRestartContinuity({ sessionId: 's1', registryGeneration: 4, ledgerCounts: { pending: 2 }, senderOutboxState: { count: 1 }, liveSession: { phase: 'active' } }, 20);
  assert.equal(evaluateRestartContinuity(before, after).ok, true);
  assert.equal(evaluateRestartContinuity(before, { ...after, generation: 3 }).issues.includes('generation_regressed'), true);
});

test('Cycle 153: monotonic clock never moves backwards through pause and reanchor', () => {
  let clock = reanchorMonotonicClock({}, { wallNow: 1000, monoNow: 100, generation: 1 });
  assert.equal(monotonicElapsed(clock, 150), 50);
  clock = pauseMonotonicClock(clock, 160);
  assert.equal(monotonicElapsed(clock, 500), 60);
  clock = resumeMonotonicClock(clock, 500);
  assert.equal(monotonicElapsed(clock, 520), 80);
  assert.equal(reanchorMonotonicClock(clock, { wallNow: 2000, monoNow: 10, generation: 2 }).elapsedBeforeAnchor, 60);
});

test('Cycles 154-155: layout restoration clamps to display and never focuses windows', () => {
  const bounds = restoreWindowBounds({ left: -9999, top: 9999, width: 5000, height: 5000 }, { left: 0, top: 0, width: 1920, height: 1080 });
  assert.deepEqual(bounds, { left: 0, top: 0, width: 1920, height: 1080, focused: false, state: 'normal' });
  const restored = restoreManagedLayout({ mode: 'three_window', windows: { sender: { left: 20, top: 20, width: 500, height: 600 } } }, [{ left: 0, top: 0, width: 1920, height: 1080 }]);
  assert.equal(restored.windows.sender.focused, false);
  assert.equal(restored.focusedRole, '');
});
