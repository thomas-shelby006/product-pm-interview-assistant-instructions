import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/session-tools.js').catch(() => null);

test('session tools module exists', () => assert.ok(mod));

test('session meta keeps only bounded route and PMIA window identity', () => {
  const meta = mod.buildSessionMeta({
    sessionId:'s1', startedAt:1234,
    roles:[{role:'sender',provider:'chatgpt'},{role:'receiver',provider:'claude'},{role:'comparison',provider:'chatgpt'}],
    launch:{
      providerWindows:[{id:11,url:'secret1'},{id:22,url:'secret2'},{id:33,url:'secret3'}],
      cockpitWindow:{id:44,url:'chrome-extension://secret'},
      layout:{providers:[{left:0,top:0,width:300,height:600}],cockpit:{left:0,top:600,width:900,height:120}}
    }
  });
  assert.equal(meta.sessionId, 's1');
  assert.equal(meta.startedAt, 1234);
  assert.deepEqual(meta.roles, {sender:'chatgpt',receiver:'claude',comparison:'chatgpt'});
  assert.deepEqual(meta.windows, {sender:11,receiver:22,comparison:33,cockpit:44});
  assert.equal(JSON.stringify(meta).includes('secret'), false);
});
test('readiness is waiting before roles arrive, ready when all configured roles connect, and degraded after a loss', () => {
  const meta = mod.buildSessionMeta({
    sessionId:'s1', startedAt:1,
    roles:[{role:'sender',provider:'chatgpt'},{role:'receiver',provider:'claude'}],
    launch:{providerWindows:[{id:1},{id:2}],cockpitWindow:{id:3},layout:{providers:[],cockpit:{}}}
  });
  assert.equal(mod.deriveReadiness({ meta, snapshot:{roles:{sender:false,receiver:false}} }).state, 'waiting');
  assert.equal(mod.deriveReadiness({ meta, snapshot:{roles:{sender:true,receiver:true}} }).state, 'ready');
  const degraded = mod.deriveReadiness({ meta, snapshot:{roles:{sender:true,receiver:false}} });
  assert.equal(degraded.state, 'degraded');
  assert.match(degraded.detail, /Window 2/i);
});

test('window lookup supports provider roles and cockpit only', () => {
  const meta = { windows:{sender:1,receiver:2,comparison:3,cockpit:4} };
  assert.equal(mod.windowIdForRole(meta, 'receiver'), 2);
  assert.equal(mod.windowIdForRole(meta, 'cockpit'), 4);
  assert.equal(mod.windowIdForRole(meta, 'other'), null);
});
test('provider login blockers are explicit and provider-specific', () => {
  assert.deepEqual(mod.providerLoginBlocker({
    role:'receiver', provider:'claude', url:'https://claude.ai/login', title:'Sign in - Claude'
  }), { code:'provider_login_required', role:'receiver', provider:'claude', detail:'Claude sign-in required' });
  assert.deepEqual(mod.providerLoginBlocker({
    role:'sender', provider:'chatgpt', url:'https://chatgpt.com/', title:'Get started | ChatGPT'
  }), { code:'provider_login_required', role:'sender', provider:'chatgpt', detail:'ChatGPT sign-in required' });
  assert.equal(mod.providerLoginBlocker({
    role:'comparison', provider:'chatgpt', url:'https://chatgpt.com/c/abc', title:'PM interview'
  }), null);
});
