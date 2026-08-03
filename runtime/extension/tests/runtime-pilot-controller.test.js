import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRegistry } from '../shared/session-registry.js';
import { createRuntimePilotController } from '../shared/runtime-pilot-controller.js';
import { senderOutboxStorageKey } from '../shared/session-end-guard.js';

function memoryArea() {
  const data = {};
  return {
    async get(key) {
      if (Array.isArray(key)) return Object.fromEntries(key.map(item => [item, data[item]]));
      return key ? { [key]: data[key] } : { ...data };
    },
    async set(values) { Object.assign(data, values); },
    async remove(key) { for (const item of Array.isArray(key) ? key : [key]) delete data[item]; }
  };
}

function envelope(id, seq) {
  return {
    id,
    sessionId: 's1',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text: `Question ${seq}`,
    metadata: {},
    createdAt: seq
  };
}

function setup({ requestRole = null, storageArea: providedStorageArea = null } = {}) {
  const registry = new SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1 }, { now: 1 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 }, { now: 1 });
  const deliveries = [];
  const runtimeCommands = [];
  const chromeApi = {
    tabs: {
      async get(tabId) {
        return {
          id: tabId,
          windowId: tabId + 10,
          url: tabId === 1 ? 'https://chatgpt.com/' : 'https://claude.ai/new'
        };
      },
      async sendMessage(tabId, message) {
        if (message.type === 'PMIA_RUNTIME_COMMAND') {
          runtimeCommands.push([tabId, message.command, message.payload || {}]);
          if (message.command === 'reconcile_delivery') {
            return { ok: true, replayed: message.payload.pending.map(item => item.id) };
          }
          if (message.command === 'self_test_probe') {
            return {
              ok: true,
              probe: 'pmia_self_test',
              role: tabId === 1 ? 'sender' : 'receiver',
              composerReady: true,
              visibilityState: 'hidden'
            };
          }
          return { ok: true };
        }
        if (message.type === 'PMIA_PREFLIGHT_PING') {
          return { ok: true, composerAvailable: true };
        }
        return { ok: true, reason: 'accepted' };
      },
      async reload() {},
      async remove() {}
    },
    windows: { async update() {}, async create() { return { id: 99 }; } },
    alarms: { async create() {}, async clear() { return true; } }
  };
  const storageArea = providedStorageArea || memoryArea();
  const controller = createRuntimePilotController({
    chromeApi,
    storageArea,
    registryProvider: async () => registry,
    saveRegistry: async () => {},
    async deliverFinal(route) {
      deliveries.push(route.message.id);
      return {
        delivered: true,
        queued: false,
        reason: 'accepted',
        proof: { verified: true, proof: 'new_rendered_turn', memberIds: ['q1', 'q2'] }
      };
    },
    appendLog: async () => {},
    broadcastLinkStatus: async () => {},
    exportManagedSession: async () => ({ ok: true }),
    clearSessionLogs: async () => {},
    requestRole
  });
  return { controller, registry, deliveries, runtimeCommands, storageArea };
}

async function ready(controller, registry) {
  await controller.syncRegistration(registry.getSession('s1').sender);
  await controller.syncRegistration(registry.getSession('s1').receiver);
  await controller.telemetry({
    sessionId: 's1', role: 'sender', tabId: 1,
    telemetry: { composerReady: true, phase: 'ready' }
  });
  await controller.telemetry({
    sessionId: 's1', role: 'receiver', tabId: 2,
    telemetry: { composerReady: true, phase: 'ready' }
  });
}

test('pause persists every final and resume reconciles the entire lossless inbox', async () => {
  const { controller, registry, deliveries, runtimeCommands } = setup();
  await ready(controller, registry);
  await controller.handleCommand({ sessionId: 's1', requestId: 'pause-1', command: 'pause' });
  const firstAdmission = await controller.beforeForward(envelope('q1', 1));
  const secondAdmission = await controller.beforeForward(envelope('q2', 2));
  assert.equal(firstAdmission.response, null);
  assert.equal(secondAdmission.response, null);
  const paused = await controller.snapshot('s1');
  assert.equal(paused.mode, 'paused');
  assert.equal(paused.batchState.turnCoordination.mode, 'paused_accumulating');
  assert.deepEqual(paused.ledger.map(item => [item.id, item.state]), [
    ['q1', 'persisted'], ['q2', 'persisted']
  ]);

  const resumed = await controller.handleCommand({
    sessionId: 's1', requestId: 'resume-1', command: 'resume_catch_up'
  });
  assert.equal(resumed.ok, true);
  assert.deepEqual(deliveries, []);
  const reconciliation = runtimeCommands.find(([, command]) => command === 'reconcile_delivery');
  assert.deepEqual(reconciliation[2].pending.map(item => item.id), ['q1', 'q2']);
  assert.deepEqual((await controller.snapshot('s1')).ledger.map(item => item.id), ['q1', 'q2']);
});

