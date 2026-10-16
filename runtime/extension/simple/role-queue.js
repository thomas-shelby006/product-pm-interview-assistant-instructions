import { roleDeliveryKey } from './protocol.js';

export function createRoleQueue({ role, deliverOne, onStage = () => {} } = {}) {
  if (!role || typeof deliverOne !== 'function') throw new TypeError('role and deliverOne are required');
  let chain = Promise.resolve();
  let pending = 0;
  const terminal = new Map();
  const inFlight = new Map();
  async function run(turn) {
    const key = roleDeliveryKey(turn, role);
    if (terminal.has(key)) return { ...terminal.get(key), duplicate:true };
    pending += 1;
    onStage({ role, turnId:turn.turnId, stage:'queued' });
    try {
      const normalized = { role, ...(await deliverOne(turn)) };
      if (normalized.stage === 'rendered') terminal.set(key, normalized);
      else onStage({ ...normalized, turnId:turn.turnId });
      return normalized;
    } catch (error) {
      const result = { role, stage:'failed', reason:String(error?.message || error) };
      onStage({ ...result, turnId:turn.turnId });
      return result;
    } finally { pending -= 1; }
  }
  return {
    push(turn) {
      const key = roleDeliveryKey(turn, role);
      if (terminal.has(key)) return Promise.resolve({ ...terminal.get(key), duplicate:true });
      if (inFlight.has(key)) return inFlight.get(key);
      const next = chain.then(() => run(turn));
      inFlight.set(key, next);
      chain = next.catch(() => {}).finally(() => { if (inFlight.get(key) === next) inFlight.delete(key); });
      return next;
    },
    snapshot() { return { role, pending, completed:terminal.size }; }
  };
}
