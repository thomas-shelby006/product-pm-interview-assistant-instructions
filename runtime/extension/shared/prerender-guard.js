const BLOCKED_LIFECYCLES = new Set(['prerender','frozen','discarded','terminated']);
export function derivePrerenderGuard({ visibilityState = 'visible', prerendering = false, lifecycle = '', activeTab = true, pageFrozen = false, frozen = false, discarded = false } = {}) {
  const state=String(lifecycle || '').toLowerCase();
  const lifecycleBlocked=BLOCKED_LIFECYCLES.has(state) || pageFrozen || frozen || discarded;
  const inactiveHidden=!activeTab && String(visibilityState)==='hidden';
  const blocked=Boolean(prerendering)||lifecycleBlocked||inactiveHidden;
  const reason=prerendering||state==='prerender' ? 'page_prerendering' : pageFrozen||frozen||state==='frozen' ? 'page_frozen' : discarded||state==='discarded' ? 'page_discarded' : state==='terminated' ? 'page_terminated' : inactiveHidden ? 'inactive_hidden_page' : '';
  return { blocked, reason, allowRegistration:!blocked, allowProviderWrite:!blocked, allowObservation:!Boolean(prerendering||state==='terminated'||discarded) };
}
export function assertPrerenderSafe(context = {}) {
  const guard=derivePrerenderGuard(context);
  return guard.blocked ? { ok:false,error:guard.reason,guard } : { ok:true,guard };
}
