export function normalizeLayoutHistory(values = []) {
  return (Array.isArray(values) ? values : []).map(value => ({
    mode: String(value?.mode || 'three_window'),
    focusedRole: String(value?.focusedRole || ''),
    at: Math.max(0, Number(value?.at || 0))
  })).filter(value => ['three_window','sender_dashboard','receiver_dashboard','dashboard_only'].includes(value.mode)).slice(-12);
}

export function pushLayoutHistory(values = [], value = {}, now = Date.now()) {
  const history = normalizeLayoutHistory(values);
  const next = { mode: String(value.mode || 'three_window'), focusedRole: String(value.focusedRole || ''), at: now };
  const last = history.at(-1);
  if (!last || last.mode !== next.mode || last.focusedRole !== next.focusedRole) history.push(next);
  return history.slice(-12);
}

export function popLayoutHistory(values = []) {
  const history = normalizeLayoutHistory(values);
  const value = history.pop() || null;
  return { value, history };
}
