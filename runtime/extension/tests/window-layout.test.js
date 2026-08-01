import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeWindowLayout, windowUpdateForBounds } from '../shared/window-layout.js';

test('three-window layout gives each managed surface explicit bounds', () => {
  const layout = getRuntimeWindowLayout('layout_both');
  assert.equal(layout.mode, 'three_window');
  assert.equal(layout.sender.left, 0);
  assert.equal(layout.dashboard.left, 1424);
});

test('dashboard-only layout moves provider windows off screen', () => {
  const layout = getRuntimeWindowLayout('layout_dashboard');
  assert.equal(layout.sender.left, 3840);
  assert.equal(layout.receiver.left, 3840);
  assert.equal(layout.dashboard.left, 0);
});

test('window updates are normalized and non-focused by default', () => {
  assert.deepEqual(windowUpdateForBounds({ left: 1.2, top: 2.8, width: 100, height: 100 }), {
    left: 1,
    top: 3,
    width: 320,
    height: 240,
    focused: false,
    state: 'normal'
  });
});
