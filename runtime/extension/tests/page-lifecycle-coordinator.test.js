import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageLifecycleCoordinator } from '../content/page-lifecycle-coordinator.js';

test('lifecycle coordinator coalesces pageshow resume online and visibility into one reconcile', async () => {
  const listeners = new Map(); const reasons = [];
  const target = { addEventListener: (n, f) => listeners.set(n, f), removeEventListener() {} };
  const doc = { ...target, visibilityState: 'visible' };
  const queue = [];
  const coordinator = createPageLifecycleCoordinator({ window: target, document: doc, reconcile: reason => reasons.push(reason), scheduleMicrotask: fn => queue.push(fn) });
  listeners.get('pageshow')({ persisted: true }); listeners.get('online')(); listeners.get('resume')(); listeners.get('visibilitychange')();
  assert.equal(queue.length, 1);
  await queue[0]();
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /bfcache_restore/);
  coordinator.disconnect();
});

test('freeze and pagehide update phase without reconciling until restoration', () => {
  const listeners = new Map(); const target = { addEventListener: (n, f) => listeners.set(n, f), removeEventListener() {} }; const doc = { ...target, visibilityState: 'hidden' };
  const coordinator = createPageLifecycleCoordinator({ window: target, document: doc, reconcile() {} });
  listeners.get('freeze')();
  assert.equal(coordinator.snapshot().phase, 'frozen');
  listeners.get('pagehide')({ persisted: true });
  assert.equal(coordinator.snapshot().phase, 'bfcache');
});