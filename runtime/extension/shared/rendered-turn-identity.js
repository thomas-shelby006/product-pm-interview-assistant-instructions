function normalize(value) { return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim(); }
function hash(value) { let h = 0x811c9dc5; for (const char of String(value)) { h ^= char.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

export function canonicalRenderedTurnIdentity({ provider = '', role = '', stableId = '', text = '', previousRole = '', nextRole = '', ordinal = 0 } = {}) {
  const normalized = normalize(text);
  const structural = [provider, role, stableId, previousRole, nextRole, Number(ordinal || 0)].join('|');
  return { provider: String(provider), role: String(role), stableId: String(stableId), textHash: hash(normalized), textLength: normalized.length, structuralHash: hash(structural), identity: stableId ? `${provider}:${role}:${stableId}` : `${provider}:${role}:${hash(`${structural}|${normalized}`)}` };
}

export function sameRenderedTurn(first = {}, second = {}) {
  if (first.identity && second.identity && first.identity === second.identity) return true;
  return first.provider === second.provider && first.role === second.role && first.structuralHash === second.structuralHash && first.textHash === second.textHash;
}
