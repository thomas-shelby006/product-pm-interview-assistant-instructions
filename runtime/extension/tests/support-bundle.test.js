import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeSupportBundle } from '../shared/support-bundle.js';

const secrets = {
  question: 'SECRET-QUESTION-CONTENT',
  answer: 'SECRET-ANSWER-CONTENT',
  setup: 'SECRET-RESUME-AND-JD',
  url: 'https://chatgpt.com/c/private-conversation',
  credential: 'Bearer SECRET-CREDENTIAL'
};

test('safe support bundle excludes prompts answers context credentials and URLs', () => {
  const bundle = buildSafeSupportBundle({
    sessionId: 'session-opaque', mode: 'active',
    latestPreview: { text: secrets.question }, latestFinal: { text: secrets.question },
    latestAnswer: { text: secrets.answer }, context: secrets.setup,
    sender: { provider: 'chatgpt', pageUrl: secrets.url, instanceId: 'sender-instance' },
    receiver: { provider: 'chatgpt', pageUrl: secrets.url, instanceId: 'receiver-instance' },
    ledger: [{ id: 'q1', state: 'proven', envelope: { seq: 1, text: secrets.question, metadata: { traceId: 'trace-1' } } }],
    credentials: secrets.credential,
    stateAudit: { blocked: 0, repaired: 0 }, ledgerCounts: { proven: 1 }
  }, { manifest: { name: 'PMIA', version: '0.7.0' }, sourceHashes: { 'a.js': 'abc' } });
  const serialized = JSON.stringify(bundle);
  for (const value of Object.values(secrets)) assert.equal(serialized.includes(value), false);
  assert.equal(bundle.ledger.counts.proven, 1);
  assert.equal(bundle.ledger.traces[0].traceId, 'trace-1');
  assert.equal(bundle.roles.sender.provider, 'chatgpt');
});

test('support bundle exposes only reason-coded operational metadata', () => {
  const bundle = buildSafeSupportBundle({
    sessionId: 's1', mode: 'degraded',
    rootCause: { owner: 'provider', code: 'provider_capability_blocked', severity: 'error', nextAction: 'check_live' },
    deliveryPolicy: { active: true, reason: 'provider_capability_blocked', allowPersist: true, allowProviderWrite: false },
    consistencyAudit: { ok: false, reason: 'ambiguous_batch_membership', repairs: [], blocked: [{ code: 'ambiguous_batch_membership' }] },
    sender: {}, receiver: {}, ledgerCounts: {}
  });
  assert.equal(bundle.rootCause.code, 'provider_capability_blocked');
  assert.equal(bundle.deliveryPolicy.allowPersist, true);
  assert.equal(bundle.deliveryPolicy.allowProviderWrite, false);
  assert.equal(bundle.audits.consistency.blocked[0].code, 'ambiguous_batch_membership');
});
