import { RuntimePilotState } from './runtime-pilot-state.js';

export function createRuntimePilotStore({
  storageArea,
  key = 'pmia_runtime_pilot_v1'
} = {}) {
  if (!storageArea?.get || !storageArea?.set || !storageArea?.remove) {
    throw new TypeError('PMIA runtime pilot requires chrome.storage.session');
  }
  let statePromise = null;

  return {
    async load() {
      if (!statePromise) {
        statePromise = storageArea.get(key)
          .then(stored => new RuntimePilotState(stored[key] || []))
          .catch(error => {
            statePromise = null;
            throw error;
          });
      }
      return statePromise;
    },

    async save(state) {
      if (!(state instanceof RuntimePilotState)) {
        throw new TypeError('Invalid PMIA runtime pilot state');
      }
      await storageArea.set({ [key]: state.exportState() });
    },

    async bytesInUse() {
      if (typeof storageArea.getBytesInUse !== 'function') return 0;
      return Number(await storageArea.getBytesInUse(null)) || 0;
    },

    async clear() {
      statePromise = Promise.resolve(new RuntimePilotState());
      await storageArea.remove(key);
    },

    resetCache() {
      statePromise = null;
    }
  };
}
