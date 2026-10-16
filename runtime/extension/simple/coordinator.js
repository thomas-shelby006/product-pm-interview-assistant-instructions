import { fanOutTurn } from './fanout.js';
import { createRoleQueue } from './role-queue.js';
import { isSuccessfulRoleResult, roleDeliveryKey } from './protocol.js';

export function createSimpleCoordinator({ unresolvedStore, acceptedStore, onStage = () => {} } = {}) {
  const sessions = new Map();
  const expected = new Map();
  const admissions = new Map();
  const accepted = acceptedStore || { has:async () => false, add:async () => {} };
  const store = unresolvedStore || { put:async () => {}, remove:async () => {} };

  function configure(sessionId, roles) {
    expected.set(sessionId, [...new Set((roles || []).filter(role => ['receiver','comparison'].includes(role)))]);
  }
  function register({ sessionId, role, provider, deliver } = {}) {
    if (!sessionId || !['receiver','comparison'].includes(role) || typeof deliver !== 'function') return false;
    if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
    sessions.get(sessionId).set(role, {
      provider, deliver,
      queue:createRoleQueue({ role, deliverOne:deliver, onStage })
    });
    return true;
  }
  async function checkpoint(turn, roles) {
    await Promise.all(roles.map(role => store.put(roleDeliveryKey(turn, role), { role, turn, state:'pending' })));
  }
  async function deliverRole(sessionId, role, turn) {
    const key = roleDeliveryKey(turn, role);
    const registration = sessions.get(sessionId)?.get(role);
    if (!registration) return { role, stage:'failed', reason:'role_missing' };
    await store.put(key, { role, turn, state:'attempting' });
    const result = { provider:registration.provider, ...(await registration.queue.push(turn)) };
    if (isSuccessfulRoleResult(result)) await store.remove(key);
    else {
      const safeRetry = ['composer_write_failed','submit_unavailable','invalid_delivery','role_missing'].includes(result.reason);
      await store.put(key, { role, turn, state:safeRetry ? 'pending' : 'uncertain' });
    }
    return result;
  }
  async function dispatchTurn(turn, { prepared = false } = {}) {
    const roles = expected.get(turn.sessionId) || [...(sessions.get(turn.sessionId)?.keys() || [])];
    if (!prepared) await checkpoint(turn, roles);
    return fanOutTurn({ turn, roles, deliver:(role, value) => deliverRole(value.sessionId, role, value) });
  }
  async function acceptTurn(turn, onDelivered = () => {}) {
    const key = `${turn.sessionId}:${turn.turnId}`;
    if (admissions.has(key)) return admissions.get(key);
    const work = (async () => {
      const roles = expected.get(turn.sessionId) || [...(sessions.get(turn.sessionId)?.keys() || [])];
      if (!roles.length) return { accepted:false, reason:'no_answer_roles' };
      if (await accepted.has(key)) return { accepted:true, duplicate:true };
      await checkpoint(turn, roles);
      await accepted.add(key);
      onStage({ sessionId:turn.sessionId, turnId:turn.turnId, role:'system', stage:'fanout' });
      void dispatchTurn(turn, { prepared:true }).then(onDelivered).catch(error =>
        onStage({ sessionId:turn.sessionId, turnId:turn.turnId, role:'system', stage:'failed', reason:String(error?.message || error) }));
      return { accepted:true };
    })();
    admissions.set(key, work);
    try { return await work; }
    finally { admissions.delete(key); }
  }
  async function retryRole(sessionId, role) {
    if (typeof store.list !== 'function' || !sessions.get(sessionId)?.has(role)) return [];
    const values = await store.list();
    const turns = values.filter(([key, item]) =>
      key.startsWith(`${sessionId}:`) && item?.role === role
      && item?.turn?.sessionId === sessionId && (!item.state || item.state === 'pending'))
      .map(([, item]) => item.turn);
    const results = [];
    for (const turn of turns) results.push(await deliverRole(sessionId, role, turn));
    return results;
  }
  let bootCounter = 0;
  function dispatchBoot({ sessionId, text } = {}) {
    return dispatchTurn(Object.freeze({
      sessionId:String(sessionId || '').trim(),
      turnId:`boot:${++bootCounter}`,
      text:String(text ?? '').trim(), kind:'boot'
    }));
  }
  return {
    configure, register,
    unregister(sessionId, role) { return sessions.get(sessionId)?.delete(role) || false; },
    dispatchTurn, acceptTurn, dispatchBoot, retryRole,
    snapshot(sessionId) {
      return Object.fromEntries([...(sessions.get(sessionId)?.entries() || [])]
        .map(([role, item]) => [role, { provider:item.provider, ...item.queue.snapshot() }]));
    }
  };
}
