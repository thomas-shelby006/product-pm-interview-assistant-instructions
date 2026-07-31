# Current Status Dashboard

Last updated: 2026-08-01

## Active candidate system

| Area | Status | Notes |
|---|---|---|
| Runtime release | PMIA 0.7.0 worktree candidate | Reliability/coherence release based on verified 0.6.1 main. |
| Worktree | Isolated | `C:\Users\Sundar\Documents\product-pm-interview-assistant-improvement`, branch `improvement/pmia-0.7.0`. |
| Original checkout | Preserved | `product-pm-interview-assistant-instructions` remains unchanged. |
| Browser | Microsoft Edge Stable | Selected profile verified by Profile Doctor. |
| Launcher | Active candidate | Session Studio, Check Live, Fast Repair, structured memory-only context, PM-only hotkeys. |
| Transport | Active candidate | Disposable preview plus sequenced durable final through Manifest V3 service worker. |
| Runtime state | Ephemeral | Registry and role logs use `chrome.storage.session`; cleanup removes complete session state. |
| Recovery | Hardened | Dead-owner registration replacement and background-safe discarded-tab recovery. |
| Export | Schema 2.1 | Safe context and review statistics; full setup event text redacted. |
| Review Studio | Active | Exact READY-pair export, resolver, private tracker push, and exact-session shutdown. |
| Legacy runtime | Preserved, inactive | Edge Beta, Tampermonkey, fixed launcher, and archives remain rollback/reference only. |

## Current source of truth

1. `README.md`
2. `AI_SYSTEM_CONTEXT.md`
3. `runtime/extension/README.md`
4. `runtime/README_INSTALL_TEST.md`
5. `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
6. `docs/superpowers/specs/2026-08-01-pmia-0.7-reliability-coherence-design.md`

## Candidate completion gate

1. Complete source and test updates without intermediate test runs.
2. Inspect exact diff, encoding, and unrelated-file boundaries.
3. Run the single complete validator from the isolated worktree.
4. Use Browser Evidence Capture for material live-browser claims if the candidate is temporarily loaded for a synthetic smoke test.
5. Commit the verified worktree branch only; do not push, merge, tag, or replace canonical main without a separate instruction.

## Non-negotiable boundaries

- Do not enable the legacy runtime beside the Manifest V3 runtime.
- Do not persist Resume, JD, notes, prompts, answers, transcript logs, or session IDs to disk-backed runtime storage.
- Do not push real interview evidence during candidate verification.
- Preserve rollback files, original checkout, unrelated Edge windows, and the private tracker unless an explicit push is requested.
