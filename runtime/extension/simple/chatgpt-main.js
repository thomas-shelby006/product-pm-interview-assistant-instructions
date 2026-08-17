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
  const emitInput = (node, type, text, inputType = 'insertText') => {
    let event;
    try { event = new InputEvent(type, { bubbles:true, cancelable:type === 'beforeinput', inputType, data:text }); }
    catch { event = new Event(type, { bubbles:true, cancelable:type === 'beforeinput' }); }
    node.dispatchEvent(event);
  };
  const notifyReactBeforeInput = (node, text, inputType = 'insertText') => {
    for (const candidate of [node, node?.closest?.('form')].filter(Boolean)) {
      for (const key of Object.getOwnPropertyNames(candidate)) {
        if (!key.startsWith('__reactProps')) continue;
        const handler = candidate[key]?.onBeforeInputCapture || candidate[key]?.onBeforeInput;
        if (typeof handler !== 'function') continue;
        handler({ data:text, inputType, target:node, currentTarget:candidate });
        return true;
      }
    }
    return false;
  };

  const clearComposer = node => {
    if (node.editor?.commands?.setContent) {
      node.editor.commands.setContent({ type:'doc', content:[{ type:'paragraph' }] }, { emitUpdate:true });
      emitInput(node, 'input', null, 'deleteContentBackward');
      return textOf(node) === '';
    }
    if (String(node.tagName || '').toUpperCase() === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(node, ''); else node.value = '';
      emitInput(node, 'input', null, 'deleteContentBackward');
      return textOf(node) === '';
    }
    const selection = window.getSelection?.();
    const range = document.createRange?.();
    if (!selection || !range || typeof document.execCommand !== 'function') return false;
    node.focus?.();
    range.selectNodeContents(node);
    selection.removeAllRanges?.();
    selection.addRange?.(range);
    emitInput(node, 'beforeinput', null, 'deleteContentBackward');
    notifyReactBeforeInput(node, null, 'deleteContentBackward');
    document.execCommand('delete', false, null);
    emitInput(node, 'input', null, 'deleteContentBackward');
    return textOf(node) === '';
  };
  window.addEventListener(REQUEST, event => {
    const requestId = String(event?.detail?.requestId || '');
    const action = String(event?.detail?.action || 'write');
    const prefix = String(event?.detail?.prefix || '').trim().slice(0, 500);
    const text = String(event?.detail?.text ?? '').trim().slice(0, 32_000);
    let result = { requestId, ok:false, matches:false };
    try {
      const node = selectors.map(selector => document.querySelector(selector)).find(Boolean);
      if (node && action === 'clear_stale_setup') {
        const current = textOf(node);
        if (!prefix || !current.startsWith(prefix)) result = { requestId, ok:true, matches:true, cleared:false };
        else {
          const cleared = clearComposer(node);
          result = { requestId, ok:cleared, matches:cleared, cleared };
        }
      } else if (node && text) {
        if (node.editor?.commands?.setContent) {
          node.editor.commands.setContent({ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text }] }] }, { emitUpdate:true });
          emitInput(node, 'input', text);
        } else if (String(node.tagName || '').toUpperCase() === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(node, text); else node.value = text;
          emitInput(node, 'input', text);
        } else {
          const selection = window.getSelection?.();
          const range = document.createRange?.();
          node.focus?.();
          if (selection && range && typeof document.execCommand === 'function') {
            range.selectNodeContents(node);
            selection.removeAllRanges?.();
            selection.addRange?.(range);
            emitInput(node, 'beforeinput', text);
            notifyReactBeforeInput(node, text);
            const inserted = document.execCommand('insertText', false, text);
            if (!inserted) node.textContent = text;
          } else node.textContent = text;
          emitInput(node, 'input', text);
        }
        const matches = textOf(node) === text;
        result = { requestId, ok:matches, matches };
      }
    } catch (error) {
      result = { requestId, ok:false, matches:false, reason:String(error?.message || error).slice(0, 160) };
    }
    window.dispatchEvent(new CustomEvent(RESPONSE, { detail:result }));
  });
})();
