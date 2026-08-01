export function derivePrerenderGuard({ visibilityState = 'visible', prerendering = false, lifecycle = '', activeTab = true } = {}) {
  const blocked = Boolean(prerendering) || String(lifecycle) === 'prerender' || (!activeTab && String(visibilityState) === 'hidden');
  return { blocked, reason: prerendering || lifecycle === 'prerender' ? 'page_prerendering' : blocked ? 'inactive_hidden_page' : '', allowRegistration: !blocked, allowProviderWrite: !blocked };
}

export function assertPrerenderSafe(context = {}) {
  const guard = derivePrerenderGuard(context);
  return guard.blocked ? { ok: false, error: guard.reason, guard } : { ok: true, guard };
}
