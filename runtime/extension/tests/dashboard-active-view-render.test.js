import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const activation = source.slice(
  source.indexOf('function activateDashboardView'),
  source.indexOf('function renderProduction')
);

test('active dashboard view renders synchronously before frame-dependent focus work', () => {
  const scheduleAt = activation.indexOf('scheduleRender();');
  const flushAt = activation.indexOf('renderScheduler.flush();');
  const frameAt = activation.indexOf('requestAnimationFrame');
  assert.ok(scheduleAt >= 0);
  assert.ok(flushAt > scheduleAt);
  assert.ok(frameAt > flushAt);
});

test('active-view flush preserves the normal coalesced render path', () => {
  assert.match(activation, /scheduleRender\(\);\s*renderScheduler\.flush\(\);/);
  assert.match(source, /renderScheduler\.schedule\(sections, pending => render/);
});
