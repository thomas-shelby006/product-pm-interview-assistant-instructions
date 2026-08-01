function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function createComposerArbiter({ adapter, onConflict = () => {} } = {}) {
  if (!adapter?.setComposerText) throw new TypeError('Composer arbiter requires an adapter');
  let owner = 'none';
  let ownedText = '';
  let conflict = null;

  const currentText = () => normalize(adapter.getComposerText?.() || '');

  function observe() {
    const current = currentText();
    if ((owner === 'preview' || owner === 'batch') && current && current !== normalize(ownedText)) {
      conflict = { owner, expected: ownedText, current, at: Date.now() };
      owner = 'manual';
      ownedText = current;
      try { onConflict({ ...conflict }); } catch {}
    } else if (owner === 'manual' && !current) {
      owner = 'none';
      ownedText = '';
      conflict = null;
    }
    return { owner, text: current, conflict: conflict ? { ...conflict } : null };
  }

  function write(nextOwner, text) {
    const normalized = String(text || '').trim();
    const state = observe();
    if (nextOwner === 'preview' && ['batch', 'manual'].includes(state.owner)) return false;
    if (nextOwner === 'batch' && state.owner === 'manual') return false;
    if (!adapter.setComposerText(normalized)) return false;
    owner = nextOwner;
    ownedText = normalized;
    conflict = null;
    return true;
  }

  return {
    writePreview(text) { return write('preview', text); },
    writeBatch(text) { return write('batch', text); },
    observe,
    release(expectedOwner = '') {
      observe();
      if (expectedOwner && owner !== expectedOwner) return false;
      if (owner === 'manual') return false;
      owner = 'none';
      ownedText = '';
      conflict = null;
      return true;
    },
    snapshot() {
      const state = observe();
      return { ...state, ownedText };
    }
  };
}
