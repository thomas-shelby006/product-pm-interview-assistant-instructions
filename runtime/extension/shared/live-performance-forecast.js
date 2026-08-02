function percentile(values,p){ if(!values.length) return 0; const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))]; }
export function deriveLivePerformanceForecast(snapshot = {}, now = Date.now()) {
  const samples=(snapshot.timeline || []).filter(item=>['final_observed','receiver_proof','answer_state','delivery_result'].includes(item.type)).slice(-120);
  const horizon=300000; const recent=samples.filter(item=>now-Number(item.at || item.createdAt || 0)<=horizon);
  const finals=recent.filter(item=>item.type==='final_observed').length; const proofs=recent.filter(item=>item.type==='receiver_proof').length;
  const proofLatencies=(snapshot.metrics?.proofSamples || snapshot.metrics?.deliveryProofSamples || []).map(Number).filter(Number.isFinite).slice(-60);
  const unresolved=['pending','persisted','failed','staged','submitting','inFlight'].reduce((sum,key)=>sum+Math.max(0,Number(snapshot.ledgerCounts?.[key] || 0)),0);
  const intakePerMinute=finals/(horizon/60000); const proofPerMinute=proofs/(horizon/60000); const net=Math.max(0,proofPerMinute-intakePerMinute);
  const estimatedCatchUpMs=unresolved && net>0 ? Math.round(unresolved/net*60000) : unresolved ? null : 0;
  const confidence=recent.length>=8 && proofLatencies.length>=3 ? 'high' : recent.length>=3 ? 'medium' : 'low';
  const providerDelay=percentile(proofLatencies,.9); const state=unresolved===0 ? 'caught_up' : net<=0 && intakePerMinute>proofPerMinute ? 'falling_behind' : estimatedCatchUpMs!==null && estimatedCatchUpMs>120000 ? 'at_risk' : 'recovering';
  return { state, confidence, unresolved, intakePerMinute:Number(intakePerMinute.toFixed(2)), proofPerMinute:Number(proofPerMinute.toFixed(2)), estimatedCatchUpMs, providerProofP90Ms:providerDelay, internalRenderMs:Number(snapshot.performanceBudget?.lastRenderMs || 0), commandWaitMs:Number(snapshot.performanceBudget?.commitWaitMs || 0), recommendedProfile:state==='falling_behind' && snapshot.selfTest?.ok ? 'fast' : state==='at_risk' ? 'balanced' : '', evaluatedAt:now };
}