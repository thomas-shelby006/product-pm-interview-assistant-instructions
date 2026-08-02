import { matchesRenderedBatch, stableFingerprint } from './batch-planner.js';

function normalize(value){return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function tokens(value){return normalize(value).toLocaleLowerCase().split(' ').filter(Boolean);}
function shingles(value,width=4){const values=tokens(value);if(values.length<width)return[];const result=[];for(let index=0;index<=values.length-width;index+=1)result.push(values.slice(index,index+width).join(' '));return result;}
function add(map,key,value){if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(value);}

export function buildRenderedProofIndex(messages=[],{fingerprintFn=stableFingerprint}={}){
  const rendered=[],exact=new Map(),byShingle=new Map(),byToken=new Map(),consumed=new Set();let queries=0;
  let ordinal=0;
  for(const message of Array.isArray(messages)?messages:[]){
    if(message?.role!=='user')continue;const text=normalize(message.text);if(!text)continue;
    const recordId=String(message.recordId||message.id||`rendered-${ordinal}`);const record={recordId,text,rawText:String(message.text||''),id:String(message.id||''),ordinal:Math.max(0,Number(message.ordinal??ordinal)||0),observedAt:Math.max(0,Number(message.observedAt||0)),identity:message.identity||null};ordinal+=1;
    rendered.push(record);add(exact,fingerprintFn(text),record);for(const shingle of shingles(text))add(byShingle,shingle,record);for(const token of new Set(tokens(text)))add(byToken,token,record);
  }

  function candidatesFor(expected,fingerprint){
    const candidates=new Set(exact.get(fingerprint(expected))||[]),expectedShingles=shingles(expected);
    for(const shingle of expectedShingles)for(const record of byShingle.get(shingle)||[])candidates.add(record);
    if(!expectedShingles.length)for(const token of new Set(tokens(expected)))for(const record of byToken.get(token)||[])candidates.add(record);
    return [...candidates].sort((a,b)=>a.ordinal-b.ordinal||a.recordId.localeCompare(b.recordId));
  }

  function match(prompt,options={}){
    queries+=1;if(!prompt?.questionCount)return{matched:false,reason:'prompt_empty'};const expected=normalize(prompt.text);if(!expected)return{matched:false,reason:'prompt_text_empty'};
    const fingerprint=options.fingerprintFn||fingerprintFn,minOrdinal=Math.max(0,Number(options.minOrdinal)||0),minObservedAt=Math.max(0,Number(options.minObservedAt)||0),excluded=new Set((options.excludeRecordIds||[]).map(String));
    for(const record of candidatesFor(expected,fingerprint)){
      if(consumed.has(record.recordId)||excluded.has(record.recordId)||record.ordinal<minOrdinal||record.observedAt<minObservedAt)continue;
      if(matchesRenderedBatch(record.rawText,prompt))return{matched:true,recordId:record.recordId,record:{...record}};
    }
    return{matched:false,reason:'rendered_proof_not_found'};
  }

  return{
    size:rendered.length,
    match,
    matches(prompt,options={}){return match(prompt,options).matched;},
    consume(recordId){const id=String(recordId||'');if(!id||!rendered.some(record=>record.recordId===id))return{consumed:false,reason:'proof_record_missing'};if(consumed.has(id))return{consumed:false,reason:'proof_record_consumed'};consumed.add(id);return{consumed:true,recordId:id};},
    release(recordId){return consumed.delete(String(recordId||''));},
    stats(){return{buildPasses:1,messagesIndexed:rendered.length,exactKeys:exact.size,shingleKeys:byShingle.size,tokenKeys:byToken.size,queries,consumed:consumed.size,available:Math.max(0,rendered.length-consumed.size)};}
  };
}
