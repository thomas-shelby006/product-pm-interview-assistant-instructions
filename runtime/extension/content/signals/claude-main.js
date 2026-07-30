(() => {
  if (window.__PMIA_CLAUDE_VOICE_OBSERVER_V1__) return;
  window.__PMIA_CLAUDE_VOICE_OBSERVER_V1__ = true;

  const EVENT_NAME = 'pmia:claude-voice:v1';
  const CHANNEL = 'pmia-claude-voice-v1';
  const OriginalWebSocket = window.WebSocket;
  const ERROR_REASONS = new Set([
    'idle_timeout',
    'mic_zero_chunks',
    'tab_hidden',
    'microphone_permission_denied',
    'connection_failed'
  ]);

  const text = value => String(value ?? '').trim().slice(0, 32_000);
  const emit = signal => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
      detail: { channel: CHANNEL, ...signal }
    }));
  };

  const contentText = content => Array.isArray(content)
    ? content.filter(part => part?.type === 'text')
      .map(part => text(part.text)).filter(Boolean).join('\n').trim()
    : '';

  const handleJsonFrame = raw => {
    if (typeof raw !== 'string' || raw.length > 128_000) return;
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'transcript_interim') {
      const value = text(payload.text);
      if (value) emit({
        type: 'voice_interim',
        text: value,
        utteranceSeq: Number.isFinite(payload.utterance_seq)
          ? payload.utterance_seq
          : null
      });
      return;
    }

    if (payload.type === 'user_input_end') {
      emit({ type: 'voice_boundary' });
      return;
    }

    if (payload.type === 'server_interrupt') {
      emit({ type: 'voice_interrupt' });
      return;
    }

    if (payload.type === 'transcript_empty') {
      emit({ type: 'voice_reset', reason: 'transcript_empty' });
      return;
    }

    if (payload.type === 'message_complete' && payload.data?.sender === 'human') {
      const value = contentText(payload.data?.content);
      if (value) emit({
        type: 'voice_final',
        text: value,
        messageId: text(payload.data?.message_uuid)
      });
      return;
    }

    if (payload.type === 'message_sse' && payload.event?.type === 'message_stop') {
      emit({ type: 'assistant_final_hint' });
      return;
    }
    if (payload.type === 'transcription_start') {
      emit({ type: 'voice_active' });
      return;
    }
    if (payload.type === 'playback_start') {
      emit({ type: 'voice_playback' });
      return;
    }

    const reason = text(
      payload.reason || payload.code || payload.error || payload.data?.reason || payload.type
    );
    if (ERROR_REASONS.has(reason)) emit({ type: 'voice_error', reason });
  };

  const isClaudeVoiceSocket = url => {
    try {
      return new URL(String(url), location.href).pathname.includes('/api/ws/voice/');
    } catch {
      return false;
    }
  };

  const attach = (socket, url) => {
    if (!isClaudeVoiceSocket(url)) return;
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string') return;
      handleJsonFrame(event.data);
    });
  };

  function ObservedWebSocket(...args) {
    const socket = Reflect.construct(OriginalWebSocket, args, OriginalWebSocket);
    attach(socket, args[0]);
    return socket;
  }

  ObservedWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(ObservedWebSocket, OriginalWebSocket);
  for (const key of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) {
    Object.defineProperty(ObservedWebSocket, key, {
      configurable: true,
      enumerable: true,
      value: OriginalWebSocket[key]
    });
  }

  window.WebSocket = ObservedWebSocket;
})();
