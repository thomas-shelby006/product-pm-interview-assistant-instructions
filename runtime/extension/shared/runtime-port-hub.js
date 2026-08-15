import { TransportCircuit } from './transport-circuit.js';
import {
  createTransportHandshake,
  negotiateTransportHandshake,
  validateTransportFrame,
  withTransportProtocol
} from './transport-protocol.js';
import { RequestCorrelationJournal } from './request-correlation-journal.js';
import { chooseTransportLane, deriveTransportLaneScore } from './transport-lane-score.js';

export function rolePortName(sessionId, role, instanceId) {
  return `pmia-role:${String(sessionId)}:${String(role)}:${String(instanceId)}`;
}

export function parseRolePortName(name) {
  const match = /^pmia-role:([^:]+):(sender|receiver|comparison):(.+)$/.exec(String(name || ''));
  if (!match) return null;
  return { sessionId: match[1], role: match[2], instanceId: match[3] };
}

export function createRuntimePortHub({
  onFrame = async () => ({ ok: false, error: 'unsupported_frame' }),
  onCircuitState = () => {},
  timeoutMs = 1500,
  handshakeTimeoutMs = 800,
  failureThreshold = 2,
  cooldownMs = 3000,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  const ports = new Map();
  const pending = new Map();
  const circuits = new Map();
  const epochs = new Map();
  const outboundJournal = new RequestCorrelationJournal({ maxEntries: 512 });
  let requestSequence = 0;
  const keyFor = (sessionId, role) => `${sessionId}\u0000${role}`;
  const circuitFor = (sessionId, role) => {
    const key = keyFor(sessionId, role);
    if (!circuits.has(key)) circuits.set(key, new TransportCircuit({}, { failureThreshold, cooldownMs, now }));
    return circuits.get(key);
  };
  const publishCircuit = (identity, circuit, protocol = null) => {
    try {
      const lane = chooseTransportLane(circuit.snapshot());
      onCircuitState({
        sessionId: identity.sessionId,
        role: identity.role,
        instanceId: identity.instanceId || '',
        tabId: Number.isInteger(identity.tabId) ? identity.tabId : null,
        protocolVersion: Number(protocol?.version || 0),
        epoch: Number(protocol?.epoch || 0),
        capabilities: Array.isArray(protocol?.capabilities) ? [...protocol.capabilities] : [],
        handshakeReady: Boolean(protocol),
        score: lane.direct.score,
        scoreState: lane.direct.state,
        preferredMode: lane.mode,
        scoreReason: lane.direct.reason,
        ...circuit.snapshot()
      });
    } catch {}
  };

  function rejectForPort(entry, reason = 'port_disconnected') {
    for (const [requestId, item] of pending) {
      if (item.entry !== entry) continue;
      clearTimer(item.timer);
      pending.delete(requestId);
      outboundJournal.fail(requestId, reason, now());
      item.reject(new Error(reason));
    }
  }

  function settleHandshake(entry, result) {
    if (entry.handshakeSettled) return;
    entry.handshakeSettled = true;
    clearTimer(entry.handshakeTimer);
    entry.handshakeTimer = null;
    if (result?.ok) entry.handshakeResolve(result);
    else entry.handshakeReject(new Error(result?.error || 'transport_handshake_failed'));
  }

  function sendResponse(entry, requestId, result) {
    try {
      entry.port.postMessage(withTransportProtocol({ type: 'response', requestId, result }, entry.protocol));
      return true;
    } catch {
      return false;
    }
  }

  function connect(port) {
    const identity = parseRolePortName(port?.name);
    if (!identity) return false;
    const key = keyFor(identity.sessionId, identity.role);
    const previous = ports.get(key);
    if (previous && previous.port !== port) {
      settleHandshake(previous, { ok: false, error: 'port_replaced' });
      rejectForPort(previous, 'port_replaced');
    }
    const epoch = Math.max(0, Number(epochs.get(key) || 0)) + 1;
    epochs.set(key, epoch);
    let handshakeResolve;
    let handshakeReject;
    const handshakePromise = new Promise((resolve, reject) => {
      handshakeResolve = resolve;
      handshakeReject = reject;
    });
    handshakePromise.catch(() => {});
    const entry = {
      ...identity,
      port,
      tabId: Number.isInteger(port.sender?.tab?.id) ? port.sender.tab.id : null,
      windowId: Number.isInteger(port.sender?.tab?.windowId) ? port.sender.tab.windowId : null,
      connectedAt: Number(now()),
      epoch,
      protocol: null,
      localHandshake: createTransportHandshake(identity),
      inboundJournal: new RequestCorrelationJournal({ maxEntries: 256 }),
      handshakePromise,
      handshakeResolve,
      handshakeReject,
      handshakeSettled: false,
      handshakeTimer: null
    };
    ports.set(key, entry);
    const circuit = circuitFor(identity.sessionId, identity.role);
    if (circuit.snapshot().state === 'open') circuit.beginProbe(now(), { force: true });
    publishCircuit(identity, circuit, null);

    entry.handshakeTimer = setTimer(() => {
      settleHandshake(entry, { ok: false, error: 'transport_handshake_timeout' });
    }, Math.max(200, Number(handshakeTimeoutMs) || 800));

    port.onMessage.addListener(frame => {
      if (frame?.type === 'transport_handshake_accept') {
        const negotiated = negotiateTransportHandshake(entry.localHandshake, frame.handshake, { epoch: entry.epoch });
        if (!negotiated.ok) {
          settleHandshake(entry, negotiated);
          try { port.postMessage({ type: 'transport_handshake_result', ...negotiated }); } catch {}
          return;
        }
        entry.protocol = negotiated.identity;
        settleHandshake(entry, negotiated);
        try {
          port.postMessage({
            type: 'transport_handshake_result',
            ok: true,
            protocol: entry.protocol,
            capabilities: negotiated.capabilities
          });
        } catch {}
        publishCircuit(entry, circuit, entry.protocol);
        return;
      }

      if (frame?.type === 'response' && frame.requestId) {
        if (!entry.protocol || !validateTransportFrame(frame, entry.protocol).ok) return;
        const accepted = outboundJournal.acceptResponse(String(frame.requestId), entry.epoch);
        if (!accepted.accepted) return;
        const item = pending.get(String(frame.requestId));
        if (!item || item.entry !== entry) return;
        clearTimer(item.timer);
        pending.delete(String(frame.requestId));
        outboundJournal.complete(String(frame.requestId), frame.result, now());
        item.resolve(frame.result);
        return;
      }

      if (frame?.type !== 'request' || !frame.requestId || !entry.protocol) return;
      const validation = validateTransportFrame(frame, entry.protocol);
      if (!validation.ok) {
        sendResponse(entry, frame.requestId, { ok: false, error: validation.error });
        return;
      }
      const started = entry.inboundJournal.begin(String(frame.requestId), {
        epoch: entry.epoch,
        operation: frame.operation,
        now: now()
      });
      if (!started.accepted) {
        const replay = entry.inboundJournal.result(String(frame.requestId), entry.epoch);
        if (replay !== null) sendResponse(entry, frame.requestId, { ...replay, replayed: true });
        else if (started.reason === 'request_pending') sendResponse(entry, frame.requestId, { ok:false, error:'request_pending', retryable:true, retryAfterMs:Math.max(50,Math.min(1000,Number(timeoutMs)||1500)) });
        else sendResponse(entry, frame.requestId, { ok:false, error:started.reason || 'request_rejected', retryable:false });
        return;
      }
      Promise.resolve(onFrame({ ...frame, identity, tabId: entry.tabId, port, protocol: entry.protocol }))
        .then(result => {
          entry.inboundJournal.complete(String(frame.requestId), result, now());
          sendResponse(entry, frame.requestId, result);
        })
        .catch(error => {
          const result = { ok: false, error: String(error?.message || error) };
          entry.inboundJournal.complete(String(frame.requestId), result, now());
          sendResponse(entry, frame.requestId, result);
        });
    });

    port.onDisconnect.addListener(() => {
      if (ports.get(key)?.port === port) ports.delete(key);
      settleHandshake(entry, { ok: false, error: 'port_disconnected' });
      rejectForPort(entry);
    });

    try {
      port.postMessage({
        type: 'transport_handshake_offer',
        handshake: entry.localHandshake,
        epoch: entry.epoch
      });
    } catch {
      settleHandshake(entry, { ok: false, error: 'transport_handshake_send_failed' });
    }
    return true;
  }

  function get(sessionId, role) {
    return ports.get(keyFor(sessionId, role)) || null;
  }

  function has(sessionId, role) {
    return Boolean(get(sessionId, role));
  }

  async function readyEntry(sessionId, role, timeout = handshakeTimeoutMs) {
    const entry = get(sessionId, role);
    if (!entry) throw new Error(`${role}_port_missing`);
    if (entry.protocol) return entry;
    let timer;
    try {
      await Promise.race([
        entry.handshakePromise,
        new Promise((_, reject) => {
          timer = setTimer(() => reject(new Error('transport_handshake_timeout')), Math.max(100, Number(timeout) || handshakeTimeoutMs));
        })
      ]);
    } finally {
      if (timer) clearTimer(timer);
    }
    if (!entry.protocol) throw new Error('transport_handshake_incomplete');
    return entry;
  }

  async function request(sessionId, role, frame, { timeout = timeoutMs } = {}) {
    const entry = await readyEntry(sessionId, role, Math.min(Number(timeout) || timeoutMs, handshakeTimeoutMs));
    const circuit = circuitFor(sessionId, role);
    const laneDecision = chooseTransportLane(circuit.snapshot());
    if (laneDecision.mode !== 'direct') {
      circuit.markFallback('direct_lane_degraded', now());
      publishCircuit(entry, circuit, entry.protocol);
      throw new Error('direct_lane_degraded');
    }
    if (!circuit.canAttemptDirect(now())) {
      circuit.markFallback('port_circuit_open', now());
      publishCircuit(entry, circuit, entry.protocol);
      throw new Error('port_circuit_open');
    }
    if (circuit.snapshot().state === 'open') circuit.beginProbe(now());
    const requestId = `hub-${now()}-${++requestSequence}`;
    const startedAt = Number(now());
    outboundJournal.begin(requestId, { epoch: entry.epoch, operation: frame.operation, now: startedAt });
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimer(() => {
          pending.delete(requestId);
          outboundJournal.fail(requestId, 'port_request_timeout', now());
          reject(new Error('port_request_timeout'));
        }, Math.max(100, Number(timeout) || timeoutMs));
        pending.set(requestId, { entry, resolve, reject, timer });
        try {
          entry.port.postMessage(withTransportProtocol({
            ...frame,
            type: 'request',
            requestId,
            operation: frame.operation
          }, entry.protocol));
        } catch (error) {
          clearTimer(timer);
          pending.delete(requestId);
          outboundJournal.fail(requestId, error, now());
          reject(error);
        }
      });
      circuit.recordSuccess(Math.max(0, Number(now()) - startedAt), now());
      publishCircuit(entry, circuit, entry.protocol);
      return result;
    } catch (error) {
      const reason = String(error?.message || error);
      if (reason === 'port_replaced') circuit.beginProbe(now(), { force: true });
      else circuit.recordFailure(reason, now());
      publishCircuit(entry, circuit, entry.protocol);
      throw error;
    }
  }

  function noteFallback(sessionId, role, reason = 'direct_port_unavailable') {
    const circuit = circuitFor(sessionId, role);
    circuit.markFallback(reason, now());
    const entry = get(sessionId, role);
    publishCircuit({ sessionId, role, instanceId: entry?.instanceId || '', tabId: entry?.tabId }, circuit, entry?.protocol || null);
    return circuit.snapshot();
  }

  function getTransportState(sessionId, role) {
    const entry = get(sessionId, role);
    const circuitState = circuitFor(sessionId, role).snapshot();
    const lane = deriveTransportLaneScore(circuitState);
    return {
      ...circuitState,
      score: lane.score,
      scoreState: lane.state,
      preferredMode: lane.score >= 35 ? 'direct' : 'fallback',
      scoreReason: lane.reason,
      protocolVersion: Number(entry?.protocol?.version || 0),
      epoch: Number(entry?.protocol?.epoch || entry?.epoch || 0),
      capabilities: [...(entry?.protocol?.capabilities || [])],
      handshakeReady: Boolean(entry?.protocol)
    };
  }

  function snapshot() {
    return [...ports.values()].map(entry => ({
      sessionId: entry.sessionId,
      role: entry.role,
      instanceId: entry.instanceId,
      tabId: entry.tabId,
      windowId: entry.windowId,
      connectedAt: entry.connectedAt,
      protocolVersion: Number(entry.protocol?.version || 0),
      epoch: Number(entry.protocol?.epoch || entry.epoch || 0),
      capabilities: [...(entry.protocol?.capabilities || [])],
      handshakeReady: Boolean(entry.protocol)
    }));
  }

  return { connect, get, has, request, noteFallback, getTransportState, snapshot };
}