import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkers, upsertMarker, markerCounts } from '../simple/markers.js';

test('markers are metadata-only and capped', () => {
  const values = Array.from({ length:60 }, (_, index) => ({
    sessionId:'s1', turnId:`t${index}`, category:'needs_review', at:index, text:'must-drop'
  }));
  const result = normalizeMarkers(values, 50);
  assert.equal(result.length, 50);
  assert.equal('text' in result[0], false);
  assert.equal(result[0].turnId, 't10');
});

test('upsert marker deduplicates session turn and category', () => {
  const first = upsertMarker([], { sessionId:'s1', turnId:'t1', category:'strong_answer', at:1 });
  const second = upsertMarker(first, { sessionId:'s1', turnId:'t1', category:'strong_answer', at:2 });
  assert.equal(second.length, 1);
  assert.equal(second[0].at, 2);
});

test('invalid marker categories and text payloads are rejected', () => {
  assert.throws(() => upsertMarker([], { sessionId:'s1', turnId:'t1', category:'bookmark', at:1 }));
  assert.throws(() => upsertMarker([], { sessionId:'s1', turnId:'t1', category:'follow_up', at:1, questionText:'secret' }));
});

test('marker counts are review friendly', () => {
  const values = [
    { sessionId:'s1', turnId:'t1', category:'strong_answer', at:1 },
    { sessionId:'s1', turnId:'t2', category:'needs_review', at:2 },
    { sessionId:'s1', turnId:'t3', category:'needs_review', at:3 },
    { sessionId:'s1', turnId:'t4', category:'follow_up', at:4 }
  ];
  assert.deepEqual(markerCounts(values), { strong_answer:1, needs_review:2, follow_up:1 });
});
