const DEFAULT_CHATGPT_URL = 'https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project';
const DEFAULT_CLAUDE_URL = 'https://claude.ai/new';
const port = chrome.runtime.connect({ name:'pmia-simple' });
const pending = new Map();
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
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(requestId); resolve({ ok:false, error:'timeout' }); }, timeoutMs);
    pending.set(requestId, result => { clearTimeout(timer); pending.delete(requestId); resolve(result); });
    port.postMessage({ type, requestId, ...payload });
  });
}

port.onMessage.addListener(message => {
  if (message?.type !== 'launch_result' || !pending.has(message.requestId)) return;
  pending.get(message.requestId)(message.result || { ok:false, error:'empty_result' });
});
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
  status.textContent = 'Opening provider windows…';
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
  } else {
    status.textContent = `Launch failed · ${result.error || 'provider runtime did not become ready'}`;
    launch.disabled = false;
  }
});

void loadSettings();
