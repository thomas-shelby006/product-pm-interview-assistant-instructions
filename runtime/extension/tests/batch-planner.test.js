import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner, composeBatchPrompt, matchesRenderedBatch } from '../shared/batch-planner.js';

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
  assert.match(prompt.text, /EARLIER QUESTION 1:[\s\S]*Question 1[\s\S]*EARLIER QUESTION 2:[\s\S]*Question 2[\s\S]*LATEST QUESTION \(HIGHEST PRIORITY\):[\s\S]*Question 3/);
});


test('single-question batch is not wrapped with latest-focus instructions', () => {
  const prompt = composeBatchPrompt({ entries: [{ id: 'q1', envelope: envelope('q1', 1, 'What is activation?') }] });
  assert.equal(prompt.text, 'What is activation?');
  assert.equal(prompt.questionCount, 1);
  assert.equal(prompt.focusId, 'q1');
});

test('multi-question batch preserves all questions and prioritizes only the latest', () => {
  const entries = [
    { id: 'q1', envelope: envelope('q1', 1, 'What is activation?') },
    { id: 'q2', envelope: envelope('q2', 2, 'How would you measure retention?') },
    { id: 'q3', envelope: envelope('q3', 3, 'Which metric would you prioritize?') }
  ];
  const prompt = composeBatchPrompt({ entries });
  assert.match(prompt.text, /EARLIER QUESTION 1:[\s\S]*What is activation\?/);
  assert.match(prompt.text, /EARLIER QUESTION 2:[\s\S]*How would you measure retention\?/);
  assert.match(prompt.text, /LATEST QUESTION \(HIGHEST PRIORITY\):[\s\S]*Which metric would you prioritize\?/);
  assert.equal(prompt.focusId, 'q3');
  assert.equal(prompt.questionCount, 3);
  assert.match(prompt.fingerprint, /^[a-f0-9]{8}$/);
});

test('rendered batch reconciliation matches the frozen prompt', () => {
  const prompt = composeBatchPrompt({ entries: [
    { id: 'q1', envelope: envelope('q1', 1, 'First?') },
    { id: 'q2', envelope: envelope('q2', 2, 'Latest?') }
  ] });
  assert.equal(matchesRenderedBatch(prompt.text, prompt), true);
  assert.equal(matchesRenderedBatch(`You said: ${prompt.text}`, prompt), true);
  assert.equal(matchesRenderedBatch('Different question', prompt), false);
});


test('interrupt selection moves only the latest waiting final and preserves earlier arrivals', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1));
  const original = planner.freezeNext();
  planner.add(envelope('q2', 2));
  planner.add(envelope('q3', 3));
  planner.add(envelope('q4', 4));
  const selected = planner.interruptLatest(20);
  assert.equal(selected.interrupted.id, original.id);
  assert.deepEqual(selected.batch.prompt.memberIds, ['q4']);
  assert.deepEqual(planner.next().prompt.memberIds, ['q2', 'q3']);
});


test('batch planner restores the exported next-batch wrapper without losing entries', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1));
  planner.add(envelope('q2', 2));
  const restored = new BatchPlanner(planner.exportState());
  assert.equal(restored.nextSize, 2);
  assert.deepEqual(restored.next().prompt.memberIds, ['q1', 'q2']);
});
