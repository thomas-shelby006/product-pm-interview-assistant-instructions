const CURRENT_VERSION = '0.11.0';
const CURRENT_RELEASE_FAMILY = `${CURRENT_VERSION.split('.').slice(0, 2).join('.')}.`;
function clean(value, max = 160) { return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }

export function buildReleaseIdentity({ name = 'PMIA', version = CURRENT_VERSION, commit = '', manifestHash = '', evidenceHash = '', builtAt = 0 } = {}) {
  return { name: clean(name, 80), version: clean(version, 32), commit: clean(commit, 64), manifestHash: clean(manifestHash, 128), evidenceHash: clean(evidenceHash, 128), builtAt: Math.max(0, Number(builtAt || 0)), channel: 'candidate' };
}

export function validateReleaseIdentity(value = {}) {
  const missing = ['name','version','commit','manifestHash','evidenceHash'].filter(key => !String(value[key] || '').trim());
  return { ok: missing.length === 0 && String(value.version || '').startsWith(CURRENT_RELEASE_FAMILY), missing, version: String(value.version || ''), commit: String(value.commit || '') };
}
