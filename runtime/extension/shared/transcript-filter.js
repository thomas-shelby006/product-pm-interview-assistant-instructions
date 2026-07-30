const FILLER = new Set([
  'ok', 'okay', 'yes', 'yeah', 'yep', 'fine', 'good', 'correct', 'right',
  'sure', 'continue', 'go on', 'go ahead', 'thank you', 'thanks', 'alright',
  'mhm', 'uh huh', 'um', 'uh'
]);

const QUESTION_START = /^(why|what|how|when|where|who|which|can|could|would|should|tell|describe|explain|walk|give|do|did|are|is|was|were|improve|design|measure|prioriti[sz]e)\b/i;
const STATUS_CORE = '(?:transcrib(?:e|ed|ing)(?: audio| speech)?|translat(?:e|ed|ing)(?: audio| speech)?|listening|processing(?: audio| speech)?|connecting|starting voice(?: mode)?|voice mode(?: active)?|speak now|start speaking|tap to interrupt|release to send|recording)';
const TRANSIENT_STATUS = new RegExp(`^(?:${STATUS_CORE})(?:[\\s.…!?]*)$`, 'i');
const TRANSIENT_PREFIX = new RegExp(`^(?:${STATUS_CORE})(?:[\\s.…!?]*)(?:\\s+|\\n+)`, 'i');
const TRANSIENT_SUFFIX = new RegExp(`(?:\\s+|\\n+)(?:${STATUS_CORE})(?:[\\s.…!?]*)$`, 'i');
const TRAILING_FRAGMENT = /\b(and|or|but|because|about|with|without|for|to|the|a|an|like|that|this|would|could|should|how you would|what you would)$/i;

function displayTranscript(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function isTransientLine(text) {
  return TRANSIENT_STATUS.test(displayTranscript(text));
}

export function sanitizeTranscriptCandidate(text) {
  let cleaned = displayTranscript(text);
  if (!cleaned) return '';
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !isTransientLine(line))
    .join('\n')
    .trim();
  let previous = '';
  while (cleaned && cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned
      .replace(TRANSIENT_PREFIX, '')
      .replace(TRANSIENT_SUFFIX, '')
      .trim();
  }
  return isTransientLine(cleaned) ? '' : cleaned;
}

export function normalizeTranscript(text) {
  return sanitizeTranscriptCandidate(text)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTransientTranscriptStatus(text) {
  return isTransientLine(text);
}

export function isStrongFinalTranscript(text) {
  const raw = sanitizeTranscriptCandidate(text);
  return isActionableTranscript(raw) && /[.!?][\s\"']*$/.test(raw);
}

export function isLikelyPartialTranscript(text) {
  const raw = sanitizeTranscriptCandidate(text);
  if (!raw) return true;
  const words = raw.split(/\s+/).filter(Boolean);
  if (/[.!?]$/.test(raw)) return false;
  if (/[-–—]$/.test(raw) || TRAILING_FRAGMENT.test(raw)) return true;
  return words.length < 8 && !QUESTION_START.test(raw);
}

export function isActionableTranscript(text) {
  const raw = sanitizeTranscriptCandidate(text);
  const normalized = normalizeTranscript(raw);
  if (!normalized || FILLER.has(normalized)) return false;
  return !isLikelyPartialTranscript(raw);
}

export function createRecentTranscriptCache({
  ttlMs = 30000,
  maxSize = 256,
  nowFn = Date.now
} = {}) {
  const seen = new Map();
  const keyFor = (text, phase, identity = '') => {
    const normalizedPhase = String(phase || 'preview');
    const normalizedIdentity = String(identity || '').trim();
    const normalizedText = normalizeTranscript(text);
    const discriminator = normalizedIdentity && normalizedPhase === 'final'
      ? normalizedIdentity
      : `${normalizedIdentity}\u0000${normalizedText}`;
    return `${normalizedPhase}\u0000${discriminator}`;
  };
  const prune = now => {
    for (const [key, timestamp] of seen) {
      if (now - timestamp > ttlMs) seen.delete(key);
    }
    while (seen.size > maxSize) seen.delete(seen.keys().next().value);
  };
  return {
    accept(text, phase = 'preview', identity = '', now = nowFn()) {
      const key = keyFor(text, phase, identity);
      if (!normalizeTranscript(text)) return false;
      prune(now);
      if (seen.has(key)) return false;
      seen.set(key, now);
      prune(now);
      return true;
    },
    forget(text, phase = 'preview', identity = '') {
      seen.delete(keyFor(text, phase, identity));
    },
    clear() { seen.clear(); },
    get size() { return seen.size; }
  };
}
