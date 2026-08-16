import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/stage-log.js').catch(() => null);

test('stage log module exists', () => assert.ok(mod));

test('stage log stores only bounded operational metadata', () => {
  const log = mod.createStageLog({ limit:3, now:() => 100 });
  log.append({ role:'sender', turnId:'t1', stage:'captured', text:'SECRET QUESTION' });
  log.append({ role:'receiver', turnId:'t1', stage:'composer_written', elapsedMs:8 });
  log.append({ role:'receiver', turnId:'t1', stage:'submitted', elapsedMs:12 });
  log.append({ role:'receiver', turnId:'t1', stage:'rendered', elapsedMs:25 });
  const values = log.snapshot();
  assert.equal(values.length, 3);
  assert.equal(values[0].stage, 'composer_written');
  assert.equal('text' in values[0], false);
  assert.equal(JSON.stringify(values).includes('SECRET QUESTION'), false);
});

test('stage log rejects noisy unknown stages', () => {
  const log = mod.createStageLog();
  assert.equal(log.append({ role:'receiver', turnId:'t1', stage:'resyncing_live' }), false);
  assert.equal(log.snapshot().length, 0);
});
