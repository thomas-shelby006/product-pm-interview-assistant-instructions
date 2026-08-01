export function createIdleWorkCoordinator({ requestIdle = callback => globalThis.requestIdleCallback?.(callback) ?? setTimeout(() => callback({ timeRemaining: () => 0, didTimeout: true }), 50), cancelIdle = handle => globalThis.cancelIdleCallback?.(handle) ?? clearTimeout(handle) } = {}) {
  let handle = 0;
  const queue = [];
  function schedule(task, { timeout = 500 } = {}) {
    if (typeof task !== 'function') return false;
    queue.push(task);
    if (!handle) handle = requestIdle(run, { timeout });
    return true;
  }
  function run(deadline = { timeRemaining: () => 0, didTimeout: true }) {
    handle = 0;
    while (queue.length && (deadline.didTimeout || deadline.timeRemaining() > 2)) {
      const task = queue.shift();
      try { task(); } catch {}
    }
    if (queue.length) handle = requestIdle(run, { timeout: 500 });
  }
  function cancel() { if (handle) cancelIdle(handle); handle = 0; queue.length = 0; }
  return { schedule, cancel, size: () => queue.length };
}
