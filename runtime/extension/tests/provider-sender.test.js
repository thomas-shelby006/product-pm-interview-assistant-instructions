import test from 'node:test';
import assert from 'node:assert/strict';

const senderModule = await import('../content/senders/provider-sender.js').catch(() => null);
const message = (id, role, text) => ({ id, role, text });

test('provider sender emits only when the DOM tracker reaches a final boundary', () => {
  assert.ok(senderModule, 'provider sender module must exist');
  let messages = [message('old-u', 'user', 'Historical?'), message('old-a', 'assistant', 'Old')];
  const emitted = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => false
  };
  const sender = senderModule.createProviderSender({ adapter, onFinal: value => emitted.push(value) });
  messages = [...messages, message('u1', 'user', 'How would you launch this?')];
  sender.observe(1000);
  assert.deepEqual(emitted, []);
  messages = [...messages, message('a1', 'assistant', 'I would start')];
  sender.observe(1800);
  assert.deepEqual(emitted, [{ id: 'u1', text: 'How would you launch this?', boundary: 'assistant_successor' }]);
  sender.disconnect();
});

test('provider sender never schedules automatic fallback while voice is active', () => {
  assert.ok(senderModule, 'provider sender module must exist');
  let messages = [];
  const timers = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    onFinal: () => { throw new Error('must not emit'); },
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('u1', 'user', 'How would you')];
  sender.observe(0);
  assert.deepEqual(timers, []);
  sender.disconnect();
});

test('provider sender suppresses a DOM copy of an externally finalized voice turn', () => {
  assert.ok(senderModule, 'provider sender module must exist');
  let messages = [];
  const emitted = [];
  const adapter = { getConversationMessages: () => messages, isVoiceActive: () => false };
  const sender = senderModule.createProviderSender({ adapter, onFinal: value => emitted.push(value) });
  sender.markExternalFinal({ id: 'voice-1', text: 'What is the strategy?' });
  messages = [message('voice-1', 'user', 'What is the strategy?'), message('a1', 'assistant', 'Answer')];
  sender.observe(1000);
  assert.deepEqual(emitted, []);
  sender.disconnect();
});
test('provider sender mirrors distinct provisional text without finalizing it', () => {
  let messages = [];
  const previews = [];
  const finals = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    onPreview: value => previews.push(value),
    onFinal: value => finals.push(value)
  });
  messages = [message('u1', 'user', 'How would')];
  sender.observe(0);
  messages = [message('u1', 'user', 'How would')];
  sender.observe(50);
  messages = [message('u1', 'user', 'How would you improve activation?')];
  sender.observe(100);
  assert.deepEqual(previews, [
    { turnKey: 'u1', text: 'How would', revision: 1, phase: 'interim' },
    { turnKey: 'u1', text: 'How would you improve activation?', revision: 2, phase: 'interim' }
  ]);
  assert.deepEqual(finals, []);
  sender.disconnect();
});

test('provider sender uses a 300ms fallback only when voice is inactive and composer is empty', () => {
  let messages = [];
  const timers = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => false,
    isComposerEmpty: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    onFinal: () => {},
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('u1', 'user', 'How would you measure activation?')];
  sender.observe(100);
  assert.equal(timers.at(-1).delay, 320);
  sender.disconnect();
});

test('provider sender blocks fallback while submitted composer text remains present', () => {
  let messages = [];
  const timers = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => false,
    isComposerEmpty: () => false
  };
  const sender = senderModule.createProviderSender({
    adapter,
    onFinal: () => { throw new Error('must not emit'); },
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('u1', 'user', 'How would you measure activation?')];
  sender.observe(100);
  assert.deepEqual(timers, []);
  sender.disconnect();
});

test('provider sender accepts protocol voice activity in addition to DOM state', () => {
  let messages = [];
  const timers = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => false,
    isComposerEmpty: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    isVoiceActive: () => true,
    onFinal: () => { throw new Error('must not emit'); },
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('u1', 'user', 'How would you measure activation?')];
  sender.observe(100);
  assert.deepEqual(timers, []);
  sender.disconnect();
});

test('provider sender never previews transient provider status text', () => {
  let messages = [];
  const previews = [];
  const adapter = { getConversationMessages: () => messages, isVoiceActive: () => true };
  const sender = senderModule.createProviderSender({ adapter, onPreview: value => previews.push(value) });
  messages = [message('status-1', 'user', 'Transcribing?')];
  sender.observe(0);
  messages = [message('status-1', 'user', 'How would you improve activation?')];
  sender.observe(100);
  assert.deepEqual(previews, [
    { turnKey: 'status-1', text: 'How would you improve activation?', revision: 1, phase: 'interim' }
  ]);
  sender.disconnect();
});

test('provider sender can finalize a strongly punctuated stable ChatGPT voice turn', () => {
  let messages = [];
  const timers = [];
  const finals = [];
  let now = 0;
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => true,
    isComposerEmpty: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    allowVoiceFallback: true,
    onFinal: value => finals.push(value),
    nowFn: () => now,
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('voice-u1', 'user', 'How would you improve activation?')];
  sender.observe(now);
  assert.equal(timers.at(-1).delay, 320);
  now = 320;
  timers.at(-1).callback();
  assert.deepEqual(finals, [{
    id: 'voice-u1', text: 'How would you improve activation?', boundary: 'stable_tail_fallback'
  }]);
  sender.disconnect();
});

test('provider sender keeps unpunctuated active voice text provisional', () => {
  let messages = [];
  const timers = [];
  const adapter = {
    getConversationMessages: () => messages,
    isVoiceActive: () => true,
    isComposerEmpty: () => true
  };
  const sender = senderModule.createProviderSender({
    adapter,
    allowVoiceFallback: true,
    onFinal: () => { throw new Error('must not emit'); },
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  messages = [message('voice-u2', 'user', 'How would you improve activation')];
  sender.observe(0);
  assert.deepEqual(timers, []);
  sender.disconnect();
});
