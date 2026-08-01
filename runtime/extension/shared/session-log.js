import { latestSafeSessionContext } from './session-context.js';

const ROLES = new Set(['sender', 'receiver']);

export function roleLogKey(sessionId, role) {
  const normalizedSession = String(sessionId || '').trim();
  if (!normalizedSession || !ROLES.has(role)) {
    throw new TypeError('Invalid PMIA role log key');
  }
  return `pmia_log_${normalizedSession}_${role}`;
}

export function appendBoundedLog(
  current,
  event,
  maxEvents = 500,
  recordedAt = new Date().toISOString()
) {
  const safeMax = Number.isInteger(maxEvents) && maxEvents >= 2 ? maxEvents : 500;
  const source = Array.isArray(current) ? current : [];
  const priorMarker = source.find(item => item?.type === 'log_truncated');
  const priorDropped = Number.isInteger(priorMarker?.droppedCount)
    ? priorMarker.droppedCount
    : 0;
  const realEvents = source.filter(item => item?.type !== 'log_truncated');
  realEvents.push({ ...event, recordedAt: event?.recordedAt || recordedAt });
  if (!priorDropped && realEvents.length <= safeMax) return realEvents;

  const keepCount = safeMax - 1;
  const newlyDropped = Math.max(0, realEvents.length - keepCount);
  return [
    { type: 'log_truncated', droppedCount: priorDropped + newlyDropped, recordedAt },
    ...realEvents.slice(-keepCount)
  ];
}

function roundedAverage(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function answerWordCount(event) {
  if (Number.isFinite(event?.wordCount)) return Number(event.wordCount);
  return String(event?.text || '').split(/\s+/).filter(Boolean).length;
}

export function summarizeSessionEvents(events) {
  const list = Array.isArray(events) ? events : [];
  const answers = list.filter(event => event?.type === 'answer');
  const answerWords = answers.map(answerWordCount);
  const deliveryTimes = list
    .filter(event => event?.type === 'received_text')
    .map(event => Number(event.deliveryElapsedMs))
    .filter(Number.isFinite);
  const questions = list.filter(event => (
    (event?.type === 'sender_text' || event?.type === 'received_text')
    && event?.kind === 'question'
  ));
  return {
    sessionArmed: list.some(event => (
      event?.type === 'session_armed'
      || (event?.type === 'received_text' && event?.kind === 'boot')
      || (event?.type === 'sender_text' && event?.kind === 'boot' && event?.delivered === true)
    )),
    questionCount: questions.length,
    answerCount: answers.length,
    averageAnswerWords: roundedAverage(answerWords),
    maxAnswerWords: answerWords.length ? Math.max(...answerWords) : 0,
    answersOver180: answerWords.filter(value => value > 180).length,
    averageDeliveryMs: roundedAverage(deliveryTimes),
    maxDeliveryMs: deliveryTimes.length ? Math.max(...deliveryTimes) : 0,
    queuedFinalCount: list.filter(event => event?.type === 'forward' && event?.queued).length,
    ignoredDeliveryCount: list.filter(event => (
      event?.type === 'forward_ignored' || event?.type === 'delivery_ignored'
    )).length,
    answerTimeoutCount: list.filter(event => event?.type === 'answer_timeout').length
  };
}

export function buildSessionExport({ session, events, exportedAt = new Date().toISOString() }) {
  const safeEvents = Array.isArray(events) ? events : [];
  return {
    schemaVersion: '2.1',
    exportedAt,
    session: { ...session },
    sessionContext: latestSafeSessionContext(safeEvents),
    summary: summarizeSessionEvents(safeEvents),
    events: safeEvents
  };
}

function summaryLines(summary = {}) {
  return [
    `- Session armed: ${summary.sessionArmed ? 'yes' : 'no'}`,
    `- Questions observed: ${summary.questionCount || 0}`,
    `- Answers captured: ${summary.answerCount || 0}`,
    `- Average answer length: ${summary.averageAnswerWords || 0} words`,
    `- Longest answer: ${summary.maxAnswerWords || 0} words`,
    `- Answers over 180 words: ${summary.answersOver180 || 0}`,
    `- Average receiver delivery: ${summary.averageDeliveryMs || 0} ms`,
    `- Maximum receiver delivery: ${summary.maxDeliveryMs || 0} ms`,
    `- Persisted or staged finals: ${summary.queuedFinalCount || 0}`,
    `- Ignored duplicate/stale deliveries: ${summary.ignoredDeliveryCount || 0}`,
    `- Answer timeouts: ${summary.answerTimeoutCount || 0}`
  ];
}

function contextLines(context = {}) {
  const labels = [
    ['company', 'Company'],
    ['targetRole', 'Target role'],
    ['interviewRound', 'Interview round'],
    ['emphasis', 'Emphasis'],
    ['answerMode', 'Answer mode']
  ];
  const lines = labels
    .filter(([key]) => context[key])
    .map(([key, label]) => `- ${label}: ${context[key]}`);
  const resumeState = Object.hasOwn(context, 'resumeMissing')
    ? (context.resumeMissing ? 'yes' : 'no')
    : 'unknown';
  const jdState = Object.hasOwn(context, 'jdMissing')
    ? (context.jdMissing ? 'yes' : 'no')
    : 'unknown';
  lines.push(`- Resume missing: ${resumeState}`);
  lines.push(`- Job description missing: ${jdState}`);
  return lines;
}

export function renderSessionMarkdown({ session, events, summary, sessionContext }) {
  const safeEvents = Array.isArray(events) ? events : [];
  const lines = [
    '# PM Interview Dual-Provider Session',
    '',
    `Session: ${session?.sessionId || ''}`,
    `Window: ${session?.role || ''} / ${session?.provider || ''}`,
    '',
    '## Summary',
    '',
    ...summaryLines(summary),
    '',
    '## Session context',
    '',
    ...contextLines(sessionContext),
    '',
    '## Events',
    ''
  ];
  for (const event of safeEvents) {
    lines.push(`### ${event.recordedAt || ''} — ${event.type || 'event'}`, '');
    if (event.text) lines.push(String(event.text), '');
    const metadata = { ...event };
    delete metadata.text;
    lines.push('```json', JSON.stringify(metadata, null, 2), '```', '');
  }
  return lines.join('\n');
}
