const GROUPS = [
  { id: 'delivery', label: 'Delivery', prefixes: ['receiver_proof_', 'transport_', 'receiver_draft_', 'inbox_', 'sequence_'] },
  { id: 'provider', label: 'Provider', prefixes: ['sender_', 'receiver_'] },
  { id: 'storage', label: 'Storage', prefixes: ['session_storage_', 'storage_'] },
  { id: 'recovery', label: 'Recovery', prefixes: ['repair_', 'runtime_degraded', 'runtime_blocked', 'recovery_'] }
];

function groupFor(code) {
  const value = String(code || '');
  return GROUPS.find(group => group.prefixes.some(prefix => value.startsWith(prefix))) || {
    id: 'other', label: 'Other', prefixes: []
  };
}

export function groupRuntimeWarnings(warnings = []) {
  const grouped = new Map();
  for (const warning of Array.isArray(warnings) ? warnings : []) {
    const group = groupFor(warning?.code);
    const current = grouped.get(group.id) || {
      id: group.id,
      label: group.label,
      count: 0,
      critical: 0,
      warnings: []
    };
    current.count += 1;
    if (warning?.severity === 'error') current.critical += 1;
    current.warnings.push(warning);
    grouped.set(group.id, current);
  }
  return [...GROUPS.map(group => grouped.get(group.id) || {
    id: group.id,
    label: group.label,
    count: 0,
    critical: 0,
    warnings: []
  }), ...(grouped.has('other') ? [grouped.get('other')] : [])];
}

export function diagnosticTone(group) {
  if (Number(group?.critical || 0) > 0) return 'error';
  if (Number(group?.count || 0) > 0) return 'warn';
  return 'ok';
}
