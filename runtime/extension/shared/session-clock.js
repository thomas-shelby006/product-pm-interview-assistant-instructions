function nonNegative(value) { return Math.max(0, Number(value) || 0); }

export function deriveSessionClock(value = {}, now = Date.now()) {
  const current = Number(now) || Date.now();
  const startedAt = nonNegative(value.startedAt);
  const pausedAt = nonNegative(value.pausedAt);
  const pausedTotalMs = nonNegative(value.pausedTotalMs);
  const liveUntil = pausedAt || current;
  const elapsedMs = startedAt ? Math.max(0, liveUntil - startedAt - pausedTotalMs) : 0;
  const segmentStartedAt = nonNegative(value.segment?.startedAt);
  const segmentElapsedMs = segmentStartedAt ? Math.max(0, liveUntil - segmentStartedAt) : 0;
  const segmentDurationMs = nonNegative(value.segment?.durationMs);
  return {
    running: Boolean(startedAt && !pausedAt),
    paused: Boolean(pausedAt),
    elapsedMs,
    plannedDurationMs: nonNegative(value.plannedDurationMs),
    remainingMs: value.plannedDurationMs ? Math.max(0, nonNegative(value.plannedDurationMs) - elapsedMs) : null,
    segment: { ...(value.segment || {}), elapsedMs: segmentElapsedMs, remainingMs: segmentDurationMs ? Math.max(0, segmentDurationMs - segmentElapsedMs) : null }
  };
}

export function pauseSessionClock(value = {}, now = Date.now()) {
  if (!value.startedAt || value.pausedAt) return { ...value };
  return { ...value, pausedAt: Number(now) || Date.now() };
}

export function resumeSessionClock(value = {}, now = Date.now()) {
  if (!value.pausedAt) return { ...value };
  const current = Number(now) || Date.now();
  const delta = Math.max(0, current - Number(value.pausedAt));
  return { ...value, pausedAt: 0, pausedTotalMs: nonNegative(value.pausedTotalMs) + delta, segment: value.segment?.startedAt ? { ...value.segment, startedAt: Number(value.segment.startedAt) + delta } : value.segment };
}
