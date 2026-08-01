export function classifyDelivery({ route, response, error } = {}) {
  if (!route) {
    return { delivered: false, queued: true, reason: 'receiver_missing' };
  }
  if (error) {
    return { delivered: false, queued: true, reason: 'transport_error' };
  }
  if (response?.ok === true && response?.buffered === true) {
    return {
      delivered: false,
      queued: true,
      buffered: true,
      reason: String(response.reason || 'buffered_gap'),
      expectedSeq: Number(response.expectedSeq || 0),
      bufferedCount: Number(response.bufferedCount || 0),
      duplicate: Boolean(response.duplicate)
    };
  }
  if (response?.ok === true && response?.duplicate === true) {
    return {
      delivered: false,
      queued: false,
      duplicate: true,
      reason: String(response.reason || 'duplicate_ack')
    };
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
      reason
    };
    const batchId = String(response.batchId || '');
    const memberIds = Array.isArray(response.memberIds) ? response.memberIds.map(String) : [];
    if (batchId) outcome.batchId = batchId;
    if (memberIds.length) outcome.memberIds = memberIds;
    if (response.proof) outcome.proof = response.proof;
    if (response.fingerprint) outcome.fingerprint = String(response.fingerprint);
    if (response.memberFingerprint) outcome.memberFingerprint = String(response.memberFingerprint);    if (response.duplicate === true) outcome.duplicate = true;
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
  if (outcome.delivered || outcome.staged || outcome.buffered) return outcome;
  await wakeTab(route.tabId);
  for (const delay of retryDelaysMs) {
    await wait(Math.max(0, Number(delay) || 0));
    outcome = await attempt();
    if (outcome.delivered || outcome.staged || outcome.buffered) return outcome;
  }
  return outcome;
}
