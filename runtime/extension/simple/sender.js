function keyFor(turn, index = 0) {
  const id = String(turn?.id || '').trim();
  return id ? `id:${id}` : `text:${String(turn?.text || '').trim()}:${index}`;
}

export function createSimpleSender({
  readTurns, onTurn, maxSeen = 500, initialSeen = [],
  onSeenChange = () => {}, onRetry = () => {}
} = {}) {
  if (typeof readTurns !== 'function' || typeof onTurn !== 'function') throw new TypeError('readTurns and onTurn are required');
  const seen = new Map();
  const pending = new Set();
  for (const key of Array.from(initialSeen || []).slice(-maxSeen)) {
    if (String(key || '').trim()) seen.set(key, Date.now());
  }
  const remember = key => {
    if (seen.has(key)) return;
    seen.set(key, Date.now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
    onSeenChange([...seen.keys()]);
  };
  function prime() {
    const turns = Array.from(readTurns() || []);
    turns.forEach((turn, index) => remember(keyFor(turn, index)));
    return turns.length;
  }
  async function scan() {
    const turns = Array.from(readTurns() || []);
    const tasks = [];
    turns.forEach((turn, index) => {
      const text = String(turn?.text || '').trim();
      const key = keyFor(turn, index);
      if (!text || seen.has(key) || pending.has(key)) return;
      pending.add(key);
      tasks.push(Promise.resolve().then(() => onTurn({ id:String(turn?.id || key), text }))
        .then(accepted => {
          if (accepted === false) throw new Error('turn_not_accepted');
          remember(key);
        }).catch(() => onRetry()).finally(() => pending.delete(key)));
    });
    await Promise.allSettled(tasks);
    return tasks.length;
  }
  return { prime, scan, snapshot:() => ({ seen:seen.size, pending:pending.size, seenKeys:[...seen.keys()] }) };
}