test('batch proof transitions every member while unrelated finals remain unresolved', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  await controller.beforeForward(envelope('q1', 1));
  await controller.beforeForward(envelope('q2', 2));
  await controller.beforeForward(envelope('q3', 3));
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'batch_submitted',
      batchId: 'batch-1',
      memberIds: ['q1', 'q2'],
      proof: { verified: true, proof: 'new_rendered_turn', memberIds: ['q1', 'q2'] }
    }
  });
  assert.deepEqual((await controller.snapshot('s1')).ledger.map(item => [item.id, item.state]), [
    ['q1', 'proven'], ['q2', 'proven'], ['q3', 'persisted']
  ]);
});

test('a directly delivered newer final never supersedes an older unresolved final', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  await controller.handleCommand({ sessionId: 's1', requestId: 'pause-2', command: 'pause' });
  await controller.beforeForward(envelope('q1', 1));
  await controller.handleCommand({ sessionId: 's1', requestId: 'resume-2', command: 'resume_without_send' });
  const newer = envelope('q2', 2);
  await controller.beforeForward(newer);
  await controller.afterForward(newer, {
    delivered: true,
    queued: false,
    reason: 'accepted',
    proof: { verified: true, proof: 'new_rendered_turn' }
  });
  assert.deepEqual((await controller.snapshot('s1')).ledger.map(item => [item.id, item.state]), [
    ['q1', 'persisted'], ['q2', 'proven']
  ]);
});

