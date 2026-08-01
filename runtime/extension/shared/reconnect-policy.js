export class ReconnectPolicy {
  #attempt = 0;
  #probeActive = false;
  #baseMs;
  #capMs;
  #jitter;
  #random;

  constructor({ baseMs = 120, capMs = 8000, jitter = .2, random = Math.random } = {}) {
    this.#baseMs = Math.max(25, Number(baseMs) || 120);
    this.#capMs = Math.max(this.#baseMs, Number(capMs) || 8000);
    this.#jitter = Math.max(0, Math.min(.5, Number(jitter) || 0));
    this.#random = typeof random === 'function' ? random : Math.random;
  }

  next() {
    const attempt = this.#attempt;
    const raw = Math.min(this.#capMs, this.#baseMs * (2 ** Math.min(8, attempt)));
    const sample = Math.max(0, Math.min(1, Number(this.#random()) || 0));
    const factor = 1 - this.#jitter + sample * this.#jitter * 2;
    const delayMs = Math.round(raw * factor);
    this.#attempt += 1;
    return { attempt, delayMs, capped: raw >= this.#capMs };
  }

  beginProbe() {
    if (this.#probeActive) return false;
    this.#probeActive = true;
    return true;
  }

  failProbe() {
    this.#probeActive = false;
    return this.next();
  }

  succeed() {
    this.#attempt = 0;
    this.#probeActive = false;
    return this.snapshot();
  }

  reset() { return this.succeed(); }

  snapshot() {
    return { attempt: this.#attempt, probeActive: this.#probeActive, baseMs: this.#baseMs, capMs: this.#capMs };
  }
}