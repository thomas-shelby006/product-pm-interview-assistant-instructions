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


test('restore PMIA resolution reinstates the exact protected draft', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writeBatch('Protected PMIA draft');
  provider.text = 'Manual edit';
  arbiter.observe();
  const result = arbiter.resolveConflict('restore_pmia');
  assert.equal(result.ok, true);
  assert.equal(provider.text, 'Protected PMIA draft');
  assert.equal(arbiter.snapshot().owner, 'batch');
});

test('merge resolution preserves manual prefix and exact PMIA payload', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writeBatch('Protected PMIA draft');
  provider.text = 'Manual context';
  arbiter.observe();
  const result = arbiter.resolveConflict('merge');
  assert.equal(result.ok, true);
  assert.match(provider.text, /^Manual context[\s\S]*Protected PMIA draft$/);
  assert.equal(arbiter.submissionTextFor('Protected PMIA draft'), provider.text);
  assert.equal(arbiter.snapshot().owner, 'batch');
});

test('keep manual acknowledges conflict without overwriting manual text', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writeBatch('Protected PMIA draft');
  provider.text = 'Manual content';
  arbiter.observe();
  const result = arbiter.resolveConflict('keep_manual');
  assert.equal(result.ok, true);
  assert.equal(provider.text, 'Manual content');
  assert.equal(arbiter.snapshot().owner, 'manual');
  assert.equal(arbiter.snapshot().conflict, null);
});


test('automatic writes remain blocked after Keep Manual until the composer clears', () => {
  const provider = adapter();
  const arbiter = createComposerArbiter({ adapter: provider });
  arbiter.writeBatch('Protected PMIA draft');
  provider.text = 'Manual content';
  arbiter.observe();
  arbiter.resolveConflict('keep_manual');
  assert.equal(arbiter.writeBatch('New automatic batch'), false);
  assert.equal(provider.text, 'Manual content');
});
