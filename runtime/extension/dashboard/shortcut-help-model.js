import { defaultShortcutBindings, normalizeShortcutBindings } from '../shared/shortcut-bindings.js';

const LABELS = Object.freeze({
  toggle_pause: 'Pause or resume forwarding', resume_catch_up: 'Resume and catch up', check_live: 'Check live health', repair_runtime: 'Repair runtime',
  set_auto_submit: 'Toggle automatic forwarding / manual gather', export_session: 'Export session', toggle_mic: 'Toggle sender microphone', toggle_scroll: 'Toggle receiver scroll lock', submit_now: 'Submit next batch',
  interrupt_latest: 'Interrupt for latest question', copy_latest: 'Copy latest question', copy_health_report: 'Copy health report', copy_diagnostics: 'Copy diagnostics',
  command_palette: 'Open command palette', shortcut_help: 'Open shortcut help'
});
const GROUPS = Object.freeze({
  toggle_pause: 'Delivery', resume_catch_up: 'Delivery', submit_now: 'Delivery', interrupt_latest: 'Delivery',
  check_live: 'Recovery', repair_runtime: 'Recovery', toggle_mic: 'Provider', toggle_scroll: 'Provider',
  set_auto_submit: 'Delivery', export_session: 'Review', copy_latest: 'Review', copy_health_report: 'Review', copy_diagnostics: 'Review',
  command_palette: 'Navigate', shortcut_help: 'Navigate'
});

export function deriveShortcutHelp(bindings = {}, catalog = []) {
  const normalized = normalizeShortcutBindings(bindings);
  const catalogLabels = Object.fromEntries((Array.isArray(catalog) ? catalog : []).map(item => [item.id, item.label]));
  const rows = Object.entries(normalized).map(([command, chord]) => ({ command, chord, label: catalogLabels[command] || LABELS[command] || command.replaceAll('_', ' '), group: GROUPS[command] || 'Other' }));
  const groups = {};
  for (const row of rows) (groups[row.group] ||= []).push(row);
  return { rows, groups: Object.entries(groups).map(([name, values]) => ({ name, rows: values.sort((a, b) => a.label.localeCompare(b.label)) })) };
}

export function defaultShortcutHelp() { return deriveShortcutHelp(defaultShortcutBindings()); }
