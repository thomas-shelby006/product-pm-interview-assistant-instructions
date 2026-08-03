import { RuntimePilotState } from './runtime-pilot-state.js';
import { estimateStorageCategories } from './storage-accounting.js';
import { createStateCommitJournal, recoverCommittedState } from './state-commit-journal.js';
import { validateRuntimeState } from './runtime-invariants.js';
import { encodeRuntimeEnvelope, normalizeRuntimeEnvelope, RUNTIME_STATE_SCHEMA_VERSION } from './runtime-state-schema.js';
import { migrateRuntimeEnvelope } from './runtime-state-migrations.js';
import { createStateQuarantine, preserveStateQuarantine, quarantineAudit } from './state-quarantine.js';
import { sealRuntimeEnvelope, verifyRuntimeEnvelope } from './state-integrity.js';

function stateHash(value) {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(value ?? null)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createRuntimePilotStore({
  storageArea,
  key = 'pmia_runtime_pilot_v1',
  writerVersion = globalThis.chrome?.runtime?.getManifest?.().version || 'unknown'
} = {}) {
  if (!storageArea?.get || !storageArea?.set || !storageArea?.remove) {
    throw new TypeError('PMIA runtime pilot requires chrome.storage.session');
  }
  const journalKey = `${key}_commit_journal`;
  const previousKey = `${key}_previous_applied`;
  const quarantineKey = `${key}_quarantine`;
  let statePromise = null;
  let writePromise = Promise.resolve();
  let commitJournal = createStateCommitJournal();
  let lastAudit = { recovered: false, repaired: 0, blocked: 0, findings: [], quarantine: quarantineAudit(null) };

  async function hydrate() {
    const stored = await storageArea.get([key, journalKey, previousKey, quarantineKey]);
    commitJournal = createStateCommitJournal(stored[journalKey] || {});
    const recovered = recoverCommittedState({
      currentState: stored[key] ?? [],
      previousState: stored[previousKey] ?? [],
      journal: stored[journalKey] || {}
    });
    const quarantineAndBlock = async (state, reason, extra = {}) => {
      const quarantine = preserveStateQuarantine(stored[quarantineKey], createStateQuarantine(state, reason));
      await storageArea.set({ [quarantineKey]: quarantine });
      lastAudit = {
        recovered: recovered.recovered,
        recoveryReason: recovered.reason,
        repaired: 0,
        blocked: 1,
        findings: [{ severity: 'blocked', code: reason }],
        quarantine: quarantineAudit(quarantine),
        ...extra
      };
      throw new Error(`runtime_state_blocked:${reason}`);
    };
    const prepare = raw => {
      const normalized = normalizeRuntimeEnvelope(raw, { writerVersion });
      if (!normalized.ok) return { ok: false, reason: normalized.reason, raw };
      const integrity = verifyRuntimeEnvelope(normalized.envelope);
      if (!integrity.ok && integrity.reason !== 'digest_missing') {
        return { ok: false, reason: integrity.reason, normalized, integrity, envelope: normalized.envelope, raw };
      }
      const migration = migrateRuntimeEnvelope(normalized.envelope, RUNTIME_STATE_SCHEMA_VERSION, {
        writerVersion,
        now: Date.now()
      });
      if (!migration.ok) return { ok: false, reason: migration.reason, normalized, migration, integrity, raw };
      return {
        ok: true,
        reason: integrity.reason,
        normalized,
        migration,
        integrity,
        envelope: migration.envelope,
        unsigned: integrity.reason === 'digest_missing' || migration.applied.length > 0
      };
    };
    let prepared = prepare(recovered.state);
    if (!prepared.ok && prepared.reason !== 'digest_mismatch') {
      return quarantineAndBlock(prepared.normalized?.envelope || recovered.state, prepared.reason);
    }
    let integrityState = prepared.integrity?.ok ? 'verified' : prepared.unsigned ? 'sealed' : 'blocked';
    let integrityReason = prepared.reason;
    let integrityRecovered = false;
    if (!prepared.ok && prepared.reason === 'digest_mismatch') {
      const previous = prepare(stored[previousKey]);
      if (!previous.ok) {
        return quarantineAndBlock(prepared.envelope, 'digest_mismatch', {
          integrity: { state: 'blocked', reason: 'digest_mismatch', expected: prepared.integrity.expected, actual: prepared.integrity.actual }
        });
      }
      prepared = previous;
      integrityState = 'recovered';
      integrityReason = 'digest_mismatch';
      integrityRecovered = true;
    }
    if (recovered.recovered) commitJournal = createStateCommitJournal(recovered.journal);
    const invariant = validateRuntimeState(prepared.envelope.sessions);
    if (invariant.blocked > 0) {
      return quarantineAndBlock(prepared.envelope, 'runtime_invariant_blocked', {
        repaired: invariant.repaired,
        blocked: invariant.blocked,
        findings: invariant.findings,
        integrity: { state: integrityState, reason: integrityReason },
        schema: { version: prepared.envelope.schemaVersion, writerVersion: prepared.envelope.writerVersion, legacy: prepared.normalized.legacy, migration: prepared.migration.applied }
      });
    }
    const baseEnvelope = invariant.repaired > 0
      ? encodeRuntimeEnvelope(invariant.state, { writerVersion })
      : prepared.envelope;
    const repairedEnvelope = sealRuntimeEnvelope(baseEnvelope);
    lastAudit = {
      recovered: recovered.recovered || integrityRecovered,
      recoveryReason: integrityRecovered ? 'digest_mismatch' : recovered.reason,
      repaired: invariant.repaired,
      blocked: invariant.blocked,
      findings: invariant.findings,
      quarantine: quarantineAudit(stored[quarantineKey]),
      integrity: {
        state: integrityState,
        reason: integrityReason,
        expected: prepared.integrity?.expected || '',
        actual: prepared.integrity?.actual || repairedEnvelope.integrityDigest
      },
      schema: {
        version: repairedEnvelope.schemaVersion,
        writerVersion: repairedEnvelope.writerVersion,
        legacy: prepared.normalized.legacy,
        migration: prepared.migration.applied
      }
    };
    if (recovered.recovered || integrityRecovered || prepared.unsigned || prepared.migration.applied.length || invariant.repaired > 0) {
      await storageArea.set({
        [key]: repairedEnvelope,
        ...(recovered.recovered ? { [journalKey]: commitJournal.snapshot() } : {})
      });
    }
    return new RuntimePilotState(invariant.state);
  }

  function enqueueWrite(task) {
    const run = writePromise.then(task, task);
    writePromise = run.catch(() => {});
    return run;
  }

  return {
    async load() {
      if (!statePromise) {
        statePromise = hydrate().catch(error => {
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
      return enqueueWrite(async () => {
        const nextEnvelope = sealRuntimeEnvelope(encodeRuntimeEnvelope(state.exportState(), { writerVersion }));
        const current = await storageArea.get(key);
        const prepared = commitJournal.prepare({ stateHash: stateHash(nextEnvelope) });
        await storageArea.set({
          [previousKey]: current[key] ?? sealRuntimeEnvelope(encodeRuntimeEnvelope([], { writerVersion })),
          [journalKey]: prepared
        });
        await storageArea.set({ [key]: nextEnvelope });
        const applied = commitJournal.apply(prepared.generation);
        await storageArea.set({ [journalKey]: applied });
      });
    },

    estimate(state) {
      if (!(state instanceof RuntimePilotState)) throw new TypeError('Invalid PMIA runtime pilot state');
      return estimateStorageCategories(state.exportState());
    },

    async bytesInUse() {
      if (typeof storageArea.getBytesInUse !== 'function') return 0;
      return Number(await storageArea.getBytesInUse(null)) || 0;
    },

    audit() {
      return {
        ...lastAudit,
        findings: (lastAudit.findings || []).map(item => ({ ...item })),
        commit: commitJournal.snapshot()
      };
    },

    async clear() {
      return enqueueWrite(async () => {
        statePromise = Promise.resolve(new RuntimePilotState());
        commitJournal = createStateCommitJournal();
        lastAudit = { recovered: false, repaired: 0, blocked: 0, findings: [], quarantine: quarantineAudit(null) };
        await storageArea.remove([key, journalKey, previousKey, quarantineKey]);
      });
    },

    resetCache() {
      statePromise = null;
    }
  };
}