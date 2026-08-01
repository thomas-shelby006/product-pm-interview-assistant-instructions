export class SelectorProbeRegistry {
  #probes = new Map();
  register(surface, selectors = []) {
    const key = String(surface || '');
    const values = [...new Set((Array.isArray(selectors) ? selectors : [selectors]).map(String).filter(Boolean))];
    if (!key || !values.length) return { ok: false, error: 'selector_probe_invalid' };
    this.#probes.set(key, values);
    return { ok: true, surface: key, selectors: [...values] };
  }
  probe(surface, query) {
    const selectors = this.#probes.get(String(surface || '')) || [];
    const attempts = [];
    for (const selector of selectors) {
      let node = null; let error = '';
      try { node = query(selector); } catch (cause) { error = String(cause?.message || cause); }
      const found = Boolean(node);
      attempts.push({ selector, found, error });
      if (found) return { ok: true, surface: String(surface), selector, node, attempts };
    }
    return { ok: false, surface: String(surface), selector: '', node: null, attempts };
  }
  snapshot() { return Object.fromEntries([...this.#probes.entries()].map(([key, values]) => [key, [...values]])); }
}
