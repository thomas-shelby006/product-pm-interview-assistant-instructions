import { parseRuntimeConfig, makeEnvelope } from '../shared/protocol.js';
import { createChatGptAdapter } from './adapters/chatgpt.js';
import { createClaudeAdapter } from './adapters/claude.js';
import {
  StableTranscriptForwarder,
  createReceiverController,
  runtimeTitle,
  defendTitle,
  redactSensitiveSessionText,
  sleep
} from './runtime.js';
import { createStatusOverlay } from './status-overlay.js';

const CONFIG_KEY = 'pmia_runtime_config_v1';
const POLL_MS = 180;
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
  startRuntime(config).catch(error => console.error('[PMIA] runtime failed', error));
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
  const overlay = createStatusOverlay(document, runtimeConfig);
  const targetTitle = runtimeTitle(runtimeConfig);
  const restoreTitle = defendTitle(document, targetTitle);
  let paused = false;
  let scrollLocked = false;
  let answerCaptureToken = 0;
  const forwarder = new StableTranscriptForwarder({ stableMs: 900 });

  const message = async payload => {
    try {
      return await chrome.runtime.sendMessage(payload);
    } catch (error) {
      overlay.setStatus('EXTENSION OFFLINE', 'error', 2500);
      console.warn('[PMIA] message failed', error);
      return { ok: false, error: String(error?.message || error) };
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
    if (response?.ok) overlay.setStatus('READY', 'ok');
    else overlay.setStatus('REGISTER FAIL', 'error', 3000);
    return response?.ok;
  }

  await register();
  const registerTimer = setInterval(register, 15000);

  async function forwardText(text, kind = 'question', metadata = {}) {
    const normalized = String(text || '').trim();
    if (!normalized || paused) return false;
    forwarder.markEmitted(normalized);
    let envelope;
    try {
      envelope = makeEnvelope({
        sessionId: runtimeConfig.sessionId,
        sourceProvider: runtimeConfig.provider,
        text: normalized,
        kind,
        metadata
      });
    } catch {
      return false;
    }
    const response = await message({ type: 'PMIA_FORWARD', envelope });
    overlay.setStatus(response?.delivered ? 'FORWARDED' : 'QUEUED', response?.delivered ? 'ok' : 'warn', 1200);
    await logEvent('sender_text', {
      envelopeId: envelope.id,
      kind,
      text: normalized,
      delivered: Boolean(response?.delivered)
    });
    return Boolean(response?.ok);
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

  async function captureAnswer(envelope, beforeText, token) {
    const startedAt = Date.now();
    let sawGenerating = false;
    let candidate = '';
    let stableSince = 0;
    while (Date.now() - startedAt < ANSWER_TIMEOUT_MS) {
      if (token !== answerCaptureToken) return;
      const generating = adapter.isGenerating();
      if (generating) {
        sawGenerating = true;
        stableSince = 0;
        await sleep(300);
        continue;
      }
      const current = adapter.getLatestAssistantText();
      if (current && current !== beforeText && (sawGenerating || Date.now() - startedAt > 1200)) {
        if (current !== candidate) {
          candidate = current;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= 850) {
          const words = candidate.split(/\s+/).filter(Boolean).length;
          await logEvent('answer', {
            envelopeId: envelope.id,
            text: candidate,
            wordCount: words,
            elapsedMs: Date.now() - startedAt
          });
          overlay.setStatus(`ANSWER ${words}w`, 'ok', 1800);
          scrollToLatest();
          return;
        }
      }
      await sleep(300);
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

  async function receiveEnvelope(envelope) {
    if (runtimeConfig.role !== 'receiver' || paused) return false;
    answerCaptureToken += 1;
    const token = answerCaptureToken;
    const beforeText = adapter.getLatestAssistantText();
    await logEvent('received_text', {
      envelopeId: envelope.id,
      kind: envelope.kind,
      sourceProvider: envelope.sourceProvider,
      text: envelope.text
    });
    const submitted = await receiver.deliver(envelope);
    if (!submitted) return false;
    scrollToLatest();
    if (envelope.kind === 'boot') {
      overlay.setStatus('ARMED', 'ok', 3500);
      await logEvent('session_armed', { envelopeId: envelope.id });
    } else {
      captureAnswer(envelope, beforeText, token);
    }
    return true;
  }

  chrome.runtime.onMessage.addListener((incoming, _sender, sendResponse) => {
    if (incoming?.type !== 'PMIA_DELIVER') return false;
    receiveEnvelope(incoming.envelope)
      .then(ok => sendResponse({ ok }))
      .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  });

  let senderTimer = null;
  if (runtimeConfig.role === 'sender') {
    senderTimer = setInterval(() => {
      if (paused) return;
      const now = Date.now();
      forwarder.consider(adapter.getSenderCandidate(), now);
      const stable = forwarder.poll(now);
      if (stable) forwardText(stable, 'question', { source: 'stable_dom' });
    }, POLL_MS);

    document.addEventListener('copy', () => {
      setTimeout(() => {
        const selected = window.getSelection()?.toString()?.trim();
        if (selected) forwardText(selected, 'question', { source: 'manual_copy' });
      }, 30);
    });
  }

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

  function logMarkdown(events) {
    const lines = [
      '# PM Interview Dual-Provider Session', '',
      `Session: ${runtimeConfig.sessionId}`,
      `Window: ${runtimeConfig.role} / ${runtimeConfig.provider}`, '',
      '## Events', ''
    ];
    for (const event of events) {
      lines.push(`### ${event.recordedAt || ''} â€” ${event.type || 'event'}`);
      lines.push('');
      if (event.text) lines.push(redactSensitiveSessionText(event.text), '');
      const metadata = { ...event };
      delete metadata.text;
      lines.push('```json', JSON.stringify(metadata, null, 2), '```', '');
    }
    return lines.join('\n');
  }

  async function exportSession() {
    const response = await message({ type: 'PMIA_GET_LOG', sessionId: runtimeConfig.sessionId });
    if (!response?.ok) {
      overlay.setStatus('EXPORT FAIL', 'error', 2500);
      return;
    }
    const payload = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      session: runtimeConfig,
      events: response.events || []
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `pmia-session-${runtimeConfig.sessionId}-${stamp}`;
    download(`${base}.json`, JSON.stringify(payload, null, 2), 'application/json');
    download(`${base}.md`, logMarkdown(payload.events), 'text/markdown');
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

    if (key === 'F5' && runtimeConfig.role === 'sender') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const text = await readClipboard();
      if (!text) return;
      await forwardText(text, 'boot', { source: 'ahk_boot' });
      if (adapter.setComposerText(text)) {
        await sleep(60);
        adapter.submit();
      }
      overlay.setStatus('BOOT SENT', 'ok', 1800);
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

    if (key === 'F8' && runtimeConfig.role === 'receiver') {
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

    if (key === 'F12' && runtimeConfig.role === 'sender') {
      event.preventDefault();
      const text = adapter.getSenderCandidate();
      if (text) await forwardText(text, 'question', { source: 'forced_flush' });
    }
  }, true);

  window.addEventListener('pagehide', () => {
    clearInterval(registerTimer);
    if (senderTimer) clearInterval(senderTimer);
    restoreTitle.disconnect?.();
  }, { once: true });
}

