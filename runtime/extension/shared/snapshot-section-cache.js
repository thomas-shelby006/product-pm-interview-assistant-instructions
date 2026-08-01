import { canonicalFingerprint } from './canonical-fingerprint.js';

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

export class SnapshotSectionCache {
  #volatileKeys;
  #fingerprints = new Map();
  #sections = new Map();

  constructor({ volatileKeys = ['now', 'uptimeMs'] } = {}) {
    this.#volatileKeys = new Set((Array.isArray(volatileKeys) ? volatileKeys : [volatileKeys]).map(String));
  }

  update(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const changedKeys = [];
    const reusedKeys = [];
    const removedKeys = [];
    const snapshot = {};
    const currentKeys = new Set(Object.keys(source));
    for (const key of [...this.#sections.keys()]) {
      if (this.#volatileKeys.has(key) || currentKeys.has(key)) continue;
      this.#sections.delete(key);
      this.#fingerprints.delete(key);
      removedKeys.push(key);
    }
    for (const key of Object.keys(source)) {
      if (this.#volatileKeys.has(key)) {
        snapshot[key] = clone(source[key]);
        continue;
      }
      const fingerprint = canonicalFingerprint(source[key]);
      if (this.#fingerprints.get(key) === fingerprint && this.#sections.has(key)) {
        snapshot[key] = this.#sections.get(key);
        reusedKeys.push(key);
        continue;
      }
      const section = clone(source[key]);
      this.#fingerprints.set(key, fingerprint);
      this.#sections.set(key, section);
      snapshot[key] = section;
      changedKeys.push(key);
    }
    return { snapshot, changedKeys, reusedKeys, removedKeys };
  }

  reset() {
    this.#fingerprints.clear();
    this.#sections.clear();
  }

  stats() {
    return { sections: this.#sections.size, fingerprints: this.#fingerprints.size };
  }
}
