import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, utimes } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const launcherPath = resolve(runtimeRoot, 'Final_2_Window_Extension.ahk');
const companionPath = resolve(runtimeRoot, 'Session_Tracker_End_Session.ahk');
const resolverPath = resolve(runtimeRoot, 'scripts', 'resolve-pmia-session-exports.ps1');
const pushScriptPath = resolve(runtimeRoot, 'scripts', 'push-session-to-tracker.ps1');
const validatorPath = resolve(runtimeRoot, 'Validate_Extension_Runtime.ps1');
const launcher = await readFile(launcherPath, 'utf8');
const companion = await readFile(companionPath, 'utf8').catch(() => '');
const validator = await readFile(validatorPath, 'utf8');

function block(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return from >= 0 && to > from ? source.slice(from, to) : '';
}

test('main launcher exposes a stable focus-independent review control channel', () => {
  assert.match(launcher, /PMIA_RUNTIME_CONTROL_V1/);
  assert.match(launcher, /PMIA_RUNTIME_CONTROL/);
  assert.match(launcher, /RegisterWindowMessage/);
  assert.match(launcher, /OnMessage\(/);
  assert.match(launcher, /HandleRuntimeControlMessage\(/);
  assert.match(launcher, /g_runtimeControlGui\.AddText\("x0 y0 w1 h1", " "\)/);
  assert.match(launcher, /g_runtimeControlGui\.Show\("x-32000 y-32000 w1 h1 NA"\)/);
});

test('hotkeys and control messages share exact export and shutdown functions', () => {
  assert.match(launcher, /ExportActiveSession\(\)/);
  assert.match(launcher, /EndActiveSession\(\)/);
  assert.match(block(launcher, '!e::', '; Alt+Q'), /ExportActiveSession\(\)/);
  assert.match(block(launcher, '!Delete::', '; Alt+E'), /EndActiveSession\(\)/);
  const control = block(launcher, 'HandleRuntimeControlMessage(', 'ShowSessionLaunchGui(');
  assert.match(control, /ExportActiveSession/);
  assert.match(control, /EndActiveSession/);
});

test('new companion is v0.6-native and never uses legacy bridge titles or export hotkeys', () => {
  assert.notEqual(companion, '');
  assert.match(companion, /PMIA_RUNTIME_CONTROL_V1/);
  assert.match(companion, /PMIA_(?:BOOT_|REGISTERED_)?/);
  assert.doesNotMatch(companion, /VB_SENDER|VB_RECEIVER|\^\+\{F9\}/);
});
function markdown(sessionId, role, provider = 'chatgpt') {
  return [
    '# PM Interview Dual-Provider Session', '',
    `Session: ${sessionId}`,
    `Window: ${role} / ${provider}`,
    '', '## Events', ''
  ].join('\n');
}

function runResolver(directory, sessionId, sinceUtc, waitSeconds = 0) {
  const resultPath = join(directory, 'resolver-result.json');
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolverPath,
    '-DownloadDirectory', directory, '-SessionId', sessionId,
    '-SinceUtc', sinceUtc, '-WaitSeconds', String(waitSeconds),
    '-ResultJsonPath', resultPath
  ], { encoding: 'utf8' });
  return { process: result, resultPath };
}

test('resolver pairs one fresh v0.6 sender and receiver export', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pmia-review-pair-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sessionId = 'pmia_20260730_193300_1234';
  await writeFile(join(dir, `pmia-session-${sessionId}-sender-chatgpt-a.md`), markdown(sessionId, 'sender'));
  await writeFile(join(dir, `pmia-session-${sessionId}-receiver-claude-b.md`), markdown(sessionId, 'receiver', 'claude'));
  const run = runResolver(dir, sessionId, new Date(Date.now() - 5000).toISOString());
  assert.equal(run.process.status, 0, run.process.stderr || run.process.stdout);
  const result = JSON.parse(await readFile(run.resultPath, 'utf8'));
  assert.equal(result.ok, true);
  assert.equal(result.sessionId, sessionId);
  assert.match(result.senderFile, /-sender-chatgpt-/);
  assert.match(result.receiverFile, /-receiver-claude-/);
});
test('resolver rejects stale and mismatched session files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pmia-review-stale-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sessionId = 'pmia_20260730_193400_2345';
  const sender = join(dir, `pmia-session-${sessionId}-sender-chatgpt-a.md`);
  const receiver = join(dir, `pmia-session-${sessionId}-receiver-chatgpt-b.md`);
  await writeFile(sender, markdown(sessionId, 'sender'));
  await writeFile(receiver, markdown('pmia_other', 'receiver'));
  const old = new Date(Date.now() - 120000);
  await utimes(sender, old, old);
  const run = runResolver(dir, sessionId, new Date(Date.now() - 5000).toISOString());
  assert.notEqual(run.process.status, 0);
  const result = JSON.parse(await readFile(run.resultPath, 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.error, /not found|mismatch|stale/i);
});

