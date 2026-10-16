import { computeSimpleLayout } from './layout.js';

function providerUrl(base, { sessionId, role, provider }) {
  const url = new URL(base);
  url.searchParams.set('pmia_session', sessionId);
  url.searchParams.set('pmia_role', role);
  url.searchParams.set('pmia_provider', provider);
  return url.href;
}

export async function launchSimpleSession(options = {}) {
  const {
    sessionId, senderProvider, receiverProvider, comparisonProvider = '', bounds,
    chatgptUrl, claudeUrl, cockpitUrl, createWindow
  } = options;
  if (!sessionId || typeof createWindow !== 'function') throw new TypeError('sessionId and createWindow are required');
  const roles = [
    { role:'sender', provider:senderProvider },
    { role:'receiver', provider:receiverProvider },
    ...(comparisonProvider ? [{ role:'comparison', provider:comparisonProvider }] : [])
  ];
  const layout = computeSimpleLayout(bounds, roles.length);
  const providerSpecs = roles.map((value, index) => ({
    url:providerUrl(value.provider === 'claude' ? claudeUrl : chatgptUrl, { sessionId, ...value }),
    type:'popup', focused:index === 0, ...layout.providers[index]
  }));
  const cockpit = new URL(cockpitUrl);
  cockpit.searchParams.set('session', sessionId);
  const cockpitSpec = { url:cockpit.href, type:'popup', focused:false, ...layout.cockpit };
  const pending = [...providerSpecs.map(createWindow), createWindow(cockpitSpec)];
  const windows = await Promise.all(pending);
  return { providerWindows:windows.slice(0, roles.length), cockpitWindow:windows.at(-1), roles, layout };
}
