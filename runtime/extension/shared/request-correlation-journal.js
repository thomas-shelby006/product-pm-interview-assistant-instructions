function cloneResult(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

const ACTIVE_STATES = new Set(['pending','responding']);

export class RequestCorrelationJournal {
  #entries = new Map();
  #maxEntries;

  constructor({ maxEntries = 256 } = {}) {
    this.#maxEntries = Math.max(1, Number(maxEntries) || 256);
  }

  begin(requestId, { epoch = 0, operation = '', now = Date.now() } = {}) {
    const id = String(requestId || '');
    const nextEpoch = Math.max(0, Number(epoch) || 0);
    if (!id) return { accepted:false, reason:'request_id_missing' };
    const existing = this.#entries.get(id);
    if (existing) {
      if (nextEpoch < existing.epoch) return { accepted:false, reason:'stale_epoch', entry:{...existing} };
      if (nextEpoch === existing.epoch) {
        return { accepted:false, duplicate:true, reason:ACTIVE_STATES.has(existing.state)?'request_pending':'request_completed', entry:{...existing} };
      }
      if (ACTIVE_STATES.has(existing.state)) return { accepted:false, reason:'request_epoch_conflict', entry:{...existing} };
    }
    this.#trim(this.#maxEntries - (existing ? 0 : 1));
    if (!existing && this.#entries.size >= this.#maxEntries) return { accepted:false, reason:'request_capacity_exhausted', capacity:this.#maxEntries };
    const entry = {
      requestId:id, epoch:nextEpoch, operation:String(operation || ''), state:'pending',
      createdAt:Number(now) || Date.now(), completedAt:0, responseClaimedAt:0,
      duplicateResponses:0, result:null, error:''
    };
    this.#entries.set(id, entry);
    return { accepted:true, replacedEpoch:existing ? existing.epoch : null, entry:{...entry} };
  }

  acceptResponse(requestId, epoch, now = Date.now()) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry) return { accepted:false, reason:'request_unknown' };
    if (Number(entry.epoch) !== Number(epoch)) return { accepted:false, reason:'stale_epoch' };
    if (entry.state !== 'pending') {
      entry.duplicateResponses += 1;
      return { accepted:false, duplicate:true, reason:'duplicate_response', entry:{...entry} };
    }
    entry.state = 'responding';
    entry.responseClaimedAt = Number(now) || Date.now();
    return { accepted:true, reason:'response_accepted', entry:{...entry} };
  }

  complete(requestId, result, now = Date.now()) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry || !ACTIVE_STATES.has(entry.state)) return false;
    entry.state='completed'; entry.result=cloneResult(result); entry.completedAt=Number(now)||Date.now();
    this.#trim(); return true;
  }

  fail(requestId, error, now = Date.now()) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry || !ACTIVE_STATES.has(entry.state)) return false;
    entry.state='failed'; entry.error=String(error?.message || error || 'request_failed'); entry.completedAt=Number(now)||Date.now();
    this.#trim(); return true;
  }

  result(requestId, epoch = null) {
    const entry=this.#entries.get(String(requestId || ''));
    if (!entry || (epoch != null && Number(epoch)!==entry.epoch)) return null;
    return entry.state==='completed' ? cloneResult(entry.result) : null;
  }

  remove(requestId) { return this.#entries.delete(String(requestId || '')); }
  snapshot() { return [...this.#entries.values()].map(entry=>({...entry,result:cloneResult(entry.result)})); }

  #trim(targetSize = this.#maxEntries) {
    const target = Math.max(0, Number(targetSize) || 0);
    if (this.#entries.size <= target) return;
    const removable=[...this.#entries.values()].filter(entry=>!ACTIVE_STATES.has(entry.state)).sort((a,b)=>a.completedAt-b.completedAt||a.createdAt-b.createdAt);
    while (this.#entries.size > target && removable.length) this.#entries.delete(removable.shift().requestId);
  }
}
