function clean(value, max = 160) { return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }

export function buildReleaseIdentity({ name = 'PMIA', version = '0.10.3', commit = '', manifestHash = '', evidenceHash = '', builtAt = 0 } = {}) {
  return { name: clean(name, 80), version: clean(version, 32), commit: clean(commit, 64), manifestHash: clean(manifestHash, 128), evidenceHash: clean(evidenceHash, 128), builtAt: Math.max(0, Number(builtAt || 0)), channel: 'candidate' };
}

export function validateReleaseIdentity(value = {}) {
  const missing = ['name','version','commit','manifestHash','evidenceHash'].filter(key => !String(value[key] || '').trim());
  return { ok: missing.length === 0 && /^0\.10\./.test(String(value.version || '')), missing, version: String(value.version || ''), commit: String(value.commit || '') };
}
