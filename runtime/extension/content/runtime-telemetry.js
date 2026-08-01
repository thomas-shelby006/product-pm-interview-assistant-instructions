export function classifySourceSilence({
  role,
  voiceActive,
  lastSourceActivityAt,
  now = Date.now(),
  idleWarningMs = 90000,
  voiceSlowMs = 6000,
  voiceStalledMs = 15000
} = {}) {
  if (role !== 'sender' || !Number(lastSourceActivityAt)) {
    return { state: 'not_applicable', ageMs: 0, thresholdMs: 0 };
  }
  const ageMs = Math.max(0, Number(now) - Number(lastSourceActivityAt));
  if (voiceActive && ageMs >= voiceStalledMs) {
    return { state: 'voice_stalled', ageMs, thresholdMs: voiceStalledMs };
  }
  if (voiceActive && ageMs >= voiceSlowMs) {
    return { state: 'voice_slow', ageMs, thresholdMs: voiceSlowMs };
  }
  if (!voiceActive && ageMs >= idleWarningMs) {
    return { state: 'idle_silent', ageMs, thresholdMs: idleWarningMs };
  }
  return { state: 'healthy', ageMs, thresholdMs: voiceActive ? voiceSlowMs : idleWarningMs };
}

function cleanText(value, max = 1200) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}â€¦` : text;
}

function stableValue(value) {
  return JSON.stringify(value);
}

export function createRuntimeTelemetry({
  runtimeConfig,
  adapter,
  send,
  getPhase = () => 'ready',
  getTransportPaused = () => false,
  getScrollLocked = () => false,
  getVoiceActive = () => false,
  heartbeatMs = 5000,
  silenceWarningMs = 90000,
  now = () => Date.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  let latestPreview = null;
  let latestFinal = null;
  let latestAnswer = null;
  let lastActivityAt = now();
  let lastSourceActivityAt = runtimeConfig?.role === 'sender' ? now() : 0;
  let micState = 'unknown';
  let lastFingerprint = '';
  let closed = false;

  function snapshot(event = null) {
    const current = now();
    const sourceSilence = classifySourceSilence({
      role: runtimeConfig?.role,
      voiceActive: Boolean(getVoiceActive()),
      lastSourceActivityAt,
      now: current,
      idleWarningMs: silenceWarningMs
    });
    const sourceSilenceMs = sourceSilence.ageMs;
    return {
      role: runtimeConfig?.role || '',
      provider: runtimeConfig?.provider || '',
      phase: getPhase(),
      composerReady: Boolean(adapter?.findComposer?.()),
      generating: Boolean(adapter?.isGenerating?.()),
      voiceActive: Boolean(getVoiceActive()),
      micState,
      scrollLocked: Boolean(getScrollLocked()),
      transportPaused: Boolean(getTransportPaused()),
      latestPreview,
      latestFinal,
      latestAnswer,
      lastActivityAt,
      lastSourceActivityAt,
      sourceSilenceMs,
      sourceSilent: ['idle_silent', 'voice_slow', 'voice_stalled'].includes(sourceSilence.state),
      sourceSilenceState: sourceSilence.state,
      sourceSilenceThresholdMs: sourceSilence.thresholdMs,
      heartbeatAt: current,
      pageUrl: String(globalThis.location?.href || ''),
      ...(event ? { event } : {})
    };
  }

  async function publish({ force = false, event = null } = {}) {
    if (closed) return false;
    const telemetry = snapshot(event);
    const comparable = { ...telemetry, heartbeatAt: 0, sourceSilenceMs: 0 };
    const fingerprint = stableValue(comparable);
    if (!force && !event && fingerprint === lastFingerprint) return false;
    lastFingerprint = fingerprint;
    try {
      const response = await send({
        type: 'PMIA_RUNTIME_TELEMETRY',
        sessionId: runtimeConfig.sessionId,
        telemetry
      });
      return Boolean(response?.ok);
    } catch {
      return false;
    }
  }

  function touchActivity({ source = false } = {}) {
    const current = now();
    lastActivityAt = current;
    if (source) lastSourceActivityAt = current;
  }

  function preview(value) {
    latestPreview = value ? {
      turnKey: String(value.turnKey || ''),
      revision: Number(value.revision || 0),
      phase: String(value.phase || 'interim'),
      text: cleanText(value.text),
      createdAt: Number(value.createdAt || now())
    } : null;
    touchActivity({ source: true });
    void publish();
  }

  function final(envelope) {
    latestFinal = envelope ? {
      id: String(envelope.id || ''),
      seq: Number(envelope.seq || 0),
      kind: String(envelope.kind || ''),
      text: envelope.kind === 'boot' ? '[Session setup redacted]' : cleanText(envelope.text),
      createdAt: Number(envelope.createdAt || now())
    } : null;
    touchActivity({ source: true });
    void publish({ force: true });
  }

  function answer(value) {
    latestAnswer = value ? {
      envelopeId: String(value.envelopeId || ''),
      wordCount: Number(value.wordCount || 0),
      elapsedMs: Number(value.elapsedMs || 0),
      text: cleanText(value.text)
    } : null;
    touchActivity();
    void publish({ force: true, event: value ? { type: 'answer', ...latestAnswer } : null });
  }

  function answerTimeout(envelopeId) {
    touchActivity();
    void publish({
      force: true,
      event: { type: 'answer_timeout', envelopeId: String(envelopeId || '') }
    });
  }

  function event(type, data = {}) {
    touchActivity();
    void publish({ force: true, event: { type, ...data } });
  }

  function setMicState(value) {
    micState = String(value || 'unknown');
    touchActivity();
    void publish({ force: true });
  }

  const timer = setIntervalFn(() => {
    void publish({ force: true });
  }, heartbeatMs);

  return {
    publish,
    touchActivity,
    preview,
    final,
    answer,
    answerTimeout,
    event,
    setMicState,
    snapshot,
    disconnect() {
      if (closed) return;
      closed = true;
      clearIntervalFn(timer);
    }
  };
}
