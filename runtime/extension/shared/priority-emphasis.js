const RANK = Object.freeze({ critical: 4, high: 3, normal: 2, low: 1 });

export function applyPriorityEmphasis(questions = [], now = Date.now()) {
  const output = questions.map((item, deliveryOrder) => {
    const priority = String(item.operator?.priority || 'normal');
    const overdue = item.operator?.deferCondition === 'until_time' && Number(item.operator?.deferUntil || 0) <= now;
    const level = item.operator?.pinned ? 'pinned' : overdue ? 'due' : priority;
    return { ...item, deliveryOrder, emphasis: { level, rank: item.operator?.pinned ? 5 : overdue ? 4 : (RANK[priority] || 2), overdue } };
  });
  return { questions: output, sequencePreserved: output.every((item, index) => item.deliveryOrder === index) };
}
