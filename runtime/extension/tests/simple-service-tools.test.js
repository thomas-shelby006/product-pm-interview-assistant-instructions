import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../simple/service-worker.js', import.meta.url), 'utf8');

test('service worker owns only bounded session metadata and review stores', () => {
  assert.match(service, /buildSessionMeta/);
  assert.match(service, /pmia_simple_meta_v1_/);
  assert.match(service, /pmia_simple_markers_v1_/);
  assert.doesNotMatch(service, /Resume|jobDescription|resumeText|answerText/);
});

test('window tools are explicit UI commands only', () => {
  for (const command of ['focus_window','restore_layout','end_session']) assert.match(service, new RegExp(command));
  assert.match(service, /chrome\.windows\.update/);
  assert.match(service, /chrome\.windows\.remove/);
});

test('review inspection is request-response and display only', () => {
  assert.match(service, /inspect_request/);
  assert.match(service, /inspect_result/);
  assert.match(service, /get_review_data/);
  assert.match(service, /answerMetrics|buildSessionSummary/);
});
