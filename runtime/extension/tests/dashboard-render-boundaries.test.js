import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTruthRail } from '../dashboard/render-live-status.js';
import { renderRuntimeRole } from '../dashboard/render-runtime-health.js';

function fixture() {
  const values = new Map();
  const classes = new Map([
    ['.delivery-truth', { dataset: {} }],
    ['.answer-truth', { dataset: {} }],
    ['.verification-truth', { dataset: {} }]
  ]);
  return {
    values,
    document: { querySelector(selector) { return classes.get(selector) || null; } },
    text(id, value) { values.set(id, String(value)); },
    classes
  };
}

test('truth renderer owns only Delivery Answer and Verification summary IDs', () => {
  const f = fixture();
  const snapshot = {
    mode: 'active', contextArmed: true, dashboardConnections: 1,
    sender: { connected: true, phase: 'ready', composerReady: true, heartbeatAt: 1000, adapterCapabilities: { complete: true } },
    receiver: { connected: true, phase: 'ready', composerReady: true, heartbeatAt: 1000, adapterCapabilities: { complete: true }, generationState: { state: 'idle', generating: false } },
    batchState: {}, ledger: [], storagePressure: { level: 'normal' }, senderOutboxState: { count: 0 },
    selfTest: { ok: true, completedAt: 1000 }
  };
  const result = renderTruthRail({ document: f.document, snapshot, now: 1000, text: f.text });
  assert.equal(f.values.get('deliveryTruthState'), 'Caught up');
  assert.equal(f.values.get('answerTruthState'), 'Idle');
  assert.equal(f.values.get('verificationTruthState'), 'Actively verified');
  assert.equal(result.answerStatus.state, 'idle');
  assert.equal(f.values.has('queueBody'), false);
});

test('truth renderer resets all three rails without a snapshot', () => {
  const f = fixture();
  renderTruthRail({ document: f.document, snapshot: null, text: f.text, sessionEnded: false });
  assert.equal(f.values.get('deliveryTruthState'), 'Connecting');
  assert.equal(f.values.get('answerTruthState'), 'Idle');
  assert.equal(f.values.get('verificationTruthState'), 'Not run');
});

test('role renderer uses reconciled generation metadata', () => {
  const f = fixture();
  renderRuntimeRole({
    roleName: 'receiver',
    role: { connected: true, phase: 'ready', composerReady: true, heartbeatAt: 1000, adapterCapabilities: { complete: true }, generationState: { state: 'streaming', confidence: 'medium', reason: 'assistant_text_growth' } },
    now: 1000,
    text: f.text,
    healthNode: { dataset: {}, textContent: '' }
  });
  assert.match(f.values.get('receiverGenerating'), /Streaming \(medium\)/);
  assert.match(f.values.get('receiverGenerating'), /assistant text growth/);
});