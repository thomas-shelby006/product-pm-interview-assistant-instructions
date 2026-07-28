import test from 'node:test';
import assert from 'node:assert/strict';

const filterModule = await import('../shared/transcript-filter.js').catch(() => null);
const runtimeModule = await import('../content/runtime.js').catch(() => null);

test('transcript filter suppresses filler and incomplete fragments', () => {
  assert.ok(filterModule, 'transcript filter module must exist');
  assert.equal(filterModule.isActionableTranscript('okay'), false);
  assert.equal(filterModule.isActionableTranscript('I wanted to ask about'), false);
  assert.equal(filterModule.isActionableTranscript('How would you prioritize this launch?'), true);
});

test('receiver controller supersedes active generation with latest prompt', async () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const calls = [];
  let generationChecks = 0;
  const adapter = {
    isGenerating: () => generationChecks++ === 0,
    stopGenerating: () => { calls.push('stop'); return true; },
    setComposerText: text => calls.push(['set', text]),
    submit: () => { calls.push('submit'); return true; },
    getLatestAssistantText: () => ''
  };
  const controller = runtimeModule.createReceiverController({
    adapter,
    sleep: async () => {},
    onStatus: status => calls.push(['status', status])
  });
  const result = await controller.deliver({ id: 'm2', text: 'latest question' });
  assert.equal(result, true);
  assert.deepEqual(calls.slice(0, 3), ['stop', ['status', 'SUPERSEDE'], ['set', 'latest question']]);
  assert.equal(calls.includes('submit'), true);
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

test('session export redacts Resume and Job Description bodies', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const input = 'Session context:\nCompany: Acme\nResume:\nprivate resume\n\nJob Description:\nprivate jd';
  const result = runtimeModule.redactSensitiveSessionText(input);
  assert.match(result, /Company: Acme/);
  assert.doesNotMatch(result, /private resume|private jd/);
  assert.match(result, /redacted/i);
});


test('runtime title includes session suffix so stale windows cannot be reused', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  assert.equal(
    runtimeModule.runtimeTitle({ role: 'sender', provider: 'chatgpt', sessionId: 'pmia_20260720_1234' }),
    'PMIA_SENDER_CHATGPT_PMIA_20260720_1234'
  );
});


test('receiver waits for generation to stop before writing replacement prompt', async () => {
  const calls = [];
  let checks = 0;
  const adapter = {
    isGenerating: () => checks++ < 3,
    stopGenerating: () => { calls.push('stop'); return true; },
    setComposerText: text => { calls.push(['set', text]); return true; },
    submit: () => { calls.push('submit'); return true; }
  };
  const controller = runtimeModule.createReceiverController({
    adapter,
    sleep: async ms => calls.push(['sleep', ms]),
    onStatus: status => calls.push(['status', status]),
    stopTimeoutMs: 1000,
    stopPollMs: 50
  });
  assert.equal(await controller.deliver({ id: 'm3', text: 'replacement' }), true);
  assert.equal(calls[0], 'stop');
  const setIndex = calls.findIndex(value => Array.isArray(value) && value[0] === 'set');
  const sleepCountBeforeSet = calls.slice(0, setIndex).filter(value => Array.isArray(value) && value[0] === 'sleep').length;
  assert.ok(sleepCountBeforeSet >= 2);
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
