export function sequenceForEnvelope(current, kind = 'question') {
  const normalized = Number.isSafeInteger(current) && current > 0 ? current : 0;
  if (String(kind || '').toLowerCase() !== 'question') {
    return { seq: 0, next: normalized, advanced: false };
  }
  const next = normalized + 1;
  return { seq: next, next, advanced: true };
}
