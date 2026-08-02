function booleans(report={}){return Object.fromEntries(Object.entries(report).filter(([key,value])=>key!=='complete'&&key!=='required'&&typeof value==='boolean'));}

export function evaluateAdapterCapabilityDrift(previous={},current={},prior=null,now=Date.now(),{stableSamples=3}={}){
  const before=booleans(previous),after=booleans(current);
  const required=new Set([...(Array.isArray(previous?.required)?previous.required:[]),...(Array.isArray(current?.required)?current.required:[])].map(String));
  const keys=[...new Set([...Object.keys(before),...Object.keys(after),...required])].sort();
  const removed=keys.filter(key=>before[key]===true&&after[key]!==true);
  const restored=keys.filter(key=>before[key]!==true&&after[key]===true);
  const criticalRemoved=removed.filter(key=>required.has(key));
  const timestamp=Number(now)||Date.now();
  if(removed.length)return{state:criticalRemoved.length?'critical':'degraded',severity:criticalRemoved.length?'critical':'warning',removed,restored:[],criticalRemoved,required:[...required].sort(),firstSeenAt:Number(prior?.firstSeenAt||timestamp),lastSeenAt:timestamp,stableRecoveryCount:0};
  if(prior&&prior.state!=='stable'){
    const count=Math.max(0,Number(prior.stableRecoveryCount)||0)+1,threshold=Math.max(1,Number(stableSamples)||3),stable=count>=threshold;
    return{state:stable?'stable':'recovering',severity:stable?'none':'warning',removed:[],restored,criticalRemoved:[],required:[...required].sort(),firstSeenAt:Number(prior.firstSeenAt||timestamp),lastSeenAt:timestamp,stableRecoveryCount:count};
  }
  return{state:'stable',severity:'none',removed:[],restored,criticalRemoved:[],required:[...required].sort(),firstSeenAt:0,lastSeenAt:timestamp,stableRecoveryCount:0};
}
