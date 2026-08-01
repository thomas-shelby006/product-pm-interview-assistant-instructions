import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const required = [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap(item => item.js),
  'dashboard/index.html',
  'dashboard/dashboard.css',
  'dashboard/dashboard.js',
  'dashboard/dashboard-model.js',
  'dashboard/readiness-model.js',
  'dashboard/health-report-model.js',
  'dashboard/self-test-model.js',
  'shared/delivery-ledger.js',
  'shared/contiguous-sequence-buffer.js',
  'shared/session-mutation-coordinator.js',
  'shared/storage-accounting.js',
  'shared/runtime-self-test.js',
  'shared/snapshot-delta.js',
  'shared/recovery-state-machine.js'
];

for (const path of required) {
  const info = await stat(resolve(root, path));
  if (!info.isFile()) throw new Error(`Referenced extension file is not a file: ${path}`);
}

async function collectJs(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collectJs(full));
    else if (/\.(?:js|mjs)$/.test(entry.name)) output.push(full);
  }
  return output;
}

const files = await collectJs(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(`Syntax validation failed: ${relative(root, file)}`);
  }
}

const forbidden = ['/backend-api/conversation', '/api/chat_conversations/', 'Authorization: Bearer'];
const runtimeFiles = files.filter(file => {
  const path = relative(root, file);
  return !path.startsWith('scripts') && !path.startsWith('tests');
});
for (const file of runtimeFiles) {
  const source = await readFile(file, 'utf8');
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`Private provider API marker found in ${relative(root, file)}: ${marker}`);
  }
}

const visibleRuntimeFiles = [
  ...runtimeFiles,
  resolve(root, 'dashboard/index.html'),
  resolve(root, 'dashboard/dashboard.css')
];
const mojibakeMarkers = ['\uFFFD', '\u00C2', '\u00E2'];
for (const file of visibleRuntimeFiles) {
  const source = await readFile(file, 'utf8');
  for (const marker of mojibakeMarkers) {
    if (source.includes(marker)) {
      throw new Error(`Mojibake marker found in ${relative(root, file)}: U+${marker.codePointAt(0).toString(16).toUpperCase()}`);
    }
  }
}


function relativeImportSpecifiers(source) {
  const output = [];
  const patterns = [
    /import\s+(?:[^'\"]+?\s+from\s+)?['\"](\.{1,2}\/[^'\"]+)['\"]/g,
    /import\(\s*['\"](\.{1,2}\/[^'\"]+)['\"]\s*\)/g,
    /export\s+[^'\"]+?\s+from\s+['\"](\.{1,2}\/[^'\"]+)['\"]/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) output.push(match[1]);
  }
  return output;
}

const productionFiles = new Set(runtimeFiles.map(file => resolve(file)));
const graphRoots = [
  resolve(root, manifest.background.service_worker),
  ...manifest.content_scripts.flatMap(item => item.js).map(path => resolve(root, path)),
  resolve(root, 'content/entry.js'),
  resolve(root, 'dashboard/dashboard.js')
];
const reachable = new Set();
const pending = [...graphRoots];
while (pending.length) {
  const file = resolve(pending.pop());
  if (reachable.has(file) || !productionFiles.has(file)) continue;
  reachable.add(file);
  const source = await readFile(file, 'utf8');
  for (const specifier of relativeImportSpecifiers(source)) {
    const target = resolve(dirname(file), specifier);
    const normalized = /\.(?:js|mjs)$/.test(target) ? target : `${target}.js`;
    if (productionFiles.has(normalized) && !reachable.has(normalized)) pending.push(normalized);
  }
}
const unreachable = [...productionFiles]
  .filter(file => !reachable.has(file))
  .map(file => relative(root, file));
if (unreachable.length) {
  throw new Error(`Unreachable production JavaScript modules: ${unreachable.join(', ')}`);
}

console.log(`Extension validation passed: ${files.length} JavaScript files, ${required.length} required runtime surfaces, and ${reachable.size} reachable production modules checked.`);
