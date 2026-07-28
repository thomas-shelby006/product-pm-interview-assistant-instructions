# Low-Latency Provider Findings

Date: 2026-07-29

## Evidence boundary

This document summarizes the two supplied full Browser Evidence Capture bundles. It excludes raw authentication material, cookies, identifiers, audio, and credential-bearing URLs.

## Claude observations

- The bundle contained 6,876 timeline events across about 94.7 seconds.
- It included 3,510 WebSocket receive events, 2,546 WebSocket send events, 110 semantic snapshots, 107 visual frames, and 30 DOM mutation batches.
- Text voice frames included 87 `transcript_interim`, 21 `user_input_end`, 15 `transcription_start`, 8 `message_complete`, 108 `message_sse`, 154 `tts_word`, 5 `server_interrupt`, 4 `playback_start`, and 3 `playback_end` events.
- Four human turns and four assistant turns produced `message_complete` frames.
- The last interim matched the final human text in all four observed turns, but final lag varied from about 0.19 to 3.14 seconds.
- Individual turns emitted three to six `user_input_end` events. These are not final boundaries.
- Binary frames carried microphone or playback data and are not parsed.

## ChatGPT observations

- The bundle contained 956 timeline events across about 130.6 seconds.
- It included 140 semantic snapshots, 138 visual frames, 87 DOM mutation batches, 56 network requests, 50 user-input events, and only 11 text WebSocket frames.
- Captured WebSocket messages did not expose a dependable per-turn voice transcript protocol.
- `voice-conversation-commit` behaved as a session-level event rather than a question boundary.
- Rendered user-turn text grew incrementally in the DOM as dictation progressed.
- The next assistant turn was the strongest observed final boundary for a submitted user turn.
- Composer text was visible before submission, so composer content cannot be treated as an automatic final question.

## Architecture decisions

- Preview and commit are separate operations.
- Claude previews use each distinct `transcript_interim`; only a human `message_complete` commits.
- ChatGPT previews use each distinct submitted-turn DOM growth; the assistant successor commits.
- Active voice disables timer-based finalization.
- The 1.2-second stable-tail fallback is limited to non-voice operation.
- Receiver previews prefill the composer only. They never stop generation or submit.

- Preview delivery is best-effort, direct, non-persistent, and independent of final-envelope sequence state.
- Final delivery remains acknowledged, sequence-gated, latest-only queued, and role-logged.
- Provider observation ignores attribute churn, reacts to child/text mutations, and uses a 500-millisecond safety watchdog.
- Answer capture reacts to provider mutations, uses a 250-millisecond stable-text window, a 600-millisecond no-spinner grace period, and a 90-second hard timeout.
- Claude `message_stop` wakes answer capture immediately but semantic DOM text remains the answer source.

## Latency conclusion

The providers do not expose guaranteed one-word events in these captures. Claude provides phrase-level interim frames, commonly separated by roughly 100 to 300 milliseconds. ChatGPT exposes phrase-level rendered DOM growth at the provider's own cadence. The runtime now transfers every distinct observed update immediately, which is the fastest safe behavior supported by the evidence. Submission still waits for the provider-specific final boundary to avoid partial-question answers.

## Change triggers

Revisit this architecture only when new evidence proves one of the following:

- ChatGPT exposes a stable documented per-turn transcript/final protocol.
- Claude changes the shape or semantics of human `message_complete`.
- Provider DOM stops exposing stable user/assistant role identities.
- A measured preview backlog requires latest-only transport coalescing beyond current sequence rejection.
