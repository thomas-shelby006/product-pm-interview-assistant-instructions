export async function waitForProviderReady(adapter, { timeoutMs = 30000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    try {
      if (adapter?.isReady?.()) return true;
    } catch {}
    if (Date.now() >= deadline) return false;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (true);
}
