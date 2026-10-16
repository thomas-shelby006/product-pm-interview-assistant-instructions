import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/launch-status.js').catch(() => null);

test('launch status helper exists', () => assert.ok(mod));

test('three-window boot requires rendered proof from receiver and comparison', () => {
  const roles = ['sender','receiver','comparison'];
  assert.equal(mod.launchIsReady({ roles, hasBoot:true, boot:{
    receiver:{ stage:'rendered' }, comparison:{ stage:'rendered' }
  }}), true);
  assert.equal(mod.launchIsReady({ roles, hasBoot:true, boot:{
    receiver:{ stage:'rendered' }, comparison:{ stage:'submitted' }
  }}), false);
});

test('two-window boot requires only receiver rendered proof', () => {
  assert.equal(mod.launchIsReady({ roles:['sender','receiver'], hasBoot:true, boot:{ receiver:{ stage:'rendered' } } }), true);
  assert.equal(mod.launchIsReady({ roles:['sender','receiver'], hasBoot:true, boot:{ receiver:{ stage:'failed' } } }), false);
});

test('no boot text requires only connected role readiness', () => {
  assert.equal(mod.launchIsReady({ roles:['sender','receiver','comparison'], hasBoot:false, boot:null }), true);
});
