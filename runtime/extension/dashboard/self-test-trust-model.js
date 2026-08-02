function freshTimestamp(value,now,maxAge,futureTolerance){
  const timestamp=Number(value||0);if(timestamp<=0)return false;
  if(timestamp>Number(now)+Math.max(0,Number(futureTolerance)||0))return false;
  return Number(now)-timestamp<=Math.max(0,Number(maxAge)||0);
}
function roleEvidence(role,now,heartbeatFreshMs,transportFreshMs,futureToleranceMs){
  if(!role?.connected||role.phase!=='ready'||!role.composerReady)return false;
  const lane=role.transportLane||{};
  return freshTimestamp(role.heartbeatAt,now,heartbeatFreshMs,futureToleranceMs)&&lane.lastMode==='direct'&&freshTimestamp(lane.updatedAt,now,transportFreshMs,futureToleranceMs);
}

export function deriveSelfTestTrust(snapshot,now=Date.now(),{activeMs=30000,heartbeatFreshMs=15000,transportFreshMs=60000,maxPulseAgeMs=300000,futureToleranceMs=1000}={}){
  const value=snapshot?.selfTest||null;if(!value)return{state:'missing',source:'none',ageMs:0,expiresAt:0,detail:'Active runtime self-test has not run.'};
  const completedAt=Number(value.completedAt||0);
  if(completedAt>Number(now)+Math.max(0,Number(futureToleranceMs)||0))return{state:'stale',source:'active_pulse',ageMs:0,expiresAt:0,detail:'Active verification evidence is future-dated.'};
  const ageMs=completedAt?Math.max(0,Number(now)-completedAt):Infinity;
  if(value.ok!==true)return{state:'failed',source:'active_pulse',ageMs:Number.isFinite(ageMs)?ageMs:0,expiresAt:0,detail:'The last active runtime self-test failed.'};
  if(ageMs<=activeMs)return{state:'active',source:'active_pulse',ageMs,expiresAt:completedAt+activeMs,detail:'Active no-content pulse is fresh.'};
  const evidenceFresh=ageMs<=maxPulseAgeMs&&Number(snapshot?.dashboardConnections||0)>0&&roleEvidence(snapshot?.sender,now,heartbeatFreshMs,transportFreshMs,futureToleranceMs)&&roleEvidence(snapshot?.receiver,now,heartbeatFreshMs,transportFreshMs,futureToleranceMs);
  if(evidenceFresh){
    const expiresAt=Math.min(completedAt+maxPulseAgeMs,Number(snapshot.sender.heartbeatAt)+heartbeatFreshMs,Number(snapshot.receiver.heartbeatAt)+heartbeatFreshMs,Number(snapshot.sender.transportLane.updatedAt)+transportFreshMs,Number(snapshot.receiver.transportLane.updatedAt)+transportFreshMs);
    return{state:'evidence_fresh',source:'role_and_transport_evidence',ageMs,expiresAt,detail:'The active pulse is extended by fresh role and direct-port evidence.'};
  }
  return{state:'stale',source:'active_pulse',ageMs:Number.isFinite(ageMs)?ageMs:0,expiresAt:completedAt+activeMs,detail:'Active verification evidence is stale.'};
}
