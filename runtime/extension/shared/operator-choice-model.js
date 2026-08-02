function fingerprint(parts = []) {
  return parts.map(value => String(value ?? '')).join('|').slice(0, 500);
}

export function deriveOperatorChoice(snapshot = {}, now = Date.now()) {
  const batch = snapshot.batchState || {};
  if (batch.pendingNoResponse) {
    return {
      id: `choice:no_response:${String(batch.pendingNoResponse.batchId || '')}`,
      type: 'no_response',
      title: 'Choose what happens after no response',
      detail: 'Wait preserves the completed batch. Retry resubmits it. Continue releases the protected next batch.',
      options: ['wait','retry','continue'],
      view: 'queue', anchor: 'receiverPolicyState',
      fingerprint: fingerprint(['no_response',batch.pendingNoResponse.batchId,batch.pendingNoResponse.createdAt,batch.next?.batchId,batch.next?.memberFingerprint]),
      createdAt: Math.max(0, Number(batch.pendingNoResponse.createdAt || now)),
      expiresAt: 0
    };
  }
  const conflict = batch.draftConflict;
  if (conflict && ['unresolved','keep_manual'].includes(String(conflict.state || ''))) {
    return {
      id: `choice:draft_conflict:${String(conflict.batchId || batch.next?.batchId || '')}`,
      type: 'draft_conflict',
      title: 'Choose the Window 2 draft owner',
      detail: 'Keep manual text, restore the protected PMIA draft, or merge the manual prefix above the protected batch.',
      options: ['keep_manual','restore_pmia','merge'],
      view: 'queue', anchor: 'draftConflictState',
      fingerprint: fingerprint(['draft_conflict',conflict.batchId,conflict.state,conflict.manualFingerprint,conflict.pmiaFingerprint,batch.next?.memberFingerprint]),
      createdAt: Math.max(0, Number(conflict.createdAt || now)),
      expiresAt: 0
    };
  }
  return null;
}

export function validateOperatorChoice(snapshot = {}, selection = {}, now = Date.now()) {
  const current = deriveOperatorChoice(snapshot, now);
  if (!current) return { ok:false, error:'choice_missing' };
  if (String(selection.choiceId || '') !== current.id) return { ok:false, error:'choice_id_mismatch', current };
  if (String(selection.fingerprint || '') !== current.fingerprint) return { ok:false, error:'choice_stale', current };
  const option = String(selection.option || '');
  if (!current.options.includes(option)) return { ok:false, error:'choice_option_invalid', current };
  if (current.expiresAt && now > current.expiresAt) return { ok:false, error:'choice_expired', current };
  return { ok:true, choice:current, option };
}

export function commandForChoice(type, option) {
  if (type === 'no_response') return { command:'resolve_no_response', payload:{ action:option } };
  if (type === 'draft_conflict') {
    const command = { keep_manual:'resolve_draft_keep_manual', restore_pmia:'resolve_draft_restore_pmia', merge:'resolve_draft_merge' }[option];
    return command ? { command, payload:{} } : null;
  }
  return null;
}