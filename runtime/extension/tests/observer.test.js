import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderObserver } from '../content/observation/provider-observer.js';

class FakeMutationObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.disconnected = false;
    FakeMutationObserver.instances.push(this);
  }
  observe(target, options) { this.targets.push({ target, options }); }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([{ type: 'childList' }]); }
}

function createClock() {
  let callback = null;
  return {
    setIntervalFn(fn) { callback = fn; return 1; },
    clearIntervalFn() { callback = null; },
    tick() { callback?.(); }
  };
}

test('provider observer watches only adapter-owned roots and emits changes', () => {
  FakeMutationObserver.instances = [];
  const composer = { id: 'composer' };
  const conversation = { id: 'conversation' };
  let text = 'first question?';
  const received = [];
  const clock = createClock();
  const observer = createProviderObserver({
    adapter: {
      getObservationTargets: () => [composer, conversation],
      getSenderCandidateInfo: () => ({ text, source: 'composer' }),
      isVoiceActive: () => false
    },
    document: { visibilityState: 'visible' },
    onCandidate: candidate => received.push(candidate),
    MutationObserverCtor: FakeMutationObserver,
    scheduleMicrotask: fn => fn(),
    ...clock
  });
  assert.deepEqual(FakeMutationObserver.instances[0].targets.map(item => item.target), [composer, conversation]);
  assert.deepEqual(received, [{ text: 'first question?', source: 'composer' }]);
  text = 'second question?';
  FakeMutationObserver.instances[0].trigger();
  assert.equal(received.at(-1).text, 'second question?');
  observer.disconnect();
});

test('provider observer watchdog rebinds replaced provider roots', () => {
  FakeMutationObserver.instances = [];
  const first = { id: 'first' };
  const second = { id: 'second' };
  let targets = [first];
  const clock = createClock();
  const observer = createProviderObserver({
    adapter: {
      getObservationTargets: () => targets,
      getSenderCandidateInfo: () => ({ text: 'question?', source: 'user_message' }),
      isVoiceActive: () => false
    },
    document: { visibilityState: 'visible' },
    onCandidate: () => {},
    MutationObserverCtor: FakeMutationObserver,
    scheduleMicrotask: fn => fn(),
    ...clock
  });
  targets = [second];
  clock.tick();
  assert.equal(FakeMutationObserver.instances[0].disconnected, true);
  assert.deepEqual(FakeMutationObserver.instances.at(-1).targets.map(item => item.target), [second]);
  observer.disconnect();
});

test('provider observer suppresses hidden tabs unless native voice remains active', () => {
  FakeMutationObserver.instances = [];
  let voiceActive = false;
  const received = [];
  const clock = createClock();
  const document = { visibilityState: 'hidden' };
  const observer = createProviderObserver({
    adapter: {
      getObservationTargets: () => [{ id: 'root' }],
      getSenderCandidateInfo: () => ({ text: 'hidden question?', source: 'composer' }),
      isVoiceActive: () => voiceActive
    },
    document,
    onCandidate: candidate => received.push(candidate),
    MutationObserverCtor: FakeMutationObserver,
    scheduleMicrotask: fn => fn(),
    ...clock
  });
  assert.equal(received.length, 0);
  voiceActive = true;
  clock.tick();
  assert.equal(received.length, 1);
  observer.disconnect();
});