import { BatchPlanner, matchesRenderedBatch } from '../shared/batch-planner.js';

export function createReceiverBatchRuntime({
  adapter,
  planner = new BatchPlanner(),
  draftArbiter = null,
  submitBatch,
  onEvent = () => {},
  nowFn = Date.now,
  waitFn = ms => new Promise(resolve => setTimeout(resolve, ms)),
  interruptTimeoutMs = 800,
  interruptPollMs = 25
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
    const written = Boolean(
      draftArbiter?.writeBatch?.(next.prompt.text)
      ?? adapter.setComposerText?.(next.prompt.text)
    );
    emit('next_batch_draft', {
      memberIds: next.prompt.memberIds,
      questionCount: next.prompt.questionCount,
      focusId: next.prompt.focusId,
      fingerprint: next.prompt.fingerprint,
      protectedCount: next.count,
      partitionCount: next.partitionCount,
      firstPartitionCount: next.firstPartitionCount,
      remainingCount: next.remainingCount,
      written
    });
    return written;
  };

  const hasManualConflict = () => draftArbiter?.snapshot?.().owner === 'manual';

  async function executeBatch(batch, source = 'automatic') {
    if (!batch) return { ok: false, staged: true, error: 'batch_missing' };
    if (hasManualConflict()) {
      planner.failActive();
      emit('batch_submit_blocked', {
        batchId: batch.id,
        memberIds: batch.prompt.memberIds,
        reason: 'draft_conflict'
      });
      return {
        ok: false,
        staged: true,
        batchId: batch.id,
        memberIds: batch.prompt.memberIds,
        error: 'draft_conflict'
      };
    }
    submitting = true;
    emit('batch_submitting', {
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      questionCount: batch.prompt.questionCount,
      focusId: batch.prompt.focusId,
      fingerprint: batch.prompt.fingerprint,
      memberFingerprint: batch.prompt.memberFingerprint,
      source
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
        reason: result?.error || 'submit_failed',
        source
      });
      return {
        ok: false,
        staged: true,
        batchId: batch.id,
        memberIds: batch.prompt.memberIds,
        error: result?.error || 'submit_failed'
      };
    }
    planner.markSubmitted(nowFn());
    draftArbiter?.release?.('batch');
    const proof = result.proof ? {
      ...result.proof,
      batchId: batch.id,
      memberIds: [...batch.prompt.memberIds],
      fingerprint: batch.prompt.fingerprint,
      memberFingerprint: batch.prompt.memberFingerprint
    } : null;
    const verified = proof?.ok !== false && proof?.verified === true;
    emit('batch_submitted', {
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      questionCount: batch.prompt.questionCount,
      focusId: batch.prompt.focusId,
      fingerprint: batch.prompt.fingerprint,
      memberFingerprint: batch.prompt.memberFingerprint,
      source,
      proof,
      verified
    });
    return {
      ok: true,
      delivered: verified,
      staged: !verified,
      reason: verified ? 'accepted' : 'proof_pending',
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      batch,
      proof
    };
  }

  async function submitNext({ force = false } = {}) {
    if (submitting || planner.active()) {
      return { ok: true, staged: true, reason: 'active_batch' };
    }
    if (!planner.nextSize) return { ok: true, staged: false, reason: 'batch_empty' };
    if (hasManualConflict()) {
      return { ok: false, staged: true, error: 'draft_conflict' };
    }
    if (!force && (planner.hold || !planner.autoSubmit)) {
      mirrorNext();
      return {
        ok: true,
        staged: true,
        reason: planner.hold ? 'hold_enabled' : 'auto_submit_disabled'
      };
    }
    if (adapter.isGenerating?.()) {
      mirrorNext();
      return { ok: true, staged: true, reason: 'receiver_generating' };
    }
    const batch = planner.freezeNext(nowFn());
    return executeBatch(batch, force ? 'operator_submit_now' : 'automatic');
  }

  async function waitUntilIdle() {
    const attempts = Math.max(1, Math.ceil(interruptTimeoutMs / interruptPollMs));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!adapter.isGenerating?.()) return true;
      await waitFn(interruptPollMs);
    }
    return !adapter.isGenerating?.();
  }

  return {
    planner,

    async accept(envelope) {
      const added = planner.add(envelope, nowFn());
      if (!added.accepted) return { ok: false, error: added.reason };
      if (added.duplicate) {
        return { ok: true, duplicate: true, staged: true, reason: 'duplicate' };
      }
      emit('batch_accumulated', {
        envelopeId: envelope.id,
        seq: envelope.seq || 0,
        nextCount: planner.nextSize,
        partitionCount: planner.next().partitionCount
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
          memberIds: [String(envelope.id)],
          protectedCount: next.count,
          partitionCount: next.partitionCount
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
          proof: {
            ok: true, verified: true, proof: 'existing_rendered_batch',
            batchId: String(batch.id),
            memberIds: Array.isArray(batch.memberIds) ? batch.memberIds.map(String) : [],
            fingerprint: String(batch.prompt?.fingerprint || ''),
            memberFingerprint: String(batch.prompt?.memberFingerprint || '')
          }
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

    async interruptLatest() {
      if (submitting) return { ok: false, error: 'submission_in_progress' };
      if (!planner.nextSize) return { ok: false, error: 'no_waiting_final' };
      if (hasManualConflict()) return { ok: false, error: 'draft_conflict' };
      if (adapter.isGenerating?.()) {
        if (!adapter.stopGenerating?.()) return { ok: false, error: 'stop_failed' };
        emit('answer_interrupt_requested', { nextCount: planner.nextSize });
        if (!await waitUntilIdle()) return { ok: false, error: 'stop_timeout' };
      }
      const selected = planner.interruptLatest(nowFn());
      if (!selected?.batch) return { ok: false, error: 'no_waiting_final' };
      emit('batch_interrupted', {
        interruptedBatchId: selected.interrupted?.id || '',
        batchId: selected.batch.id,
        memberIds: selected.batch.prompt.memberIds,
        preservedNextIds: planner.next().entries.map(entry => String(entry.id))
      });
      return executeBatch(selected.batch, 'operator_interrupt_latest');
    },

    mirrorNext,
    submitNext,
    draftState() {
      return draftArbiter?.snapshot?.() || { owner: 'none', conflict: null };
    },
    async setHold(value) {
      planner.setHold(value);
      emit('batch_policy_changed', {
        hold: planner.hold,
        autoSubmit: planner.autoSubmit
      });
      if (!planner.hold) return submitNext();
      mirrorNext();
      return { ok: true, hold: planner.hold, autoSubmit: planner.autoSubmit };
    },
    async setAutoSubmit(value) {
      planner.setAutoSubmit(value);
      emit('batch_policy_changed', {
        hold: planner.hold,
        autoSubmit: planner.autoSubmit
      });
      if (planner.autoSubmit && !planner.hold) return submitNext();
      mirrorNext();
      return { ok: true, hold: planner.hold, autoSubmit: planner.autoSubmit };
    },
    snapshot() { return planner.snapshot(); }
  };
}
