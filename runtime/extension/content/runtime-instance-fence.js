const FENCE = Symbol.for('pmia.runtime.instance.fence.v1');

export function acquireRuntimeInstanceFence(host = globalThis, { sessionId = '', role = '', instanceId = '' } = {}) {
  const key = `${String(sessionId)}:${String(role)}`;
  const registry = host[FENCE] instanceof Map ? host[FENCE] : new Map();
  host[FENCE] = registry;
  const existing = registry.get(key);
  if (existing?.active) return { acquired: false, reason: 'runtime_instance_active', generation: existing.generation, ownerInstanceId: existing.instanceId, release() {} };
  const generation = Math.max(0, Number(existing?.generation) || 0) + 1;
  const record = { active: true, generation, instanceId: String(instanceId || ''), acquiredAt: Date.now() };
  registry.set(key, record);
  let released = false;
  return {
    acquired: true, reason: 'runtime_instance_acquired', generation, ownerInstanceId: record.instanceId,
    release() { if (released) return false; released = true; const current = registry.get(key); if (current === record) registry.set(key, { ...record, active: false, releasedAt: Date.now() }); return true; }
  };
}