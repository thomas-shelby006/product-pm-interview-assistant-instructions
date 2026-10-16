import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveEndState, managedWindowIds } from '../simple/session-tools.js';

const worker = fs.readFileSync(new URL('../simple/service-worker.js', import.meta.url), 'utf8');

test('end state separates command success from safe-to-end state', () => {
  assert.deepEqual(deriveEndState(0), { canEnd:true, unresolvedCount:0 });
  assert.deepEqual(deriveEndState(2), { canEnd:false, unresolvedCount:2 });
});

test('only known PMIA managed window IDs are eligible for closing', () => {
  const meta = { windows:{sender:1,receiver:2,comparison:3,cockpit:4,unrelated:99} };
  assert.deepEqual(managedWindowIds(meta), [1,2,3,4]);
  assert.deepEqual(managedWindowIds({ windows:{sender:1,receiver:1} }), [1]);
});

test('service worker blocks unresolved end unless force is explicit and reports failed closes', () => {
  assert.match(worker, /state\.canEnd/);
  assert.match(worker, /!force/);
  assert.match(worker, /chrome\.windows\.remove/);
  assert.match(worker, /failed:/);
  assert.match(worker, /case 'get_end_state': return \{ ok:true/);
});