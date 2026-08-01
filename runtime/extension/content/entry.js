import { parseRuntimeConfig, makeEnvelope } from '../shared/protocol.js';
import { makePreview } from '../shared/preview.js';
import { createChatGptAdapter } from './adapters/chatgpt.js';
import { createClaudeAdapter } from './adapters/claude.js';
import {
  createReceiverController,
  submitComposerWhenReady,
  clearSubmittedComposer,
  runtimeLifecycleTitle,
  defendTitle,
  redactSensitiveSessionText,
  installOverflowSafety,
  sleep
} from './runtime.js';
import { createStatusOverlay } from './status-overlay.js';
import { createClaudeSignalBridge } from './signals/claude-isolated.js';
import { createClaudeSignalHandler } from './signals/claude-runtime.js';
import { createProviderObserver } from './observation/provider-observer.js';
import { createProviderSender } from './senders/provider-sender.js';
import { createChatGptTurnTracker } from './senders/chatgpt-turn-tracker.js';
import { createWakeSignal } from './answer-tracker.js';
import { createReceiverAnswerOrchestrator } from './receiver-answer-orchestrator.js';
import { createLatestPreviewScheduler } from './preview-scheduler.js';
import { createRuntimeRecovery } from './runtime-recovery.js';
import { nextSequence } from '../shared/sequence.js';
import { ContiguousSequenceBuffer } from '../shared/contiguous-sequence-buffer.js';
import { deriveSequenceFeedback } from '../shared/sequence-feedback.js';
import { deriveReceiverCredits } from '../shared/receiver-flow-control.js';
import { ReceiverCreditHysteresis } from '../shared/receiver-credit-hysteresis.js';
import { buildSessionExport, renderSessionMarkdown } from '../shared/session-log.js';
import { describeRuntimeStatus } from '../shared/session-status.js';
import { extractSafeSessionContext } from '../shared/session-context.js';
import { renderRuntimeFatal } from './runtime-fatal.js';
import { createRecentTranscriptCache, isActionableTranscript, sanitizeTranscriptCandidate } from '../shared/transcript-filter.js';
import { createPreflightResponder } from './preflight-responder.js';
import { createRuntimeTelemetry } from './runtime-telemetry.js';
import { getOrCreateRuntimeInstanceId, shouldApplyRoleRevocation } from './role-revocation.js';
import { sendWithRegistrationRecovery } from './registration-recovery.js';
import { createSenderOutbox } from './sender-outbox.js';
import { createSessionStorageAdapter } from './session-storage-adapter.js';
import { createReceiverBatchRuntime } from './receiver-batch-runtime.js';
import { createRuntimeRolePort } from './runtime-role-port.js';
import { createComposerArbiter } from './composer-arbiter.js';
import { safeBatchTelemetry } from '../shared/batch-event-policy.js';
import { acquireRuntimeInstanceFence } from './runtime-instance-fence.js';

const CONFIG_KEY = 'pmia_runtime_config_v1';

function actualProvider(hostname) {
  return hostname.includes('claude.ai') ? 'claude' : 'chatgpt';
}

function readConfig() {
  const fromUrl = parseRuntimeConfig(location.href);
  if (fromUrl) {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify(fromUrl));
    const url = new URL(location.href);
    for (const key of ['pmia_session', 'pmia_role', 'pmia_provider']) url.searchParams.delete(key);
    history.replaceState(history.state, '', url.href);
    return fromUrl;
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONFIG_KEY) || 'null');
    if (!stored?.sessionId || !stored?.role || !stored?.provider) return null;
    return stored;
  } catch {
    return null;
  }
}

const config = readConfig();
if (!config) {
  console.debug('[PMIA] no runtime config; normal provider tab left untouched');
} else {
  startRuntime(config).catch(error => {
    console.error('[PMIA] runtime failed', error);
    renderRuntimeFatal(document, {
      stage: 'start',
      error,
      version: chrome.runtime.getManifest().version
    });
  });
}

