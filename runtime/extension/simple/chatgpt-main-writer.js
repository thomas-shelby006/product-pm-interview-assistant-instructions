const COMPOSER = [
  '#prompt-textarea',
  'textarea[name="prompt-textarea"]',
  'div[contenteditable="true"][role="textbox"]'
];

function findComposer(doc) {
  for (const selector of COMPOSER) {
    const node = doc?.querySelector?.(selector);
    if (node) return node;
  }
  return null;
}

function currentText(node) {
  const editorText = node?.editor?.getText?.();
  if (typeof editorText === 'string' && editorText.trim()) return editorText.trim();
  return String(node?.value ?? node?.innerText ?? node?.textContent ?? '').trim();
}

function emitInput(node, type, text, view = globalThis) {
  const Input = view?.InputEvent || globalThis.InputEvent;
  const EventCtor = view?.Event || globalThis.Event;
  let event;
  try { event = Input ? new Input(type, { bubbles:true, cancelable:type === 'beforeinput', inputType:'insertText', data:text }) : null; }
  catch { event = null; }
  if (!event) {
    try { event = EventCtor ? new EventCtor(type, { bubbles:true, cancelable:type === 'beforeinput' }) : { type }; }
    catch { event = { type }; }
  }
  node.dispatchEvent?.(event);
}

function notifyReactBeforeInput(node, text) {
  const candidates = [node, node?.closest?.('form')].filter(Boolean);
  for (const candidate of candidates) {
    for (const key of Object.getOwnPropertyNames(candidate)) {
      if (!key.startsWith('__reactProps')) continue;
      const props = candidate[key];
      const handler = props?.onBeforeInputCapture || props?.onBeforeInput;
      if (typeof handler !== 'function') continue;
      handler({ data:text, inputType:'insertText', target:node, currentTarget:candidate });
      return true;
    }
  }
  return false;
}
export function writeChatGptComposerInMain(doc = document, text = '') {
  const node = findComposer(doc);
  const value = String(text ?? '').trim();
  if (!node || !value) return { ok:false, reason:'composer_missing' };
  const editor = node.editor;
  if (editor?.commands?.setContent) {
    const content = { type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:value }] }] };
    editor.commands.setContent(content, { emitUpdate:true });
    emitInput(node, 'input', value, doc.defaultView);
  } else if (String(node.tagName || '').toUpperCase() === 'TEXTAREA') {
    const setter = Object.getOwnPropertyDescriptor(globalThis.HTMLTextAreaElement?.prototype || {}, 'value')?.set;
    if (setter) setter.call(node, value); else node.value = value;
    emitInput(node, 'input', value, doc.defaultView);
  } else {
    const selection = doc.defaultView?.getSelection?.();
    const range = doc.createRange?.();
    node.focus?.();
    if (selection && range && typeof doc.execCommand === 'function') {
      range.selectNodeContents(node);
      selection.removeAllRanges?.();
      selection.addRange?.(range);
      emitInput(node, 'beforeinput', value, doc.defaultView);
      notifyReactBeforeInput(node, value);
      const inserted = doc.execCommand('insertText', false, value);
      if (!inserted) node.textContent = value;
    } else {
      node.textContent = value;
    }
    emitInput(node, 'input', value, doc.defaultView);
  }
  const matches = currentText(node) === value;
  return { ok:matches, matches };
}
