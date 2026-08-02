import { COMMAND_REGISTRY } from './operator-command-registry.js';

function sorted(values) { return [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b)); }

export function extractDomIds(html = '') {
  return [...String(html).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
}

export function extractVisibleCommands(html = '', dashboardSource = '') {
  const markup = [...String(html).matchAll(/\bdata-command="([^"]+)"/g)].map(match => match[1]);
  const delegated = [...String(dashboardSource).matchAll(/sendCommand\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  const runCommand = [...String(dashboardSource).matchAll(/runCommand\([^,]+,\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  return sorted([...markup, ...delegated, ...runCommand]);
}

export function extractControllerCommands(source = '') {
  return sorted([...String(source).matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(match => match[1]));
}

export function auditCommandReachability({
  registry = COMMAND_REGISTRY,
  html = '',
  dashboardSource = '',
  controllerSource = ''
} = {}) {
  const ids = extractDomIds(html);
  const duplicateDomIds = sorted(ids.filter((id,index) => ids.indexOf(id) !== index));
  const registered = sorted(registry.map(item => item.id));
  const visible = extractVisibleCommands(html, dashboardSource);
  const controller = extractControllerCommands(controllerSource);
  const registeredSet = new Set(registered);
  const controllerSet = new Set(controller);
  const visibleWithoutRegistry = visible.filter(id => !registeredSet.has(id));
  const controllerWithoutRegistry = controller.filter(id => !registeredSet.has(id));
  const registryWithoutOwner = registered.filter(id => !controllerSet.has(id));
  const visibleWithoutOwner = visible.filter(id => !controllerSet.has(id));
  const errors = [
    ...duplicateDomIds.map(id => ({ code:'duplicate_dom_id', id })),
    ...visibleWithoutRegistry.map(id => ({ code:'visible_without_registry', id })),
    ...controllerWithoutRegistry.map(id => ({ code:'controller_without_registry', id })),
    ...registryWithoutOwner.map(id => ({ code:'registry_without_owner', id })),
    ...visibleWithoutOwner.map(id => ({ code:'visible_without_owner', id }))
  ];
  return { ok: errors.length === 0, duplicateDomIds, visibleWithoutRegistry, controllerWithoutRegistry, registryWithoutOwner, visibleWithoutOwner, registeredCount:registered.length, visibleCount:visible.length, controllerCount:controller.length, errors };
}