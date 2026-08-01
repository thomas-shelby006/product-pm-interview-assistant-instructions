import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileGenerationTruth } from '../content/generation-truth.js';

test('stop control is authoritative active generation evidence', () => {
  const result = reconcileGenerationTruth({ adapterGenerating: true, stopAvailable: true, now: 1000 });
  assert.equal(result.generating, true);
  assert.equal(result.state, 'streaming');
  assert.equal(result.confidence, 'high');
  assert.equal(result.reason, 'stop_control');
});

test('contradictory adapter signal expires without current stop or text evidence', () => {
  const first = reconcileGenerationTruth({ adapterGenerating: true, now: 1000 });
  const result = reconcileGenerationTruth({ adapterGenerating: true, previous: first, now: 3000, staleAfterMs: 1000 });
  assert.equal(result.generating, false);
  assert.equal(result.state, 'idle');
  assert.equal(result.reason, 'stale_adapter_signal');
});

test('assistant text growth keeps answer streaming without a stop control', () => {
  const result = reconcileGenerationTruth({ adapterGenerating: false, textChanged: true, now: 2000 });
  assert.equal(result.generating, true);
  assert.equal(result.state, 'streaming');
  assert.equal(result.reason, 'assistant_text_growth');
});

test('provider final hint closes generation immediately', () => {
  const result = reconcileGenerationTruth({ adapterGenerating: true, stopAvailable: true, finalHintChanged: true, now: 3000 });
  assert.equal(result.generating, false);
  assert.equal(result.state, 'complete');
  assert.equal(result.reason, 'provider_final_hint');
});