# Current Status Dashboard

Last updated: 2026-07-30

## Active production system

| Area | Status | Notes |
|---|---|---|
| Runtime release | PMIA 0.6.1 candidate | Manifest V3 dual-provider runtime; release only after exact-tree verification. |
| Browser | Microsoft Edge Stable | Session Studio selects the registered profile and Profile Doctor verifies path/version. |
| Launcher | Active | `runtime/Final_2_Window_Extension.ahk`; structured memory-only session setup and PM-only hotkeys. |
| Transport | Active | Extension preview/final lanes, provider-specific boundaries, durable sequence and rendered-turn acknowledgement. |
| Session tracker | Active Review Studio | `runtime/Session_Tracker_End_Session.ahk`; exact READY pairing, control-channel export/end, strict Markdown resolver, structured tracker push result, Review Lab handoff. |
| Tracker repository | Ready | Private `thomas-shelby006/pm-interview-session-tracker`; synthetic dry run leaves it unchanged. |
| Legacy runtime | Preserved, inactive | Edge Beta, Tampermonkey, fixed launcher, and archives are rollback/reference material only. |

## Current source of truth

1. `README.md`
2. `runtime/extension/README.md`
3. `runtime/README_INSTALL_TEST.md`
4. `docs/SESSION_TRACKER_SETUP.md`
5. `docs/evidence/2026-07-30-pmia-runtime-v0.6.1-verification.md` after release verification

## Remaining release actions

1. Run the complete 0.6.1 gate and inspect the final diff.
2. Smoke-test Session Studio and tracker no-session/dry-run behavior with synthetic data.
3. Publish branch/main/tag only after merged-main verification.
4. Reload the canonical unpacked extension and close obsolete GitHub issue #7.

## Non-negotiable boundaries

- Do not enable Edge Beta or Tampermonkey beside the active Manifest V3 runtime.
- Do not persist Resume, JD, structured metadata, notes, prompts, answers, cookies, or tokens.
- Do not push real interview content during release testing.
- Preserve legacy rollback files and unrelated Edge windows.
