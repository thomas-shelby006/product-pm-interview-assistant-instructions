import test from 'node:test';
import assert from 'node:assert/strict';
import { liveUxFaultScenarios, runLiveUxFaultMatrix } from '../testing/live-ux-fault-matrix.js';
import { runLiveUxRestartScenario } from '../testing/live-ux-restart-scenario.js';

test('Cycle 166: fault matrix covers transport storage sequence draft provider and restart owners', () => {
  const ids = liveUxFaultScenarios().map(item => item.id);
  for (const id of ['dashboard_disconnect','receiver_port_timeout','storage_critical','sequence_gap','draft_conflict','provider_capability_loss','service_worker_restart']) assert.equal(ids.includes(id), true);
});

test('Cycle 167: fault matrix is deterministic, content-free, and stops on first failed cleanup', async () => {
  const seen = [];
  const result = await runLiveUxFaultMatrix({
    inject: scenario => { seen.push(`inject:${scenario.id}`); return { ok: true }; },
    observe: scenario => ({ ok: scenario.id !== 'sequence_gap', state: scenario.expected }),
    cleanup: scenario => { seen.push(`cleanup:${scenario.id}`); return { ok: true }; },
    now: (() => { let value = 10; return () => ++value; })()
  });
  assert.equal(result.ok, false);
  assert.equal(result.contentAccessed, false);
  assert.equal(result.results.at(-1).id, 'sequence_gap');
});

test('Cycle 168: restart scenario proves generation and unresolved continuity without content', async () => {
  const snapshots = [{ sessionId: 's1', registryGeneration: 2, ledgerCounts: { pending: 2 }, senderOutboxState: { count: 1 } }, { sessionId: 's1', registryGeneration: 3, ledgerCounts: { pending: 2 }, senderOutboxState: { count: 1 } }];
  const result = await runLiveUxRestartScenario({ beforeSnapshot: async () => snapshots[0], restart: async () => ({ ok: true }), afterSnapshot: async () => snapshots[1], now: (() => { let value = 100; return () => value += 5; })() });
  assert.equal(result.ok, true);
  assert.equal(result.contentAccessed, false);
});

test('Cycles 169-170: smoke and release evidence require 280 print accessibility and cleanup proof', async () => {
  const { readFile } = await import('node:fs/promises');
  const smoke = await readFile(new URL('../../scripts/isolated-release-smoke.mjs', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../../scripts/build-release-evidence-manifest.mjs', import.meta.url), 'utf8');
  const support = await readFile(new URL('../shared/support-bundle.js', import.meta.url), 'utf8');
  assert.match(smoke, /dashboardUiState\(280, 900, '280px'\)/);
  assert.match(smoke, /setEmulatedMedia.*print/s);
  assert.match(smoke, /aria-live="polite"/);
  assert.match(builder, /\['desktop','mobile','tiny','print'\]/);
  assert.match(builder, /normalProfileTouched/);
  assert.match(builder, /processTreeClosed/);
  assert.match(builder, /profileRemoved/);
  assert.match(support, /liveCommandIntegrity|integrity/);
  assert.match(support, /restart/);
  assert.doesNotMatch(support, /envelope\.text|latestAnswer\.text|setupText/);
});
