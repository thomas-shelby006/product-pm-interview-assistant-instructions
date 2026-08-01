import { electRegistryOwner } from './owner-election.js';

const DEFAULT_STALE_AFTER_MS = 45_000;
const emptySession = () => ({ sender: null, receiver: null });

function cloneRegistration(value) {
  if (!value || typeof value !== 'object') return null;
  const { sessionId, role, provider, tabId, registeredAt, instanceId } = value;
  if (!sessionId || !['sender', 'receiver'].includes(role) || !provider || !Number.isInteger(tabId)) return null;
  const registered = Number.isFinite(registeredAt) ? registeredAt : Date.now();
  return {
    sessionId,
    role,
    provider,
    tabId,
    registeredAt: registered,
    instanceId: String(instanceId || '').trim(),
    ownerGeneration: Math.max(1, Number(value.ownerGeneration) || 1),
    leaseExpiresAt: Math.max(registered, Number(value.leaseExpiresAt) || (registered + DEFAULT_STALE_AFTER_MS))
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
      const session = { sender: cloneRegistration(item.sender), receiver: cloneRegistration(item.receiver) };
      if (session.sender || session.receiver) this.#sessions.set(item.sessionId, session);
    }
  }

  getSession(sessionId) { return this.#sessions.get(sessionId) || null; }

  register(registration, options = {}) {
    validateRegistration(registration);
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const staleAfterMs = Number.isFinite(options.staleAfterMs) ? options.staleAfterMs : DEFAULT_STALE_AFTER_MS;
    const allowInstanceMigration = options.allowInstanceMigration !== false;
    const { sessionId, role, provider, tabId } = registration;
    const session = this.#sessions.get(sessionId) || emptySession();
    const existing = session[role];
    const incomingInstanceId = String(registration.instanceId || '').trim();
    const existingInstanceId = String(existing?.instanceId || '').trim();
    const legacySameTabHeartbeat = Boolean(existing && existing.provider === provider && existing.tabId === tabId && !incomingInstanceId && !existingInstanceId);
    const sameRuntimeLease = Boolean(existing && existing.provider === provider && ((incomingInstanceId && existingInstanceId === incomingInstanceId) || legacySameTabHeartbeat));

    if (sameRuntimeLease && existing.tabId !== tabId && !allowInstanceMigration) {
      return { accepted: false, changed: false, conflict: true, reason: 'instance_migration_disabled', registration: { ...existing } };
    }

    let ownerGeneration = Math.max(0, Number(registration.ownerGeneration) || 0);
    if (!ownerGeneration) ownerGeneration = existing ? 1 : 1;
    if (existing && existing.tabId === tabId && incomingInstanceId && existingInstanceId && incomingInstanceId !== existingInstanceId) {
      ownerGeneration = Math.max(ownerGeneration, Number(existing.ownerGeneration || 1) + 1);
    }
    if (sameRuntimeLease) ownerGeneration = Math.max(ownerGeneration, Number(existing.ownerGeneration || 1));

    const candidate = {
      sessionId,
      role,
      provider,
      tabId,
      instanceId: incomingInstanceId,
      ownerGeneration
    };
    const election = electRegistryOwner(existing, candidate, { now, leaseMs: staleAfterMs });
    if (election.winner === 'existing') {
      return {
        accepted: false,
        changed: false,
        conflict: true,
        reason: election.reason,
        registration: { ...election.registration }
      };
    }

    const next = cloneRegistration(election.registration);
    const replacedRegistration = existing && (
      existing.tabId !== next.tabId
      || existing.instanceId !== next.instanceId
      || existing.provider !== next.provider
      || existing.ownerGeneration !== next.ownerGeneration
    ) ? { ...existing } : null;
    session[role] = next;
    this.#sessions.set(sessionId, session);
    return {
      accepted: true,
      changed: !existing || Boolean(replacedRegistration),
      conflict: false,
      reason: election.reason,
      replacedTabId: replacedRegistration?.tabId || null,
      replacedRegistration,
      registration: { ...next }
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
    for (const role of ['sender', 'receiver']) if (ownsRegistration(session?.[role], tabId, instanceId)) return role;
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
        if (!registration) continue;
        const expiresAt = Number(registration.leaseExpiresAt || (registration.registeredAt + staleAfterMs));
        if (Number(now) <= expiresAt) continue;
        removed.push({ sessionId, role, tabId: registration.tabId, ownerGeneration: registration.ownerGeneration });
        session[role] = null;
      }
      if (!session.sender && !session.receiver) this.#sessions.delete(sessionId);
    }
    return removed;
  }

  exportState() {
    return [...this.#sessions.entries()].map(([sessionId, session]) => ({
      sessionId,
      sender: session.sender ? { ...session.sender } : null,
      receiver: session.receiver ? { ...session.receiver } : null
    }));
  }

  snapshot() { return this.exportState(); }
}