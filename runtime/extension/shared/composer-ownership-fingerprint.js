function hash(value) {
  let current = 0x811c9dc5;
  for (const char of String(value || '')) { current ^= char.codePointAt(0); current = Math.imul(current, 0x01000193) >>> 0; }
  return current.toString(16).padStart(8, '0');
}

export function buildComposerOwnershipFingerprint({ provider = '', role = '', nodeKind = '', aria = '', placeholder = '', text = '', editable = false, connected = false } = {}) {
  const normalizedText = String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  const identity = [provider, role, nodeKind, aria, placeholder, editable ? 'editable' : 'readonly', connected ? 'connected' : 'detached'].map(value => String(value || '').trim().toLowerCase()).join('|');
  return { identityHash: hash(identity), textHash: hash(normalizedText), textLength: normalizedText.length, editable: Boolean(editable), connected: Boolean(connected) };
}

export function compareComposerOwnership(previous = {}, current = {}) {
  if (!previous.identityHash || !current.identityHash) return { sameOwner: false, textChanged: true, reason: 'fingerprint_missing' };
  return { sameOwner: previous.identityHash === current.identityHash, textChanged: previous.textHash !== current.textHash || previous.textLength !== current.textLength, reason: previous.identityHash !== current.identityHash ? 'composer_owner_changed' : previous.textHash !== current.textHash ? 'composer_text_changed' : 'composer_unchanged' };
}
