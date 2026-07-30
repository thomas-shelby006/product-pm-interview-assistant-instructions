import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAUDE_SIGNAL_EVENT,
  parseClaudeVoiceFrame,
  normalizeClaudeSignalDetail
} from '../content/signals/protocol.js';
import { createClaudeSignalBridge } from '../content/signals/claude-isolated.js';

const finalFrame = JSON.stringify({
  type: 'message_complete',
  data: {
    message_uuid: 'human-1',
    sender: 'human',
    content: [{ type: 'text', text: 'How should we price the product?' }]
  }
});

test('Claude signal parser ignores binary voice frames', () => {
  assert.equal(parseClaudeVoiceFrame(new Uint8Array([1, 2, 3])), null);
  assert.equal(parseClaudeVoiceFrame(new ArrayBuffer(8)), null);
});

test('Claude signal parser treats interim text as preview only', () => {
  assert.deepEqual(parseClaudeVoiceFrame(JSON.stringify({
    type: 'transcript_interim',
    text: 'How should we price',
    utterance_seq: 6
  })), {
    type: 'voice_interim',
    text: 'How should we price',
    utteranceSeq: 6
  });
});

test('Claude signal parser maps only human message_complete to voice final', () => {
  assert.deepEqual(parseClaudeVoiceFrame(finalFrame), {
    type: 'voice_final',
    text: 'How should we price the product?',
    messageId: 'human-1'
  });
  assert.equal(parseClaudeVoiceFrame(JSON.stringify({
    type: 'message_complete',
    data: { sender: 'assistant', content: [{ type: 'text', text: 'Answer' }] }
  })), null);
});

test('Claude signal parser maps message_stop and voice boundaries without finalizing them', () => {
  assert.deepEqual(parseClaudeVoiceFrame(JSON.stringify({
    type: 'message_sse',
    event: { type: 'message_stop', data: { type: 'message_stop' } }
  })), { type: 'assistant_final_hint' });
  assert.deepEqual(parseClaudeVoiceFrame(JSON.stringify({
    type: 'user_input_end',
    speech_end_offset_ms: 2700
  })), { type: 'voice_boundary' });
});

test('Claude signal detail validation rejects unexpected page events', () => {
  assert.equal(normalizeClaudeSignalDetail({ channel: 'other', type: 'voice_final' }), null);
  assert.deepEqual(normalizeClaudeSignalDetail({
    channel: 'pmia-claude-voice-v1',
    type: 'voice_error',
    reason: 'idle_timeout'
  }), { type: 'voice_error', reason: 'idle_timeout' });
});

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name) { this.listeners.delete(name); }
  emit(detail) { this.listeners.get(CLAUDE_SIGNAL_EVENT)?.({ detail }); }
}

test('Claude isolated bridge emits one final signal per message id', () => {
  const target = new FakeTarget();
  const bridge = createClaudeSignalBridge(target);
  const received = [];
  const unsubscribe = bridge.subscribe(signal => received.push(signal));
  const detail = {
    channel: 'pmia-claude-voice-v1',
    type: 'voice_final',
    text: 'Final question?',
    messageId: 'human-1'
  };
  target.emit(detail);
  target.emit(detail);
  assert.deepEqual(received, [{
    type: 'voice_final',
    text: 'Final question?',
    messageId: 'human-1'
  }]);
  unsubscribe();
  bridge.disconnect();
  assert.equal(target.listeners.size, 0);
});

import { createClaudeSignalHandler } from '../content/signals/claude-runtime.js';

test('Claude signal handler forwards only final human voice text', async () => {
  const calls = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardText: async (...args) => calls.push(args),
    setStatus: () => {},
    onAssistantFinal: () => {}
  });
  await handler({ type: 'voice_interim', text: 'partial', utteranceSeq: 1 });
  await handler({ type: 'voice_boundary' });
  await handler({
    type: 'voice_final',
    text: 'What is the launch strategy?',
    messageId: 'human-2'
  });
  assert.deepEqual(calls, [[
    'What is the launch strategy?',
    'question',
    { source: 'voice_final', messageId: 'human-2', turnKey: 'claude-voice-1' }
  ]]);
});

test('Claude signal handler exposes assistant final and provider errors', async () => {
  const statuses = [];
  let assistantFinals = 0;
  const handler = createClaudeSignalHandler({
    role: 'receiver',
    forwardText: async () => { throw new Error('must not forward'); },
    setStatus: (...args) => statuses.push(args),
    onAssistantFinal: () => { assistantFinals += 1; }
  });
  await handler({ type: 'assistant_final_hint' });
  await handler({ type: 'voice_error', reason: 'idle_timeout' });
  assert.equal(assistantFinals, 1);
  assert.deepEqual(statuses.at(-1), ['VOICE IDLE TIMEOUT', 'error', 3500]);
});

