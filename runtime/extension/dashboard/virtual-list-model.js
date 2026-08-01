export function deriveVirtualList({ count = 0, scrollTop = 0, viewportHeight = 0, rowHeight = 48, overscan = 6 } = {}) {
  const total = Math.max(0, Number(count) || 0);
  const height = Math.max(1, Number(rowHeight) || 48);
  const start = Math.max(0, Math.floor(Math.max(0, Number(scrollTop) || 0) / height) - Math.max(0, Number(overscan) || 0));
  const visible = Math.ceil(Math.max(0, Number(viewportHeight) || 0) / height) + (Math.max(0, Number(overscan) || 0) * 2);
  const end = Math.min(total, start + visible);
  return { start, end, count: Math.max(0, end - start), top: start * height, bottom: Math.max(0, (total - end) * height), totalHeight: total * height };
}

export function virtualItems(items = [], options = {}) {
  const list = Array.isArray(items) ? items : [];
  const model = deriveVirtualList({ ...options, count: list.length });
  return { ...model, items: list.slice(model.start, model.end) };
}
