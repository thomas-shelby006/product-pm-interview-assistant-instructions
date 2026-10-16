import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeText } from '../simple/dom.js';

test('nodeText preserves line boundaries while normalizing horizontal whitespace', () => {
  const node = {
    innerText:'  first   line  \n second\tvalue \r\nthird   line  ',
    textContent:'fallback'
  };
  assert.equal(nodeText(node), 'first line\nsecond value\nthird line');
});

test('nodeText keeps blank line structure for gathered prompts', () => {
  const node = { innerText:'Question one\n\nQuestion two' };
  assert.equal(nodeText(node), 'Question one\n\nQuestion two');
});

test('nodeText chooses the equivalent representation with preserved line breaks', () => {
  const node = {
    innerText:'first line second line',
    textContent:'first line\nsecond line'
  };
  assert.equal(nodeText(node), 'first line\nsecond line');
});
