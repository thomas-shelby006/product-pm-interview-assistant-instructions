function normalizedPrevious(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    state: String(source.state || 'idle'),
    generating: Boolean(source.generating),
    confidence: String(source.confidence || 'high'),
    reason: String(source.reason || 'initial'),
    observedAt: Math.max(0, Number(source.observedAt || 0)),
    lastEvidenceAt: Math.max(0, Number(source.lastEvidenceAt || source.observedAt || 0))
  };
}

export function reconcileGenerationTruth({
  adapterGenerating = false,
  stopAvailable = false,
  textChanged = false,
  finalHintChanged = false,
  previous = null,
  now = Date.now(),
  staleAfterMs = 1500
} = {}) {
  const at = Number(now);
  const prior = normalizedPrevious(previous);
  const base = { observedAt: at, lastEvidenceAt: prior.lastEvidenceAt };
  if (finalHintChanged) {
    return { ...base, state: 'complete', generating: false, confidence: 'high', reason: 'provider_final_hint', lastEvidenceAt: at };
  }
  if (stopAvailable) {
    return { ...base, state: 'streaming', generating: true, confidence: 'high', reason: 'stop_control', lastEvidenceAt: at };
  }
  if (textChanged) {
    return { ...base, state: 'streaming', generating: true, confidence: 'medium', reason: 'assistant_text_growth', lastEvidenceAt: at };
  }
  if (adapterGenerating) {
    if (!prior.generating) {
      return { ...base, state: 'starting', generating: true, confidence: 'low', reason: 'adapter_signal', lastEvidenceAt: at };
    }
    if (at - prior.lastEvidenceAt <= Math.max(0, Number(staleAfterMs) || 0)) {
      return { ...base, state: prior.state === 'starting' ? 'starting' : 'streaming', generating: true, confidence: 'low', reason: 'adapter_signal' };
    }
    return { ...base, state: 'idle', generating: false, confidence: 'low', reason: 'stale_adapter_signal' };
  }
  return { ...base, state: prior.state === 'complete' ? 'complete' : 'idle', generating: false, confidence: 'high', reason: 'no_generation_evidence' };
}