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
  sleep
} from './runtime.js';
import { createStatusOverlay } from './status-overlay.js';
import { createClaudeSignalBridge } from './signals/claude-isolated.js';
import { createClaudeSignalHandler } from './signals/claude-runtime.js';
import { createProviderObserver } from './observation/provider-observer.js';
import { createProviderSender } from './senders/provider-sender.js';
import { createAnswerTracker, createWakeSignal } from './answer-tracker.js';
import { createLatestPreviewScheduler } from './preview-scheduler.js';
import { createRuntimeRecovery } from './runtime-recovery.js';
import { SequenceGate, nextSequence } from '../shared/sequence.js';
import { buildSessionExport, renderSessionMarkdown } from '../shared/session-log.js';
import { describeRuntimeStatus } from '../shared/session-status.js';
import { renderRuntimeFatal } from './runtime-fatal.js';
import { isActionableTranscript, isTransientTranscriptStatus } from '../shared/transcript-filter.js';
import { createPreflightResponder } from './preflight-responder.js';

const CONFIG_KEY = 'pmia_runtime_config_v1';
const ANSWER_TIMEOUT_MS = 90000;

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
  const respondToPreflight = createPreflightResponder({
    runtimeConfig,
    adapter,
    version: runtimeVersion
  });
  const overlay = createStatusOverlay(document, runtimeConfig);
  const restoreTitle = defendTitle(document, runtimeLifecycleTitle(runtimeConfig, 'boot'));
  let runtimeRegistered = false;
  const refreshLifecycleTitle = () => {
    const phase = runtimeRegistered
      ? (adapter.findComposer() ? 'ready' : 'registered')
      : 'boot';
    restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, phase));
    return phase;
  };
  let paused = false;
  let scrollLocked = false;
  let answerCaptureToken = 0;
  let registrationActive = true;
  let assistantFinalHintVersion = 0;
  let claudeProtocolVoiceActive = false;
  let providerSignalBridge = null;
  let unsubscribeProviderSignals = null;
  let senderObserver = null;
  let receiverObserver = null;
  let senderController = null;
  let runtimeRecovery = null;
  const answerWake = createWakeSignal();
  const senderSequenceKey = `pmia_sender_seq_${runtimeConfig.sessionId}`;
  const receiverSequenceKey = `pmia_receiver_seq_${runtimeConfig.sessionId}`;
  let senderSequence = Number(sessionStorage.getItem(senderSequenceKey) || 0);
  let previewSequence = 0;
  const previewStreamId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const receiverSequenceGate = new SequenceGate(
    Number(sessionStorage.getItem(receiverSequenceKey) || 0)
  );

  const message = async payload => {
    try {
      return await chrome.runtime.sendMessage(payload);
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

  const logEvent = async (type, data = {}) => {
    const safe = { ...data };
    if (typeof safe.text === 'string') safe.text = redactSensitiveSessionText(safe.text);
    await message({
      type: 'PMIA_LOG_EVENT',
      sessionId: runtimeConfig.sessionId,
      event: { type, role: runtimeConfig.role, provider: runtimeConfig.provider, ...safe }
    });
  };

  async function register() {
    const response = await message({
      type: 'PMIA_REGISTER',
      registration: runtimeConfig
    });
    if (response?.ok) {
      runtimeRegistered = true;
      restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, 'registered'));
      if (adapter.findComposer()) {
        restoreTitle.setTarget(runtimeLifecycleTitle(runtimeConfig, 'ready'));
      }
      if (!paused) {
        const status = describeRuntimeStatus(response.status);
        overlay.setStatus(status.text, status.tone);
      }
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
    if (isTransientTranscriptStatus(candidate?.text)) return false;
    const nextPreviewSequence = nextSequence(previewSequence);
    let preview;
    try {
      preview = makePreview({
        sessionId: runtimeConfig.sessionId,
        sourceProvider: runtimeConfig.provider,
        text: String(candidate?.text ?? ''),
        turnKey: String(candidate?.turnKey || ''),
        revision: Number(candidate?.revision || 0),
        phase: String(candidate?.phase || 'interim'),
        seq: nextPreviewSequence,
        streamId: previewStreamId
      });
    } catch {
      return false;
    }
    previewSequence = nextPreviewSequence;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PMIA_PREVIEW', preview });
      return Boolean(response?.ok);
    } catch {
      return false;
    }
  }

  const previewScheduler = createLatestPreviewScheduler({ send: forwardPreview });

  async function forwardText(text, kind = 'question', metadata = {}) {
    const normalized = String(text || '').trim();
    if (!normalized || paused) return false;
    if (kind === 'question' && !isActionableTranscript(normalized)) return false;
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
      return false;
    }
    const response = await message({ type: 'PMIA_FORWARD', envelope });
    if (response?.terminal) {
      runtimeRegistered = false;
      refreshLifecycleTitle();
      registrationActive = false;
      paused = true;
      overlay.setStatus('SENDER REVOKED', 'error');
    } else if (response?.delivered) {
      overlay.setStatus('FORWARDED', 'ok', 1200);
    } else if (response?.queued) {
      overlay.setStatus('QUEUED', 'warn', 1600);
    } else {
      overlay.setStatus('SEND REJECTED', 'error', 2000);
    }
    await logEvent('sender_text', {
      envelopeId: envelope.id,
      kind,
      text: normalized,
      delivered: Boolean(response?.delivered),
      queued: Boolean(response?.queued),
      reason: response?.reason || response?.error || ''
    });
    return Boolean(response?.ok);
  }


  const isCombinedVoiceActive = () => Boolean(
    adapter.isVoiceActive?.() ||
    (runtimeConfig.provider === 'claude' && claudeProtocolVoiceActive)
  );

  if (runtimeConfig.role === 'sender') {
    senderController = createProviderSender({
      adapter,
      isVoiceActive: isCombinedVoiceActive,
      isComposerEmpty: () => adapter.isComposerEmpty?.() ?? true,
      allowFallbackFinalization: false,
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

  async function captureAnswer(envelope, beforeText, token, hintVersionAtStart) {
    const startedAt = Date.now();
    const tracker = createAnswerTracker({
      beforeText,
      startedAt,
      initialHintVersion: hintVersionAtStart,
      stabilityMs: 250,
      noGenerationGraceMs: 600
    });
    while (Date.now() - startedAt < ANSWER_TIMEOUT_MS) {
      if (token !== answerCaptureToken) return;
      const result = tracker.observe({
        now: Date.now(),
        text: adapter.getLatestAssistantText(),
        generating: adapter.isGenerating(),
        hintVersion: assistantFinalHintVersion
      });
      if (result) {
        const words = result.text.split(/\s+/).filter(Boolean).length;
        await logEvent('answer', {
          envelopeId: envelope.id,
          text: result.text,
          wordCount: words,
          elapsedMs: result.elapsedMs
        });
        overlay.setStatus(`ANSWER ${words}w`, 'ok', 1800);
        scrollToLatest();
        return;
      }
      await answerWake.wait(500);
    }
    await logEvent('answer_timeout', { envelopeId: envelope.id });
    overlay.setStatus('ANSWER TIMEOUT', 'warn', 2500);
  }

  const receiver = createReceiverController({
    adapter,
    sleep,
    onStatus(status) {
      const tone = /FAIL|NO /.test(status) ? 'error' : status === 'SUPERSEDE' ? 'warn' : 'ok';
      overlay.setStatus(status, tone, 1500);
    }
  });

  if (runtimeConfig.role === 'receiver') {
    receiverObserver = createProviderObserver({
      adapter,
      document,
      onChange: () => {
        refreshLifecycleTitle();
        answerWake.pulse();
      },
      watchdogMs: 500
    });
  }

  async function receiveEnvelope(envelope) {
    if (runtimeConfig.role !== 'receiver') {
      return { ok: false, error: 'receiver_role_mismatch' };
    }
    if (paused) return { ok: false, error: 'receiver_paused' };

    const sequenceDecision = receiverSequenceGate.admit(envelope?.seq);
    if (sequenceDecision.duplicate) {
      overlay.setStatus('DUPLICATE ACK', 'warn', 1400);
      void logEvent('delivery_ignored', {
        envelopeId: envelope?.id || '',
        seq: envelope?.seq || 0,
        reason: 'duplicate_ack'
      });
      return { ok: true, reason: 'duplicate_ack', duplicate: true };
    }
    if (!sequenceDecision.accepted) {
      overlay.setStatus('STALE IGNORED', 'warn', 1400);
      void logEvent('delivery_ignored', {
        envelopeId: envelope?.id || '',
        seq: envelope?.seq || 0,
        reason: 'stale_ack'
      });
      return { ok: true, reason: 'stale_ack', duplicate: true };
    }

    const previousAcceptedSeq = sequenceDecision.previousAcceptedSeq;
    receiverSequenceGate.accept(envelope.seq);
    sessionStorage.setItem(
      receiverSequenceKey,
      String(receiverSequenceGate.lastAcceptedSeq)
    );
    answerCaptureToken += 1;
    answerWake.pulse();
    const token = answerCaptureToken;
    const beforeText = adapter.getLatestAssistantText();
    const hintVersionAtStart = assistantFinalHintVersion;
    const deliveryStartedAt = Date.now();
    const submitted = await receiver.deliver(envelope);
    if (!submitted) {
      receiverSequenceGate.restore(previousAcceptedSeq);
      if (previousAcceptedSeq > 0) {
        sessionStorage.setItem(receiverSequenceKey, String(previousAcceptedSeq));
      } else {
        sessionStorage.removeItem(receiverSequenceKey);
      }
      return {
        ok: false,
        error: adapter.findComposer?.() ? 'receiver_delivery_failed' : 'receiver_composer_missing'
      };
    }
    const deliveryElapsedMs = Date.now() - deliveryStartedAt;
    void logEvent('received_text', {
      envelopeId: envelope.id,
      kind: envelope.kind,
      sourceProvider: envelope.sourceProvider,
      text: envelope.text,
      deliveryElapsedMs
    });
    scrollToLatest();
    if (envelope.kind === 'boot') {
      overlay.setStatus('ARMED', 'ok', 3500);
      void logEvent('session_armed', { envelopeId: envelope.id });
    } else {
      captureAnswer(envelope, beforeText, token, hintVersionAtStart);
    }
    return { ok: true, reason: 'accepted', duplicate: false };
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
    if (incoming?.type === 'PMIA_ROLE_REVOKED') {
      registrationActive = false;
      paused = true;
      answerCaptureToken += 1;
      answerWake.pulse();
      receiver.supersede({ id: `revoked-${Date.now()}` });
      overlay.setStatus('ROLE REVOKED', 'error');
      sendResponse({ ok: true });
      return false;
    }
    if (incoming?.type === 'PMIA_PREVIEW_DELIVER') {
      const accepted = runtimeConfig.role === 'receiver' && !paused && receiver.preview(incoming.preview);
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
      return;
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
      paused = !paused;
      overlay.setStatus(paused ? 'PAUSED' : 'READY', paused ? 'warn' : 'ok');
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
      if (!response?.ok) overlay.setStatus('END SESSION FAILED', 'error', 2500);
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
      const toggled = adapter.toggleMute();
      overlay.setStatus(toggled ? 'MIC TOGGLED' : 'MIC CONTROL NOT FOUND', toggled ? 'ok' : 'warn', 1800);
      await logEvent('mute_toggle', { toggled });
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
      await exportSession();
      return;
    }

    if (key === 'F9' && runtimeConfig.role === 'receiver') {
      event.preventDefault();
      adapter.findComposer()?.focus?.();
      overlay.setStatus('COMPOSER FOCUSED', 'info', 1000);
      return;
    }

    if (key === 'F10' && runtimeConfig.role === 'receiver') {
      event.preventDefault();
      scrollLocked = !scrollLocked;
      overlay.setStatus(scrollLocked ? 'SCROLL LOCKED' : 'SCROLL FREE', scrollLocked ? 'warn' : 'ok', 1500);
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
    runtimeRecovery?.disconnect();
    if (senderObserver) senderObserver.disconnect();
    if (receiverObserver) receiverObserver.disconnect();
    senderController?.disconnect();
    previewScheduler.disconnect();
    answerWake.disconnect();
    unsubscribeProviderSignals?.();
    if (providerSignalBridge) providerSignalBridge.disconnect();
    restoreTitle.disconnect?.();
  };

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposeRuntime();
  });
}
