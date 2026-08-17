import { createSimpleContentRuntime } from './content-runtime.js';
import { createSimpleChatGptAdapter } from './adapters/chatgpt.js';
import { createSimpleClaudeAdapter } from './adapters/claude.js';
import { createClaudeWriteBridge } from './claude-bridge.js';
import { createChatGptWriteBridge } from './chatgpt-bridge.js';
import { waitForProviderReady } from './readiness.js';
import { createResilientPort } from './live-port.js';

const CONFIG_KEY = 'pmia_simple_config_v1';
const SENDER_SEEN_PREFIX = 'pmia_simple_sender_seen_v1';
const SENDER_STARTED_PREFIX = 'pmia_simple_sender_started_v1';
const VALID_ROLES = new Set(['sender','receiver','comparison']);
const VALID_PROVIDERS = new Set(['chatgpt','claude']);
const PMIA_SETUP_PREFIX = 'You are a Product Manager interview assistant. Answer the interviewer directly in first person using only the supplied candidate/job context.';

function parseUrlConfig(href) {
  const url = new URL(href);
  const config = {
    sessionId:String(url.searchParams.get('pmia_session') || '').trim(),
    role:String(url.searchParams.get('pmia_role') || '').trim().toLowerCase(),
    provider:String(url.searchParams.get('pmia_provider') || '').trim().toLowerCase()
  };
  return config.sessionId && VALID_ROLES.has(config.role) && VALID_PROVIDERS.has(config.provider)
    ? config : null;
}

function loadConfig(win) {
  const fromUrl = parseUrlConfig(win.location.href);
  if (fromUrl) {
    win.sessionStorage.setItem(CONFIG_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }
  try {
    const stored = JSON.parse(win.sessionStorage.getItem(CONFIG_KEY) || 'null');
    if (stored?.sessionId && VALID_ROLES.has(stored.role) && VALID_PROVIDERS.has(stored.provider)) return stored;
  } catch {}
  return null;
}

function loadSenderState(config, win) {
  if (config.role !== 'sender') return {};
  const seenKey = `${SENDER_SEEN_PREFIX}:${config.sessionId}`;
  const startedKey = `${SENDER_STARTED_PREFIX}:${config.sessionId}`;
  let initialSeen = [];
  let resumed = false;
  try {
    resumed = win.sessionStorage.getItem(startedKey) === '1';
    const stored = JSON.parse(win.sessionStorage.getItem(seenKey) || '[]');
    initialSeen = Array.isArray(stored)
      ? stored.map(value => String(value || '').trim()).filter(Boolean).slice(-500)
      : [];
    win.sessionStorage.setItem(startedKey, '1');
  } catch {}
  return {
    resumed,
    initialSeen,
    onSeenChange(keys) {
      try { win.sessionStorage.setItem(seenKey, JSON.stringify(Array.from(keys || []).slice(-500))); }
      catch {}
    }
  };
}
function adapterFor(config, doc, win) {
  if (config.provider === 'claude') {
    const bridge = createClaudeWriteBridge(win);
    return createSimpleClaudeAdapter({ doc, writeInMain:text => bridge.write(text) });
  }
  const bridge = createChatGptWriteBridge(win);
  return createSimpleChatGptAdapter({ doc, writeInMain:text => bridge.write(text) });
}

function installSenderObserver(win, doc, runtime) {
  let scheduled = false;
  const scan = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void runtime.scanSender();
    });
  };
  const observer = new win.MutationObserver(scan);
  observer.observe(doc.documentElement, { subtree:true, childList:true, characterData:true });
  return observer;
}
export async function startSimpleBrowserRuntime({ win = window, doc = document, chromeApi = chrome } = {}) {
  const config = loadConfig(win);
  if (!config) return null;
  const adapter = adapterFor(config, doc, win);
  const ready = await waitForProviderReady(adapter);
  if (!ready) {
    doc.documentElement.dataset.pmiaSimpleError = 'provider_not_ready';
    doc.title = `PMIA NOT READY · ${config.provider.toUpperCase()} · ${config.sessionId}`;
    return { config, error:'provider_not_ready' };
  }
  if (config.role === 'sender' && config.provider === 'chatgpt') {
    await createChatGptWriteBridge(win).clearStaleSetup(PMIA_SETUP_PREFIX);
  }
  const senderState = loadSenderState(config, win);
  const port = createResilientPort({
    connect:() => chromeApi.runtime.connect({ name:'pmia-simple' }),
    onReconnect:raw => raw.postMessage({ type:'register', ...config })
  });
  const runtime = createSimpleContentRuntime({ config, adapter, port, senderState });
  runtime.start();
  const observer = config.role === 'sender' ? installSenderObserver(win, doc, runtime) : null;
  doc.documentElement.dataset.pmiaSimpleRole = config.role;
  doc.documentElement.dataset.pmiaSimpleProvider = config.provider;
  doc.title = `PMIA ${config.role.toUpperCase()} · ${config.provider.toUpperCase()} · ${config.sessionId}`;
  return { config, runtime, observer, port };
}
