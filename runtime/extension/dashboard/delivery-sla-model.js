function label(state) {
  return state === 'catch_up_due' ? 'Catch-up due'
    : state === 'check_due' ? 'Live check due'
      : state === 'repair_due' ? 'Repair due'
        : state === 'answering' ? 'Answering'
          : state === 'suppressed' ? 'Suppressed'
            : state === 'cooldown' ? 'Cooldown'
              : state === 'action_failed' ? 'Action failed'
                : state === 'clear' ? 'Caught up'
                  : 'Within target';
}

export function deriveDeliverySlaView(snapshot, now = Date.now()) {
  const value = snapshot?.deliverySla || {};
  const action = String(value.nextAction || '');
  return {
    state: String(value.state || 'clear'),
    label: label(String(value.state || 'clear')),
    oldestAgeMs: value.oldestAt
      ? Math.max(0, Number(now) - Number(value.oldestAt))
      : Math.max(0, Number(value.oldestAgeMs || 0)),
    targetMs: Math.max(0, Number(value.targetMs || 0)),
    nextAction: action === 'resume_catch_up' ? 'Resume and catch up'
      : action === 'check_live' ? 'Check live'
        : action === 'repair_runtime' ? 'Repair runtime'
          : action === 'wait' ? 'Wait' : 'None',
    reason: String(value.reason || ''),
    lastAction: String(value.lastAction || ''),
    lastActionAt: Math.max(0, Number(value.lastActionAt || 0))
  };
}
