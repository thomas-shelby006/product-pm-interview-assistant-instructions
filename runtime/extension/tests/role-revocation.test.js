import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntimeInstanceId,
  getOrCreateRuntimeInstanceId,
  shouldApplyRoleRevocation
} from '../content/role-revocation.js';

const runtime = { sessionId: 's1', role: 'sender', provider: 'chatgpt' };

test('revocation applies only to the displaced runtime instance', () => {
  assert.equal(shouldApplyRoleRevocation(runtime, 'old', {
    type: 'PMIA_ROLE_REVOKED', sessionId: 's1', role: 'sender', instanceId: 'old'
  }), true);
  assert.equal(shouldApplyRoleRevocation(runtime, 'new', {
    type: 'PMIA_ROLE_REVOKED', sessionId: 's1', role: 'sender', instanceId: 'old'
  }), false);
});

test('revocation ignores other sessions and roles while retaining legacy targeting', () => {
  assert.equal(shouldApplyRoleRevocation(runtime, 'current', {
    type: 'PMIA_ROLE_REVOKED', sessionId: 'other', role: 'sender', instanceId: 'current'
  }), false);
  assert.equal(shouldApplyRoleRevocation(runtime, 'current', {
    type: 'PMIA_ROLE_REVOKED', sessionId: 's1', role: 'receiver', instanceId: 'current'
  }), false);
  assert.equal(shouldApplyRoleRevocation(runtime, 'current', {
    type: 'PMIA_ROLE_REVOKED', sessionId: 's1', role: 'sender'
  }), true);
});

test('runtime instance IDs are non-empty and page-scoped', () => {
  const first = createRuntimeInstanceId(1000);
  const second = createRuntimeInstanceId(1001);
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first, second);
});

test('runtime identity is reused across navigation in the same tab session', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  let created = 0;
  const create = () => `lease-${++created}`;
  assert.equal(getOrCreateRuntimeInstanceId(storage, 'pmia-runtime', create), 'lease-1');
  assert.equal(getOrCreateRuntimeInstanceId(storage, 'pmia-runtime', create), 'lease-1');
  assert.equal(created, 1);
});
