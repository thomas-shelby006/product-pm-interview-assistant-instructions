import { selectDuePartition } from './delivery-deadline-queue.js';

export function deriveBatchSchedulingDecision({
  memberIds = [],
  oldestAt = 0,
  now = Date.now(),
  hold = false,
  autoSubmit = true,
  receiverBusy = false,
  draftConflict = false,
  partitions = null
} = {}) {
  const ids = (Array.isArray(memberIds) ? memberIds : []).map(String);
  const sourcePartitions = Array.isArray(partitions) && partitions.length
    ? partitions
    : ids.length
      ? [{ index: 0, memberIds: ids, oldestAt, firstSeq: 0 }]
      : [];
  const decision = selectDuePartition(sourcePartitions, {
    now,
    hold,
    active: receiverBusy,
    autoSubmit,
    draftConflict
  });
  return {
    memberIds: decision.selected?.memberIds || sourcePartitions[0]?.memberIds || ids,
    selectedPartitionIndex: decision.selected?.index ?? null,
    ageMs: decision.ageMs,
    deadlineAt: decision.deadlineAt,
    urgency: decision.urgency,
    reason: decision.reason,
    submitRecommended: decision.submitRecommended,
    evaluatedAt: decision.evaluatedAt
  };
}
