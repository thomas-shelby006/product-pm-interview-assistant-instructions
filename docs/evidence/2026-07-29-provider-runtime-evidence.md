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

## Live 0.5.0 failure investigation

A uniquely marked ChatGPT sender turn rendered and received its local ChatGPT answer, while the managed Claude receiver remained unchanged. Edge's PMIA extension error page then exposed the actual startup failure on fresh managed tabs:

`[PMIA] runtime failed ReferenceError: sleep is not defined`

The 0.5.0 entry module still passed `sleep` to `createReceiverController`, but the named import had been removed while fixed receiver-submit waits were being eliminated. The title and overlay were created before this reference was evaluated, so a managed window could display a PMIA title and appear `READY` even though receiver-controller creation aborted the rest of startup.

This explains the complete observed symptom chain:

- provider pages themselves remained functional
- PMIA titles appeared
- sender observation never started
- role registration did not complete reliably
- no `PMIA_FORWARD` event reached the service worker
- the receiver never received or submitted the marker

The extension page also contained `Extension context invalidated` and dynamic-import errors from tabs that predated an unpacked-extension reload. Those are reload-recovery signals, but they were not the reproducible fresh-tab root cause.

## 0.5.1 decisions from the live failure

1. Add a source-level dependency contract proving every identifier passed into receiver creation is imported.
2. Render startup/import failures directly on the provider page with the extension version and recovery action.
3. Keep `RELOAD TAB` persistent when the extension context is invalidated.
4. Replace registry-only preflight with an active ping to the opposite managed content runtime.
5. Maintain a stable link-health label beneath transient routing statuses.
6. Broadcast link degradation immediately when either managed tab closes.
## 0.5.2 duplicate and receiver-rejection evidence

Two role-scoped PMIA exports narrowed the remaining failures to separate boundaries.

- The Claude sender accepted and forwarded one authoritative marker, then forwarded a second altered DOM form about 1.4 seconds later. The second text prepended a compact copy of the marker before the visible prompt. This proved a protocol-final/DOM-shadow race rather than two independent user questions.
- The ChatGPT sender export recorded `delivered: false`, `queued: true`, and `reason: delivery_rejected`. This proved the sender and service-worker route were active while the receiver declined the final.

The resulting 0.5.2 decisions are:

1. Canonicalize authoritative external finals and suppress only the first matching DOM shadow within an eight-second window. The suppression is one-shot, requires at least 20 canonical characters, and expires so a genuine later repeated question remains valid.
2. Remove Claude's compact accessibility echo at article extraction before routing.
3. Reserve receiver sequence state before provider submission, then roll it back if submission fails.
4. Acknowledge an exact retry as `duplicate_ack` without a second provider submission. Acknowledge stale finals as discarded so they cannot remain in the latest-only queue.
5. Preserve specific receiver failure reasons such as `receiver_composer_missing` and `receiver_delivery_failed` instead of collapsing every failure to `delivery_rejected`.
6. Keep receiver composer mounting aggressive: immediate first attempt followed by a bounded microtask readiness window, with no fixed sleep on the fast path.
7. Bound long-session DOM tracking to the newest 1,024 messages and retain at most 512 finalized identities/revisions.

## 0.5.2 final live Edge verification

The release candidate was loaded as an unpacked extension in the existing Microsoft Edge Stable Default profile. Edge's extension card reported version `0.5.2` before and after reload. The existing managed Claude sender and ChatGPT receiver tabs were refreshed in place; no additional browser profile or PMIA provider pair was created.

Final marker:

```text
PMIA_052_CONFIRM_20260729_164500. Reply exactly PMIA_052_CONFIRM_OK.
```

Observed result:

- Claude submitted the marker through its current `Send message` control.
- ChatGPT rendered exactly one matching user turn.
- ChatGPT rendered the exact acknowledgement `PMIA_052_CONFIRM_OK`.
- The ChatGPT composer remained available after completion.
- The earlier false-positive receiver acknowledgement was eliminated by requiring a new matching provider user turn before `received_text` can be accepted.

This live result validates the previously failing Claude-to-ChatGPT path on the same installed Edge runtime used for the final release candidate.
