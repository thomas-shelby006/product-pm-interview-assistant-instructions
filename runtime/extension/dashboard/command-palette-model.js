import { commandCatalog, commandPreview, searchCommands } from '../shared/operator-command-catalog.js';

export function createCommandPaletteState(snapshot = {}, value = {}) {
  const catalog = commandCatalog(snapshot);
  const query = String(value.query || '');
  const results = searchCommands(catalog, query);
  const selectedIndex = Math.min(Math.max(0, Number(value.selectedIndex || 0)), Math.max(0, results.length - 1));
  const selected = results[selectedIndex] || null;
  return {
    open: Boolean(value.open), query, results, selectedIndex, selected,
    preview: selected ? commandPreview(selected, snapshot) : null,
    recent: Array.isArray(value.recent) ? value.recent.slice(0, 8) : []
  };
}

export function movePaletteSelection(state = {}, direction = 1) {
  const results = state.results || [];
  if (!results.length) return { ...state, selectedIndex: 0, selected: null, preview: null };
  const index = (Number(state.selectedIndex || 0) + Number(direction || 0) + results.length) % results.length;
  const selected = results[index];
  return { ...state, selectedIndex: index, selected, preview: commandPreview(selected, {}) };
}

export function recordPaletteCommand(recent = [], command = '') {
  const id = String(command || '');
  if (!id) return recent.slice(0, 8);
  return [id, ...recent.filter(value => value !== id)].slice(0, 8);
}
