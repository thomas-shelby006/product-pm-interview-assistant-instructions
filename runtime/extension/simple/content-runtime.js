import { makeTurn } from './protocol.js';
import { createSimpleSender } from './sender.js';
import { createRoleQueue } from './role-queue.js';
import { deliverTurn } from './deliver-turn.js';
import { answerMetrics, normalizeRecentQuestions } from './inspection.js';

export function createSimpleContentRuntime({ config, adapter, port } = {}) {
  if (!config?.sessionId || !config?.role || !adapter || !port) throw new TypeError('config, adapter and port are required');
  let sender = null;
  let queue = null;
  let autoForward = true;
  let paused = false;
  const held = [];

  const postStage = value => port.postMessage({ type:'stage', sessionId:config.sessionId, role:config.role, ...value });
  const postTurn = turn => port.postMessage({ type:'turn', turn:makeTurn({
    sessionId:config.sessionId, turnId:turn.id, text:turn.text, kind:'question'
  }) });
  function inspect() {
    if (config.role === 'sender') {
      return { available:true, role:config.role, provider:config.provider,
        recentQuestions:normalizeRecentQuestions(adapter.readUserTurns?.() || [], 20) };
    }
    const text = String(adapter.readLatestAssistantText?.() || '').trim();
    return { available:Boolean(text), role:config.role, provider:config.provider,
      metrics:answerMetrics(text) };
  }

  function start() {
    port.postMessage({ type:'register', ...config });
    port.onMessage.addListener(message => {
      if (message?.type !== 'inspect_request' || !message.requestId) return;
      port.postMessage({ type:'inspect_result', requestId:message.requestId, result:inspect() });
    });
    if (config.role === 'sender') {
      sender = createSimpleSender({
        readTurns:() => adapter.readUserTurns?.() || [],
        onTurn:turn => {
          port.postMessage({ type:'stage', sessionId:config.sessionId, role:'sender', turnId:turn.id, stage:'captured' });
          if (autoForward && !paused) postTurn(turn);
          else held.push(turn);
        }
      });
      port.onMessage.addListener(message => {
        if (message?.type !== 'control') return;
        if (message.command === 'set_auto_forward') autoForward = Boolean(message.enabled);
        if (message.command === 'set_paused') paused = Boolean(message.enabled);
        if (message.command === 'send_gathered' && !paused && held.length) {
          const members = held.splice(0);
          postTurn({ id:`gather:${members.map(value => value.id).join('+')}`, text:members.map(value => value.text).join('\n') });
        }
      });
      sender.prime();
      return;
    }

    queue = createRoleQueue({
      role:config.role,
      onStage:postStage,
      deliverOne:turn => deliverTurn({ adapter, turn, onStage:postStage })
    });
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
    snapshot() {
      return config.role === 'sender'
        ? { ...sender?.snapshot?.(), held:held.length, autoForward, paused }
        : queue?.snapshot?.();
    }
  };
}