async function startRuntime(runtimeConfig) {
  const observedProvider = actualProvider(location.hostname);
  if (observedProvider !== runtimeConfig.provider) {
    console.error('[PMIA] provider mismatch', { runtimeConfig, observedProvider });
    return;
  }

  const adapter = runtimeConfig.provider === 'claude'
    ? createClaudeAdapter(document)
    : createChatGptAdapter(document);
  const runtimeVersion = chrome.runtime.getManifest().version;
  const runtimeInstanceKey = `pmia_runtime_instance_${runtimeConfig.sessionId}_${runtimeConfig.role}`;
  const runtimeInstanceId = getOrCreateRuntimeInstanceId(sessionStorage, runtimeInstanceKey);
  const runtimeFence = acquireRuntimeInstanceFence(globalThis, {
    sessionId: runtimeConfig.sessionId,
    role: runtimeConfig.role,
    instanceId: runtimeInstanceId
  });
  if (!runtimeFence.acquired) {
    console.warn('[PMIA] duplicate runtime instance fenced', {
      sessionId: runtimeConfig.sessionId,
      role: runtimeConfig.role,
      generation: runtimeFence.generation
    });
    return;
  }
  const respondToPreflight = createPreflightResponder({
    runtimeConfig,
    adapter,
    version: runtimeVersion,
    instanceId: runtimeInstanceId
  });
  const overlay = createStatusOverlay(document, runtimeConfig);
  const removeOverflowSafety = installOverflowSafety(document);
  const restoreTitle = defendTitle(document, runtimeLifecycleTitle(runtimeConfig, 'boot'));
  let runtimeRegistered = false;
  let rolePort = null;
  const refreshLifecycleTitle = () => {
    const phase = runtimeRegistered
      ? (adapter.findComposer() ? 'ready' : 'registered')
      : 'boot';
    restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, phase));
    return phase;
  };
  let paused = false;
  let transportPaused = false;
  let scrollLocked = false;
  let latestBootContext = '';
  let telemetry = null;
  let receiverAnswerOrchestrator = null;
  let registrationActive = true;
  let assistantFinalHintVersion = 0;
  let claudeProtocolVoiceActive = false;
  let providerSignalBridge = null;
  let unsubscribeProviderSignals = null;
  let senderObserver = null;
  let receiverObserver = null;
  let senderController = null;
  let receiverBatchRuntime = null;
  let runtimeRecovery = null;
  const answerWake = createWakeSignal();
  const senderSequenceKey = `pmia_sender_seq_${runtimeConfig.sessionId}`;
  const receiverSequenceKey = `pmia_receiver_seq_${runtimeConfig.sessionId}`;
  const receiverSequenceBufferKey = `pmia_receiver_sequence_buffer_${runtimeConfig.sessionId}`;
  let senderSequence = Number(sessionStorage.getItem(senderSequenceKey) || 0);
  let previewSequence = 0;
  const previewStreamId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let receiverSequenceSnapshot = {};
  try {
    receiverSequenceSnapshot = JSON.parse(sessionStorage.getItem(receiverSequenceBufferKey) || '{}');
  } catch {
    receiverSequenceSnapshot = {};
  }
  const receiverSequenceBuffer = new ContiguousSequenceBuffer({
    ...receiverSequenceSnapshot,
    lastAcceptedSeq: Number(
      receiverSequenceSnapshot.lastAcceptedSeq
      || sessionStorage.getItem(receiverSequenceKey)
      || 0
    )
  });
  let sequenceGapActive = receiverSequenceBuffer.status().hasGap;
  let lastSequenceGapSignature = '';
  let sequenceDrainTimer = null;
  let sequenceDrainAttempt = 0;
  const outboundTranscriptCache = createRecentTranscriptCache();
  const receiverCreditHysteresis = new ReceiverCreditHysteresis({ recoveryWindowMs: 500 });

  function deriveSmoothedReceiverCredits(input = {}) {
    const raw = deriveReceiverCredits({
      bufferedCount: input.bufferedCount,
      maxBuffered: input.maxBuffered ?? input.capacity,
      activeMembers: input.activeMembers ?? input.active,
      hold: input.hold,
      paused: input.paused,
      storageCritical: input.storageCritical,
      draftConflict: input.draftConflict
    });
    return receiverCreditHysteresis.update(raw, {
      now: Date.now(),
      critical: raw.reason === 'storage_critical',
      reason: raw.reason
    });
  }

  function isCombinedVoiceActive() {
    return Boolean(
      adapter.isVoiceActive?.() ||
      (runtimeConfig.provider === 'claude' && claudeProtocolVoiceActive)
    );
  }

  const message = async payload => {
    try {
      return await chrome.runtime.sendMessage({ ...payload, runtimeInstanceId });
    } catch (error) {
      const detail = String(error?.message || error);
      const invalidated = /extension context invalidated/i.test(detail);
      overlay.setStatus(
        invalidated ? 'RELOAD TAB' : 'EXTENSION OFFLINE',
        'error',
        invalidated ? 0 : 3500
      );
      console.warn('[PMIA] message failed', error);
      return { ok: false, error: detail, terminal: invalidated };
    }
  };

  const legacySenderOutboxKey = `pmia_sender_outbox_${runtimeConfig.sessionId}`;
  let senderOutbox = null;
  let senderOutboxReady = runtimeConfig.role !== 'sender';
  async function initializeSenderOutbox() {
    if (runtimeConfig.role !== 'sender' || senderOutbox) return senderOutbox;
    const storageAdapter = await createSessionStorageAdapter({
      send: message,
      sessionId: runtimeConfig.sessionId,
      legacyStorage: sessionStorage,
      legacyKey: legacySenderOutboxKey
    });
    senderOutbox = createSenderOutbox({
      initialEntries: storageAdapter.initialEntries,
      saveState: entries => storageAdapter.save(entries),
      restoredCount: storageAdapter.restoredCount,
      recoverySource: storageAdapter.recoverySource,
      onState: value => telemetry?.event('outbox_state', value)
    });
    senderOutboxReady = true;
    return senderOutbox;
  }

  async function persistEnvelope(envelope) {
    const fallback = async () => {
      const forwarding = await sendWithRegistrationRecovery({
        send: payload => message(payload),
        register,
        payload: { type: 'PMIA_FORWARD', envelope }
      });
      if (forwarding.recovered) {
        telemetry?.event('registration_recovered_before_forward', {
          envelopeId: envelope.id,
          attempts: forwarding.attempts
        });
      }
      return forwarding.response || { ok: false, persisted: false, error: 'no_response' };
    };
    let response;
    try {
      response = rolePort?.connected
        ? await rolePort.request('final', { envelope }, { timeoutMs: 500, fallback })
        : await fallback();
    } catch {
      response = await fallback();
    }
    if (response?.persisted && senderOutbox) await senderOutbox.ackPersisted(envelope.id);
    return response;
  }

  async function replaySenderOutbox({ immediate = false } = {}) {
    if (!senderOutbox?.size || !runtimeRegistered || paused) return [];
    if (immediate) return senderOutbox.retryNow(envelope => persistEnvelope(envelope));
    const results = await senderOutbox.replay(envelope => persistEnvelope(envelope));
    if (senderOutbox.size) senderOutbox.schedule(envelope => persistEnvelope(envelope));
    return results;
  }

  rolePort = createRuntimeRolePort({
    chromeApi: chrome,
    sessionId: runtimeConfig.sessionId,
    role: runtimeConfig.role,
    instanceId: runtimeInstanceId,
    async onRequest(frame) {
      if (frame.operation === 'deliver' && runtimeConfig.role === 'receiver') {
        return receiveEnvelope(frame.payload?.envelope);
      }
      if (frame.operation === 'command') {
        return handleRuntimeCommand(frame.payload?.command, frame.payload?.payload || {});
      }
      return { ok: false, error: 'unsupported_role_port_operation' };
    }
  });

  const logEvent = async (type, data = {}) => {
    const safe = { ...data };
    if (typeof safe.text === 'string') safe.text = redactSensitiveSessionText(safe.text);
    await message({
      type: 'PMIA_LOG_EVENT',
      sessionId: runtimeConfig.sessionId,
      event: { type, role: runtimeConfig.role, provider: runtimeConfig.provider, ...safe }
    });
  };

  telemetry = createRuntimeTelemetry({
    runtimeConfig,
    adapter,
    send: message,
    getPhase: refreshLifecycleTitle,
    getTransportPaused: () => transportPaused,
    getScrollLocked: () => scrollLocked,
    getVoiceActive: isCombinedVoiceActive,
    getBatchState: () => safeBatchTelemetry(receiverBatchRuntime?.snapshot()),
    getGenerationState: () => receiverAnswerOrchestrator?.snapshot().generationState || null,
    getAnswerState: () => receiverAnswerOrchestrator?.snapshot().answerState || null,
    getLifecycleState: () => runtimeRecovery?.snapshot?.() || { phase: document.visibilityState || 'unknown' }
  });

  async function register() {
    const response = await message({
      type: 'PMIA_REGISTER',
      registration: { ...runtimeConfig, instanceId: runtimeInstanceId, ownerGeneration: runtimeFence.generation }
    });
    if (response?.ok) {
      const firstRegistration = !runtimeRegistered;
      runtimeRegistered = true;
      restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, 'registered'));
      if (adapter.findComposer()) {
        restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, 'ready'));
      }
      if (!paused) {
        const status = describeRuntimeStatus(response.status);
        overlay.setStatus(status.text, status.tone);
      }
      rolePort?.connect();
      void telemetry.publish(firstRegistration
        ? { force: true, event: { type: 'registration_transition' } }
        : { force: true });
      if (runtimeConfig.role === 'sender' && !senderOutboxReady) {
        try {
          await initializeSenderOutbox();
          telemetry.event('outbox_state', senderOutbox.snapshot());
        } catch (error) {
          senderOutboxReady = false;
          overlay.setStatus('OUTBOX RESTORE FAILED', 'error', 3000);
          telemetry.event('outbox_restore_failed', { error: String(error?.message || error) });
          return false;
        }
      }
      if (senderOutbox?.size) senderOutbox.schedule(envelope => persistEnvelope(envelope), { immediate: true });
      return true;
    }
    if (response?.terminal) {
      runtimeRegistered = false;
      refreshLifecycleTitle();
      registrationActive = false;
      paused = true;
      const label = response.error === 'role_conflict' ? 'ROLE CONFLICT' : 'RELOAD TAB';
      overlay.setStatus(label, 'error');
      return false;
    }
    overlay.setStatus('REGISTER RETRY', 'warn', 3000);
    return false;
  }

  await register();
  const registerTimer = setInterval(() => {
    if (registrationActive) register();
  }, 15000);

  async function forwardPreview(candidate) {
    if (runtimeConfig.role !== 'sender' || paused) return false;
    const phase = String(candidate?.phase || 'interim');
    const text = phase === 'clear' ? '' : sanitizeTranscriptCandidate(candidate?.text);
    if (phase !== 'clear' && !text) return true;
    const transcriptIdentity = String(candidate?.turnKey || '').trim();
    if (phase !== 'clear' && !outboundTranscriptCache.accept(text, 'preview', transcriptIdentity)) return true;
    const nextPreviewSequence = nextSequence(previewSequence);
    let preview;
    try {
      preview = makePreview({
        sessionId: runtimeConfig.sessionId,
        sourceProvider: runtimeConfig.provider,
        text,
        turnKey: String(candidate?.turnKey || ''),
        revision: Number(candidate?.revision || 0),
        phase,
        seq: nextPreviewSequence,
        streamId: previewStreamId
      });
    } catch {
      if (phase !== 'clear') outboundTranscriptCache.forget(text, 'preview', transcriptIdentity);
      return false;
    }
    previewSequence = nextPreviewSequence;
    telemetry.preview(preview);
    try {
      const response = await message({ type: 'PMIA_PREVIEW', preview });
      if (!response?.ok && phase !== 'clear') outboundTranscriptCache.forget(text, 'preview', transcriptIdentity);
      return Boolean(response?.persisted || (kind === 'boot' && response?.ok));
    } catch {
      if (phase !== 'clear') outboundTranscriptCache.forget(text, 'preview', transcriptIdentity);
      return false;
    }
  }

  const previewScheduler = createLatestPreviewScheduler({ send: forwardPreview });

  async function forwardText(text, kind = 'question', metadata = {}) {
    const normalized = kind === 'question'
      ? sanitizeTranscriptCandidate(text)
      : String(text || '').trim();
    if (!normalized || paused) return false;
    if (runtimeConfig.role === 'sender' && !senderOutboxReady) {
      overlay.setStatus('OUTBOX NOT READY', 'error', 2200);
      return false;
    }
    if (kind === 'boot') latestBootContext = normalized;
    if (kind === 'question' && !isActionableTranscript(normalized)) return false;
    const transcriptPhase = kind === 'question' ? 'final' : '';
    const transcriptIdentity = String(metadata.turnKey || metadata.messageId || '').trim();
    if (transcriptPhase && !outboundTranscriptCache.accept(normalized, transcriptPhase, transcriptIdentity)) return true;
    let envelope;
    const nextSenderSequence = nextSequence(senderSequence);
    senderSequence = nextSenderSequence;
    sessionStorage.setItem(senderSequenceKey, String(senderSequence));
    try {
      envelope = makeEnvelope({
        sessionId: runtimeConfig.sessionId,
        sourceProvider: runtimeConfig.provider,
        text: normalized,
        kind,
        seq: nextSenderSequence,
        metadata: { ...metadata, previewStreamId }
      });
    } catch {
      if (transcriptPhase) outboundTranscriptCache.forget(normalized, transcriptPhase, transcriptIdentity);
      return false;
    }
    if (kind === 'question' && senderOutbox && !await senderOutbox.enqueue(envelope)) {
      if (transcriptPhase) outboundTranscriptCache.forget(normalized, transcriptPhase, transcriptIdentity);
      overlay.setStatus('OUTBOX SAVE FAILED', 'error', 2500);
      return false;
    }
    telemetry.final(envelope);
    const response = await persistEnvelope(envelope);
    if (!response?.persisted && response?.terminal && transcriptPhase) {
      outboundTranscriptCache.forget(normalized, transcriptPhase, transcriptIdentity);
    }
    if (response?.terminal) {
      runtimeRegistered = false;
      refreshLifecycleTitle();
      registrationActive = false;
      paused = true;
      overlay.setStatus('SENDER REVOKED', 'error');
    } else if (response?.delivered) {
      overlay.setStatus('FORWARDED', 'ok', 1200);
    } else if (response?.persisted) {
      overlay.setStatus(response?.queued ? 'STAGED' : 'PERSISTED', 'warn', 1600);
    } else {
      overlay.setStatus('OUTBOX RETAINED', 'error', 2000);
      senderOutbox?.schedule(envelope => persistEnvelope(envelope));
    }
    await logEvent('sender_text', {
      envelopeId: envelope.id,
      kind,
      text: normalized,
      ...(kind === 'boot' ? { sessionContext: extractSafeSessionContext(normalized) } : {}),
      persisted: Boolean(response?.persisted),
      delivered: Boolean(response?.delivered),
      queued: Boolean(response?.queued),
      reason: response?.reason || response?.error || ''
    });
    return Boolean(response?.ok);
  }


  if (runtimeConfig.role === 'sender') {
    senderController = createProviderSender({
      adapter,
      tracker: runtimeConfig.provider === 'chatgpt'
        ? createChatGptTurnTracker({ fallbackMs: 180 })
        : undefined,
      isVoiceActive: isCombinedVoiceActive,
      isComposerEmpty: () => adapter.isComposerEmpty?.() ?? true,
      allowFallbackFinalization: runtimeConfig.provider === 'chatgpt',
      allowVoiceFallback: runtimeConfig.provider === 'chatgpt',
      onPreview(preview) {
        if (runtimeConfig.provider === 'claude' && isCombinedVoiceActive()) return false;
        return previewScheduler.push(preview);
      },
      onFinal(final) {
        return forwardText(final.text, 'question', {
          source: 'dom_turn',
          messageId: final.id,
          turnKey: final.id,
          boundary: final.boundary
        });
      }
    });
  }

  if (runtimeConfig.provider === 'claude') {
    providerSignalBridge = createClaudeSignalBridge(window);
    const handleClaudeSignal = createClaudeSignalHandler({
      role: runtimeConfig.role,
      forwardPreview: preview => previewScheduler.push(preview),
      async forwardText(text, kind, metadata = {}) {
        if (runtimeConfig.role === 'sender' && metadata.source === 'voice_final') {
          senderController?.markExternalFinal({ id: metadata.messageId, text });
        }
        return forwardText(text, kind, metadata);
      },
      setStatus: (...args) => overlay.setStatus(...args),
      onAssistantFinal: () => {
        assistantFinalHintVersion += 1;
        answerWake.pulse();
      },
      onVoiceStateChange(active) {
        claudeProtocolVoiceActive = active;
        if (!active) senderController?.observe();
      }
    });
    unsubscribeProviderSignals = providerSignalBridge.subscribe(signal => {
      Promise.resolve(handleClaudeSignal(signal)).catch(error => {
        console.warn('[PMIA] Claude signal handling failed', error);
        overlay.setStatus('VOICE SIGNAL ERROR', 'error', 2500);
      });
    });
  }

  function scrollToLatest() {
    if (scrollLocked) return;
    const candidates = Array.from(document.querySelectorAll(
      'main,[role="main"],[class*="overflow-y-auto"],[class*="overflow-y-scroll"]'
    )).filter(element => element.scrollHeight > element.clientHeight + 20);
    candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
    const scroller = candidates[0] || document.scrollingElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  }

  if (runtimeConfig.role === 'receiver') {
    receiverAnswerOrchestrator = createReceiverAnswerOrchestrator({
      adapter,
      wake: answerWake,
      getHintVersion: () => assistantFinalHintVersion,
      onAnswerState(value) { telemetry.answerState(value); },
      onAnswer(value) { telemetry.answer(value); },
      onTerminal(value) {
        if (value?.timeout) telemetry.answerTimeout(value?.answerState?.batchId || '');
      },
      log: logEvent,
      setStatus: (...args) => overlay.setStatus(...args),
      scroll: scrollToLatest
    });
  }

  const composerArbiter = createComposerArbiter({
    adapter,
    onConflict(conflict) {
      overlay.setStatus('DRAFT CONFLICT', 'warn', 2400);
      void message({
        type: 'PMIA_BATCH_EVENT',
        sessionId: runtimeConfig.sessionId,
        event: { type: 'draft_conflict', owner: conflict.owner }
      });
    }
  });
  let latestReceiverProof = null;
  const receiver = createReceiverController({
    adapter,
    sleep,
    onStatus(status) {
      const tone = /FAIL|NO /.test(status) ? 'error' : status === 'SUPERSEDE' ? 'warn' : 'ok';
      overlay.setStatus(status, tone, 1500);
    },
    onProof(proof) {
      latestReceiverProof = proof;
      telemetry.event('receiver_proof', proof);
    },
    onSchedulerState(value) {
      telemetry.scheduler(value);
    },
    writePreview(text) {
      return composerArbiter.writePreview(text);
    }
  });

  if (runtimeConfig.role === 'receiver') {
    receiverBatchRuntime = createReceiverBatchRuntime({
      adapter,
      draftArbiter: composerArbiter,
      async submitBatch(batch) {
        const latest = batch.entries.at(-1)?.envelope;
        if (!latest) return { ok: false, error: 'batch_empty' };
        const batchEnvelope = {
          ...latest,
          id: batch.id,
          text: batch.submissionText || batch.prompt.text,
          metadata: {
            ...(latest.metadata || {}),
            batchId: batch.id,
            memberIds: batch.prompt.memberIds,
            focusId: batch.prompt.focusId,
            questionCount: batch.prompt.questionCount,
            batchFingerprint: batch.prompt.fingerprint
          }
        };
        const beforeText = adapter.getLatestAssistantText();
        const hintVersionAtStart = assistantFinalHintVersion;
        latestReceiverProof = null;
        const submitted = await receiver.deliver(batchEnvelope);
        if (!submitted) return { ok: false, error: 'receiver_delivery_failed' };
        const proof = latestReceiverProof || {
          envelopeId: batch.id,
          ok: true,
          verified: false,
          proof: 'submit_action_only'
        };
        void receiverAnswerOrchestrator.start({
          envelope: batchEnvelope,
          beforeText,
          hintVersionAtStart
        }).then(answer => receiverBatchRuntime?.answerComplete(batch.id, {
          answer: answer || null,
          answerState: answer?.answerState || receiverAnswerOrchestrator.snapshot().answerState || null,
          timeout: Boolean(answer?.timeout),
          proof
        }));
        return { ok: true, proof };
      },
      onEvent(event) {
        void message({
          type: 'PMIA_BATCH_EVENT',
          sessionId: runtimeConfig.sessionId,
          event
        });
      }
    });
  }

  if (runtimeConfig.role === 'receiver') {
    receiverObserver = createProviderObserver({
      adapter,
      document,
      onChange: () => {
        refreshLifecycleTitle();
        answerWake.pulse();
        const observed = receiverAnswerOrchestrator?.observeGeneration();
        if (!observed?.truth?.generating) {
          void receiverBatchRuntime?.submitNext();
        }
      },
      watchdogMs: 500
    });
  }

  function persistReceiverSequenceBuffer() {
    const snapshot = receiverSequenceBuffer.snapshot();
    sessionStorage.setItem(receiverSequenceBufferKey, JSON.stringify(snapshot));
    sessionStorage.setItem(receiverSequenceKey, String(receiverSequenceBuffer.lastAcceptedSeq));
  }

  function publishSequenceGap({ blocked = false, reason = '' } = {}) {
    const gap = receiverSequenceBuffer.status();
    if (gap.hasGap || blocked) {
      const value = { ...gap, blocked, timedOut: blocked || gap.timedOut, reason };
      const signature = `${value.expectedSeq}:${value.bufferedCount}:${value.highestBufferedSeq}:${value.timedOut}:${reason}`;
      if (signature !== lastSequenceGapSignature) telemetry.event('sequence_gap', value);
      lastSequenceGapSignature = signature;
      sequenceGapActive = true;
      overlay.setStatus(`WAITING FOR #${gap.expectedSeq}`, blocked ? 'error' : 'warn', 1800);
    } else if (sequenceGapActive) {
      telemetry.event('sequence_gap_cleared', { expectedSeq: gap.expectedSeq });
      sequenceGapActive = false;
      lastSequenceGapSignature = '';
    }
    return gap;
  }

  function scheduleSequenceDrain() {
    if (sequenceDrainTimer) return false;
    const delay = Math.min(2000, 100 * (2 ** Math.min(sequenceDrainAttempt, 4)));
    sequenceDrainAttempt += 1;
    sequenceDrainTimer = setTimeout(() => {
      sequenceDrainTimer = null;
      void drainReceiverSequenceBuffer();
    }, delay);
    return true;
  }

  async function drainReceiverSequenceBuffer(targetEnvelopeId = '') {
    let targetResult = null;
    let failure = null;
    let progressed = false;
    while (receiverSequenceBuffer.peekReady()) {
      const readyEnvelope = receiverSequenceBuffer.peekReady();
      const result = await receiverBatchRuntime.accept(readyEnvelope);
      if (!result?.ok) {
        failure = { envelope: readyEnvelope, result: result || { ok: false, error: 'batch_rejected' } };
        break;
      }
      receiverSequenceBuffer.confirm(readyEnvelope.seq);
      progressed = true;
      if (readyEnvelope.id === targetEnvelopeId) targetResult = result;
      void logEvent('received_text', {
        envelopeId: readyEnvelope.id,
        kind: readyEnvelope.kind,
        sourceProvider: readyEnvelope.sourceProvider,
        text: readyEnvelope.text,
        staged: Boolean(result.staged),
        batchId: result.batchId || '',
        memberIds: result.memberIds || [readyEnvelope.id]
      });
    }
    persistReceiverSequenceBuffer();
    if (progressed) sequenceDrainAttempt = 0;
    if (failure) {
      publishSequenceGap({ blocked: true, reason: failure.result?.error || 'batch_rejected' });
      scheduleSequenceDrain();
    } else {
      publishSequenceGap();
    }
    return {
      targetResult,
      failure,
      gap: receiverSequenceBuffer.status(),
      sequenceFeedback: deriveSequenceFeedback(receiverSequenceBuffer.snapshot())
    };
  }

  async function receiveEnvelope(envelope) {
    if (runtimeConfig.role !== 'receiver') {
      return { ok: false, error: 'receiver_role_mismatch' };
    }
    if (paused) return { ok: false, error: 'receiver_paused' };
    if (transportPaused && envelope?.kind !== 'boot') {
      return { ok: false, error: 'receiver_paused' };
    }

    if (envelope?.kind === 'boot') {
      const armed = await receiver.deliver(envelope);
      if (!armed) return { ok: false, error: 'receiver_delivery_failed' };
      overlay.setStatus('ARMED', 'ok', 3500);
      const sessionContext = extractSafeSessionContext(envelope.text);
      void logEvent('session_armed', { envelopeId: envelope.id, sessionContext });
      telemetry.event('session_armed', { envelopeId: envelope.id, sessionContext });
      return { ok: true, reason: 'accepted', duplicate: false };
    }

    const currentSequenceStatus = receiverSequenceBuffer.status();
    const currentBatchState = receiverBatchRuntime.snapshot();
    const receiverCredits = deriveSmoothedReceiverCredits({
      bufferedCount: currentSequenceStatus.bufferedCount,
      maxBuffered: currentSequenceStatus.capacity,
      activeMembers: currentBatchState?.active?.memberIds?.length || 0,
      hold: Boolean(currentBatchState?.hold),
      paused: Boolean(transportPaused || paused),
      storageCritical: false,
      draftConflict: Boolean(currentBatchState?.draftConflict)
    });
    if (!receiverCredits.canAccept && Number(envelope?.seq || 0) > receiverSequenceBuffer.lastAcceptedSeq) {
      return {
        ok: false,
        persisted: true,
        queued: true,
        buffered: false,
        error: 'receiver_backpressure',
        reason: receiverCredits.reason,
        sequenceFeedback: deriveSequenceFeedback(receiverSequenceBuffer.snapshot()),
        receiverCredits
      };
    }

    const sequenceDecision = receiverSequenceBuffer.offer(envelope);
    if (sequenceDecision.duplicate) {
      overlay.setStatus('DUPLICATE ACK', 'warn', 1400);
      return {
        ok: true,
        reason: sequenceDecision.reason,
        duplicate: true,
        buffered: Boolean(sequenceDecision.buffered),
        expectedSeq: sequenceDecision.expectedSeq,
        sequenceFeedback: deriveSequenceFeedback(receiverSequenceBuffer.snapshot()),
        receiverCredits: deriveSmoothedReceiverCredits({ ...receiverCredits, bufferedCount: receiverSequenceBuffer.status().bufferedCount, maxBuffered: receiverSequenceBuffer.status().capacity })
      };
    }
    if (!sequenceDecision.accepted) {
      overlay.setStatus('SEQUENCE BUFFER FULL', 'error', 1800);
      return {
        ok: false,
        buffered: false,
        error: sequenceDecision.reason,
        expectedSeq: sequenceDecision.expectedSeq,
        sequenceFeedback: deriveSequenceFeedback(receiverSequenceBuffer.snapshot()),
        receiverCredits: deriveSmoothedReceiverCredits({ ...receiverCredits, bufferedCount: receiverSequenceBuffer.status().bufferedCount, maxBuffered: receiverSequenceBuffer.status().capacity })
      };
    }

    if (sequenceDecision.unsequenced) {
      const result = await receiverBatchRuntime.accept(envelope);
      return result?.ok ? { ...result, reason: result.staged ? 'staged' : 'accepted' } : result;
    }

    const drain = await drainReceiverSequenceBuffer(envelope.id);
    const originalResult = drain.targetResult;
    const gap = drain.gap;
    scrollToLatest();

    if (drain.failure?.envelope?.id === envelope.id) {
      return {
        ...(drain.failure.result || { ok: false, error: 'batch_rejected' }),
        sequenceFeedback: drain.sequenceFeedback,
        receiverCredits: deriveSmoothedReceiverCredits({ bufferedCount: gap.bufferedCount, maxBuffered: gap.capacity, activeMembers: receiverBatchRuntime.snapshot()?.active?.memberIds?.length || 0, hold: Boolean(receiverBatchRuntime.snapshot()?.hold), draftConflict: Boolean(receiverBatchRuntime.snapshot()?.draftConflict) })
      };
    }

    if (originalResult) {
      return {
        ok: true,
        reason: originalResult.staged ? 'staged' : 'accepted',
        duplicate: Boolean(originalResult.duplicate),
        staged: Boolean(originalResult.staged),
        delivered: Boolean(originalResult.delivered),
        batchId: originalResult.batchId || '',
        memberIds: originalResult.memberIds || [envelope.id],
        proof: originalResult.proof || null,
        fingerprint: originalResult.batch?.prompt?.fingerprint || originalResult.fingerprint || '',
        memberFingerprint: originalResult.batch?.prompt?.memberFingerprint || originalResult.memberFingerprint || '',
        sequenceFeedback: drain.sequenceFeedback,
        receiverCredits: deriveSmoothedReceiverCredits({ bufferedCount: gap.bufferedCount, maxBuffered: gap.capacity, activeMembers: receiverBatchRuntime.snapshot()?.active?.memberIds?.length || 0, hold: Boolean(receiverBatchRuntime.snapshot()?.hold), draftConflict: Boolean(receiverBatchRuntime.snapshot()?.draftConflict) })
      };
    }
    return {
      ok: true,
      buffered: true,
      delivered: false,
      staged: false,
      reason: 'buffered_gap',
      expectedSeq: gap.expectedSeq,
      bufferedCount: gap.bufferedCount,
      sequenceFeedback: drain.sequenceFeedback,
      receiverCredits: deriveSmoothedReceiverCredits({ bufferedCount: gap.bufferedCount, maxBuffered: gap.capacity, activeMembers: receiverBatchRuntime.snapshot()?.active?.memberIds?.length || 0, hold: Boolean(receiverBatchRuntime.snapshot()?.hold), draftConflict: Boolean(receiverBatchRuntime.snapshot()?.draftConflict) })
    };
  }

  async function handleRuntimeCommand(command, payload = {}) {
    switch (String(command || '')) {
      case 'self_test_probe':
        return {
          ok: true,
          probe: 'pmia_self_test',
          role: runtimeConfig.role,
          provider: runtimeConfig.provider,
          instanceId: runtimeInstanceId,
          composerReady: Boolean(adapter.findComposer?.()),
          generating: Boolean(adapter.isGenerating?.()),
          visibilityState: String(document.visibilityState || 'unknown'),
          at: Date.now()
        };
      case 'pause':
        transportPaused = true;
        overlay.setStatus('FORWARDING PAUSED', 'warn');
        telemetry.event('transport_paused');
        return { ok: true, transportPaused };
      case 'resume':
        if (runtimeConfig.role === 'sender' && !senderOutboxReady) {
          try { await initializeSenderOutbox(); }
          catch (error) { return { ok: false, error: String(error?.message || error), outboxReady: false }; }
        }
        transportPaused = false;
        overlay.setStatus('FORWARDING ACTIVE', 'ok', 1600);
        telemetry.event('transport_resumed');
        return { ok: true, transportPaused, outboxReady: senderOutboxReady };
      case 'reconcile_delivery':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.reconcile(payload);
      case 'set_auto_submit':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.setAutoSubmit(Boolean(payload.value));
      case 'set_hold':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.setHold(Boolean(payload.value));
      case 'set_queue_only':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.setQueueOnly(Boolean(payload.value), String(payload.reason || ''));
      case 'submit_next':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.submitNext({ force: true });
      case 'interrupt_latest':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.interruptLatest();
      case 'resolve_draft_keep_manual':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.resolveDraftConflict('keep_manual');
      case 'resolve_draft_restore_pmia':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.resolveDraftConflict('restore_pmia');
      case 'resolve_draft_merge':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        return receiverBatchRuntime.resolveDraftConflict('merge');
      case 'recover': {
        const scheduled = runtimeRecovery?.trigger('dashboard_repair') || false;
        senderObserver?.refresh();
        receiverObserver?.refresh();
        senderController?.observe();
        answerWake.pulse();
        telemetry.event('runtime_recovery_requested', { scheduled });
        return { ok: true, scheduled };
      }
      case 'retry_outbox':
        if (runtimeConfig.role !== 'sender') return { ok: false, error: 'sender_only' };
        return {
          ok: true,
          results: await replaySenderOutbox({ immediate: true }),
          outbox: senderOutbox?.snapshot() || { count: 0 }
        };
      case 'resend_context':
        if (runtimeConfig.role !== 'sender') return { ok: false, error: 'sender_only' };
        if (!latestBootContext) return { ok: false, error: 'boot_context_missing' };
        setTimeout(() => {
          void forwardText(latestBootContext, 'boot', { source: 'dashboard_resend' });
        }, 0);
        return { ok: true, scheduled: true };
      case 'toggle_mic': {
        if (runtimeConfig.role !== 'sender') return { ok: false, error: 'sender_only' };
        const toggled = adapter.toggleMute();
        telemetry.setMicState(toggled ? 'toggled' : 'unavailable');
        overlay.setStatus(
          toggled ? 'MIC TOGGLED' : 'MIC CONTROL NOT FOUND',
          toggled ? 'ok' : 'warn',
          1800
        );
        void logEvent('mute_toggle', { toggled, source: payload.source || 'runtime_command' });
        return toggled ? { ok: true } : { ok: false, error: 'mic_control_missing' };
      }
      case 'toggle_scroll':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        scrollLocked = !scrollLocked;
        overlay.setStatus(
          scrollLocked ? 'SCROLL LOCKED' : 'SCROLL FREE',
          scrollLocked ? 'warn' : 'ok',
          1500
        );
        telemetry.event('scroll_lock_changed', { scrollLocked });
        return { ok: true, scrollLocked };
      case 'focus_composer':
        if (runtimeConfig.role !== 'receiver') return { ok: false, error: 'receiver_only' };
        adapter.findComposer()?.focus?.();
        overlay.setStatus('COMPOSER FOCUSED', 'info', 1000);
        return { ok: true };
      case 'export':
        setTimeout(() => { void exportSession(); }, 0);
        return { ok: true, scheduled: true };
      case 'get_state':
        return { ok: true, telemetry: telemetry.snapshot() };
      default:
        return { ok: false, error: 'unsupported_runtime_command' };
    }
  }

  chrome.runtime.onMessage.addListener((incoming, _sender, sendResponse) => {
    if (incoming?.type === 'PMIA_PREFLIGHT_PING') {
      sendResponse(respondToPreflight());
      return false;
    }
    if (incoming?.type === 'PMIA_RUNTIME_RESUME') {
      const scheduled = runtimeRecovery?.trigger('tab_restored') || false;
      sendResponse({ ok: true, scheduled });
      return false;
    }
    if (
      incoming?.type === 'PMIA_RUNTIME_COMMAND' &&
      incoming.sessionId === runtimeConfig.sessionId
    ) {
      handleRuntimeCommand(incoming.command, incoming.payload)
        .then(sendResponse)
        .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
      return true;
    }
    if (
      incoming?.type === 'PMIA_LINK_STATUS' &&
      incoming.sessionId === runtimeConfig.sessionId
    ) {
      if (!paused) {
        const status = describeRuntimeStatus(incoming.status);
        overlay.setStatus(status.text, status.tone);
      }
      sendResponse({ ok: true });
      return false;
    }
    if (
      incoming?.type === 'PMIA_EXPORT_SESSION' &&
      incoming.sessionId === runtimeConfig.sessionId
    ) {
      exportSession()
        .then(ok => sendResponse(ok ? { ok: true } : { ok: false, error: 'export_failed' }))
        .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
      return true;
    }
    if (shouldApplyRoleRevocation(runtimeConfig, runtimeInstanceId, incoming)) {
      registrationActive = false;
      paused = true;
      receiverAnswerOrchestrator?.cancel('role_revoked');
      answerWake.pulse();
      receiver.supersede({ id: `revoked-${Date.now()}` });
      telemetry.event('role_revoked');
      overlay.setStatus('ROLE REVOKED', 'error');
      sendResponse({ ok: true });
      return false;
    }
    if (incoming?.type === 'PMIA_PREVIEW_DELIVER') {
      const accepted = runtimeConfig.role === 'receiver' && !paused && !transportPaused && receiver.preview(incoming.preview);
      sendResponse(accepted ? { ok: true } : { ok: false, error: 'preview_rejected' });
      return false;
    }
    if (incoming?.type !== 'PMIA_DELIVER') return false;
    receiveEnvelope(incoming.envelope)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  });

  if (runtimeConfig.role === 'sender') {
    senderObserver = createProviderObserver({
      adapter,
      document,
      onChange: () => {
        refreshLifecycleTitle();
        senderController?.observe();
      },
      watchdogMs: 500,
      allowHidden: true
    });

    document.addEventListener('copy', () => {
      const selected = window.getSelection()?.toString()?.trim();
      if (!selected) return;
      senderController?.markExternalFinal({ text: selected });
      forwardText(selected, 'question', { source: 'manual_copy' });
    });
  }

  runtimeRecovery = createRuntimeRecovery({
    window,
    document,
    async recover() {
      if (!registrationActive) return false;
      const registered = await register();
      senderObserver?.refresh();
      receiverObserver?.refresh();
      senderController?.observe();
      answerWake.pulse();
      return registered;
    }
  });

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportSession() {
    const response = await message({ type: 'PMIA_GET_LOG', sessionId: runtimeConfig.sessionId });
    if (!response?.ok) {
      overlay.setStatus('EXPORT FAIL', 'error', 2500);
      return false;
    }
    const exportedAt = new Date().toISOString();
    const payload = buildSessionExport({
      session: runtimeConfig,
      events: response.events || [],
      exportedAt
    });
    const stamp = exportedAt.replace(/[:.]/g, '-');
    const base = `pmia-session-${runtimeConfig.sessionId}-${runtimeConfig.role}-${runtimeConfig.provider}-${stamp}`;
    download(`${base}.json`, JSON.stringify(payload, null, 2), 'application/json');
    download(
      `${base}.md`,
      renderSessionMarkdown(payload),
      'text/markdown;charset=utf-8'
    );
    overlay.setStatus('EXPORTED', 'ok', 1800);
    return true;
  }

  async function readClipboard() {
    try {
      return (await navigator.clipboard.readText()).trim();
    } catch (error) {
      overlay.setStatus('CLIPBOARD FAIL', 'error', 2500);
      await logEvent('clipboard_error', { error: String(error?.message || error) });
      return '';
    }
  }

  document.addEventListener('keydown', async event => {
    if (event.ctrlKey && event.altKey && event.key === '0') {
      event.preventDefault();
      const command = transportPaused ? 'resume_without_send' : 'pause';
      const response = await message({
        type: 'PMIA_DASHBOARD_COMMAND',
        sessionId: runtimeConfig.sessionId,
        requestId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        command,
        payload: { source: 'managed_hotkey' }
      });
      if (!response?.ok) overlay.setStatus('PAUSE CONTROL FAILED', 'error', 2200);
      return;
    }
    if (!event.ctrlKey || !event.shiftKey) return;
    const key = event.key.toUpperCase();

    if (key === 'F4') {
      event.preventDefault();
      event.stopImmediatePropagation();
      overlay.setStatus('ENDING SESSION', 'warn', 1200);
      const response = await message({
        type: 'PMIA_END_SESSION',
        sessionId: runtimeConfig.sessionId
      });
      if (!response?.ok) {
        const pending = Number(response?.counts?.actionable || 0) + Number(response?.counts?.unpersisted || 0);
        overlay.setStatus(response?.blocked ? `END BLOCKED - ${pending} PENDING` : 'END SESSION FAILED', 'error', 3500);
      }
      return;
    }

    if (key === 'F5' && runtimeConfig.role === 'sender') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const text = await readClipboard();
      if (!text) return;
      senderController?.markExternalFinal({ text });
      const forwarded = await forwardText(text, 'boot', { source: 'ahk_boot' });
      clearSubmittedComposer(adapter, text);
      overlay.setStatus(
        forwarded ? 'BOOT FORWARDED' : 'BOOT QUEUED',
        forwarded ? 'ok' : 'warn',
        1800
      );
      return;
    }

    if (key === 'F6' && runtimeConfig.role === 'sender') {
      event.preventDefault();
      event.stopImmediatePropagation();
      await handleRuntimeCommand('toggle_mic', { source: 'managed_hotkey' });
      return;
    }
    if (key === 'F7' && runtimeConfig.role === 'receiver') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const text = await readClipboard();
      if (!text) return;
      const envelope = makeEnvelope({
        sessionId: runtimeConfig.sessionId,
        sourceProvider: runtimeConfig.provider,
        text,
        kind: 'boot',
        metadata: { source: 'ahk_direct_boot' }
      });
      await receiveEnvelope(envelope);
      return;
    }

    if (key === 'F8') {
      event.preventDefault();
      event.stopImmediatePropagation();
      await handleRuntimeCommand('export');
      return;
    }

    if (key === 'F9' && runtimeConfig.role === 'receiver') {
      event.preventDefault();
      await handleRuntimeCommand('focus_composer');
      return;
    }

    if (key === 'F10' && runtimeConfig.role === 'receiver') {
      event.preventDefault();
      await handleRuntimeCommand('toggle_scroll');
      return;
    }

    if (key === 'F11') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const response = await message({
        type: 'PMIA_RUN_PREFLIGHT',
        sessionId: runtimeConfig.sessionId
      });
      if (!response?.ok) {
        overlay.setStatus('PREFLIGHT FAIL', 'error', 2200);
        return;
      }
      const status = describeRuntimeStatus(
        response.status,
        response.counterpart
      );
      overlay.setStatus(status.text, status.tone, 2400);
      return;
    }
  }, true);

  let runtimeDisposed = false;
  const disposeRuntime = () => {
    if (runtimeDisposed) return;
    runtimeDisposed = true;
    clearInterval(registerTimer);
    rolePort?.disconnect();
    runtimeRecovery?.disconnect();
    if (senderObserver) senderObserver.disconnect();
    if (receiverObserver) receiverObserver.disconnect();
    senderController?.disconnect();
    previewScheduler.disconnect();
    answerWake.disconnect();
    telemetry.disconnect();
    unsubscribeProviderSignals?.();
    if (providerSignalBridge) providerSignalBridge.disconnect();
    restoreTitle.disconnect?.();
    removeOverflowSafety();
    runtimeFence.release();
  };

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposeRuntime();
  });
}
