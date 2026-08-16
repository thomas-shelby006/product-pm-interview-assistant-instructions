function keyFor(turn, index = 0) {
  const id = String(turn?.id || '').trim();
  if (id) return `id:${id}`;
  return `text:${String(turn?.text || '').trim()}:${index}`;
}

export function createSimpleSender({ readTurns, onTurn, maxSeen = 500 } = {}) {
  if (typeof readTurns !== 'function') throw new TypeError('readTurns is required');
  if (typeof onTurn !== 'function') throw new TypeError('onTurn is required');
  const seen = new Map();

  const remember = key => {
    seen.set(key, Date.now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
  };

  function prime() {
    const turns = Array.from(readTurns() || []);
    turns.forEach((turn, index) => remember(keyFor(turn, index)));
    return turns.length;
  }

  async function scan() {
    const turns = Array.from(readTurns() || []);
    const pending = [];
    turns.forEach((turn, index) => {
      const text = String(turn?.text || '').trim();
      if (!text) return;
      const key = keyFor(turn, index);
      if (seen.has(key)) return;
      remember(key);
      pending.push(Promise.resolve(onTurn({ id:String(turn?.id || key), text })));
    });
    await Promise.allSettled(pending);
    return pending.length;
  }

  return { prime, scan, snapshot:() => ({ seen:seen.size }) };
}
