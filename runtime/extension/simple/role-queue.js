import { roleDeliveryKey } from './protocol.js';

export function createRoleQueue({ role, deliverOne, onStage = () => {} } = {}) {
  if (!role) throw new TypeError('role is required');
  if (typeof deliverOne !== 'function') throw new TypeError('deliverOne is required');

  let chain = Promise.resolve();
  let pending = 0;
  const terminal = new Map();

  async function run(turn) {
    const key = roleDeliveryKey(turn, role);
    if (terminal.has(key)) return { ...terminal.get(key), duplicate: true };
    pending += 1;
    onStage({ role, turnId: turn.turnId, stage: 'queued' });
    try {
      const result = await deliverOne(turn);
      const normalized = { role, ...result };
      if (normalized.stage === 'rendered') terminal.set(key, normalized);
      else onStage({ ...normalized, turnId: turn.turnId });
      return normalized;
    } catch (error) {
      const result = { role, stage: 'failed', reason: String(error?.message || error) };
      onStage({ ...result, turnId: turn.turnId });
      return result;
    } finally {
      pending -= 1;
    }
  }

  return {
    push(turn) {
      const key = roleDeliveryKey(turn, role);
      if (terminal.has(key)) return Promise.resolve({ ...terminal.get(key), duplicate: true });
      const next = chain.then(() => run(turn));
      chain = next.catch(() => {});
      return next;
    },
    snapshot() { return { role, pending, completed: terminal.size }; }
  };
}
