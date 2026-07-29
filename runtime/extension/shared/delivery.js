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
