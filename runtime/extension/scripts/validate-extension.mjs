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
  'dashboard/dashboard-model.js'
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
const runtimeFiles = files.filter(file => !relative(root, file).startsWith('scripts'));
for (const file of runtimeFiles) {
  const source = await readFile(file, 'utf8');
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`Private provider API marker found in ${relative(root, file)}: ${marker}`);
  }
}

console.log(`Extension validation passed: ${files.length} JavaScript files and ${required.length} required runtime surfaces checked.`);
