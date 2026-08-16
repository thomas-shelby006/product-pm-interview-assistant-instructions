export async function fanOutTurn({ turn, roles = [], deliver } = {}) {
  if (typeof deliver !== 'function') throw new TypeError('deliver is required');
  const uniqueRoles = [...new Set(roles.map(role => String(role || '').trim()).filter(Boolean))];
  const pending = uniqueRoles.map(role => Promise.resolve()
    .then(() => deliver(role, turn))
    .catch(error => ({ role, stage: 'failed', reason: String(error?.message || error) }))
    .then(result => [role, result]));
  return Object.fromEntries(await Promise.all(pending));
}
