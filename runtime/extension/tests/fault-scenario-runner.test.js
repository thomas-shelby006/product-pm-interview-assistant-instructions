import test from 'node:test';
import assert from 'node:assert/strict';
import { runFaultScenario } from '../testing/fault-scenario-runner.js';

test('fault scenario records safe before and after evidence and always cleans up', async () => {
  let cleaned = false;
  const result = await runFaultScenario('transport-timeout', [{
    name: 'open-circuit',
    before: () => ({ prompt: 'secret', state: 'closed' }),
    run: () => ({ ok: true, state: 'open' }),
    after: () => ({ answer: 'secret', state: 'open' })
  }], { cleanup: async () => { cleaned = true; } });
  assert.equal(result.ok, true);
  assert.equal(cleaned, true);
  assert.equal(result.steps[0].before.prompt, '[redacted]');
  assert.equal(result.steps[0].after.answer, '[redacted]');
});

test('fault scenario stops at the first failed step', async () => {
  const result = await runFaultScenario('failure', [
    { name: 'first', run: () => ({ ok: false, error: 'expected' }) },
    { name: 'second', run: () => ({ ok: true }) }
  ]);
  assert.equal(result.failedAt, 'first');
  assert.equal(result.steps.length, 1);
});
