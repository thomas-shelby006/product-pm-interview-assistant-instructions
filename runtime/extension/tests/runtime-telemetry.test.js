import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySourceSilence, createRuntimeTelemetry } from '../content/runtime-telemetry.js';

function adapter() {
  return {
    findComposer: () => ({}),
    isGenerating: () => false,
    isVoiceActive: () => false
  };
}

test('runtime telemetry separates heartbeat from sender silence', async () => {
  let clock = 1000;
  const messages = [];
  const telemetry = createRuntimeTelemetry({
    runtimeConfig: { sessionId: 's1', role: 'sender', provider: 'chatgpt' },
    adapter: adapter(),
    send: async message => { messages.push(message); return { ok: true }; },
    now: () => clock,
    silenceWarningMs: 100,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  clock = 1200;
  await telemetry.publish({ force: true });
  assert.equal(messages.at(-1).telemetry.sourceSilent, true);
  assert.equal(messages.at(-1).telemetry.composerReady, true);
  telemetry.preview({ turnKey: 't1', revision: 1, text: 'Question', createdAt: clock });
  assert.equal(telemetry.snapshot().sourceSilent, false);
});

test('boot setup is redacted while live questions remain visible', () => {
  const telemetry = createRuntimeTelemetry({
    runtimeConfig: { sessionId: 's1', role: 'sender', provider: 'chatgpt' },
    adapter: adapter(),
    send: async () => ({ ok: true }),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  telemetry.final({ id: 'b1', kind: 'boot', text: 'Sensitive resume', createdAt: 1 });
  assert.equal(telemetry.snapshot().latestFinal.text, '[Session setup redacted]');
  telemetry.final({ id: 'q1', kind: 'question', text: 'How do you prioritize?', createdAt: 2 });
  assert.equal(telemetry.snapshot().latestFinal.text, 'How do you prioritize?');
});


test('source silence classifier distinguishes active voice stalls from ordinary idle silence', () => {
  assert.equal(classifySourceSilence({
    role: 'sender', voiceActive: true, lastSourceActivityAt: 1000, now: 8000
  }).state, 'voice_slow');
  assert.equal(classifySourceSilence({
    role: 'sender', voiceActive: true, lastSourceActivityAt: 1000, now: 17000
  }).state, 'voice_stalled');
  assert.equal(classifySourceSilence({
    role: 'sender', voiceActive: false, lastSourceActivityAt: 1000, now: 92000
  }).state, 'idle_silent');
});


test('receiver telemetry checkpoints safe batch identity for worker restart recovery', () => {
  const telemetry = createRuntimeTelemetry({
    runtimeConfig: { sessionId: 's1', role: 'receiver', provider: 'chatgpt' },
    adapter: adapter(),
    send: async () => ({ ok: true }),
    getBatchState: () => ({
      active: { batchId: 'b1', memberIds: ['q1'], questionCount: 1 },
      next: { memberIds: ['q2', 'q3'], questionCount: 2 },
      hold: true,
      autoSubmit: false
    }),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  assert.deepEqual(telemetry.snapshot().batchState, {
    active: { batchId: 'b1', memberIds: ['q1'], questionCount: 1 },
    next: { memberIds: ['q2', 'q3'], questionCount: 2 },
    hold: true,
    autoSubmit: false
  });
});

test('sender telemetry never includes receiver batch state', () => {
  const telemetry = createRuntimeTelemetry({
    runtimeConfig: { sessionId: 's1', role: 'sender', provider: 'chatgpt' },
    adapter: adapter(),
    send: async () => ({ ok: true }),
    getBatchState: () => ({ active: { batchId: 'should-not-leak' } }),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  assert.equal('batchState' in telemetry.snapshot(), false);
});