test('submit selected admits one receiver delivery while transport stays paused', async () => {
  const { controller, registry, deliveries } = setup();
  await ready(controller, registry);
  await controller.handleCommand({ sessionId: 's1', requestId: 'pause-3', command: 'pause' });
  await controller.beforeForward(envelope('q1', 1));
  const result = await controller.handleCommand({
    sessionId: 's1',
    requestId: 'selected-1',
    command: 'submit_selected',
    payload: { queueItemId: 'q1' }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(deliveries, ['q1']);
  const snapshot = await controller.snapshot('s1');
  assert.equal(snapshot.mode, 'paused');
  assert.equal(snapshot.ledger[0].state, 'proven');
});

test('end session removes registry and pilot state without recreating a ghost session', async () => {
  const { controller, registry } = setup();
  await controller.syncRegistration(registry.getSession('s1').sender);
  const prepared = await controller.handleCommand({
    sessionId: 's1', requestId: 'end-prepare-1', command: 'prepare_end_session'
  });
  const result = await controller.handleCommand({
    sessionId: 's1', requestId: 'end-1', command: 'end_session',
    payload: { confirmToken: prepared.token, mode: 'clean' }
  });
  assert.equal(prepared.canEnd, true);
  assert.equal(result.ok, true);
  assert.equal(registry.getSession('s1'), null);
  assert.equal(await controller.snapshot('s1'), null);
  assert.deepEqual(result.closeTabIds.sort(), [1, 2]);
});

test('healthy role telemetry alone never completes semantic recovery', async () => {
  const { controller, registry } = setup();
  await controller.syncRegistration(registry.getSession('s1').sender);
  await controller.syncRegistration(registry.getSession('s1').receiver);
  const repair = await controller.handleCommand({
    sessionId: 's1', requestId: 'repair-1', command: 'repair_runtime'
  });
  assert.equal(repair.pendingVerification, true);
  assert.equal((await controller.snapshot('s1')).mode, 'repairing');
  await controller.telemetry({
    sessionId: 's1', role: 'sender', tabId: 1,
    telemetry: { composerReady: true, phase: 'ready' }
  });
  assert.equal((await controller.snapshot('s1')).mode, 'repairing');
  await controller.telemetry({
    sessionId: 's1', role: 'receiver', tabId: 2,
    telemetry: { composerReady: true, phase: 'ready' }
  });
  const snapshot = await controller.snapshot('s1');
  assert.equal(snapshot.mode, 'repairing');
  assert.equal(snapshot.lastRepair.verified, false);
  assert.equal(snapshot.lastRepair.checks.reconciliation, true);
});

test('heartbeat-only telemetry is coalesced after semantic state is established', async () => {
  const { controller, registry } = setup();
  await controller.syncRegistration(registry.getSession('s1').sender);
  const first = await controller.telemetry({
    sessionId: 's1', role: 'sender', tabId: 1,
    telemetry: {
      composerReady: true,
      phase: 'ready',
      sourceSilenceState: 'healthy',
      sourceSilenceMs: 1000
    }
  });
  const heartbeat = await controller.telemetry({
    sessionId: 's1', role: 'sender', tabId: 1,
    telemetry: {
      composerReady: true,
      phase: 'ready',
      sourceSilenceState: 'healthy',
      sourceSilenceMs: 6000
    }
  });
  assert.equal(first.coalesced, false);
  assert.equal(heartbeat.coalesced, true);
});


test('dashboard runtime commands prefer the direct role request path', async () => {
  const direct = [];
  const { controller, registry, runtimeCommands } = setup({
    async requestRole(frame) {
      direct.push([frame.role, frame.command, frame.payload]);
      return { ok: true, hold: Boolean(frame.payload.value) };
    }
  });
  await ready(controller, registry);
  const result = await controller.handleCommand({
    sessionId: 's1', requestId: 'hold-direct', command: 'set_hold', payload: { value: true }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(direct, [['receiver', 'set_hold', { value: true }]]);
  assert.equal(runtimeCommands.some(([, command]) => command === 'set_hold'), false);
});

test('receiver batch checkpoint restores Pilot state after volatile draft events', async () => {
  const { controller, registry } = setup();
  await controller.syncRegistration(registry.getSession('s1').receiver);
  const result = await controller.telemetry({
    sessionId: 's1', role: 'receiver', tabId: 2,
    telemetry: {
      composerReady: true,
      phase: 'ready',
      batchState: {
        active: { batchId: 'b1', memberIds: ['q1'], questionCount: 1 },
        next: { memberIds: ['q2', 'q3'], questionCount: 2 },
        hold: true,
        autoSubmit: false
      }
    }
  });
  assert.equal(result.coalesced, false);
  assert.deepEqual((await controller.snapshot('s1')).batchState.next.memberIds, ['q2', 'q3']);
  assert.equal((await controller.snapshot('s1')).batchState.hold, true);
});


test('unverified batch submission does not close ledger members', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  await controller.beforeForward(envelope('q1', 1));
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'batch_submitted',
      batchId: 'batch-1',
      memberIds: ['q1'],
      proof: { ok: true, verified: false, proof: 'submit_action_only' }
    }
  });
  assert.equal((await controller.snapshot('s1')).ledger[0].state, 'submitting');
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'batch_reconciled',
      batchId: 'batch-1',
      memberIds: ['q1'],
      proof: { ok: true, verified: true, proof: 'existing_rendered_batch', memberIds: ['q1'] }
    }
  });
  assert.equal((await controller.snapshot('s1')).ledger[0].state, 'proven');
});


test('controller serializes external mutations by session without a global state lane', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'shared/runtime-pilot-controller.js'), 'utf8');
  assert.match(source, /createSessionMutationCoordinator/);
  assert.match(source, /handleCommand: raw => \{[\s\S]*mutationCoordinator\.run\(command\.sessionId/);
  assert.match(source, /scheduleBatchCheckpoint[\s\S]*mutationCoordinator\.run\(sessionId/);
  assert.doesNotMatch(source, /operationQueue/);
  assert.doesNotMatch(source, /serializeOperation/);
});


test('failed durable persistence discards the mutated cache before sender retry', async () => {
  const storageArea = memoryArea();
  const originalSet = storageArea.set.bind(storageArea);
  let failNextStateWrite = false;
  storageArea.set = async values => {
    if (failNextStateWrite && Object.hasOwn(values, 'pmia_runtime_pilot_v1')) {
      failNextStateWrite = false;
      throw new Error('synthetic write failure');
    }
    return originalSet(values);
  };
  const { controller, registry } = setup({ storageArea });
  await ready(controller, registry);
  failNextStateWrite = true;
  const failed = await controller.beforeForward(envelope('retry-q1', 1));
  assert.equal(failed.persisted, false);
  assert.equal(failed.response.error, 'persist_failed');
  assert.equal((await controller.snapshot('s1')).ledger.some(item => item.id === 'retry-q1'), false);
  const retried = await controller.beforeForward(envelope('retry-q1', 1));
  assert.equal(retried.persisted, true);
  assert.deepEqual((await controller.snapshot('s1')).ledger.map(item => item.id), ['retry-q1']);
});


test('controller sends one full snapshot then semantic deltas per dashboard port', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'shared/runtime-pilot-controller.js'), 'utf8');
  assert.match(source, /PMIA_DASHBOARD_DELTA/);
  assert.match(source, /buildSnapshotDelta\(entry\.lastSnapshot, snapshot, \{ baseGeneration: entry\.generation, nextGeneration \}\)/);
  assert.match(source, /lastSnapshot:\s*null/);
});


