import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRegistration } from '../shared/registration-heartbeat.js';

const base = { role: 'sender', provider: 'chatgpt', tabId: 1, instanceId: 'a' };

test('first registration and ownership changes are durable transitions', () => {
  assert.equal(classifyRegistration(null, base), 'ownership_transition');
  assert.equal(classifyRegistration(base, { ...base, tabId: 2, instanceId: 'b' }), 'ownership_transition');
});

test('same tab with a new runtime instance is instance replacement', () => {
  assert.equal(classifyRegistration(base, { ...base, instanceId: 'b' }), 'instance_replacement');
});

test('same runtime instance moving tabs is lease migration', () => {
  assert.equal(classifyRegistration(base, { ...base, tabId: 2 }), 'lease_migration');
});

test('same ownership is a heartbeat', () => {
  assert.equal(classifyRegistration(base, { ...base, registeredAt: 200 }), 'heartbeat');
});