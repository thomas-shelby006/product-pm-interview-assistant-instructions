export function createResilientPort({ connect, onReconnect = () => {} } = {}) {
  if (typeof connect !== 'function') throw new TypeError('connect is required');
  const messageListeners = new Set();
  const disconnectListeners = new Set();
  let raw = null;
  let closed = false;
  let notified = false;

  const notifyDisconnect = () => {
    if (notified) return;
    notified = true;
    for (const listener of disconnectListeners) listener();
  };
  const relayMessage = value => {
    for (const listener of messageListeners) listener(value);
  };

  function open(reconnected = false) {
    if (closed) throw new Error('port is closed');
    const next = connect();
    if (!next?.postMessage) throw new Error('connect returned no port');
    raw = next;
    next.onMessage?.addListener?.(relayMessage);
    next.onDisconnect?.addListener?.(() => {
      if (raw !== next) return;
      raw = null;
      if (closed) return notifyDisconnect();
      try { open(true); }
      catch { closed = true; notifyDisconnect(); }
    });
    if (reconnected) onReconnect(next);
    return next;
  }

  function current() {
    if (closed) throw new Error('port is closed');
    return raw || open(true);
  }

  open(false);
  return {
    postMessage(value) {
      let target = current();
      try { target.postMessage(value); }
      catch (error) {
        if (closed) throw error;
        if (raw === target) raw = null;
        target = open(true);
        target.postMessage(value);
      }
    },
    onMessage:{
      addListener(listener) { if (typeof listener === 'function') messageListeners.add(listener); },
      removeListener(listener) { messageListeners.delete(listener); }
    },
    onDisconnect:{
      addListener(listener) { if (typeof listener === 'function') disconnectListeners.add(listener); },
      removeListener(listener) { disconnectListeners.delete(listener); }
    },
    disconnect() {
      if (closed) return;
      closed = true;
      const target = raw;
      if (target?.disconnect) {
        try { target.disconnect(); } catch {}
      }
      raw = null;
      notifyDisconnect();
    }
  };
}
