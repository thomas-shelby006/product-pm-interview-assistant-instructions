export const CLAUDE_SIGNAL_EVENT = 'pmia:claude-voice:v1';
export const CLAUDE_SIGNAL_CHANNEL = 'pmia-claude-voice-v1';

const ERROR_REASONS = new Set([
  'idle_timeout',
  'mic_zero_chunks',
  'tab_hidden',
  'microphone_permission_denied',
  'connection_failed',
  'provider_error'
]);

function normalizedText(value) {
  return String(value ?? '').trim().slice(0, 32_000);
}

function textFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part?.type === 'text')
    .map(part => normalizedText(part.text))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function parseClaudeVoiceFrame(frame) {
  if (typeof frame !== 'string' || frame.length > 128_000) return null;
  let payload;
  try {
    payload = JSON.parse(frame);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  if (payload.type === 'transcript_interim') {
    const text = normalizedText(payload.text);
    if (!text) return null;
    return {
      type: 'voice_interim',
      text,
      utteranceSeq: Number.isFinite(payload.utterance_seq)
        ? payload.utterance_seq
        : null
    };
  }

  if (payload.type === 'user_input_end') {
    return { type: 'voice_boundary' };
  }

  if (payload.type === 'server_interrupt') {
    return { type: 'voice_interrupt' };
  }

  if (payload.type === 'transcript_empty') {
    return { type: 'voice_reset', reason: 'transcript_empty' };
  }

  if (payload.type === 'message_complete') {
    if (payload.data?.sender !== 'human') return null;
    const text = textFromContent(payload.data?.content);
    if (!text) return null;
    return {
      type: 'voice_final',
      text,
      messageId: normalizedText(payload.data?.message_uuid)
    };
  }

  if (payload.type === 'message_sse' && payload.event?.type === 'message_stop') {
    return { type: 'assistant_final_hint' };
  }

  if (payload.type === 'transcription_start') {
    return { type: 'voice_active' };
  }

  if (payload.type === 'playback_start') {
    return { type: 'voice_playback' };
  }

  const reason = normalizedText(
    payload.reason || payload.code || payload.error || payload.data?.reason || payload.type
  );
  if (ERROR_REASONS.has(reason)) {
    return { type: 'voice_error', reason };
  }

  return null;
}

export function normalizeClaudeSignalDetail(detail) {
  if (!detail || detail.channel !== CLAUDE_SIGNAL_CHANNEL) return null;
  const type = normalizedText(detail.type);
  if (type === 'voice_interim' || type === 'voice_final') {
    const text = normalizedText(detail.text);
    if (!text) return null;
    const signal = { type, text };
    if (type === 'voice_interim') {
      signal.utteranceSeq = Number.isFinite(detail.utteranceSeq)
        ? detail.utteranceSeq
        : null;
    } else {
      signal.messageId = normalizedText(detail.messageId);
    }
    return signal;
  }
  if (type === 'voice_error') {
    const reason = ERROR_REASONS.has(detail.reason)
      ? detail.reason
      : 'provider_error';
    return { type, reason };
  }
  if (type === 'voice_reset') {
    return { type, reason: 'transcript_empty' };
  }
  if ([
    'voice_boundary',
    'voice_interrupt',
    'assistant_final_hint',
    'voice_active',
    'voice_playback'
  ].includes(type)) {
    return { type };
  }
  return null;
}

export function makeClaudeSignalDetail(signal) {
  const normalized = normalizeClaudeSignalDetail({
    channel: CLAUDE_SIGNAL_CHANNEL,
    ...signal
  });
  return normalized
    ? { channel: CLAUDE_SIGNAL_CHANNEL, ...normalized }
    : null;
}
