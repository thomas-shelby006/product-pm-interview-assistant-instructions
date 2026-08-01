function hash(value) { let h = 2166136261; for (const char of String(value || '')) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

export function createReproducibilitySeed(value = '') {
  const seed = hash(value || 'pmia');
  return { seed, text: seed.toString(16).padStart(8, '0') };
}

export function createSeededRandom(seedValue = 1) {
  let state = Number(seedValue) >>> 0 || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}

export function seededShuffle(values = [], seed = 1) {
  const list = Array.isArray(values) ? values.slice() : [];
  const random = createSeededRandom(seed);
  for (let index = list.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [list[index], list[other]] = [list[other], list[index]]; }
  return list;
}
