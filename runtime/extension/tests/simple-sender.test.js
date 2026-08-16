import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/sender.js').catch(() => null);

function source(initial = []) {
  let turns = initial;
  return {
    read: () => turns,
    set: value => { turns = value; }
  };
}

test('simple sender module exists', () => assert.ok(mod));

test('sender baselines historical rendered turns and emits only later turns', async () => {
  const s = source([{ id:'old-1', text:'Old question' }]);
  const emitted = [];
  const sender = mod.createSimpleSender({ readTurns:s.read, onTurn:turn => emitted.push(turn) });
  sender.prime();
  await sender.scan();
  assert.deepEqual(emitted, []);
  s.set([{ id:'old-1', text:'Old question' }, { id:'new-1', text:'New question' }]);
  await sender.scan();
  assert.deepEqual(emitted, [{ id:'new-1', text:'New question' }]);
});

test('sender emits each rendered turn once even when MutationObserver scans repeat', async () => {
  const s = source([]);
  const emitted = [];
  const sender = mod.createSimpleSender({ readTurns:s.read, onTurn:turn => emitted.push(turn) });
  sender.prime();
  s.set([{ id:'t1', text:'Metric?' }]);
  await Promise.all([sender.scan(), sender.scan(), sender.scan()]);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].id, 't1');
});

test('sender does not wait for onTurn completion before detecting a later DOM turn', async () => {
  const s = source([]);
  let releaseFirst;
  const started = [];
  const sender = mod.createSimpleSender({
    readTurns:s.read,
    onTurn:turn => {
      started.push(turn.id);
      if (turn.id === 't1') return new Promise(resolve => { releaseFirst = resolve; });
      return Promise.resolve();
    }
  });
  sender.prime();
  s.set([{ id:'t1', text:'One' }]);
  const firstScan = sender.scan();
  await new Promise(resolve => setImmediate(resolve));
  s.set([{ id:'t1', text:'One' }, { id:'t2', text:'Two' }]);
  await sender.scan();
  assert.deepEqual(started, ['t1','t2']);
  releaseFirst();
  await firstScan;
});
