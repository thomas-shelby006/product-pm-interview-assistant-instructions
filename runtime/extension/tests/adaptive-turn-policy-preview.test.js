import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicyImpactPreview, validatePolicyImpactConfirmation } from '../shared/policy-impact-preview.js';
import { normalizeDashboardCommand } from '../shared/dashboard-protocol.js';

function snapshot(policy = 'adaptive', mode = 'live', heldCount = 0) {
  return {
    sessionId: 's',
    mode: 'active',
    ledgerCounts: { unresolved: heldCount },
    batchState: {
      autoSubmit: true,
      hold: mode === 'paused_accumulating',
      turnCoordination: { version: 1, policy, mode, heldCount, interruption: { state: 'none' } }
    },
    deliveryPolicy: { active: false, allowProviderWrite: true },
    receiver: { adapterCapabilityProbation: { writeSafe: true } },
    selfTest: { ok: true }
  };
}

test('turn coordination preview changes only classification policy', () => {
  const value = snapshot('adaptive', 'paused_accumulating', 2);
  const preview = buildPolicyImpactPreview(value, { kind: 'turn_coordination', policy: 'manual' }, 100);
  assert.equal(preview.allowed, true);
  assert.equal(preview.kind, 'turn_coordination');
  assert.equal(preview.target, 'manual');
  assert.equal(preview.providerWrites, 'unchanged');
  assert.equal(preview.postAnswer, 'unchanged');
  assert.equal(preview.protectedCount, 2);
  assert.deepEqual(preview.changes, [{ field: 'turnCoordinationPolicy', from: 'adaptive', to: 'manual' }]);
  assert.equal(preview.effect.autoInterrupt, false);
  assert.equal(preview.effect.pauseStateChanges, false);
  assert.equal(preview.effect.submitsHeldDraft, false);
});

test('turn coordination preview is expiry and snapshot bound', () => {
  const value = snapshot('adaptive', 'live', 0);
  const preview = buildPolicyImpactPreview(value, { kind: 'turn_coordination', policy: 'conservative' }, 100);
  assert.equal(validatePolicyImpactConfirmation(value, preview, 200).ok, true);
  assert.equal(validatePolicyImpactConfirmation(value, preview, preview.expiresAt + 1).error, 'policy_preview_expired');
  assert.equal(validatePolicyImpactConfirmation(snapshot('adaptive', 'paused_accumulating', 1), preview, 200).error, 'policy_preview_stale');
});

test('dashboard coordination policy requires a matching preview payload', () => {
  const value = snapshot();
  const preview = buildPolicyImpactPreview(value, { kind: 'turn_coordination', policy: 'manual' }, 100);
  const base = { sessionId: 's', requestId: 'r', command: 'set_turn_coordination_policy' };
  assert.equal(normalizeDashboardCommand({ ...base, payload: { policy: 'manual' } }), null);
  const normalized = normalizeDashboardCommand({ ...base, payload: { policy: 'manual', preview } });
  assert.equal(normalized.payload.policy, 'manual');
  assert.equal(normalized.payload.preview.kind, 'turn_coordination');
  assert.equal(normalized.payload.preview.target, 'manual');
  assert.equal(normalizeDashboardCommand({ ...base, requestId: 'bad', payload: { policy: 'adaptive', preview } }), null);
});

test('cockpit packages preview-confirm controls without direct policy mutation', async () => {
  const root = new URL('../dashboard/', import.meta.url);
  const [markup, source, css] = await Promise.all([
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('index.html', root), 'utf8')),
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('dashboard.js', root), 'utf8')),
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('dashboard.css', root), 'utf8'))
  ]);
  for (const id of [
    'turnCoordinationPolicySelect', 'turnCoordinationPolicyPreviewButton',
    'turnCoordinationPolicyPreview', 'turnCoordinationPolicyPreviewTitle',
    'turnCoordinationPolicyPreviewDetail', 'turnCoordinationPolicyConfirm',
    'turnCoordinationPolicyCancel'
  ]) {
    assert.equal((markup.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} must be unique`);
  }
  assert.match(source, /buildPolicyImpactPreview\(state\.snapshot \|\| \{\}, \{ kind:'turn_coordination', policy \}/);
  assert.match(source, /validatePolicyImpactConfirmation\(state\.snapshot \|\| \{\}, state\.coordinationPolicyPreview/);
  assert.match(source, /'set_turn_coordination_policy', \{ policy:preview\.target, preview \}/);
  assert.doesNotMatch(markup, /data-command="set_turn_coordination_policy"/);
  assert.match(css, /\.turn-coordination-policy-preview/);
  assert.match(css, /@media \(max-width: 320px\)/);
  assert.match(css, /@media print/);
});
