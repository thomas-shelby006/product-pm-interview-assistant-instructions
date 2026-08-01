import { rolePortName } from '../shared/runtime-port-hub.js';
import {
  createTransportHandshake,
  negotiateTransportHandshake,
  validateTransportFrame,
  withTransportProtocol
} from '../shared/transport-protocol.js';
import { RequestCorrelationJournal } from '../shared/request-correlation-journal.js';
import { ReconnectPolicy } from '../shared/reconnect-policy.js';

export function createRuntimeRolePort({
  chromeApi = globalThis.chrome,
  sessionId,
  role,
  instanceId,
  onRequest = async () => ({ ok: false, error: 'unsupported_operation' }),
  reconnectDelayMs = 120,
  handshakeTimeoutMs = 800
} = {}) {
  let port = null;
  let protocol = null;
  let reconnectTimer = null;
  let stopped = false;
  let sequence = 0;
  let handshakePromise = null;
  let handshakeResolve = null;
  let handshakeReject = null;
  const pending = new Map();
  const outboundJournal = new RequestCorrelationJournal({ maxEntries: 256 });
  const inboundJournal = new RequestCorrelationJournal({ maxEntries: 256 });
  const reconnectPolicy = new ReconnectPolicy({ baseMs: reconnectDelayMs, capMs: 8000 });
  const localHandshake = createTransportHandshake({ sessionId, role, instanceId });

  const failPending = reason => {
    for (const [id, item] of pending) {
      clearTimeout(item.timer);
      outboundJournal.fail(id, reason);
      item.reject(new Error(reason));
      pending.delete(id);
    }
  };

  const settleHandshake = result => {
    if (!handshakePromise) return;
    const resolve = handshakeResolve;
    const reject = handshakeReject;
    handshakePromise = null;
    handshakeResolve = null;
    handshakeReject = null;
    if (result?.ok) resolve?.(result);
    else reject?.(new Error(result?.error || 'transport_handshake_failed'));
  };

  function beginHandshake() {
    handshakePromise = new Promise((resolve, reject) => {
      handshakeResolve = resolve;
      handshakeReject = reject;
    });
    handshakePromise.catch(() => {});
    return handshakePromise;
  }

  function scheduleReconnect(decision = null) {
    if (stopped || reconnectTimer) return;
    const next = decision || reconnectPolicy.next();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, Math.max(50, Number(next.delayMs) || 120));
  }

  function sendResponse(requestId, result) {
    if (!port || !protocol) return false;
    try {
      port.postMessage(withTransportProtocol({ type: 'response', requestId, result }, protocol));
      return true;
    } catch {
      return false;
    }
  }

  function connect() {
    if (stopped || port) return Boolean(port);
    protocol = null;
    beginHandshake();
    reconnectPolicy.beginProbe();
    try {
      port = chromeApi.runtime.connect({ name: rolePortName(sessionId, role, instanceId) });
    } catch {
      port = null;
      settleHandshake({ ok: false, error: 'role_port_connect_failed' });
      scheduleReconnect(reconnectPolicy.failProbe());
      return false;
    }
    port.onMessage.addListener(frame => {
      if (frame?.type === 'transport_handshake_offer') {
        const negotiated = negotiateTransportHandshake(localHandshake, frame.handshake, { epoch: frame.epoch });
        if (!negotiated.ok) {
          try { port?.postMessage({ type: 'transport_handshake_accept', handshake: localHandshake, ok: false, error: negotiated.error }); } catch {}
          settleHandshake(negotiated);
          return;
        }
        protocol = negotiated.identity;
        try {
          port?.postMessage({
            type: 'transport_handshake_accept',
            handshake: localHandshake,
            protocol
          });
        } catch {
          protocol = null;
          settleHandshake({ ok: false, error: 'transport_handshake_send_failed' });
        }
        return;
      }
      if (frame?.type === 'transport_handshake_result') {
        if (!frame.ok || !frame.protocol) {
          protocol = null;
          settleHandshake({ ok: false, error: frame.error || 'transport_handshake_rejected' });
          try { port?.disconnect(); } catch {}
          return;
        }
        const validation = validateTransportFrame({ protocol: frame.protocol }, protocol || frame.protocol);
        if (!validation.ok) {
          protocol = null;
          settleHandshake(validation);
          return;
        }
        protocol = validation.identity;
        reconnectPolicy.succeed();
        settleHandshake({ ok: true, protocol });
        return;
      }
      if (frame?.type === 'response' && frame.requestId) {
        if (!protocol || !validateTransportFrame(frame, protocol).ok) return;
        const accepted = outboundJournal.acceptResponse(String(frame.requestId), protocol.epoch);
        if (!accepted.accepted) return;
        const item = pending.get(String(frame.requestId));
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(String(frame.requestId));
        outboundJournal.complete(String(frame.requestId), frame.result);
        item.resolve(frame.result);
        return;
      }
      if (frame?.type !== 'request' || !frame.requestId || !protocol) return;
      const validation = validateTransportFrame(frame, protocol);
      if (!validation.ok) {
        sendResponse(frame.requestId, { ok: false, error: validation.error });
        return;
      }
      const started = inboundJournal.begin(String(frame.requestId), {
        epoch: protocol.epoch,
        operation: frame.operation
      });
      if (!started.accepted) {
        const replay = inboundJournal.result(String(frame.requestId));
        if (replay !== null) sendResponse(frame.requestId, { ...replay, replayed: true });
        return;
      }
      Promise.resolve(onRequest(frame))
        .then(result => {
          inboundJournal.complete(String(frame.requestId), result);
          sendResponse(frame.requestId, result);
        })
        .catch(error => {
          const result = { ok: false, error: String(error?.message || error) };
          inboundJournal.complete(String(frame.requestId), result);
          sendResponse(frame.requestId, result);
        });
    });
    port.onDisconnect.addListener(() => {
      port = null;
      protocol = null;
      settleHandshake({ ok: false, error: 'role_port_disconnected' });
      failPending('role_port_disconnected');
      scheduleReconnect(reconnectPolicy.failProbe());
    });
    return true;
  }

  async function ensureReady(timeoutMs = handshakeTimeoutMs) {
    if (!port && !connect()) throw new Error('role_port_unavailable');
    if (protocol) return protocol;
    const active = handshakePromise || beginHandshake();
    let timer;
    try {
      await Promise.race([
        active,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('transport_handshake_timeout')), Math.max(100, Number(timeoutMs) || handshakeTimeoutMs));
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!protocol) throw new Error('transport_handshake_incomplete');
    return protocol;
  }

  async function request(operation, payload = {}, { timeoutMs = 1500, fallback = null } = {}) {
    try {
      const identity = await ensureReady(Math.min(Number(timeoutMs) || 1500, handshakeTimeoutMs));
      const requestId = `role-${Date.now()}-${++sequence}`;
      outboundJournal.begin(requestId, { epoch: identity.epoch, operation });
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          outboundJournal.fail(requestId, 'role_port_timeout');
          reject(new Error('role_port_timeout'));
        }, Math.max(100, Number(timeoutMs) || 1500));
        pending.set(requestId, { resolve, reject, timer });
        try {
          port.postMessage(withTransportProtocol({ type: 'request', requestId, operation, payload }, identity));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(requestId);
          outboundJournal.fail(requestId, error);
          reject(error);
        }
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
    settleHandshake({ ok: false, error: 'role_port_stopped' });
    failPending('role_port_stopped');
    try { port?.disconnect(); } catch {}
    port = null;
    protocol = null;
  }

  function snapshot() {
    return {
      connected: Boolean(port),
      handshakeReady: Boolean(protocol),
      protocolVersion: Number(protocol?.version || 0),
      epoch: Number(protocol?.epoch || 0),
      capabilities: [...(protocol?.capabilities || [])],
      reconnect: reconnectPolicy.snapshot()
    };
  }

  return {
    connect,
    request,
    disconnect,
    snapshot,
    get connected() { return Boolean(port && protocol); }
  };
}