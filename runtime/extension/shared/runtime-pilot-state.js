import { DeliveryLedger } from './delivery-ledger.js';

const MODES = new Set(['active', 'paused', 'repairing', 'degraded', 'ended']);
const ROLE_NAMES = ['sender', 'receiver'];
const MAX_TIMELINE = 200;
const MAX_COMMAND_IDS = 128;
const MAX_METRIC_SAMPLES = 40;

function emptyRole() {
  return {
    connected: false,
    tabId: null,
    windowId: null,
    provider: '',
    phase: 'missing',
    composerReady: false,
    generating: false,
    voiceActive: false,
    micState: 'unknown',
    scrollLocked: false,
    localPaused: false,
    heartbeatAt: 0,
    lastActivityAt: 0,
    pageUrl: ''
  };
}

function emptyMetrics() {
  return {
    finalsObserved: 0,
    persisted: 0,
    delivered: 0,
    failed: 0,
    duplicateAcks: 0,
    archived: 0,
    answerTimeouts: 0,
    deliveryProofMs: [],
    answerElapsedMs: []
  };
}

function normalizeMetrics(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...emptyMetrics(),
    finalsObserved: Number(source.finalsObserved || 0),
    persisted: Number(source.persisted || source.queued || 0),
    delivered: Number(source.delivered || 0),
    failed: Number(source.failed || 0),
    duplicateAcks: Number(source.duplicateAcks || 0),
    archived: Number(source.archived || source.superseded || 0),
    answerTimeouts: Number(source.answerTimeouts || 0),
    deliveryProofMs: Array.isArray(source.deliveryProofMs) ? source.deliveryProofMs.slice(-MAX_METRIC_SAMPLES) : [],
    answerElapsedMs: Array.isArray(source.answerElapsedMs) ? source.answerElapsedMs.slice(-MAX_METRIC_SAMPLES) : []
  };
}

function average(values) {
  const list = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
}

function cloneRole(value) {
  return { ...emptyRole(), ...(value && typeof value === 'object' ? value : {}) };
}

function safeEventData(data = {}) {
  const safe = data && typeof data === 'object' ? { ...data } : {};
  if (safe.kind === 'boot' || safe.type === 'boot') safe.text = '[Session setup redacted]';
  if (typeof safe.text === 'string' && safe.text.length > 1200) {
    safe.text = `${safe.text.slice(0, 1200)}…`;
  }
  return safe;
}

function normalizeSession(item) {
  const sessionId = String(item?.sessionId || '').trim();
  if (!sessionId) return null;
  const createdAt = Number.isFinite(item.createdAt) ? item.createdAt : Date.now();
  return {
    sessionId,
    createdAt,
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt,
    mode: MODES.has(item.mode) ? item.mode : 'active',
    sender: cloneRole(item.sender),
    receiver: cloneRole(item.receiver),
    latestPreview: item.latestPreview || null,
    latestFinal: item.latestFinal || null,
    latestProof: item.latestProof || null,
    batchState: {
      active: item.batchState?.active || null,
      next: item.batchState?.next || null,
      hold: Boolean(item.batchState?.hold),
      autoSubmit: item.batchState?.autoSubmit !== false,
      lastEvent: item.batchState?.lastEvent || null,
      lastCompleted: item.batchState?.lastCompleted || null,
      draftConflict: item.batchState?.draftConflict || null
    },
    ledger: new DeliveryLedger(item.ledger || item.queue || []),
    timeline: Array.isArray(item.timeline) ? item.timeline.slice(-MAX_TIMELINE) : [],
    metrics: normalizeMetrics(item.metrics),
    processedCommandIds: Array.isArray(item.processedCommandIds)
      ? item.processedCommandIds.slice(-MAX_COMMAND_IDS)
      : [],
    dashboardConnections: 0,
    layout: {
      mode: String(item.layout?.mode || 'three_window'),
      hidden: Boolean(item.layout?.hidden)
    },
    lastRepair: item.lastRepair || null,
    endedAt: Number.isFinite(item.endedAt) ? item.endedAt : 0,
    storagePressure: item.storagePressure || { bytes: 0, quotaBytes: 10485760, percent: 0, level: 'normal' },
    proofArchive: item.proofArchive || { count: 0, lastProvenAt: 0 }
  };
}

