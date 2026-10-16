const STAGES = new Set(['captured','fanout','composer_written','submitted','rendered','failed']);

export function createStageLog({ limit = 200, now = () => Date.now(), initial = [] } = {}) {
  const values = [];
  const append = (entry = {}) => {
    const stage = String(entry.stage || '');
    if (!STAGES.has(stage)) return false;
    const value = {
      ts:Number(entry.ts ?? now()),
      role:String(entry.role || ''),
      turnId:String(entry.turnId || ''),
      stage,
      elapsedMs:Number.isFinite(entry.elapsedMs) ? Math.max(0, Number(entry.elapsedMs)) : null,
      reason:String(entry.reason || '')
    };
    values.push(value);
    if (values.length > limit) values.splice(0, values.length - limit);
    return true;
  };
  for (const entry of Array.isArray(initial) ? initial : []) append(entry);
  return {
    append,
    snapshot() { return values.map(value => ({ ...value })); },
    clear() { values.length = 0; }
  };
}
