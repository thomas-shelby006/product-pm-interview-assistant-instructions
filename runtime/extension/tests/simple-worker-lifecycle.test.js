import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../simple/service-worker.js', import.meta.url), 'utf8');

test('worker hydrates bounded session stages before review and reconnect publication', () => {
  assert.match(worker, /function loadStageLog\(sessionId\)/);
  assert.match(worker, /createStageLog\(\{ initial:stored\?\.\[stageKey\(sessionId\)\] \|\| \[\] \}\)/);
  assert.match(worker, /onRegister[\s\S]*Promise\.all\(\[loadMeta\(value\.sessionId\), loadStageLog\(value\.sessionId\)\]\)/);
  assert.match(worker, /reviewData[\s\S]*Promise\.all\(\[loadMeta\(sessionId\), loadStageLog\(sessionId\)\]\)/);
  assert.match(worker, /ui_register[\s\S]*loadStageLog\(sessionId\)/);
});

test('worker lifecycle recovery remains event driven with no heartbeat or background interval', () => {
  assert.doesNotMatch(worker, /chrome\.alarms|setInterval\s*\(|heartbeat/i);
});