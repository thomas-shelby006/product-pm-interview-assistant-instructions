import { COMMAND_REGISTRY } from './operator-command-registry.js';
function sorted(values){ return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
function duplicates(values){ const seen=new Set();const found=[];for(const value of values){ if(seen.has(value)) found.push(value);else seen.add(value); }return sorted(found); }
export function extractDomIds(html=''){ return [...String(html).matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]); }
export function extractVisibleCommands(html='',dashboardSource=''){
  const markup=[...String(html).matchAll(/\bdata-command="([^"]+)"/g)].map(match=>match[1]);
  const delegated=[...String(dashboardSource).matchAll(/sendCommand\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
  const runCommand=[...String(dashboardSource).matchAll(/runCommand\([^,]+,\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
  const dynamic=[...String(dashboardSource).matchAll(/\.dataset\.command\s*=\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
  return sorted([...markup,...delegated,...runCommand,...dynamic]);
}
export function extractControllerCommands(source=''){ return [...String(source).matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(match=>match[1]); }
export function auditCommandReachability({ registry=COMMAND_REGISTRY,html='',dashboardSource='',controllerSource='' }={}){
  const ids=extractDomIds(html);const idSet=new Set(ids);const registryIds=registry.map(item=>String(item?.id||''));const controllerIds=extractControllerCommands(controllerSource);
  const duplicateDomIds=duplicates(ids);const duplicateRegistryIds=duplicates(registryIds);const duplicateControllerCommands=duplicates(controllerIds);
  const references=[...String(html).matchAll(/\b(?:aria-controls|aria-labelledby|for)="([^"]+)"/g)].map(match=>match[1]);
  const missingDomTargets=sorted(references.filter(id=>!idSet.has(id)));const registered=sorted(registryIds);const visible=extractVisibleCommands(html,dashboardSource);const controller=sorted(controllerIds);
  const registeredSet=new Set(registered),controllerSet=new Set(controller);
  const visibleWithoutRegistry=visible.filter(id=>!registeredSet.has(id));const controllerWithoutRegistry=controller.filter(id=>!registeredSet.has(id));const registryWithoutOwner=registered.filter(id=>!controllerSet.has(id));const visibleWithoutOwner=visible.filter(id=>!controllerSet.has(id));
  const errors=[...duplicateDomIds.map(id=>({code:'duplicate_dom_id',id})),...duplicateRegistryIds.map(id=>({code:'duplicate_registry_id',id})),...duplicateControllerCommands.map(id=>({code:'duplicate_controller_owner',id})),...missingDomTargets.map(id=>({code:'missing_dom_target',id})),...visibleWithoutRegistry.map(id=>({code:'visible_without_registry',id})),...controllerWithoutRegistry.map(id=>({code:'controller_without_registry',id})),...registryWithoutOwner.map(id=>({code:'registry_without_owner',id})),...visibleWithoutOwner.map(id=>({code:'visible_without_owner',id}))].sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
  return { ok:errors.length===0,duplicateDomIds,duplicateRegistryIds,duplicateControllerCommands,missingDomTargets,missingAriaTargets:missingDomTargets,visibleWithoutRegistry,controllerWithoutRegistry,registryWithoutOwner,visibleWithoutOwner,registeredCount:registered.length,visibleCount:visible.length,controllerCount:controller.length,errors };
}
