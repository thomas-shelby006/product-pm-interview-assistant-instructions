function keyFor(turn, index = 0) {
  const id = String(turn?.id || '').trim();
  if (id) return `id:${id}`;
  return `text:${String(turn?.text || '').trim()}:${index}`;
}

export function createSimpleSender({
  readTurns,
  onTurn,
  maxSeen = 500,
  initialSeen = [],
  onSeenChange = () => {}
} = {}) {
  if (typeof readTurns !== 'function') throw new TypeError('readTurns is required');
  if (typeof onTurn !== 'function') throw new TypeError('onTurn is required');
  const seen = new Map();
  for (const key of Array.from(initialSeen || []).slice(-maxSeen)) {
    const value = String(key || '').trim();
    if (value) seen.set(value, Date.now());
  }

  const notify = () => onSeenChange([...seen.keys()]);
  const remember = key => {
    if (seen.has(key)) return false;
    seen.set(key, Date.now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
    return true;
  };

  function prime() {
    const turns = Array.from(readTurns() || []);
    let changed = false;
    turns.forEach((turn, index) => { changed = remember(keyFor(turn, index)) || changed; });
    if (changed) notify();
    return turns.length;
  }

  async function scan() {
    const turns = Array.from(readTurns() || []);
    const pending = [];
    let changed = false;
    turns.forEach((turn, index) => {
      const text = String(turn?.text || '').trim();
      if (!text) return;
      const key = keyFor(turn, index);
      if (seen.has(key)) return;
      changed = remember(key) || changed;
      pending.push(Promise.resolve(onTurn({ id:String(turn?.id || key), text })));
    });
    if (changed) notify();
    await Promise.allSettled(pending);
    return pending.length;
  }

  return { prime, scan, snapshot:() => ({ seen:seen.size, seenKeys:[...seen.keys()] }) };
}
