import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function options(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 2) {
    out[String(argv[index] || '').replace(/^--/, '')] = argv[index + 1];
  }
  return out;
}
function run(cwd, args, { allowFailure = false } = {}) {
  const value = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (!allowFailure && value.status !== 0) throw new Error(value.stderr || `git ${args.join(' ')} failed`);
  return { status: value.status ?? 1, stdout: String(value.stdout || '').trim(), stderr: String(value.stderr || '').trim() };
}
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
function parseWorktrees(text) {
  const values = [];
  let current = {};
  for (const line of `${text}\n`.split(/\r?\n/)) {
    if (!line) {
      if (current.worktree) values.push(current);
      current = {};
      continue;
    }
    const [key, ...rest] = line.split(' ');
    current[key] = rest.length ? rest.join(' ') : true;
  }
  return values;
}
function normalizeStatus(text) {
  return String(text || '').replaceAll('\r\n', '\n').split('\n').filter(Boolean).sort().join('\n');
}
function cleanList(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}
async function statusFingerprint(worktree, statusText) {
  const status = normalizeStatus(statusText);
  const trackedDiffHash = sha(run(worktree, ['diff', '--binary', '--no-ext-diff'], { allowFailure: true }).stdout);
  const untrackedPaths = run(worktree, ['ls-files', '--others', '--exclude-standard', '-z'], { allowFailure: true }).stdout
    .split('\0').filter(Boolean).sort();
  const untracked = [];
  for (const relative of untrackedPaths) {
    let hash = 'missing';
    try { hash = sha(await fs.readFile(path.join(worktree, relative))); } catch {}
    untracked.push({ path: relative.replaceAll('\\', '/'), hash });
  }
  return sha(JSON.stringify({ status, trackedDiffHash, untracked }));
}

const args = options(process.argv);
const repo = path.resolve(String(args.repo || ''));
const integrationBranch = String(args['integration-branch'] || '').trim();
const targetBranch = String(args['target-branch'] || 'main').trim();
const output = path.resolve(String(args.output || ''));
const dispositionsPath = String(args.dispositions || '').trim()
  ? path.resolve(String(args.dispositions))
  : '';
if (!repo || !integrationBranch || !output) {
  throw new Error('Required options: --repo, --integration-branch, --target-branch, --output');
}

let dispositionEntries = [];
if (dispositionsPath) {
  const parsed = JSON.parse(await fs.readFile(dispositionsPath, 'utf8'));
  if (parsed?.format !== 'pmia-worktree-dispositions/v1' || !Array.isArray(parsed.entries)) {
    throw new Error('Invalid PMIA worktree disposition file');
  }
  dispositionEntries = parsed.entries.map(item => canonical({
    branch: String(item?.branch || '').trim(),
    head: String(item?.head || '').trim(),
    statusHash: String(item?.statusHash || '').trim(),
    decision: String(item?.decision || '').trim(),
    replacementCommits: cleanList(item?.replacementCommits),
    replacementFiles: cleanList(item?.replacementFiles),
    reason: String(item?.reason || '').trim()
  }));
}

const integrationCommit = run(repo, ['rev-parse', integrationBranch]).stdout;
const targetCommit = run(repo, ['rev-parse', targetBranch]).stdout;
const raw = run(repo, ['worktree', 'list', '--porcelain']).stdout;
const worktrees = parseWorktrees(raw);
const usedDispositionIndexes = new Set();

const entries = (await Promise.all(worktrees.map(async item => {
  const head = String(item.HEAD || '');
  const branch = String(item.branch || '').replace(/^refs\/heads\//, '') || '(detached)';
  const included = run(repo, ['merge-base', '--is-ancestor', head, integrationBranch], { allowFailure: true }).status === 0;
  const status = run(item.worktree, ['status', '--porcelain'], { allowFailure: true });
  const normalized = status.status === 0 ? normalizeStatus(status.stdout) : `status_error:${status.stderr || status.status}`;
  const clean = status.status === 0 && !normalized;
  const statusHash = await statusFingerprint(item.worktree, normalized);
  let disposition = null;
  let dispositionValid = false;
  if (!clean) {
    const index = dispositionEntries.findIndex((candidate, candidateIndex) =>
      !usedDispositionIndexes.has(candidateIndex)
      && candidate.branch === branch
      && candidate.head === head
      && candidate.statusHash === statusHash
    );
    if (index >= 0) {
      usedDispositionIndexes.add(index);
      const candidate = dispositionEntries[index];
      const replacementCommitsValid = candidate.replacementCommits.length > 0
        && candidate.replacementCommits.every(commit =>
          run(repo, ['merge-base', '--is-ancestor', commit, integrationBranch], { allowFailure: true }).status === 0
        );
      const replacementFilesValid = candidate.replacementFiles.length > 0
        && candidate.replacementFiles.every(file =>
          run(repo, ['cat-file', '-e', `${integrationBranch}:${file}`], { allowFailure: true }).status === 0
        );
      dispositionValid = candidate.decision === 'superseded_preserved'
        && candidate.reason.length >= 20
        && replacementCommitsValid
        && replacementFilesValid;
      disposition = {
        ...candidate,
        replacementCommitsValid,
        replacementFilesValid,
        valid: dispositionValid
      };
    }
  }
  return {
    path: path.resolve(item.worktree),
    head,
    branch,
    included,
    clean,
    statusHash,
    accounted: clean || dispositionValid,
    disposition,
    prunable: item.prunable === true,
    locked: item.locked === true
  };
}))).sort((a, b) => a.path.localeCompare(b.path));

const unusedDispositions = dispositionEntries
  .map((item, index) => ({ item, index }))
  .filter(({ index }) => !usedDispositionIndexes.has(index))
  .map(({ item }) => item);
const targetEntry = entries.find(item => item.branch === targetBranch);
const integrationEntry = entries.find(item => item.branch === integrationBranch);
const tagsAtIntegration = run(repo, ['tag', '--points-at', integrationCommit]).stdout.split(/\r?\n/).filter(Boolean);
const allIncluded = entries.every(item => item.included);
const allAccounted = entries.every(item => item.accounted) && unusedDispositions.length === 0;
const targetClean = Boolean(targetEntry?.clean);
const integrationClean = Boolean(integrationEntry?.clean);
const noPushConfirmed = String(args['no-push-confirmed'] || 'false') === 'true';
const value = canonical({
  format: 'pmia-worktree-integration/v2',
  integrationBranch,
  integrationCommit,
  targetBranch,
  targetCommit,
  worktrees: entries,
  counts: {
    registered: entries.length,
    included: entries.filter(item => item.included).length,
    accounted: entries.filter(item => item.accounted).length,
    dirty: entries.filter(item => !item.clean).length,
    disposed: entries.filter(item => item.disposition?.valid).length
  },
  allIncluded,
  allAccounted,
  targetClean,
  integrationClean,
  tagsAtIntegration,
  noPushConfirmed,
  dispositionsFile: dispositionsPath || '',
  dispositionsHash: sha(JSON.stringify(canonical(dispositionEntries))),
  unusedDispositions
});
const ready = allIncluded && allAccounted && targetClean && integrationClean
  && tagsAtIntegration.length === 0 && noPushConfirmed;
const finalValue = { ...value, ready, manifestHash: sha(JSON.stringify(value)) };
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(finalValue, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  ok: ready,
  output,
  integrationCommit,
  registered: entries.length,
  included: entries.filter(item => item.included).length,
  accounted: entries.filter(item => item.accounted).length,
  manifestHash: finalValue.manifestHash
}));
if (!ready) process.exitCode = 1;
