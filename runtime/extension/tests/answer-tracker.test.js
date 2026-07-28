import test from 'node:test';
import assert from 'node:assert/strict';

const trackerModule = await import('../content/answer-tracker.js').catch(() => null);

test('answer tracker waits for generation stop and 250ms stable text', () => {
  assert.ok(trackerModule, 'answer tracker module must exist');
  const tracker = trackerModule.createAnswerTracker({
    beforeText: 'old answer', startedAt: 0, stabilityMs: 250, noGenerationGraceMs: 600
  });
  assert.equal(tracker.observe({ now: 100, text: 'new', generating: true, hintVersion: 0 }), null);
  assert.equal(tracker.observe({ now: 200, text: 'new answer', generating: true, hintVersion: 0 }), null);
  assert.equal(tracker.observe({ now: 300, text: 'new answer', generating: false, hintVersion: 0 }), null);
  assert.equal(tracker.observe({ now: 449, text: 'new answer', generating: false, hintVersion: 0 }), null);
  assert.deepEqual(tracker.observe({
    now: 450, text: 'new answer', generating: false, hintVersion: 0
  }), { text: 'new answer', elapsedMs: 450 });
});

test('answer tracker accepts Claude final hint immediately after generation stops', () => {
  const tracker = trackerModule.createAnswerTracker({
    beforeText: '', startedAt: 1000, initialHintVersion: 2
  });
  tracker.observe({ now: 1050, text: 'complete answer', generating: true, hintVersion: 2 });
  assert.deepEqual(tracker.observe({
    now: 1100, text: 'complete answer', generating: false, hintVersion: 3
  }), { text: 'complete answer', elapsedMs: 100 });
});

test('answer tracker uses a short grace period when generating UI is never observed', () => {
  const tracker = trackerModule.createAnswerTracker({
    beforeText: '', startedAt: 0, stabilityMs: 250, noGenerationGraceMs: 600
  });
  assert.equal(tracker.observe({ now: 100, text: 'fast answer', generating: false, hintVersion: 0 }), null);
  assert.equal(tracker.observe({ now: 599, text: 'fast answer', generating: false, hintVersion: 0 }), null);
  assert.deepEqual(tracker.observe({
    now: 600, text: 'fast answer', generating: false, hintVersion: 0
  }), { text: 'fast answer', elapsedMs: 600 });
});

test('answer tracker resets stability when streamed text changes', () => {
  const tracker = trackerModule.createAnswerTracker({ beforeText: '', startedAt: 0, stabilityMs: 250 });
  tracker.observe({ now: 0, text: 'first', generating: true, hintVersion: 0 });
  tracker.observe({ now: 100, text: 'first second', generating: false, hintVersion: 0 });
  assert.equal(tracker.observe({ now: 300, text: 'first second third', generating: false, hintVersion: 0 }), null);
  assert.equal(tracker.observe({ now: 549, text: 'first second third', generating: false, hintVersion: 0 }), null);
  assert.deepEqual(tracker.observe({
    now: 550, text: 'first second third', generating: false, hintVersion: 0
  }), { text: 'first second third', elapsedMs: 550 });
});

test('wake signal resolves early on provider mutation and times out as a watchdog', async () => {
  assert.ok(trackerModule, 'answer tracker module must exist');
  const timers = [];
  const wake = trackerModule.createWakeSignal({
    setTimeoutFn: callback => { timers.push(callback); return timers.length; },
    clearTimeoutFn: () => {}
  });
  const first = wake.wait(500);
  wake.pulse();
  assert.equal(await first, 'signal');
  const second = wake.wait(500);
  timers.at(-1)();
  assert.equal(await second, 'timeout');
  wake.disconnect();
});
