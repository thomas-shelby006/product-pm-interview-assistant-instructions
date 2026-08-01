import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticTone, groupRuntimeWarnings } from '../dashboard/diagnostics-model.js';

test('runtime warnings are grouped by operational owner', () => {
  const groups = groupRuntimeWarnings([
    { code: 'receiver_proof_failed', severity: 'error' },
    { code: 'sender_adapter_incomplete', severity: 'warn' },
    { code: 'session_storage_high', severity: 'warn' },
    { code: 'repair_in_progress', severity: 'warn' }
  ]);
  assert.deepEqual(groups.map(group => [group.id, group.count]), [
    ['delivery', 1], ['provider', 1], ['storage', 1], ['recovery', 1]
  ]);
  assert.equal(groups[0].critical, 1);
});

test('diagnostic tone is critical first then attention then healthy', () => {
  assert.equal(diagnosticTone({ count: 1, critical: 1 }), 'error');
  assert.equal(diagnosticTone({ count: 2, critical: 0 }), 'warn');
  assert.equal(diagnosticTone({ count: 0, critical: 0 }), 'ok');
});
