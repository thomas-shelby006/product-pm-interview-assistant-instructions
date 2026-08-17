export function createSimplePortRouter({ coordinator, onStage = () => {}, onRegister = () => {} } = {}) {
  if (!coordinator) throw new TypeError('coordinator is required');
  const pending = new Map();
  const registrations = new Map();
  let requestSeq = 0;

  function request(port, role, turn) {
    const requestId = `${turn.sessionId}:${role}:${++requestSeq}`;
    return new Promise(resolve => {
      pending.set(requestId, { port, role, resolve });
      try { port.postMessage({ type:'deliver', requestId, turn }); }
      catch {
        pending.delete(requestId);
        resolve({ role, stage:'failed', reason:'disconnected' });
      }
    });
  }

  function resolvePending(requestId, result) {
    const item = pending.get(requestId);
    if (!item) return false;
    pending.delete(requestId);
    item.resolve({ role:item.role, ...result });
    return true;
  }

  function failPort(port) {
    for (const [requestId, item] of pending) {
      if (item.port !== port) continue;
      resolvePending(requestId, { stage:'failed', reason:'disconnected' });
    }
  }
  function attach(port) {
    port.onMessage.addListener(message => {
      if (message?.type === 'delivery_result') {
        resolvePending(message.requestId, message.result || { stage:'failed', reason:'empty_result' });
        return;
      }
      if (message?.type === 'stage') {
        onStage(message);
        return;
      }
      if (message?.type === 'register') {
        const registration = {
          sessionId:String(message.sessionId || '').trim(),
          role:String(message.role || '').trim(),
          provider:String(message.provider || '').trim()
        };
        registrations.set(port, registration);
        if (['receiver','comparison'].includes(registration.role)) {
          coordinator.register({ ...registration, deliver:turn => request(port, registration.role, turn) });
        }
        onRegister({ ...registration, port });
        return;
      }
      if (message?.type === 'turn' && message.turn) {
        void coordinator.dispatchTurn(message.turn).then(results => {
          try { port.postMessage({ type:'turn_result', turnId:message.turn.turnId, results }); } catch {}
        });
      }
    });

    port.onDisconnect?.addListener?.(() => {
      failPort(port);
      const registration = registrations.get(port);
      if (registration && ['receiver','comparison'].includes(registration.role)) {
        coordinator.unregister(registration.sessionId, registration.role);
      }
      registrations.delete(port);
    });
    return port;
  }

  return { attach, snapshot:() => ({ pending:pending.size, connections:registrations.size }) };
}
