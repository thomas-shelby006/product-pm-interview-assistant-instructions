import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const builder = fileURLToPath(new URL('../../scripts/build-worktree-integration-manifest.mjs', import.meta.url));
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const run = (cwd, args) => spawnSync(process.execPath, [builder, ...args], { cwd, encoding: 'utf8' });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizeStatus = value => String(value || '').replaceAll('\r\n', '\n')
  .split('\n').filter(Boolean).sort().join('\n');
async function statusFingerprint(cwd) {
  const status = normalizeStatus(git(cwd, ['status', '--porcelain']).stdout);
  const trackedDiffHash = digest(git(cwd, ['diff', '--binary', '--no-ext-diff']).stdout);
  const untrackedPaths = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).stdout
    .split('\0').filter(Boolean).sort();
  const untracked = [];
  for (const relative of untrackedPaths) {
    untracked.push({ path: relative.replaceAll('\\', '/'), hash: digest(await readFile(path.join(cwd, relative))) });
  }
  return digest(JSON.stringify({ status, trackedDiffHash, untracked }));
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pmia-worktree-evidence-'));
  const repo = path.join(root, 'repo');
  const integrationPath = path.join(root, 'integration');
  const featurePath = path.join(root, 'feature');
  git(root, ['init', repo]);
  git(repo, ['config', 'user.email', 'pmia@example.invalid']);
  git(repo, ['config', 'user.name', 'PMIA Test']);
  await writeFile(path.join(repo, 'README.md'), 'base\n');
  git(repo, ['add', '.']); git(repo, ['commit', '-m', 'base']);
  git(repo, ['branch', '-M', 'main']);
  git(repo, ['branch', 'integration']);
  git(repo, ['branch', 'feature']);
  git(repo, ['worktree', 'add', integrationPath, 'integration']);
  git(repo, ['worktree', 'add', featurePath, 'feature']);
  await writeFile(path.join(featurePath, 'feature.txt'), 'feature\n');
  git(featurePath, ['add', '.']); git(featurePath, ['commit', '-m', 'feature']);
  return { repo, integrationPath, featurePath, root };
}

function args(value, output, dispositions = '') {
  return [
    '--repo', value.repo,
    '--integration-branch', 'integration',
    '--target-branch', 'main',
    '--output', output,
    '--no-push-confirmed', 'true',
    ...(dispositions ? ['--dispositions', dispositions] : [])
  ];
}

async function writeDisposition(value, file) {
  const featureHead = git(value.featurePath, ['rev-parse', 'HEAD']).stdout.trim();
  const replacementCommit = git(value.integrationPath, ['rev-parse', 'HEAD']).stdout.trim();
  await writeFile(file, `${JSON.stringify({
    format: 'pmia-worktree-dispositions/v1',
    entries: [{
      branch: 'feature',
      head: featureHead,
      statusHash: await statusFingerprint(value.featurePath),
      decision: 'superseded_preserved',
      replacementCommits: [replacementCommit],
      replacementFiles: ['README.md'],
      reason: 'The dirty historical fixture is represented by the integrated replacement.'
    }]
  }, null, 2)}\n`);
}

test('worktree manifest blocks while any registered head is excluded', async () => {
  const value = await fixture();
  const output = path.join(value.root, 'blocked.json');
  const result = run(value.repo, args(value, output));
  assert.notEqual(result.status, 0);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(manifest.ready, false);
  assert.equal(manifest.allIncluded, false);
  assert.equal(manifest.counts.registered, 3);
  assert.equal(manifest.counts.included, 2);
  assert.equal(manifest.worktrees.find(item => item.branch === 'feature').included, false);
});

test('worktree manifest becomes ready after every head is merged and all worktrees are clean', async () => {
  const value = await fixture();
  git(value.integrationPath, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);
  const output = path.join(value.root, 'ready.json');
  const result = run(value.repo, args(value, output));
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(manifest.ready, true);
  assert.equal(manifest.allIncluded, true);
  assert.equal(manifest.allAccounted, true);
  assert.equal(manifest.targetClean, true);
  assert.equal(manifest.integrationClean, true);
  assert.equal(manifest.counts.included, manifest.counts.registered);
  assert.equal(manifest.counts.accounted, manifest.counts.registered);
  assert.equal(manifest.tagsAtIntegration.length, 0);
  assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/);
});

test('dirty historical worktree requires an exact verified disposition', async () => {
  const value = await fixture();
  git(value.integrationPath, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);
  await writeFile(path.join(value.featurePath, 'historical-note.txt'), 'preserve me\n');
  const blockedOutput = path.join(value.root, 'dirty-blocked.json');
  const blocked = run(value.repo, args(value, blockedOutput));
  assert.notEqual(blocked.status, 0);
  const blockedManifest = JSON.parse(await readFile(blockedOutput, 'utf8'));
  const blockedFeature = blockedManifest.worktrees.find(item => item.branch === 'feature');
  assert.equal(blockedManifest.allAccounted, false);
  assert.equal(blockedFeature.clean, false);
  assert.equal(blockedFeature.accounted, false);

  const dispositions = path.join(value.root, 'dispositions.json');
  await writeDisposition(value, dispositions);
  const readyOutput = path.join(value.root, 'dirty-accounted.json');
  const ready = run(value.repo, args(value, readyOutput, dispositions));
  assert.equal(ready.status, 0, ready.stderr);
  const manifest = JSON.parse(await readFile(readyOutput, 'utf8'));
  const feature = manifest.worktrees.find(item => item.branch === 'feature');
  assert.equal(manifest.ready, true);
  assert.equal(manifest.allAccounted, true);
  assert.equal(feature.clean, false);
  assert.equal(feature.accounted, true);
  assert.equal(feature.disposition.decision, 'superseded_preserved');
  assert.equal(manifest.unusedDispositions.length, 0);
});

test('stale dirty-worktree disposition hash blocks readiness', async () => {
  const value = await fixture();
  git(value.integrationPath, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);
  await writeFile(path.join(value.featurePath, 'historical-note.txt'), 'version one\n');
  const dispositions = path.join(value.root, 'dispositions.json');
  await writeDisposition(value, dispositions);
  await writeFile(path.join(value.featurePath, 'historical-note.txt'), 'version two\n');
  const output = path.join(value.root, 'stale.json');
  const result = run(value.repo, args(value, output, dispositions));
  assert.notEqual(result.status, 0);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(manifest.ready, false);
  assert.equal(manifest.allAccounted, false);
  assert.equal(manifest.unusedDispositions.length, 1);
});

test('worktree manifest refuses a dirty target or missing no-push confirmation', async () => {
  const value = await fixture();
  git(value.integrationPath, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);
  await writeFile(path.join(value.repo, 'dirty.txt'), 'dirty\n');
  const dirty = run(value.repo, args(value, path.join(value.root, 'dirty.json')));
  assert.notEqual(dirty.status, 0);
  const missingPush = run(value.repo, [
    '--repo', value.repo, '--integration-branch', 'integration',
    '--target-branch', 'main', '--output', path.join(value.root, 'push.json')
  ]);
  assert.notEqual(missingPush.status, 0);
});
