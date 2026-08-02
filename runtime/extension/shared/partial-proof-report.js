export function buildPartialProofReport({batchId='',expectedIds=[],provenIds=[],mismatchedIds=[],reason='',now=Date.now()}={}){
  const expected=[...new Set((expectedIds||[]).map(String).filter(Boolean))];
  const provenSet=new Set((provenIds||[]).map(String).filter(Boolean));
  const proven=expected.filter(id=>provenSet.has(id));
  const mismatched=[...new Set((mismatchedIds||[]).map(String).filter(Boolean))].filter(id=>expected.includes(id)&&!provenSet.has(id));
  const missing=expected.filter(id=>!provenSet.has(id));
  const complete=missing.length===0&&mismatched.length===0;
  return{batchId:String(batchId),expectedIds:expected,provenIds:proven,missingIds:missing,mismatchedIds:mismatched,complete,reason:String(complete?'':reason||(missing.length?'partial_proof':mismatched.length?'proof_mismatch':'')),observedAt:Math.max(0,Number(now)||Date.now())};
}

export function mergePartialProofReports(previous={},current={}){
  const expectedIds=[...new Set([...(previous.expectedIds||[]),...(current.expectedIds||[])].map(String).filter(Boolean))];
  const provenIds=[...new Set([...(previous.provenIds||[]),...(current.provenIds||[])].map(String).filter(Boolean))];
  const provenSet=new Set(provenIds);
  const mismatchedIds=[...new Set([...(previous.mismatchedIds||[]),...(current.mismatchedIds||[])].map(String).filter(Boolean))].filter(id=>!provenSet.has(id));
  return buildPartialProofReport({batchId:current.batchId||previous.batchId,expectedIds,provenIds,mismatchedIds,reason:current.reason||previous.reason,now:current.observedAt||previous.observedAt||Date.now()});
}
