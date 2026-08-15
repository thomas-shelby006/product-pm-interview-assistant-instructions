import { deriveLatestQuestionPath } from '../shared/flow-trace.js';

const STAGE_LABELS = {
  finalized: 'Finalized',
  persisted: 'Persisted',
  routed_primary: 'Routed',
  receiver_accepted: 'Receiver',
  provider_submitted: 'Submitted',
  provider_rendered: 'Rendered',
  proof_verified: 'Verified'
};

export function renderQuestionPath({ document, snapshot }) {
  const model = deriveLatestQuestionPath(snapshot?.timeline || []);
  const list = document.getElementById('questionPathStages');
  if (!list) return;
  list.replaceChildren(...model.stages.filter(item => STAGE_LABELS[item.stage]).map(item => {
    const node = document.createElement('li');
    node.dataset.status = item.status || 'waiting';
    const label = document.createElement('span');
    label.textContent = STAGE_LABELS[item.stage];
    const status = document.createElement('b');
    status.textContent = item.status === 'ok' ? 'Done' : item.status === 'failed' ? 'Failed' : 'Waiting';
    node.append(label, status);
    return node;
  }));
  const title = document.getElementById('questionPathTitle');
  if (title) title.textContent = model.envelopeId ? (model.failure ? 'Delivery stopped' : 'Tracing latest question') : 'Waiting for a question';
  const detail = document.getElementById('questionPathDetail');
  if (detail) detail.textContent = model.failure
    ? `Stopped at ${STAGE_LABELS[model.failure.stage] || model.failure.stage}: ${model.failure.reason || 'unknown reason'}.`
    : model.envelopeId ? 'Metadata-only trace is recording each delivery boundary.' : 'The next finalized question will show each delivery step here.';
}
