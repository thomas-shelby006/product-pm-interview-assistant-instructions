import test from 'node:test';
import assert from 'node:assert/strict';

const filterModule = await import('../shared/transcript-filter.js').catch(() => null);
const runtimeModule = await import('../content/runtime.js').catch(() => null);



test('provider yield progresses through a timer when hidden-window rAF is suspended', async () => {
  let frameCallback = null;
  let delay = null;
  await runtimeModule.yieldToProvider({
    requestFrame(callback) { frameCallback = callback; },
    setTimer(callback, value) { delay = value; callback(); return 1; },
    clearTimer() {},
    fallbackMs: 25
  });
  assert.equal(typeof frameCallback, 'function');
  assert.equal(delay, 25);
});

test('provider yield wakes on a DOM mutation when hidden timers and rAF are suspended', async () => {
  let mutationCallback = null;
  let disconnected = false;
  class FakeMutationObserver {
    constructor(callback) { mutationCallback = callback; }
    observe(target, options) {
      assert.equal(target.id, 'root');
      assert.equal(options.subtree, true);
    }
    disconnect() { disconnected = true; }
  }
  const waiting = runtimeModule.yieldToProvider({
    requestFrame() {},
    setTimer() { return 9; },
    clearTimer() {},
    MutationObserverCtor: FakeMutationObserver,
    observeTarget: { id: 'root' }
  });
  mutationCallback();
  await waiting;
  assert.equal(disconnected, true);
});

test('provider yield settles once when a visible frame wins before the fallback', async () => {
  let resolutions = 0;
  let timerCallback = null;
  await runtimeModule.yieldToProvider({
    requestFrame(callback) { queueMicrotask(callback); },
    setTimer(callback) { timerCallback = callback; return 7; },
    clearTimer(value) { if (value === 7) resolutions += 1; }
  });
  timerCallback?.();
  assert.equal(resolutions, 1);
});

test('transcript filter suppresses filler and incomplete fragments', () => {
  assert.ok(filterModule, 'transcript filter module must exist');
  assert.equal(filterModule.isActionableTranscript('okay'), false);
  assert.equal(filterModule.isActionableTranscript('I wanted to ask about'), false);
  assert.equal(filterModule.isActionableTranscript('How would you prioritize this launch?'), true);
});

test('receiver controller never interrupts active generation for ordinary delivery', async () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const calls = [];
  const adapter = {
    isGenerating: () => true,
    stopGenerating: () => { calls.push('stop'); return true; },
    setComposerText: text => { calls.push(['set', text]); return true; },
    submit: () => { calls.push('submit'); return true; },
    getLatestAssistantText: () => ''
  };
  const controller = runtimeModule.createReceiverController({
    adapter,
    sleep: async () => {},
    onStatus: status => calls.push(['status', status])
  });
  const result = await controller.deliver({ id: 'm2', text: 'latest question' });
  assert.equal(result, false);
  assert.deepEqual(calls, [['status', 'RECEIVER BUSY']]);
});

test('receiver controller rejects empty delivery without touching composer', async () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  let touched = false;
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: () => { touched = true; },
      submit: () => true,
      getLatestAssistantText: () => ''
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  assert.equal(await controller.deliver({ id: 'm', text: '   ' }), false);
  assert.equal(touched, false);
});

test('runtime title uses role and provider and is restored after mutation', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const doc = { title: 'Claude' };
  const target = runtimeModule.runtimeTitle({ role: 'receiver', provider: 'claude' });
  assert.equal(target, 'PMIA_RECEIVER_CLAUDE');
  const restore = runtimeModule.defendTitle(doc, target, null);
  assert.equal(doc.title, target);
  doc.title = 'Changed by provider';
  restore();
  assert.equal(doc.title, target);
});

test('session export redacts the complete setup prompt', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const input = 'Session context:\nCompany: Acme\nAvoid mentioning: private topic\nAdditional notes:\nprivate note\nResume:\nprivate resume\n\nJob Description:\nprivate jd';
  const result = runtimeModule.redactSensitiveSessionText(input);
  assert.equal(result, '[Session setup redacted from session log]');
  assert.doesNotMatch(result, /Acme|private topic|private note|private resume|private jd/);
});


test('runtime title includes session suffix so stale windows cannot be reused', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  assert.equal(
    runtimeModule.runtimeTitle({ role: 'sender', provider: 'chatgpt', sessionId: 'pmia_20260720_1234' }),
    'PMIA_SENDER_CHATGPT_PMIA_20260720_1234'
  );
});