test('resolver rejects malformed headers and duplicate role exports', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pmia-review-invalid-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sessionId = 'pmia_20260730_193500_3456';
  await writeFile(join(dir, `pmia-session-${sessionId}-sender-chatgpt-a.md`), markdown(sessionId, 'sender'));
  await writeFile(join(dir, `pmia-session-${sessionId}-sender-claude-b.md`), markdown(sessionId, 'sender', 'claude'));
  await writeFile(join(dir, `pmia-session-${sessionId}-receiver-chatgpt-c.md`), '# malformed');
  const run = runResolver(dir, sessionId, new Date(Date.now() - 5000).toISOString());
  assert.notEqual(run.process.status, 0);
  const result = JSON.parse(await readFile(run.resultPath, 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.error, /duplicate|malformed|role/i);
});
function runPush({ tracker, sender, receiver, resultPath, extra = [] }) {
  return spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pushScriptPath,
    '-SessionType', 'practice', '-Company', 'test', '-Role', 'pm',
    '-Round', 'smoke', '-Mode', 'mock', '-Win1File', sender,
    '-Win2File', receiver, '-TrackerRepoPath', tracker,
    '-DryRun', '-ResultJsonPath', resultPath, ...extra
  ], { encoding: 'utf8' });
}

test('push script dry-run validates v0.6 pair and creates tracker session without Git', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-review-push-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tracker = join(root, 'tracker');
  const sessionId = 'pmia_20260730_193600_4567';
  await mkdir(tracker, { recursive: true });
  const sender = join(root, 'sender.md');
  const receiver = join(root, 'receiver.md');
  const resultPath = join(root, 'push-result.json');
  await writeFile(sender, markdown(sessionId, 'sender', 'claude'));
  await writeFile(receiver, markdown(sessionId, 'receiver', 'chatgpt'));
  const run = runPush({ tracker, sender, receiver, resultPath });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.sourceSessionId, sessionId);
  assert.match(result.trackerRelativePath, /^practice\//);
  assert.equal(await readFile(join(result.sessionFolder, 'win1_sender.md'), 'utf8'), markdown(sessionId, 'sender', 'claude'));
  assert.equal(await readFile(join(result.sessionFolder, 'win2_receiver.md'), 'utf8'), markdown(sessionId, 'receiver', 'chatgpt'));
});

test('push script rejects mixed or mismatched v0.6 export pairs before writing tracker state', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-review-push-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tracker = join(root, 'tracker');
  await mkdir(tracker, { recursive: true });
  const sender = join(root, 'sender.md');
  const receiver = join(root, 'receiver.md');
  const resultPath = join(root, 'push-result.json');
  await writeFile(sender, markdown('pmia_one', 'sender'));
  await writeFile(receiver, markdown('pmia_two', 'receiver'));
  const run = runPush({ tracker, sender, receiver, resultPath });
  assert.notEqual(run.status, 0);
  const result = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.error, /session|mismatch/i);
  const practice = join(tracker, 'practice');
  await assert.rejects(readFile(join(practice, 'unexpected'), 'utf8'));
});
test('review studio passes an explicit UTC export boundary to the resolver', () => {
  assert.match(companion, /A_NowUTC/);
  assert.match(companion, /yyyy-MM-ddTHH:mm:ssZ/);
  assert.match(companion, /-SinceUtc/);
  assert.doesNotMatch(companion, /sinceLocal/);
});
test('review studio exposes exact session workflow and safe operational actions', () => {
  assert.match(companion, /PM Session Tracker.*Review Studio/);
  assert.match(companion, /Detect Session/);
  assert.match(companion, /Export and Pair/);
  assert.match(companion, /Push and Open Review Lab/);
  assert.match(companion, /End Session/);
  assert.match(companion, /resolve-pmia-session-exports\.ps1/);
  assert.match(companion, /push-session-to-tracker\.ps1/);
  assert.match(companion, /PMIA_RUNTIME_CONTROL_EXPORT\s*:=\s*1/);
  assert.match(companion, /PMIA_RUNTIME_CONTROL_END\s*:=\s*2/);
});

