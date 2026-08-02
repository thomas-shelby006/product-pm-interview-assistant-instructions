function focusable(dialog) {
  if (!dialog?.querySelectorAll) return [];
  return [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter(node => !node.hidden && node.getAttribute?.('aria-hidden') !== 'true' && !node.closest?.('[inert]') && node.isConnected !== false);
}
export function createDialogFocusCoordinator({ activeElement = () => document.activeElement } = {}) {
  const stack = [];
  const current = () => stack.at(-1) || null;
  function open(dialog, trigger = activeElement()) {
    if (!dialog) return false;
    if (current()?.dialog === dialog) return true;
    stack.push({ dialog, returnFocus: trigger?.isConnected === false ? null : trigger || null });
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal(); else dialog.hidden = false;
    focusable(dialog)[0]?.focus?.();
    return true;
  }
  function close(dialog = current()?.dialog) {
    const index = stack.findIndex(item => item.dialog === dialog);
    if (index < 0) return false;
    const [{ returnFocus }] = stack.splice(index, 1);
    if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.hidden = true;
    const parent = current();
    const target = parent ? focusable(parent.dialog)[0] : returnFocus;
    if (target?.isConnected !== false) target?.focus?.();
    return true;
  }
  function handleKey(event) {
    const active = current()?.dialog;
    if (!active) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(active); return true; }
    if (event.key !== 'Tab') return false;
    const nodes = focusable(active); if (!nodes.length) { event.preventDefault(); active.focus?.(); return true; }
    const index = nodes.indexOf(activeElement());
    const next = event.shiftKey ? (index <= 0 ? nodes.length - 1 : index - 1) : (index < 0 || index === nodes.length - 1 ? 0 : index + 1);
    event.preventDefault(); nodes[next].focus?.(); return true;
  }
  return { open, close, handleKey, active: () => current()?.dialog || null, depth: () => stack.length };
}
