import { buildRestartContinuity, evaluateRestartContinuity } from '../shared/restart-continuity.js';

export async function runLiveUxRestartScenario({ beforeSnapshot, restart, afterSnapshot, now = Date.now } = {}) {
  const beforeAt = now();
  const before = buildRestartContinuity(await beforeSnapshot(), beforeAt);
  const restartResult = await restart();
  const afterAt = now();
  const after = buildRestartContinuity(await afterSnapshot(), afterAt);
  const continuity = evaluateRestartContinuity(before, after);
  return {
    ok: restartResult?.ok !== false && continuity.ok,
    before,
    after,
    continuity,
    restart: restartResult || { ok: true },
    elapsedMs: Math.max(0, afterAt - beforeAt),
    contentAccessed: false
  };
}
