const DETERMINISTIC_KEYS = Object.freeze([
  'selfTest',
  'adaptiveTurnScenarios',
  'transportDrill',
  'pilotUi',
  'productionUi',
  'assistUi',
  'reliabilityUi',
  'operationsUi'
]);

export function deriveReleaseVerificationStatus({
  deterministic = {},
  providerCanary = {},
  normalProfileActivation = {}
} = {}) {
  const checks = Object.fromEntries(DETERMINISTIC_KEYS.map(key => [key, deterministic?.[key] === true]));
  const deterministicOk = Object.values(checks).every(Boolean);
  const canaryStatus = ['passed', 'limited', 'failed', 'skipped'].includes(providerCanary?.status)
    ? providerCanary.status
    : 'skipped';
  const packageReady = deterministicOk;
  const activationReady = packageReady
    && canaryStatus === 'passed'
    && normalProfileActivation?.ok === true;
  const status = !deterministicOk
    ? 'deterministic_failed'
    : activationReady
      ? 'ready'
      : canaryStatus === 'limited'
        ? 'provider_limited'
        : canaryStatus === 'failed'
          ? 'provider_failed'
          : canaryStatus === 'skipped'
            ? 'provider_not_run'
            : 'activation_pending';
  return {
    status,
    packageReady,
    activationReady,
    deterministicBrowser: { ok: deterministicOk, checks },
    providerCanary: {
      status: canaryStatus,
      reason: String(providerCanary?.reason || '')
    },
    normalProfileActivation: { ok: normalProfileActivation?.ok === true }
  };
}
