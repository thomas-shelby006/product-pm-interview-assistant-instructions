function keyFor(sessionId) {
  const value = String(sessionId || '').trim();
  return value || '__global__';
}

export function createSessionMutationCoordinator() {
  const tails = new Map();

  function run(sessionId, operation) {
    if (typeof operation !== 'function') {
      return Promise.reject(new TypeError('session mutation operation must be a function'));
    }
    const key = keyFor(sessionId);
    const previous = tails.get(key) || Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.catch(() => {});
    tails.set(key, tail);
    return result.finally(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
  }

  function pending(sessionId) {
    return tails.has(keyFor(sessionId));
  }

  return {
    run,
    pending,
    get size() { return tails.size; }
  };
}
