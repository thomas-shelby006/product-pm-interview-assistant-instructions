export function classifyDelivery({ route, response, error } = {}) {
  if (!route) {
    return { delivered: false, queued: true, reason: 'receiver_missing' };
  }
  if (error) {
    return { delivered: false, queued: true, reason: 'transport_error' };
  }
  if (response?.ok === true) {
    return { delivered: true, queued: false, reason: 'accepted' };
  }
  return {
    delivered: false,
    queued: true,
    reason: String(response?.error || 'receiver_rejected')
  };
}
