function focusable(dialog) {
  return [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter(node => !node.hidden);
}

export function createDialogFocusCoordinator() {
  let active = null;
  let returnFocus = null;
  function open(dialog, trigger = document.activeElement) {
    if (!dialog) return false;
    active = dialog;
    returnFocus = trigger || null;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.hidden = false;
    focusable(dialog)[0]?.focus();
    return true;
  }
  function close(dialog = active) {
    if (!dialog) return false;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.hidden = true;
    const target = returnFocus;
    active = null; returnFocus = null;
    target?.focus?.();
    return true;
  }
  function handleKey(event) {
    if (!active) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(); return true; }
    if (event.key !== 'Tab') return false;
    const nodes = focusable(active); if (!nodes.length) return false;
    const index = nodes.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? nodes.length - 1 : index - 1) : (index < 0 || index === nodes.length - 1 ? 0 : index + 1);
    event.preventDefault(); nodes[next].focus(); return true;
  }
  return { open, close, handleKey, active: () => active };
}
