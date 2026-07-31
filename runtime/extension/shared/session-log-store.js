import { appendBoundedLog, roleLogKey } from './session-log.js';

const ROLES = ['sender', 'receiver'];

export function sessionRoleLogKeys(sessionId) {
  return ROLES.map(role => roleLogKey(sessionId, role));
}

export function createSessionLogStore({
  sessionArea,
  legacyLocalArea = null,
  maxEvents = 500
} = {}) {
  if (!sessionArea?.get || !sessionArea?.set || !sessionArea?.remove) {
    throw new TypeError('PMIA requires chrome.storage.session for transcript logs');
  }

  return {
    async append(sessionId, role, event) {
      if (!event) return [];
      const key = roleLogKey(sessionId, role);
      const stored = await sessionArea.get(key);
      const events = appendBoundedLog(
        Array.isArray(stored[key]) ? stored[key] : [],
        event,
        maxEvents
      );
      await sessionArea.set({ [key]: events });
      return events;
    },

    async read(sessionId, role) {
      const key = roleLogKey(sessionId, role);
      const stored = await sessionArea.get(key);
      return Array.isArray(stored[key]) ? stored[key] : [];
    },
    async clearRole(sessionId, role) {
      await sessionArea.remove(roleLogKey(sessionId, role));
    },

    async clearSession(sessionId) {
      await sessionArea.remove(sessionRoleLogKeys(sessionId));
    },

    async purgeLegacyLocalLogs() {
      if (!legacyLocalArea?.get || !legacyLocalArea?.remove) return 0;
      const stored = await legacyLocalArea.get(null);
      const keys = Object.keys(stored || {}).filter(key => key.startsWith('pmia_log_'));
      if (keys.length) await legacyLocalArea.remove(keys);
      return keys.length;
    }
  };
}
