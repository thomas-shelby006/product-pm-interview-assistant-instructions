import { BatchPlanner } from '../shared/batch-planner.js';
import { buildRenderedProofIndex } from '../shared/proof-reconciliation-index.js';
import { BatchTransaction } from '../shared/batch-transaction.js';
import { deriveProviderBatchBudget } from '../shared/provider-batch-budget.js';
import { deriveBatchSchedulingDecision } from '../shared/batch-scheduling-policy.js';
import { deriveBatchPreview } from '../shared/batch-preview-model.js';
import { normalizeReceiverDeliveryPolicy, postAnswerDecision, updateReceiverDeliveryPolicy } from '../shared/receiver-delivery-policy.js';
import { acknowledgeAnswer, buildAnswerAcknowledgement, buildAnswerHandoff, buildInterruptPlan, resolveNoResponse } from '../shared/answer-operations.js';

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
  let activeTransaction = null;
  let lastTransaction = null;
  let lastSuccessfulChars = 0;
  let lastFailureChars = 0;
  let lastSchedulingDecision = null;
  let queueOnly = { active: false, reason: '' };
  let deliveryPolicy = normalizeReceiverDeliveryPolicy();
  let lastAnswerOutcome = null;
  let lastCompletedBatch = null;
  let pendingNoResponse = null;
  let interruptPlan = null;

  const emit = (type, data = {}) => {
    const event = { type, at: nowFn(), ...data };
    try { onEvent(event); } catch {}
    return event;
  };

  const applyProviderBudget = () => {
    const budget = deriveProviderBatchBudget({
      provider: adapter.provider || 'unknown',
      capabilityComplete: true,
      recentSuccessfulChars: lastSuccessfulChars,
      recentFailureChars: lastFailureChars
    });
    const configured = planner.budget();
    const applied = {
      ...budget,
      maxMembers: Math.min(configured.maxMembers, budget.maxMembers),
      maxChars: Math.min(configured.maxChars, budget.maxChars)
    };
    planner.setBudget({ maxMembers: applied.maxMembers, maxChars: applied.maxChars });
    return applied;
  };

  const ensureTransaction = batch => {
    if (!batch) return null;
    if (!activeTransaction || activeTransaction.snapshot().batchId !== batch.id) {
      activeTransaction = new BatchTransaction({
        batchId: batch.id,
        memberIds: batch.prompt?.memberIds || [],
        createdAt: batch.createdAt || nowFn()
      });
      activeTransaction.transition('frozen', { now: nowFn(), reason: 'planner_freeze' });
    }
    return activeTransaction;
  };

  const transitionTransaction = (next, reason, data = {}) => {
    if (!activeTransaction) return null;
    const result = activeTransaction.transition(next, { reason, now: nowFn(), data });
    if (result.ok) lastTransaction = result.transaction;
    return result;
  };
  const mirrorNext = () => {
    applyProviderBudget();
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
    const transaction = ensureTransaction(batch);
    const submittingTransition = transitionTransaction('submitting', source);
    if (!submittingTransition?.ok) return { ok: false, staged: true, error: submittingTransition?.error || 'batch_transaction_invalid' };
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
      result = await submitBatch({
        ...batch,
        submissionText: draftArbiter?.submissionTextFor?.(batch.prompt.text) || batch.prompt.text
      });
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    } finally {
      submitting = false;
    }
    if (!result?.ok) {
      lastFailureChars = Number(batch.prompt?.text?.length || 0);
      transitionTransaction('draft', result?.error || 'submit_failed');
      activeTransaction = null;
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
    if (verified) {
      lastSuccessfulChars = Math.max(lastSuccessfulChars, Number(batch.prompt?.text?.length || 0));
      transitionTransaction('proven', 'rendered_proof');
      transitionTransaction('answering', 'answer_observation_started');
    }
    emit('batch_submitted', {
      batchId: batch.id,
      memberIds: batch.prompt.memberIds,
      questionCount: batch.prompt.questionCount,
      focusId: batch.prompt.focusId,
      fingerprint: batch.prompt.fingerprint,
      memberFingerprint: batch.prompt.memberFingerprint,
      source,
      transaction: activeTransaction?.snapshot() || transaction?.snapshot() || null,
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
    if (queueOnly.active) {
      mirrorNext();
      return {
        ok: true,
        staged: true,
        reason: 'queue_only',
        deliveryPolicy: { ...queueOnly }
      };
    }
    applyProviderBudget();
    const next = planner.next();
    if (!next.count) return { ok: true, staged: false, reason: 'batch_empty' };
    const entriesById = new Map(next.entries.map(entry => [String(entry.id), entry]));
    const partitions = next.partitions.map(partition => {
      const entries = partition.memberIds.map(id => entriesById.get(String(id))).filter(Boolean);
      return {
        ...partition,
        oldestAt: entries.length ? Math.min(...entries.map(entry => Number(entry.addedAt || 0)).filter(Boolean)) : 0,
        firstSeq: entries.length ? Math.min(...entries.map(entry => Number(entry.envelope?.seq || 0)).filter(Boolean)) : 0
      };
    });
    lastSchedulingDecision = deriveBatchSchedulingDecision({
      memberIds: next.entries.map(entry => entry.id),
      oldestAt: next.entries[0]?.addedAt || 0,
      partitions,
      now: nowFn(),
      hold: planner.hold,
      autoSubmit: planner.autoSubmit,
      receiverBusy: Boolean(adapter.isGenerating?.()),
      draftConflict: hasManualConflict()
    });
    emit('batch_schedule_evaluated', lastSchedulingDecision);
    if (hasManualConflict()) return { ok: false, staged: true, error: 'draft_conflict', scheduling: lastSchedulingDecision };
    if (!force && !lastSchedulingDecision.submitRecommended) {
      mirrorNext();
      return { ok: true, staged: true, reason: lastSchedulingDecision.reason, scheduling: lastSchedulingDecision };
    }
    if (adapter.isGenerating?.()) {
      mirrorNext();
      return { ok: true, staged: true, reason: 'receiver_generating', scheduling: lastSchedulingDecision };
    }
    const batch = planner.freezeNext(nowFn());
    ensureTransaction(batch);
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
      if (queueOnly.active || adapter.isGenerating?.() || planner.active()) {
        mirrorNext();
        const next = planner.next();
        return {
          ok: true,
          delivered: false,
          staged: true,
          reason: queueOnly.active ? 'queue_only' : 'receiver_busy',
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
      const proofIndex = buildRenderedProofIndex(messages);
      const proven = [];
      for (const batch of Array.isArray(batches) ? batches : []) {
        if (!proofIndex.matches(batch.prompt)) continue;
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
      const answerState = String(result?.answerState?.state || (result?.timeout ? 'timed_out' : 'complete'));
      transitionTransaction('terminal', answerState, { proofVerified: result?.proof?.verified === true });
      transitionTransaction('released', 'post_answer_policy');
      lastTransaction = activeTransaction?.snapshot() || lastTransaction;
      activeTransaction = null;
      lastCompletedBatch = completed;
      lastAnswerOutcome = buildAnswerAcknowledgement({
        batchId: completed.id,
        memberIds: completed.prompt.memberIds,
        answerState: result?.answerState || { state: answerState },
        completedAt: nowFn(),
        reason: result?.answerState?.reason || answerState
      }, nowFn());
      pendingNoResponse = answerState === 'no_response' ? { ...lastAnswerOutcome } : null;
      const eventType = {
        complete: 'batch_answer_complete',
        no_response: 'batch_answer_no_response',
        timed_out: 'batch_answer_timeout',
        cancelled: 'batch_answer_cancelled'
      }[answerState] || 'batch_answer_complete';
      emit(eventType, {
        batchId: completed.id,
        memberIds: completed.prompt.memberIds,
        answerState: result?.answerState || { state: answerState },
        answer: result?.answer || result || null,
        proof: result?.proof || null,
        handoff: buildAnswerHandoff({ ...lastAnswerOutcome, answerState: result?.answerState, proof: result?.proof })
      });
      const decision = postAnswerDecision(deliveryPolicy, { nextCount: planner.nextSize, answerState });
      deliveryPolicy = decision.nextPolicy;
      emit('post_answer_policy', { ...decision, policy: { ...deliveryPolicy }, nextCount: planner.nextSize });
      if (['await_resolution', 'pause', 'idle'].includes(decision.action)) {
        mirrorNext();
        return { ok: true, staged: planner.nextSize > 0, reason: decision.reason, policy: { ...deliveryPolicy } };
      }
      if (decision.action === 'submit_next') return submitNext({ force: true });
      return submitNext();
    },

    previewInterrupt() {
      interruptPlan = buildInterruptPlan(planner.snapshot(), nowFn());
      emit('interrupt_preview_created', { ...interruptPlan });
      return { ...interruptPlan, activeMemberIds: [...interruptPlan.activeMemberIds], preservedIds: [...interruptPlan.preservedIds] };
    },

    async interruptLatest(token = '') {
      if (submitting) return { ok: false, error: 'submission_in_progress' };
      if (!planner.nextSize) return { ok: false, error: 'no_waiting_final' };
      if (hasManualConflict()) return { ok: false, error: 'draft_conflict' };
      if (!interruptPlan || !token || token !== interruptPlan.token) {
        return { ok: false, error: 'interrupt_confirmation_required', plan: this.previewInterrupt() };
      }
      const latestId = planner.next().entries.at(-1)?.id || '';
      if (latestId !== interruptPlan.latestId) return { ok: false, error: 'interrupt_plan_stale', plan: this.previewInterrupt() };
      if (adapter.isGenerating?.()) {
        if (!adapter.stopGenerating?.()) return { ok: false, error: 'stop_failed' };
        emit('answer_interrupt_requested', { nextCount: planner.nextSize, token });
        if (!await waitUntilIdle()) return { ok: false, error: 'stop_timeout' };
      }
      const selected = planner.interruptLatest(nowFn());
      interruptPlan = null;
      if (!selected?.batch) return { ok: false, error: 'no_waiting_final' };
      emit('batch_interrupted', {
        interruptedBatchId: selected.interrupted?.id || '',
        batchId: selected.batch.id,
        memberIds: selected.batch.prompt.memberIds,
        preservedNextIds: planner.next().entries.map(entry => String(entry.id))
      });
      return executeBatch(selected.batch, 'operator_interrupt_latest');
    },

    acknowledgeLastAnswer() {
      if (!lastAnswerOutcome) return { ok: false, error: 'answer_outcome_missing' };
      lastAnswerOutcome = acknowledgeAnswer(lastAnswerOutcome, nowFn());
      emit('answer_acknowledged', { ...lastAnswerOutcome });
      return { ok: true, acknowledgement: { ...lastAnswerOutcome } };
    },

    async resolveNoResponseAction(action = 'wait') {
      if (!pendingNoResponse || !lastCompletedBatch) return { ok: false, error: 'no_response_missing' };
      const resolution = resolveNoResponse(pendingNoResponse, action, nowFn());
      emit('no_response_resolved', resolution);
      if (resolution.nextAction === 'retry_completed_batch') {
        planner.requeueEntries(lastCompletedBatch.entries);
        pendingNoResponse = null;
        return submitNext({ force: true });
      }
      if (resolution.nextAction === 'submit_next') {
        pendingNoResponse = null;
        return submitNext({ force: true });
      }
      return { ok: true, staged: true, reason: 'no_response_wait_extended', resolution };
    },

    async resolveDraftConflict(action) {
      const resolved = draftArbiter?.resolveConflict?.(action) || { ok: false, error: 'draft_arbiter_unavailable' };
      if (!resolved.ok) return resolved;
      emit('draft_conflict_resolved', {
        action: String(action || ''),
        owner: String(resolved.owner || '')
      });
      if (action === 'keep_manual') return { ...resolved, staged: true, reason: 'manual_draft_kept' };
      if (action === 'restore_pmia' && planner.nextSize) {
        draftArbiter?.writeBatch?.(planner.next().prompt.text);
      }
      return submitNext({ force: true });
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
        autoSubmit: planner.autoSubmit,
        queueOnly: { ...queueOnly }
      });
      if (!planner.hold && !queueOnly.active) return submitNext();
      mirrorNext();
      return { ok: true, hold: planner.hold, autoSubmit: planner.autoSubmit, queueOnly: { ...queueOnly } };
    },
    async setQueueOnly(value, reason = '') {
      queueOnly = {
        active: Boolean(value),
        reason: Boolean(value) ? String(reason || 'runtime_degraded') : ''
      };
      emit('batch_policy_changed', {
        hold: planner.hold,
        autoSubmit: planner.autoSubmit,
        queueOnly: { ...queueOnly }
      });
      if (!queueOnly.active && !planner.hold) return submitNext();
      mirrorNext();
      return { ok: true, hold: planner.hold, autoSubmit: planner.autoSubmit, queueOnly: { ...queueOnly } };
    },
    setDeliveryPolicy(patch = {}) {
      deliveryPolicy = updateReceiverDeliveryPolicy(deliveryPolicy, patch, nowFn());
      emit('receiver_delivery_policy_changed', { policy: { ...deliveryPolicy } });
      return { ok: true, policy: { ...deliveryPolicy } };
    },
    async setAutoSubmit(value) {
      planner.setAutoSubmit(value);
      emit('batch_policy_changed', {
        hold: planner.hold,
        autoSubmit: planner.autoSubmit,
        queueOnly: { ...queueOnly }
      });
      if (planner.autoSubmit && !planner.hold && !queueOnly.active) return submitNext();
      mirrorNext();
      return { ok: true, hold: planner.hold, autoSubmit: planner.autoSubmit, queueOnly: { ...queueOnly } };
    },
    snapshot() {
      return {
        ...planner.snapshot(),
        transaction: activeTransaction?.snapshot() || null,
        lastTransaction: lastTransaction ? { ...lastTransaction, memberIds: [...(lastTransaction.memberIds || [])], history: (lastTransaction.history || []).map(item => ({ ...item })) } : null,
        budget: planner.budget(),
        scheduling: lastSchedulingDecision ? { ...lastSchedulingDecision, memberIds: [...(lastSchedulingDecision.memberIds || [])] } : null,
        deliveryPolicy: { ...queueOnly },
        receiverPolicy: { ...deliveryPolicy },
        preview: deriveBatchPreview({ plannerState: planner.snapshot(), budget: planner.budget(), policy: deliveryPolicy }),
        answerAcknowledgement: lastAnswerOutcome ? { ...lastAnswerOutcome } : null,
        pendingNoResponse: pendingNoResponse ? { ...pendingNoResponse } : null,
        interruptPlan: interruptPlan ? { ...interruptPlan, activeMemberIds: [...interruptPlan.activeMemberIds], preservedIds: [...interruptPlan.preservedIds] } : null,
        answerHandoff: lastAnswerOutcome ? buildAnswerHandoff(lastAnswerOutcome) : null
      };
    }
  };
}
