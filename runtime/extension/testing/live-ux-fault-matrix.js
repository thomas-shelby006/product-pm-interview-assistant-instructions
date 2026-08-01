import { runFaultScenario } from './fault-scenario-runner.js';

const SCENARIOS = Object.freeze([
  { id: 'dashboard_disconnect', owner: 'dashboard', expected: 'reconnect' },
  { id: 'receiver_port_timeout', owner: 'transport', expected: 'message_fallback' },
  { id: 'storage_critical', owner: 'storage', expected: 'queue_only' },
  { id: 'sequence_gap', owner: 'sequence', expected: 'buffer_and_nack' },
  { id: 'draft_conflict', owner: 'receiver', expected: 'operator_resolution' },
  { id: 'provider_capability_loss', owner: 'provider', expected: 'probation' },
  { id: 'service_worker_restart', owner: 'runtime', expected: 'rehydrate' }
]);

export function liveUxFaultScenarios() { return SCENARIOS.map(item => ({ ...item })); }

export async function runLiveUxFaultMatrix({ inject, observe, cleanup, now = Date.now } = {}) {
  const results = [];
  for (const scenario of SCENARIOS) {
    const result = await runFaultScenario({ id: scenario.id, inject: () => inject?.(scenario), observe: () => observe?.(scenario), cleanup: () => cleanup?.(scenario), now });
    results.push({ ...scenario, ...result });
    if (!result.ok) break;
  }
  return { ok: results.length === SCENARIOS.length && results.every(item => item.ok), results, contentAccessed: false };
}
