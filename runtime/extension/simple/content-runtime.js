import { makeTurn } from './protocol.js';
import { createSimpleSender } from './sender.js';
import { createRoleQueue } from './role-queue.js';
import { deliverTurn } from './deliver-turn.js';
import { answerMetrics, normalizeRecentQuestions } from './inspection.js';

export function createSimpleContentRuntime({ config, adapter, port, senderState = {} } = {}) {
  if (!config?.sessionId || !config?.role || !adapter || !port) throw new TypeError('config, adapter and port are required');
  let sender = null;
  let queue = null;
  let autoForward = senderState.autoForward ?? true;
  let paused = senderState.paused ?? false;
  const held = [];
  const receipts = new Map();
  let retryTimer = null;
  const postStage = value => port.postMessage({ type:'stage', sessionId:config.sessionId, role:config.role, ...value });
  const persistControls = () => senderState.onControlsChange?.({ autoForward, paused, heldIds:held.map(turn => turn.id) });
  const postTurn = turn => new Promise(resolve => {
    const item = makeTurn({ sessionId:config.sessionId, turnId:turn.id, text:turn.text, kind:'question' });
    const timer = setTimeout(() => { receipts.delete(item.turnId); resolve(false); }, 3000);
    receipts.set(item.turnId, accepted => { clearTimeout(timer); receipts.delete(item.turnId); resolve(Boolean(accepted)); });
    try { port.postMessage({ type:'turn', turn:item }); }
    catch { receipts.get(item.turnId)?.(false); }
  });
  function inspect() {
    if (config.role === 'sender') return {
      available:true, role:config.role, provider:config.provider,
      recentQuestions:normalizeRecentQuestions(adapter.readUserTurns?.() || [], 20)
    };
    const text = String(adapter.readLatestAssistantText?.() || '').trim();
    return { available:Boolean(text), role:config.role, provider:config.provider, metrics:answerMetrics(text) };
  }
  function start() {
    port.postMessage({ type:'register', ...config });
    port.onMessage.addListener(message => {
      if (message?.type === 'inspect_request' && message.requestId) {
        port.postMessage({ type:'inspect_result', requestId:message.requestId, result:inspect() });
      }
    });
    if (config.role === 'sender') {
      const byId = new Map((adapter.readUserTurns?.() || []).map(turn => [turn.id, turn]));
      for (const id of senderState.heldIds || []) held.push(byId.get(id) || { id, text:'' });
      sender = createSimpleSender({
        readTurns:() => adapter.readUserTurns?.() || [],
        onTurn:async turn => {
          postStage({ turnId:turn.id, stage:'captured' });
          if (autoForward && !paused) return postTurn(turn);
          held.push(turn);
          persistControls();
          return true;
        },
        onRetry:() => {
          if (retryTimer) return;
          retryTimer = setTimeout(() => { retryTimer = null; void sender.scan(); }, 1500);
        },
        initialSeen:senderState.initialSeen || [],
        onSeenChange:senderState.onSeenChange || (() => {})
      });
      port.onMessage.addListener(message => {
        if (message?.type === 'turn_accepted') receipts.get(message.turnId)?.(message.accepted);
        if (message?.type !== 'control') return;
        let ok = true;
        let reason = '';
        if (message.command === 'set_auto_forward') autoForward = Boolean(message.enabled);
        else if (message.command === 'set_paused') paused = Boolean(message.enabled);
        else if (message.command === 'send_gathered') {
          if (paused || held.some(item => !item.text)) {
            ok = false;
            reason = paused ? 'paused' : 'held_question_missing';
          } else if (held.length) {
            const members = [...held];
            const combined = { id:`gather:${members.map(item => item.id).join('+')}`,
              text:members.map(item => item.text).join('\n') };
            void postTurn(combined).then(accepted => {
              if (accepted) held.splice(0, members.length);
              persistControls();
              port.postMessage({ type:'sender_control_applied', requestId:message.requestId, ok:accepted, reason:accepted ? '' : 'not_accepted', autoForward, paused, held:held.length });
            });
            return;
          }
        } else { ok = false; reason = 'unknown_command'; }
        persistControls();
        port.postMessage({ type:'sender_control_applied', requestId:message.requestId, ok, reason, autoForward, paused, held:held.length });
      });
      port.postMessage({ type:'sender_control_state', sessionId:config.sessionId, autoForward, paused, held:held.length });
      if (senderState.resumed) void sender.scan(); else sender.prime();
      return;
    }
    queue = createRoleQueue({ role:config.role, onStage:postStage,
      deliverOne:turn => deliverTurn({ adapter, turn, onStage:postStage }) });
    port.onMessage.addListener(message => {
      if (message?.type !== 'deliver' || !message.requestId || !message.turn) return;
      queue.push(message.turn).then(result => {
        port.postMessage({ type:'delivery_result', requestId:message.requestId, result });
      });
    });
  }
  return {
    start,
    scanSender() { return sender?.scan?.() || Promise.resolve(0); },
    snapshot() { return config.role === 'sender'
      ? { ...sender?.snapshot?.(), held:held.length, autoForward, paused }
      : queue?.snapshot?.(); }
  };
}
