export function deriveProofInspector(snapshot) {
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  const accepted = ['batch_proven', 'batch_proof_rejected', 'batch_proof_duplicate', 'batch_submitted'];
  let event = null;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (accepted.includes(timeline[index]?.type)) { event = timeline[index]; break; }
  }
  if (!event) return { state: 'empty', label: 'No proof', batchId: '', memberCount: 0, detail: 'No batch proof has been evaluated.' };
  const data = event.data || {};
  const memberIds = data.memberIds || data.proof?.memberIds || [];
  if (event.type === 'batch_proof_rejected') {
    return { state: 'rejected', label: 'Rejected', batchId: String(data.batchId || ''), memberCount: memberIds.length, detail: String(data.reason || 'proof rejected') };
  }
  if (event.type === 'batch_proof_duplicate') {
    const batchId = String(data.batchId || '');
    const priorVerified = timeline.some(item => (
      item?.type === 'batch_proven' && String(item?.data?.batchId || '') === batchId
    ));
    return priorVerified
      ? { state: 'verified', label: 'Verified', batchId, memberCount: memberIds.length, detail: 'Exact member set verified; duplicate proof was ignored.' }
      : { state: 'duplicate', label: 'Duplicate', batchId, memberCount: memberIds.length, detail: 'Matching proof was already applied.' };
  }
  if (event.type === 'batch_proven') {
    return { state: 'verified', label: 'Verified', batchId: String(data.batchId || ''), memberCount: memberIds.length, detail: 'Exact member set closed by rendered proof.' };
  }
  return { state: 'pending', label: 'Pending', batchId: String(data.batchId || ''), memberCount: memberIds.length, detail: 'Batch submitted; rendered proof is pending.' };
}
