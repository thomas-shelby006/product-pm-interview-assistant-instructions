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

function dispatchInput(node, text) {
  try { node.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text })); }
  catch { node.dispatchEvent?.(new Event('input', { bubbles:true })); }
}

export function writeChatGptComposerInMain(doc = document, text = '') {
  const node = findComposer(doc);
  const value = String(text ?? '').trim();
  if (!node || !value) return { ok:false, reason:'composer_missing' };
  const editor = node.editor;
  if (editor?.commands?.setContent) {
    const content = { type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:value }] }] };
    editor.commands.setContent(content, { emitUpdate:true });
  } else if (String(node.tagName || '').toUpperCase() === 'TEXTAREA') {
    const setter = Object.getOwnPropertyDescriptor(globalThis.HTMLTextAreaElement?.prototype || {}, 'value')?.set;
    if (setter) setter.call(node, value); else node.value = value;
  } else {
    node.textContent = value;
  }
  dispatchInput(node, value);
  const matches = currentText(node) === value;
  return { ok:matches, matches };
}
