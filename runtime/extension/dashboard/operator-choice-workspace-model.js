const LABELS = Object.freeze({ wait:'Wait', retry:'Retry completed batch', continue:'Continue to protected next batch', keep_manual:'Keep manual text', restore_pmia:'Restore PMIA draft', merge:'Merge manual prefix and PMIA draft' });
export function deriveChoiceWorkspace(snapshot = {}) {
  const choice = snapshot.operatorChoice || null;
  if (!choice) return { visible:false, title:'No unresolved choice', detail:'The runtime does not need an operator decision.', options:[] };
  return { visible:true, id:String(choice.id || ''), type:String(choice.type || ''), fingerprint:String(choice.fingerprint || ''), title:String(choice.title || 'Choose an option'), detail:String(choice.detail || ''), options:(choice.options || []).map(id=>({ id, label:LABELS[id] || id.replaceAll('_',' ') })), view:choice.view || 'assist', anchor:choice.anchor || 'choiceWorkspace' };
}