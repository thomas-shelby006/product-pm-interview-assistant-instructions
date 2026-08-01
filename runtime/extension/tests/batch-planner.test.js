import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner, composeBatchPrompt } from '../shared/batch-planner.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata: {}, createdAt: seq };
}

test('batch planner keeps one immutable active batch and one mutable next batch', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1));
  const active = planner.freezeNext(10);
  planner.add(envelope('q2', 2));
  planner.add(envelope('q3', 3));
  assert.deepEqual(active.prompt.memberIds, ['q1']);
  assert.deepEqual(planner.active().prompt.memberIds, ['q1']);
  assert.deepEqual(planner.next().prompt.memberIds, ['q2', 'q3']);
});

test('batch planner never drops accumulated finals and deduplicates only identity', () => {
  const planner = new BatchPlanner();
  for (let seq = 1; seq <= 100; seq += 1) planner.add(envelope(`q${seq}`, seq));
  assert.equal(planner.add(envelope('q1', 101)).duplicate, true);
  assert.equal(planner.nextSize, 100);
});

test('failed active batch returns every member to the front of the next batch', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1));
  planner.add(envelope('q2', 2));
  planner.freezeNext();
  planner.add(envelope('q3', 3));
  planner.failActive();
  assert.deepEqual(planner.next().prompt.memberIds, ['q1', 'q2', 'q3']);
});

test('batch prompt preserves arrival order', () => {
  const entries = [1, 2, 3].map(seq => ({ id: `q${seq}`, envelope: envelope(`q${seq}`, seq) }));
  const prompt = composeBatchPrompt({ entries });
  assert.deepEqual(prompt.memberIds, ['q1', 'q2', 'q3']);
  assert.match(prompt.text, /Question 1:[\s\S]*Question 2:[\s\S]*Question 3:/);
});
