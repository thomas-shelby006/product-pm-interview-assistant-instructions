const emptySession = () => ({ sender: null, receiver: null, pending: null });

export class SessionRegistry {
  #sessions = new Map();

  getSession(sessionId) {
    return this.#sessions.get(sessionId) || null;
  }

  register(registration) {
    const { sessionId, role, provider, tabId } = registration || {};
    if (!sessionId || !['sender', 'receiver'].includes(role) || !provider || !Number.isInteger(tabId)) {
      throw new TypeError('Invalid PMIA registration');
    }
    const session = this.#sessions.get(sessionId) || emptySession();
    session[role] = { sessionId, role, provider, tabId, registeredAt: Date.now() };
    this.#sessions.set(sessionId, session);
    const pending = role === 'receiver' ? session.pending : null;
    if (role === 'receiver') session.pending = null;
    return { registration: session[role], pending };
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

  unregister(tabId) {
    for (const [sessionId, session] of this.#sessions) {
      if (session.sender?.tabId === tabId) session.sender = null;
      if (session.receiver?.tabId === tabId) session.receiver = null;
      if (!session.sender && !session.receiver && !session.pending) this.#sessions.delete(sessionId);
    }
  }

  snapshot() {
    return Array.from(this.#sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      sender: session.sender,
      receiver: session.receiver,
      hasPending: Boolean(session.pending)
    }));
  }
}
