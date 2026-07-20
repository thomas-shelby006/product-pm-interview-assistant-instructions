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

test('stable transcript forwarder emits only changed stable text', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const forwarder = new runtimeModule.StableTranscriptForwarder({ stableMs: 500 });
  assert.equal(forwarder.consider('How would you', 0), null);
  assert.equal(forwarder.consider('How would you prioritize this launch?', 200), null);
  assert.equal(forwarder.poll(600), null);
  assert.equal(forwarder.poll(701), 'How would you prioritize this launch?');
  assert.equal(forwarder.consider('How would you prioritize this launch?', 900), null);
  assert.equal(forwarder.poll(1500), null);
});

test('stable transcript forwarder ignores non-actionable text', () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const forwarder = new runtimeModule.StableTranscriptForwarder({ stableMs: 100 });
  forwarder.consider('yeah', 0);
  assert.equal(forwarder.poll(500), null);
});

test('receiver controller supersedes active generation with latest prompt', async () => {
  assert.ok(runtimeModule, 'runtime module must exist');
  const calls = [];
  const adapter = {
    isGenerating: () => true,
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
