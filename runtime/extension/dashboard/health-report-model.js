import { buildDiagnostics } from './dashboard-model.js';
import { deriveReadiness } from './readiness-model.js';
import { deriveGapWatch } from './gap-watch-model.js';
import { deriveOutboxStatus } from './outbox-status-model.js';
import { deriveProofInspector } from './proof-inspector-model.js';
import { deriveMemoryGuard } from './memory-guard-model.js';
import { deriveRecoveryProgress } from './recovery-progress-model.js';
import { derivePaceGuard } from './pace-guard-model.js';
import { deriveSelfTestTrust } from './self-test-trust-model.js';

export function buildSafeHealthReport(snapshot, now = Date.now(), efficiency = {}) {
  if (!snapshot) return { generatedAt: now, status: 'disconnected' };
  const readiness = deriveReadiness(snapshot, now);
  const gap = deriveGapWatch(snapshot, now);
  const outbox = deriveOutboxStatus(snapshot, now);
  const proof = deriveProofInspector(snapshot);
  const memory = deriveMemoryGuard(snapshot);
  const recovery = deriveRecoveryProgress(snapshot);
  const pace = derivePaceGuard(snapshot, now);
  const verification = deriveSelfTestTrust(snapshot, now);
  return {
    generatedAt: now,
    sessionId: String(snapshot.sessionId || ''),
    readiness: {
      state: readiness.state,
      blockers: readiness.blockers.map(item => ({ code: item.code, label: item.label }))
    },
    runtime: buildDiagnostics(snapshot, now),
    verification: { state: verification.state, source: verification.source, expiresAt: verification.expiresAt },
    delivery: {
      gap: { state: gap.state, expectedSeq: gap.expectedSeq, bufferedCount: gap.bufferedCount, ageMs: gap.ageMs },
      outbox: { state: outbox.state, count: outbox.count, attempts: outbox.attempts, retryInMs: outbox.retryInMs },
      proof: { state: proof.state, batchId: proof.batchId, memberCount: proof.memberCount, detail: proof.detail },
      pace: {
        state: pace.state,
        backlog: pace.unresolved,
        netPerMinute: pace.netPerMinute,
        catchUpMs: pace.estimatedCatchUpMs
      }
    },
    memory: {
      level: memory.level,
      percent: memory.percent,
      actionableBytes: memory.actionableBytes,
      reclaimableBytes: memory.reclaimableBytes
    },
    transportControl: {
      forecast: snapshot.deliveryForecast ? {
        risk: String(snapshot.deliveryForecast.risk || ''),
        queued: Number(snapshot.deliveryForecast.queued || 0),
        drainEstimateMs: Number.isFinite(Number(snapshot.deliveryForecast.drainEstimateMs)) ? Number(snapshot.deliveryForecast.drainEstimateMs) : 0,
        p95ProofMs: Number(snapshot.deliveryForecast.p95ProofMs || 0),
        proofsPerMinute: Number(snapshot.deliveryForecast.proofsPerMinute || 0)
      } : null,
      recoveryBudget: snapshot.recoveryBudget ? {
        state: String(snapshot.recoveryBudget.state || ''),
        remaining: Number(snapshot.recoveryBudget.remaining || 0),
        maxAutomatic: Number(snapshot.recoveryBudget.maxAutomatic || 0),
        cooldownUntil: Number(snapshot.recoveryBudget.cooldownUntil || 0)
      } : null,
      lastDrill: snapshot.lastTransportDrill ? {
        ok: Boolean(snapshot.lastTransportDrill.ok),
        elapsedMs: Number(snapshot.lastTransportDrill.elapsedMs || 0),
        checks: (snapshot.lastTransportDrill.checks || []).map(check => ({ name: String(check.name || ''), ok: Boolean(check.ok), error: String(check.error || '') }))
      } : null
    },
    recovery: {
      phase: recovery.phase,
      verified: recovery.verified,
      complete: recovery.complete,
      total: recovery.total,
      checks: recovery.items.map(item => ({ id: item.id, complete: item.complete })),
      error: recovery.error
    },
    selfTest: snapshot.selfTest ? {
      ok: Boolean(snapshot.selfTest.ok),
      completedAt: Number(snapshot.selfTest.completedAt || 0),
      elapsedMs: Number(snapshot.selfTest.elapsedMs || 0),
      senderRttMs: Number(snapshot.selfTest.roles?.sender?.rttMs || 0),
      receiverRttMs: Number(snapshot.selfTest.roles?.receiver?.rttMs || 0),
      storageRttMs: Number(snapshot.selfTest.storage?.rttMs || 0),
      dashboardConnected: Boolean(snapshot.selfTest.dashboard?.connected)
    } : null,
    efficiency: {
      full: Number(efficiency.full || 0),
      delta: Number(efficiency.delta || 0),
      heartbeat: Number(efficiency.heartbeat || 0),
      lastMode: String(efficiency.lastMode || '')
    }
  };
}
