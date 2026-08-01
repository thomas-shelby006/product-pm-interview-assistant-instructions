export const DEFAULT_SESSION_QUOTA_BYTES = 10 * 1024 * 1024;

export function classifyStoragePressure(bytes, quotaBytes = DEFAULT_SESSION_QUOTA_BYTES, breakdown = null) {
  const used = Math.max(0, Number(bytes) || 0);
  const quota = Math.max(1, Number(quotaBytes) || DEFAULT_SESSION_QUOTA_BYTES);
  const ratio = used / quota;
  const percent = Math.round(ratio * 1000) / 10;
  const level = ratio >= 0.95 ? 'critical'
    : ratio >= 0.85 ? 'high'
      : ratio >= 0.70 ? 'elevated'
        : 'normal';
  return { bytes: used, quotaBytes: quota, ratio, percent, level, breakdown: breakdown || null };
}
