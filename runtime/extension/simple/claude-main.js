(() => {
  if (window.__PMIA_SIMPLE_CLAUDE_WRITER__) return;
  window.__PMIA_SIMPLE_CLAUDE_WRITER__ = true;
  const REQUEST = 'pmia-simple:claude-write';
  const RESPONSE = 'pmia-simple:claude-write-result';
  const selectors = ['div[contenteditable="true"].ProseMirror','[contenteditable="true"][data-testid="chat-input"]'];

  window.addEventListener(REQUEST, event => {
    const requestId = String(event?.detail?.requestId || '');
    const text = String(event?.detail?.text ?? '').trim().slice(0, 32_000);
    let result = { requestId, ok:false, matches:false };
    try {
      const composer = selectors.map(selector => document.querySelector(selector)).find(Boolean);
      const editor = composer?.editor;
      if (composer && editor?.commands?.setContent && text) {
        const content = { type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text }] }] };
        const changed = editor.commands.setContent(content, { emitUpdate:true });
        try { composer.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text })); }
        catch { composer.dispatchEvent(new Event('input', { bubbles:true })); }
        const current = String(editor.getText?.() ?? composer.innerText ?? composer.textContent ?? '').trim();
        result = { requestId, ok:changed !== false && current === text, matches:current === text };
      }
    } catch (error) {
      result = { requestId, ok:false, matches:false, reason:String(error?.message || error).slice(0, 160) };
    }
    window.dispatchEvent(new CustomEvent(RESPONSE, { detail:result }));
  });
})();
