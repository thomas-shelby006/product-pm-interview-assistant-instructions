import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));

if (manifest.version !== '0.12.0') throw new Error(`Expected PMIA 0.12.0, found ${manifest.version}`);
if (manifest.background?.service_worker !== 'simple/service-worker.js') {
  throw new Error('Active service worker must be simple/service-worker.js');
}

const required = [
  'simple/service-worker.js',
  ...manifest.content_scripts.flatMap(item => item.js || []),
  'studio/index.html', 'studio/studio.css', 'studio/studio.js',
  'cockpit/index.html', 'cockpit/cockpit.css', 'cockpit/cockpit.js'
];

for (const path of new Set(required)) {
  const info = await stat(resolve(root, path));
  if (!info.isFile()) throw new Error(`Required active surface is not a file: ${path}`);
}
async function collectJs(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collectJs(full));
    else if (/\.js$/.test(entry.name)) output.push(full);
  }
  return output;
}

const activeJs = [
  ...await collectJs(resolve(root, 'simple')),
  resolve(root, 'studio/studio.js'),
  resolve(root, 'cockpit/cockpit.js')
];

for (const file of activeJs) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(`Syntax validation failed: ${relative(root, file)}`);
  }
}
const forbidden = ['/backend-api/conversation', '/api/chat_conversations/', 'Authorization: Bearer'];
const visible = [
  ...activeJs,
  resolve(root, 'studio/index.html'), resolve(root, 'studio/studio.css'),
  resolve(root, 'cockpit/index.html'), resolve(root, 'cockpit/cockpit.css')
];

for (const file of visible) {
  const source = await readFile(file, 'utf8');
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`Private provider API marker found in ${relative(root, file)}: ${marker}`);
  }
  for (const marker of ['\uFFFD', '\u00C2', '\u00E2']) {
    if (source.includes(marker)) throw new Error(`Mojibake marker found in ${relative(root, file)}`);
  }
}

const activeScripts = manifest.content_scripts.flatMap(item => item.js || []);
if (activeScripts.some(path => path.startsWith('content/') || path.startsWith('dashboard/') || path.startsWith('shared/'))) {
  throw new Error(`Legacy content script remains active: ${activeScripts.join(', ')}`);
}
const exposed = manifest.web_accessible_resources.flatMap(item => item.resources || []);
if (exposed.some(path => /^(content|dashboard|shared)\//.test(path))) {
  throw new Error(`Legacy runtime resource remains exposed: ${exposed.join(', ')}`);
}
function importSpecifiers(source) {
  const values = [];
  for (const pattern of [
    /import\s+(?:[^'\"]+?\s+from\s+)?['\"](\.{1,2}\/[^'\"]+)['\"]/g,
    /import\(\s*['\"](\.{1,2}\/[^'\"]+)['\"]\s*\)/g,
    /export\s+[^'\"]+?\s+from\s+['\"](\.{1,2}\/[^'\"]+)['\"]/g
  ]) {
    for (const match of source.matchAll(pattern)) values.push(match[1]);
  }
  return values;
}

const activeSet = new Set(activeJs.map(file => resolve(file)));
const roots = [
  resolve(root, 'simple/service-worker.js'),
  resolve(root, 'simple/browser-entry.js'),
  resolve(root, 'studio/studio.js'),
  resolve(root, 'cockpit/cockpit.js')
];
const reachable = new Set();
const pending = [...roots];
while (pending.length) {
  const file = resolve(pending.pop());
  if (reachable.has(file) || !activeSet.has(file)) continue;
  reachable.add(file);
  const source = await readFile(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    const target = resolve(dirname(file), specifier);
    const normalized = /\.js$/.test(target) ? target : `${target}.js`;
    const rel = relative(root, normalized).replaceAll('\\', '/');
    if (!rel.startsWith('simple/') && !rel.startsWith('studio/') && !rel.startsWith('cockpit/')) {
      throw new Error(`Active runtime imports legacy/out-of-scope module: ${relative(root, file)} -> ${specifier}`);
    }
    if (activeSet.has(normalized) && !reachable.has(normalized)) pending.push(normalized);
  }
}

for (const rootFile of roots) {
  if (!reachable.has(rootFile)) throw new Error(`Active graph root is unreachable: ${relative(root, rootFile)}`);
}

if (manifest.action?.default_title !== 'Open PMIA Studio' || manifest.action?.default_popup) {
  throw new Error('Toolbar action must open the standalone PMIA Studio through the service worker.');
}

console.log(
  `Extension validation passed: ${activeJs.length} active JavaScript files, ` +
  `${new Set(required).size} required runtime surfaces, ${reachable.size} reachable active modules checked.`
);
