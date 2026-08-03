import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, readdir,
  copyFile, rm, access, lstat, symlink
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path, { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const scriptsRoot = resolve(runtimeRoot, 'scripts');
const currentScript = resolve(scriptsRoot, 'New-PMIACurrentDeployment.ps1');
const archiveScript = resolve(scriptsRoot, 'New-PMIAInstalledArchive.ps1');
const verifyScript = resolve(scriptsRoot, 'Test-PMIADeployment.ps1');
const commonScript = resolve(scriptsRoot, 'PMIA-Deployment.Common.ps1');

function run(command, args, cwd = undefined) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
}

function runPowerShell(script, args = []) {
  return run('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args
  ]);
}
async function write(root, relative, content = 'fixture\n') {
  const target = join(root, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function createFixture(version = '0.10.2') {
  const root = await mkdtemp(join(tmpdir(), 'pmia-hardening-fixture-'));
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
    'package.json'
  ]) await write(root, relative);
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
  return {
    root,
    version,
    commit: run('git.exe', ['rev-parse', 'HEAD'], root).stdout.trim()
  };
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(root) {
  return JSON.parse(await readFile(join(root, 'deployment-manifest.json'), 'utf8'));
}
async function packageFiles(root, relative = '') {
  const files = [];
  for (const name of await readdir(join(root, relative))) {
    if (name === 'checksums.sha256') continue;
    const next = join(relative, name);
    const info = await lstat(join(root, next));
    if (info.isDirectory()) {
      files.push(...await packageFiles(root, next));
    } else if (info.isFile()) {
      files.push(next.replaceAll('\\', '/'));
    }
  }
  return files.sort();
}

async function rewriteChecksums(root) {
  const lines = [];
  for (const relative of await packageFiles(root)) {
    const content = await readFile(join(root, relative));
    const hash = createHash('sha256').update(content).digest('hex').toUpperCase();
    lines.push(hash + '  ' + relative);
  }
  await writeFile(
    join(root, 'checksums.sha256'),
    lines.join('\n') + '\n',
    'utf8'
  );
}

async function createScriptHarness(mode) {
  const root = await mkdtemp(join(tmpdir(), 'pmia-hardening-scripts-'));
  for (const script of [currentScript, archiveScript, commonScript]) {
    await copyFile(script, join(root, path.basename(script)));
  }
  const verifier = [
    "param([string]$PackageRoot,[string]$ExpectedKind='')",
    "$ErrorActionPreference='Stop'",
    "$leaf=Split-Path -Leaf $PackageRoot",
    "if ((Test-Path (Join-Path $PSScriptRoot 'fail-current')) -and $leaf -eq 'current') { throw 'forced current verification failure' }",
    "if ((Test-Path (Join-Path $PSScriptRoot 'fail-archive')) -and $leaf -match '^pmia-.+-installed$') { throw 'forced archive verification failure' }",
    "[ordered]@{ok=$true;kind=$ExpectedKind}|ConvertTo-Json"
  ].join('\r\n') + '\r\n';
  await writeFile(join(root, 'Test-PMIADeployment.ps1'), verifier, 'utf8');
  await writeFile(join(root, mode), 'fail\n', 'utf8');
  return {
    root,
    current: join(root, path.basename(currentScript)),
    archive: join(root, path.basename(archiveScript))
  };
}

async function makeJunction(link, target) {
  await symlink(target, link, 'junction');
}

async function removeJunction(link) {
  await rm(link, { recursive: true, force: true });
}
test('failed final verification restores the previous current package', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-current-rollback-'));
  const harness = await createScriptHarness('fail-current');
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
    await rm(harness.root, { recursive: true, force: true });
  });
  const currentRoot = join(deploymentRoot, 'current');
  await mkdir(currentRoot, { recursive: true });
  await writeFile(join(currentRoot, 'previous.txt'), 'previous-package\n', 'utf8');
  const result = runPowerShell(harness.current, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(join(currentRoot, 'previous.txt'), 'utf8'), 'previous-package\n');
  assert.equal(await exists(join(currentRoot, 'deployment-manifest.json')), false);
  const leftovers = (await readdir(deploymentRoot)).filter(name => name.startsWith('.current-'));
  assert.deepEqual(leftovers, []);
});

