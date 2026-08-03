import test from 'node:test';
import assert from 'node:assert/strict';
import { exportManagedSession } from '../shared/session-control.js';
import { auditProviderRouteMatrix, deriveSelectedRouteAssurance } from '../shared/provider-route-matrix-assurance.js';

function registry() {
  return { getSession:id=>id==='s1'?{sender:{tabId:11},receiver:{tabId:22}}:null };
}

function healthyRoute(senderProvider='chatgpt',receiverProvider='claude') {
  const capability={ complete:true, required:[], missingRequired:[] };
  return {
    sender:{provider:senderProvider,connected:true,phase:'ready',composerReady:true,adapterCapabilities:capability},
    receiver:{provider:receiverProvider,connected:true,phase:'ready',composerReady:true,adapterCapabilities:capability,adapterCapabilityProbation:{writeSafe:true}},
    contextArmed:true,selfTest:{ok:true},deliveryPolicy:{active:false}
  };
}

test('Cycles 211-215: role export succeeds only after both managed tabs acknowledge', async () => {
  const calls=[];
  const result=await exportManagedSession({registry:registry(),sessionId:'s1',sendToTab:async(tabId,message)=>{calls.push([tabId,message.type]);return{ok:true};}});
  assert.equal(result.ok,true);assert.deepEqual(result.exportedTabIds,[11,22]);
  assert.deepEqual(calls,[[11,'PMIA_EXPORT_SESSION'],[22,'PMIA_EXPORT_SESSION']]);
});
test('Cycles 216-218: one failed role export fails the session export', async () => {
  const result=await exportManagedSession({registry:registry(),sessionId:'s1',sendToTab:async tabId=>tabId===11?{ok:true}:{ok:false,error:'receiver_export_failed'}});
  assert.equal(result.ok,false);assert.equal(result.error,'receiver_export_failed');
});

test('Cycles 219-220: all four provider routes retain common transport authority', () => {
  const audit=auditProviderRouteMatrix();
  assert.equal(audit.ok,true);assert.equal(audit.count,4);
  for(const route of audit.routes){
    assert.equal(route.transportEquivalent,true);
    assert.equal(route.authority.transport,'service_worker');
    assert.equal(route.authority.persistence,'sender_outbox_and_delivery_ledger');
    assert.equal(route.authority.proof,'exact_provider_rendered_turn');
  }
  const selected=deriveSelectedRouteAssurance(healthyRoute('chatgpt','claude'));
  assert.equal(selected.ok,true);assert.equal(selected.route.id,'chatgpt_to_claude');
});
