export function classifyDelivery({ route, response, error } = {}) {
  if (!route) {
    return { delivered: false, queued: true, reason: 'receiver_missing' };
  }
  if (error) {
    return { delivered: false, queued: true, reason: 'transport_error' };
  }
  if (response?.ok === true && response?.staged === true) {
    return {
      delivered: false,
      queued: true,
      staged: true,
      reason: String(response.reason || 'staged'),
      batchId: String(response.batchId || 'next'),
      memberIds: Array.isArray(response.memberIds) ? response.memberIds.map(String) : [],
      duplicate: Boolean(response.duplicate)
    };
  }
  if (response?.ok === true) {
    const reason = String(response.reason || 'accepted');
    if (reason === 'stale_ack') {
      return {
        delivered: false,
        queued: true,
        staged: true,
        reason,
        batchId: String(response.batchId || 'next'),
        memberIds: Array.isArray(response.memberIds) ? response.memberIds.map(String) : []
      };
    }
    const outcome = {
      delivered: response.delivered !== false,
      queued: false,
      reason,
      staged: false,
      batchId: String(response.batchId || ''),
      memberIds: Array.isArray(response.memberIds) ? response.memberIds.map(String) : [],
      proof: response.proof || null
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
  retryDelaysMs = [25, 60, 140, 300, 600]
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
  if (outcome.delivered || outcome.superseded) return outcome;
  await wakeTab(route.tabId);
  for (const delay of retryDelaysMs) {
    await wait(Math.max(0, Number(delay) || 0));
    outcome = await attempt();
    if (outcome.delivered || outcome.superseded) return outcome;
  }
  return outcome;
}