test('ordinary receiver delivery never invokes the stop-generation surface', async () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => true,
      stopGenerating: () => { calls.push('stop'); return true; },
      setComposerText: text => { calls.push(['set', text]); return true; },
      submit: () => { calls.push('submit'); return true; }
    },
    sleep: async () => {},
    onStatus: status => calls.push(['status', status])
  });
  assert.equal(await controller.deliver({ id: 'm3', text: 'replacement' }), false);
  assert.deepEqual(calls, [['status', 'RECEIVER BUSY']]);
});

test('receiver preview updates composer without stopping or submitting', () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => true,
      stopGenerating: () => { calls.push('stop'); return true; },
      setComposerText: text => { calls.push(['set', text]); return true; },
      submit: () => { calls.push('submit'); return true; }
    },
    sleep: async () => {},
    onStatus: status => calls.push(['status', status])
  });
  assert.equal(controller.preview({
    turnKey: 'u1', text: 'How would', revision: 1, seq: 1, phase: 'interim'
  }), true);
  assert.deepEqual(calls, [['set', 'How would']]);
});

test('receiver preview ignores stale global sequence and supports explicit clear', () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: text => { calls.push(text); return true; },
      submit: () => true
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  assert.equal(controller.preview({ turnKey: 'u1', text: 'newer', revision: 2, seq: 5, phase: 'interim' }), true);
  assert.equal(controller.preview({ turnKey: 'u1', text: 'older', revision: 1, seq: 4, phase: 'interim' }), false);
  assert.equal(controller.preview({ turnKey: 'u1', text: '', revision: 3, seq: 6, phase: 'clear' }), true);
  assert.deepEqual(calls, ['newer', '']);
});

test('receiver final replaces provisional text and submits exactly once', async () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: text => { calls.push(['set', text]); return true; },
      submit: () => { calls.push('submit'); return true; }
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  controller.preview({ turnKey: 'u1', text: 'How would you', revision: 1, seq: 1, phase: 'interim' });
  assert.equal(await controller.deliver({ id: 'final-1', text: 'How would you launch this product?' }), true);
  assert.deepEqual(calls, [
    ['set', 'How would you'],
    ['set', 'How would you launch this product?'],
    'submit'
  ]);
});

test('receiver submits immediately when provider composer is ready', async () => {
  let current = '';
  let yields = 0;
  let submissions = 0;
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText(text) { current = text; return true; },
      composerContains: text => current === text,
      canSubmit: () => true,
      submit() { submissions += 1; return true; }
    },
    sleep: async () => {},
    yieldFn: async () => { yields += 1; },
    onStatus: () => {}
  });

  assert.equal(await controller.deliver({ id: 'ready', text: 'ready question' }), true);
  assert.equal(submissions, 1);
  assert.equal(yields, 0);
});

test('receiver performs one bounded readiness yield before submitting', async () => {
  let current = '';
  let ready = false;
  let yields = 0;
  let submissions = 0;
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText(text) { current = text; return true; },
      composerContains: text => current === text,
      canSubmit: () => ready,
      submit() { submissions += 1; return true; }
    },
    sleep: async () => {},
    yieldFn: async () => { yields += 1; ready = true; },
    maxSubmitChecks: 2,
    onStatus: () => {}
  });

  assert.equal(await controller.deliver({ id: 'delayed', text: 'delayed question' }), true);
  assert.equal(submissions, 1);
  assert.equal(yields, 1);
});

test('receiver accepts sequence restart from a new preview stream', () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: text => { calls.push(text); return true; },
      submit: () => true
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  assert.equal(controller.preview({
    streamId: 'page-a', turnKey: 'u1', text: 'old page', revision: 1, seq: 8
  }), true);
  assert.equal(controller.preview({
    streamId: 'page-a', turnKey: 'u1', text: 'stale old page', revision: 2, seq: 7
  }), false);
  assert.equal(controller.preview({
    streamId: 'page-b', turnKey: 'u1', text: 'new page', revision: 1, seq: 1
  }), true);
  assert.deepEqual(calls, ['old page', 'new page']);
});

