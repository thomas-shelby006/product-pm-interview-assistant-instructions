import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner } from '../shared/batch-planner.js';
import { composePausedDraftPrompt, deriveTurnResumePreview } from '../shared/turn-coordination-state.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, createdAt: seq };
}

test('paused draft banner is presentation-only and appears once', () => {
  const entries = [
    { id:'q1', envelope:envelope('q1',1,'First') },
    { id:'q2', envelope:envelope('q2',2,'Second') }
  ];
  const prompt = composePausedDraftPrompt({ entries, totalCount:2, partitionCount:1 }, { mode:'paused_accumulating' });
  assert.equal((prompt.text.match(/FORWARDING PAUSED — NOT SUBMITTED/g) || []).length, 1);
  assert.match(prompt.text, /2 protected segments/);
  assert.match(prompt.text, /LATEST ACTIONABLE QUESTION \(HIGHEST PRIORITY\):/);
  assert.deepEqual(prompt.memberIds, ['q1','q2']);
  assert.equal(prompt.presentationOnly, true);
});

test('resume preview is metadata-only for one and partitioned drafts', () => {
  const planner = new BatchPlanner();
  planner.setBudget({ maxMembers:1, maxChars:4096 });
  planner.add(envelope('q1',1,'Sensitive one'), 1);
  planner.add(envelope('q2',2,'Sensitive two'), 2);
  const preview = deriveTurnResumePreview({ mode:'paused_accumulating', releaseIntent:'send' }, planner.snapshot());
  assert.equal(preview.heldCount, 2);
  assert.equal(preview.partitionCount, 2);
  assert.deepEqual(preview.memberIds, ['q1','q2']);
  assert.deepEqual(preview.firstPartitionIds, ['q1']);
  assert.equal(preview.onResume, 'submit_first_partition');
  assert.doesNotMatch(JSON.stringify(preview), /Sensitive one|Sensitive two/);
});

test('resume replaces paused banner with final combined prompt before submission', async () => {
  const writes = [];
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider:'chatgpt', isGenerating:()=>false,
      setComposerText:text => { writes.push(String(text)); return true; }
    },
    submitBatch: async batch => { submitted.push(batch); return { ok:true, proof:{ ok:true, verified:true } }; }
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1',1,'First question'));
  await runtime.accept(envelope('q2',2,'Latest question'));
  assert.match(writes.at(-1), /FORWARDING PAUSED — NOT SUBMITTED/);
  assert.equal(submitted.length, 0);
  await runtime.resumeForwarding({ submit:true });
  assert.equal(submitted.length, 1);
  assert.doesNotMatch(submitted[0].submissionText, /FORWARDING PAUSED — NOT SUBMITTED/);
  assert.match(submitted[0].submissionText, /Forwarding was paused/);
  assert.equal(writes.at(-1), submitted[0].submissionText);
});

test('manual conflict preserves paused banner and blocks final replacement', async () => {
  const writes=[];
  let manual=false;
  const runtime=createReceiverBatchRuntime({
    adapter:{ provider:'chatgpt', isGenerating:()=>false, setComposerText:text=>{writes.push(String(text));return true;} },
    draftArbiter:{
      snapshot:()=>manual?{owner:'manual'}:{owner:'batch'},
      writeBatch:text=>{writes.push(String(text));return !manual;},
      submissionTextFor:text=>text
    },
    submitBatch:async()=>({ok:true})
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1',1));
  manual=true;
  const result=await runtime.resumeForwarding({submit:true});
  assert.equal(result.error,'draft_conflict');
  assert.match(writes.at(-1),/FORWARDING PAUSED — NOT SUBMITTED/);
  assert.equal(runtime.snapshot().turnCoordination.mode,'paused_accumulating');
});
