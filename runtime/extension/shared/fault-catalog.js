const CATALOG = Object.freeze([
  ['receiver_missing','transport','Window 2 is unavailable','check_live'],
  ['sequence_gap','sequence','A lower provider sequence is missing','resume_catch_up'],
  ['storage_critical','storage','Session storage cannot guarantee persistence','compact_proven'],
  ['draft_conflict','receiver','Manual composer text blocks automation','resolve_draft_restore_pmia'],
  ['provider_capability_loss','provider','A required provider surface disappeared','repair_runtime'],
  ['self_test_failed','verification','Active control-plane verification failed','run_self_test'],
  ['state_incompatible','state','Runtime state cannot be migrated safely','repair_state_compatibility'],
  ['proof_member_mismatch','proof','Rendered proof does not match exact batch members','check_live'],
  ['focus_intent_expired','focus','A focus action lost its user-gesture authorization','focus_pilot']
].map(([code,owner,summary,action])=>({code,owner,summary,action})));

export function faultCatalog() { return CATALOG.map(item => ({ ...item })); }
export function searchFaultCatalog(query = '') {
  const term = String(query || '').trim().toLowerCase();
  return CATALOG.filter(item => !term || `${item.code} ${item.owner} ${item.summary} ${item.action}`.toLowerCase().includes(term)).map(item => ({ ...item }));
}
export function explainFault(code = '') { return CATALOG.find(item => item.code === String(code)) || { code: String(code), owner: 'unknown', summary: 'Unknown reason code', action: 'export_support_bundle' }; }
