import {
  CLAUDE_SIGNAL_EVENT,
  normalizeClaudeSignalDetail
} from './protocol.js';

export function createClaudeSignalBridge(target = window) {
  const subscribers = new Set();
  const seenFinalIds = new Set();

  const rememberFinal = messageId => {
    if (!messageId) return true;
    if (seenFinalIds.has(messageId)) return false;
    seenFinalIds.add(messageId);
    if (seenFinalIds.size > 100) {
      const oldest = seenFinalIds.values().next().value;
      seenFinalIds.delete(oldest);
    }
    return true;
  };

  const listener = event => {
    const signal = normalizeClaudeSignalDetail(event?.detail);
    if (!signal) return;
    if (signal.type === 'voice_final' && !rememberFinal(signal.messageId)) return;
    for (const subscriber of subscribers) subscriber(signal);
  };

  target.addEventListener(CLAUDE_SIGNAL_EVENT, listener);

  return {
    subscribe(callback) {
      if (typeof callback !== 'function') return () => {};
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    disconnect() {
      subscribers.clear();
      target.removeEventListener(CLAUDE_SIGNAL_EVENT, listener);
      seenFinalIds.clear();
    }
  };
}
