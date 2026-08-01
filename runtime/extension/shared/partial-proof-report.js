export function buildPartialProofReport({ batchId = '', expectedIds = [], provenIds = [], mismatchedIds = [], reason = '', now = Date.now() } = {}) {
  const expected = [...new Set((expectedIds || []).map(String).filter(Boolean))];
  const proven = new Set((provenIds || []).map(String));
  const missing = expected.filter(id => !proven.has(id));
  return { batchId: String(batchId), expectedIds: expected, provenIds: expected.filter(id => proven.has(id)), missingIds: missing, mismatchedIds: [...new Set((mismatchedIds || []).map(String).filter(Boolean))], complete: missing.length === 0 && !(mismatchedIds || []).length, reason: String(reason || (missing.length ? 'partial_proof' : '')), observedAt: now };
}

export function mergePartialProofReports(previous = {}, current = {}) {
  const expectedIds = [...new Set([...(previous.expectedIds || []), ...(current.expectedIds || [])])];
  const provenIds = [...new Set([...(previous.provenIds || []), ...(current.provenIds || [])])];
  const mismatchedIds = [...new Set([...(previous.mismatchedIds || []), ...(current.mismatchedIds || [])])];
  return buildPartialProofReport({ batchId: current.batchId || previous.batchId, expectedIds, provenIds, mismatchedIds, reason: current.reason || previous.reason, now: current.observedAt || Date.now() });
}