test('receiver bounds provisional turn state and evicts the oldest turn', () => {
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: () => true,
      submit: () => true
    },
    sleep: async () => {},
    maxPreviewTurns: 2,
    onStatus: () => {}
  });
  assert.equal(controller.preview({ streamId: 'p', turnKey: 'u1', text: 'one', revision: 1, seq: 1 }), true);
  assert.equal(controller.preview({ streamId: 'p', turnKey: 'u2', text: 'two', revision: 1, seq: 2 }), true);
  assert.equal(controller.preview({ streamId: 'p', turnKey: 'u3', text: 'three', revision: 1, seq: 3 }), true);
  assert.equal(controller.preview({ streamId: 'p', turnKey: 'u1', text: 'one again', revision: 1, seq: 4 }), true);
});

test('successful final clears the exact provisional turn identity', async () => {
  let current = '';
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      stopGenerating: () => false,
      setComposerText: text => { current = text; return true; },
      composerContains: text => current === text,
      canSubmit: () => true,
      submit: () => true
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  assert.equal(controller.preview({
    streamId: 'page-a', turnKey: 'u1', text: 'partial', revision: 7, seq: 1
  }), true);
  assert.equal(await controller.deliver({
    id: 'f1', text: 'final question',
    metadata: { previewStreamId: 'page-a', turnKey: 'u1' }
  }), true);
  assert.equal(controller.preview({
    streamId: 'page-a', turnKey: 'u1', text: 'fresh reuse', revision: 1, seq: 2
  }), true);
});

test('receiver waits for a late-mounted composer instead of rejecting the queued final', async () => {
  let attempts = 0;
  let current = '';
  let submissions = 0;
  const adapter = {
    setComposerText(text) {
      attempts += 1;
      if (attempts < 8) return false;
      current = text;
      return true;
    },
    composerContains: text => current === text,
    canSubmit: () => Boolean(current),
    submit() { submissions += 1; return true; }
  };

  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'PMIA_DEDUP_20260729_141000. Reply exactly PMIA_DEDUP_OK.',
    yieldFn: async () => {},
    maxChecks: 12
  });

  assert.equal(result, true);
  assert.equal(attempts, 8);
  assert.equal(submissions, 1);
});


test('receiver confirms a new provider user turn before acknowledging submission', async () => {
  const messages = [{ id: 'old-user', role: 'user', text: 'Earlier question' }];
  let yields = 0;
  const adapter = {
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => true,
    submit: () => true,
    getConversationMessages: () => messages
  };
  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'New question',
    yieldFn: async () => {
      yields += 1;
      if (yields === 2) messages.push({ id: 'new-user', role: 'user', text: 'New question' });
    },
    maxChecks: 2,
    maxConfirmChecks: 4
  });
  assert.equal(result, true);
  assert.equal(yields, 2);
});

test('receiver rejects an unconfirmed synthetic submit instead of reporting delivery', async () => {
  const adapter = {
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => true,
    submit: () => true,
    getConversationMessages: () => []
  };
  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'Question that never rendered',
    yieldFn: async () => {},
    maxChecks: 1,
    maxConfirmChecks: 3
  });
  assert.equal(result, false);
});


test('receiver retry acknowledges a late rendered turn without submitting twice', async () => {
  const messages = [];
  let submitCalls = 0;
  const adapter = {
    isGenerating: () => false,
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => true,
    submit() { submitCalls += 1; return true; },
    getConversationMessages: () => messages,
    findComposer: () => ({})
  };
  const controller = runtimeModule.createReceiverController({
    adapter,
    sleep: async () => {},
    yieldFn: async () => {},
    maxSubmitChecks: 1,
    maxConfirmChecks: 1
  });
  const envelope = { id: 'retry-envelope', text: 'Late rendered question' };
  assert.equal(await controller.deliver(envelope), false);
  messages.push({ id: 'late-user', role: 'user', text: envelope.text });
  assert.equal(await controller.deliver(envelope), true);
  assert.equal(submitCalls, 1);
});

test('confirmed provider turn clears only a stale matching receiver composer', async () => {
  let composer = '';
  const messages = [];
  let yields = 0;
  const adapter = {
    setComposerText(text) { composer = text; return true; },
    composerContains(text) { return composer === text; },
    canSubmit: () => true,
    submit: () => true,
    getConversationMessages: () => messages
  };
  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'Confirmed question',
    yieldFn: async () => {
      yields += 1;
      if (yields === 1) messages.push({ id: 'confirmed-user', role: 'user', text: 'Confirmed question' });
    },
    maxConfirmChecks: 3
  });
  assert.equal(result, true);
  assert.equal(composer, '');
});

