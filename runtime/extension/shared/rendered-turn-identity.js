function normalize(value){return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function hash(value){let h=0x811c9dc5;for(const char of String(value)){h^=char.codePointAt(0);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}

export function canonicalRenderedTurnIdentity({provider='',role='',stableId='',conversationId='',text='',previousRole='',nextRole='',previousStableId='',nextStableId='',ordinal=0}={}){
  const normalized=normalize(text),conversation=String(conversationId||''),stable=String(stableId||'');
  const structural=[provider,role,conversation,stable,previousRole,nextRole,previousStableId,nextStableId,Number(ordinal||0)].join('|');
  const identity=stable?`${provider}:${role}:${conversation||'default'}:${stable}`:`${provider}:${role}:${hash(`${structural}|${normalized}`)}`;
  return {provider:String(provider),role:String(role),stableId:stable,conversationId:conversation,previousStableId:String(previousStableId||''),nextStableId:String(nextStableId||''),ordinal:Math.max(0,Number(ordinal)||0),textHash:hash(normalized),textLength:normalized.length,structuralHash:hash(structural),identity};
}

export function sameRenderedTurn(first={},second={}){
  if(first.identity&&second.identity&&first.identity===second.identity)return true;
  return first.provider===second.provider&&first.role===second.role&&first.conversationId===second.conversationId&&first.structuralHash===second.structuralHash&&first.textHash===second.textHash;
}
