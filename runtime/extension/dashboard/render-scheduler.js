export function createRenderScheduler({ frame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id),onError=()=>{} }={}) {
  let handle=0,pending=new Set(),renderer=null,generation=0,lastError='';
  function invoke(current){try{renderer(current);lastError='';return true;}catch(error){lastError=String(error?.message||error||'render_failed');try{onError(error,current);}catch{}return false;}}
  function schedule(sections=[],render=renderer){renderer=render;for(const section of Array.isArray(sections)?sections:[sections])if(section)pending.add(String(section));if(handle||typeof renderer!=='function')return handle;const scheduledGeneration=generation;handle=frame(()=>{if(scheduledGeneration!==generation)return;handle=0;const current=[...pending];pending.clear();if(current.length)invoke(current);});return handle;}
  function flush(){if(!pending.size||typeof renderer!=='function')return [];if(handle)cancelFrame(handle);handle=0;generation+=1;const current=[...pending];pending.clear();invoke(current);return current;}
  function cancel(){if(handle)cancelFrame(handle);handle=0;pending.clear();generation+=1;}
  return {schedule,flush,cancel,snapshot:()=>({scheduled:Boolean(handle),pending:[...pending],generation,lastError})};
}
