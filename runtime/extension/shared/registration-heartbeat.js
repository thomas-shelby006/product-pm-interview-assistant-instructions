export function classifyRegistration(previous, incoming) {
  if (!previous) return 'ownership_transition';
  const priorTab = Number(previous.tabId);
  const nextTab = Number(incoming?.tabId);
  const priorInstance = String(previous.instanceId || '');
  const nextInstance = String(incoming?.instanceId || '');
  const sameRoleProvider = String(previous.role || '') === String(incoming?.role || '')
    && String(previous.provider || '') === String(incoming?.provider || '');
  if (!sameRoleProvider) return 'ownership_transition';
  if (priorTab === nextTab && priorInstance && nextInstance && priorInstance !== nextInstance) return 'instance_replacement';
  if (priorTab !== nextTab && priorInstance && priorInstance === nextInstance) return 'lease_migration';
  if (priorTab === nextTab && (!priorInstance || !nextInstance || priorInstance === nextInstance)) return 'heartbeat';
  return 'ownership_transition';
}