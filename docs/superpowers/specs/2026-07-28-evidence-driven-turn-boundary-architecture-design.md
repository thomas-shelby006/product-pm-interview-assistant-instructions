# Evidence-Driven Turn-Boundary Architecture

**Date:** 2026-07-28
**Status:** Approved for implementation
**Repository:** `thomas-shelby006/product-pm-interview-assistant-instructions`

## Goal

Route each completed interviewer question from a managed ChatGPT or Claude sender window to a managed receiver exactly once, with the lowest defensible latency and without forwarding partial speech, unsent drafts, or historical turns.

The runtime must remain a local Manifest V3 extension coordinated by a thin AutoHotkey launcher. Raw provider audio is never stored or routed.

## Evidence examined

Two complete browser-evidence archives were inspected end to end:

- Claude voice session: 20,771 events, 9,971 WebSocket events, 132 semantic snapshots and 77 DOM mutations.
- ChatGPT voice/text session: 1,049 events, 115 semantic snapshots, 68 DOM mutations, 53 WebRTC snapshots and 10 WebSocket frames.

Both archives passed body/reference checks. The ChatGPT archive had three response-without-request records, but no missing bodies or timestamp regressions affecting the turn analysis.
## Confirmed facts

### Claude voice

- `transcript_interim` text changes, resets and repeats. It is provisional.
- `user_input_end` repeats and can occur before additional speech. It is not a final boundary.
- A human `message_complete` carries the final text and stable `message_uuid`.
- The supplied session contains four human `message_complete` events and four matching assistant completions.
- `server_interrupt` and `transcript_empty` occur without a valid user turn and must reset provisional state rather than forward text.
- Binary microphone and playback frames contain no routing value and must remain ignored.

### ChatGPT voice and text

- Voice transcript text grows inside rendered user-message DOM nodes.
- Stable identifiers are present: `data-turn-id`, `data-turn`, `data-message-id` and `data-message-author-role`.
- In observed voice turns, the following assistant turn appeared about 0.6â€“1.1 seconds after the final user text.
- The captured `voice-conversation-commit` occurred when voice mode ended after multiple turns. It is a session commit, not a per-turn final signal.
- WebRTC statistics expose transport health, not transcript finality.
- Typed composer text is visible before submission and therefore must never be auto-forwarded as a completed question.
## Competing hypotheses and falsification

### H1: One stability timer can finalize every provider

Rejected. ChatGPT voice text changes over several seconds and can pause long enough for a short timer to emit a partial question. A long timer avoids some partials but adds unnecessary latency to confirmed Claude finals.

### H2: Provider protocol events should be authoritative everywhere

Rejected for ChatGPT. The evidence contains no per-turn transcript-final protocol event. Depending on undocumented WebRTC or private data-channel shapes would add fragility without captured proof.

### H3: DOM-only tracking is sufficient everywhere

Technically viable, but not preferred. It discards Claude's explicit final human event and replaces a deterministic boundary with timing inference.

### H4: Use the strongest proven boundary per provider

Accepted. Claude uses human `message_complete`; ChatGPT uses ordered DOM turns and stable message identifiers. Both feed the same provider-neutral delivery boundary.

## Architecture

The runtime is divided into four layers:

1. **Provider adapter:** reads ordered turns, composer state and provider controls.
2. **Sender strategy:** owns provider-specific finalization and emits only completed turns.
3. **Session router:** owns registration, latest-message delivery, acknowledgement and idempotency.
4. **Launcher:** opens and arranges managed windows; it does not inspect provider content.
## ChatGPT sender strategy

The adapter returns ordered conversation messages:

```text
{id, turnId, role, text, element}
```

Identifier priority is `data-message-id`, then `data-turn-id`, then a retained element identity. Text hashes are never used as the sole identity.

At startup, all existing message IDs are baselined as historical. Later updates follow this state machine:

- A new or changing tail user message becomes provisional.
- Composer text is ignored by automatic routing.
- When an assistant message follows the provisional user message, the latest complete user text is emitted immediately with boundary `assistant_successor`.
- If no assistant successor appears, an unchanged tail user message may emit after a conservative fallback interval. The fallback exists for provider/UI failures, not as the primary boundary.
- Each message ID can emit only once. Text growth on the same ID replaces provisional text and resets the fallback timer.
- A manual F12 flush may explicitly forward the composer or latest user turn.

## Claude sender strategy

- Human `message_complete` is authoritative for voice turns and deduplicated by `message_uuid`.
- `transcript_interim`, `user_input_end`, `transcription_start`, `server_interrupt` and `transcript_empty` update status/state only.
- DOM tracking remains available for typed Claude messages and as a bounded fallback.
- A DOM turn matching a recently emitted WebSocket final is suppressed to prevent duplicate routing.
- Assistant `message_stop` remains an answer-final hint only.
## Delivery and failure behavior

The existing service-worker registry, sender sequence, receiver sequence gate and latest-message queue remain authoritative.

- A sender strategy emits a completed turn with provider message ID and boundary metadata.
- The router accepts only increasing sender sequences from the registered sender tab.
- The receiver acknowledges only after successful submission.
- Rejected or unreachable delivery remains queued as the latest pending question.
- A newer question supersedes active receiver generation; stale and duplicate deliveries are ignored.
- Provider strategy failures affect only extraction. They do not weaken session ownership or delivery idempotency.

## Testing

Capture-derived fixtures will verify:

- ChatGPT partial progression never emits early.
- Assistant insertion emits the complete preceding user turn.
- Text growth on one message ID resets fallback timing.
- Composer drafts do not auto-forward.
- Historical turns are ignored after startup or reload.
- Claude interim/boundary/empty/interruption events never emit.
- Human `message_complete` emits once per UUID.
- Claude DOM and WebSocket observation cannot duplicate one turn.
- Restart, receiver reload and rapid follow-ups remain idempotent.

## Uncertainties and change triggers

The captures do not prove every future provider UI shape. Selectors and event schemas are therefore isolated behind adapters and parsers. A provider change triggers reconsideration only when tests or sanitized evidence show that the current boundary is missing, delayed, or incorrect.

A future ChatGPT protocol integration is justified only after a capture demonstrates a stable, per-turn final transcript event. Until then, the DOM boundary is the evidence-supported source of truth.