test('confirmed provider turn preserves a newer receiver draft', async () => {
  let composer = '';
  const messages = [];
  const adapter = {
    setComposerText(text) { composer = text; return true; },
    composerContains(text) { return composer === text; },
    canSubmit: () => true,
    submit: () => true,
    getConversationMessages: () => messages
  };
  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'Submitted question',
    yieldFn: async () => {
      composer = 'Newer manual draft';
      messages.push({ id: 'submitted-user', role: 'user', text: 'Submitted question' });
    },
    maxConfirmChecks: 2
  });
  assert.equal(result, true);
  assert.equal(composer, 'Newer manual draft');
});


test('runtime lifecycle titles distinguish boot registered and ready phases', () => {
  const config = { role: 'sender', provider: 'claude', sessionId: 'pmia_060_test' };
  assert.equal(
    runtimeModule.runtimeLifecycleTitle(config, 'boot'),
    'PMIA_BOOT_SENDER_CLAUDE_PMIA_060_TEST'
  );
  assert.equal(
    runtimeModule.runtimeLifecycleTitle(config, 'registered'),
    'PMIA_REGISTERED_SENDER_CLAUDE_PMIA_060_TEST'
  );
  assert.equal(
    runtimeModule.runtimeLifecycleTitle(config, 'ready'),
    runtimeModule.runtimeTitle(config)
  );
});

test('title defender changes lifecycle target without creating another observer', () => {
  let observeCalls = 0;
  let disconnectCalls = 0;
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observeCalls += 1; }
    disconnect() { disconnectCalls += 1; }
  }
  const doc = { title: 'Provider', head: {} };
  const defend = runtimeModule.defendTitle(doc, 'PMIA_BOOT_SENDER_CHATGPT_X', Observer);
  assert.equal(doc.title, 'PMIA_BOOT_SENDER_CHATGPT_X');
  defend.setTarget('PMIA_REGISTERED_SENDER_CHATGPT_X');
  assert.equal(doc.title, 'PMIA_REGISTERED_SENDER_CHATGPT_X');
  defend.setTarget('PMIA_SENDER_CHATGPT_X');
  assert.equal(doc.title, 'PMIA_SENDER_CHATGPT_X');
  assert.equal(observeCalls, 1);
  defend.disconnect();
  assert.equal(disconnectCalls, 1);
});

test('transcript filter blocks provider status text without blocking real questions', () => {
  assert.equal(filterModule.isActionableTranscript('Transcribing?'), false);
  assert.equal(filterModule.isActionableTranscript('Listening...'), false);
  assert.equal(filterModule.isActionableTranscript('Processing audio'), false);
  assert.equal(filterModule.isActionableTranscript('How are you transcribing customer calls?'), true);
});

test('receiver default readiness window survives slow provider send-button activation', async () => {
  let yields = 0;
  let submitted = 0;
  const messages = [];
  const adapter = {
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => yields >= 150,
    submit() { submitted += 1; messages.push({ id: 'late', role: 'user', text: 'Slow provider question' }); return true; },
    getConversationMessages: () => messages
  };
  const result = await runtimeModule.submitComposerWhenReady({
    adapter,
    text: 'Slow provider question',
    yieldFn: async () => { yields += 1; }
  });
  assert.equal(result, true);
  assert.equal(submitted, 1);
  assert.ok(yields >= 150);
});

test('receiver submits boot context immediately and never stages it for the first question', async () => {
  const writes = [];
  const messages = [];
  let composer = '';
  let submits = 0;
  const adapter = {
    isGenerating: () => false,
    setComposerText(text) { composer = text; writes.push(text); return true; },
    composerContains: text => composer.includes(text),
    canSubmit: () => true,
    submit() { submits += 1; messages.push({ id:`boot-${submits}`, role:'user', text:composer }); return true; },
    getConversationMessages: () => messages,
    findComposer: () => ({}),
    clearComposer: () => true
  };
  const controller = runtimeModule.createReceiverController({ adapter, sleep: async () => {} });
  const accepted = await controller.deliver({ id: 'boot-1', kind: 'boot', text: 'SESSION CONTEXT' });
  assert.equal(accepted, true);
  assert.equal(writes.filter(Boolean)[0], 'SESSION CONTEXT');
  assert.equal(submits, 1);
  assert.equal(controller.hasStagedContext(), false);
});

