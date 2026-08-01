import { TransportCircuit } from './transport-circuit.js';

export function rolePortName(sessionId, role, instanceId) {
  return `pmia-role:${String(sessionId)}:${String(role)}:${String(instanceId)}`;
}

export function parseRolePortName(name) {
  const match = /^pmia-role:([^:]+):(sender|receiver):(.+)$/.exec(String(name || ''));
  if (!match) return null;
  return { sessionId: match[1], role: match[2], instanceId: match[3] };
}

export function createRuntimePortHub({
  onFrame = async () => ({ ok: false, error: 'unsupported_frame' }),
  onCircuitState = () => {},
  timeoutMs = 1500,
  failureThreshold = 2,
  cooldownMs = 3000,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  const ports = new Map();
  const pending = new Map();
  const circuits = new Map();
  let requestSequence = 0;
  const keyFor = (sessionId, role) => `${sessionId}\u0000${role}`;
  const circuitFor = (sessionId, role) => {
    const key = keyFor(sessionId, role);
    if (!circuits.has(key)) circuits.set(key, new TransportCircuit({}, { failureThreshold, cooldownMs, now }));
    return circuits.get(key);
  };
  const publishCircuit = (identity, circuit) => {
    try {
      onCircuitState({
        sessionId: identity.sessionId,
        role: identity.role,
        instanceId: identity.instanceId || '',
        tabId: Number.isInteger(identity.tabId) ? identity.tabId : null,
        ...circuit.snapshot()
      });
    } catch {}
  };

  function rejectForPort(entry, reason = 'port_disconnected') {
    for (const [requestId, item] of pending) {
      if (item.entry !== entry) continue;
      clearTimer(item.timer);
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
    const circuit = circuitFor(identity.sessionId, identity.role);
    if (circuit.snapshot().state === 'open') circuit.beginProbe(now(), { force: true });
    publishCircuit(identity, circuit);

    port.onMessage.addListener(frame => {
      if (frame?.type === 'response' && frame.requestId) {
        const item = pending.get(String(frame.requestId));
        if (!item || item.entry !== entry) return;
        clearTimer(item.timer);
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
    const circuit = circuitFor(sessionId, role);
    if (!circuit.canAttemptDirect(now())) {
      circuit.markFallback('port_circuit_open', now());
      publishCircuit(entry, circuit);
      throw new Error('port_circuit_open');
    }
    if (circuit.snapshot().state === 'open') circuit.beginProbe(now());
    const requestId = `hub-${now()}-${++requestSequence}`;
    const startedAt = Number(now());
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimer(() => {
          pending.delete(requestId);
          reject(new Error('port_request_timeout'));
        }, Math.max(100, Number(timeout) || timeoutMs));
        pending.set(requestId, { entry, resolve, reject, timer });
        try {
          entry.port.postMessage({ ...frame, type: 'request', requestId, operation: frame.operation });
        } catch (error) {
          clearTimer(timer);
          pending.delete(requestId);
          reject(error);
        }
      });
      circuit.recordSuccess(Math.max(0, Number(now()) - startedAt), now());
      publishCircuit(entry, circuit);
      return result;
    } catch (error) {
      const reason = String(error?.message || error);
      if (reason === 'port_replaced') circuit.beginProbe(now(), { force: true });
      else circuit.recordFailure(reason, now());
      publishCircuit(entry, circuit);
      throw error;
    }
  }

  function noteFallback(sessionId, role, reason = 'direct_port_unavailable') {
    const circuit = circuitFor(sessionId, role);
    circuit.markFallback(reason, now());
    publishCircuit({ sessionId, role, instanceId: get(sessionId, role)?.instanceId || '', tabId: get(sessionId, role)?.tabId }, circuit);
    return circuit.snapshot();
  }

  function getTransportState(sessionId, role) {
    return circuitFor(sessionId, role).snapshot();
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

  return { connect, get, has, request, noteFallback, getTransportState, snapshot };
}
