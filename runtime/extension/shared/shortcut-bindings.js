const DEFAULT_BINDINGS = Object.freeze({
  toggle_pause: 'Space',
  resume_catch_up: 'L',
  check_live: 'H',
  repair_runtime: 'R',
  export_session: 'E',
  toggle_mic: 'M',
  toggle_scroll: 'S',
  submit_now: 'N',
  set_auto_submit: 'A',
  interrupt_latest: 'Ctrl+I',
  copy_latest: 'C',
  copy_health_report: 'G',
  copy_diagnostics: 'D',
  command_palette: 'Ctrl+K',
  shortcut_help: '?'
});

const RESERVED_SINGLE = new Set(['Tab','Enter','Escape','Backspace','Delete','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End']);
const DESTRUCTIVE = new Set(['interrupt_latest','prepare_end_session','end_session']);
const MODIFIER_ORDER = ['Ctrl','Alt','Shift','Meta'];

function canonicalKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === ' ' || lower === 'space' || lower === 'spacebar') return 'Space';
  if (lower === 'esc') return 'Escape';
  if (lower === 'control') return 'Ctrl';
  if (lower === 'cmd' || lower === 'command' || lower === 'win') return 'Meta';
  if (lower.length === 1) return lower.toUpperCase();
  return raw[0].toUpperCase() + raw.slice(1);
}

export function normalizeShortcutChord(value) {
  const parts = String(value || '').split('+').map(part => canonicalKey(part)).filter(Boolean);
  const modifiers = new Set(parts.filter(part => MODIFIER_ORDER.includes(part)));
  const keys = parts.filter(part => !MODIFIER_ORDER.includes(part));
  if (keys.length !== 1) return '';
  const key = keys[0];
  return [...MODIFIER_ORDER.filter(item => modifiers.has(item)), key].join('+');
}

export function normalizeShortcutBindings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const output = { ...DEFAULT_BINDINGS };
  for (const [command, chord] of Object.entries(source)) {
    if (!(command in DEFAULT_BINDINGS)) continue;
    const normalized = normalizeShortcutChord(chord);
    if (normalized) output[command] = normalized;
  }
  return output;
}

export function validateShortcutBinding(command, chord, current = {}) {
  const id = String(command || '');
  const normalized = normalizeShortcutChord(chord);
  if (!(id in DEFAULT_BINDINGS)) return { ok: false, error: 'shortcut_command_unknown' };
  if (!normalized) return { ok: false, error: 'shortcut_invalid' };
  const modified = normalized.includes('+');
  if (!modified && RESERVED_SINGLE.has(normalized)) return { ok: false, error: 'shortcut_reserved' };
  if (!modified && DESTRUCTIVE.has(id)) return { ok: false, error: 'destructive_shortcut_requires_modifier' };
  const bindings = normalizeShortcutBindings(current);
  const conflict = Object.entries(bindings).find(([other, value]) => other !== id && value === normalized);
  return conflict
    ? { ok: false, error: 'shortcut_conflict', conflictCommand: conflict[0], chord: normalized }
    : { ok: true, command: id, chord: normalized };
}

export function setShortcutBinding(current = {}, command, chord) {
  const validation = validateShortcutBinding(command, chord, current);
  if (!validation.ok) return { ...validation, bindings: normalizeShortcutBindings(current) };
  return { ok: true, command: validation.command, chord: validation.chord, bindings: { ...normalizeShortcutBindings(current), [validation.command]: validation.chord } };
}

export function defaultShortcutBindings() { return { ...DEFAULT_BINDINGS }; }

export function shortcutChordFromEvent(event = {}) {
  const key = canonicalKey(event.key);
  if (!key || MODIFIER_ORDER.includes(key)) return '';
  return normalizeShortcutChord([
    event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.metaKey ? 'Meta' : '', key
  ].filter(Boolean).join('+'));
}

export function resolveShortcutCommand(bindings = {}, event = {}) {
  const chord = shortcutChordFromEvent(event);
  if (!chord) return '';
  const match = Object.entries(normalizeShortcutBindings(bindings)).find(([, value]) => value === chord);
  return match?.[0] || '';
}

export const shortcutForEvent = shortcutChordFromEvent;
