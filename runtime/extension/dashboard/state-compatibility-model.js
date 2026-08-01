function firstCode(audit) {
  return String(
    audit?.findings?.find(item => item?.severity === 'blocked')?.code
    || audit?.quarantine?.reason
    || audit?.integrity?.reason
    || ''
  );
}

function actionFor(code) {
  if (code === 'future_schema') return 'upgrade_extension';
  if (code === 'digest_mismatch' || code === 'runtime_invariant_blocked') return 'export_and_repair';
  return code ? 'inspect_compatibility' : 'none';
}

export function deriveStateCompatibility(snapshot) {
  const audit = snapshot?.stateAudit && typeof snapshot.stateAudit === 'object'
    ? snapshot.stateAudit
    : {};
  const schema = audit.schema && typeof audit.schema === 'object' ? audit.schema : {};
  const migration = Array.isArray(schema.migration) ? schema.migration.map(String) : [];
  const integrity = audit.integrity && typeof audit.integrity === 'object' ? audit.integrity : {};
  const code = firstCode(audit);
  const blocked = Number(audit.blocked || 0) > 0 || integrity.state === 'blocked';
  const recovered = !blocked && (audit.recovered === true || integrity.state === 'recovered');
  const migrated = !blocked && !recovered && (migration.length > 0 || integrity.state === 'sealed');
  const state = blocked ? 'blocked' : recovered ? 'recovered' : migrated ? 'migrated' : 'compatible';
  const schemaPath = migration.length ? migration.join(', ') : String(schema.version || '--');
  const nextAction = blocked ? actionFor(code) : recovered ? 'review_recovery' : 'none';
  const labels = {
    compatible: 'Compatible',
    migrated: 'Migrated',
    recovered: 'Recovered',
    blocked: 'Blocked'
  };
  const details = {
    compatible: 'Current schema and integrity digest are verified.',
    migrated: `State upgraded through ${schemaPath} and sealed with the current digest.`,
    recovered: `Last-known-good state restored after ${String(audit.recoveryReason || integrity.reason || 'compatibility check').replaceAll('_', ' ')}.`,
    blocked: `Runtime activation stopped: ${String(code || 'state incompatible').replaceAll('_', ' ')}.`
  };
  return {
    state,
    label: labels[state],
    detail: details[state],
    schemaVersion: Math.max(0, Number(schema.version) || 0),
    writerVersion: String(schema.writerVersion || ''),
    schemaPath,
    integrityState: String(integrity.state || 'unknown'),
    integrityReason: String(integrity.reason || ''),
    quarantinePresent: Boolean(audit.quarantine?.present),
    nextAction,
    code
  };
}
