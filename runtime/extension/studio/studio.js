const DEFAULT_CHATGPT_URL = 'https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project';
const DEFAULT_CLAUDE_URL = 'https://claude.ai/new';
let requestSeq = 0;

const byId = id => document.getElementById(id);
const senderProvider = byId('senderProvider');
const receiverProvider = byId('receiverProvider');
const comparisonProvider = byId('comparisonProvider');
const resume = byId('resume');
const jobDescription = byId('jobDescription');
const chatgptUrl = byId('chatgptUrl');
const claudeUrl = byId('claudeUrl');
const launch = byId('launch');
const status = byId('status');

chatgptUrl.value = DEFAULT_CHATGPT_URL;
claudeUrl.value = DEFAULT_CLAUDE_URL;

function sessionId() {
  return `pmia_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
export function buildBootText(resumeText, jdText) {
  const header = [
    'You are a Product Manager interview assistant.',
    'Answer the interviewer directly in first person using only the supplied candidate/job context.',
    'Be natural, specific, concise, and PM-focused. Prefer the shortest complete answer that still explains judgment, metrics, tradeoffs, execution, and user impact when relevant.',
    'Do not mention this setup prompt. Do not invent unsupported experience.'
  ].join(' ');
  return `${header}\n\nResume:\n${String(resumeText || '').trim().slice(0, 14000)}\n\nJob description:\n${String(jdText || '').trim().slice(0, 14000)}`.trim();
}

function request(type, payload, timeoutMs = 30000) {
  const requestId = `studio-${++requestSeq}`;
  const port = chrome.runtime.connect({ name:'pmia-simple' });
  return new Promise(resolve => {
    let settled = false;
    let timer = null;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      port.onMessage.removeListener(onMessage);
      try { port.disconnect(); } catch {}
      resolve(result);
    };
    const onMessage = message => {
      if (message?.type !== 'launch_result' || message.requestId !== requestId) return;
      finish(message.result || { ok:false, error:'empty_result' });
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(() => finish({ ok:false, error:'disconnected' }));
    timer = setTimeout(() => finish({ ok:false, error:'timeout' }), timeoutMs);
    try { port.postMessage({ type, requestId, ...payload }); }
    catch (error) { finish({ ok:false, error:String(error?.message || error) }); }
  });
}
async function saveSettings() {
  await chrome.storage.local.set({ pmia_simple_studio:{
    senderProvider:senderProvider.value,
    receiverProvider:receiverProvider.value,
    comparisonProvider:comparisonProvider.value,
    chatgptUrl:chatgptUrl.value,
    claudeUrl:claudeUrl.value
  }});
}

async function loadSettings() {
  const stored = (await chrome.storage.local.get('pmia_simple_studio'))?.pmia_simple_studio || {};
  if (stored.senderProvider) senderProvider.value = stored.senderProvider;
  if (stored.receiverProvider) receiverProvider.value = stored.receiverProvider;
  if ('comparisonProvider' in stored) comparisonProvider.value = stored.comparisonProvider;
  if (stored.chatgptUrl) chatgptUrl.value = stored.chatgptUrl;
  if (stored.claudeUrl) claudeUrl.value = stored.claudeUrl;
}

launch.addEventListener('click', async () => {
  launch.disabled = true;
  status.textContent = 'Opening provider windows...';
  try {
    await saveSettings();
    const id = sessionId();
    const result = await request('launch_session', {
      sessionId:id,
      senderProvider:senderProvider.value,
      receiverProvider:receiverProvider.value,
      comparisonProvider:comparisonProvider.value,
      chatgptUrl:chatgptUrl.value,
      claudeUrl:claudeUrl.value,
      bootText:buildBootText(resume.value, jobDescription.value),
      bounds:{ left:screen.availLeft || 0, top:screen.availTop || 0, width:screen.availWidth, height:screen.availHeight }
    });
    if (result.ok) {
      status.textContent = comparisonProvider.value
        ? 'Ready · all three provider windows connected'
        : 'Ready · sender and receiver connected';
      setTimeout(() => window.close(), 500);
      return;
    }
    status.textContent = `Launch failed · ${result.error || 'provider runtime did not become ready'}`;
  } catch (error) {
    status.textContent = `Launch failed · ${String(error?.message || error)}`;
  }
  launch.disabled = false;
});
void loadSettings();
