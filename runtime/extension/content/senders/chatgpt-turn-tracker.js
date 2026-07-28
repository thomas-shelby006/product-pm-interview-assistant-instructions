import { DomTurnTracker } from './dom-turn-tracker.js';

export function createChatGptTurnTracker(options = {}) {
  return new DomTurnTracker(options);
}
