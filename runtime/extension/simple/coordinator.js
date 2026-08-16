import { fanOutTurn } from './fanout.js';
import { createRoleQueue } from './role-queue.js';
import { isSuccessfulRoleResult, roleDeliveryKey } from './protocol.js';

export function createSimpleCoordinator({ unresolvedStore, onStage = () => {} } = {}) {
  const sessions = new Map();
  const store = unresolvedStore || { put:async () => {}, remove:async () => {} };

  function register({ sessionId, role, provider, deliver } = {}) {
    if (!sessionId || !['receiver','comparison'].includes(role) || typeof deliver !== 'function') return false;
    if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
    const queue = createRoleQueue({ role, deliverOne:deliver, onStage });
    sessions.get(sessionId).set(role, { provider, queue });
    return true;
  }

  async function deliverRole(sessionId, role, turn) {
    const registration = sessions.get(sessionId)?.get(role);
    if (!registration) return { role, stage:'failed', reason:'role_missing' };
    const result = { provider:registration.provider, ...(await registration.queue.push(turn)) };
    const key = roleDeliveryKey(turn, role);
    if (isSuccessfulRoleResult(result)) await store.remove(key);
    else await store.put(key, { role, turn });
    return result;
  }

  async function dispatchTurn(turn) {
    const roles = ['receiver','comparison'].filter(role => sessions.get(turn.sessionId)?.has(role));
    return fanOutTurn({ turn, roles, deliver:(role, value) => deliverRole(value.sessionId, role, value) });
  }

  async function retryRole(sessionId, role) {
    if (typeof store.list !== 'function' || !sessions.get(sessionId)?.has(role)) return [];
    const prefix = `${sessionId}:`;
    const values = await store.list();
    const matches = values
      .filter(([key, value]) => key.startsWith(prefix) && value?.role === role && value?.turn?.sessionId === sessionId)
      .map(([, value]) => value.turn);
    const results = [];
    for (const turn of matches) results.push(await deliverRole(sessionId, role, turn));
    return results;
  }

  let bootCounter = 0;
  function dispatchBoot({ sessionId, text } = {}) {
    bootCounter += 1;
    return dispatchTurn(Object.freeze({
      sessionId:String(sessionId || '').trim(),
      turnId:`boot:${bootCounter}`,
      text:String(text ?? '').trim(),
      kind:'boot'
    }));
  }

  return {
    register,
    unregister(sessionId, role) { return sessions.get(sessionId)?.delete(role) || false; },
    dispatchTurn,
    dispatchBoot,
    retryRole,
    snapshot(sessionId) {
      return Object.fromEntries([...sessions.get(sessionId)?.entries() || []]
        .map(([role, value]) => [role, { provider:value.provider, ...value.queue.snapshot() }]));
    }
  };
}
