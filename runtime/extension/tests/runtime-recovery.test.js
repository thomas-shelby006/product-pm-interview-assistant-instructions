import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeRecovery } from '../content/runtime-recovery.js';

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); }
}

test('runtime recovery coalesces page and network restoration into one microtask', async () => {
  const win = new FakeTarget();
  const doc = new FakeTarget();
  doc.visibilityState = 'visible';
  const jobs = [];
  const reasons = [];
  const recovery = createRuntimeRecovery({
    window: win,
    document: doc,
    recover: async reason => reasons.push(reason),
    scheduleMicrotask: job => jobs.push(job)
  });
  win.emit('pageshow');
  win.emit('online');
  doc.emit('visibilitychange');
  assert.equal(jobs.length, 1);
  await jobs[0]();
  assert.equal(reasons.length, 1);
  recovery.disconnect();
});

test('runtime recovery ignores hidden visibility and removes listeners on disconnect', async () => {
  const win = new FakeTarget();
  const doc = new FakeTarget();
  doc.visibilityState = 'hidden';
  const jobs = [];
  const recovery = createRuntimeRecovery({
    window: win,
    document: doc,
    recover: async () => { throw new Error('must not recover'); },
    scheduleMicrotask: job => jobs.push(job)
  });
  doc.emit('visibilitychange');
  assert.equal(jobs.length, 0);
  recovery.disconnect();
  win.emit('pageshow');
  assert.equal(jobs.length, 0);
});
test('runtime recovery re-registers when a frozen page resumes', async () => {
  const win = new FakeTarget();
  const doc = new FakeTarget();
  doc.visibilityState = 'hidden';
  const jobs = [];
  const reasons = [];
  const recovery = createRuntimeRecovery({
    window: win,
    document: doc,
    recover: async reason => reasons.push(reason),
    scheduleMicrotask: job => jobs.push(job)
  });
  doc.emit('resume');
  assert.equal(jobs.length, 1);
  await jobs[0]();
  assert.deepEqual(reasons, ['resume']);
  recovery.disconnect();
  doc.emit('resume');
  assert.equal(jobs.length, 1);
});