test('receiver sends boot and first interviewer question as separate provider turns', async () => {
  const writes = [];
  const messages = [];
  let composer = '';
  const adapter = {
    isGenerating: () => false,
    setComposerText(text) { composer = text; writes.push(text); return true; },
    composerContains: text => composer.includes(text),
    canSubmit: () => true,
    submit() { messages.push({ id:`user-${messages.length + 1}`, role:'user', text:composer }); return true; },
    getConversationMessages: () => messages,
    findComposer: () => ({}),
    clearComposer: () => true
  };
  const controller = runtimeModule.createReceiverController({ adapter, sleep: async () => {} });
  assert.equal(await controller.deliver({ id:'boot-1', kind:'boot', text:'SESSION CONTEXT' }), true);
  assert.equal(await controller.deliver({ id:'q1', kind:'question', text:'First question?' }), true);
  assert.deepEqual(writes.filter(Boolean).slice(0, 2), ['SESSION CONTEXT', 'First question?']);
  assert.equal(controller.hasStagedContext(), false);
});

test('receiver reports boot failure instead of silently staging an unsent prompt', async () => {
  const adapter = {
    isGenerating: () => false,
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => false,
    submit: () => false,
    getConversationMessages: () => [],
    findComposer: () => ({})
  };
  const controller = runtimeModule.createReceiverController({
    adapter, sleep: async () => {}, maxSubmitChecks: 1, maxConfirmChecks: 1
  });
  assert.equal(await controller.deliver({ id:'boot-1', kind:'boot', text:'SESSION CONTEXT' }), false);
  assert.equal(controller.hasStagedContext(), false);
});

test('boot rendered-turn confirmation tolerates provider normalization without resubmission', async () => {
  const boot = 'Context with smart “quotes”.';
  const messages = [];
  let submitCalls = 0;
  const adapter = {
    isGenerating: () => false,
    setComposerText: () => true,
    composerContains: () => true,
    canSubmit: () => true,
    submit() { submitCalls += 1; return true; },
    getConversationMessages: () => messages,
    findComposer: () => ({})
  };
  const controller = runtimeModule.createReceiverController({
    adapter,
    sleep: async () => {},
    yieldFn: async () => {
      if (!messages.length) messages.push({ id:'rendered-boot', role:'user', text:'Context with smart "quotes".' });
    },
    maxSubmitChecks: 1,
    maxConfirmChecks: 2
  });
  assert.equal(await controller.deliver({ id:'boot', kind:'boot', text:boot }), true);
  assert.equal(submitCalls, 1);
});

test('transcript filter ignores translating placeholders until exact provider text arrives', () => {
  assert.equal(filterModule.isTransientTranscriptStatus('Translating...'), true);
  assert.equal(filterModule.isActionableTranscript('Translating?'), false);
  assert.equal(filterModule.isActionableTranscript('How would you improve activation?'), true);
});


test('voice transcript boundary removes Unicode and composite provider placeholders', () => {
  assert.equal(filterModule.sanitizeTranscriptCandidate('Transcribing…'), '');
  assert.equal(
    filterModule.sanitizeTranscriptCandidate('Transcribing…\nHow would you measure onboarding activation?'),
    'How would you measure onboarding activation?'
  );
  assert.equal(
    filterModule.sanitizeTranscriptCandidate('How would you measure onboarding activation?\nListening...'),
    'How would you measure onboarding activation?'
  );
  let now = 1000;
  const cache = filterModule.createRecentTranscriptCache({ nowFn: () => now, ttlMs: 30000 });
  const question = 'How would you measure onboarding activation?';
  assert.equal(cache.accept(question, 'preview'), true);
  assert.equal(cache.accept(question, 'preview'), false);
  assert.equal(cache.accept(question, 'final'), true);
  assert.equal(cache.accept(question, 'final'), false);
  assert.equal(cache.accept(question, 'final', 'turn-1'), true);
  assert.equal(cache.accept(question, 'final', 'turn-1'), false);
  assert.equal(cache.accept('How would you measure onboarding activation differently?', 'final', 'turn-1'), false);
  assert.equal(cache.accept(question, 'final', 'turn-2'), true);
  assert.equal(cache.accept(question, 'preview', 'turn-1'), true);
  assert.equal(cache.accept(question, 'preview', 'turn-1'), false);
  assert.equal(cache.accept(question, 'preview', 'turn-2'), true);
  now += 30001;
  assert.equal(cache.accept(question, 'final'), true);
});

