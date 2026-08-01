import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeHealthReport } from '../dashboard/health-report-model.js';

test('Safe Health Report excludes question answer and setup text', () => {
  const report = buildSafeHealthReport({
    sessionId: 's1', mode: 'active', dashboardConnections: 1, contextArmed: true,
    sender: { connected: true, phase: 'ready', composerReady: true, heartbeatAt: 1000, adapterCapabilities: { complete: true } },
    receiver: { connected: true, phase: 'ready', composerReady: true, heartbeatAt: 1000, adapterCapabilities: { complete: true }, latestAnswer: { text: 'SECRET ANSWER' } },
    latestFinal: { text: 'SECRET QUESTION' },
    ledger: [{ envelope: { text: 'SECRET LEDGER TEXT' } }],
    ledgerCounts: { total: 1, pending: 0, inFlight: 0, proven: 1 },
    batchState: {}, storagePressure: { level: 'normal', percent: 0, breakdown: {} },
    warnings: [], metrics: {}, timeline: [{ type: 'session_armed', data: { text: 'SECRET SETUP' } }],
    lastRepair: null, uptimeMs: 10
  }, 1000);
  const json = JSON.stringify(report);
  assert.doesNotMatch(json, /SECRET QUESTION|SECRET ANSWER|SECRET LEDGER TEXT|SECRET SETUP/);
  assert.equal(report.readiness.state, 'ready');
});
