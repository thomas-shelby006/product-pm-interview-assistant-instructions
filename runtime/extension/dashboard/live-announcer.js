export function createLiveAnnouncer({politeNode,assertiveNode,now=Date.now,minGapMs=900,queueTask=queueMicrotask}={}){
  const channels={polite:{lastAt:0,lastMessage:'',generation:0},assertive:{lastAt:0,lastMessage:'',generation:0}};
  let lastAt=0,lastMessage='',lastPriority='polite';
  function announce(message,{priority='polite',force=false}={}){
    const kind=priority==='assertive'?'assertive':'polite',state=channels[kind],text=String(message||'').trim(),at=Number(now())||Date.now();
    if(!text||(!force&&text===state.lastMessage&&at-state.lastAt<minGapMs))return false;
    const node=kind==='assertive'?assertiveNode:politeNode;if(!node)return false;
    const generation=++state.generation;node.textContent='';
    queueTask(()=>{if(channels[kind].generation===generation)node.textContent=text;});
    state.lastAt=at;state.lastMessage=text;lastAt=at;lastMessage=text;lastPriority=kind;return true;
  }
  return{announce,snapshot:()=>({lastAt,lastMessage,lastPriority,channels:{polite:{...channels.polite},assertive:{...channels.assertive}}})};
}
