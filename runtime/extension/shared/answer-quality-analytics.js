const SPEAKING_WPM = 129;

const BANDS = Object.freeze({
  follow_up: { min:30, max:55, label:'Follow-up / clarification' },
  simple_concept: { min:55, max:75, label:'Simple conceptual PM answer' },
  comparison_tradeoff: { min:75, max:100, label:'Comparison / tradeoff' },
  implementation: { min:110, max:150, label:'Implementation / how-would-you' },
  execution_metrics: { min:90, max:130, label:'Execution / metrics / prioritization' },
  product_strategy: { min:130, max:180, label:'Product sense / strategy' },
  estimation: { min:130, max:160, label:'Estimation / market sizing' },
  behavioral: { min:120, max:150, label:'Behavioral story' },
  multi_question: { min:120, max:180, label:'Multi-question response' }
});

function text(value) { return String(value || '').trim(); }
function average(values) {
  const list = values.map(Number).filter(Number.isFinite);
  return list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : 0;
}
function percentile(values, ratio) {
  const list = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if (!list.length) return 0;
  return Math.round(list[Math.min(list.length - 1, Math.max(0, Math.ceil(list.length * ratio) - 1))]);
}

export function classifyQuestionType(questionText = '', { questionCount = 1 } = {}) {
  const value = text(questionText).toLowerCase();
  if (Number(questionCount) > 1) return { type:'multi_question', ...BANDS.multi_question };
  if (/\b(tell me about a time|give me an example|describe a time|conflict|stakeholder|failure|mistake|disagree|influence without authority)\b/.test(value)) return { type:'behavioral', ...BANDS.behavioral };
  if (/\b(estimate|estimation|market size|market sizing|size the market|how many|tams?|sams?|soms?)\b/.test(value)) return { type:'estimation', ...BANDS.estimation };
  if (/\b(compare|versus|\bvs\b|trade-?off|pros and cons|which would you choose)\b/.test(value)) return { type:'comparison_tradeoff', ...BANDS.comparison_tradeoff };
  if (/\b(how would you (build|launch|implement|roll out|design the rollout|execute)|implementation|go to market|gtm)\b/.test(value)) return { type:'implementation', ...BANDS.implementation };
  if (/\b(strategy|product sense|design a product|improve .*product|new market|vision|north star|competitive|positioning)\b/.test(value)) return { type:'product_strategy', ...BANDS.product_strategy };
  if (/\b(metric|measure|prioriti|roadmap|execution|root cause|drop in|funnel|activation|retention|conversion|guardrail)\b/.test(value)) return { type:'execution_metrics', ...BANDS.execution_metrics };
  if (/^(why|what about|and what|can you clarify|could you clarify|how so|then what|what if)\b/.test(value) && value.split(/\s+/).length <= 18) return { type:'follow_up', ...BANDS.follow_up };
  return { type:'simple_concept', ...BANDS.simple_concept };
}

