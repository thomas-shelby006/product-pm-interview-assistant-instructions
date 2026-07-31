const DEFAULT_STALE_AFTER_MS = 45_000;
const emptySession = () => ({
  sender: null,
  receiver: null,
  pending: null,
  lastAcceptedSeq: 0
});

function cloneRegistration(value) {
  if (!value || typeof value !== 'object') return null;
  const { sessionId, role, provider, tabId, registeredAt } = value;
  if (!sessionId || !['sender', 'receiver'].includes(role) || !provider || !Number.isInteger(tabId)) {
    return null;
  }
  return {
    sessionId,
    role,
    provider,
    tabId,
    registeredAt: Number.isFinite(registeredAt) ? registeredAt : Date.now()
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
    const { sessionId, role, provider, tabId } = registration;
    const session = this.#sessions.get(sessionId) || emptySession();
    const existing = session[role];

    if (existing && existing.tabId === tabId && existing.provider === provider) {
      existing.registeredAt = now;
      const pending = role === 'receiver' ? session.pending : null;
      if (role === 'receiver') session.pending = null;
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

    const next = { sessionId, role, provider, tabId, registeredAt: now };
    session[role] = next;
    this.#sessions.set(sessionId, session);
    const pending = role === 'receiver' ? session.pending : null;
    if (role === 'receiver') session.pending = null;
    return {
      accepted: true,
      changed: true,
      conflict: false,
      replacedTabId: existing?.tabId || null,
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

  canForward(sessionId, tabId) {
    return this.#sessions.get(sessionId)?.sender?.tabId === tabId;
  }

  ownsTab(sessionId, tabId) {
    const session = this.#sessions.get(sessionId);
    return session?.sender?.tabId === tabId || session?.receiver?.tabId === tabId;
  }

  roleForTab(sessionId, tabId) {
    const session = this.#sessions.get(sessionId);
    if (session?.sender?.tabId === tabId) return 'sender';
    if (session?.receiver?.tabId === tabId) return 'receiver';
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