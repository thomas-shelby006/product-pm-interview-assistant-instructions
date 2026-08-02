function percentile(values,p){ const list=(Array.isArray(values)?values:[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!list.length)return 0;const index=Math.min(list.length-1,Math.max(0,Math.ceil((p/100)*list.length)-1));return Math.round(list[index]); }
export function deriveBacklogForecast({ queued=0,oldestAgeMs=0,targetMs=20000,proofLatenciesMs=[],proofs=[] }={},now=Date.now()) {
  const count=Math.max(0,Number(queued)||0),target=Math.max(1,Number(targetMs)||20000),age=Math.max(0,Number(oldestAgeMs)||0),cutoff=Number(now)-300000;
  const times=(Array.isArray(proofs)?proofs:[]).map(item=>Number(item?.at)).filter(value=>Number.isFinite(value)&&value<=Number(now)&&value>=cutoff).sort((a,b)=>a-b);
  const latencies=(Array.isArray(proofLatenciesMs)?proofLatenciesMs:[]).map(Number).filter(value=>Number.isFinite(value)&&value>=0);
  const windowMs=times.length>1?Math.max(1000,times.at(-1)-times[0]):60000;const proofsPerMinute=times.length>1?Math.round(((times.length-1)*60000/windowMs)*100)/100:0;
  const perItemMs=proofsPerMinute>0?60000/proofsPerMinute:latencies.length>=3?percentile(latencies,50):0;const confidence=times.length>=4&&latencies.length>=3?'high':times.length>=2||latencies.length>=3?'medium':'low';
  const drainEstimateMs=count&&perItemMs?Math.round(count*perItemMs):count?null:0;const projectedAgeMs=age+(Number.isFinite(drainEstimateMs)?drainEstimateMs:0);
  const risk=count===0?'clear':age>=target?'breached':confidence==='low'?'unknown':projectedAgeMs>=target?'at_risk':projectedAgeMs>=target*.7?'watch':'clear';
  return { queued:count,p50ProofMs:percentile(latencies,50),p95ProofMs:percentile(latencies,95),proofsPerMinute,drainEstimateMs,oldestAgeMs:age,projectedAgeMs,targetMs:target,risk,confidence,evidenceCount:times.length+latencies.length,evaluatedAt:Number(now)||Date.now() };
}
