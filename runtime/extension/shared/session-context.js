const SAFE_FIELDS = [
  ['company', 'Company'],
  ['targetRole', 'Target role'],
  ['interviewRound', 'Interview round'],
  ['emphasis', 'Emphasis'],
  ['answerMode', 'Answer mode']
];

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readLine(text, label) {
  const match = String(text || '').match(
    new RegExp(`^${escapePattern(label)}:\\s*(.+)$`, 'im')
  );
  return String(match?.[1] || '').trim();
}

export function extractSafeSessionContext(text) {
  const source = String(text || '');
  const context = {};
  for (const [key, label] of SAFE_FIELDS) {
    const value = readLine(source, label);
    if (value) context[key] = value;
  }
  context.resumeMissing = /\[Resume not provided in launch window\.\]/i.test(source);
  context.jdMissing = /\[Job description not provided in launch window\.\]/i.test(source);
  return context;
}

export function latestSafeSessionContext(events) {
  const list = Array.isArray(events) ? events : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const context = list[index]?.sessionContext;
    if (context && typeof context === 'object') return { ...context };
  }
  return {};
}
