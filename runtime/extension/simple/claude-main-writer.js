const COMPOSER_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  '[contenteditable="true"][data-testid="chat-input"]'
];

function composer(doc) {
  for (const selector of COMPOSER_SELECTORS) {
    const node = doc?.querySelector?.(selector);
    if (node) return node;
  }
  return null;
}

export function writeClaudeComposerInMain(doc = document, text = '') {
  const node = composer(doc);
  const value = String(text ?? '').trim();
  if (!node || !value) return { ok:false, reason:'composer_missing' };
  const editor = node.editor;
  if (!editor?.commands?.setContent) return { ok:false, reason:'tiptap_missing' };
  const content = { type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:value }] }] };
  const changed = editor.commands.setContent(content, { emitUpdate:true });
  try { node.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:value })); }
  catch { node.dispatchEvent?.(new Event('input', { bubbles:true })); }
  const current = String(editor.getText?.() ?? node.innerText ?? node.textContent ?? '').trim();
  return { ok:Boolean(changed !== false && current === value), matches:current === value };
}
