const ERROR_LABELS = {
  idle_timeout: 'VOICE IDLE TIMEOUT',
  mic_zero_chunks: 'VOICE NO MIC INPUT',
  tab_hidden: 'VOICE TAB HIDDEN',
  microphone_permission_denied: 'MIC PERMISSION DENIED',
  connection_failed: 'VOICE CONNECTION FAILED',
  provider_error: 'VOICE PROVIDER ERROR'
};

export function createClaudeSignalHandler({
  role,
  forwardPreview = async () => {},
  forwardText,
  setStatus,
  onAssistantFinal
}) {
  let voiceTurnNumber = 1;
  let previewRevision = 0;
  let lastPreviewText = '';

  const turnKey = () => `claude-voice-${voiceTurnNumber}`;
  const advanceTurn = () => {
    voiceTurnNumber += 1;
    previewRevision = 0;
    lastPreviewText = '';
  };

  const emitPreview = async (value, phase = 'interim') => {
    const text = String(value || '').trim();
    if (phase === 'interim' && (!text || text === lastPreviewText)) return false;
    previewRevision += 1;
    await forwardPreview({
      turnKey: turnKey(),
      text,
      revision: previewRevision,
      phase
    });
    lastPreviewText = phase === 'interim' ? text : '';
    return true;
  };

  return async signal => {
    if (!signal?.type) return false;

    if (signal.type === 'voice_interim') {
      if (role === 'sender') await emitPreview(signal.text, 'interim');
      const words = String(signal.text || '').trim().split(/\s+/).filter(Boolean).length;
      setStatus(`VOICE LISTENING ${words}w`, 'info', 1000);
      return true;
    }

    if (signal.type === 'voice_boundary') {
      setStatus('VOICE PROCESSING', 'info', 1200);
      return true;
    }

    if (signal.type === 'voice_reset') {
      if (role === 'sender' && previewRevision > 0) {
        await emitPreview('', 'clear');
        advanceTurn();
      }
      if (signal.reason === 'transcript_empty') {
        setStatus('VOICE EMPTY', 'info', 1200);
      } else {
        setStatus('VOICE INTERRUPTED', 'warn', 1600);
      }
      return true;
    }

    if (signal.type === 'voice_final' && role === 'sender') {
      await forwardText(signal.text, 'question', {
        source: 'voice_final',
        messageId: signal.messageId || ''
      });
      advanceTurn();
      setStatus('VOICE FORWARDED', 'ok', 1400);
      return true;
    }

    if (signal.type === 'assistant_final_hint' && role === 'receiver') {
      onAssistantFinal();
      return true;
    }

    if (signal.type === 'voice_active') {
      setStatus('VOICE ACTIVE', 'ok', 1200);
      return true;
    }

    if (signal.type === 'voice_playback') {
      setStatus('VOICE PLAYBACK', 'info', 1200);
      return true;
    }

    if (signal.type === 'voice_error') {
      setStatus(ERROR_LABELS[signal.reason] || ERROR_LABELS.provider_error, 'error', 3500);
      return true;
    }

    return false;
  };
}
