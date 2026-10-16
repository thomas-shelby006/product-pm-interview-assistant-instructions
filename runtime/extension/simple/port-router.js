import { makeTurn } from './protocol.js';

export function createSimplePortRouter({ coordinator, onStage = () => {}, onRegister = () => {}, beforeTurn = async () => {} } = {}) {
  if (!coordinator) throw new TypeError('coordinator is required');
  const pending = new Map();
  const registrations = new Map();
  const currentOwners = new Map();
  let requestSeq = 0;
  const keyFor = value => `${value.sessionId}:${value.role}`;

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
  function resolvePending(requestId, result, port) {
    const item = pending.get(requestId);
    if (!item || item.port !== port) return false;
    pending.delete(requestId);
    item.resolve({ role:item.role, ...result });
    return true;
  }
  function attach(port) {
    port.onMessage.addListener(message => {
      if (message?.type === 'delivery_result') {
        resolvePending(message.requestId, message.result || { stage:'failed', reason:'empty_result' }, port);
        return;
      }
      const registration = registrations.get(port);
      if (message?.type === 'register') {
        const value = {
          sessionId:String(message.sessionId || '').trim(),
          role:String(message.role || '').trim(),
          provider:String(message.provider || '').trim()
        };
        if (!value.sessionId || !['sender','receiver','comparison'].includes(value.role)
          || !['chatgpt','claude'].includes(value.provider)) return;
        const key = keyFor(value);
        const prior = currentOwners.get(key);
        if (prior && prior !== port) {
          for (const [id, item] of pending) {
            if (item.port === prior) {
              pending.delete(id);
              item.resolve({ role:item.role, stage:'failed', reason:'disconnected' });
            }
          }
        }
        currentOwners.set(key, port);
        registrations.set(port, value);
        if (value.role !== 'sender') coordinator.register({ ...value, deliver:turn => request(port, value.role, turn) });
        onRegister({ ...value, port });
        return;
      }
      if (!registration || currentOwners.get(keyFor(registration)) !== port) return;
      if (message?.type === 'stage') {
        if (message.sessionId === registration.sessionId && message.role === registration.role) onStage(message);
        return;
      }
      if (message?.type === 'turn' && message.turn && registration.role === 'sender') {
        void (async () => {
          try {
            await beforeTurn(registration.sessionId);
            const turn = makeTurn(message.turn);
            if (turn.sessionId !== registration.sessionId) throw new Error('session_mismatch');
            const receipt = await coordinator.acceptTurn(turn, results => {
              try { port.postMessage({ type:'turn_result', turnId:turn.turnId, results }); } catch {}
            });
            port.postMessage({ type:'turn_accepted', turnId:turn.turnId, ...receipt });
          } catch (error) {
            try { port.postMessage({ type:'turn_accepted', turnId:message.turn?.turnId, accepted:false, reason:String(error?.message || error) }); } catch {}
          }
        })();
      }
    });
    port.onDisconnect?.addListener?.(() => {
      for (const [id, item] of pending) {
        if (item.port !== port) continue;
        pending.delete(id);
        item.resolve({ role:item.role, stage:'failed', reason:'disconnected' });
      }
      const registration = registrations.get(port);
      if (registration && currentOwners.get(keyFor(registration)) === port) {
        currentOwners.delete(keyFor(registration));
        if (registration.role !== 'sender') coordinator.unregister(registration.sessionId, registration.role);
      }
      registrations.delete(port);
    });
    return port;
  }
  return { attach, snapshot:() => ({ pending:pending.size, connections:currentOwners.size }) };
}
