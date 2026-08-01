export function toolbarItems(container) {
  return [...(container?.querySelectorAll?.('button:not([disabled]), [href], input:not([disabled]), select:not([disabled])') || [])]
    .filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
}

export function applyRovingTabIndex(container, activeIndex = 0) {
  const items = toolbarItems(container);
  if (!items.length) return { items, activeIndex: 0 };
  const index = Math.min(Math.max(0, Number(activeIndex || 0)), items.length - 1);
  items.forEach((item, itemIndex) => { item.tabIndex = itemIndex === index ? 0 : -1; });
  return { items, activeIndex: index };
}

export function handleToolbarKey(container, event, activeIndex = 0) {
  const items = toolbarItems(container);
  if (!items.length) return { handled: false, activeIndex: 0 };
  let index = Math.min(Math.max(0, Number(activeIndex || 0)), items.length - 1);
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % items.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = items.length - 1;
  else return { handled: false, activeIndex: index };
  event.preventDefault();
  applyRovingTabIndex(container, index);
  items[index].focus();
  return { handled: true, activeIndex: index };
}
