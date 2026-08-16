import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/launch.js').catch(() => null);

test('simple launch module exists', () => assert.ok(mod));

test('three provider windows and cockpit begin creation concurrently', async () => {
  const starts = [];
  const releases = [];
  const createWindow = spec => new Promise(resolve => {
    starts.push(spec);
    releases.push(() => resolve({ id:starts.length }));
  });
  const pending = mod.launchSimpleSession({
    sessionId:'s1', senderProvider:'chatgpt', receiverProvider:'claude', comparisonProvider:'chatgpt',
    bounds:{ left:0, top:0, width:1920, height:1080 },
    chatgptUrl:'https://chatgpt.com/project', claudeUrl:'https://claude.ai/new', cockpitUrl:'chrome-extension://x/cockpit/index.html',
    createWindow
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts.length, 4);
  assert.match(starts[0].url, /pmia_role=sender/);
  assert.match(starts[1].url, /pmia_role=receiver/);
  assert.match(starts[2].url, /pmia_role=comparison/);
  assert.match(starts[3].url, /cockpit\/index\.html\?session=s1/);
  releases.forEach(release => release());
  const result = await pending;
  assert.equal(result.providerWindows.length, 3);
});

test('comparison off creates two providers plus cockpit', async () => {
  const specs = [];
  const result = await mod.launchSimpleSession({
    sessionId:'s2', senderProvider:'chatgpt', receiverProvider:'claude', comparisonProvider:'',
    bounds:{ left:0, top:0, width:1600, height:900 },
    chatgptUrl:'https://chatgpt.com/project', claudeUrl:'https://claude.ai/new', cockpitUrl:'chrome-extension://x/cockpit/index.html',
    createWindow:async spec => { specs.push(spec); return { id:specs.length }; }
  });
  assert.equal(specs.length, 3);
  assert.equal(result.providerWindows.length, 2);
});
