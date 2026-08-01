# PMIA Live Operator and Reliability Cycles 96-195 Design

## Objective
Transform Runtime Pilot from a diagnostic dashboard into a live interview operating console while preserving the proven lossless ledger, sequence order, rendered-proof authority, provider adapters, and Manifest V3 session-state model.

## Non-negotiable invariants
- Every unique final remains durable until rendered proof or explicit operator archive.
- User-facing prioritization is metadata only; provider sequence order remains authoritative.
- Ordinary delivery never interrupts an active answer.
- Provider windows are never foregrounded by automatic recovery.
- Question, answer, setup, clipboard, credential, and raw provider URL content never enters support, incident, alert, trend, or evidence metadata.
- New dashboard features use one existing controller/state store; no parallel transport or persistence owner.
- Executable tests remain deferred until all development cycles are source-complete.
- The technical HTML is updated only after the final verified runtime.

## Architecture direction
The next 100 cycles are split into two phases. Cycles 96-145 add operator-facing live interview capabilities. Cycles 146-195 harden those capabilities under reconnects, worker suspension, multi-session mistakes, provider throttling, storage interruption, accessibility constraints, and release validation.

## Phase A: Live operator capabilities, Cycles 96-145
1. Session phase navigator and readiness checklist.
2. Incident center with acknowledge, snooze, and exact owning action.
3. Searchable command palette and keyboard-safe execution.
4. Metadata-only bookmarks, operator notes, and review markers.
5. Sequence-safe question triage metadata: pin, defer, urgency, and latest-focus visibility.
6. Guided Stabilize runbook with evidence checkpoints.
7. Live SLO history and backlog trend model.
8. Provider health history and drift timeline.
9. Optional user-triggered browser side-panel mode using the same Pilot application.
10. Session checkpoints and rehearsal/reset controls.

## Phase B: Reliability hardening, Cycles 146-195
11. Active-session guard and multi-session collision prevention.
12. Command safety policy, preview, and reversible-operation journal.
13. Durable incident acknowledgement and snooze state.
14. Provider-aware throttling, cooldown, and admission policy.
15. Aging-aware batch fairness without sequence reordering.
16. Dashboard reconnect cache and offline state truthfulness.
17. Service-worker wake lease and alarm audit v2.
18. Crash-safe feature-state checkpoints and rollback.
19. Keyboard, focus, screen-reader, reduced-motion, and 320-pixel accessibility hardening.
20. Deterministic scenario matrix, support bundle v2, release manifest v2, and final documentation evidence.
