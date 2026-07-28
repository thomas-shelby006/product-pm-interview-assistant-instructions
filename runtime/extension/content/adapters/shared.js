export function firstMatch(doc, selectors) {
  for (const selector of selectors) {
    const match = doc.querySelector?.(selector);
    if (match) return match;
  }
  return null;
}

export function latestText(doc, selectors) {
  for (const selector of selectors) {
    const nodes = Array.from(doc.querySelectorAll?.(selector) || []);
    if (!nodes.length) continue;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const value = composerText(nodes[index]);
      if (value) return value;
    }
  }
  return '';
}

function dispatchInput(element, text) {
  const EventCtor = globalThis.InputEvent || globalThis.Event;
  if (!EventCtor || typeof element.dispatchEvent !== 'function') return;
  try {
    element.dispatchEvent(new EventCtor('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
  } catch {
    element.dispatchEvent(new EventCtor('input', { bubbles: true }));
  }
}

export function setEditableText(element, text) {
  if (!element) return false;
  element.focus?.();
  const tag = String(element.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const proto = tag === 'TEXTAREA'
      ? globalThis.HTMLTextAreaElement?.prototype
      : globalThis.HTMLInputElement?.prototype;
    const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(element, text);
    else element.value = text;
  } else {
    element.textContent = text;
  }
  dispatchInput(element, text);
  return true;
}

export function composerText(element) {
  if (!element) return '';
  for (const candidate of [element.value, element.innerText, element.textContent]) {
    const normalized = String(candidate ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

export function firstNonEmptyCandidate(doc, selectors) {
  const seen = new Set();
  for (const selector of selectors) {
    const nodes = Array.from(doc.querySelectorAll?.(selector) || []);
    if (!nodes.length) {
      const single = doc.querySelector?.(selector);
      if (single) nodes.push(single);
    }
    for (const node of nodes) {
      if (!node || seen.has(node)) continue;
      seen.add(node);
      const text = composerText(node);
      if (text) return { element: node, text };
    }
  }
  return null;
}

export function firstNonEmptyText(doc, selectors) {
  return firstNonEmptyCandidate(doc, selectors)?.text || '';
}

export function clickFirst(doc, selectors) {
  const button = firstMatch(doc, selectors);
  if (!button || button.disabled) return false;
  button.click?.();
  return true;
}

export function submitWithEnter(element) {
  if (!element || typeof element.dispatchEvent !== 'function') return false;
  const EventCtor = globalThis.KeyboardEvent || globalThis.Event;
  if (!EventCtor) return false;
  const event = new EventCtor('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  return element.dispatchEvent(event);
}


export function createConversationMessageReader(doc, { selector, roleOf } = {}) {
  const fallbackIds = new WeakMap();
  let nextFallbackId = 1;
  const fallbackId = element => {
    if (!fallbackIds.has(element)) fallbackIds.set(element, `dom-message-${nextFallbackId++}`);
    return fallbackIds.get(element);
  };

  return () => Array.from(doc.querySelectorAll?.(selector) || [])
    .map(element => {
      const turn = element.closest?.('[data-turn-id]') || null;
      const turnId = String(
        element.getAttribute?.('data-turn-id') || turn?.getAttribute?.('data-turn-id') || ''
      ).trim();
      const id = String(
        element.getAttribute?.('data-message-id') || turnId || fallbackId(element)
      ).trim();
      const role = String(
        roleOf?.(element) || element.getAttribute?.('data-message-author-role') || ''
      ).trim().toLowerCase();
      return { id, turnId, role, text: composerText(element), element };
    })
    .filter(message => message.id && message.text && ['user', 'assistant'].includes(message.role));
}
