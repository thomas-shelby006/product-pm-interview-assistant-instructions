export function nodeText(node) {
  if (!node) return '';
  const normalize = value => String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
  const candidates = [node.value, node.innerText, node.textContent]
    .map(normalize)
    .filter(Boolean);
  if (!candidates.length) return '';
  let best = candidates[0];
  const semantic = value => value.replace(/\s+/g, ' ').trim();
  for (const candidate of candidates.slice(1)) {
    if (semantic(candidate) !== semantic(best)) continue;
    const candidateLines = (candidate.match(/\n/g) || []).length;
    const bestLines = (best.match(/\n/g) || []).length;
    if (candidateLines > bestLines) best = candidate;
  }
  return best;
}

export function first(doc, selectors) {
  for (const selector of selectors) {
    const node = doc?.querySelector?.(selector);
    if (node) return node;
  }
  return null;
}

export function latest(doc, selectors) {
  for (const selector of selectors) {
    const nodes = Array.from(doc?.querySelectorAll?.(selector) || []);
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const text = nodeText(nodes[i]);
      if (text) return { node: nodes[i], text };
    }
  }
  return null;
}

export function setSimpleText(node, text) {
  if (!node) return false;
  const value = String(text ?? '');
  if ('value' in node) node.value = value;
  node.textContent = value;
  node.innerText = value;
  node.dispatchEvent?.(new Event('input', { bubbles: true }));
  return true;
}

export async function waitFor(check, { timeoutMs = 1500, intervalMs = 20 } = {}) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    if (check()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (true);
}

export function waitForDom(check, { root = globalThis.document?.documentElement || null, timeoutMs = 1500, intervalMs = 20 } = {}) {
  try {
    if (check()) return Promise.resolve(true);
  } catch {}

  const Observer = root?.ownerDocument?.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (!root || typeof Observer !== 'function') return waitFor(check, { timeoutMs, intervalMs });

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const observer = new Observer(() => {
      try { if (check()) finish(true); } catch {}
    });
    observer.observe(root, { subtree:true, childList:true, characterData:true, attributes:true });
    const timer = setTimeout(() => {
      try { finish(Boolean(check())); } catch { finish(false); }
    }, Math.max(0, timeoutMs));
  });
}
