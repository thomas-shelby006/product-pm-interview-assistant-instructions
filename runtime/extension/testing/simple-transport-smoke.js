const sessionId = `smoke_${Date.now().toString(36)}`;
const marks = {};
const deliveries = new Map();
const resultNode = document.getElementById('result');
let failComparisonTurn2 = false;

const deliveryKey = (role, turnId) => `${role}:${turnId}`;
const countDelivery = (role, turnId) => {
  const key = deliveryKey(role, turnId);
  deliveries.set(key, (deliveries.get(key) || 0) + 1);
};

function rolePort(role, provider) {
  const port = chrome.runtime.connect({ name:'pmia-simple' });
  port.onMessage.addListener(message => {
    if (message?.type !== 'deliver') return;
    const turnId = message.turn?.turnId || '';
    countDelivery(role, turnId);
    if (turnId === 'smoke-turn-1') marks[role] = performance.now();
    const shouldFail = role === 'comparison' && turnId === 'smoke-turn-2' && failComparisonTurn2;
    if (shouldFail) failComparisonTurn2 = false;
    port.postMessage({ type:'delivery_result', requestId:message.requestId,
      result:{ role, stage:shouldFail ? 'failed' : 'rendered', elapsedMs:1 } });
  });
  port.postMessage({ type:'register', sessionId, role, provider });
  return port;
}
let receiver = rolePort('receiver', 'claude');
let comparison = rolePort('comparison', 'chatgpt');
const sender = chrome.runtime.connect({ name:'pmia-simple' });
const ui = chrome.runtime.connect({ name:'pmia-simple' });
sender.postMessage({ type:'register', sessionId, role:'sender', provider:'chatgpt' });
ui.postMessage({ type:'ui_register', sessionId, client:'transport-smoke' });

function waitForRoles(timeoutMs = 2000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const listener = message => {
      const roles = message?.snapshot?.roles;
      if (!roles?.sender || !roles?.receiver || !roles?.comparison) return;
      clearTimeout(timer);
      ui.onMessage.removeListener(listener);
      resolve(true);
    };
    ui.onMessage.addListener(listener);
    ui.postMessage({ type:'get_snapshot', sessionId });
  });
}

function waitForTurnResult(turnId, timeoutMs = 2000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const listener = message => {
      if (message?.type !== 'turn_result' || message.turnId !== turnId) return;
      clearTimeout(timer);
      sender.onMessage.removeListener(listener);
      resolve(message);
    };
    sender.onMessage.addListener(listener);
  });
}

function sendTurn(turnId, text) {
  const resultPromise = waitForTurnResult(turnId);
  sender.postMessage({ type:'stage', sessionId, role:'sender', turnId, stage:'captured' });
  sender.postMessage({ type:'turn', turn:{ sessionId, turnId, text, kind:'question' } });
  return resultPromise;
}

function waitForDelivery(role, turnId, expectedCount, timeoutMs = 2000) {
  const deadline = performance.now() + timeoutMs;
  return new Promise(resolve => {
    const check = () => {
      if ((deliveries.get(deliveryKey(role, turnId)) || 0) >= expectedCount) return resolve(true);
      if (performance.now() >= deadline) return resolve(false);
      setTimeout(check, 10);
    };
    check();
  });
}
const rolesReady = await waitForRoles();
const started = performance.now();
let first = null;
let second = null;
let replayed = false;

if (rolesReady) {
  first = await sendTurn('smoke-turn-1', 'Synthetic PMIA transport smoke');
  failComparisonTurn2 = true;
  second = await sendTurn('smoke-turn-2', 'Synthetic PMIA reconnect smoke');
  comparison.disconnect();
  await new Promise(resolve => setTimeout(resolve, 20));
  comparison = rolePort('comparison', 'chatgpt');
  replayed = await waitForDelivery('comparison', 'smoke-turn-2', 2);
}

const receiverStart = Number(marks.receiver || 0);
const comparisonStart = Number(marks.comparison || 0);
const dispatchSkewMs = receiverStart && comparisonStart
  ? Math.abs(receiverStart - comparisonStart)
  : Number.POSITIVE_INFINITY;
const receiverTurn2Count = deliveries.get(deliveryKey('receiver','smoke-turn-2')) || 0;
const comparisonTurn2Count = deliveries.get(deliveryKey('comparison','smoke-turn-2')) || 0;
const elapsedMs = performance.now() - started;
const transportResult = {
  ok:Boolean(
    rolesReady &&
    first?.results?.receiver?.stage === 'rendered' &&
    first?.results?.comparison?.stage === 'rendered' &&
    second?.results?.receiver?.stage === 'rendered' &&
    second?.results?.comparison?.stage === 'failed' &&
    replayed && receiverTurn2Count === 1 && comparisonTurn2Count === 2 &&
    dispatchSkewMs < 50
  ),
  rolesReady,
  dispatchSkewMs,
  elapsedMs,
  reconnect:{ replayed, receiverTurn2Count, comparisonTurn2Count },
  first:first?.results || null,
  second:second?.results || null
};
window.__PMIA_SIMPLE_TRANSPORT_RESULT__ = transportResult;
resultNode.textContent = JSON.stringify(transportResult, null, 2);

receiver.disconnect();
comparison.disconnect();
sender.disconnect();
ui.disconnect();
