export function deriveBatchPlan(snapshot) {
  const next = snapshot?.batchState?.next || {};
  const currentCount = Math.max(0, Number(next.firstPartitionCount || next.questionCount || next.memberIds?.length || 0));
  const protectedCount = Math.max(currentCount, Number(next.protectedCount || currentCount));
  const remainingCount = Math.max(0, Number(next.remainingCount ?? protectedCount - currentCount) || 0);
  const partitionCount = protectedCount ? Math.max(1, Number(next.partitionCount || 1)) : 0;
  return { currentCount, protectedCount, remainingCount, partitionCount };
}
