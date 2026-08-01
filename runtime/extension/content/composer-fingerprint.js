function normalized(value) { return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim(); }
function hash(value) { let h = 0x811c9dc5; for (const c of String(value || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

export function createComposerFingerprint(element, { revision = 0 } = {}) {
  const text = normalized(element?.value ?? element?.innerText ?? element?.textContent ?? '');
  const tag = String(element?.tagName || '').toLowerCase();
  const role = String(element?.getAttribute?.('role') || '');
  const editable = String(element?.getAttribute?.('contenteditable') || '');
  const aria = String(element?.getAttribute?.('aria-label') || '');
  return {
    textHash: hash(text),
    length: text.length,
    structureHash: hash([tag, role, editable, aria].join('|')),
    tag,
    role,
    revision: Math.max(0, Number(revision) || 0)
  };
}

export function sameComposerOwnership(expected, current) {
  if (!expected || !current) return false;
  return expected.textHash === current.textHash && expected.length === current.length;
}