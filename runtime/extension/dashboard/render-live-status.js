import { catchUpLabel, deriveLiveInbox } from './live-inbox-model.js';
import { deriveAnswerStatus } from './answer-status-model.js';
import { deriveSelfTestTrust } from './self-test-trust-model.js';

function deliveryDetail(inbox) {
  const details = {
    live: 'Every persisted final has receiver-rendered proof.',
    accumulating: `${inbox.nextCount} question(s) are protected while the current answer is observed.`,
    catching_up: `${inbox.pendingCount + inbox.inFlightCount + inbox.nextCount} question state(s) are moving toward rendered proof.`,
    held: `${inbox.nextCount || inbox.pendingCount} question(s) are protected and waiting for operator release.`,
    blocked: inbox.draftConflict
      ? 'A manual composer edit is protected. Resolve the draft conflict before automatic updates continue.'
      : 'Delivery needs attention. All unresolved finals remain in the lossless ledger.'
  };
  return details[inbox.catchUpState] || 'Runtime state is being reconciled.';
}

export function renderTruthRail({ document, snapshot, now = Date.now(), text, sessionEnded = false } = {}) {
  if (!snapshot) {
    text('deliveryTruthState', sessionEnded ? 'Session ended' : 'Connecting');
    text('deliveryTruthDetail', sessionEnded ? 'The managed lossless ledger was cleared.' : 'Waiting for the lossless ledger.');
    text('answerTruthState', 'Idle');
    text('answerTruthDetail', 'No answer state is available yet.');
    text('verificationTruthState', 'Not run');
    text('verificationTruthDetail', 'Waiting for active verification evidence.');
    return { inbox: null, answerStatus: null, verificationTrust: null };
  }
  const inbox = deriveLiveInbox(snapshot, now);
  const answerStatus = deriveAnswerStatus(snapshot, now);
  const verificationTrust = deriveSelfTestTrust(snapshot, now);
  const verificationLabels = { active: 'Actively verified', evidence_fresh: 'Evidence fresh', stale: 'Stale', failed: 'Failed', missing: 'Not run' };
  text('deliveryTruthState', catchUpLabel(inbox.catchUpState));
  text('deliveryTruthDetail', deliveryDetail(inbox));
  text('answerTruthState', answerStatus.label);
  text('answerTruthDetail', `${answerStatus.title}. ${answerStatus.detail}`);
  text('verificationTruthState', verificationLabels[verificationTrust.state] || 'Unknown');
  text('verificationTruthDetail', verificationTrust.detail);
  for (const [selector, value] of [
    ['.delivery-truth', inbox.catchUpState],
    ['.answer-truth', answerStatus.state],
    ['.verification-truth', verificationTrust.state]
  ]) {
    const node = document?.querySelector?.(selector);
    if (node) node.dataset.state = value;
  }
  return { inbox, answerStatus, verificationTrust };
}