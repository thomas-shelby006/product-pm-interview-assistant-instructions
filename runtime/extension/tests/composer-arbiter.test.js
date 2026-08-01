import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposerArbiter } from '../content/composer-arbiter.js';

function adapter() {
  return {
    text: '',
    getComposerText() { return this.text; },
    setComposerText(value) { this.text = String(value); return true; }
  };
}

test('batch draft may replace a provisional preview', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  assert.equal(arbiter.writePreview('Partial latest question'), true);
  assert.equal(arbiter.writeBatch('Question 1:\nEarlier\n\nLATEST QUESTION:\nLatest'), true);
  assert.equal(arbiter.snapshot().owner, 'batch');
});

test('preview cannot overwrite a protected batch draft', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writeBatch('Accumulated batch');
  assert.equal(arbiter.writePreview('New preview'), false);
  assert.equal(provider.text, 'Accumulated batch');
});

test('manual composer divergence blocks all automatic writes', () => {
  const provider = adapter();
  const conflicts = [];
  const arbiter = createComposerArbiter({ adapter: provider, onConflict: value => conflicts.push(value) });
  arbiter.writeBatch('Owned batch');
  provider.text = 'User edited this manually';
  assert.equal(arbiter.writeBatch('Replacement batch'), false);
  assert.equal(arbiter.writePreview('Preview'), false);
  assert.equal(arbiter.snapshot().owner, 'manual');
  assert.equal(conflicts.length, 1);
});

test('clearing a manual composer releases ownership for the next batch', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writePreview('Preview');
  provider.text = 'Manual edit';
  arbiter.observe();
  provider.text = '';
  assert.equal(arbiter.writeBatch('Next safe batch'), true);
});