test('failed first promotion leaves no unverified current package', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-current-first-failure-'));
  const harness = await createScriptHarness('fail-current');
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
    await rm(harness.root, { recursive: true, force: true });
  });
  const result = runPowerShell(harness.current, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(await exists(join(deploymentRoot, 'current')), false);
  const leftovers = (await readdir(deploymentRoot)).filter(name => name.startsWith('.current-'));
  assert.deepEqual(leftovers, []);
});

test('failed final archive verification removes the unverified archive', async t => {
  const fixture = await createFixture('0.6.1');
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-archive-failure-'));
  const harness = await createScriptHarness('fail-archive');
  const registeredPath = join(fixture.root, 'registered-extension');
  await mkdir(registeredPath, { recursive: true });
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
    await rm(harness.root, { recursive: true, force: true });
  });
  const result = runPowerShell(harness.archive, [
    '-InstalledExtensionPath', join(fixture.root, 'runtime/extension'),
    '-DeploymentRoot', deploymentRoot,
    '-RegisteredPath', registeredPath,
    '-ProfileDirectory', 'Default',
    '-ExtensionId', 'fixture-extension-id',
    '-ExpectedVersion', fixture.version
  ]);
  assert.notEqual(result.status, 0);
  const archiveRoot = join(deploymentRoot, 'archive', 'pmia-0.6.1-installed');
  assert.equal(await exists(archiveRoot), false);
  const leftovers = (await readdir(deploymentRoot)).filter(name => name.startsWith('.archive-staging-'));
  assert.deepEqual(leftovers, []);
});

test('deployment root may not overlap the source tree', async t => {
  const fixture = await createFixture();
  t.after(async () => rm(fixture.root, { recursive: true, force: true }));
  const deploymentRoot = join(fixture.root, 'deployment-output');
  const result = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(await exists(join(deploymentRoot, 'current')), false);
});
test('verifier rejects false manifest identity and package statistics', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-manifest-truth-'));
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
  });
  const built = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const currentRoot = join(deploymentRoot, 'current');
  const original = await readManifest(currentRoot);
  const mutations = [
    value => ({ ...value, schemaVersion: 99 }),
    value => ({ ...value, product: 'Wrong Product' }),
    value => ({ ...value, sourceCommit: 'not-a-git-object' }),
    value => ({ ...value, fileCount: Number(value.fileCount) + 1 }),
    value => ({ ...value, totalBytes: Number(value.totalBytes) + 1 }),
    value => ({ ...value, extensionPath: 'wrong/extension' }),
    value => ({ ...value, launcherPath: 'wrong-launcher.ahk' })
  ];
  const rejected = [];
  for (const mutate of mutations) {
    const changed = mutate(original);
    await writeFile(join(currentRoot, 'deployment-manifest.json'), JSON.stringify(changed, null, 2) + '\n', 'utf8');
    await rewriteChecksums(currentRoot);
    const result = runPowerShell(verifyScript, ['-PackageRoot', currentRoot, '-ExpectedKind', 'current']);
    rejected.push(result.status !== 0);
  }
  assert.deepEqual(rejected, mutations.map(() => true));
});

