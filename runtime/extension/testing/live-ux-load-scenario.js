import { buildCommandSearchIndex, searchCommandIndex } from '../shared/command-search-index.js';
import { deriveVirtualList } from '../dashboard/virtual-list-model.js';
import { deriveLiveUxMemoryBudget } from '../shared/live-ux-memory-budget.js';

function deterministicText(seed, index) { return `command-${seed}-${index}-${(seed * 1103515245 + index * 12345) >>> 0}`; }

export function runLiveUxLoadScenario({ seed = 17, commandCount = 1000, ledgerCount = 10000, timelineCount = 2000 } = {}) {
  const commands = Array.from({ length: commandCount }, (_, index) => ({ id: `cmd_${index}`, label: deterministicText(seed, index), group: index % 5 === 0 ? 'Recovery' : 'Delivery' }));
  const index = buildCommandSearchIndex(commands);
  const search = searchCommandIndex(index, String(seed), 40);
  const ledger = Array.from({ length: ledgerCount }, (_, index) => ({ id: `q${index}`, state: index % 3 ? 'persisted' : 'proven' }));
  const timeline = Array.from({ length: timelineCount }, (_, index) => ({ id: index, type: index % 2 ? 'heartbeat' : 'delivery_outcome' }));
  const viewport = deriveVirtualList({ count: ledger.length, scrollTop: ledger.length * 24, viewportHeight: 600, rowHeight: 48, overscan: 8 });
  const budget = deriveLiveUxMemoryBudget({ ledger, timeline, questionOperationsDerived: { questions: ledger.slice(0, 500) }, liveUxUsage: { commandIndex: index.length, idleTasks: 20 } });
  return { seed, counts: { commands: commands.length, ledger: ledger.length, timeline: timeline.length }, searchCount: search.length, viewport, budget, deterministicKey: `${seed}:${commands.length}:${ledger.length}:${timeline.length}:${search.map(item => item.id).join(',')}` };
}
