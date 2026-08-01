export function deriveProofRetryPolicy({ attempt = 0, reason = '', receiverHealthy = true, batchStillRendered = true, now = Date.now(), maxAttempts = 4 } = {}) {
  const current = Math.max(0, Number(attempt || 0));
  if (!receiverHealthy) return { retry: false, terminal: false, reason: 'receiver_unhealthy', attempt: current, dueAt: 0 };
  if (!batchStillRendered) return { retry: false, terminal: true, reason: 'rendered_batch_missing', attempt: current, dueAt: 0 };
  if (current >= maxAttempts) return { retry: false, terminal: true, reason: 'proof_retry_exhausted', attempt: current, dueAt: 0 };
  const delayMs = Math.min(5000, 150 * (2 ** current));
  return { retry: true, terminal: false, reason: String(reason || 'proof_incomplete'), attempt: current + 1, delayMs, dueAt: now + delayMs };
}

export function resetProofRetry() { return { retry: false, terminal: false, reason: 'proof_verified', attempt: 0, delayMs: 0, dueAt: 0 }; }
