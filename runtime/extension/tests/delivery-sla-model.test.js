import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDeliverySlaView } from '../dashboard/delivery-sla-model.js';

test('delivery SLA view exposes oldest age phase and next action', () => {
  const view = deriveDeliverySlaView({ deliverySla: { state: 'check_due', oldestAt: 48000, targetMs: 20000, nextAction: 'check_live' } }, 100000);
  assert.equal(view.label, 'Live check due');
  assert.equal(view.oldestAgeMs, 52000);
  assert.equal(view.nextAction, 'Check live');
});
