import { defaultShortcutBindings, normalizeShortcutBindings, validateShortcutBinding } from './shortcut-bindings.js';

export function auditShortcutConflicts(bindings = {}) {
  const normalized = normalizeShortcutBindings(bindings);
  const issues = [];
  for (const [command, chord] of Object.entries(normalized)) {
    const withoutSelf = { ...normalized };
    delete withoutSelf[command];
    const result = validateShortcutBinding(command, chord, withoutSelf);
    if (!result.ok) issues.push({ command, chord, error: result.error, conflictCommand: result.conflictCommand || '' });
  }
  return { ok: issues.length === 0, bindings: normalized, issues, defaults: defaultShortcutBindings() };
}

export function repairShortcutConflicts(bindings = {}) {
  const defaults = defaultShortcutBindings();
  const current = normalizeShortcutBindings(bindings);
  const accepted = {};
  const repaired = [];
  for (const [command, chord] of Object.entries(current)) {
    const result = validateShortcutBinding(command, chord, accepted);
    if (result.ok) accepted[command] = result.chord;
    else { accepted[command] = defaults[command]; repaired.push({ command, from: chord, to: defaults[command], reason: result.error }); }
  }
  return { bindings: normalizeShortcutBindings(accepted), repaired };
}
