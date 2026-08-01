import { formatDuration, roleHealth } from './dashboard-model.js';

export function renderRuntimeRole({ roleName, role, now = Date.now(), text, healthNode } = {}) {
  const health = roleHealth(role, now);
  if (healthNode) {
    healthNode.textContent = health.label;
    healthNode.dataset.tone = health.tone;
  }
  const prefix = roleName;
  text(`${prefix}Provider`, role?.provider || '--');
  text(`${prefix}Phase`, role?.phase || '--');
  text(`${prefix}Composer`, role?.composerReady ? 'Ready' : 'Waiting');
  text(`${prefix}Heartbeat`, health.ageMs === null ? '--' : `${formatDuration(health.ageMs)} ago`);
  const capabilities = role?.adapterCapabilities;
  text(`${prefix}Adapter`, !capabilities
    ? 'Unknown'
    : capabilities.complete
      ? 'Complete'
      : `Missing: ${(capabilities.missingRequired || []).join(', ')}`);
  if (roleName === 'sender') {
    text('senderVoice', role?.voiceActive ? 'Active' : 'Idle');
    text('senderSilence', role?.sourceSilenceMs ? formatDuration(role.sourceSilenceMs) : '0s');
  } else {
    const generation = role?.generationState || {};
    const generationLabel = generation.state === 'streaming'
      ? `Streaming (${generation.confidence || 'unknown'})`
      : generation.state === 'starting'
        ? 'Starting'
        : generation.state === 'complete'
          ? 'Complete'
          : 'Idle';
    text('receiverGenerating', `${generationLabel}${generation.reason ? ` - ${String(generation.reason).replaceAll('_', ' ')}` : ''}`);
    text('receiverScroll', role?.scrollLocked ? 'Locked' : 'Free');
  }
  return health;
}