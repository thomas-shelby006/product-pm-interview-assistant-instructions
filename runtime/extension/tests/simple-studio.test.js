import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../studio/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

test('Studio default surface is small and focused on launch essentials', () => {
  const html = read('index.html');
  for (const label of ['Window 1','Window 2','Window 3','Resume','Job description','Launch']) assert.match(html, new RegExp(label, 'i'));
  assert.match(html, /<details[^>]*>/i);
  assert.match(html, /More/i);
  assert.doesNotMatch(html, /Runtime Pilot|Recovery Console|Transport Drill|Session Navigator/i);
});

test('Studio launches provider windows through extension runtime, not AHK clipboard boot', () => {
  const js = read('studio.js');
  assert.match(js, /request\('launch_session'/);
  assert.match(js, /screen\.availWidth/);
  assert.match(js, /buildBootText/);
  assert.doesNotMatch(js, /clipboard|Ctrl\+Shift|WinActivate|SendBootContext/i);
});

test('Studio boot text is concise and separates static behavior from Resume and JD', () => {
  const js = read('studio.js');
  assert.match(js, /Product Manager interview assistant/i);
  assert.match(js, /Resume:/);
  assert.match(js, /Job description:/);
  assert.doesNotMatch(js, /MULTIPLE INTERVIEWER QUESTIONS WERE RECEIVED/i);
});
