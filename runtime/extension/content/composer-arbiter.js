import { createComposerFingerprint, sameComposerOwnership } from './composer-fingerprint.js';

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function createComposerArbiter({ adapter, onConflict = () => {} } = {}) {
  if (!adapter?.setComposerText) throw new TypeError('Composer arbiter requires an adapter');
  let owner = 'none';
  let ownedText = '';
  let ownedFingerprint = null;
  let conflict = null;
  let mergedSubmissionText = '';
  let fingerprintRevision = 0;

  const currentText = () => normalize(adapter.getComposerText?.() || '');
  const currentFingerprint = () => createComposerFingerprint(adapter.findComposer?.(), { revision: ++fingerprintRevision });
  const adoptCurrentFingerprint = () => { ownedFingerprint = currentFingerprint(); };

  function observe() {
    const current = currentText();
    const fingerprint = currentFingerprint();
    const ownershipChanged = Boolean(ownedFingerprint && !sameComposerOwnership(ownedFingerprint, fingerprint));
    if ((owner === 'preview' || owner === 'batch') && current && ownershipChanged) {
      conflict = { owner, expected: ownedText, current, at: Date.now(), state: 'unresolved' };
      owner = 'manual';
      ownedText = current;
      ownedFingerprint = fingerprint;
      try { onConflict({ ...conflict }); } catch {}
    } else if (owner === 'manual' && !current) {
      owner = 'none';
      ownedText = '';
      ownedFingerprint = null;
      conflict = null;
      mergedSubmissionText = '';
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
    adoptCurrentFingerprint();
    conflict = null;
    mergedSubmissionText = '';
    return true;
  }

  function resolveConflict(action) {
    const state = observe();
    if (!conflict && state.owner !== 'manual') return { ok: false, error: 'no_draft_conflict' };
    const source = conflict || { owner: 'batch', expected: ownedText, current: state.text };
    const expected = String(source.expected || ownedText || '').trim();
    const current = String(source.current || state.text || '').trim();
    if (action === 'keep_manual') {
      owner = 'manual';
      ownedText = current;
      adoptCurrentFingerprint();
      conflict = null;
      mergedSubmissionText = '';
      return { ok: true, action, owner, text: current };
    }
    if (!expected) return { ok: false, error: 'pmia_draft_missing' };
    if (action === 'restore_pmia') {
      if (!adapter.setComposerText(expected)) return { ok: false, error: 'composer_write_failed' };
      owner = source.owner === 'preview' ? 'preview' : 'batch';
      ownedText = expected;
      adoptCurrentFingerprint();
      conflict = null;
      mergedSubmissionText = '';
      return { ok: true, action, owner, text: expected };
    }
    if (action === 'merge') {
      const merged = current ? `${current}\n\n---\n\n${expected}` : expected;
      if (!adapter.setComposerText(merged)) return { ok: false, error: 'composer_write_failed' };
      owner = 'batch';
      ownedText = merged;
      adoptCurrentFingerprint();
      mergedSubmissionText = merged;
      conflict = null;
      return { ok: true, action, owner, text: merged };
    }
    return { ok: false, error: 'unsupported_conflict_resolution' };
  }

  return {
    writePreview(text) { return write('preview', text); },
    writeBatch(text) { return write('batch', text); },
    observe,
    resolveConflict,
    submissionTextFor(expectedText) {
      const expected = String(expectedText || '').trim();
      return mergedSubmissionText && normalize(mergedSubmissionText).endsWith(normalize(expected))
        ? mergedSubmissionText
        : expected;
    },
    release(expectedOwner = '') {
      observe();
      if (expectedOwner && owner !== expectedOwner) return false;
      if (owner === 'manual') return false;
      owner = 'none';
      ownedText = '';
      ownedFingerprint = null;
      conflict = null;
      mergedSubmissionText = '';
      return true;
    },
    snapshot() {
      const state = observe();
      return {
        ...state,
        ownedText,
        mergedSubmissionText,
        fingerprint: ownedFingerprint ? { ...ownedFingerprint } : null
      };
    }
  };
}