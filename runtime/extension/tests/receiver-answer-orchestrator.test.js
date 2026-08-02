import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverAnswerOrchestrator } from '../content/receiver-answer-orchestrator.js';

function adapter() {
  return {
    text: '', generating: false, stop: false,
    getLatestAssistantText() { return this.text; },
    isGenerating() { return this.generating; },
    hasStopControl() { return this.stop; }
  };
}

test('orchestrator reconciles stale generation instead of trusting raw adapter state forever', () => {
  let clock = 1000;
  const provider = adapter();
  provider.generating = true;
  const runtime = createReceiverAnswerOrchestrator({ adapter: provider, now: () => clock, getHintVersion: () => 0 });
  assert.equal(runtime.observeGeneration().truth.generating, true);
  clock = 4000;
  assert.equal(runtime.observeGeneration().truth.generating, false);
  assert.equal(runtime.snapshot().generationState.reason, 'stale_adapter_signal');
});

test('orchestrator returns no response when answer never begins', async () => {
  let clock = 1000;
  const states = [];
  const runtime = createReceiverAnswerOrchestrator({
    adapter: adapter(),
    now: () => clock,
    getHintVersion: () => 0,
    wake: { async wait() { clock = 9000; } },
    onAnswerState(value) { states.push(value.state); },
    limits: { startGraceMs: 8000, streamStallMs: 20000, hardCapMs: 120000 }
  });
  const result = await runtime.start({ envelope: { id: 'b1' }, beforeText: '', hintVersionAtStart: 0 });
  assert.equal(result.answerState.state, 'no_response');
  assert.deepEqual(states, ['waiting', 'no_response']);
});

test('orchestrator reports completed answer once', async () => {
  let clock = 1000;
  let hint = 0;
  const provider = adapter();
  const terminal = [];
  const runtime = createReceiverAnswerOrchestrator({
    adapter: provider,
    now: () => clock,
    getHintVersion: () => hint,
    wake: { async wait() { provider.text = 'A complete answer'; hint = 1; clock = 2000; } },
    onTerminal(value) { terminal.push(value.answerState.state); }
  });
  const result = await runtime.start({ envelope: { id: 'b1' }, beforeText: '', hintVersionAtStart: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.answerState.state, 'complete');
  assert.deepEqual(terminal, ['complete']);
});

test('cancel produces one terminal cancelled state', () => {
  const terminal = [];
  const runtime = createReceiverAnswerOrchestrator({ adapter: adapter(), getHintVersion: () => 0, onTerminal(value) { terminal.push(value.answerState.state); } });
  runtime.prepare({ envelope: { id: 'b1' } });
  const first = runtime.cancel('role_revoked');
  const second = runtime.cancel('again');
  assert.equal(first.answerState.state, 'cancelled');
  assert.equal(second.answerState.state, 'cancelled');
  assert.deepEqual(terminal, ['cancelled']);
});

test('orchestrator snapshot is text-free', () => {
  const provider = adapter();
  provider.text = 'secret answer';
  const runtime = createReceiverAnswerOrchestrator({ adapter: provider, getHintVersion: () => 0 });
  runtime.observeGeneration();
  assert.doesNotMatch(JSON.stringify(runtime.snapshot()), /secret answer/);
});

test('no-response settlement never waits for observational logging', async () => {
  let clock = 1000;
  let logStarted = false;
  const runtime = createReceiverAnswerOrchestrator({
    adapter: adapter(),
    now: () => clock,
    getHintVersion: () => 0,
    wake: { async wait() { clock = 9000; } },
    log() { logStarted = true; return new Promise(() => {}); },
    limits: { startGraceMs: 8000, streamStallMs: 20000, hardCapMs: 120000 }
  });
  const result = await Promise.race([
    runtime.start({ envelope: { id: 'b-log' }, beforeText: '', hintVersionAtStart: 0 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('terminal settlement blocked by logging')), 100))
  ]);
  assert.equal(result.answerState.state, 'no_response');
  assert.equal(logStarted, true);
});
