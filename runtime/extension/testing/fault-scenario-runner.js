function safeSnapshot(value) {
  if (!value || typeof value !== 'object') return value ?? null;
  return JSON.parse(JSON.stringify(value, (key, item) => (
    ['text', 'prompt', 'answer', 'setup', 'clipboard', 'credential', 'credentials', 'token', 'resume', 'jobdescription'].includes(String(key).toLowerCase())
      ? '[redacted]'
      : item
  )));
}

export async function runFaultScenario(name, steps = [], context = {}) {
  const scenario = String(name || '').trim();
  if (!scenario) throw new TypeError('Fault scenario requires a name');
  const records = [];
  let failedAt = '';
  try {
    for (const definition of Array.isArray(steps) ? steps : []) {
      const stepName = String(definition?.name || '').trim();
      if (!stepName || typeof definition?.run !== 'function') throw new TypeError('Invalid fault step');
      const beforeProbe = definition.before || context.snapshot;
      const afterProbe = definition.after || context.snapshot;
      const before = safeSnapshot(typeof beforeProbe === 'function' ? await beforeProbe(context) : null);
      let result;
      try {
        result = await definition.run(context);
      } catch (error) {
        result = { ok: false, error: String(error?.message || error) };
      }
      const after = safeSnapshot(typeof afterProbe === 'function' ? await afterProbe(context) : null);
      const record = { name: stepName, ok: result?.ok !== false, result: safeSnapshot(result), before, after };
      records.push(record);
      if (!record.ok) { failedAt = stepName; break; }
    }
  } finally {
    if (typeof context.cleanup === 'function') await context.cleanup();
  }
  return { ok: !failedAt, name: scenario, steps: records, failedAt, evidence: safeSnapshot(context.evidence || {}) };
}
