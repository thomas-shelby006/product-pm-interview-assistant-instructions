export function classifyDelivery({ route, response, error } = {}) {
  if (!route) {
    return { delivered: false, queued: true, reason: 'receiver_missing' };
  }
  if (error) {
    return { delivered: false, queued: true, reason: 'transport_error' };
  }
  if (response?.ok === true) {
    const outcome = {
      delivered: true,
      queued: false,
      reason: String(response.reason || 'accepted')
    };
    if (response.duplicate === true) outcome.duplicate = true;
    return outcome;
  }
  return {
    delivered: false,
    queued: true,
    reason: String(response?.error || 'receiver_rejected')
  };
}

export async function deliverWithWakeRetry({
  route,
  sendToTab,
  wakeTab = async () => {},
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  retryDelaysMs = [80, 180, 360, 700, 1400]
} = {}) {
  if (!route) return classifyDelivery({ route });
  const attempt = async () => {
    try {
      const response = await sendToTab(route.tabId, {
        type: 'PMIA_DELIVER',
        envelope: route.message
      });
      return classifyDelivery({ route, response });
    } catch (error) {
      return classifyDelivery({ route, error });
    }
  };

  let outcome = await attempt();
  if (outcome.delivered) return outcome;
  await wakeTab(route.tabId);
  for (const delay of retryDelaysMs) {
    await wait(Math.max(0, Number(delay) || 0));
    outcome = await attempt();
    if (outcome.delivered) return outcome;
  }
  return outcome;
}
