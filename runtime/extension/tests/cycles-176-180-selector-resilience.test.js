import test from 'node:test';
import assert from 'node:assert/strict';
import { SelectorProbeRegistry } from '../shared/selector-probe-registry.js';
import { mergeSelectorFallbackSets, prioritizeSelector } from '../shared/selector-fallback-set.js';
import { deriveDomDriftDelta } from '../shared/dom-drift-delta.js';
import { buildComposerOwnershipFingerprint, compareComposerOwnership } from '../shared/composer-ownership-fingerprint.js';
import { proveStableSendControl } from '../shared/stable-send-control-proof.js';

test('Cycle 176: selector probe registry returns the first working fallback and exact attempts', () => {
  const registry = new SelectorProbeRegistry(); registry.register('composer', ['#missing','#ready']);
  const result = registry.probe('composer', selector => selector === '#ready' ? { id: 'ready' } : null);
  assert.equal(result.selector, '#ready'); assert.equal(result.attempts.length, 2);
});

test('Cycle 177: fallback sets merge and promote proven selectors deterministically', () => {
  const merged = mergeSelectorFallbackSets({ composer: ['a','b'] }, { composer: ['b','c'], send: ['x'] });
  assert.deepEqual(merged.composer, ['a','b','c']);
  assert.deepEqual(prioritizeSelector(merged, 'composer', 'c').composer, ['c','a','b']);
});

test('Cycle 178: DOM drift reports removed critical surfaces separately', () => {
  const delta = deriveDomDriftDelta({ composer: { found: true, selector: '#a' } }, { composer: { found: false, selector: '' } }, 10);
  assert.equal(delta.critical.length, 1); assert.equal(delta.changes[0].surface, 'composer');
});

test('Cycle 179: composer ownership separates node replacement from text change', () => {
  const first = buildComposerOwnershipFingerprint({ provider: 'chatgpt', role: 'receiver', nodeKind: 'textarea', aria: 'Chat', text: 'a', editable: true, connected: true });
  const textChanged = buildComposerOwnershipFingerprint({ provider: 'chatgpt', role: 'receiver', nodeKind: 'textarea', aria: 'Chat', text: 'b', editable: true, connected: true });
  assert.equal(compareComposerOwnership(first, textChanged).sameOwner, true);
  assert.equal(compareComposerOwnership(first, textChanged).textChanged, true);
});

test('Cycle 180: send control requires repeated stable enabled samples', () => {
  const samples = [{ selector: '#send', visible: true, enabled: true, connected: true, composerReady: true, at: 10 }, { selector: '#send', visible: true, enabled: true, connected: true, composerReady: true, at: 20 }];
  assert.equal(proveStableSendControl(samples).ready, true);
  assert.equal(proveStableSendControl([{ ...samples[0], enabled: false }, samples[1]]).ready, false);
});
