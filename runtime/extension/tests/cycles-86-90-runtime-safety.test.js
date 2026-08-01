import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityProbation } from '../content/capability-probation.js';
import { classifyRuntimeRootCause } from '../shared/runtime-root-cause.js';
import { selectRecoveryAction } from '../shared/recovery-escalation-policy.js';
import { deriveQueueOnlyPolicy } from '../shared/queue-only-policy.js';
import { runConsistencyAudit } from '../shared/consistency-watchdog.js';

function healthyRole() {
  return {
    connected: true,
    phase: 'ready',
    composerReady: true,
    adapterCapabilities: { complete: true },
    adapterCapabilityProbation: { writeSafe: true },
    transportLane: { state: 'closed', lastMode: 'direct' }
  };
}

test('provider capability probation blocks writes only after repeated critical samples', () => {
  const probation = new CapabilityProbation({ criticalThreshold: 2, healthyThreshold: 3 });
  assert.equal(probation.observe({ complete: false, missingRequired: ['submit'] }, 1).writeSafe, true);
  const blocked = probation.observe({ complete: false, missingRequired: ['submit'] }, 2);
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.writeSafe, false);
});
test('provider capability probation requires stable recovery before writes resume', () => {
  const probation = new CapabilityProbation({ criticalThreshold: 1, healthyThreshold: 2 });
  probation.observe({ complete: false, missingRequired: ['submit'] }, 1);
  assert.equal(probation.observe({ complete: true, missingRequired: [] }, 2).state, 'recovering');
  const recovered = probation.observe({ complete: true, missingRequired: [] }, 3);
  assert.equal(recovered.state, 'healthy');
  assert.equal(recovered.writeSafe, true);
});

test('root cause classifier returns one deterministic owner and suppresses symptoms', () => {
  const snapshot = {
    storagePressure: { level: 'critical', percent: 99 },
    sender: { ...healthyRole(), connected: false, phase: 'missing' },
    receiver: healthyRole(),
    timeline: [{ type: 'sequence_gap', data: { expectedSeq: 3 } }]
  };
  const result = classifyRuntimeRootCause(snapshot, 100);
  assert.equal(result.code, 'storage_critical');
  assert.ok(result.suppressed.some(item => item.code === 'registration_missing'));
  assert.ok(result.suppressed.some(item => item.code === 'sequence_gap'));
});
test('recovery escalation selects one bounded action from the root cause', () => {
  assert.deepEqual(
    selectRecoveryAction({ code: 'sequence_gap' }, { budget: { remaining: 2 }, attempts: 0 }),
    { action: 'reconcile', automatic: true, reason: 'sequence_gap' }
  );
  assert.deepEqual(
    selectRecoveryAction({ code: 'storage_critical' }, { budget: { remaining: 2 }, attempts: 0 }),
    { action: 'queue_only', automatic: false, reason: 'storage_critical' }
  );
  assert.equal(
    selectRecoveryAction({ code: 'registration_missing' }, { budget: { remaining: 0 }, attempts: 3 }).action,
    'operator_handoff'
  );
});

test('queue-only preserves persistence while blocking provider mutation', () => {
  const snapshot = {
    mode: 'active',
    stateCompatibility: { state: 'compatible' },
    stateAudit: { blocked: 0 },
    sender: healthyRole(),
    receiver: { ...healthyRole(), adapterCapabilityProbation: { writeSafe: false } }
  };
  const policy = deriveQueueOnlyPolicy(snapshot, { code: 'provider_capability_blocked' });
  assert.equal(policy.active, true);
  assert.equal(policy.allowPersist, true);
  assert.equal(policy.allowProviderWrite, false);
});
test('consistency watchdog emits deterministic repair instructions without content', () => {
  const snapshot = {
    sessionId: 's1',
    sender: { connected: true },
    receiver: { connected: true },
    recoverySchedules: [{ alarmName: 'pmia-recovery:s1:verify:1', dueAt: 100 }],
    ledgerIndexAudit: { ok: false },
    batchState: { active: { memberIds: ['a'] }, next: { memberIds: ['b'] } }
  };
  const registry = { getSession: () => ({ sender: null, receiver: { tabId: 2 } }) };
  const result = runConsistencyAudit({ snapshot, storeAudit: { blocked: 0 }, registry, alarms: [], now: 100 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.repairs.map(item => item.code), [
    'rebuild_ledger_index',
    're_register_role',
    'restore_alarm'
  ]);
  assert.equal(JSON.stringify(result).includes('Question'), false);
});

test('consistency watchdog blocks ambiguous active and next batch membership', () => {
  const result = runConsistencyAudit({
    snapshot: {
      sessionId: 's1',
      sender: {}, receiver: {}, recoverySchedules: [],
      batchState: { active: { memberIds: ['a'] }, next: { memberIds: ['a', 'b'] } }
    },
    storeAudit: { blocked: 0 },
    registry: { getSession: () => ({}) },
    alarms: [],
    now: 200
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ambiguous_batch_membership');
});
