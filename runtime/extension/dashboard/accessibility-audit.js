export function auditDashboardAccessibility(documentLike) {
  const issues=[];if(!documentLike?.querySelectorAll)return {ok:false,issues:[{code:'document_missing'}]};
  const ids=new Set();for(const node of documentLike.querySelectorAll('[id]')){const id=String(node.id||'');if(ids.has(id))issues.push({code:'duplicate_id',id});ids.add(id);}
  const controls=[...documentLike.querySelectorAll('button,input,select,textarea,[role="button"]')];
  for(const control of controls){if(control.hidden||control.getAttribute?.('aria-hidden')==='true')continue;const labelledBy=String(control.getAttribute?.('aria-labelledby')||'').trim();const label=control.getAttribute?.('aria-label')||labelledBy||control.textContent||control.value||'';if(!String(label).trim())issues.push({code:'control_unlabelled',id:String(control.id||'')});for(const ref of labelledBy.split(/\s+/).filter(Boolean))if(!ids.has(ref))issues.push({code:'label_target_missing',id:String(control.id||''),target:ref});}
  const dialogs=[...documentLike.querySelectorAll('[role="dialog"],dialog')];for(const dialog of dialogs){const ref=String(dialog.getAttribute?.('aria-labelledby')||'').trim();if(!dialog.getAttribute?.('aria-label')&&!ref)issues.push({code:'dialog_unlabelled',id:String(dialog.id||'')});if(ref&&!ids.has(ref))issues.push({code:'dialog_label_target_missing',id:String(dialog.id||''),target:ref});}
  for(const node of documentLike.querySelectorAll('[aria-controls]')){const target=String(node.getAttribute?.('aria-controls')||'');if(target&&!ids.has(target))issues.push({code:'control_target_missing',id:String(node.id||''),target});}
  const live=[...documentLike.querySelectorAll('[aria-live]')];if(!live.some(node=>node.getAttribute('aria-live')==='polite'))issues.push({code:'polite_live_region_missing'});if(!live.some(node=>node.getAttribute('aria-live')==='assertive'))issues.push({code:'assertive_live_region_missing'});
  issues.sort((a,b)=>a.code.localeCompare(b.code)||String(a.id||'').localeCompare(String(b.id||''))||String(a.target||'').localeCompare(String(b.target||'')));
  return {ok:issues.length===0,issues,counts:{ids:ids.size,controls:controls.length,dialogs:dialogs.length}};
}
