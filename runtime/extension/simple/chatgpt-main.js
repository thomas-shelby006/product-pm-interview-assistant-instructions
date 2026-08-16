(() => {
  if (window.__PMIA_SIMPLE_CHATGPT_WRITER__) return;
  window.__PMIA_SIMPLE_CHATGPT_WRITER__ = true;
  const REQUEST = 'pmia-simple:chatgpt-write';
  const RESPONSE = 'pmia-simple:chatgpt-write-result';
  const selectors = ['#prompt-textarea','textarea[name="prompt-textarea"]','div[contenteditable="true"][role="textbox"]'];
  const textOf = node => {
    const editorText = node?.editor?.getText?.();
    if (typeof editorText === 'string' && editorText.trim()) return editorText.trim();
    return String(node?.value ?? node?.innerText ?? node?.textContent ?? '').trim();
  };

  window.addEventListener(REQUEST, event => {
    const requestId = String(event?.detail?.requestId || '');
    const text = String(event?.detail?.text ?? '').trim().slice(0, 32_000);
    let result = { requestId, ok:false, matches:false };
    try {
      const node = selectors.map(selector => document.querySelector(selector)).find(Boolean);
      if (node && text) {
        if (node.editor?.commands?.setContent) {
          node.editor.commands.setContent({ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text }] }] }, { emitUpdate:true });
        } else if (String(node.tagName || '').toUpperCase() === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(node, text); else node.value = text;
        } else node.textContent = text;
        try { node.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text })); }
        catch { node.dispatchEvent(new Event('input', { bubbles:true })); }
        const matches = textOf(node) === text;
        result = { requestId, ok:matches, matches };
      }
    } catch (error) {
      result = { requestId, ok:false, matches:false, reason:String(error?.message || error).slice(0, 160) };
    }
    window.dispatchEvent(new CustomEvent(RESPONSE, { detail:result }));
  });
})();
