import test from 'node:test';
import assert from 'node:assert/strict';

const protocol = await import('../simple/protocol.js').catch(() => null);
const fanout = await import('../simple/fanout.js').catch(() => null);

test('simple runtime modules exist', () => {
  assert.ok(protocol, 'simple/protocol.js must exist');
  assert.ok(fanout, 'simple/fanout.js must exist');
});

test('turns are immutable and success requires rendered proof', () => {
  const turn = protocol.makeTurn({ sessionId: 's1', turnId: 't1', text: 'Hello?', kind: 'question' });
  assert.deepEqual(turn, { sessionId: 's1', turnId: 't1', text: 'Hello?', kind: 'question' });
  assert.equal(Object.isFrozen(turn), true);
  assert.equal(protocol.isSuccessfulRoleResult({ stage: 'queued' }), false);
  assert.equal(protocol.isSuccessfulRoleResult({ stage: 'composer_written' }), false);
  assert.equal(protocol.isSuccessfulRoleResult({ stage: 'submitted' }), false);
  assert.equal(protocol.isSuccessfulRoleResult({ stage: 'rendered' }), true);
});

test('fanout starts receiver and comparison concurrently', async () => {
  const turn = protocol.makeTurn({ sessionId: 's1', turnId: 't1', text: 'Metric?', kind: 'question' });
  const starts = [];
  const gates = new Map();
  const deliver = role => new Promise(resolve => {
    starts.push(role);
    gates.set(role, () => resolve({ role, stage: 'rendered' }));
  });

  const pending = fanout.fanOutTurn({ turn, roles: ['receiver', 'comparison'], deliver });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(starts.sort(), ['comparison', 'receiver']);

  gates.get('receiver')();
  gates.get('comparison')();
  const result = await pending;
  assert.equal(result.receiver.stage, 'rendered');
  assert.equal(result.comparison.stage, 'rendered');
});

test('comparison failure cannot delay or reclassify receiver success', async () => {
  const turn = protocol.makeTurn({ sessionId: 's1', turnId: 't2', text: 'Tradeoff?', kind: 'question' });
  let releaseComparison;
  const deliver = role => role === 'receiver'
    ? Promise.resolve({ role, stage: 'rendered', elapsedMs: 4 })
    : new Promise(resolve => { releaseComparison = resolve; });

  const pending = fanout.fanOutTurn({ turn, roles: ['receiver', 'comparison'], deliver });
  await new Promise(resolve => setImmediate(resolve));
  releaseComparison({ role: 'comparison', stage: 'failed', reason: 'provider_unavailable' });
  const result = await pending;

  assert.equal(protocol.isSuccessfulRoleResult(result.receiver), true);
  assert.equal(protocol.isSuccessfulRoleResult(result.comparison), false);
  assert.equal(result.receiver.stage, 'rendered');
});
