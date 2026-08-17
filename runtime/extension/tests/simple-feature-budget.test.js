import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function productionFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['tests','testing','scripts'].includes(entry.name)) continue;
      result.push(...productionFiles(full));
    } else if (['.js','.html','.css'].includes(path.extname(entry.name))) result.push(full);
  }
  return result;
}

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('active 0.12 user feature surface stays inside the simplicity budget', () => {
  const files = productionFiles(root);
  const lines = files.reduce((sum, file) => sum + fs.readFileSync(file, 'utf8').split(/\r?\n/).length, 0);
  assert.ok(files.length <= 45, `active production files grew to ${files.length}`);
  assert.ok(lines <= 2500, `active production lines grew to ${lines}`);
});
test('permissions and background activity remain minimal', () => {
  assert.deepEqual(manifest.permissions, ['storage','tabs','windows']);
  const worker = read('simple/service-worker.js');
  assert.doesNotMatch(worker, /chrome\.alarms/);
  assert.doesNotMatch(worker, /setInterval\s*\(/);
  const cockpit = read('cockpit/cockpit.js');
  assert.equal((cockpit.match(/setInterval\s*\(/g) || []).length, 1);
});

test('user feature modules never become delivery primitive dependencies', () => {
  const forbidden = /inspection|markers|session-tools|cockpit|session-summary/;
  for (const file of ['simple/sender.js','simple/fanout.js','simple/role-queue.js','simple/deliver-turn.js']) {
    assert.doesNotMatch(read(file), forbidden, `${file} imports user-feature code`);
  }
});

test('cockpit has one primary control set and no retired operator surface', () => {
  const html = read('cockpit/index.html');
  const controls = html.match(/<div class="controls"[\s\S]*?<\/div>/)?.[0] || '';
  assert.equal((controls.match(/<button/g) || []).length, 5);
  assert.doesNotMatch(html, /Runtime Pilot|Reliability Center|Operations Lab|Production Control/i);
});