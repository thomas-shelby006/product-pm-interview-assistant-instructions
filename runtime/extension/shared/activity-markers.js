const EVENT_MAP = Object.freeze({
  final_persisted: 'question_arrived',
  batch_submitting: 'answer_requested',
  answer_started: 'answer_started',
  answer_terminal: 'answer_completed',
  live_session_phase: 'phase_changed',
  repair_started: 'recovery_started',
  repair_verified: 'recovery_completed',
  sequence_gap: 'delivery_gap',
  queue_only_enabled: 'delivery_protected'
});

export function deriveActivityMarkers(timeline = []) {
  const output = [];
  const seen = new Set();
  for (const event of Array.isArray(timeline) ? timeline : []) {
    const category = EVENT_MAP[String(event?.type || '')];
    if (!category) continue;
    const targetId = String(event?.data?.envelopeId || event?.data?.batchId || event?.data?.itemId || event?.data?.phase || 'session');
    const id = `activity:${category}:${targetId}:${Math.floor(Number(event.at || 0) / 1000)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    output.push({ id, category, targetType: targetId === 'session' ? 'session' : 'event', targetId, createdAt: Math.max(0, Number(event.at || 0)), source: 'runtime' });
  }
  return output.sort((a, b) => a.createdAt - b.createdAt).slice(-120);
}
