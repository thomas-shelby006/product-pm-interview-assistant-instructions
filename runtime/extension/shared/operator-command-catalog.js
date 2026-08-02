import { COMMAND_REGISTRY } from './operator-command-registry.js';

const PALETTE_IDS = new Set([
  'pause','resume_catch_up','submit_now','interrupt_latest','compact_proven','retry_outbox',
  'check_live','run_self_test','repair_runtime','run_transport_drill','focus_sender','focus_receiver',
  'focus_pilot','focus_back','spotlight_sender','spotlight_receiver','spotlight_pilot',
  'export_support_bundle','prepare_end_session'
]);
const SHORTCUTS = Object.freeze({ pause:'Space', resume_catch_up:'L', submit_now:'N', interrupt_latest:'Ctrl+I', check_live:'H', repair_runtime:'R' });
const REQUIREMENTS = Object.freeze({ submit_now:'next_batch', interrupt_latest:'waiting_final' });
const CATALOG = Object.freeze(COMMAND_REGISTRY.filter(item => PALETTE_IDS.has(item.id)).map(item => Object.freeze({
  id:item.id, label:item.label, group:item.group, risk:item.risk, shortcut:SHORTCUTS[item.id] || '', requires:REQUIREMENTS[item.id] || ''
})));

export function commandCatalog(snapshot = {}) {
  const nextCount = Number(snapshot.batchState?.next?.questionCount || snapshot.batchState?.next?.memberIds?.length || 0);
  const unresolved = Number(snapshot.ledgerCounts?.persisted || 0) + Number(snapshot.ledgerCounts?.failed || 0);
  return CATALOG.map(item => ({ ...item,
    available: item.requires === 'next_batch' ? nextCount > 0 : item.requires === 'waiting_final' ? unresolved > 0 : snapshot.mode !== 'ended',
    blockedReason: snapshot.mode === 'ended' ? 'session_ended' : item.requires === 'next_batch' && !nextCount ? 'next_batch_empty' : item.requires === 'waiting_final' && !unresolved ? 'no_waiting_final' : ''
  }));
}

export function searchCommands(catalog = CATALOG, query = '') {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.map((item,index) => { const haystack=`${item.label} ${item.id} ${item.group} ${item.shortcut || ''}`.toLowerCase(); const score=words.reduce((sum,word)=>sum+(haystack.startsWith(word)?8:haystack.includes(word)?3:-20),0)-index/100; return {...item,score}; })
    .filter(item => !words.length || item.score >= 0).sort((a,b)=>b.score-a.score || a.label.localeCompare(b.label));
}

export function commandPreview(command = {}, snapshot = {}) {
  return { id:String(command.id || ''), label:String(command.label || ''), risk:String(command.risk || 'safe'), available:command.available !== false, blockedReason:String(command.blockedReason || ''), mode:String(snapshot.mode || 'unknown'), unresolved:Number(snapshot.ledger?.filter?.(item => !['proven','archived'].includes(item.state)).length || 0) };
}
