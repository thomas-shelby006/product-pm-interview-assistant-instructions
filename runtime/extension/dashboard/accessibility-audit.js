export function auditDashboardAccessibility(documentLike) {
  const issues = [];
  if (!documentLike?.querySelectorAll) return { ok: false, issues: [{ code: 'document_missing' }] };
  const ids = new Set();
  for (const node of documentLike.querySelectorAll('[id]')) {
    const id = String(node.id || '');
    if (ids.has(id)) issues.push({ code: 'duplicate_id', id });
    ids.add(id);
  }
  for (const control of documentLike.querySelectorAll('button,input,select,textarea,[role="button"]')) {
    const label = control.getAttribute?.('aria-label') || control.getAttribute?.('aria-labelledby') || control.textContent || control.value || '';
    if (!String(label).trim()) issues.push({ code: 'control_unlabelled', id: String(control.id || '') });
  }
  for (const dialog of documentLike.querySelectorAll('[role="dialog"],dialog')) {
    if (!dialog.getAttribute?.('aria-label') && !dialog.getAttribute?.('aria-labelledby')) issues.push({ code: 'dialog_unlabelled', id: String(dialog.id || '') });
  }
  const live = [...documentLike.querySelectorAll('[aria-live]')];
  if (!live.some(node => node.getAttribute('aria-live') === 'polite')) issues.push({ code: 'polite_live_region_missing' });
  if (!live.some(node => node.getAttribute('aria-live') === 'assertive')) issues.push({ code: 'assertive_live_region_missing' });
  return { ok: issues.length === 0, issues, counts: { ids: ids.size, controls: documentLike.querySelectorAll('button,input,select,textarea,[role="button"]').length, dialogs: documentLike.querySelectorAll('[role="dialog"],dialog').length } };
}
