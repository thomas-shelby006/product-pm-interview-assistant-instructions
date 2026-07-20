export function firstMatch(doc, selectors) {
  for (const selector of selectors) {
    const match = doc.querySelector(selector);
    if (match) return match;
  }
  return null;
}

export function latestText(doc, selectors) {
  for (const selector of selectors) {
    const nodes = Array.from(doc.querySelectorAll(selector) || []);
    if (!nodes.length) continue;
    const value = nodes[nodes.length - 1]?.innerText || nodes[nodes.length - 1]?.textContent || '';
    if (String(value).trim()) return String(value).trim();
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
    const proto = tag === 'TEXTAREA' ? globalThis.HTMLTextAreaElement?.prototype : globalThis.HTMLInputElement?.prototype;
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
  return String(element.value ?? element.innerText ?? element.textContent ?? '').trim();
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
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true
  });
  return element.dispatchEvent(event);
}