test('review studio persists only local paths and review URL', () => {
  assert.match(companion, /review-settings\.ini/);
  assert.match(companion, /TrackerRepoPath/);
  assert.match(companion, /DownloadDirectory/);
  assert.match(companion, /ReviewLabUrl/);
  const saveStart = companion.indexOf('SaveReviewPreferences() {');
  const saveEnd = companion.indexOf('ShowReviewStudio() {', saveStart);
  const saveBlock = companion.slice(saveStart, saveEnd);
  assert.doesNotMatch(saveBlock, /Company|Role|Round|Mode|SessionId|Resume|JobDescription|Prompt|Answer/);
});

test('review studio has silent validation and opens Review Lab only after push success', () => {
  assert.match(companion, /--validate/);
  assert.match(companion, /AHK_VALID/);
  const pushStart = companion.indexOf('PushAndOpenReviewLab(');
  const pushEnd = companion.indexOf('EndDetectedSession(', pushStart);
  const pushBlock = companion.slice(pushStart, pushEnd);
  assert.match(pushBlock, /result\["ok"\]/);
  assert.match(pushBlock, /OpenReviewLab/);
  assert.match(pushBlock, /explorer\.exe/);
  assert.match(pushBlock, /A_Clipboard/);
});

test('runtime validator parses both active AutoHotkey programs and rejects legacy review assumptions', () => {
  assert.match(validator, /Session_Tracker_End_Session\.ahk/);
  assert.match(validator, /PMIA_VALIDATE/);
  assert.match(validator, /review companion/i);
  assert.match(validator, /VB_SENDER|VB_RECEIVER/);
  assert.match(validator, /Ctrl\+Shift\+F9|F9/);
});

test('main launcher owns the on-demand Review Studio shortcut without a competing companion hotkey', () => {
  assert.match(launcher, /!\+e::OpenSessionReviewStudio\(\)/);
  assert.match(launcher, /Session_Tracker_End_Session\.ahk/);
  assert.match(launcher, /OpenSessionReviewStudio\(\)/);
  assert.doesNotMatch(companion, /!\+e::/);
});
function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test('real tracker path works under Windows PowerShell 5.1 against a local bare remote', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-review-real-git-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const remote = join(root, 'remote.git');
  const tracker = join(root, 'tracker');
  git(['init', '--bare', '--initial-branch=main', remote], root);
  git(['clone', remote, tracker], root);
  git(['config', 'user.email', 'pmia-test@example.invalid'], tracker);
  git(['config', 'user.name', 'PMIA Test'], tracker);
  await writeFile(join(tracker, 'README.md'), '# Local tracker\n');
  git(['add', 'README.md'], tracker);
  git(['commit', '-m', 'init'], tracker);
  git(['push', '-u', 'origin', 'main'], tracker);

  const sourceSessionId = 'pmia_20260730_193700_5678';
  const sender = join(root, 'sender.md');
  const receiver = join(root, 'receiver.md');
  const resultPath = join(root, 'push-result.json');
  await writeFile(sender, markdown(sourceSessionId, 'sender', 'chatgpt'));
  await writeFile(receiver, markdown(sourceSessionId, 'receiver', 'claude'));
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pushScriptPath,
    '-SessionType', 'practice', '-Company', 'local test', '-Role', 'pm',
    '-Round', 'integration', '-Mode', 'mock', '-Win1File', sender,
    '-Win2File', receiver, '-TrackerRepoPath', tracker, '-NoAutoMerge',
    '-ResultJsonPath', resultPath
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pushed = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.equal(pushed.ok, true);
  assert.equal(pushed.dryRun, false);
  assert.equal(pushed.sourceSessionId, sourceSessionId);
  assert.match(git(['ls-remote', '--heads', remote, pushed.branch], tracker), /refs\/heads\/session\//);
});
test('control-smoke mode starts only the hidden runtime bridge', () => {
  assert.match(launcher, /--control-smoke/);
  assert.match(launcher, /g_controlSmokeMode/);
  assert.match(launcher, /InitializeRuntimeControlBridge\(\)\r?\nif !g_controlSmokeMode/);
});

