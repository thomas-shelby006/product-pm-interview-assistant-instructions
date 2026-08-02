function clone(value) {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

const MIGRATIONS = new Map([
  [1, (envelope, metadata = {}) => ({
    ...clone(envelope),
    schemaVersion: 2,
    writerVersion: String(metadata.writerVersion || envelope.writerVersion || ''),
    committedAt: Math.max(0, Number(metadata.now) || Number(envelope.committedAt) || Date.now()),
    sessions: clone(envelope.sessions || [])
  })],
  [2, (envelope, metadata = {}) => ({
    ...clone(envelope),
    schemaVersion: 3,
    writerVersion: String(metadata.writerVersion || envelope.writerVersion || ''),
    committedAt: Math.max(0, Number(metadata.now) || Number(envelope.committedAt) || Date.now()),
    sessions: (clone(envelope.sessions || [])).map(session => ({
      ...session,
      productionControls: session?.productionControls && typeof session.productionControls === 'object'
        ? session.productionControls
        : { operatingProfile: 'balanced', containmentOverrideUntil: 0, containmentOverrideReason: '', lastProfileChangeAt: 0, lastProfileChangeSource: '', lastNavigation: null }
    }))
  })]
]);

export function migrateRuntimeEnvelope(value, targetVersion = 3, metadata = {}) {
  let envelope = clone(value);
  const target = Math.max(1, Number(targetVersion) || 1);
  let current = Math.max(0, Number(envelope?.schemaVersion) || 0);
  if (!current) return { ok: false, reason: 'invalid_schema_version', envelope: null, applied: [] };
  if (current > target) return { ok: false, reason: 'future_schema', envelope, applied: [] };
  const applied = [];
  while (current < target) {
    const migrate = MIGRATIONS.get(current);
    if (!migrate) {
      return { ok: false, reason: `missing_migration_${current}_to_${current + 1}`, envelope, applied };
    }
    envelope = migrate(envelope, metadata);
    applied.push(`${current}->${current + 1}`);
    current = Number(envelope.schemaVersion);
  }
  return { ok: true, reason: applied.length ? 'migrated' : 'current', envelope, applied };
}

export function registeredRuntimeMigrations() {
  return [...MIGRATIONS.keys()].sort((a, b) => a - b).map(source => `${source}->${source + 1}`);
}
