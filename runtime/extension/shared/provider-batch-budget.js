const DEFAULTS = Object.freeze({
  chatgpt: { maxMembers: 8, maxChars: 12000 },
  claude: { maxMembers: 10, maxChars: 16000 },
  unknown: { maxMembers: 6, maxChars: 8000 }
});

export function deriveProviderBatchBudget({
  provider = 'unknown',
  capabilityComplete = true,
  recentSuccessfulChars = 0,
  recentFailureChars = 0,
  safetyRatio = .85
} = {}) {
  const key = Object.hasOwn(DEFAULTS, provider) ? provider : 'unknown';
  const base = DEFAULTS[key];
  const success = Math.max(0, Number(recentSuccessfulChars) || 0);
  const failure = Math.max(0, Number(recentFailureChars) || 0);
  let maxChars = base.maxChars;
  if (success) maxChars = Math.min(maxChars, Math.max(2048, Math.floor(success / Math.max(.5, Math.min(.95, Number(safetyRatio) || .85)))));
  if (failure) maxChars = Math.min(maxChars, Math.max(2048, Math.floor(failure * .7)));
  if (!capabilityComplete) maxChars = Math.min(maxChars, 6000);
  const maxMembers = Math.max(1, Math.min(base.maxMembers, Math.floor(maxChars / 1200) || 1));
  return {
    provider: key,
    maxMembers,
    maxChars: Math.max(2048, maxChars),
    source: failure ? 'recent_failure' : success ? 'recent_success' : capabilityComplete ? 'provider_default' : 'capability_degraded'
  };
}