test('archive verifier requires complete registration identity', async t => {
  const fixture = await createFixture('0.6.1');
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-archive-identity-'));
  const registeredPath = join(fixture.root, 'registered-extension');
  await mkdir(registeredPath, { recursive: true });
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
  });
  const built = runPowerShell(archiveScript, [
    '-InstalledExtensionPath', join(fixture.root, 'runtime/extension'),
    '-DeploymentRoot', deploymentRoot,
    '-RegisteredPath', registeredPath,
    '-ProfileDirectory', 'Default',
    '-ExtensionId', 'fixture-extension-id',
    '-ExpectedVersion', fixture.version
  ]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const archiveRoot = join(deploymentRoot, 'archive', 'pmia-0.6.1-installed');
  const original = await readManifest(archiveRoot);
  const fields = ['profileDirectory', 'extensionId', 'registeredPath', 'resolvedExtensionPath'];
  const rejected = [];
  for (const field of fields) {
    const changed = { ...original, [field]: '' };
    await writeFile(join(archiveRoot, 'deployment-manifest.json'), JSON.stringify(changed, null, 2) + '\n', 'utf8');
    await rewriteChecksums(archiveRoot);
    const result = runPowerShell(verifyScript, [
      '-PackageRoot', archiveRoot,
      '-ExpectedKind', 'installed-archive'
    ]);
    rejected.push(result.status !== 0);
  }
  assert.deepEqual(rejected, fields.map(() => true));
});

test('current builder rejects reparse points in allowlisted source', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-source-reparse-root-'));
  const external = await mkdtemp(join(tmpdir(), 'pmia-source-reparse-external-'));
  const link = join(fixture.root, 'runtime', 'external-junction');
  await writeFile(join(external, 'outside.txt'), 'outside-source\n', 'utf8');
  await makeJunction(link, external);
  t.after(async () => {
    await removeJunction(link);
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  });
  const result = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(await exists(join(deploymentRoot, 'current')), false);
});
test('deployment verifier rejects reparse points inside a package', async t => {
  const fixture = await createFixture();
  const deploymentRoot = await mkdtemp(join(tmpdir(), 'pmia-package-reparse-root-'));
  const external = await mkdtemp(join(tmpdir(), 'pmia-package-reparse-external-'));
  const currentRoot = join(deploymentRoot, 'current');
  const link = join(currentRoot, 'runtime', 'external-junction');
  t.after(async () => {
    await removeJunction(link);
    await rm(fixture.root, { recursive: true, force: true });
    await rm(deploymentRoot, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  });
  const built = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', deploymentRoot
  ]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  await writeFile(join(external, 'outside.txt'), 'outside-package\n', 'utf8');
  await makeJunction(link, external);
  const verified = runPowerShell(verifyScript, [
    '-PackageRoot', currentRoot,
    '-ExpectedKind', 'current'
  ]);
  assert.notEqual(verified.status, 0);
});

test('installed archive recovers source commit from a deployed current package', async t => {
  const fixture = await createFixture();
  const currentDeployment = await mkdtemp(join(tmpdir(), 'pmia-deployed-current-'));
  const archiveDeployment = await mkdtemp(join(tmpdir(), 'pmia-deployed-archive-'));
  t.after(async () => {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(currentDeployment, { recursive: true, force: true });
    await rm(archiveDeployment, { recursive: true, force: true });
  });
  const built = runPowerShell(currentScript, [
    '-SourceRoot', fixture.root,
    '-DeploymentRoot', currentDeployment
  ]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const deployedExtension = join(currentDeployment, 'current', 'runtime', 'extension');
  const archived = runPowerShell(archiveScript, [
    '-InstalledExtensionPath', deployedExtension,
    '-DeploymentRoot', archiveDeployment,
    '-RegisteredPath', deployedExtension,
    '-ProfileDirectory', 'Default',
    '-ExtensionId', 'fixture-extension-id',
    '-ExpectedVersion', fixture.version
  ]);
  assert.equal(archived.status, 0, archived.stderr || archived.stdout);
  const archiveRoot = join(archiveDeployment, 'archive', `pmia-${fixture.version}-installed`);
  const archiveManifest = await readManifest(archiveRoot);
  assert.equal(archiveManifest.sourceCommit, fixture.commit);
});
