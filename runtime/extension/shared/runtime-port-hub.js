export function rolePortName(sessionId, role, instanceId) {
  return `pmia-role:${String(sessionId)}:${String(role)}:${String(instanceId)}`;
}

export function parseRolePortName(name) {
  const match = /^pmia-role:([^:]+):(sender|receiver):(.+)$/.exec(String(name || ''));
  if (!match) return null;
  return { sessionId: match[1], role: match[2], instanceId: match[3] };
}

export function createRuntimePortHub({ onFrame = async () => ({ ok: false, error: 'unsupported_frame' }), timeoutMs = 1500 } = {}) {
  const ports = new Map();
  const pending = new Map();
  let requestSequence = 0;
  const keyFor = (sessionId, role) => `${sessionId}\u0000${role}`;

  function rejectForPort(entry, reason = 'port_disconnected') {
    for (const [requestId, item] of pending) {
      if (item.entry !== entry) continue;
      clearTimeout(item.timer);
      pending.delete(requestId);
      item.reject(new Error(reason));
    }
  }

  function connect(port) {
    const identity = parseRolePortName(port?.name);
    if (!identity) return false;
    const key = keyFor(identity.sessionId, identity.role);
    const previous = ports.get(key);
    if (previous && previous.port !== port) rejectForPort(previous, 'port_replaced');
    const entry = {
      ...identity,
      port,
      tabId: Number.isInteger(port.sender?.tab?.id) ? port.sender.tab.id : null,
      windowId: Number.isInteger(port.sender?.tab?.windowId) ? port.sender.tab.windowId : null,
      connectedAt: Date.now()
    };
    ports.set(key, entry);

    port.onMessage.addListener(frame => {
      if (frame?.type === 'response' && frame.requestId) {
        const item = pending.get(String(frame.requestId));
        if (!item || item.entry !== entry) return;
        clearTimeout(item.timer);
        pending.delete(String(frame.requestId));
        item.resolve(frame.result);
        return;
      }
      Promise.resolve(onFrame({ ...frame, identity, tabId: entry.tabId, port }))
        .then(result => {
          if (!frame?.requestId) return;
          try { port.postMessage({ type: 'response', requestId: frame.requestId, result }); } catch {}
        })
        .catch(error => {
          if (!frame?.requestId) return;
          try {
            port.postMessage({
              type: 'response',
              requestId: frame.requestId,
              result: { ok: false, error: String(error?.message || error) }
            });
          } catch {}
        });
    });

    port.onDisconnect.addListener(() => {
      if (ports.get(key)?.port === port) ports.delete(key);
      rejectForPort(entry);
    });
    return true;
  }

  function get(sessionId, role) {
    return ports.get(keyFor(sessionId, role)) || null;
  }

  function has(sessionId, role) {
    return Boolean(get(sessionId, role));
  }

  async function request(sessionId, role, frame, { timeout = timeoutMs } = {}) {
    const entry = get(sessionId, role);
    if (!entry) throw new Error(`${role}_port_missing`);
    const requestId = `hub-${Date.now()}-${++requestSequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('port_request_timeout'));
      }, Math.max(100, Number(timeout) || timeoutMs));
      pending.set(requestId, { entry, resolve, reject, timer });
      try {
        entry.port.postMessage({ ...frame, type: 'request', requestId, operation: frame.operation });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(error);
      }
    });
  }

  function snapshot() {
    return [...ports.values()].map(entry => ({
      sessionId: entry.sessionId,
      role: entry.role,
      instanceId: entry.instanceId,
      tabId: entry.tabId,
      windowId: entry.windowId,
      connectedAt: entry.connectedAt
    }));
  }

  return { connect, get, has, request, snapshot };
}
