import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandSearchIndex, searchCommandIndex } from '../shared/command-search-index.js';
import { deriveVirtualList, virtualItems } from '../dashboard/virtual-list-model.js';
import { createRenderScheduler } from '../dashboard/render-scheduler.js';
import { createIdleWorkCoordinator } from '../dashboard/idle-work-coordinator.js';
import { clampLiveUxCollection, deriveLiveUxMemoryBudget } from '../shared/live-ux-memory-budget.js';

test('Cycle 141: indexed command search is deterministic and relevance ordered', () => {
  const index = buildCommandSearchIndex([{ id: 'repair_runtime', label: 'Repair runtime' }, { id: 'check_live', label: 'Check live' }]);
  assert.equal(searchCommandIndex(index, 'repair')[0].id, 'repair_runtime');
  assert.equal(searchCommandIndex(index, '').length, 2);
});

test('Cycle 142: virtual list bounds visible rows with spacers', () => {
  const model = deriveVirtualList({ count: 1000, scrollTop: 4800, viewportHeight: 480, rowHeight: 48, overscan: 2 });
  assert.equal(model.start, 98);
  assert.equal(model.count <= 14, true);
  assert.equal(virtualItems(Array.from({ length: 1000 }, (_, i) => i), { scrollTop: 4800, viewportHeight: 480, rowHeight: 48 }).items.length < 30, true);
});

test('Cycle 143: render scheduler coalesces semantic sections into one frame', () => {
  let callback; const calls = [];
  const scheduler = createRenderScheduler({ frame: fn => { callback = fn; return 1; }, cancelFrame: () => {} });
  scheduler.schedule(['ledger'], sections => calls.push(sections));
  scheduler.schedule(['timeline'], sections => calls.push(sections));
  assert.deepEqual(scheduler.snapshot().pending.sort(), ['ledger', 'timeline']);
  callback();
  assert.deepEqual(calls, [['ledger', 'timeline']]);
});

test('Cycle 144: idle coordinator runs queued noncritical work without a second render owner', () => {
  let runner; const done = [];
  const idle = createIdleWorkCoordinator({ requestIdle: fn => { runner = fn; return 1; }, cancelIdle: () => {} });
  idle.schedule(() => done.push('a')); idle.schedule(() => done.push('b'));
  runner({ didTimeout: true, timeRemaining: () => 0 });
  assert.deepEqual(done, ['a', 'b']);
  assert.equal(idle.size(), 0);
});

test('Cycle 145: live UX memory budget reports exact breaches and bounded copies', () => {
  const snapshot = { ledger: Array.from({ length: 130 }), timeline: Array.from({ length: 201 }), questionOperationsDerived: { questions: Array.from({ length: 510 }) } };
  const budget = deriveLiveUxMemoryBudget(snapshot);
  assert.equal(budget.state, 'over_budget');
  assert.equal(budget.breaches.some(item => item.key === 'visibleQueue'), true);
  assert.equal(clampLiveUxCollection(Array.from({ length: 10 }, (_, i) => i), 3).length, 3);
});

test('live performance source uses indexed search, scheduling, virtualization, and budget evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const palette = await readFile(new URL('../dashboard/command-palette-model.js', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  assert.match(palette, /buildCommandSearchIndex/);
  assert.match(dashboard, /createRenderScheduler/);
  assert.match(dashboard, /virtualItems/);
  assert.match(dashboard, /createIdleWorkCoordinator/);
  assert.match(controller, /liveUxBudget/);
});

test('dashboard clock ticks use the render scheduler instead of racing a direct full render', async () => {
  const { readFile } = await import('node:fs/promises');
  const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /setInterval\(\(\) => \{\s*if \(state\.snapshot\) scheduleRender\(\['clock'\]\);\s*\}, 1000\)/);
  assert.match(dashboard, /changed\('ledger', 'ledgerCounts', 'batchState', 'mode', 'clock'\)/);
});