test('receiver ignores transient voice preview without overwriting its composer', () => {
  const calls = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      setComposerText: text => { calls.push(text); return true; },
      submit: () => true
    },
    sleep: async () => {},
    onStatus: () => {}
  });
  assert.equal(controller.preview({
    streamId: 'voice', turnKey: 'u1', text: 'Transcribing…', revision: 1, seq: 1
  }), false);
  assert.deepEqual(calls, []);
});

test('receiver retries one swallowed provider submit and confirms the rendered turn', async () => {
  let composer = '';
  let submitCalls = 0;
  const messages = [];
  const question = 'How would you improve activation for this onboarding flow?';
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      setComposerText(text) { composer = text; return true; },
      composerContains: text => composer === text,
      canSubmit: () => true,
      submit() {
        submitCalls += 1;
        if (submitCalls === 2) {
          messages.push({ id: 'u2', role: 'user', text: composer });
          composer = '';
        }
        return true;
      },
      getConversationMessages: () => messages,
      findComposer: () => ({})
    },
    sleep: async () => {},
    yieldFn: async () => {},
    maxSubmitChecks: 1,
    maxConfirmChecks: 50,
    onStatus: () => {}
  });
  assert.equal(await controller.deliver({ id: 'voice-final', kind: 'question', text: question }), true);
  assert.equal(submitCalls, 2);
  assert.equal(messages.at(-1).text, question);
});


test('overflow safety wraps long provider content without removing provider nodes', async () => {
  const module = await import('../content/runtime.js');
  const appended = [];
  const doc = {
    getElementById() { return null; },
    createElement() {
      return { id: '', textContent: '', remove() { this.removed = true; } };
    },
    head: { appendChild(node) { appended.push(node); } },
    documentElement: { appendChild(node) { appended.push(node); } }
  };
  const remove = module.installOverflowSafety(doc);
  assert.equal(appended.length, 1);
  assert.match(appended[0].textContent, /overflow-wrap: anywhere/);
  assert.match(appended[0].textContent, /white-space: pre-wrap/);
  assert.doesNotMatch(appended[0].textContent, /display:\s*none|removeChild|innerHTML/);
  remove();
  assert.equal(appended[0].removed, true);
});


test('receiver emits verified provider-rendered proof after submission', async () => {
  const messages = [];
  let composer = '';
  const proofs = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      setComposerText(text) { composer = text; return true; },
      composerContains: text => composer === text,
      canSubmit: () => true,
      submit() { messages.push({ id: 'user-1', role: 'user', text: composer }); return true; },
      getConversationMessages: () => [...messages],
      findComposer: () => ({})
    },
    sleep: async () => {},
    yieldFn: async () => {},
    maxSubmitChecks: 1,
    maxConfirmChecks: 1,
    onProof: proof => proofs.push(proof)
  });
  assert.equal(await controller.deliver({ id: 'q1', kind: 'question', text: 'Question?' }), true);
  assert.deepEqual(proofs.at(-1), {
    envelopeId: 'q1', ok: true, verified: true, proof: 'new_rendered_turn'
  });
});

test('receiver reports the owning proof failure reason', async () => {
  const proofs = [];
  const controller = runtimeModule.createReceiverController({
    adapter: {
      isGenerating: () => false,
      setComposerText: () => false,
      canSubmit: () => false,
      submit: () => false,
      getConversationMessages: () => [],
      findComposer: () => null
    },
    sleep: async () => {},
    yieldFn: async () => {},
    maxSubmitChecks: 0,
    maxConfirmChecks: 0,
    onProof: proof => proofs.push(proof)
  });
  assert.equal(await controller.deliver({ id: 'q2', kind: 'question', text: 'Question?' }), false);
  assert.equal(proofs.at(-1).reason, 'receiver_composer_missing');
});


