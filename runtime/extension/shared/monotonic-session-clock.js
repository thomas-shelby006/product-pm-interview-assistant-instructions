export function normalizeMonotonicClock(value = {}, wallNow = Date.now(), monoNow = 0) {
  return {
    wallAnchor: Math.max(0, Number(value.wallAnchor || wallNow)),
    monoAnchor: Math.max(0, Number(value.monoAnchor || monoNow)),
    elapsedBeforeAnchor: Math.max(0, Number(value.elapsedBeforeAnchor || value.elapsedMs || 0)),
    paused: Boolean(value.paused),
    pausedAtElapsed: Math.max(0, Number(value.pausedAtElapsed || 0)),
    generation: Math.max(0, Number(value.generation || 0))
  };
}

export function monotonicElapsed(value = {}, monoNow = 0) {
  const clock = normalizeMonotonicClock(value, Date.now(), monoNow);
  if (clock.paused) return clock.pausedAtElapsed;
  return Math.max(clock.elapsedBeforeAnchor, clock.elapsedBeforeAnchor + Math.max(0, Number(monoNow) - clock.monoAnchor));
}

export function reanchorMonotonicClock(value = {}, { wallNow = Date.now(), monoNow = 0, generation = 0 } = {}) {
  const elapsed = monotonicElapsed(value, monoNow);
  return { wallAnchor: wallNow, monoAnchor: monoNow, elapsedBeforeAnchor: elapsed, paused: Boolean(value.paused), pausedAtElapsed: value.paused ? elapsed : 0, generation: Math.max(Number(value.generation || 0), Number(generation || 0)) };
}

export function pauseMonotonicClock(value = {}, monoNow = 0) {
  const elapsed = monotonicElapsed(value, monoNow);
  return { ...normalizeMonotonicClock(value, Date.now(), monoNow), paused: true, pausedAtElapsed: elapsed, elapsedBeforeAnchor: elapsed, monoAnchor: monoNow };
}

export function resumeMonotonicClock(value = {}, monoNow = 0) {
  const clock = normalizeMonotonicClock(value, Date.now(), monoNow);
  return { ...clock, paused: false, elapsedBeforeAnchor: clock.paused ? clock.pausedAtElapsed : monotonicElapsed(clock, monoNow), pausedAtElapsed: 0, monoAnchor: monoNow };
}
