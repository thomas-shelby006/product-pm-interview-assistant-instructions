function unit(value){let h=2166136261;for(const char of String(value)){h^=char.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h/0xffffffff;}

export function deriveProofRetryPolicy({batchId='',attempt=0,reason='',previousReason='',receiverHealthy=true,batchStillRendered=true,now=Date.now(),maxAttempts=4,randomSeed=''}={}){
  const reasonCode=String(reason||'proof_incomplete');
  const reset=Boolean(previousReason&&String(previousReason)!==reasonCode);
  const current=reset?0:Math.max(0,Number(attempt)||0);
  if(!receiverHealthy)return{retry:false,terminal:false,reason:'receiver_unhealthy',attempt:current,dueAt:0,delayMs:0,reset};
  if(!batchStillRendered)return{retry:false,terminal:true,reason:'rendered_batch_missing',attempt:current,dueAt:0,delayMs:0,reset};
  if(current>=Math.max(1,Number(maxAttempts)||4))return{retry:false,terminal:true,reason:'proof_retry_exhausted',attempt:current,dueAt:0,delayMs:0,reset};
  const raw=Math.min(5000,150*(2**current));
  const sample=unit(`${randomSeed}|${batchId}|${reasonCode}|${current}`);
  const delayMs=Math.min(5000,Math.max(25,Math.round(raw*(.85+sample*.3))));
  return{retry:true,terminal:false,reason:reasonCode,previousReason:String(previousReason||''),attempt:current+1,delayMs,dueAt:Number(now)+delayMs,reset};
}

export function resetProofRetry(){return{retry:false,terminal:false,reason:'proof_verified',attempt:0,delayMs:0,dueAt:0,reset:true};}
