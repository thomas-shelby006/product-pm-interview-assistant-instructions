import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, appendFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const scriptsRoot = resolve(runtimeRoot, 'scripts');
const currentScript = resolve(scriptsRoot, 'New-PMIACurrentDeployment.ps1');
const archiveScript = resolve(scriptsRoot, 'New-PMIAInstalledArchive.ps1');
const verifyScript = resolve(scriptsRoot, 'Test-PMIADeployment.ps1');
const commonScript = resolve(scriptsRoot, 'PMIA-Deployment.Common.ps1');
const validationDependencies = [
  'AHK_PHASE_2_IMPLEMENTATION_PLAN.md',
  'ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md',
  'docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md',
  'docs/CURRENT_STATUS_DASHBOARD.md',
  'docs/LEGACY_FEATURE_PARITY.md',
  'docs/SESSION_TRACKER_SETUP.md',
  'docs/evidence/2026-07-30-pmia-runtime-v0.6.1-verification.md',
  'docs/superpowers/specs/2026-07-30-pmia-final-architecture-design.md',
  'project_source_files/PM_BOOT_PROMPT_FOR_AHK.md'
];

function run(command, args, cwd = undefined) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
}

function runPowerShell(script, args = []) {
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args]);
}

async function write(root, relative, content = 'fixture\n') {
  const path = join(root, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function createFixture(version = '9.9.9') {
  const root = await mkdtemp(join(tmpdir(), 'pmia-deploy-fixture-'));
  await write(root, 'runtime/extension/manifest.json', JSON.stringify({
    manifest_version: 3,
    name: 'PMIA Fixture',
    version
  }, null, 2));
  for (const relative of [
    'runtime/Final_2_Window_Extension.ahk',
    'runtime/Session_Tracker_End_Session.ahk',
    'runtime/Browser_Profile_Doctor.ps1',
    'runtime/Validate_Extension_Runtime.ps1',
    'runtime/PMIA_Runtime_Platform.ahk',
    'project_upload_bundle/README.md',
    'review_lab_project/README.md',
    'templates/session-template.md',
    'README.md',
    'AI_SYSTEM_CONTEXT.md',
    'FILE_MAP.md',
    'CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md',
    'DEPLOYMENT_GUIDE.md',
    'package.json',
    ...validationDependencies
  ]) await write(root, relative);
  await write(root, 'archive/old.txt');
  await write(root, 'drafts/private.txt');
  await write(root, '.pmia-task-temp/trace.txt');
  await write(root, 'runtime/logs/session.log');
  await write(root, 'docs/evidence/unapproved.txt');
  for (const args of [
    ['init'],
    ['config', 'user.name', 'PMIA Test'],
    ['config', 'user.email', 'pmia-test@example.invalid'],
    ['add', '.'],
    ['commit', '-m', 'fixture']
  ]) {
    const result = run('git.exe', args, root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const commit = run('git.exe', ['rev-parse', 'HEAD'], root).stdout.trim();
  return { root, version, commit };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function manifest(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('deployment scripts expose explicit fail-closed packaging contracts', async () => {
  const current = await readFile(currentScript, 'utf8');
  const archive = await readFile(archiveScript, 'utf8');
  const verify = await readFile(verifyScript, 'utf8');
  const common = await readFile(commonScript, 'utf8');
  assert.match(current, /SourceRoot/);
  assert.match(current, /DeploymentRoot/);
  assert.match(current, /git[\s\S]*status[\s\S]*--porcelain/);
  assert.match(current, /\.current-staging-/);
  assert.match(current, /Test-PMIADeployment\.ps1/);
  assert.match(archive, /InstalledExtensionPath/);
  assert.match(archive, /RegisteredPath/);
  assert.match(archive, /ProfileDirectory/);
  assert.match(archive, /ExtensionId/);
  assert.match(verify, /checksums\.sha256/);
  assert.match(verify, /deployment-manifest\.json/);
  for (const forbidden of ['.git', '.worktrees', '.pmia-task-temp', 'evidence', 'settings.ini']) {
    assert.match(`${verify}\n${common}`.toLowerCase(), new RegExp(forbidden.replace('.', '\\.')));
  }
});

test('current deployment is atomic, source-bound, excluded, and tamper-evident', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-deployment-root-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
  });
  const result = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const currentRoot = join(deploymentRoot, 'current');
  const currentManifest = await manifest(join(currentRoot, 'deployment-manifest.json'));
  assert.equal(currentManifest.kind, 'current');
  assert.equal(currentManifest.version, fixture.version);
  assert.equal(currentManifest.sourceCommit, fixture.commit);
  assert.equal(await exists(join(currentRoot, 'runtime/extension/manifest.json')), true);
  assert.equal(await exists(join(currentRoot, 'archive')), false);
  assert.equal(await exists(join(currentRoot, 'drafts')), false);
  assert.equal(await exists(join(currentRoot, '.git')), false);
  assert.equal(await exists(join(currentRoot, '.pmia-task-temp')), false);
  assert.equal(await exists(join(currentRoot, 'runtime/logs')), false);
  assert.equal(await exists(join(currentRoot, 'docs/evidence/unapproved.txt')), false);
  for (const relative of validationDependencies) {
    assert.equal(await exists(join(currentRoot, relative)), true);
  }
  const verify = runPowerShell(verifyScript, ['-PackageRoot', currentRoot, '-ExpectedKind', 'current']);
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);

  await appendFile(join(currentRoot, 'README.md'), 'tamper\n', 'utf8');
  const tampered = runPowerShell(verifyScript, ['-PackageRoot', currentRoot, '-ExpectedKind', 'current']);
  assert.notEqual(tampered.status, 0, 'tampered package must fail verification');
});

test('installed archive preserves registration identity and verifies independently', async t => {
  const fixture = await createFixture('0.6.1');
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-archive-root-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
  });
  const registeredPath = join(fixture.root, 'registered-extension');
  await mkdir(registeredPath, { recursive: true });
  const result = runPowerShell(archiveScript, [
    '-InstalledExtensionPath', join(fixture.root, 'runtime/extension'),
    '-DeploymentRoot', deploymentRoot,
    '-RegisteredPath', registeredPath,
    '-ProfileDirectory', 'Default',
    '-ExtensionId', 'fixture-extension-id',
    '-ExpectedVersion', fixture.version
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const archiveRoot = join(deploymentRoot, 'archive', 'pmia-0.6.1-installed');
  const archiveManifest = await manifest(join(archiveRoot, 'deployment-manifest.json'));
  assert.equal(archiveManifest.kind, 'installed-archive');
  assert.equal(archiveManifest.version, fixture.version);
  assert.equal(archiveManifest.sourceCommit, fixture.commit);
  assert.equal(archiveManifest.profileDirectory, 'Default');
  assert.equal(archiveManifest.extensionId, 'fixture-extension-id');
  assert.equal(archiveManifest.registeredPath, resolve(registeredPath));
  assert.equal(archiveManifest.resolvedExtensionPath, resolve(fixture.root, 'runtime/extension'));
  assert.equal(await exists(join(archiveRoot, 'runtime/extension/manifest.json')), true);
  assert.equal(await exists(join(archiveRoot, 'archive')), false);
  assert.equal(await exists(join(archiveRoot, '.git')), false);
  const verify = runPowerShell(verifyScript, [
    '-PackageRoot', archiveRoot,
    '-ExpectedKind', 'installed-archive'
  ]);
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
});
