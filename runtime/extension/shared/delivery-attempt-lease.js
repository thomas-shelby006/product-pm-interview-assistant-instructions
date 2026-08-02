function safeOwner(value){return String(value||'').trim();}

export function normalizeAttemptLease(value){
  if(!value||typeof value!=='object')return null;
  const owner=safeOwner(value.owner),acquiredAt=Math.max(0,Number(value.acquiredAt)||0),expiresAt=Math.max(acquiredAt,Number(value.expiresAt)||0);
  if(!owner||!expiresAt)return null;
  return { id:String(value.id||`${owner}:${acquiredAt}`),owner,reason:String(value.reason||'delivery_attempt'),acquiredAt,expiresAt,generation:Math.max(1,Number(value.generation)||1),previousLeaseId:String(value.previousLeaseId||''),takeoverCount:Math.max(0,Number(value.takeoverCount)||0) };
}

export function isAttemptLeaseActive(value,now=Date.now()){const lease=normalizeAttemptLease(value);return Boolean(lease&&lease.expiresAt>Number(now));}

export function acquireAttemptLease(current,{ owner,reason='delivery_attempt',now=Date.now(),ttlMs=5000,leaseId='',expectedLeaseId='',random=Math.random }={}){
  const requestedOwner=safeOwner(owner); if(!requestedOwner)return{accepted:false,reason:'attempt_owner_missing',lease:normalizeAttemptLease(current)};
  const existing=normalizeAttemptLease(current),timestamp=Number(now)||Date.now(),expected=String(expectedLeaseId||'');
  if(expected&&String(existing?.id||'')!==expected)return{accepted:false,reason:'attempt_lease_expected_mismatch',lease:existing};
  if(existing&&existing.expiresAt>timestamp&&existing.owner!==requestedOwner)return{accepted:false,reason:'attempt_lease_held',lease:existing};
  if(existing&&existing.expiresAt>timestamp&&existing.owner===requestedOwner)return{accepted:true,duplicate:true,reason:'attempt_lease_reused',lease:existing};
  const takeover=Boolean(existing),generation=Math.max(0,Number(existing?.generation)||0)+1;
  const suffix=Math.max(0,Math.min(1,Number(random?.())||0)).toString(36).slice(2,8);
  const lease={ id:String(leaseId||`${requestedOwner}:${timestamp}:${generation}:${suffix}`),owner:requestedOwner,reason:String(reason||'delivery_attempt'),acquiredAt:timestamp,expiresAt:timestamp+Math.max(1,Number(ttlMs)||5000),generation,previousLeaseId:String(existing?.id||''),takeoverCount:Math.max(0,Number(existing?.takeoverCount)||0)+(takeover?1:0) };
  return{accepted:true,duplicate:false,reason:takeover?'attempt_lease_takeover':'attempt_lease_acquired',lease};
}

export function releaseAttemptLease(current,{owner='',leaseId='',generation=null}={}){
  const existing=normalizeAttemptLease(current); if(!existing)return{released:true,reason:'attempt_lease_empty',lease:null};
  if(leaseId&&existing.id!==String(leaseId))return{released:false,reason:'attempt_lease_id_mismatch',lease:existing};
  if(generation!=null&&existing.generation!==Number(generation))return{released:false,reason:'attempt_lease_generation_mismatch',lease:existing};
  if(owner&&existing.owner!==safeOwner(owner))return{released:false,reason:'attempt_lease_owner_mismatch',lease:existing};
  return{released:true,reason:'attempt_lease_released',lease:null};
}
