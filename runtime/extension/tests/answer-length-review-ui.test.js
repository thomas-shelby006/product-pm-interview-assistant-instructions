import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('review UI surfaces answer length and hard-cap exceptions', async () => {
  const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /Average answer length/);
  assert.match(dashboard, /Longest answer/);
  assert.match(dashboard, /Over 180-word cap/);
  assert.match(dashboard, /review\.averageAnswerWords/);
  assert.match(dashboard, /review\.maxAnswerWords/);
  assert.match(dashboard, /review\.answersOver180/);
});
