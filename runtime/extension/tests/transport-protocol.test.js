import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSPORT_PROTOCOL_VERSION,
  createTransportHandshake,
  negotiateTransportHandshake,
  createTransportIdentity,
  validateTransportFrame
} from '../shared/transport-protocol.js';

test('transport handshake negotiates exact version and capability intersection', () => {
  const local = createTransportHandshake({ sessionId: 's1', role: 'receiver', instanceId: 'r1', capabilities: ['request_response', 'selective_feedback'] });
  const remote = createTransportHandshake({ sessionId: 's1', role: 'receiver', instanceId: 'r1', capabilities: ['request_response', 'credits'] });
  const result = negotiateTransportHandshake(local, remote, { epoch: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.version, TRANSPORT_PROTOCOL_VERSION);
  assert.deepEqual(result.capabilities, ['request_response']);
  assert.equal(result.identity.epoch, 4);
});

test('transport handshake fails closed for incompatible or mismatched identity', () => {
  const local = createTransportHandshake({ sessionId: 's1', role: 'sender', instanceId: 'a' });
  assert.equal(negotiateTransportHandshake(local, { ...local, minVersion: 9, maxVersion: 9 }).error, 'protocol_version_incompatible');
  assert.equal(negotiateTransportHandshake(local, { ...local, sessionId: 's2' }).error, 'transport_identity_mismatch');
});

test('transport frame validation rejects stale epoch and wrong role', () => {
  const identity = createTransportIdentity({ sessionId: 's1', role: 'receiver', instanceId: 'r1', epoch: 7 });
  assert.equal(validateTransportFrame({ protocol: identity }, identity).ok, true);
  assert.equal(validateTransportFrame({ protocol: { ...identity, epoch: 6 } }, identity).error, 'stale_transport_epoch');
  assert.equal(validateTransportFrame({ protocol: { ...identity, role: 'sender' } }, identity).error, 'transport_identity_mismatch');
});