test('heartbeat telemetry cannot clear repair without reconciliation', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'shared/runtime-pilot-controller.js'), 'utf8');
  const telemetry = source.slice(source.indexOf('async function telemetry'), source.indexOf('async function evaluateDeliverySla'));
  assert.doesNotMatch(telemetry, /setMode\(sessionId, 'active'\)/);
  assert.match(telemetry, /currentRecoveryChecks/);
  assert.match(source, /reconciliation:\s*result\.ok !== false/);
});


test('repair coordinator schedules durable bounded verification without activating tabs', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const controller = await readFile(resolve(extensionRoot, 'shared/runtime-pilot-controller.js'), 'utf8');
  const coordinator = await readFile(resolve(extensionRoot, 'shared/runtime-recovery-coordinator.js'), 'utf8');
  assert.match(controller, /recoveryCoordinator\.scheduleVerification/);
  assert.match(coordinator, /if \(attempt >= 4\) return false/);
  assert.match(coordinator, /scheduleRecoveryAlarm/);
  assert.doesNotMatch(coordinator, /setTimeout|active:\s*true|focused:\s*true/);
});

test('duplicate dashboard request returns the original command result', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  const command = { sessionId: 's1', requestId: 'same-request', command: 'check_live', payload: {} };
  const first = await controller.handleCommand(command);
  const second = await controller.handleCommand(command);
  assert.equal(second.ok, first.ok);
  assert.equal(second.replayed, true);
  assert.equal(second.roles?.sender?.responsive, first.roles?.sender?.responsive);
});

test('end session remains blocked while durable sender outbox items exist', async () => {
  const { controller, registry, storageArea } = setup();
  await controller.syncRegistration(registry.getSession('s1').sender);
  await storageArea.set({
    [senderOutboxStorageKey('s1')]: [
      { envelope: envelope('outbox-1', 1) },
      { envelope: envelope('outbox-2', 2) }
    ]
  });
  await controller.telemetry({
    sessionId: 's1', role: 'sender', tabId: 1,
    telemetry: { event: { type: 'outbox_state', count: 2 } }
  });
  const prepared = await controller.handleCommand({
    sessionId: 's1', requestId: 'blocked-prepare', command: 'prepare_end_session'
  });
  const result = await controller.handleCommand({
    sessionId: 's1', requestId: 'blocked-end', command: 'end_session',
    payload: { confirmToken: prepared.token, mode: 'clean' }
  });
  assert.equal(prepared.counts.unpersisted, 2);
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.ok(registry.getSession('s1'));
});


test('active runtime self-test stores safe role storage and dashboard results', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  const result = await controller.handleCommand({
    sessionId: 's1', requestId: 'self-test-1', command: 'run_self_test'
  });
  assert.equal(result.roles.sender.ok, true);
  assert.equal(result.roles.receiver.ok, true);
  assert.equal(result.storage.ok, true);
  assert.equal(result.dashboard.connected, false);
  assert.equal(result.ok, false);
  const snapshot = await controller.snapshot('s1');
  assert.equal(snapshot.selfTest.completedAt, result.completedAt);
  assert.equal(JSON.stringify(snapshot.selfTest).includes('Question'), false);
});


