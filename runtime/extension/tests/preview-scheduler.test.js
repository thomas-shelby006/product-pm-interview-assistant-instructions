import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestPreviewScheduler } from '../content/preview-scheduler.js';

test('same-task preview bursts send only the newest candidate', async () => {
  const jobs = [];
  const sent = [];
  const scheduler = createLatestPreviewScheduler({
    send: async candidate => sent.push(candidate.text),
    scheduleMicrotask: job => jobs.push(job)
  });

  scheduler.push({ text: 'one' });
  scheduler.push({ text: 'one two' });
  scheduler.push({ text: 'one two three' });

  assert.equal(jobs.length, 1);
  await jobs[0]();
  assert.deepEqual(sent, ['one two three']);
});

test('disconnect drops a queued preview before its microtask runs', async () => {
  const jobs = [];
  const sent = [];
  const scheduler = createLatestPreviewScheduler({
    send: async candidate => sent.push(candidate.text),
    scheduleMicrotask: job => jobs.push(job)
  });

  scheduler.push({ text: 'discard me' });
  scheduler.disconnect();
  await jobs[0]();

  assert.deepEqual(sent, []);
});
