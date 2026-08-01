import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepairEventCoalescer } from '../shared/repair-event-coalescer.js';

test('identical repair reports inside cooldown are suppressed', () => {
  const coalescer = createRepairEventCoalescer({ cooldownMs: 1000 });
  const report = { phase: 'repairing', verified: false, error: '', checks: { sender: true, receiver: false } };
  assert.equal(coalescer.accept('s', report, 100).persist, true);
  const duplicate = coalescer.accept('s', report, 200);
  assert.equal(duplicate.persist, false);
  assert.equal(duplicate.suppressed, 1);
});

test('phase error verification and check changes always persist', () => {
  const coalescer = createRepairEventCoalescer({ cooldownMs: 10000 });
  coalescer.accept('s', { phase: 'repairing', verified: false, error: '', checks: { sender: false } }, 100);
  for (const report of [
    { phase: 'blocked', verified: false, error: '', checks: { sender: false } },
    { phase: 'blocked', verified: false, error: 'timeout', checks: { sender: false } },
    { phase: 'healthy', verified: true, error: '', checks: { sender: true } }
  ]) assert.equal(coalescer.accept('s', report, 200).persist, true);
});

test('duplicate report persists after cooldown with suppressed count', () => {
  const coalescer = createRepairEventCoalescer({ cooldownMs: 1000 });
  const report = { phase: 'repairing', checks: {} };
  coalescer.accept('s', report, 100);
  coalescer.accept('s', report, 200);
  const later = coalescer.accept('s', report, 1200);
  assert.equal(later.persist, true);
  assert.equal(later.suppressed, 1);
});