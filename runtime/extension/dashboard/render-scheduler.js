export function createRenderScheduler({ frame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id) } = {}) {
  let handle = 0;
  let pending = new Set();
  let renderer = null;
  function schedule(sections = [], render = renderer) {
    renderer = render;
    for (const section of Array.isArray(sections) ? sections : [sections]) if (section) pending.add(String(section));
    if (handle || typeof renderer !== 'function') return handle;
    handle = frame(() => {
      handle = 0;
      const current = [...pending]; pending.clear();
      renderer(current);
    });
    return handle;
  }
  function flush() {
    if (!pending.size || typeof renderer !== 'function') return [];
    if (handle) cancelFrame(handle); handle = 0;
    const current = [...pending]; pending.clear(); renderer(current); return current;
  }
  function cancel() { if (handle) cancelFrame(handle); handle = 0; pending.clear(); }
  return { schedule, flush, cancel, snapshot: () => ({ scheduled: Boolean(handle), pending: [...pending] }) };
}