export function deriveAnswerAnalytics({
  questionText = '', questionCount = 1, wordCount = 0,
  startedAt = 0, firstTokenAt = 0, completedAt = 0,
  provider = '', role = ''
} = {}) {
  const band = classifyQuestionType(questionText, { questionCount });
  const words = Math.max(0, Number(wordCount) || 0);
  const start = Math.max(0, Number(startedAt) || 0);
  const first = Math.max(0, Number(firstTokenAt) || 0);
  const complete = Math.max(0, Number(completedAt) || 0);
  const firstTokenLatencyMs = first >= start && first > 0 ? first - start : 0;
  const generationMs = first && complete >= first ? complete - first : 0;
  const totalResponseMs = complete >= start && complete > 0 ? complete - start : 0;
  const outputWpm = words && generationMs > 0 ? Math.round((words * 60000) / generationMs) : 0;
  const bandFit = words < band.min ? 'too_brief' : words > band.max ? 'too_long' : 'on_target';
  const depthProxy = bandFit === 'too_brief' ? 'below_target_band' : bandFit === 'too_long' ? 'above_target_band' : 'within_target_band';
  return {
    provider:text(provider), role:text(role), questionType:band.type, questionTypeLabel:band.label,
    targetMinWords:band.min, targetMaxWords:band.max, wordCount:words, bandFit, depthProxy,
    firstTokenLatencyMs, generationMs, totalResponseMs, outputWpm,
    estimatedSpeakingMs: words ? Math.round((words / SPEAKING_WPM) * 60000) : 0,
    speakingWpmBaseline:SPEAKING_WPM
  };
}
function groupSummary(items) {
  const total = items.length;
  const first = items[0] || {};
  const sameQuestionType = total > 0 && items.every(item => item.questionType === first.questionType);
  const onTargetCount = items.filter(item=>item.bandFit==='on_target').length;
  const tooBriefCount = items.filter(item=>item.bandFit==='too_brief').length;
  const tooLongCount = items.filter(item=>item.bandFit==='too_long').length;
  return {
    answerCount:total,
    averageWords:average(items.map(item=>item.wordCount)),
    averageFirstTokenMs:average(items.map(item=>item.firstTokenLatencyMs)),
    p95FirstTokenMs:percentile(items.map(item=>item.firstTokenLatencyMs), 0.95),
    averageGenerationMs:average(items.map(item=>item.generationMs)),
    p95GenerationMs:percentile(items.map(item=>item.generationMs), 0.95),
    averageTotalResponseMs:average(items.map(item=>item.totalResponseMs)),
    p95TotalResponseMs:percentile(items.map(item=>item.totalResponseMs), 0.95),
    averageOutputWpm:average(items.map(item=>item.outputWpm).filter(Boolean)),
    averageSpeakingMs:average(items.map(item=>item.estimatedSpeakingMs).filter(Boolean)),
    onTargetCount, tooBriefCount, tooLongCount,
    onTargetRatePct:total ? Math.round((onTargetCount * 100) / total) : 0,
    tooBriefRatePct:total ? Math.round((tooBriefCount * 100) / total) : 0,
    tooLongRatePct:total ? Math.round((tooLongCount * 100) / total) : 0,
    ...(sameQuestionType ? {
      questionTypeLabel:text(first.questionTypeLabel),
      targetMinWords:Math.max(0, Number(first.targetMinWords || 0)),
      targetMaxWords:Math.max(0, Number(first.targetMaxWords || 0))
    } : {})
  };
}

export function summarizeAnswerAnalytics(values = []) {
  const items = (Array.isArray(values) ? values : []).filter(value => value && typeof value === 'object');
  const providers = {};
  const roles = {};
  const questionTypes = {};
  for (const item of items) {
    const provider = text(item.provider) || 'unknown';
    const role = text(item.role) || 'unknown';
    const type = text(item.questionType) || 'unknown';
    (providers[provider] ||= []).push(item);
    (roles[role] ||= []).push(item);
    (questionTypes[type] ||= []).push(item);
  }
  const onTargetCount = items.filter(item=>item.bandFit==='on_target').length;
  const tooBriefCount = items.filter(item=>item.bandFit==='too_brief').length;
  const tooLongCount = items.filter(item=>item.bandFit==='too_long').length;
  return {
    totalAnswers:items.length,
    averageWords:average(items.map(item=>item.wordCount)),
    averageFirstTokenMs:average(items.map(item=>item.firstTokenLatencyMs)),
    p95FirstTokenMs:percentile(items.map(item=>item.firstTokenLatencyMs), 0.95),
    averageGenerationMs:average(items.map(item=>item.generationMs)),
    p95GenerationMs:percentile(items.map(item=>item.generationMs), 0.95),
    averageTotalResponseMs:average(items.map(item=>item.totalResponseMs)),
    p95TotalResponseMs:percentile(items.map(item=>item.totalResponseMs), 0.95),
    averageOutputWpm:average(items.map(item=>item.outputWpm).filter(Boolean)),
    averageSpeakingMs:average(items.map(item=>item.estimatedSpeakingMs).filter(Boolean)),
    onTargetCount, tooBriefCount, tooLongCount,
    onTargetRatePct:items.length ? Math.round((onTargetCount * 100) / items.length) : 0,
    tooBriefRatePct:items.length ? Math.round((tooBriefCount * 100) / items.length) : 0,
    tooLongRatePct:items.length ? Math.round((tooLongCount * 100) / items.length) : 0,
    providers:Object.fromEntries(Object.entries(providers).map(([key,list])=>[key,groupSummary(list)])),
    roles:Object.fromEntries(Object.entries(roles).map(([key,list])=>[key,groupSummary(list)])),
    questionTypes:Object.fromEntries(Object.entries(questionTypes).map(([key,list])=>[key,groupSummary(list)]))
  };
}

export { SPEAKING_WPM, BANDS as ANSWER_WORD_BANDS };
