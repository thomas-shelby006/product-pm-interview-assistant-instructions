import { deriveTurnCoordinationCockpit } from './turn-coordination-model.js';

function setText(document, id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value ?? '');
}

function formatLatency(value = {}) {
  if (!Number(value.sampleCount || 0)) return 'No latency samples';
  return `p95 ${Math.round(Number(value.p95Ms || 0))} ms · ${Number(value.sampleCount || 0)} samples`;
}

export function renderTurnCoordination({ document, snapshot = null, model: suppliedModel = null, now = Date.now(), sessionEnded = false } = {}) {
  const panel = document?.getElementById?.('turnCoordinationPanel');
  if (!panel) return null;
  if (!snapshot) {
    panel.dataset.state = sessionEnded ? 'ended' : 'connecting';
    setText(document, 'turnCoordinationState', sessionEnded ? 'Ended' : 'Connecting');
    setText(document, 'turnCoordinationTitle', sessionEnded ? 'Session ended' : 'Waiting for coordination state');
    setText(document, 'turnCoordinationDetail', sessionEnded
      ? 'The managed session state was cleared.'
      : 'Pause, carryover, and protected draft state will appear here.');
    setText(document, 'turnCoordinationHeld', '0 held');
    setText(document, 'turnCoordinationActive', '0 active');
    setText(document, 'turnCoordinationLatency', 'No latency samples');
    const primary = document.getElementById('turnCoordinationPrimary');
    const secondary = document.getElementById('turnCoordinationSecondary');
    if (primary) primary.disabled = true;
    if (secondary) secondary.hidden = true;
    return null;
  }

  const model = suppliedModel || deriveTurnCoordinationCockpit(snapshot, now);
  panel.dataset.state = model.state;
  panel.dataset.policy = model.policy;
  setText(document, 'turnCoordinationState', model.label);
  setText(document, 'turnCoordinationTitle', model.title);
  setText(document, 'turnCoordinationDetail', model.detail);
  setText(document, 'turnCoordinationHeld', `${model.heldCount} held`);
  setText(document, 'turnCoordinationActive', `${model.activeCount} active${model.carryoverCount ? ` · ${model.carryoverCount} carryover` : ''}`);
  setText(document, 'turnCoordinationLatency', formatLatency(model.latency));
  const resumePreview = document.getElementById('turnCoordinationResumePreview');
  if (resumePreview) resumePreview.hidden = model.state !== 'paused' || model.heldCount === 0;
  setText(document, 'turnCoordinationResumeCounts', `${model.preview.count} protected · ${model.preview.partitionCount} partition${model.preview.partitionCount === 1 ? '' : 's'}`);
  setText(document, 'turnCoordinationResumeMembers', model.preview.memberIds.length ? `Member IDs: ${model.preview.memberIds.join(', ')}` : 'No held member IDs.');
  setText(document, 'turnCoordinationResumeBehavior', model.preview.onResume === 'submit_first_partition'
    ? `Resume and send submits ${model.preview.firstPartitionIds.length} member${model.preview.firstPartitionIds.length === 1 ? '' : 's'} first, then preserves ${model.preview.remainingCount} for the next ordered partition.`
    : model.preview.onResume === 'submit_combined_draft'
      ? 'Resume and send submits the protected combined draft once.'
      : 'Nothing will submit.');

  const primary = document.getElementById('turnCoordinationPrimary');
  if (primary) {
    primary.disabled = !model.primary?.command;
    primary.hidden = !model.primary?.command;
    primary.dataset.command = model.primary?.command || '';
    primary.textContent = model.primary?.label || 'No action';
  }
  const secondary = document.getElementById('turnCoordinationSecondary');
  if (secondary) {
    secondary.hidden = !model.secondary?.command;
    secondary.disabled = !model.secondary?.command;
    secondary.dataset.command = model.secondary?.command || '';
    secondary.textContent = model.secondary?.label || '';
  }
  panel.setAttribute('aria-label', `Turn coordination: ${model.label}. ${model.detail}`);
  return model;
}
