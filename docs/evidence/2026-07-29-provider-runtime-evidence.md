# Provider Runtime Evidence — 2026-07-29

## Scope

This record summarizes the two Browser Evidence Capture full exports supplied for PMIA runtime 0.5. Raw session bodies, conversation text, account identifiers, request URLs containing identifiers, screenshots, and credentials are intentionally excluded.

## Source integrity

- Claude export: `browser-evidence-claude-ai-full-2026-07-28T22-01-55-288Z-17852752.zip`
- Claude SHA-256: `2B7F2625CF1C0821284D5F8C4A689D6A8AEE7ADF91A37D1D51F377B674A47E1F`
- ChatGPT export: `browser-evidence-chatgpt-com-full-2026-07-28T22-01-27-528Z-17852753.zip`
- ChatGPT SHA-256: `B74D38A373DAC1A30742CBDCC6931709ED873A527703320D771C19F032581F6B`
- Both archives passed listing/read checks during analysis.

## Claude observations

- Total captured events: 20,063.
- WebSocket-heavy evidence: 9,223 page WebSocket events, 4,791 received frames, and 4,431 sent frames.
- Voice lifecycle sample: 65 `transcript_interim`, 26 `user_input_end`, 22 `transcription_start`, four `message_complete`, and two `transcript_empty` events.
- Human `message_complete` carries the final transcript and a stable message identifier.
- `user_input_end` occurs repeatedly and is not a safe final boundary.
- `server_interrupt` appears repeatedly while a single long interim transcript continues growing. It is a barge-in/playback signal, not a transcript reset.
- `transcript_empty` is the observed empty-turn reset.
- `transcription_start` is useful as a conservative native-voice activity gate.
- `message_stop` is a strong assistant-completion hint but semantic DOM text remains the answer source.
- In observed completed human turns, the final event arrived hundreds of milliseconds after the last full interim. Immediate interim mirroring therefore removes visible transfer latency without submitting incomplete speech.
- Live/exported UI structures included `div[data-testid="chat-input"]`, `Press and hold to record`, `Use voice mode`, and active microphone/Stop controls.

## ChatGPT observations

- Total captured events: 1,749.
- Relevant channels included 104 WebRTC statistics records, 57 DOM mutations, and 38 WebSocket frames.
- No stable, readable per-turn transcript protocol was established from the captured RTC/WebSocket evidence.
- The conversation DOM contains rendered user/assistant turns and the composer was captured as `#prompt-textarea`.
- The idle voice entry control was captured with accessible name `Start Voice`.
- DOM message identity and assistant-successor ordering remain the strongest evidenced finalization mechanism.

## Performance pressure

- Claude export: 261 long tasks, 42,428 ms aggregate long-task duration, 877 ms longest task, and 536 ms longest interaction.
- ChatGPT export: 348 long tasks, 58,923 ms aggregate long-task duration, 1,167 ms longest task, and 416 ms longest interaction.
- The PMIA hot path must therefore avoid synchronous browser storage, fixed waits, repeated attribute observation, and redundant composer writes.
## Decisions supported by the exports

1. Keep an extension-only two-lane architecture; a local transport daemon would add failure modes without improving the provider boundary.
2. Mirror provisional transcript growth immediately, but submit only on the strongest provider-specific final boundary.
3. Treat Claude interruption as continuity and empty transcript as reset.
4. Keep ChatGPT DOM-first until a stable per-turn protocol is directly observed.
5. Use a 650 ms fallback only outside voice mode, with an empty sender composer.
6. Use page-lifetime preview stream identities so sender reloads can restart disposable sequence numbers safely.
7. Submit finals before durable telemetry and use provider readiness instead of fixed sleeps.
8. Re-register and rebind immediately on page restoration, network restoration, and tab visibility restoration.
9. Keep preview memory bounded and never place previews in durable recovery state.

## Assumptions explicitly rejected

- Rejected: every `server_interrupt` ends or invalidates the current human transcript.
- Rejected: `user_input_end` is an authoritative final question event.
- Rejected: a short generic silence timer can safely finalize active voice input.
- Rejected: ChatGPT RTC/WebSocket frames currently provide a maintainable transcript contract.
- Rejected: additional persistence makes provisional delivery more reliable; it instead adds latency and stale replay risk.

## Future change trigger

The ChatGPT sender should move away from DOM finalization only after a new capture demonstrates a stable, human-readable, per-turn final transcript event across multiple sessions and reloads. Claude handling should change only when a new export disproves the human `message_complete` contract or introduces a stronger documented boundary.
