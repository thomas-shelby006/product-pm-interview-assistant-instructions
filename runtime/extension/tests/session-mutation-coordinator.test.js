import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionMutationCoordinator } from '../shared/session-mutation-coordinator.js';

test('same-session mutations run in FIFO order', async () => {
  const coordinator = createSessionMutationCoordinator();
  const events = [];
  let release;
  const first = coordinator.run('s1', async () => {
    events.push('first-start');
    await new Promise(resolve => { release = resolve; });
    events.push('first-end');
  });
  const second = coordinator.run('s1', async () => { events.push('second'); });
  await Promise.resolve();
  assert.deepEqual(events, ['first-start']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-start', 'first-end', 'second']);
});

test('different sessions may mutate concurrently', async () => {
  const coordinator = createSessionMutationCoordinator();
  const events = [];
  let release;
  const first = coordinator.run('s1', async () => {
    events.push('s1-start');
    await new Promise(resolve => { release = resolve; });
  });
  const second = coordinator.run('s2', async () => { events.push('s2'); });
  await second;
  assert.deepEqual(events, ['s1-start', 's2']);
  release();
  await first;
});

test('a rejected mutation does not block later work', async () => {
  const coordinator = createSessionMutationCoordinator();
  await assert.rejects(coordinator.run('s1', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await coordinator.run('s1', async () => 7), 7);
  assert.equal(coordinator.pending('s1'), false);
  assert.equal(coordinator.size, 0);
});
