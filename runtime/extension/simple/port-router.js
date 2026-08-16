export function createSimplePortRouter({ coordinator, requestTimeoutMs = 10000, onStage = () => {}, onRegister = () => {} } = {}) {
  if (!coordinator) throw new TypeError('coordinator is required');
  const pending = new Map();
  const registrations = new Map();
  let requestSeq = 0;

  function request(port, role, turn) {
    const requestId = `${turn.sessionId}:${role}:${++requestSeq}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ role, stage:'failed', reason:'delivery_timeout' });
      }, requestTimeoutMs);
      pending.set(requestId, result => {
        clearTimeout(timer);
        pending.delete(requestId);
        resolve({ role, ...result });
      });
      port.postMessage({ type:'deliver', requestId, turn });
    });
  }

  function attach(port) {
    port.onMessage.addListener(message => {
      if (message?.type === 'delivery_result' && pending.has(message.requestId)) {
        pending.get(message.requestId)(message.result || { stage:'failed', reason:'empty_result' });
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
          port.postMessage({ type:'turn_result', turnId:message.turn.turnId, results });
        });
      }
    });
    port.onDisconnect?.addListener?.(() => {
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
