import { BatchPlanner, matchesRenderedBatch } from '../shared/batch-planner.js';

export function createReceiverBatchRuntime({
  adapter,
  planner = new BatchPlanner(),
  draftArbiter = null,
  submitBatch,
  onEvent = () => {},
  nowFn = Date.now
} = {}) {
  if (!adapter || typeof submitBatch !== 'function') {
    throw new TypeError('Receiver batch runtime requires adapter and submitBatch');
  }
  let submitting = false;

  const emit = (type, data = {}) => {
    const event = { type, at: nowFn(), ...data };
    try { onEvent(event); } catch {}
    return event;
  };

  const mirrorNext = () => {
    const next = planner.next();
    if (!next.count) return false;
    const written = Boolean(draftArbiter?.writeBatch?.(next.prompt.text) ?? adapter.setComposerText?.(next.prompt.text));
    emit('next_batch_draft', {
      memberIds: next.prompt.memberIds,
      questionCount: next.prompt.questionCount,
      written
    });
    return written;
  };

  async function submitNext({ force = false } = {}) {
    if (submitting || planner.active()) return { ok: true, staged: true, reason: 'active_batch' };
    if (!planner.nextSize) return { ok: true, staged: false, reason: 'batch_empty' };
    if (!force && (planner.hold || !planner.autoSubmit)) {
      mirrorNext();
      return { ok: true, staged: true, reason: planner.hold ? 'hold_enabled' : 'auto_submit_disabled' };
    }
    if (adapter.isGenerating?.()) {
      mirrorNext();
      return { ok: true, staged: true, reason: 'receiver_generating' };
    }
    const batch = planner.freezeNext(nowFn());
    if (!batch) return { ok: true, staged: true, reason: 'batch_not_ready' };
    submitting = true;
    emit('batch_submitting', {
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      questionCount: batch.prompt.questionCount
    });
    let result;
    try {
      result = await submitBatch(batch);
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    } finally {
      submitting = false;
    }
    if (!result?.ok) {
      planner.failActive();
      mirrorNext();
      emit('batch_submit_failed', {
        batchId: batch.id,
        memberIds: batch.prompt.memberIds,
        reason: result?.error || 'submit_failed'
      });
      return { ok: false, staged: true, batchId: batch.id, memberIds: batch.prompt.memberIds, error: result?.error || 'submit_failed' };
    }
    planner.markSubmitted(nowFn());
    draftArbiter?.release?.('batch');
    emit('batch_submitted', {
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      questionCount: batch.prompt.questionCount,
      proof: result.proof || null
    });
    return {
      ok: true,
      delivered: true,
      staged: false,
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      batch,
      proof: result.proof || null
    };
  }

  return {
    planner,

    async accept(envelope) {
      const added = planner.add(envelope, nowFn());
      if (!added.accepted) return { ok: false, error: added.reason };
      if (added.duplicate) return { ok: true, duplicate: true, staged: true, reason: 'duplicate' };
      emit('batch_accumulated', {
        envelopeId: envelope.id,
        seq: envelope.seq || 0,
        nextCount: planner.nextSize
      });
      if (adapter.isGenerating?.() || planner.active()) {
        mirrorNext();
        const next = planner.next();
        return {
          ok: true,
          delivered: false,
          staged: true,
          reason: 'receiver_busy',
          batchId: 'next',
          memberIds: next.prompt.memberIds
        };
      }
      return submitNext();
    },

    async reconcile({ batches = [], pending = [] } = {}) {
      const messages = adapter.getConversationMessages?.() || [];
      const renderedUsers = messages.filter(message => message.role === 'user');
      const proven = [];
      for (const batch of Array.isArray(batches) ? batches : []) {
        const matched = renderedUsers.some(message => matchesRenderedBatch(message.text, batch.prompt));
        if (!matched) continue;
        proven.push(String(batch.id));
        emit('batch_reconciled', {
          batchId: String(batch.id),
          memberIds: Array.isArray(batch.memberIds) ? batch.memberIds.map(String) : [],
          proof: { ok: true, verified: true, proof: 'existing_rendered_batch' }
        });
      }
      const provenMembers = new Set(
        (Array.isArray(batches) ? batches : [])
          .filter(batch => proven.includes(String(batch.id)))
          .flatMap(batch => batch.memberIds || [])
          .map(String)
      );
      const replayed = [];
      for (const envelope of (Array.isArray(pending) ? pending : [])
        .filter(item => item?.id && !provenMembers.has(String(item.id)))
        .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))) {
        const result = await this.accept(envelope);
        replayed.push({ envelopeId: envelope.id, result });
      }
      return { ok: true, proven, replayed };
    },

    async answerComplete(batchId = '', result = {}) {
      const active = planner.active();
      if (!active) return { ok: true, reason: 'no_active_batch' };
      if (batchId && active.id !== batchId) return { ok: false, error: 'batch_mismatch' };
      const completed = planner.completeActive();
      emit(result?.timeout ? 'batch_answer_timeout' : 'batch_answer_complete', {
        batchId: completed.id,
        memberIds: completed.prompt.memberIds,
        answer: result?.answer || result || null,
        proof: result?.proof || null
      });
      return submitNext();
    },

    mirrorNext,
    submitNext,
    draftState() { return draftArbiter?.snapshot?.() || { owner: 'none', conflict: null }; },
    setHold(value) { planner.setHold(value); return planner.snapshot(); },
    setAutoSubmit(value) { planner.setAutoSubmit(value); return planner.snapshot(); },
    snapshot() { return planner.snapshot(); }
  };
}