export class RuntimePilotState {
  #sessions = new Map();

  constructor(state = []) {
    for (const item of Array.isArray(state) ? state : []) {
      const session = normalizeSession(item);
      if (session) this.#sessions.set(session.sessionId, session);
    }
  }

  ensure(sessionId, now = Date.now()) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) throw new TypeError('Invalid PMIA session');
    if (!this.#sessions.has(normalized)) {
      const session = normalizeSession({ sessionId: normalized, createdAt: now });
      this.#sessions.set(normalized, session);
    }
    return this.#sessions.get(normalized);
  }

  remove(sessionId) {
    return this.#sessions.delete(String(sessionId || '').trim());
  }

  setMode(sessionId, mode, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.mode = MODES.has(mode) ? mode : session.mode;
    session.updatedAt = now;
    this.record(sessionId, 'transport_mode', { mode: session.mode }, now);
    return session.mode;
  }

  markCommand(sessionId, requestId) {
    const session = this.ensure(sessionId);
    const normalized = String(requestId || '').trim();
    if (!normalized) return false;
    if (session.processedCommandIds.includes(normalized)) return false;
    session.processedCommandIds.push(normalized);
    if (session.processedCommandIds.length > MAX_COMMAND_IDS) session.processedCommandIds.shift();
    return true;
  }

  updateRole(sessionId, role, telemetry, now = Date.now()) {
    if (!ROLE_NAMES.includes(role)) return null;
    const session = this.ensure(sessionId, now);
    session[role] = {
      ...session[role],
      ...(telemetry && typeof telemetry === 'object' ? telemetry : {}),
      connected: true,
      heartbeatAt: Number(telemetry?.heartbeatAt || now)
    };
    session.updatedAt = now;
    return { ...session[role] };
  }

  disconnectRole(sessionId, role, now = Date.now()) {
    if (!ROLE_NAMES.includes(role)) return null;
    const session = this.ensure(sessionId, now);
    session[role] = { ...session[role], connected: false, phase: 'missing' };
    session.updatedAt = now;
    this.record(sessionId, 'role_disconnected', { role }, now);
    return { ...session[role] };
  }

  setDashboardConnections(sessionId, count, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.dashboardConnections = Math.max(0, Number(count) || 0);
    session.updatedAt = now;
    return session.dashboardConnections;
  }

  recordPreview(sessionId, preview, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.latestPreview = preview ? { ...preview, observedAt: now } : null;
    session.updatedAt = now;
  }

  recordFinal(sessionId, envelope, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.latestFinal = envelope ? {
      id: envelope.id,
      seq: envelope.seq || 0,
      kind: envelope.kind,
      sourceProvider: envelope.sourceProvider,
      text: envelope.kind === 'boot' ? '[Session setup redacted]' : envelope.text,
      createdAt: envelope.createdAt || now,
      observedAt: now
    } : null;
    session.updatedAt = now;
  }

  persistFinal(sessionId, envelope, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const outcome = session.ledger.persist(envelope, { now });
    if (outcome.accepted && !outcome.duplicate) {
      session.metrics.finalsObserved += envelope?.kind === 'question' ? 1 : 0;
      session.metrics.persisted += envelope?.kind === 'question' ? 1 : 0;
      this.recordFinal(sessionId, envelope, now);
      this.record(sessionId, 'final_persisted', {
        envelopeId: envelope.id,
        seq: envelope.seq || 0,
        ledgerState: outcome.entry?.state || 'persisted'
      }, now);
    }
    session.updatedAt = now;
    return outcome;
  }

  markLedgerStaged(sessionId, ids, batchId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markStaged(ids, batchId, now);
    if (changed.length) this.record(sessionId, 'batch_staged', { batchId, memberIds: changed.map(item => item.id) }, now);
    return changed;
  }

  markLedgerSubmitting(sessionId, batchId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markSubmitting(batchId, now);
    if (changed.length) this.record(sessionId, 'batch_submitting', { batchId, memberIds: changed.map(item => item.id) }, now);
    return changed;
  }

  markLedgerProven(sessionId, batchId, proof = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markProven(batchId, proof, now);
    session.metrics.delivered += changed.length;
    if (changed.length) this.record(sessionId, 'batch_proven', { batchId, memberIds: changed.map(item => item.id), proof }, now);
    return changed;
  }

  markLedgerFailed(sessionId, ids, reason = 'delivery_failed', now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markFailed(ids, reason, now);
    if (changed.length) {
      this.record(sessionId, 'ledger_entries_failed', {
        memberIds: changed.map(entry => entry.id),
        reason
      }, now);
    }
    return changed;
  }

  markLedgerItemSubmitting(sessionId, itemId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const entry = session.ledger.markItemSubmitting(itemId, now);
    if (entry) this.record(sessionId, 'ledger_item_submitting', { ledgerItemId: itemId }, now);
    return entry;
  }

  completeLedgerItem(sessionId, itemId, outcome = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    let entry = null;
    let eventType = 'ledger_item_failed';
    if (outcome.delivered) {
      entry = session.ledger.markItemProven(itemId, outcome.proof || {
        reason: outcome.reason || 'accepted',
        verified: Boolean(outcome.proof?.verified)
      }, now);
      if (entry) session.metrics.delivered += 1;
      eventType = 'ledger_item_proven';
    } else if (outcome.queued || outcome.staged) {
      entry = session.ledger.markPersisted([itemId], outcome.reason || 'receiver_unavailable', now)[0] || null;
      eventType = 'ledger_item_persisted';
    } else {
      entry = session.ledger.markFailed([itemId], outcome.reason || 'delivery_failed', now)[0] || null;
    }
    if (entry) {
      this.record(sessionId, eventType, {
        ledgerItemId: itemId,
        reason: outcome.reason || ''
      }, now);
    }
    return entry;
  }

  archiveLedgerItem(sessionId, itemId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const entry = session.ledger.archiveEntry(itemId, now);
    if (entry) {
      session.metrics.archived += 1;
      this.record(sessionId, 'ledger_item_archived', { ledgerItemId: itemId }, now);
    }
    return entry;
  }

  archiveProven(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.archiveProven(now);
    session.metrics.archived += removed.length;
    if (removed.length) this.record(sessionId, 'proven_entries_archived', { count: removed.length }, now);
    return removed;
  }

  archiveAllUnresolved(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.archiveAllUnresolved(now);
    session.metrics.archived += removed.length;
    if (removed.length) this.record(sessionId, 'unresolved_entries_archived', { count: removed.length }, now);
    return removed;
  }

  recordDelivery(sessionId, outcome = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (!outcome.delivered && !outcome.queued && !outcome.staged) session.metrics.failed += 1;
    if (outcome.duplicate) session.metrics.duplicateAcks += 1;
    const elapsed = Number(outcome.deliveryProofMs);
    if (Number.isFinite(elapsed)) {
      session.metrics.deliveryProofMs.push(elapsed);
      session.metrics.deliveryProofMs = session.metrics.deliveryProofMs.slice(-MAX_METRIC_SAMPLES);
    }
    this.record(sessionId, 'delivery_outcome', safeEventData(outcome), now);
  }

  recordAnswer(sessionId, event = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (event.timeout) session.metrics.answerTimeouts += 1;
    const elapsed = Number(event.elapsedMs);
    if (Number.isFinite(elapsed)) {
      session.metrics.answerElapsedMs.push(elapsed);
      session.metrics.answerElapsedMs = session.metrics.answerElapsedMs.slice(-MAX_METRIC_SAMPLES);
    }
    this.record(sessionId, event.timeout ? 'answer_timeout' : 'answer_captured', safeEventData(event), now);
  }

  updateBatchState(sessionId, event = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const type = String(event.type || 'batch_event');
    const memberIds = Array.isArray(event.memberIds) ? event.memberIds.map(String) : [];
    if (type === 'batch_submitting' || type === 'batch_submitted') {
      session.batchState.active = {
        batchId: String(event.batchId || ''),
        memberIds,
        questionCount: Number(event.questionCount || memberIds.length),
        submitted: type === 'batch_submitted',
        proof: type === 'batch_submitted' ? (event.proof || null) : null
      };
      session.batchState.next = null;
    } else if (type === 'next_batch_draft') {
      session.batchState.next = {
        memberIds,
        questionCount: Number(event.questionCount || memberIds.length),
        written: event.written !== false
      };
    } else if (type === 'batch_answer_complete' || type === 'batch_answer_timeout') {
      session.batchState.lastCompleted = {
        ...(session.batchState.active || {}),
        answer: event.answer || null,
        proof: event.proof || session.batchState.active?.proof || null,
        completedAt: now,
        timeout: type === 'batch_answer_timeout'
      };
      session.batchState.active = null;
    } else if (type === 'batch_submit_failed') {
      session.batchState.active = null;
      session.batchState.next = { memberIds, questionCount: memberIds.length, written: true };
    } else if (type === 'draft_conflict') {
      session.batchState.draftConflict = { owner: String(event.owner || 'unknown'), at: now };
    } else if (type === 'batch_policy_changed') {
      if ('hold' in event) session.batchState.hold = Boolean(event.hold);
      if ('autoSubmit' in event) session.batchState.autoSubmit = Boolean(event.autoSubmit);
    }
    session.batchState.lastEvent = { ...safeEventData(event), at: now };
    session.updatedAt = now;
    this.record(sessionId, type, event, now);
    return { ...session.batchState };
  }

  setStoragePressure(sessionId, pressure, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.storagePressure = { ...(pressure || {}) };
    session.updatedAt = now;
    return { ...session.storagePressure };
  }

  compactProvenHistory(sessionId, retain = 80, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.compactProven(retain);
    if (!removed.length) return 0;
    session.proofArchive = {
      count: Number(session.proofArchive?.count || 0) + removed.length,
      lastProvenAt: Math.max(
        Number(session.proofArchive?.lastProvenAt || 0),
        ...removed.map(item => Number(item.proof?.at || item.updatedAt || 0))
      )
    };
    this.record(sessionId, 'proven_history_compacted', {
      count: removed.length,
      retained: retain,
      archiveCount: session.proofArchive.count
    }, now);
    return removed.length;
  }

  setLayout(sessionId, layout, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.layout = { ...session.layout, ...(layout || {}) };
    session.updatedAt = now;
    this.record(sessionId, 'layout_changed', session.layout, now);
  }

  setRepair(sessionId, report, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.lastRepair = { ...(report || {}), at: now };
    session.updatedAt = now;
    this.record(sessionId, 'repair_report', session.lastRepair, now);
  }

  record(sessionId, type, data = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const eventType = String(type || 'event');
    const eventData = safeEventData(data);
    if (eventType === 'receiver_proof') {
      session.latestProof = { ...eventData, at: now };
    }
    session.timeline.push({
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      at: now,
      type: eventType,
      data: eventData
    });
    session.timeline = session.timeline.slice(-MAX_TIMELINE);
    session.updatedAt = now;
  }

  snapshot(sessionId, now = Date.now()) {
    const session = this.#sessions.get(String(sessionId || '').trim());
    if (!session) return null;
    const warnings = [];
    for (const role of ROLE_NAMES) {
      const state = session[role];
      if (!state.connected) warnings.push({ code: `${role}_missing`, role, severity: 'error' });
      else if (state.adapterCapabilities?.complete === false) {
        warnings.push({
          code: `${role}_adapter_incomplete`,
          role,
          severity: 'error',
          missing: state.adapterCapabilities.missingRequired || []
        });
      }
      else if (state.phase === 'unresponsive') {
        warnings.push({ code: `${role}_unresponsive`, role, severity: 'error' });
      } else if (state.phase && state.phase !== 'ready') {
        warnings.push({
          code: `${role}_lifecycle_not_ready`,
          role,
          severity: 'warn',
          phase: state.phase
        });
      } else if (state.heartbeatAt && now - state.heartbeatAt > 15_000) {
        warnings.push({ code: `${role}_heartbeat_stale`, role, severity: 'error', ageMs: now - state.heartbeatAt });
      } else if (!state.composerReady) {
        warnings.push({ code: `${role}_composer_missing`, role, severity: 'warn' });
      }
    }
    if (session.latestProof?.ok && session.latestProof?.verified === false) {
      warnings.push({ code: 'receiver_proof_unverified', severity: 'error' });
    }
    if (session.latestProof?.ok === false) {
      warnings.push({
        code: 'receiver_proof_failed',
        severity: 'error',
        reason: session.latestProof.reason || 'unknown'
      });
    }
    if (session.sender.sourceSilenceState === 'voice_stalled') {
      warnings.push({
        code: 'sender_voice_transcript_stalled',
        severity: 'error',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    } else if (session.sender.sourceSilenceState === 'voice_slow') {
      warnings.push({
        code: 'sender_voice_transcript_slow',
        severity: 'warn',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    } else if (session.sender.sourceSilenceState === 'idle_silent') {
      warnings.push({
        code: 'sender_source_silent',
        severity: 'warn',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    }
    const unresolved = session.ledger.unresolved();
    if (unresolved.length) warnings.push({ code: 'inbox_waiting', severity: 'warn', count: unresolved.length });
    const oldestPersistedAt = unresolved.length
      ? Math.min(...unresolved.map(item => Number(item.persistedAt) || now))
      : 0;
    if (oldestPersistedAt && now - oldestPersistedAt >= 120_000) {
      warnings.push({
        code: 'inbox_oldest_stale',
        severity: 'error',
        ageMs: now - oldestPersistedAt
      });
    }
    if (session.batchState.draftConflict) warnings.push({ code: 'receiver_draft_conflict', severity: 'warn' });
    if (session.storagePressure?.level === 'critical') warnings.push({ code: 'session_storage_critical', severity: 'error', percent: session.storagePressure.percent });
    else if (session.storagePressure?.level === 'high') warnings.push({ code: 'session_storage_high', severity: 'warn', percent: session.storagePressure.percent });
    else if (session.storagePressure?.level === 'elevated') warnings.push({ code: 'session_storage_elevated', severity: 'warn', percent: session.storagePressure.percent });
    if (session.mode === 'repairing') warnings.push({ code: 'repair_in_progress', severity: 'warn' });
    if (session.mode === 'degraded') warnings.push({ code: 'runtime_degraded', severity: 'error' });
    if (session.mode === 'paused') warnings.push({ code: 'transport_paused', severity: 'warn' });
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      now,
      uptimeMs: Math.max(0, now - session.createdAt),
      mode: session.mode,
      sender: { ...session.sender },
      receiver: { ...session.receiver },
      latestPreview: session.latestPreview ? { ...session.latestPreview } : null,
      latestFinal: session.latestFinal ? { ...session.latestFinal } : null,
      latestProof: session.latestProof ? { ...session.latestProof } : null,
      batchState: { ...session.batchState, active: session.batchState.active ? { ...session.batchState.active } : null, next: session.batchState.next ? { ...session.batchState.next } : null },
      ledger: session.ledger.snapshot(),
      ledgerCounts: session.ledger.counts(),
      warnings,
      timeline: session.timeline.map(event => ({ ...event, data: { ...event.data } })),
      metrics: {
        ...session.metrics,
        deliverySuccessRate: session.metrics.delivered + session.metrics.failed
          ? Math.round((session.metrics.delivered / (session.metrics.delivered + session.metrics.failed)) * 100)
          : 100,
        averageDeliveryProofMs: average(session.metrics.deliveryProofMs),
        averageAnswerElapsedMs: average(session.metrics.answerElapsedMs)
      },
      dashboardConnections: session.dashboardConnections,
      layout: { ...session.layout },
      lastRepair: session.lastRepair ? { ...session.lastRepair } : null,
      endedAt: session.endedAt,
      storagePressure: { ...session.storagePressure },
      proofArchive: { ...session.proofArchive }
    };
  }

  exportState() {
    return Array.from(this.#sessions.values()).map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      mode: session.mode,
      sender: { ...session.sender },
      receiver: { ...session.receiver },
      latestPreview: session.latestPreview,
      latestFinal: session.latestFinal,
      latestProof: session.latestProof,
      batchState: session.batchState,
      ledger: session.ledger.exportState(),
      timeline: session.timeline,
      metrics: session.metrics,
      processedCommandIds: session.processedCommandIds,
      layout: session.layout,
      lastRepair: session.lastRepair,
      endedAt: session.endedAt,
      storagePressure: { ...session.storagePressure },
      proofArchive: { ...session.proofArchive }
    }));
  }
}

export function buildPilotSnapshot(state, sessionId, now = Date.now()) {
  return state instanceof RuntimePilotState ? state.snapshot(sessionId, now) : null;
}
