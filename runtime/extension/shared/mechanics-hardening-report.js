import { derivePrerenderGuard } from './prerender-guard.js';
import { claimRuntimeInjection } from './runtime-injection-fence.js';
import { summarizeWakeHistory } from './wake-history.js';
import { isCurrentAlarmGeneration } from './alarm-generation-identity.js';
import { deriveStartupDeadlineCatchup } from './startup-deadline-catchup.js';
import { SelectorProbeRegistry } from './selector-probe-registry.js';
import { normalizeSelectorFallbackSet } from './selector-fallback-set.js';
import { deriveDomDriftDelta } from './dom-drift-delta.js';
import { buildComposerOwnershipFingerprint } from './composer-ownership-fingerprint.js';
import { proveStableSendControl } from './stable-send-control-proof.js';
import { canonicalRenderedTurnIdentity } from './rendered-turn-identity.js';
import { buildPartialProofReport } from './partial-proof-report.js';
import { deriveProofRetryPolicy } from './proof-retry-policy.js';
import { tombstoneMatches } from './durable-tombstones.js';
import { deriveCompactionHorizon } from './compaction-horizon.js';
import { scheduleFairBatch } from './fair-batch-scheduler.js';
import { starvationSummary } from './starvation-promotion.js';
import { auditSessionIsolation } from './session-isolation-audit.js';
import { resumeCleanupTransaction } from './cleanup-transaction-journal.js';
import { collectOrphanManagedWindows } from './orphan-window-collector.js';
import { searchFaultCatalog } from './fault-catalog.js';
import { createReproducibilitySeed } from './reproducibility-seed.js';
import { auditReasonCodeRegistry } from './reason-code-registry.js';
import { buildArchitectureBudgetReport } from './architecture-budget-report.js';
import { auditArchitectureBoundaries } from './architecture-boundary-audit.js';
import { validateReleaseIdentity } from './release-identity.js';

export function deriveMechanicsHardeningReport(snapshot = {}, context = {}) {
  const selectors = normalizeSelectorFallbackSet(snapshot.selectorFallbacks || {});
  const registry = new SelectorProbeRegistry();
  for (const [surface, values] of Object.entries(selectors)) registry.register(surface, values);
  const partitions = snapshot.batchState?.next?.partitions || [];
  const unresolved = (snapshot.ledger || []).filter(item => !['proven','archived'].includes(item.state));
  return {
    prerender: derivePrerenderGuard(snapshot.pageLifecycle || context.pageLifecycle || {}),
    runtimeFence: claimRuntimeInjection(snapshot.runtimeOwner || null, snapshot.runtimeOwner || { instanceId: 'missing', documentId: 'missing' }, Date.now()),
    wakeHistory: summarizeWakeHistory(snapshot.wakeHistory || []),
    alarmGenerationCurrent: isCurrentAlarmGeneration(snapshot.alarmIdentity || {}, snapshot.transportSession?.generation || 0),
    startupCatchup: deriveStartupDeadlineCatchup({ schedules: snapshot.recoverySchedules || [], now: Date.now(), generation: snapshot.transportSession?.generation || 0 }),
    selectorSurfaces: Object.keys(registry.snapshot()).length,
    selectorDrift: deriveDomDriftDelta(snapshot.previousSelectorEvidence || {}, snapshot.selectorEvidence || {}, Date.now()),
    composerFingerprint: buildComposerOwnershipFingerprint(snapshot.composerEvidence || {}),
    sendControlProof: proveStableSendControl(snapshot.sendControlSamples || []),
    latestRenderedTurn: canonicalRenderedTurnIdentity(snapshot.latestRenderedTurn || {}),
    partialProof: buildPartialProofReport(snapshot.partialProof || {}),
    proofRetry: deriveProofRetryPolicy(snapshot.proofRetry || {}),
    duplicateTombstone: tombstoneMatches(snapshot.tombstones || [], snapshot.latestFinal || {}),
    compaction: deriveCompactionHorizon(snapshot.ledger || [], { tombstones: snapshot.tombstones || [] }),
    fairBatch: scheduleFairBatch(partitions, { lastSource: snapshot.batchState?.lastSource || '' }),
    starvation: starvationSummary(partitions),
    isolation: auditSessionIsolation(context.sessions || [snapshot]),
    cleanupResume: resumeCleanupTransaction(snapshot.cleanupTransaction || {}),
    orphans: collectOrphanManagedWindows({ sessions: context.sessions || [snapshot], windows: context.windows || [] }),
    faults: searchFaultCatalog(snapshot.rootCause?.code || '').slice(0, 5),
    reproducibility: createReproducibilitySeed(`${snapshot.sessionId || ''}:${snapshot.createdAt || 0}`),
    reasonCodes: auditReasonCodeRegistry(snapshot.timeline || []),
    architectureBudget: buildArchitectureBudgetReport(context.modules || []),
    architectureBoundaries: auditArchitectureBoundaries(context.modules || []),
    releaseIdentity: validateReleaseIdentity(snapshot.releaseIdentity || {})
  };
}
