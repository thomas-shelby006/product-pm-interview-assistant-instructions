export function answerMetrics(text, speakingWpm = 129) {
  const words = String(text || '').trim().match(/\S+/g) || [];
  const wordCount = words.length;
  const wpm = Math.max(1, Number(speakingWpm) || 129);
  return {
    wordCount,
    estimatedSpeakingMs:wordCount ? Math.round((wordCount / wpm) * 60000) : 0
  };
}

export function normalizeRecentQuestions(values, limit = 20) {
  const safe = (Array.isArray(values) ? values : [])
    .map(value => ({ id:String(value?.id || ''), text:String(value?.text || '').trim() }))
    .filter(value => value.text);
  return safe.slice(-Math.max(0, Number(limit) || 20));
}
