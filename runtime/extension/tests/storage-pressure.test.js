import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStoragePressure } from '../shared/storage-pressure.js';

const quota = 1000;

test('storage pressure uses exact 70 85 and 95 percent boundaries', () => {
  assert.equal(classifyStoragePressure(699, quota).level, 'normal');
  assert.equal(classifyStoragePressure(700, quota).level, 'elevated');
  assert.equal(classifyStoragePressure(850, quota).level, 'high');
  assert.equal(classifyStoragePressure(950, quota).level, 'critical');
});

test('storage pressure reports stable byte and percentage diagnostics', () => {
  assert.deepEqual(classifyStoragePressure(875, quota), {
    bytes: 875,
    quotaBytes: 1000,
    ratio: 0.875,
    percent: 87.5,
    level: 'high'
  });
});


test('storage pressure preserves a safe category breakdown', () => {
  const result = classifyStoragePressure(90, 100, { actionable: 40, proven: 20 });
  assert.equal(result.level, 'high');
  assert.deepEqual(result.breakdown, { actionable: 40, proven: 20 });
});
