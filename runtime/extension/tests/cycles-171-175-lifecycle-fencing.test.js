import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePrerenderGuard } from '../shared/prerender-guard.js';
import { claimRuntimeInjection, releaseRuntimeInjection } from '../shared/runtime-injection-fence.js';
import { addWakeHistory, summarizeWakeHistory } from '../shared/wake-history.js';
import { buildAlarmGenerationIdentity, isCurrentAlarmGeneration, parseAlarmGenerationIdentity } from '../shared/alarm-generation-identity.js';
import { deriveStartupDeadlineCatchup } from '../shared/startup-deadline-catchup.js';

test('Cycle 171: prerender and inactive hidden pages cannot own provider writes', () => {
  assert.equal(derivePrerenderGuard({ prerendering: true }).allowProviderWrite, false);
  assert.equal(derivePrerenderGuard({ visibilityState: 'hidden', activeTab: false }).allowRegistration, false);
  assert.equal(derivePrerenderGuard({ visibilityState: 'visible', activeTab: true }).blocked, false);
});

test('Cycle 172: highest runtime generation owns one document and release is exact', () => {
  const first = claimRuntimeInjection(null, { instanceId: 'a', documentId: 'd', generation: 1 }, 10);
  const stale = claimRuntimeInjection(first.owner, { instanceId: 'b', documentId: 'd', generation: 0 }, 20);
  const newer = claimRuntimeInjection(first.owner, { instanceId: 'b', documentId: 'd', generation: 2 }, 30);
  assert.equal(stale.accepted, false); assert.equal(newer.accepted, true);
  assert.equal(releaseRuntimeInjection(newer.owner, { instanceId: 'a', documentId: 'd' }).released, false);
  assert.equal(releaseRuntimeInjection(newer.owner, { instanceId: 'b', documentId: 'd' }).released, true);
});

test('Cycle 173: wake history coalesces semantic duplicates and remains bounded', () => {
  let history = [];
  history = addWakeHistory(history, { reason: 'startup', source: 'worker', generation: 1, outcome: 'ok', at: 1 }, 2);
  history = addWakeHistory(history, { reason: 'startup', source: 'worker', generation: 1, outcome: 'ok', at: 2 }, 2);
  history = addWakeHistory(history, { reason: 'alarm', source: 'worker', generation: 1, outcome: 'ok', at: 3 }, 2);
  assert.equal(history.length, 2); assert.equal(summarizeWakeHistory(history).counts.startup, 1);
});

test('Cycle 174: alarm identity includes generation and due time', () => {
  const identity = buildAlarmGenerationIdentity({ sessionId: 's1', kind: 'verify', generation: 3, dueAt: 500 });
  const parsed = parseAlarmGenerationIdentity(identity.name);
  assert.equal(parsed.generation, 3); assert.equal(parsed.dueAt, 500);
  assert.equal(isCurrentAlarmGeneration(identity, 3), true);
  assert.equal(isCurrentAlarmGeneration(identity, 2), false);
});

test('Cycle 175: startup catchup executes current overdue deadlines in order', () => {
  const result = deriveStartupDeadlineCatchup({ now: 100, generation: 2, schedules: [
    { sessionId: 's1', kind: 'b', dueAt: 90, generation: 2 },
    { sessionId: 's1', kind: 'future', dueAt: 120, generation: 2 },
    { sessionId: 's1', kind: 'stale', dueAt: 80, generation: 1 },
    { sessionId: 's1', kind: 'a', dueAt: 70, generation: 2 }
  ] });
  assert.deepEqual(result.actions.map(item => item.kind), ['a','b']);
  assert.deepEqual(result.future.map(item => item.kind), ['future']);
});
