import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roleLogKey,
  appendBoundedLog,
  renderSessionMarkdown,
  buildSessionExport
} from '../shared/session-log.js';

test('role log keys separate sender and receiver records', () => {
  assert.equal(roleLogKey('session-1', 'sender'), 'pmia_log_session-1_sender');
  assert.equal(roleLogKey('session-1', 'receiver'), 'pmia_log_session-1_receiver');
  assert.throws(() => roleLogKey('session-1', 'other'));
});

test('bounded log retains a truncation marker and newest events', () => {
  const original = [
    { type: 'one' },
    { type: 'two' },
    { type: 'three' }
  ];
  const next = appendBoundedLog(original, { type: 'four' }, 3, '2026-07-28T00:00:00Z');
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], {
    type: 'log_truncated',
    droppedCount: 2,
    recordedAt: '2026-07-28T00:00:00Z'
  });
  assert.deepEqual(next.slice(1).map(event => event.type), ['three', 'four']);
});

test('bounded log accumulates prior dropped count without duplicate markers', () => {
  const original = [
    { type: 'log_truncated', droppedCount: 4, recordedAt: 'old' },
    { type: 'three' },
    { type: 'four' }
  ];
  const next = appendBoundedLog(original, { type: 'five' }, 3, 'new');
  assert.equal(next.filter(event => event.type === 'log_truncated').length, 1);
  assert.equal(next[0].droppedCount, 5);
  assert.deepEqual(next.slice(1).map(event => event.type), ['four', 'five']);
});

test('Markdown export uses valid UTF-8 punctuation and redacted text', () => {
  const markdown = renderSessionMarkdown({
    session: { sessionId: 's1', role: 'sender', provider: 'claude' },
    events: [{ recordedAt: '2026-07-28T00:00:00Z', type: 'sender_text', text: 'Question?' }]
  });
  assert.match(markdown, /2026-07-28T00:00:00Z — sender_text/);
  assert.doesNotMatch(markdown, /â€”/);
  assert.match(markdown, /Window: sender \/ claude/);
});

test('session export is role-scoped and stable', () => {
  const payload = buildSessionExport({
    session: { sessionId: 's1', role: 'receiver', provider: 'chatgpt' },
    events: [{ type: 'answer' }],
    exportedAt: '2026-07-28T01:00:00Z'
  });
  assert.deepEqual(payload, {
    schemaVersion: '2.0',
    exportedAt: '2026-07-28T01:00:00Z',
    session: { sessionId: 's1', role: 'receiver', provider: 'chatgpt' },
    events: [{ type: 'answer' }]
  });
});