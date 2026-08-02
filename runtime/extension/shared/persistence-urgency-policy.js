const IMMEDIATE = new Set(['final_persisted','batch_proven','receiver_proof','session_end','storage_pressure','archive','command_result']);
const COALESCED = new Set(['preview','next_batch_draft','batch_checkpoint','semantic_telemetry']);

export function classifyPersistence(event = {}) {
  const type=String(event?.type || event || '');
  if(IMMEDIATE.has(type)) return 'immediate';
  if(COALESCED.has(type)) return 'coalesced';
  if(type==='heartbeat') return 'heartbeat';
  return 'coalesced';
}

export function createCoalescedCommitLane({ commit,delayMs=140,setTimer=setTimeout,clearTimer=clearTimeout }={}) {
  if(typeof commit!=='function') throw new TypeError('Coalesced commit lane requires commit');
  const sessions=new Map();
  const stateFor=key=>{ if(!sessions.has(key)) sessions.set(key,{reasons:new Set(),timer:null,flushing:null,cancelled:false,generation:0}); return sessions.get(key); };

  function schedule(sessionId,reason='semantic_update') {
    const key=String(sessionId||''); if(!key) return false;
    const state=stateFor(key); state.cancelled=false; state.reasons.add(String(reason||'semantic_update'));
    if(state.timer==null&&!state.flushing) state.timer=setTimer(()=>{ flush(key).catch(()=>{}); },Math.max(0,Number(delayMs)||0));
    return true;
  }

  async function flush(sessionId) {
    const key=String(sessionId||''); const state=sessions.get(key); if(!state) return false;
    if(state.flushing) return state.flushing;
    if(state.timer!=null){ clearTimer(state.timer); state.timer=null; }
    if(!state.reasons.size){ if(!state.flushing)sessions.delete(key); return false; }
    state.flushing=(async()=>{
      while(state.reasons.size&&!state.cancelled){
        const reasons=[...state.reasons].sort(); state.reasons.clear(); const generation=++state.generation;
        try { await commit(key,reasons,{generation}); }
        catch(error){ for(const reason of reasons) state.reasons.add(reason); throw error; }
      }
      return true;
    })();
    try { return await state.flushing; }
    finally { state.flushing=null; if(!state.reasons.size&&state.timer==null)sessions.delete(key); else if(state.reasons.size&&!state.cancelled&&state.timer==null)state.timer=setTimer(()=>{ flush(key).catch(()=>{}); },Math.max(0,Number(delayMs)||0)); }
  }

  async function flushAll() {
    const keys=[...sessions.keys()].sort(); const results=[];
    for(const sessionId of keys){ try{const flushed=await flush(sessionId);results.push({sessionId,ok:true,flushed:Boolean(flushed)});}catch(error){results.push({sessionId,ok:false,error:String(error?.message||error)});} }
    return results;
  }

  function cancel(sessionId) {
    const key=String(sessionId||''); const state=sessions.get(key); if(!state)return false;
    state.cancelled=true; state.reasons.clear(); if(state.timer!=null)clearTimer(state.timer); state.timer=null;
    if(!state.flushing)sessions.delete(key); return true;
  }

  return { schedule,flush,flushAll,cancel,pending(sessionId){const state=sessions.get(String(sessionId||''));return Boolean(state&&(state.reasons.size||state.flushing));},snapshot(){return [...sessions.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([sessionId,state])=>({sessionId,reasons:[...state.reasons].sort(),flushing:Boolean(state.flushing),generation:state.generation,cancelled:state.cancelled}));} };
}