test('dashboard broadcast contains live Production data instead of a blocked fallback', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  const messages = [];
  const port = {
    name: 'pmia-dashboard:s1',
    sender: { tab: { id: 3, windowId: 13 } },
    postMessage(message) { messages.push(message); },
    onMessage: { addListener() {} },
    onDisconnect: { addListener() {} }
  };
  assert.equal(controller.connectPort(port), true);
  await new Promise(resolve => setTimeout(resolve, 40));
  const message = [...messages].reverse().find(item => item.type === 'PMIA_DASHBOARD_SNAPSHOT');
  assert.ok(message, JSON.stringify(messages));
  assert.ok(message.snapshot.production, JSON.stringify(message.snapshot.warnings || []));
  assert.notEqual(message.snapshot.production.diagnostics.state, 'waiting');
  assert.notEqual(message.snapshot.production.transportAssurance.state, 'unknown');
});

test('forwarding pause keeps sender admission live and holds only receiver submission', async () => {
  const direct = [];
  const { controller, registry, runtimeCommands } = setup({
    async requestRole(frame) {
      direct.push([frame.role, frame.command, frame.payload || {}]);
      return { ok: true };
    }
  });
  await ready(controller, registry);
  const paused = await controller.handleCommand({ sessionId: 's1', requestId: 'pause-forwarding', command: 'pause', payload: {} });
  assert.equal(paused.ok, true);
  assert.deepEqual(direct, [['receiver', 'pause_forwarding', {}]]);
  assert.equal(runtimeCommands.some(([, command]) => command === 'pause'), false);
  assert.equal((await controller.snapshot('s1')).mode, 'paused');
});

test('resume catch-up submits the held receiver batch and only resumes sender for compatibility', async () => {
  const direct = [];
  const { controller, registry } = setup({
    async requestRole(frame) {
      direct.push([frame.role, frame.command, frame.payload || {}]);
      if (frame.command === 'reconcile_delivery') return { ok: true, replayed: [] };
      return { ok: true };
    }
  });
  await ready(controller, registry);
  await controller.handleCommand({ sessionId: 's1', requestId: 'pause-first', command: 'pause', payload: {} });
  direct.length = 0;
  const resumed = await controller.handleCommand({ sessionId: 's1', requestId: 'resume-send', command: 'resume_catch_up', payload: {} });
  assert.equal(resumed.ok, true);
  assert.equal(direct.some(([role, command, payload]) => role === 'receiver' && command === 'resume_forwarding' && payload.submit === true), true);
  assert.equal(direct.some(([role, command]) => role === 'sender' && command === 'pause'), false);
});


test('duplicate coordination recovery requests execute the receiver command once', async () => {
  const { controller, registry, runtimeCommands } = setup();
  await ready(controller, registry);
  for (const command of ['retry_carryover', 'keep_accumulating']) {
    const request = {
      sessionId: 's1',
      requestId: `${command}-same-request`,
      command,
      payload: {}
    };
    const first = await controller.handleCommand(request);
    const second = await controller.handleCommand(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.replayed, true);
    assert.equal(
      runtimeCommands.filter(([, value]) => value === command).length,
      1,
      `${command} must execute exactly once`
    );
  }
});


test('controller records final persistence and first receiver staging latency', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  const final = envelope('metric-q1', 1);
  final.createdAt = Date.now() - 5;
  await controller.beforeForward(final);
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'next_batch_draft',
      at: Date.now(),
      memberIds: ['metric-q1'],
      questionCount: 1,
      written: true
    }
  });
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'batch_submitting',
      at: Date.now() + 1,
      batchId: 'metric-batch',
      memberIds: ['metric-q1'],
      questionCount: 1
    }
  });
  const snapshot = await controller.snapshot('s1');
  const samples = snapshot.metrics.turnCoordination.samples;
  assert.equal(samples.filter(item => item.stage === 'observe_persist').length, 1);
  assert.equal(samples.filter(item => item.stage === 'persist_stage').length, 1);
  assert.equal(samples.every(item => item.correlationId === 'metric-q1'), true);
  assert.doesNotMatch(JSON.stringify(samples), /Question 1/);
});