test('Claude interruption preserves the utterance while an empty transcript resets it', () => {
  assert.deepEqual(parseClaudeVoiceFrame(JSON.stringify({
    type: 'server_interrupt'
  })), { type: 'voice_interrupt' });
  assert.deepEqual(parseClaudeVoiceFrame(JSON.stringify({
    type: 'transcript_empty'
  })), { type: 'voice_reset', reason: 'transcript_empty' });
});

test('Claude reset and repeated boundary signals never forward text', async () => {
  const forwarded = [];
  const statuses = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardText: async (...args) => forwarded.push(args),
    setStatus: (...args) => statuses.push(args),
    onAssistantFinal: () => {}
  });
  await handler({ type: 'voice_boundary' });
  await handler({ type: 'voice_boundary' });
  await handler({ type: 'voice_interrupt' });
  await handler({ type: 'voice_reset', reason: 'transcript_empty' });
  assert.deepEqual(forwarded, []);
  assert.deepEqual(statuses.at(-1), ['VOICE EMPTY', 'info', 1200]);
  assert.equal(statuses.some(([label]) => label === 'VOICE INTERRUPTED'), false);
});
test('Claude handler preserves growing interim text through interruption and clears on empty transcript', async () => {
  const previews = [];
  const finals = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardPreview: async value => previews.push(value),
    forwardText: async (...args) => finals.push(args),
    setStatus: () => {},
    onAssistantFinal: () => {}
  });
  await handler({ type: 'voice_interim', text: 'How should', utteranceSeq: 1 });
  await handler({ type: 'voice_interim', text: 'How should', utteranceSeq: 2 });
  await handler({ type: 'voice_interim', text: 'How should we price?', utteranceSeq: 3 });
  await handler({ type: 'voice_boundary' });
  await handler({ type: 'voice_interrupt' });
  await handler({ type: 'voice_interim', text: 'How should we price this product?', utteranceSeq: 4 });
  await handler({ type: 'voice_reset', reason: 'transcript_empty' });
  await handler({ type: 'voice_interim', text: 'What metric', utteranceSeq: 4 });
  assert.deepEqual(previews, [
    { turnKey: 'claude-voice-1', text: 'How should', revision: 1, phase: 'interim' },
    { turnKey: 'claude-voice-1', text: 'How should we price?', revision: 2, phase: 'interim' },
    { turnKey: 'claude-voice-1', text: 'How should we price this product?', revision: 3, phase: 'interim' },
    { turnKey: 'claude-voice-1', text: '', revision: 4, phase: 'clear' },
    { turnKey: 'claude-voice-2', text: 'What metric', revision: 1, phase: 'interim' }
  ]);
  assert.deepEqual(finals, []);
});

test('Claude human final commits once and starts a new preview turn', async () => {
  const previews = [];
  const finals = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardPreview: async value => previews.push(value),
    forwardText: async (...args) => finals.push(args),
    setStatus: () => {},
    onAssistantFinal: () => {}
  });
  await handler({ type: 'voice_interim', text: 'How would you', utteranceSeq: 1 });
  await handler({ type: 'voice_final', text: 'How would you launch?', messageId: 'human-7' });
  await handler({ type: 'voice_interim', text: 'What metric', utteranceSeq: 2 });
  assert.equal(finals.length, 1);
  assert.deepEqual(finals[0], [
    'How would you launch?', 'question',
    { source: 'voice_final', messageId: 'human-7', turnKey: 'claude-voice-1' }
  ]);
  assert.equal(previews.at(-1).turnKey, 'claude-voice-2');
  assert.equal(previews.at(-1).revision, 1);
});

test('Claude protocol activity remains active through boundary and clears on final', async () => {
  const states = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardPreview: async () => {},
    forwardText: async () => {},
    setStatus: () => {},
    onAssistantFinal: () => {},
    onVoiceStateChange: active => states.push(active)
  });
  await handler({ type: 'voice_active' });
  await handler({ type: 'voice_boundary' });
  await handler({ type: 'voice_final', text: 'Why?', messageId: 'human-9' });
  assert.deepEqual(states, [true, false]);
});

test('Claude interruption preserves protocol voice activity until final reset or error', async () => {
  const states = [];
  const handler = createClaudeSignalHandler({
    role: 'sender',
    forwardPreview: async () => {},
    forwardText: async () => {},
    setStatus: () => {},
    onAssistantFinal: () => {},
    onVoiceStateChange: active => states.push(active)
  });
  await handler({ type: 'voice_active' });
  await handler({ type: 'voice_interrupt' });
  await handler({ type: 'voice_error', reason: 'idle_timeout' });
  assert.deepEqual(states, [true, false]);
});