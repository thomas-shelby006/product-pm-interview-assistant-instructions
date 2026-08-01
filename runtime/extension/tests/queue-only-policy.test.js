import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveQueueOnlyPolicy } from '../shared/queue-only-policy.js';

test('queue-only mode always persists finals and blocks provider writes only while cause is active', () => {
  const blocked = deriveQueueOnlyPolicy({ mode: 'active', sender: {}, receiver: {} }, { code: 'provider_capability_blocked' });
  assert.equal(blocked.active, true);
  assert.equal(blocked.allowPersist, true);
  assert.equal(blocked.allowProviderWrite, false);
  const recovered = deriveQueueOnlyPolicy({ mode: 'active', deliveryPolicy: blocked, sender: {}, receiver: {} }, { code: 'healthy' });
  assert.equal(recovered.active, false);
  assert.equal(recovered.allowProviderWrite, true);
});
