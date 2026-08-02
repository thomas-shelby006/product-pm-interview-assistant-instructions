function clone(value) {
  if (!value || typeof value !== 'object') return value || null;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function createReceiverAnswerSettlement({ completeBatch, onError = () => {} } = {}) {
  if (typeof completeBatch !== 'function') throw new TypeError('completeBatch is required');
  let pending = null;
  let inFlight = null;
  let settledBatchId = '';

  function begin({ batchId = '', proof = null } = {}) {
    const id = String(batchId || '');
    if (!id) return { ok: false, error: 'batch_id_missing' };
    pending = { batchId: id, proof: clone(proof) };
    if (settledBatchId !== id) settledBatchId = '';
    return { ok: true, batchId: id };
  }

  function settle(result = {}) {
    const batchId = String(result?.answerState?.batchId || pending?.batchId || '');
    if (settledBatchId && settledBatchId === batchId) return Promise.resolve({ ok: true, duplicate: true, batchId });
    if (!pending || !batchId || pending.batchId !== batchId) {
      return Promise.resolve({ ok: false, error: 'answer_settlement_missing', batchId });
    }
    if (inFlight) return inFlight;
    const payload = {
      answer: clone(result),
      answerState: clone(result?.answerState),
      timeout: Boolean(result?.timeout),
      proof: clone(pending.proof)
    };
    inFlight = Promise.resolve().then(() => completeBatch(batchId, payload))
      .then(value => {
        if (value?.ok !== false) {
          settledBatchId = batchId;
          pending = null;
        }
        return value;
      })
      .catch(error => {
        try { onError(error, { batchId }); } catch {}
        return { ok: false, error: String(error?.message || error), batchId };
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  function snapshot() {
    return {
      pendingBatchId: String(pending?.batchId || ''),
      inFlight: Boolean(inFlight),
      settledBatchId
    };
  }

  return { begin, settle, snapshot };
}
