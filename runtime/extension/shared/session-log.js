import { latestSafeSessionContext } from './session-context.js';
import { summarizeAnswerAnalytics } from './answer-quality-analytics.js';

const ROLES = new Set(['sender', 'receiver', 'comparison']);

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
    schemaVersion: '2.2',
    exportedAt,
    session: { ...session },
    sessionContext: latestSafeSessionContext(safeEvents),
    summary: summarizeSessionEvents(safeEvents),
    answerAnalytics: summarizeAnswerAnalytics(safeEvents.filter(event => event?.type === 'answer').map(event => event.analytics).filter(Boolean)),
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

function providerAnalyticsLines(answerAnalytics = {}) {
  const lines = [];
  for (const [provider, value] of Object.entries(answerAnalytics.providers || {})) {
    const label = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
    lines.push(`- ${label}: ${value.answerCount || 0} answers; avg ${value.averageWords || 0} words; first token ${value.averageFirstTokenMs || 0} ms; total ${value.averageTotalResponseMs || 0} ms; output ${value.averageOutputWpm || 0} WPM; on target ${value.onTargetCount || 0}`);
  }
  return lines.length ? lines : ['- No answer analytics captured.'];
}
export function renderSessionMarkdown({ session, events, summary, sessionContext, answerAnalytics }) {
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
    '## Response analytics',
    '',
    '- Word-band fit is a deterministic depth/conciseness proxy, not a semantic quality score.',
    `- Answers on target: ${answerAnalytics?.onTargetCount || 0}; too brief: ${answerAnalytics?.tooBriefCount || 0}; too long: ${answerAnalytics?.tooLongCount || 0}`,
    `- Average first token: ${answerAnalytics?.averageFirstTokenMs || 0} ms; average total response: ${answerAnalytics?.averageTotalResponseMs || 0} ms; average output pace: ${answerAnalytics?.averageOutputWpm || 0} WPM`,
    ...providerAnalyticsLines(answerAnalytics),
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

export function buildCombinedSessionAnalysis(logsByRole = {}, { sessionId = '', generatedAt = nowIso() } = {}) {
  const roleEntries = {};
  const analytics = [];
  for (const role of ['sender', 'receiver', 'comparison']) {
    const events = Array.isArray(logsByRole?.[role]) ? logsByRole[role] : [];
    const summary = summarizeSessionEvents(events);
    const roleAnalytics = events.filter(event => event?.type === 'answer').map(event => event.analytics).filter(Boolean);
    analytics.push(...roleAnalytics);
    const deliverySamples = events
      .map(event => Number(event?.deliveryElapsedMs || event?.deliveryProofMs || 0))
      .filter(value => Number.isFinite(value) && value > 0);
    roleEntries[role] = {
      eventCount: events.length,
      questionCount: summary.questionCount,
      answerCount: summary.answerCount,
      averageAnswerWords: summary.averageAnswerWords,
      maxAnswerWords: summary.maxAnswerWords,
      answersOver180: summary.answersOver180,
      queuedFinalCount: summary.queuedFinalCount,
      answerTimeoutCount: summary.answerTimeoutCount,
      averageDeliveryMs: deliverySamples.length ? Math.round(deliverySamples.reduce((sum, value) => sum + value, 0) / deliverySamples.length) : 0
    };
  }
  return {
    schemaVersion: '1.0',
    sessionId: String(sessionId || ''),
    generatedAt,
    methodology: {
      semanticQualityScored: false,
      wordBandFit: 'Deterministic proxy for expected response depth/conciseness by question type.',
      speakingPaceBaselineWpm: 129
    },
    roles: roleEntries,
    answerAnalytics: summarizeAnswerAnalytics(analytics)
  };
}
