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


test('source-aware forwarder waits longer for changing composer text than final user turns', () => {
  const forwarder = new runtimeModule.StableTranscriptForwarder({
    stableMs: 500,
    sourceStableMs: { composer: 1200, user_message: 200 }
  });
  forwarder.consider({ text: 'How would you price this?', source: 'composer' }, 0);
  assert.equal(forwarder.poll(500), null);
  assert.equal(forwarder.poll(1199), null);
  assert.equal(forwarder.poll(1200), 'How would you price this?');

  forwarder.consider({ text: 'What metric matters most?', source: 'user_message' }, 2000);
  assert.equal(forwarder.poll(2199), null);
  assert.equal(forwarder.poll(2200), 'What metric matters most?');
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
test('stable transcript forwarder preserves the candidate source', () => {
  const forwarder = new runtimeModule.StableTranscriptForwarder({
    sourceStableMs: { composer: 100 }
  });
  forwarder.consider({ text: 'Final pricing question?', source: 'composer' }, 0);
  assert.deepEqual(forwarder.pollCandidate(100), {
    text: 'Final pricing question?',
    source: 'composer'
  });
});


test('stable transcript forwarder reports remaining stabilization delay', () => {
  const forwarder = new runtimeModule.StableTranscriptForwarder({
    sourceStableMs: { composer: 1400, user_message: 300 }
  });
  forwarder.consider({ text: 'How should we launch?', source: 'composer' }, 100);
  assert.equal(forwarder.pendingDelay(600), 900);
  assert.equal(forwarder.pendingDelay(1500), 0);
  assert.equal(forwarder.pollCandidate(1500).source, 'composer');
  assert.equal(forwarder.pendingDelay(1500), null);
});

test('sender baseline suppresses historical submitted turns but preserves composer drafts', () => {
  const historical = new runtimeModule.StableTranscriptForwarder();
  assert.equal(runtimeModule.primeHistoricalCandidate(historical, {
    text: 'Old interview question?', source: 'user_message'
  }), true);
  historical.consider({ text: 'Old interview question?', source: 'user_message' }, 0);
  assert.equal(historical.pollCandidate(5000), null);

  const draft = new runtimeModule.StableTranscriptForwarder({
    sourceStableMs: { composer: 100 }
  });
  assert.equal(runtimeModule.primeHistoricalCandidate(draft, {
    text: 'Unsent draft question?', source: 'composer'
  }), false);
  draft.consider({ text: 'Unsent draft question?', source: 'composer' }, 0);
  assert.equal(draft.pollCandidate(100).text, 'Unsent draft question?');
});