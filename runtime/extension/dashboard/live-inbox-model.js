function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function entryAge(entry, now) {
  const at = Number(entry?.persistedAt || entry?.queuedAt || entry?.updatedAt || now);
  return Math.max(0, now - at);
}

export function deriveLiveInbox(snapshot, now = Date.now()) {
  const ledger = safeList(snapshot?.ledger);
  const groups = {
    pending: ledger.filter(item => ['persisted', 'failed'].includes(item?.state)),
    staged: ledger.filter(item => item?.state === 'staged'),
    submitting: ledger.filter(item => item?.state === 'submitting'),
    proven: ledger.filter(item => item?.state === 'proven'),
    archived: ledger.filter(item => item?.state === 'archived')
  };
  const active = snapshot?.batchState?.active || null;
  const next = snapshot?.batchState?.next || null;
  const nextCount = Number(next?.questionCount || next?.memberIds?.length || 0);
  const pendingCount = groups.pending.length;
  const inFlightCount = groups.staged.length + groups.submitting.length;
  const receiverReady = Boolean(
    snapshot?.receiver?.connected
    && snapshot?.receiver?.phase === 'ready'
    && snapshot?.receiver?.composerReady
  );
  const blocked = Boolean(
    snapshot?.batchState?.draftConflict
    || snapshot?.storagePressure?.level === 'critical'
    || !receiverReady
  );
  let catchUpState = 'live';
  if (blocked) catchUpState = 'blocked';
  else if (snapshot?.batchState?.hold) catchUpState = 'held';
  else if (nextCount > 0 && ['waiting', 'streaming'].includes(String(snapshot?.answerState?.state || ''))) catchUpState = 'accumulating';
  else if (pendingCount || inFlightCount || nextCount) catchUpState = 'catching_up';

  const actionable = [...groups.pending, ...groups.staged, ...groups.submitting]
    .sort((a, b) => Number(a?.envelope?.seq || 0) - Number(b?.envelope?.seq || 0));
  const oldestAgeMs = actionable.length
    ? Math.max(...actionable.map(entry => entryAge(entry, now)))
    : 0;
  const latest = actionable.at(-1) || null;

  return {
    catchUpState,
    receiverReady,
    blocked,
    activeBatch: active,
    nextBatch: next,
    nextCount,
    pendingCount,
    inFlightCount,
    provenCount: groups.proven.length + Number(snapshot?.proofArchive?.count || 0),
    archivedCount: groups.archived.length,
    totalCount: ledger.length + Number(snapshot?.proofArchive?.count || 0),
    oldestAgeMs,
    latest,
    groups,
    storage: snapshot?.storagePressure || { level: 'normal', percent: 0, bytes: 0 },
    draftConflict: snapshot?.batchState?.draftConflict || null,
    autoSubmit: snapshot?.batchState?.autoSubmit !== false,
    hold: Boolean(snapshot?.batchState?.hold)
  };
}

function firstEvent(timeline, types, predicate = () => true) {
  const wanted = new Set(types);
  return safeList(timeline).find(event => wanted.has(event?.type) && predicate(event)) || null;
}

export function deriveLatencyRail(snapshot) {
  const latestFinal = snapshot?.latestFinal;
  const envelopeId = String(latestFinal?.id || '');
  if (!envelopeId) return { envelopeId: '', milestones: [] };
  const timeline = safeList(snapshot?.timeline);
  const matchesEnvelope = event => {
    const data = event?.data || {};
    return String(data.envelopeId || '') === envelopeId
      || safeList(data.memberIds).map(String).includes(envelopeId);
  };
  const persisted = firstEvent(timeline, ['final_persisted'], matchesEnvelope);
  const staged = firstEvent(timeline, ['batch_staged', 'batch_accumulated', 'next_batch_draft'], matchesEnvelope);
  const submitting = firstEvent(timeline, ['batch_submitting'], matchesEnvelope);
  const proven = firstEvent(timeline, ['batch_proven', 'receiver_proof', 'delivery_proof'], matchesEnvelope);
  const answer = firstEvent(timeline, ['batch_answer_complete', 'answer_captured'], matchesEnvelope);
  const origin = Number(latestFinal.createdAt || persisted?.at || 0);
  const milestone = (label, event) => ({
    label,
    at: Number(event?.at || 0),
    elapsedMs: event?.at && origin ? Math.max(0, Number(event.at) - origin) : null,
    complete: Boolean(event)
  });
  return {
    envelopeId,
    milestones: [
      milestone('Persisted', persisted),
      milestone('Staged', staged),
      milestone('Submitting', submitting),
      milestone('Rendered proof', proven),
      milestone('Answer complete', answer)
    ]
  };
}

export function catchUpLabel(state) {
  const labels = {
    live: 'Caught up',
    accumulating: 'Accumulating next',
    catching_up: 'Catching up',
    held: 'Held by operator',
    blocked: 'Needs attention'
  };
  return labels[state] || 'Unknown';
}
