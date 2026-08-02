import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderScheduler } from '../dashboard/render-scheduler.js';

function harness() {
  let frameCallback = null;
  let timerCallback = null;
  const cancelled = { frames: [], timers: [] };
  const calls = [];
  const scheduler = createRenderScheduler({
    frame(callback) { frameCallback = callback; return 11; },
    cancelFrame(id) { cancelled.frames.push(id); },
    setTimer(callback) { timerCallback = callback; return 22; },
    clearTimer(id) { cancelled.timers.push(id); },
    fallbackMs: 20
  });
  return {
    scheduler,
    calls,
    cancelled,
    frame: () => frameCallback?.(),
    timer: () => timerCallback?.()
  };
}

test('background timer drains a render when the animation frame never runs', () => {
  const value = harness();
  value.scheduler.schedule(['batchState'], sections => value.calls.push(sections));
  value.scheduler.schedule(['operatorChoice'], sections => value.calls.push(sections));
  value.timer();
  assert.deepEqual(value.calls, [['batchState', 'operatorChoice']]);
  assert.deepEqual(value.cancelled.frames, [11]);
  assert.equal(value.scheduler.snapshot().scheduled, false);
  value.frame();
  assert.equal(value.calls.length, 1);
});

test('visible animation frame cancels the fallback timer without duplicate rendering', () => {
  const value = harness();
  value.scheduler.schedule(['ledger'], sections => value.calls.push(sections));
  value.frame();
  assert.deepEqual(value.calls, [['ledger']]);
  assert.deepEqual(value.cancelled.timers, [22]);
  value.timer();
  assert.equal(value.calls.length, 1);
});

test('explicit flush cancels both wake lanes and renders once', () => {
  const value = harness();
  value.scheduler.schedule(['assist'], sections => value.calls.push(sections));
  assert.deepEqual(value.scheduler.flush(), ['assist']);
  assert.deepEqual(value.calls, [['assist']]);
  assert.deepEqual(value.cancelled, { frames: [11], timers: [22] });
});
