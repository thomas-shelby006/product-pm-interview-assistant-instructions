export function createLiveAnnouncer({ politeNode, assertiveNode, now = Date.now, minGapMs = 900 } = {}) {
  let lastAt = 0;
  let lastMessage = '';
  function announce(message, { priority = 'polite', force = false } = {}) {
    const text = String(message || '').trim();
    const at = Number(now()) || Date.now();
    if (!text || (!force && text === lastMessage && at - lastAt < minGapMs)) return false;
    const node = priority === 'assertive' ? assertiveNode : politeNode;
    if (!node) return false;
    node.textContent = '';
    queueMicrotask(() => { node.textContent = text; });
    lastAt = at;
    lastMessage = text;
    return true;
  }
  return { announce, snapshot: () => ({ lastAt, lastMessage }) };
}