test('receiver retries one swallowed submit after elapsed time even when hidden checks are sparse', async () => {
  let now = 0;
  let composer = '';
  let submitCalls = 0;
  let yields = 0;
  const messages = [];
  const question = 'Elapsed-time retry question?';
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => false,
      submit() {
        submitCalls += 1;
        if (submitCalls === 2) messages.push({ id: 'u2', role: 'user', text: composer });
        return true;
      },
      getConversationMessages: () => messages
    },
    text: question,
    nowFn: () => now,
    yieldFn: async () => { yields += 1; now += 13000; return 'heartbeat'; },
    retryAfterMs: 12000,
    maxConfirmWaitMs: 45000,
    maxConfirmChecks: 640
  });
  assert.equal(result, true);
  assert.equal(submitCalls, 2);
  assert.equal(yields, 1);
});

test('receiver proof confirmation terminates by elapsed time when no rendered turn appears', async () => {
  let now = 0;
  let composer = '';
  let yields = 0;
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => false,
      submit: () => true,
      getConversationMessages: () => []
    },
    text: 'Bounded confirmation question?',
    nowFn: () => now,
    yieldFn: async () => { yields += 1; now += 15000; return 'heartbeat'; },
    maxSubmitAttempts: 1,
    retryAfterMs: 12000,
    maxConfirmWaitMs: 30000,
    maxConfirmChecks: 640
  });
  assert.equal(result, false);
  assert.equal(yields, 2);
});


test('receiver retries once when submit clears the composer without rendering a user turn', async () => {
  let now = 0;
  let composer = '';
  let submitCalls = 0;
  const messages = [];
  const question = 'Retry a cleared swallowed submission?';
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      getComposerText: () => composer,
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => false,
      submit() {
        submitCalls += 1;
        const submitted = composer;
        composer = '';
        if (submitCalls === 2) messages.push({ id: 'u2', role: 'user', text: submitted });
        return true;
      },
      getConversationMessages: () => messages
    },
    text: question,
    nowFn: () => now,
    yieldFn: async () => { now += 13000; return 'heartbeat'; },
    retryAfterMs: 12000,
    retryAfterEmptyComposerMs: 12000,
    maxConfirmWaitMs: 30000,
    maxConfirmChecks: 4
  });
  assert.equal(result, true);
  assert.equal(submitCalls, 2);
});

test('receiver does not retry an empty composer while provider generation is active', async () => {
  let now = 0;
  let composer = '';
  let submitCalls = 0;
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      getComposerText: () => composer,
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => true,
      submit() { submitCalls += 1; composer = ''; return true; },
      getConversationMessages: () => []
    },
    text: 'Do not retry during generation',
    nowFn: () => now,
    yieldFn: async () => { now += 13000; return 'heartbeat'; },
    retryAfterEmptyComposerMs: 12000,
    maxConfirmWaitMs: 13000,
    maxConfirmChecks: 2
  });
  assert.equal(result, false);
  assert.equal(submitCalls, 1);
});

test('receiver preserves a newer provider draft instead of retrying swallowed text', async () => {
  let now = 0;
  let composer = '';
  let submitCalls = 0;
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      getComposerText: () => composer,
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => false,
      submit() { submitCalls += 1; composer = 'newer operator draft'; return true; },
      getConversationMessages: () => []
    },
    text: 'Original swallowed text',
    nowFn: () => now,
    yieldFn: async () => { now += 13000; return 'heartbeat'; },
    retryAfterEmptyComposerMs: 12000,
    maxConfirmWaitMs: 13000,
    maxConfirmChecks: 2
  });
  assert.equal(result, false);
  assert.equal(submitCalls, 1);
  assert.equal(composer, 'newer operator draft');
});

test('receiver stops empty-composer recovery after delivery supersession', async () => {
  let current = true;
  let composer = '';
  let submitCalls = 0;
  const result = await runtimeModule.submitComposerWhenReady({
    adapter: {
      setComposerText(text) { composer = text; return true; },
      getComposerText: () => composer,
      composerContains: text => composer === text,
      canSubmit: () => true,
      isGenerating: () => false,
      submit() { submitCalls += 1; composer = ''; return true; },
      getConversationMessages: () => []
    },
    text: 'Superseded question',
    isCurrent: () => current,
    yieldFn: async () => { current = false; return 'heartbeat'; },
    maxConfirmChecks: 2
  });
  assert.equal(result, false);
  assert.equal(submitCalls, 1);
});
test('runtime lifecycle exposes ARMED after boot context is admitted', () => {
  assert.equal(runtimeModule.runtimeLifecycleTitle({ role:'sender', provider:'chatgpt', sessionId:'s1' }, 'armed'), 'PMIA_ARMED_SENDER_CHATGPT_S1');
});