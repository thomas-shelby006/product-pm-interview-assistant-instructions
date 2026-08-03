import { deriveProviderRouteReadiness } from './provider-route-readiness.js';

const PROVIDERS = Object.freeze(['chatgpt','claude']);
const COMMON_AUTHORITY = Object.freeze({ transport:'service_worker', persistence:'sender_outbox_and_delivery_ledger', order:'contiguous_provider_sequence', proof:'exact_provider_rendered_turn', answer:'separate_answer_lifecycle' });
const EDGE_CAPABILITIES = Object.freeze({
  chatgpt:{ sender:['semantic_dom_observation','assistant_successor_final','manual_copy_final'], receiver:['composer_write','stable_send_control','stop_generation','rendered_turn_proof'] },
  claude:{ sender:['voice_string_frames','message_complete_final','semantic_dom_fallback','manual_copy_final'], receiver:['composer_write','stable_send_control','stop_generation','rendered_turn_proof'] }
});

export function buildProviderRouteMatrix() {
  return PROVIDERS.flatMap(senderProvider=>PROVIDERS.map(receiverProvider=>({
    id:`${senderProvider}_to_${receiverProvider}`,
    senderProvider, receiverProvider,
    senderCapabilities:[...EDGE_CAPABILITIES[senderProvider].sender],
    receiverCapabilities:[...EDGE_CAPABILITIES[receiverProvider].receiver],
    authority:{...COMMON_AUTHORITY},
    transportEquivalent:true
  })));
}

export function deriveSelectedRouteAssurance(snapshot = {}) {
  const senderProvider=String(snapshot.sender?.provider||snapshot.route?.senderProvider||'chatgpt').toLowerCase();
  const receiverProvider=String(snapshot.receiver?.provider||snapshot.route?.receiverProvider||'chatgpt').toLowerCase();
  const route=buildProviderRouteMatrix().find(item=>item.senderProvider===senderProvider&&item.receiverProvider===receiverProvider);
  if(!route)return{ok:false,state:'blocked',reason:'provider_route_unsupported',senderProvider,receiverProvider};
  const readiness=deriveProviderRouteReadiness(snapshot);
  const missing=readiness.state==='ready' ? [] : (readiness.blockers||[]).map(item=>item?.code||item);
  return{ok:missing.length===0,state:missing.length?'blocked':'ready',route,readiness,missing:[...new Set(missing)],commonAuthority:true};
}

export function auditProviderRouteMatrix() {
  const routes=buildProviderRouteMatrix();
  const ids=new Set(routes.map(item=>item.id));
  const invalid=routes.filter(item=>!item.senderCapabilities.length||!item.receiverCapabilities.length||item.authority.transport!=='service_worker'||item.authority.proof!=='exact_provider_rendered_turn');
  return{ok:routes.length===4&&ids.size===4&&!invalid.length,count:routes.length,invalid:invalid.map(item=>item.id),routes};
}

export { PROVIDERS as SUPPORTED_ROUTE_PROVIDERS };
