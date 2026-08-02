function safeError(error, fallback) {
  return { ok: false, persisted: false, error: String(error?.message || error || fallback) };
}

function authoritative(response) {
  return Boolean(response?.persisted || response?.terminal);
}

export async function racePersistenceLanes({ direct, fallback } = {}) {
  if (typeof fallback !== 'function') throw new TypeError('fallback lane is required');
  if (typeof direct !== 'function') return fallback();

  const directResult = Promise.resolve()
    .then(() => direct())
    .then(response => ({ lane: 'direct', response }))
    .catch(error => ({ lane: 'direct', response: safeError(error, 'direct_failed') }));
  const fallbackResult = Promise.resolve()
    .then(() => fallback())
    .then(response => ({ lane: 'fallback', response }))
    .catch(error => ({ lane: 'fallback', response: safeError(error, 'fallback_failed') }));

  const first = await Promise.race([directResult, fallbackResult]);
  if (first.lane === 'fallback' || authoritative(first.response)) return first.response;
  return (await fallbackResult).response;
}
