import test from 'node:test';
import assert from 'node:assert/strict';
import { fanOutTurn } from '../simple/fanout.js';

const mod = await import('../simple/layout.js').catch(() => null);

test('simple layout module exists', () => assert.ok(mod));

test('three-window layout reserves a compact bottom cockpit', () => {
  const layout = mod.computeSimpleLayout({ left:0, top:0, width:1920, height:1080 }, 3, { cockpitHeight:120 });
  assert.deepEqual(layout.providers.map(value => [value.left,value.top,value.width,value.height]), [
    [0,0,640,960],[640,0,640,960],[1280,0,640,960]
  ]);
  assert.deepEqual(layout.cockpit, { left:0, top:960, width:1920, height:120 });
});

test('two-window layout expands providers while keeping the same cockpit strip', () => {
  const layout = mod.computeSimpleLayout({ left:10, top:20, width:1800, height:1000 }, 2, { cockpitHeight:120 });
  assert.deepEqual(layout.providers.map(value => value.width), [900,900]);
  assert.equal(layout.providers[0].height, 880);
  assert.deepEqual(layout.cockpit, { left:10, top:900, width:1800, height:120 });
});

test('in-memory fanout adds no intentional serial delay', async () => {
  const turn = { sessionId:'s', turnId:'t', text:'Q', kind:'question' };
  const started = performance.now();
  for (let i = 0; i < 1000; i += 1) {
    await fanOutTurn({ turn, roles:['receiver','comparison'], deliver:async role => ({ role, stage:'rendered' }) });
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 250, `1000 fanouts took ${elapsed.toFixed(1)}ms`);
});
