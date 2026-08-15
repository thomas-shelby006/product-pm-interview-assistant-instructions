import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(extensionRoot, '..', '..');
const read = relative => readFile(resolve(repoRoot, relative), 'utf8');

const contract = /independent[^\n]{0,220}question[^\n]{0,220}answer all[^\n]{0,220}(arrival order|in order)[^\n]{0,220}latest[^\n]{0,120}(emphasis|priority)/i;

test('prompt and knowledge layers preserve independent queued questions like the lossless batch runtime', async () => {
  const [batch, launcher, boot, router, runtimeGuide, regressionGuide] = await Promise.all([
    read('runtime/extension/shared/batch-planner.js'),
    read('runtime/Final_2_Window_Extension.ahk'),
    read('project_source_files/PM_BOOT_PROMPT_FOR_AHK.md'),
    read('project_source_files/PM_INTERVIEW_ANSWER_ROUTER_SOURCE.md'),
    read('project_upload_bundle/03_SESSION_RUNTIME_AND_CONTEXT.md'),
    read('project_upload_bundle/04_TESTS_REVIEW_AND_MOCK_LOOP.md')
  ]);

  assert.match(batch, /Answer all questions, but focus primarily on the latest/i);
  for (const [name, source] of [['launcher', launcher], ['boot source', boot], ['router source', router], ['runtime guide', runtimeGuide], ['regression guide', regressionGuide]]) {
    assert.match(source, contract, `${name} must preserve independent queued questions and emphasize the latest`);
  }

  assert.doesNotMatch(boot, /stop-and-supersede with latest-question-wins sequencing/i);
  assert.doesNotMatch(boot, /Answer the latest actionable interviewer question; for follow-ups or interruptions, be shorter and do not restart the framework\./i);
  assert.doesNotMatch(router, /ARCHITECTURE_FIRST_PRINCIPLES_REVIEW\.md/);
  assert.doesNotMatch(runtimeGuide, /superseded after a newer final is proven/i);
});

test('session setup reference describes the current Session Studio and MV3 transport', async () => {
  const setup = await read('project_source_files/PM_INTERVIEW_SESSION_SETUP_TEMPLATE.md');
  assert.match(setup, /Session Studio/i);
  assert.match(setup, /Manifest V3|service worker/i);
  assert.match(setup, /structured.*metadata/i);
  assert.doesNotMatch(setup, /localStorage bridge/i);
  assert.doesNotMatch(setup, /structured dropdown version is planned/i);
  assert.doesNotMatch(setup, /ARCHITECTURE_FIRST_PRINCIPLES_REVIEW\.md|AHK_PHASE_2_IMPLEMENTATION_PLAN\.md/);
});

test('Project upload manifest points only to current repository orientation documents', async () => {
  const manifest = await read('project_upload_bundle/PROJECT_UPLOAD_BUNDLE_MANIFEST.md');
  assert.doesNotMatch(manifest, /ARCHITECTURE_FIRST_PRINCIPLES_REVIEW\.md|AHK_PHASE_2_IMPLEMENTATION_PLAN\.md/);
  assert.match(manifest, /AI_SYSTEM_CONTEXT\.md/);
  assert.match(manifest, /FILE_MAP\.md/);
});

test('maintained PM instruction sources contain no C1 control-character encoding damage', async () => {
  const [boot, setup] = await Promise.all([
    read('project_source_files/PM_BOOT_PROMPT_FOR_AHK.md'),
    read('project_source_files/PM_INTERVIEW_SESSION_SETUP_TEMPLATE.md')
  ]);
  assert.doesNotMatch(boot, /[\u0080-\u009f]/);
  assert.doesNotMatch(setup, /[\u0080-\u009f]/);
  assert.doesNotMatch(boot, /[âÃÂ]/);
  assert.doesNotMatch(setup, /[âÃÂ]/);
});

test('live AutoHotkey launcher contains no mojibake encoding damage', async () => {
  const launcher = await read('runtime/Final_2_Window_Extension.ahk');
  assert.doesNotMatch(launcher, /[\u0080-\u009f]/);
  assert.doesNotMatch(launcher, /[âÃÂ]/);
});
