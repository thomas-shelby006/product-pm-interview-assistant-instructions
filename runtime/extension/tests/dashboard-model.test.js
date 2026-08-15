import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
    ledger: [{ envelope: { text: 'Sensitive question' } }],
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
    commandResultLabel('archive_proven', { ok: true, archived: 3 }),
    '3 proven final(s) archived'
  );
  assert.equal(
    commandResultLabel('submit_selected', { ok: true, staged: true }),
    'Selected final added to the next batch'
  );
});

test('transitional lifecycle phases are never reported healthy', () => {
  assert.deepEqual(roleHealth({
    connected: true, phase: 'boot', heartbeatAt: 900, composerReady: true
  }, 1000), { label: 'Starting', tone: 'warn', ageMs: 100 });
  assert.equal(roleHealth({
    connected: true, phase: 'registered', heartbeatAt: 900, composerReady: true
  }, 1000).label, 'Registering');
  assert.equal(roleHealth({
    connected: true, phase: 'ready', heartbeatAt: 900, composerReady: true
  }, 1000).label, 'Healthy');
});


test('warning labels expose current storage and proof blockers', async () => {
  const { warningLabel } = await import('../dashboard/dashboard-model.js');
  assert.equal(
    warningLabel({ code: 'session_storage_critical' }),
    'Session memory is above 95%; unresolved finals remain protected but action is required'
  );
  assert.equal(
    warningLabel({ code: 'receiver_proof_unverified' }),
    'Receiver submission was not verified by a rendered provider turn'
  );
  assert.equal(warningLabel({ code: 'future_warning' }), 'future_warning');
});

test('review separates answer availability from delivery success', () => {
  const review = deriveReview({ metrics: { finalsObserved: 2, delivered: 2, deliverySuccessRate: 100, answersCompleted: 1, answersNoResponse: 1, answerAvailabilityRate: 50 }, timeline: [] });
  assert.equal(review.deliverySuccessRate, 100);
  assert.equal(review.answerAvailabilityRate, 50);
  assert.equal(review.answersNoResponse, 1);
});

test('review exposes answer-length quality metrics separately from latency', () => {
  const review = deriveReview({
    metrics: { averageAnswerWords: 160, maxAnswerWords: 181, answersOver180: 1, averageAnswerElapsedMs: 4200 },
    timeline: []
  });
  assert.equal(review.averageAnswerWords, 160);
  assert.equal(review.maxAnswerWords, 181);
  assert.equal(review.answersOver180, 1);
  assert.equal(review.averageAnswerElapsedMs, 4200);
});