async function createLocalTracker(root) {
  const remote = join(root, 'remote.git');
  const tracker = join(root, 'tracker');
  git(['init', '--bare', '--initial-branch=main', remote], root);
  git(['clone', remote, tracker], root);
  git(['config', 'user.email', 'pmia-test@example.invalid'], tracker);
  git(['config', 'user.name', 'PMIA Test'], tracker);
  await writeFile(join(tracker, 'README.md'), '# Local tracker\n');
  git(['add', 'README.md'], tracker);
  git(['commit', '-m', 'init'], tracker);
  git(['push', '-u', 'origin', 'main'], tracker);
  return { remote, tracker };
}

test('default tracker path auto-merges to main and removes the temporary remote branch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-review-auto-merge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { remote, tracker } = await createLocalTracker(root);
  const sourceSessionId = 'pmia_20260730_193800_6789';
  const sender = join(root, 'sender.md');
  const receiver = join(root, 'receiver.md');
  const resultPath = join(root, 'push-result.json');
  await writeFile(sender, markdown(sourceSessionId, 'sender', 'claude'));
  await writeFile(receiver, markdown(sourceSessionId, 'receiver', 'claude'));
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pushScriptPath,
    '-SessionType', 'practice', '-Company', 'auto merge', '-Role', 'pm',
    '-Round', 'integration', '-Mode', 'mock', '-Win1File', sender,
    '-Win2File', receiver, '-TrackerRepoPath', tracker,
    '-ResultJsonPath', resultPath
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pushed = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.equal(pushed.ok, true);
  assert.equal(pushed.autoMerged, true);
  assert.equal(git(['branch', '--show-current'], tracker), 'main');
  assert.equal(git(['ls-remote', '--heads', remote, pushed.branch], tracker), '');
  assert.match(git(['ls-tree', '-r', '--name-only', 'origin/main'], tracker), new RegExp(`${pushed.trackerRelativePath}/win1_sender\\.md`));
});
test('tracker allocates its numeric session ID after pulling newer remote sessions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-review-remote-sequence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { remote, tracker } = await createLocalTracker(root);
  const other = join(root, 'other');
  git(['clone', remote, other], root);
  git(['config', 'user.email', 'pmia-other@example.invalid'], other);
  git(['config', 'user.name', 'PMIA Other'], other);
  const remoteSession = join(other, 'practice', '0001_2026-07-30_remote_pm_mock_mock');
  await mkdir(remoteSession, { recursive: true });
  await writeFile(join(remoteSession, 'README.md'), '# Remote session\n');
  await writeFile(join(remoteSession, 'win1_sender.md'), 'legacy sender\n');
  await writeFile(join(remoteSession, 'win2_receiver.md'), 'legacy receiver\n');
  git(['add', 'practice'], other);
  git(['commit', '-m', 'remote session'], other);
  git(['push', 'origin', 'main'], other);

  const sourceSessionId = 'pmia_20260730_193900_7890';
  const sender = join(root, 'sender.md');
  const receiver = join(root, 'receiver.md');
  const resultPath = join(root, 'push-result.json');
  await writeFile(sender, markdown(sourceSessionId, 'sender', 'chatgpt'));
  await writeFile(receiver, markdown(sourceSessionId, 'receiver', 'chatgpt'));
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pushScriptPath,
    '-SessionType', 'practice', '-Company', 'fresh', '-Role', 'pm',
    '-Round', 'mock', '-Mode', 'mock', '-Win1File', sender,
    '-Win2File', receiver, '-TrackerRepoPath', tracker,
    '-ResultJsonPath', resultPath
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pushed = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.match(pushed.sessionId, /^0002_/);
});