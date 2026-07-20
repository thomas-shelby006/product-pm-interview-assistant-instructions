const FILLER = new Set([
  'ok', 'okay', 'yes', 'yeah', 'yep', 'fine', 'good', 'correct', 'right',
  'sure', 'continue', 'go on', 'go ahead', 'thank you', 'thanks', 'alright',
  'mhm', 'uh huh', 'um', 'uh'
]);

const QUESTION_START = /^(why|what|how|when|where|who|which|can|could|would|should|tell|describe|explain|walk|give|do|did|are|is|was|were|improve|design|measure|prioriti[sz]e)\b/i;
const TRAILING_FRAGMENT = /\b(and|or|but|because|about|with|without|for|to|the|a|an|like|that|this|would|could|should|how you would|what you would)$/i;

export function normalizeTranscript(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLikelyPartialTranscript(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return true;
  const words = raw.split(/\s+/).filter(Boolean);
  if (/[.!?]$/.test(raw)) return false;
  if (/[-–—]$/.test(raw) || TRAILING_FRAGMENT.test(raw)) return true;
  return words.length < 8 && !QUESTION_START.test(raw);
}

export function isActionableTranscript(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized || FILLER.has(normalized)) return false;
  return !isLikelyPartialTranscript(String(text ?? ''));
}
