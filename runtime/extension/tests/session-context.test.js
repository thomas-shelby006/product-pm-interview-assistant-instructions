import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSafeSessionContext,
  latestSafeSessionContext
} from '../shared/session-context.js';

test('safe session context extracts review metadata without sensitive fields', () => {
  const context = extractSafeSessionContext(`Session context:
Company: Acme
Target role: Senior Product Manager
Interview round: Hiring manager
Emphasis: Enterprise
Avoid mentioning: salary and notice period
Answer mode: concise
Additional notes:
Private note

Resume:
Sensitive resume

Job Description:
Sensitive JD`);
  assert.deepEqual(context, {
    company: 'Acme',
    targetRole: 'Senior Product Manager',
    interviewRound: 'Hiring manager',
    emphasis: 'Enterprise',
    answerMode: 'concise',
    resumeMissing: false,
    jdMissing: false
  });
  assert.doesNotMatch(JSON.stringify(context), /salary|notice|Private|Sensitive/i);
});

test('safe session context records missing resume and JD without copying content', () => {
  assert.deepEqual(extractSafeSessionContext(`Answer mode: normal
Resume:
[Resume not provided in launch window.]

Job Description:
[Job description not provided in launch window.]`), {
    answerMode: 'normal',
    resumeMissing: true,
    jdMissing: true
  });
});

test('latest session context uses the newest armed event', () => {
  const context = latestSafeSessionContext([
    { type: 'session_armed', sessionContext: { company: 'Old' } },
    { type: 'answer', text: 'Answer' },
    { type: 'session_armed', sessionContext: { company: 'New', answerMode: 'concise' } }
  ]);
  assert.deepEqual(context, { company: 'New', answerMode: 'concise' });
});
