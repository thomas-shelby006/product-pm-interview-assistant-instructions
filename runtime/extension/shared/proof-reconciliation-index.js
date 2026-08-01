import { matchesRenderedBatch, stableFingerprint } from './batch-planner.js';

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function tokens(value) {
  return normalize(value).toLocaleLowerCase().split(' ').filter(Boolean);
}

function shingles(value, width = 4) {
  const values = tokens(value);
  if (values.length < width) return [];
  const result = [];
  for (let index = 0; index <= values.length - width; index += 1) {
    result.push(values.slice(index, index + width).join(' '));
  }
  return result;
}

function add(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

export function buildRenderedProofIndex(messages = [], { fingerprintFn = stableFingerprint } = {}) {
  const rendered = [];
  const exact = new Map();
  const byShingle = new Map();
  const byToken = new Map();
  let queries = 0;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role !== 'user') continue;
    const text = normalize(message.text);
    if (!text) continue;
    const record = { text, rawText: String(message.text || ''), id: String(message.id || '') };
    rendered.push(record);
    add(exact, fingerprintFn(text), record);
    for (const shingle of shingles(text)) add(byShingle, shingle, record);
    for (const token of new Set(tokens(text))) add(byToken, token, record);
  }

  return {
    size: rendered.length,
    matches(prompt, options = {}) {
      queries += 1;
      if (!prompt?.questionCount) return false;
      const expected = normalize(prompt.text);
      if (!expected) return false;
      const fingerprint = options.fingerprintFn || fingerprintFn;
      const candidates = new Set(exact.get(fingerprint(expected)) || []);
      const expectedShingles = shingles(expected);
      for (const shingle of expectedShingles) {
        for (const record of byShingle.get(shingle) || []) candidates.add(record);
      }
      if (!expectedShingles.length) {
        for (const token of new Set(tokens(expected))) {
          for (const record of byToken.get(token) || []) candidates.add(record);
        }
      }
      for (const record of candidates) {
        if (matchesRenderedBatch(record.rawText, prompt)) return true;
      }
      return false;
    },
    stats() {
      return {
        buildPasses: 1,
        messagesIndexed: rendered.length,
        exactKeys: exact.size,
        shingleKeys: byShingle.size,
        tokenKeys: byToken.size,
        queries
      };
    }
  };
}
