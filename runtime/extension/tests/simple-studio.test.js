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

test('Studio opens a fresh MV3 port for each launch request instead of keeping an idle stale port', () => {
  const js = read('studio.js');
  assert.doesNotMatch(js, /^const port = chrome\.runtime\.connect/m);
  const requestBody = js.match(/function request\([\s\S]*?\n}\n/)?.[0] || '';
  assert.match(requestBody, /chrome\.runtime\.connect/);
  assert.match(requestBody, /onDisconnect/);
  assert.match(requestBody, /port\.disconnect/);
});
test('Studio treats Window 3 as production-default and labels Off as fallback', () => {
  const html = read('index.html');
  const w3 = html.match(/<label>Window 3<select id="comparisonProvider">([\s\S]*?)<\/select><\/label>/i)?.[1] || '';
  assert.match(w3, /<option value="chatgpt">ChatGPT<\/option>/i);
  assert.match(w3, /<option value="claude">Claude<\/option>/i);
  assert.match(w3, /Off · two-window fallback/i);
  assert.ok(w3.indexOf('value="chatgpt"') < w3.indexOf('value=""'));
});
