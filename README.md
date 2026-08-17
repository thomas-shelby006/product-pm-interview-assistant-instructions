# PM Interview Assistant 0.12

PMIA 0.12 is the simplified three-window interview runtime.

## Read first
Before editing or testing PMIA, read:
1. `docs/PMIA_REWORK_OPERATING_RULES.md`
2. `docs/superpowers/specs/2026-08-17-pmia-user-feature-migration-design.md`
3. `docs/superpowers/plans/2026-08-17-pmia-user-feature-migration.md`

The operating-rules file is the durable user-preference contract for future agents.

## Production topology
- Window 1: source/transcription provider.
- Window 2: production answer lane A.
- Window 3: production answer lane B.
- Window 2 and Window 3 have equal priority, delivery semantics, retry behavior, proof requirements, Review/export features, and performance expectations.
- The internal role token `comparison` is retained only for compatibility; it does not mean lower-priority delivery.

## Core runtime
The active hot path is intentionally small:

`W1 rendered user turn -> long-lived MV3 port -> concurrent W2/W3 fan-out -> per-role FIFO -> provider-native write -> real submit -> rendered user-turn proof`

A queue/backend receipt or visible composer fill is not success.

The active runtime does not use Runtime Pilot, global sequence gaps, batch planner, recovery scheduler, or an outbox state machine. Reconnect recovery retries only unresolved work for the role that disconnected.

## User surfaces
- `runtime/extension/studio/` — web Session Studio and provider route selection.
- `runtime/extension/cockpit/` — compact bottom dock with Auto/Gather, Pause, Send gathered, Export, and Tools/Help.
- Review, markers, display preferences, safe End Session, window focus/restore, and answer-size estimates stay outside the delivery hot path.

## AutoHotkey
`runtime/Final_2_Window_Extension.ahk` is an optional small Studio bootstrap. AutoHotkey is not part of live question delivery.

## Verification
From the repository root:

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Final release evidence must also include isolated MV3 transport/reconnect and provider write/submit/render smokes plus real provider acceptance when authenticated sessions are available.

## Deployment and rollback
- Develop on `feature/pmia-simple-runtime`; preserve dirty `main` unless explicitly instructed otherwise.
- The persistent 0.12 deployment copy is `runtime/extension/__pmia012_deploy` under the preserved main repository.
- Keep PMIA 0.11 installed but disabled until 0.12 acceptance is complete.
- Never clear cookies, tokens, provider authentication, browser profiles, or unrelated tabs/windows as part of PMIA deployment or verification.

## Private data
Do not commit Resume, JD, prompts, answers, cookies, credentials, tokens, or active provider-session content. PMIA persistent diagnostics are bounded metadata only.
