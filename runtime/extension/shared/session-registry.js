const DEFAULT_STALE_AFTER_MS = 45_000;
const emptySession = () => ({ sender: null, receiver: null });

function cloneRegistration(value) {
  if (!value || typeof value !== 'object') return null;
  const { sessionId, role, provider, tabId, registeredAt, instanceId } = value;
  if (!sessionId || !['sender', 'receiver'].includes(role) || !provider || !Number.isInteger(tabId)) {
    return null;
  }
  return {
    sessionId,
    role,
    provider,
    tabId,
    registeredAt: Number.isFinite(registeredAt) ? registeredAt : Date.now(),
    instanceId: String(instanceId || '').trim()
  };
}

function validateRegistration(registration) {
  const { sessionId, role, provider, tabId } = registration || {};
  if (!sessionId || !['sender', 'receiver'].includes(role) || !provider || !Number.isInteger(tabId)) {
    throw new TypeError('Invalid PMIA registration');
  }
}

function ownsRegistration(registration, tabId, instanceId = '') {
  if (registration?.tabId !== tabId) return false;
  const ownerInstanceId = String(registration.instanceId || '').trim();
  const requesterInstanceId = String(instanceId || '').trim();
  return !ownerInstanceId || !requesterInstanceId || ownerInstanceId === requesterInstanceId;
}

export class SessionRegistry {
  #sessions = new Map();

  constructor(state = []) {
    for (const item of Array.isArray(state) ? state : []) {
      if (!item?.sessionId) continue;
      const session = {
        sender: cloneRegistration(item.sender),
        receiver: cloneRegistration(item.receiver)
      };
      if (session.sender || session.receiver) this.#sessions.set(item.sessionId, session);
    }
  }

  getSession(sessionId) {
    return this.#sessions.get(sessionId) || null;
  }

  register(registration, options = {}) {
    validateRegistration(registration);
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const staleAfterMs = Number.isFinite(options.staleAfterMs)
      ? options.staleAfterMs
      : DEFAULT_STALE_AFTER_MS;
    const allowInstanceMigration = options.allowInstanceMigration !== false;
    const { sessionId, role, provider, tabId } = registration;
    const session = this.#sessions.get(sessionId) || emptySession();
    const existing = session[role];
    const incomingInstanceId = String(registration.instanceId || '').trim();
    const existingInstanceId = String(existing?.instanceId || '').trim();
    const sameRuntimeLease = Boolean(
      existing
      && existing.provider === provider
      && incomingInstanceId
      && existingInstanceId === incomingInstanceId
    );

    if (sameRuntimeLease && existing.tabId !== tabId && !allowInstanceMigration) {
      return { accepted: false, changed: false, conflict: true, registration: existing };
    }
    if (sameRuntimeLease) {
      const replacedRegistration = existing.tabId === tabId ? null : { ...existing };
      existing.tabId = tabId;
      existing.registeredAt = now;
      this.#sessions.set(sessionId, session);
      return {
        accepted: true,
        changed: Boolean(replacedRegistration),
        conflict: false,
        replacedTabId: replacedRegistration?.tabId || null,
        replacedRegistration,
        registration: existing
      };
    }

    if (existing && existing.tabId === tabId && existing.provider === provider) {
      const replacementInstance = Boolean(
        incomingInstanceId && existingInstanceId && incomingInstanceId !== existingInstanceId
      );
      if (replacementInstance) {
        const replacedRegistration = { ...existing };
        const next = {
          sessionId,
          role,
          provider,
          tabId,
          registeredAt: now,
          instanceId: incomingInstanceId
        };
        session[role] = next;
        this.#sessions.set(sessionId, session);
        return {
          accepted: true,
          changed: true,
          conflict: false,
          replacedTabId: tabId,
          replacedRegistration,
          registration: next
        };
      }
      existing.registeredAt = now;
      if (incomingInstanceId && !existingInstanceId) existing.instanceId = incomingInstanceId;
      this.#sessions.set(sessionId, session);
      return { accepted: true, changed: false, conflict: false, registration: existing };
    }

    const existingIsFresh = existing && now - existing.registeredAt <= staleAfterMs;
    if (existingIsFresh) {
      return { accepted: false, changed: false, conflict: true, registration: existing };
    }

    const next = {
      sessionId,
      role,
      provider,
      tabId,
      registeredAt: now,
      instanceId: incomingInstanceId
    };
    session[role] = next;
    this.#sessions.set(sessionId, session);
    return {
      accepted: true,
      changed: true,
      conflict: false,
      replacedTabId: existing?.tabId || null,
      replacedRegistration: existing ? { ...existing } : null,
      registration: next
    };
  }

  canForward(sessionId, tabId, instanceId = '') {
    return ownsRegistration(this.#sessions.get(sessionId)?.sender, tabId, instanceId);
  }

  ownsTab(sessionId, tabId, instanceId = '') {
    const session = this.#sessions.get(sessionId);
    return ['sender', 'receiver'].some(role => ownsRegistration(session?.[role], tabId, instanceId));
  }

  roleForTab(sessionId, tabId, instanceId = '') {
    const session = this.#sessions.get(sessionId);
    for (const role of ['sender', 'receiver']) {
      if (ownsRegistration(session?.[role], tabId, instanceId)) return role;
    }
    return null;
  }

  route(sessionId, message) {
    const receiver = this.#sessions.get(sessionId)?.receiver;
    return receiver ? { tabId: receiver.tabId, message } : null;
  }

  unregister(tabId) {
    const affectedSessionIds = [];
    for (const [sessionId, session] of this.#sessions) {
      let changed = false;
      for (const role of ['sender', 'receiver']) {
        if (session[role]?.tabId !== tabId) continue;
        session[role] = null;
        changed = true;
      }
      if (!changed) continue;
      affectedSessionIds.push(sessionId);
      if (!session.sender && !session.receiver) this.#sessions.delete(sessionId);
    }
    return affectedSessionIds;
  }

  removeSession(sessionId) {
    const normalized = String(sessionId || '').trim();
    return normalized ? this.#sessions.delete(normalized) : false;
  }

  pruneStale(now = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
    const removed = [];
    for (const [sessionId, session] of this.#sessions) {
      for (const role of ['sender', 'receiver']) {
        const registration = session[role];
        if (!registration || now - registration.registeredAt <= staleAfterMs) continue;
        removed.push({ sessionId, role, tabId: registration.tabId });
        session[role] = null;
      }
      if (!session.sender && !session.receiver) this.#sessions.delete(sessionId);
    }
    return removed;
  }

  exportState() {
    return [...this.#sessions.entries()].map(([sessionId, session]) => ({
      sessionId,
      sender: session.sender,
      receiver: session.receiver
    }));
  }

  snapshot() {
    return this.exportState();
  }
}
