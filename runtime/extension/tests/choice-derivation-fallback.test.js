import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveChoiceWorkspace } from '../dashboard/operator-choice-workspace-model.js';
import { deriveLiveActionDock } from '../dashboard/live-action-dock-model.js';

const pendingSnapshot = {
  dashboardConnections: 1,
  mode: 'active',
  batchState: {
    pendingNoResponse: {
      batchId: 'batch-1',
      memberIds: ['q1'],
      answerState: { state: 'no_response', reason: 'answer_never_started' }
    }
  },
  ledgerCounts: { unresolved: 2 },
  answerState: { state: 'no_response' }
};

test('choice workspace derives no-response controls when the precomputed choice delta is absent', () => {
  const workspace = deriveChoiceWorkspace(pendingSnapshot);
  assert.equal(workspace.visible, true);
  assert.equal(workspace.type, 'no_response');
  assert.deepEqual(workspace.options.map(item => item.id), ['wait', 'retry', 'continue']);
  assert.ok(workspace.id);
  assert.ok(workspace.fingerprint);
});

test('action dock derives the same pending choice from current batch state', () => {
  const dock = deriveLiveActionDock(pendingSnapshot);
  assert.equal(dock.action.mode, 'choose');
  assert.equal(dock.action.view, 'assist');
  assert.equal(dock.action.anchor, 'choiceWorkspace');
  assert.match(dock.title, /no response/i);
});
