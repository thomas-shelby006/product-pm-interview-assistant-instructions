import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../cockpit/tools.js').catch(() => null);

test('cockpit tools module exists', () => assert.ok(mod));

test('elapsed time is compact and deterministic', () => {
  assert.equal(mod.formatElapsed(0), '00:00');
  assert.equal(mod.formatElapsed(65_000), '01:05');
  assert.equal(mod.formatElapsed(3_661_000), '1:01:01');
});

test('display preferences are normalized without runtime state', () => {
  assert.deepEqual(mod.normalizeDisplayPreferences({ largeText:true, highContrast:true, reducedMotion:true }), {
    largeText:true, highContrast:true, reducedMotion:true
  });
  assert.deepEqual(mod.normalizeDisplayPreferences(null), {
    largeText:false, highContrast:false, reducedMotion:false
  });
});

test('review metrics format speaking time without answer text', () => {
  assert.equal(mod.speakingLabel({ wordCount:129, estimatedSpeakingMs:60_000 }), '129 words · ~1:00 spoken');
  assert.equal(mod.speakingLabel({ wordCount:0, estimatedSpeakingMs:0 }), 'No completed answer metric');
});