export function buildAlarmGenerationIdentity({ sessionId = '', kind = '', generation = 0, dueAt = 0 } = {}) {
  const safeSession = String(sessionId || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
  const safeKind = String(kind || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 48);
  const gen = Math.max(0, Number(generation || 0));
  const due = Math.max(0, Number(dueAt || 0));
  return { name: `pmia_${safeSession}_${safeKind}_g${gen}_${due}`, sessionId: String(sessionId), kind: String(kind), generation: gen, dueAt: due };
}

export function parseAlarmGenerationIdentity(name = '') {
  const match = /^pmia_(.+)_([^_]+)_g(\d+)_(\d+)$/.exec(String(name || ''));
  if (!match) return null;
  return { sessionKey: match[1], kind: match[2], generation: Number(match[3]), dueAt: Number(match[4]) };
}

export function isCurrentAlarmGeneration(identity = {}, generation = 0) {
  return Number(identity.generation || 0) === Math.max(0, Number(generation || 0));
}
