const POLICIES = new Set(['conservative', 'adaptive', 'manual']);
const AUTHORITATIVE_BOUNDARIES = new Set([
  'rendered_user_turn',
  'rendered_user_turn_revision',
  'assistant_successor',
  'external_final',
  'protocol_final'
]);

function clean(value, max = 200) {
  const text = String(value || '').trim();
  return text.length <= max ? text : text.slice(0, max);
}

export function normalizeTurnCoordinationPolicy(value = 'adaptive') {
  const policy = clean(value, 32).toLowerCase();
  return POLICIES.has(policy) ? policy : 'adaptive';
}

export function classifyTurnRelation({ active = {}, incoming = {}, policy = 'adaptive', now = Date.now() } = {}) {
  const selectedPolicy = normalizeTurnCoordinationPolicy(policy);
  const activeTurnId = clean(active.sourceTurnId || active.turnId || active.id);
  const incomingTurnId = clean(incoming.sourceTurnId || incoming.turnId);
  const continuationOf = clean(incoming.continuationOf || incoming.parentTurnId || incoming.revisionOf);
  const boundary = clean(incoming.boundary, 64);
  const authoritative = AUTHORITATIVE_BOUNDARIES.has(boundary);
  const interrupted = String(active.outcome || '') === 'interrupted';

  let relation = 'independent';
  let confidence = 'none';
  const reasons = [];

  if (activeTurnId && continuationOf === activeTurnId) {
    relation = incoming.revisionOf ? 'supersedes' : 'continues_active';
    confidence = authoritative ? 'exact' : 'weak';
    reasons.push('explicit_turn_link');
  } else if (activeTurnId && incomingTurnId && incomingTurnId === activeTurnId) {
    relation = 'continues_active';
    confidence = authoritative ? 'exact' : 'weak';
    reasons.push('same_source_turn');
  } else {
    reasons.push('distinct_or_missing_turn_identity');
  }

  if (!interrupted) reasons.push('source_not_interrupted');
  if (!authoritative) reasons.push('incoming_boundary_not_authoritative');
  if (selectedPolicy === 'manual') reasons.push('manual_policy');

  const eligibleRelation = relation === 'continues_active' || relation === 'supersedes';
  const autoInterrupt = selectedPolicy === 'adaptive'
    && eligibleRelation
    && confidence === 'exact'
    && interrupted;

  return {
    relation,
    confidence,
    autoInterrupt,
    policy: selectedPolicy,
    authoritative,
    evaluatedAt: Math.max(0, Number(now || Date.now())),
    reasons
  };
}
