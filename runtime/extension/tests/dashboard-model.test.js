import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagnostics,
  deriveReview,
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
