function clone(value) {
  if (!value || typeof value !== 'object') return value || null;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function createReceiverAnswerSettlement({ completeBatch, onError = () => {}, historyLimit = 32 } = {}) {
  if (typeof completeBatch !== 'function') throw new TypeError('completeBatch is required');
  let pending = null;
  let inFlight = null;
  let settledBatchId = '';
  const terminal = new Map();
  const limit = Math.max(4, Number(historyLimit) || 32);

  function remember(batchId, { state = 'complete', reason = '' } = {}) {
    const id = String(batchId || '');
    if (!id) return null;
    if (terminal.has(id)) terminal.delete(id);
    const record = { batchId: id, state: String(state || 'complete'), reason: String(reason || '') };
    terminal.set(id, record);
    while (terminal.size > limit) terminal.delete(terminal.keys().next().value);
    settledBatchId = id;
    return record;
  }

  function duplicateResult(batchId) {
    const record = terminal.get(String(batchId || ''));
    return record ? { ok: true, duplicate: true, ...record } : null;
  }

  function begin({ batchId = '', proof = null } = {}) {
    const id = String(batchId || '');
    if (!id) return { ok: false, error: 'batch_id_missing' };
    pending = { batchId: id, proof: clone(proof) };
    return { ok: true, batchId: id };
  }

  function settle(result = {}) {
    const batchId = String(result?.answerState?.batchId || pending?.batchId || '');
    const duplicate = duplicateResult(batchId);
    if (duplicate) return Promise.resolve(duplicate);
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
          remember(batchId, {
            state: result?.answerState?.state || value?.state || 'complete',
            reason: result?.answerState?.reason || value?.reason || ''
          });
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

  function cancel({ batchId = '', reason = 'cancelled' } = {}) {
    const id = String(batchId || pending?.batchId || '');
    const duplicate = duplicateResult(id);
    if (duplicate) return duplicate;
    if (inFlight) return { ok: false, error: 'answer_settlement_in_flight', batchId: id };
    if (!pending || !id || pending.batchId !== id) {
      return { ok: false, error: 'answer_settlement_missing', batchId: id };
    }
    const record = remember(id, { state: 'cancelled', reason });
    pending = null;
    return { ok: true, ...record };
  }

  function snapshot() {
    return {
      pendingBatchId: String(pending?.batchId || ''),
      inFlight: Boolean(inFlight),
      settledBatchId,
      terminalCount: terminal.size
    };
  }

  return { begin, settle, cancel, snapshot };
}
