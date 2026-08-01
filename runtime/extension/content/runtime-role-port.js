import { rolePortName } from '../shared/runtime-port-hub.js';

export function createRuntimeRolePort({
  chromeApi = globalThis.chrome,
  sessionId,
  role,
  instanceId,
  onRequest = async () => ({ ok: false, error: 'unsupported_operation' }),
  reconnectDelayMs = 120
} = {}) {
  let port = null;
  let reconnectTimer = null;
  let stopped = false;
  let sequence = 0;
  const pending = new Map();

  const failPending = reason => {
    for (const [id, item] of pending) {
      clearTimeout(item.timer);
      item.reject(new Error(reason));
      pending.delete(id);
    }
  };

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, Math.max(50, Number(reconnectDelayMs) || 120));
  }

  function connect() {
    if (stopped || port) return Boolean(port);
    try {
      port = chromeApi.runtime.connect({ name: rolePortName(sessionId, role, instanceId) });
    } catch {
      port = null;
      scheduleReconnect();
      return false;
    }
    port.onMessage.addListener(frame => {
      if (frame?.type === 'response' && frame.requestId) {
        const item = pending.get(String(frame.requestId));
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(String(frame.requestId));
        item.resolve(frame.result);
        return;
      }
      if (frame?.type !== 'request' || !frame.requestId) return;
      Promise.resolve(onRequest(frame))
        .then(result => port?.postMessage({ type: 'response', requestId: frame.requestId, result }))
        .catch(error => port?.postMessage({
          type: 'response',
          requestId: frame.requestId,
          result: { ok: false, error: String(error?.message || error) }
        }));
    });
    port.onDisconnect.addListener(() => {
      port = null;
      failPending('role_port_disconnected');
      scheduleReconnect();
    });
    return true;
  }

  async function request(operation, payload = {}, { timeoutMs = 1500, fallback = null } = {}) {
    if (!port && !connect()) {
      if (typeof fallback === 'function') return fallback();
      throw new Error('role_port_unavailable');
    }
    const requestId = `role-${Date.now()}-${++sequence}`;
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error('role_port_timeout'));
        }, Math.max(100, Number(timeoutMs) || 1500));
        pending.set(requestId, { resolve, reject, timer });
        port.postMessage({ type: 'request', requestId, operation, payload });
      });
    } catch (error) {
      if (typeof fallback === 'function') return fallback(error);
      throw error;
    }
  }

  function disconnect() {
    stopped = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    failPending('role_port_stopped');
    try { port?.disconnect(); } catch {}
    port = null;
  }

  return {
    connect,
    request,
    disconnect,
    get connected() { return Boolean(port); }
  };
}
