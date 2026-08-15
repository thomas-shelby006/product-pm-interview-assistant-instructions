import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderSender } from '../content/senders/provider-sender.js';

test('inactive-voice stable-tail fallback stays below 200 ms when authoritative provider boundary is absent', () => {
  let messages = [];
  const timers = [];
  const adapter = {
    provider:'claude',
    getConversationMessages:()=>messages,
    isVoiceActive:()=>false,
    isComposerEmpty:()=>true,
    isGenerating:()=>false
  };
  const sender = createProviderSender({
    adapter,
    onFinal:()=>{},
    setTimeoutFn:(callback,delay)=>{ timers.push({callback,delay}); return timers.length; },
    clearTimeoutFn:()=>{}
  });
  messages = [{ id:'u1', role:'user', text:'How would you improve activation?' }];
  sender.observe(1000);
  assert.ok(timers.at(-1).delay <= 200, `fallback delay was ${timers.at(-1).delay} ms`);
  sender.disconnect();
});
