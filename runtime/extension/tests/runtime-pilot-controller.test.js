import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRegistry } from '../shared/session-registry.js';
import { createRuntimePilotController } from '../shared/runtime-pilot-controller.js';

function memoryArea() {
  const data = {};
  return {
    async get(key) { return key ? { [key]: data[key] } : { ...data }; },
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

function setup() {
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
    windows: { async update() {}, async create() { return { id: 99 }; } }
  };
  const controller = createRuntimePilotController({
    chromeApi,
    storageArea: memoryArea(),
    registryProvider: async () => registry,
    saveRegistry: async () => {},
    async deliverFinal(route) {
      deliveries.push(route.message.id);
      return {
        delivered: true,
        queued: false,
        reason: 'accepted',
        proof: { verified: true, proof: 'new_rendered_turn' }
      };
    },
    appendLog: async () => {},
    broadcastLinkStatus: async () => {},
    exportManagedSession: async () => ({ ok: true }),
    clearSessionLogs: async () => {}
  });
  return { controller, registry, deliveries, runtimeCommands };
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
  await controller.beforeForward(envelope('q1', 1));
  await controller.beforeForward(envelope('q2', 2));
  const paused = await controller.snapshot('s1');
  assert.equal(paused.mode, 'paused');
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
      proof: { verified: true, proof: 'new_rendered_turn' }
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
  const result = await controller.handleCommand({
    sessionId: 's1', requestId: 'end-1', command: 'end_session'
  });
  assert.equal(result.ok, true);
  assert.equal(registry.getSession('s1'), null);
  assert.equal(await controller.snapshot('s1'), null);
  assert.deepEqual(result.closeTabIds.sort(), [1, 2]);
});

test('runtime repair remains repairing until both roles publish healthy telemetry', async () => {
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
  assert.equal(snapshot.mode, 'active');
  assert.equal(snapshot.lastRepair.verified, true);
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
