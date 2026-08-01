import test from 'node:test';
import assert from 'node:assert/strict';
import { auditShortcutConflicts, repairShortcutConflicts } from '../shared/shortcut-conflict-model.js';
import { auditDashboardAccessibility } from '../dashboard/accessibility-audit.js';
import { buildVisualPreferenceProof, compareVisualPreferenceProofs } from '../dashboard/visual-preference-proof.js';

test('Cycles 156-157: shortcut conflicts are detected and deterministically repaired', () => {
  const audit = auditShortcutConflicts({ command_palette: 'Ctrl+K', shortcut_help: 'Ctrl+K' });
  assert.equal(audit.ok, false);
  const repaired = repairShortcutConflicts({ command_palette: 'Ctrl+K', shortcut_help: 'Ctrl+K' });
  assert.notEqual(repaired.bindings.command_palette, repaired.bindings.shortcut_help);
  assert.equal(repaired.repaired.length, 1);
});

test('Cycle 158: accessibility audit reports duplicate ids and missing labels', () => {
  const nodes = {
    ids: [{ id: 'x' }, { id: 'x' }],
    controls: [{ id: 'b', getAttribute: () => '', textContent: '', value: '' }],
    dialogs: [{ id: 'd', getAttribute: () => '' }],
    live: [{ getAttribute: name => name === 'aria-live' ? 'polite' : '' }]
  };
  const documentLike = { querySelectorAll(selector) { if (selector === '[id]') return nodes.ids; if (selector.includes('button,input')) return nodes.controls; if (selector.includes('dialog')) return nodes.dialogs; if (selector === '[aria-live]') return nodes.live; return []; } };
  const audit = auditDashboardAccessibility(documentLike);
  assert.equal(audit.ok, false);
  assert.equal(audit.issues.some(item => item.code === 'duplicate_id'), true);
  assert.equal(audit.issues.some(item => item.code === 'assertive_live_region_missing'), true);
});

test('Cycles 159-160: visual preference proof requires reflow and visible controls at 320 and 280', () => {
  const wide = buildVisualPreferenceProof({ width: 320, scrollWidth: 320, clientWidth: 320, controlsVisible: 10, preferences: { reducedMotion: 'on' } });
  const tiny = buildVisualPreferenceProof({ width: 280, scrollWidth: 280, clientWidth: 280, controlsVisible: 8, media: { print: true } });
  assert.equal(compareVisualPreferenceProofs([wide, tiny]).ok, true);
  assert.equal(tiny.viewport.tiny, true);
});
