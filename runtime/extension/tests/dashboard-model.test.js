import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionableQueue,
  buildDiagnostics,
  commandResultLabel,
  deriveReview,
  primaryTransportAction,
  roleHealth,
  virtualSlice
} from '../dashboard/dashboard-model.js';

test('role health distinguishes missing stale and healthy runtimes', () => {
  assert.equal(roleHealth(null, 1000).label, 'Missing');
  assert.equal(roleHealth({ connected: true, heartbeatAt: 1, composerReady: true }, 20000).label, 'Stale');
  assert.equal(roleHealth({ connected: true, heartbeatAt: 900, composerReady: true }, 1000).label, 'Healthy');
});

test('timeline virtualization returns a bounded visible slice', () => {
  const items = Array.from({ length: 200 }, (_, index) => index);
  const slice = virtualSlice(items, 520, 520, 52, 2);
  assert.ok(slice.items.length < items.length);
  assert.equal(slice.totalHeight, 10400);
  assert.ok(slice.start <= 10);
});

test('safe diagnostics omit transcript text and setup context', () => {
  const diagnostics = buildDiagnostics({
    sessionId: 's1',
    mode: 'active',
    uptimeMs: 100,
    sender: { connected: true, provider: 'chatgpt', phase: 'ready', composerReady: true, heartbeatAt: 1000 },
    receiver: { connected: true, provider: 'claude', phase: 'ready', composerReady: true, heartbeatAt: 1000 },
    queue: [{ envelope: { text: 'Sensitive question' } }],
    latestFinal: { text: 'Sensitive question' },
    warnings: [],
    metrics: {}
  }, 1200);
  assert.doesNotMatch(JSON.stringify(diagnostics), /Sensitive question/);
});

test('review derives only safe context and metrics', () => {
  const review = deriveReview({
    timeline: [{ data: { sessionContext: { company: 'Acme', answerMode: 'concise' } } }],
    metrics: { finalsObserved: 3, delivered: 2, deliverySuccessRate: 100 }
  });
  assert.equal(review.context.company, 'Acme');
  assert.equal(review.questions, 3);
  assert.equal(review.delivered, 2);
});


test('dashboard defaults to actionable queue items and exposes all items on demand', () => {
  const queue = [{ id: 'q1', status: 'queued' }, { id: 'q2', status: 'superseded' }];
  assert.deepEqual(actionableQueue(queue).map(item => item.id), ['q1']);
  assert.deepEqual(actionableQueue(queue, true).map(item => item.id), ['q1', 'q2']);
});

test('primary transport action reflects authoritative session mode', () => {
  assert.deepEqual(primaryTransportAction('paused'), {
    command: 'resume_without_send',
    label: 'Resume forwarding'
  });
  assert.deepEqual(primaryTransportAction('active'), {
    command: 'pause',
    label: 'Pause forwarding'
  });
});

test('command feedback describes the actual operator outcome', () => {
  assert.equal(commandResultLabel('pause', { ok: true }), 'Forwarding paused');
  assert.equal(
    commandResultLabel('repair_runtime', { ok: true, pendingVerification: true }),
    'Repair started; verifying both roles'
  );
  assert.equal(
    commandResultLabel('discard_superseded', { ok: true, discarded: 3 }),
    '3 superseded final(s) cleared'
  );
});
