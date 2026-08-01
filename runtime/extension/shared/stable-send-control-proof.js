export function buildSendControlSample(value = {}, now = Date.now()) {
  return { selector: String(value.selector || ''), visible: Boolean(value.visible), enabled: Boolean(value.enabled), connected: value.connected !== false, composerReady: Boolean(value.composerReady), at: Math.max(0, Number(value.at || now)) };
}

export function proveStableSendControl(samples = [], { minSamples = 2, maxGapMs = 1200 } = {}) {
  const list = (Array.isArray(samples) ? samples : []).map(buildSendControlSample).slice(-Math.max(2, Number(minSamples) || 2));
  if (list.length < minSamples) return { ready: false, reason: 'send_control_samples_missing', samples: list };
  const latest = list.at(-1);
  const selectorStable = list.every(item => item.selector && item.selector === latest.selector);
  const stateStable = list.every(item => item.visible && item.enabled && item.connected && item.composerReady);
  const gapSafe = list.slice(1).every((item, index) => item.at - list[index].at <= maxGapMs);
  return { ready: selectorStable && stateStable && gapSafe, reason: !selectorStable ? 'send_control_selector_unstable' : !stateStable ? 'send_control_not_ready' : !gapSafe ? 'send_control_sample_gap' : 'send_control_stable', selector: selectorStable ? latest.selector : '', samples: list };
}
