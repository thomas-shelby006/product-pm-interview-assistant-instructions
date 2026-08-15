function roleAnalytics(role = {}, enabled = true) {
  const analytics = role?.latestAnswer?.analytics || {};
  return {
    enabled:Boolean(enabled),
    provider:String(role?.provider || ''),
    questionType:String(analytics.questionType || ''),
    wordCount:Math.max(0, Number(analytics.wordCount || role?.latestAnswer?.wordCount || 0)),
    bandFit:String(analytics.bandFit || ''),
    firstTokenMs:Math.max(0, Number(analytics.firstTokenLatencyMs || 0)),
    totalResponseMs:Math.max(0, Number(analytics.totalResponseMs || role?.latestAnswer?.elapsedMs || 0)),
    outputWpm:Math.max(0, Number(analytics.outputWpm || 0)),
    estimatedSpeakingMs:Math.max(0, Number(analytics.estimatedSpeakingMs || 0))
  };
}

export function deriveLiveAnswerAnalytics(snapshot = {}) {
  const comparisonEnabled = Boolean(snapshot?.comparison?.connected || snapshot?.comparison?.provider);
  const waiting = snapshot?.batchState?.next?.entries || snapshot?.batchState?.next?.memberIds || [];
  return {
    forwardingMode: snapshot?.batchState?.autoSubmit === false ? 'manual_gather' : 'automatic',
    waitingCount:Array.isArray(waiting) ? waiting.length : 0,
    primary:roleAnalytics(snapshot?.receiver || {}, true),
    comparison:roleAnalytics(snapshot?.comparison || {}, comparisonEnabled)
  };
}