test('durable final admission bypasses a blocked operational session mutation', async () => {
  let releaseProbe;
  let markProbeStarted;
  const probeStarted = new Promise(resolve => { markProbeStarted = resolve; });
  const blockedProbe = new Promise(resolve => { releaseProbe = resolve; });
  const requestRole = async ({ command, role, fallback }) => {
    if (command !== 'self_test_probe') return fallback();
    markProbeStarted();
    return blockedProbe.then(() => ({
      ok: true, probe: 'pmia_self_test', role,
      composerReady: true, visibilityState: 'hidden'
    }));
  };
  const { controller, registry } = setup({ requestRole });
  await ready(controller, registry);
  const operation = controller.handleCommand({
    sessionId: 's1', requestId: 'blocked-self-test', command: 'run_self_test', payload: {}
  });
  await probeStarted;
  const admission = controller.beforeForward(envelope('urgent-q1', 1));
  const result = await Promise.race([
    admission,
    new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))
  ]);
  assert.equal(result.timedOut, undefined);
  assert.equal(result.persisted, true);
  assert.equal((await controller.snapshot('s1')).ledger.some(item => item.id === 'urgent-q1'), true);
  releaseProbe();
  await operation;
  const final = await controller.snapshot('s1');
  assert.ok(final.selfTest.completedAt > 0);
  assert.equal(final.selfTest.roles.sender.ok, true);
  assert.equal(final.selfTest.roles.receiver.ok, true);
  assert.equal(final.ledger.some(item => item.id === 'urgent-q1'), true);
});


test('end preparation waits for an in-flight durable admission', async () => {
  let releaseBytes;
  let markBytesStarted;
  let blockNextBytes = false;
  const bytesStarted = new Promise(resolve => { markBytesStarted = resolve; });
  const bytesGate = new Promise(resolve => { releaseBytes = resolve; });
  const storageArea = memoryArea();
  storageArea.getBytesInUse = async () => {
    if (blockNextBytes) {
      blockNextBytes = false;
      markBytesStarted();
      await bytesGate;
    }
    return 0;
  };
  const { controller, registry } = setup({ storageArea });
  await ready(controller, registry);
  blockNextBytes = true;
  const admission = controller.beforeForward(envelope('ending-q1', 1));
  await bytesStarted;
  const preparation = controller.handleCommand({
    sessionId: 's1', requestId: 'end-race-prepare', command: 'prepare_end_session', payload: {}
  });
  const early = await Promise.race([
    preparation.then(() => 'resolved'),
    new Promise(resolve => setTimeout(() => resolve('waiting'), 25))
  ]);
  assert.equal(early, 'waiting');
  releaseBytes();
  assert.equal((await admission).persisted, true);
  const prepared = await preparation;
  assert.equal(prepared.canEnd, false);
  assert.equal(prepared.counts.actionable, 1);
});

test('a final queued after exact session end is rejected without recreating state', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  const prepared = await controller.handleCommand({
    sessionId: 's1', requestId: 'clean-end-prepare', command: 'prepare_end_session', payload: {}
  });
  const ended = await controller.handleCommand({
    sessionId: 's1', requestId: 'clean-end', command: 'end_session',
    payload: { confirmToken: prepared.token, mode: 'clean' }
  });
  assert.equal(ended.ok, true);
  const late = await controller.beforeForward(envelope('late-after-end', 1));
  assert.equal(late.persisted, false);
  assert.equal(late.response.error, 'session_not_owned');
  assert.equal(await controller.snapshot('s1'), null);
});


test('late receiver coordination telemetry cannot undo Pause before the next final', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  await controller.handleCommand({
    sessionId: 's1', requestId: 'pause-stale-telemetry', command: 'pause', payload: {}
  });
  const paused = await controller.snapshot('s1');
  const pausedAt = paused.batchState.turnCoordination.updatedAt;
  await controller.batchEvent({
    sessionId: 's1',
    event: {
      type: 'turn_coordination_restored',
      at: pausedAt + 100,
      turnCoordination: { mode: 'live', updatedAt: pausedAt - 1 }
    }
  });
  const afterTelemetry = await controller.snapshot('s1');
  assert.equal(afterTelemetry.mode, 'paused');
  assert.equal(afterTelemetry.batchState.turnCoordination.mode, 'paused_accumulating');
  const admission = await controller.beforeForward(envelope('q-after-pause', 2));
  assert.equal(admission.persisted, true);
  assert.equal((await controller.snapshot('s1')).ledger.some(item => item.id === 'q-after-pause'), true);
});


test('paused final admission returns explicit provider-free delivery mode', async () => {
  const { controller, registry } = setup();
  await ready(controller, registry);
  await controller.handleCommand({
    sessionId: 's1', requestId: 'pause-delivery-mode', command: 'pause', payload: {}
  });
  const result = await controller.beforeForward(envelope('paused-mode-q1', 1));
  assert.equal(result.persisted, true);
  assert.equal(result.deliveryMode, 'paused_stage');
  assert.equal(result.response, null);
});
