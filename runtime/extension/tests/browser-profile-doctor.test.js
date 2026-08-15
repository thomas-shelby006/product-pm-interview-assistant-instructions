import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../Browser_Profile_Doctor.ps1', import.meta.url));

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value), 'utf8');
}

async function createProfile(root, directory, displayName, settings = {}) {
  const profile = join(root, directory);
  await mkdir(profile, { recursive: true });
  await writeJson(join(profile, 'Preferences'), { profile: { name: displayName } });
  await writeJson(join(profile, 'Secure Preferences'), { extensions: { settings } });
}

function runDoctor(root, expectedPath, profile = '') {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-UserDataRoot', root, '-ExpectedExtensionPath', expectedPath];
  if (profile) args.push('-ProfileDirectory', profile);
  const result = spawnSync('powershell.exe', args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [header, ...lines] = result.stdout.trim().split(/\r?\n/);
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => Object.fromEntries(
    line.split('\t').map((value, index) => [columns[index], value])
  ));
}

test('doctor reports a matching PMIA extension registration', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-profile-doctor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extension = join(root, 'product-pm-interview-assistant-instructions', 'runtime', 'extension');
  await mkdir(extension, { recursive: true });
  await writeJson(join(extension, 'manifest.json'), { version: '0.6.0' });
  await createProfile(root, 'Default', 'Profile 1', {
    pmia: {
      path: extension,
      location: 4,
      service_worker_registration_info: { version: '0.6.0' }
    }
  });
  const [profile] = runDoctor(root, extension);
  assert.equal(profile.directory, 'Default');
  assert.equal(profile.displayName, 'Profile 1');
  assert.equal(profile.extensionId, 'pmia');
  assert.equal(profile.version, '0.6.0');
  assert.equal(profile.pathMatches, 'True');
  assert.equal(profile.issueCode, 'OK');
});

test('doctor distinguishes path and version mismatches', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-profile-doctor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected = join(root, 'product-pm-interview-assistant-instructions', 'runtime', 'extension');
  const old = join(root, 'product-pm-interview-assistant-instructions', '.worktrees', 'old', 'runtime', 'extension');
  await mkdir(expected, { recursive: true });
  await mkdir(old, { recursive: true });
  await writeJson(join(expected, 'manifest.json'), { version: '0.6.0' });
  await createProfile(root, 'Default', 'Profile 1', {
    pmia: { path: old, location: 4, service_worker_registration_info: { version: '0.5.3' } }
  });
  const [mismatch] = runDoctor(root, expected);
  assert.equal(mismatch.issueCode, 'EXTENSION_PATH_MISMATCH');
  assert.equal(mismatch.pathMatches, 'False');

  await createProfile(root, 'Profile 2', 'Interview', {
    pmia: { path: expected, location: 4, service_worker_registration_info: { version: '0.5.3' } }
  });
  const [version] = runDoctor(root, expected, 'Profile 2');
  assert.equal(version.issueCode, 'EXTENSION_VERSION_MISMATCH');
  assert.match(version.issueMessage, /expected 0\.6\.0/);
});

test('doctor reads the unpacked manifest version when Edge omits service worker version metadata', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pmia-profile-doctor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extension = join(root, 'product-pm-interview-assistant-instructions', 'runtime', 'extension');
  await mkdir(extension, { recursive: true });
  await writeJson(join(extension, 'manifest.json'), { version: '0.11.0' });
  await createProfile(root, 'Default', 'Profile 1', {
    pmia: { path: extension, location: 4, has_started_service_worker: true }
  });
  const [profile] = runDoctor(root, extension, 'Default');
  assert.equal(profile.version, '0.11.0');
  assert.equal(profile.pathMatches, 'True');
  assert.equal(profile.issueCode, 'OK');
});