export function scheduleFairBatch(partitions = [], { now=Date.now(),lastSource='',maxConsecutive=2,starvationMs=45000 }={}) {
  const limit=Math.max(1,Number(maxConsecutive)||2); const starvation=Math.max(1000,Number(starvationMs)||45000);
  const values=(Array.isArray(partitions)?partitions:[]).map((item,index)=>({ ...item,index,source:String(item.source||item.provider||'default'),oldestAt:Math.max(0,Number(item.oldestAt||0)),firstSeq:Math.max(0,Number(item.firstSeq||0)),consecutive:Math.max(0,Number(item.consecutive||0)) }));
  if(!values.length) return { selected:null,reason:'empty',waitMs:0,skippedSources:[] };
  const ordered=[...values].sort((a,b)=>a.oldestAt-b.oldestAt||a.firstSeq-b.firstSeq||a.index-b.index);
  const starved=ordered.find(item=>Number.isFinite(item.oldestAt)&&Number(now)-item.oldestAt>=starvation);
  if(starved) return { selected:starved,reason:'starvation_promoted',waitMs:Math.max(0,Number(now)-starved.oldestAt),skippedSources:[...new Set(values.filter(item=>item!==starved).map(item=>item.source))] };
  const eligible=ordered.filter(item=>!(item.source===String(lastSource||'')&&item.consecutive>=limit));
  const pool=eligible.length?eligible:ordered; const selected=pool[0];
  return { selected,reason:eligible.length?'oldest_fair_partition':'fairness_relaxed',waitMs:Math.max(0,Number(now)-selected.oldestAt),skippedSources:[...new Set(ordered.filter(item=>!pool.includes(item)).map(item=>item.source))] };
}
