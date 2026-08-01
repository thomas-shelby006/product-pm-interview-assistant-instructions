import test from 'node:test';
import assert from 'node:assert/strict';
import { runLiveUxLoadScenario } from '../testing/live-ux-load-scenario.js';
import { createRenderScheduler } from '../dashboard/render-scheduler.js';
import { createIdleWorkCoordinator } from '../dashboard/idle-work-coordinator.js';

test('Cycle 161: deterministic load scenario preserves exact configured counts', () => {
  const first = runLiveUxLoadScenario({ seed: 7, commandCount: 500, ledgerCount: 10000, timelineCount: 1000 });
  const second = runLiveUxLoadScenario({ seed: 7, commandCount: 500, ledgerCount: 10000, timelineCount: 1000 });
  assert.equal(first.deterministicKey, second.deterministicKey);
  assert.deepEqual(first.counts, { commands: 500, ledger: 10000, timeline: 1000 });
});

test('Cycle 162: virtualized load never exposes the full ten-thousand-row set', () => {
  const result = runLiveUxLoadScenario({ ledgerCount: 10000 });
  assert.equal(result.viewport.count < 50, true);
  assert.equal(result.viewport.totalHeight, 480000);
});

test('Cycle 163: render scheduler coalesces one thousand updates into one frame', () => {
  let callback; let renders = 0;
  const scheduler = createRenderScheduler({ frame: fn => { callback = fn; return 1; }, cancelFrame: () => {} });
  for (let index = 0; index < 1000; index += 1) scheduler.schedule([`section-${index % 6}`], sections => { renders += 1; assert.equal(sections.length <= 6, true); });
  callback();
  assert.equal(renders, 1);
});

test('Cycle 164: idle work drains bounded tasks and leaves no pending owner', () => {
  let runner; let count = 0;
  const idle = createIdleWorkCoordinator({ requestIdle: fn => { runner = fn; return 1; }, cancelIdle: () => {} });
  for (let index = 0; index < 40; index += 1) idle.schedule(() => { count += 1; });
  runner({ didTimeout: true, timeRemaining: () => 0 });
  assert.equal(count, 40); assert.equal(idle.size(), 0);
});

test('Cycle 165: load scenario reports presentation budgets without deleting ledger state', () => {
  const result = runLiveUxLoadScenario({ commandCount: 1000, ledgerCount: 10000, timelineCount: 2000 });
  assert.equal(result.budget.state, 'over_budget');
  assert.equal(result.counts.ledger, 10000);
  assert.equal(result.budget.actions.includes('virtualize_queue'), true);
});
