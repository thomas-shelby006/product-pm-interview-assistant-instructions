const MANAGED_TITLE = /^PMIA_(?:(BOOT|REGISTERED|ARMED)_)?(SENDER|RECEIVER|COMPARISON)_(CHATGPT|CLAUDE)_(PMIA_\d{8}_\d{6}_[A-Z0-9]+)$/i;

function providerMatchesUrl(provider, rawUrl) {
  try {
    const host = new URL(String(rawUrl || '')).hostname.toLowerCase();
    if (provider === 'chatgpt') return host === 'chatgpt.com' || host === 'chat.openai.com';
    if (provider === 'claude') return host === 'claude.ai';
  } catch {}
  return false;
}

export function managedLifecycleIdentity(tab = {}) {
  const match = MANAGED_TITLE.exec(String(tab.title || '').trim());
  if (!match || !Number.isInteger(tab.id)) return null;
  const provider = match[3].toLowerCase();
  if (!providerMatchesUrl(provider, tab.url)) return null;
  return {
    tabId: tab.id,
    phase: (match[1] || 'ready').toLowerCase(),
    role: match[2].toLowerCase(),
    provider,
    sessionId: match[4].toLowerCase()
  };
}

export function selectManagedRecoveryCandidates(tabs = []) {
  return (Array.isArray(tabs) ? tabs : []).map(managedLifecycleIdentity).filter(Boolean);
}

export async function recoverInvalidatedManagedTabs({ chromeApi = globalThis.chrome, onTrace = () => {} } = {}) {
  if (!chromeApi?.tabs?.query || !chromeApi?.tabs?.sendMessage || !chromeApi?.tabs?.reload) {
    return { ok: false, error: 'tabs_api_missing', candidates: 0, reloadedTabIds: [] };
  }
  const tabs = await chromeApi.tabs.query({});
  const candidates = selectManagedRecoveryCandidates(tabs);
  const reloadedTabIds = [];
  for (const candidate of candidates) {
    let healthy = false;
    try {
      const response = await chromeApi.tabs.sendMessage(candidate.tabId, {
        type: 'PMIA_PREFLIGHT_PING',
        sessionId: candidate.sessionId,
        requesterRole: 'extension_recovery'
      });
      healthy = response?.ok === true
        && String(response.sessionId || '').toLowerCase() === candidate.sessionId
        && String(response.role || '').toLowerCase() === candidate.role
        && String(response.provider || '').toLowerCase() === candidate.provider;
    } catch {}
    if (healthy) {
      onTrace({ ...candidate, stage: 'runtime_recovery_probe', status: 'ok', reason: 'responsive' });
      continue;
    }
    try { await chromeApi.tabs.update?.(candidate.tabId, { autoDiscardable: false }); } catch {}
    await chromeApi.tabs.reload(candidate.tabId);
    reloadedTabIds.push(candidate.tabId);
    onTrace({ ...candidate, stage: 'runtime_recovery_reload', status: 'ok', reason: 'content_runtime_unresponsive' });
  }
  return { ok: true, candidates: candidates.length, reloadedTabIds };
}
