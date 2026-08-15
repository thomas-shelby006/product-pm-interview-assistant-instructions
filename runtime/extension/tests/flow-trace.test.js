import test from 'node:test';
import assert from 'node:assert/strict';

const flowModule = await import('../shared/flow-trace.js').catch(() => null);

test('flow trace stores only safe pipeline metadata', () => {
  assert.ok(flowModule, 'flow trace helper must exist');
  const trace = flowModule.makeFlowTrace({
    envelopeId: 'e-1', seq: 2, stage: 'receiver_accepted', status: 'ok',
    role: 'receiver', provider: 'claude', reason: 'accepted', elapsedMs: 42,
    text: 'secret question', resume: 'secret resume', jobDescription: 'secret jd'
  }, 1234);
  assert.deepEqual(trace, {
    envelopeId: 'e-1', seq: 2, stage: 'receiver_accepted', status: 'ok',
    role: 'receiver', provider: 'claude', reason: 'accepted', elapsedMs: 42, at: 1234
  });
});

test('latest question path resolves named stages and first failure', () => {
  assert.ok(flowModule, 'flow trace helper must exist');
  const timeline = [
    { at: 10, type: 'flow_trace', data: { envelopeId: 'old', stage: 'finalized', status: 'ok' } },
    { at: 20, type: 'flow_trace', data: { envelopeId: 'new', stage: 'finalized', status: 'ok' } },
    { at: 30, type: 'flow_trace', data: { envelopeId: 'new', stage: 'persisted', status: 'ok' } },
    { at: 40, type: 'flow_trace', data: { envelopeId: 'new', stage: 'receiver_accepted', status: 'failed', reason: 'sequence_gap' } }
  ];
  const path = flowModule.deriveLatestQuestionPath(timeline);
  assert.equal(path.envelopeId, 'new');
  assert.equal(path.failure.stage, 'receiver_accepted');
  assert.equal(path.failure.reason, 'sequence_gap');
  assert.equal(path.stages.find(item => item.stage === 'persisted').status, 'ok');
});
