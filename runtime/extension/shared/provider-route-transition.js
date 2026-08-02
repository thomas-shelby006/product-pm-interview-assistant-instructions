import { canonicalFingerprint } from './canonical-fingerprint.js';
export function deriveProviderRouteTransition(snapshot = {}, target = {}) {
  const summaryMode=Boolean(snapshot.previous || snapshot.current || 'activeCount' in snapshot || 'nextCount' in snapshot);
  const previous=summaryMode ? snapshot.previous || {} : { route:`${snapshot.sender?.provider || ''} -> ${snapshot.receiver?.provider || ''}`, ready:true };
  const currentRoute=summaryMode ? snapshot.current || {} : { route:`${target.sender || snapshot.sender?.provider || ''} -> ${target.receiver || snapshot.receiver?.provider || ''}`, ready:true };
  const current={ sender:String(previous.sender || previous.route?.split(' -> ')[0] || snapshot.sender?.provider || ''), receiver:String(previous.receiver || previous.route?.split(' -> ')[1] || snapshot.receiver?.provider || '') };
  const next={ sender:String(currentRoute.sender || currentRoute.route?.split(' -> ')[0] || target.sender || current.sender), receiver:String(currentRoute.receiver || currentRoute.route?.split(' -> ')[1] || target.receiver || current.receiver) };
  const changed=current.sender!==next.sender||current.receiver!==next.receiver;
  const protectedCount=summaryMode ? Math.max(0,Number(snapshot.activeCount||0)+Number(snapshot.nextCount||0)) : Math.max(0,Number(snapshot.ledgerCounts?.unresolved ?? (Number(snapshot.ledgerCounts?.pending||0)+Number(snapshot.ledgerCounts?.inFlight||0))));
  const activeGeneration=summaryMode ? Number(snapshot.activeCount||0)>0 : Boolean(snapshot.receiver?.generating || snapshot.batchState?.active);
  const freezeRequired=changed&&(protectedCount>0||activeGeneration);
  return { state:!changed?'stable':freezeRequired?'freeze_required':'ready_to_switch',changed,current,next,protectedCount,activeGeneration,freezeWrites:freezeRequired,allowProviderWrite:!freezeRequired,fingerprint:canonicalFingerprint({current,next,protectedCount,activeGeneration}),recommendedCommand:freezeRequired?'pause':'check_live',explanation:freezeRequired?`${protectedCount} protected question${protectedCount===1?'':'s'} keep provider writes frozen until the route is revalidated.`:changed?'The provider route can switch after a live check.':'The provider route is unchanged.' };
}
