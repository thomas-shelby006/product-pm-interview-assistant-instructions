const DEFAULT_STALE_AFTER_MS = 45_000;
const emptySession = () => ({
  sender: null,
  receiver: null,
  pending: null,
  lastAcceptedSeq: 0
});

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

export class SessionRegistry {
  #sessions = new Map();

  constructor(state = []) {
    if (!Array.isArray(state)) return;
    for (const item of state) {
      if (!item?.sessionId) continue;
      const session = emptySession();
      session.sender = cloneRegistration(item.sender);
      session.receiver = cloneRegistration(item.receiver);
      session.pending = item.pending && typeof item.pending === 'object' ? item.pending : null;
      session.lastAcceptedSeq = Number.isSafeInteger(item.lastAcceptedSeq) && item.lastAcceptedSeq > 0
        ? item.lastAcceptedSeq
        : 0;
      if (session.sender || session.receiver || session.pending || session.lastAcceptedSeq) {
        this.#sessions.set(item.sessionId, session);
      }
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
    const sameRuntimeLease = Boolean(
      existing && existing.provider === provider && incomingInstanceId
      && String(existing.instanceId || '').trim() === incomingInstanceId
    );
    if (sameRuntimeLease && existing.tabId !== tabId && !allowInstanceMigration) {
      return {
        accepted: false,
        changed: false,
        conflict: true,
        registration: existing,
        pending: null
      };
    }
    if (sameRuntimeLease) {
      const changed = existing.tabId !== tabId;
      const replacedRegistration = changed ? { ...existing } : null;
      existing.tabId = tabId;
      existing.registeredAt = now;
      const pending = role === 'receiver' ? session.pending : null;
      if (role === 'receiver') session.pending = null;
      this.#sessions.set(sessionId, session);
      return {
        accepted: true,
        changed,
        conflict: false,
        replacedTabId: replacedRegistration?.tabId || null,
        replacedRegistration,
        registration: existing,
        pending
      };
    }
    if (existing && existing.tabId === tabId && existing.provider === provider) {
      const existingInstanceId = String(existing.instanceId || '').trim();
      const replacementInstance = Boolean(
        incomingInstanceId && existingInstanceId && incomingInstanceId !== existingInstanceId
      );
      const pending = role === 'receiver' ? session.pending : null;
      if (role === 'receiver') session.pending = null;
      if (replacementInstance) {
        const replacedRegistration = { ...existing };
        const next = {
          sessionId, role, provider, tabId, registeredAt: now,
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
          registration: next,
          pending
        };
      }
      existing.registeredAt = now;
      if (incomingInstanceId && !existingInstanceId) existing.instanceId = incomingInstanceId;
      this.#sessions.set(sessionId, session);
      return {
        accepted: true,
        changed: false,
        conflict: false,
        registration: existing,
        pending
      };
    }

    const existingIsFresh = existing && now - existing.registeredAt <= staleAfterMs;
    if (existingIsFresh) {
      return {
        accepted: false,
        changed: false,
        conflict: true,
        registration: existing,
        pending: null
      };
    }

    const next = { sessionId, role, provider, tabId, registeredAt: now, instanceId: incomingInstanceId };
    session[role] = next;
    this.#sessions.set(sessionId, session);
    const pending = role === 'receiver' ? session.pending : null;
    if (role === 'receiver') session.pending = null;
    return {
      accepted: true,
      changed: true,
      conflict: false,
      replacedTabId: existing?.tabId || null,
      replacedRegistration: existing ? { ...existing } : null,
      registration: next,
      pending
    };
  }

  acceptSequence(sessionId, value) {
    const session = this.#sessions.get(sessionId) || emptySession();
    this.#sessions.set(sessionId, session);
    const seq = Number.isSafeInteger(value) && value > 0 ? value : 0;
    if (!seq) {
      return {
        accepted: true,
        reason: 'unsequenced',
        lastAcceptedSeq: session.lastAcceptedSeq
      };
    }
    if (seq === session.lastAcceptedSeq) {
      return {
        accepted: false,
        reason: 'duplicate',
        lastAcceptedSeq: session.lastAcceptedSeq
      };
    }
    if (seq < session.lastAcceptedSeq) {
      return {
        accepted: false,
        reason: 'stale',
        lastAcceptedSeq: session.lastAcceptedSeq
      };
    }
    session.lastAcceptedSeq = seq;
    return { accepted: true, reason: 'new', lastAcceptedSeq: seq };
  }

  canForward(sessionId, tabId, instanceId = '') {
    const sender = this.#sessions.get(sessionId)?.sender;
    if (sender?.tabId !== tabId) return false;
    const ownerInstanceId = String(sender.instanceId || '').trim();
    const requesterInstanceId = String(instanceId || '').trim();
    return !ownerInstanceId || !requesterInstanceId || ownerInstanceId === requesterInstanceId;
  }

  ownsTab(sessionId, tabId, instanceId = '') {
    const session = this.#sessions.get(sessionId);
    return ['sender', 'receiver'].some(role => {
      const owner = session?.[role];
      if (owner?.tabId !== tabId) return false;
      const ownerInstanceId = String(owner.instanceId || '').trim();
      const requesterInstanceId = String(instanceId || '').trim();
      return !ownerInstanceId || !requesterInstanceId || ownerInstanceId === requesterInstanceId;
    });
  }

  roleForTab(sessionId, tabId, instanceId = '') {
    const session = this.#sessions.get(sessionId);
    for (const role of ['sender', 'receiver']) {
      const owner = session?.[role];
      if (owner?.tabId !== tabId) continue;
      const ownerInstanceId = String(owner.instanceId || '').trim();
      const requesterInstanceId = String(instanceId || '').trim();
      if (!ownerInstanceId || !requesterInstanceId || ownerInstanceId === requesterInstanceId) return role;
    }
    return null;
  }

  route(sessionId, message) {
    const session = this.#sessions.get(sessionId) || emptySession();
    this.#sessions.set(sessionId, session);
    if (!session.receiver) {
      session.pending = message;
      return null;
    }
    return { tabId: session.receiver.tabId, message };
  }

  queueLatest(sessionId, message) {
    if (!sessionId || !message || typeof message !== 'object') return false;
    const session = this.#sessions.get(sessionId) || emptySession();
    session.pending = message;
    this.#sessions.set(sessionId, session);
    return true;
  }

  unregister(tabId) {
    const affectedSessionIds = [];
    for (const [sessionId, session] of this.#sessions) {
      let changed = false;
      if (session.sender?.tabId === tabId) {
        session.sender = null;
        changed = true;
      }
      if (session.receiver?.tabId === tabId) {
        session.receiver = null;
        changed = true;
      }
      if (changed) affectedSessionIds.push(sessionId);
      if (!session.sender && !session.receiver && !session.pending) this.#sessions.delete(sessionId);
    }
    return affectedSessionIds;
  }

  removeSession(sessionId) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return false;
    return this.#sessions.delete(normalized);
  }

  pruneStale(now = Date.now(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
    const removed = [];
    for (const [sessionId, session] of this.#sessions) {
      for (const role of ['sender', 'receiver']) {
        const registration = session[role];
        if (registration && now - registration.registeredAt > staleAfterMs) {
          removed.push({ sessionId, role, tabId: registration.tabId });
          session[role] = null;
        }
      }
      if (!session.sender && !session.receiver && !session.pending) this.#sessions.delete(sessionId);
    }
    return removed;
  }

  exportState() {
    return Array.from(this.#sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      sender: session.sender,
      receiver: session.receiver,
      pending: session.pending,
      lastAcceptedSeq: session.lastAcceptedSeq
    }));
  }

  snapshot() {
    return this.exportState().map(session => ({
      sessionId: session.sessionId,
      sender: session.sender,
      receiver: session.receiver,
      hasPending: Boolean(session.pending)
    }));
  }
}