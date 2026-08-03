# PMIA 0.10.1 Production Deployment Cycles

Date: 2026-08-03
Implementation checkpoint before this report: `e36ce58`
Target: local `main`, no push, tag, PR, publication, or cloud deployment.

## Twenty-five completed cycles

| Cycle | Owning surface | Result |
|---:|---|---|
| 1 | Repository/worktrees | Eight registered worktrees inventoried; integration and target clean; historical dirt content-hashed and disposition-bound. |
| 2 | Installed identity | Edge `Default` identified PMIA 0.6.1, extension `cggnlmoklajjmphoffcoabhflcdkphka`, registered junction and resolved source recorded. |
| 3 | Browser executable | Reproduced malformed saved executable acceptance; invalid paths now fall back to the installed family executable. |
| 4 | User-data root | Missing saved user-data roots now fall back; valid custom roots remain unchanged. |
| 5 | Profile Doctor | Path, version, profile, registered path, resolved path, and issue code retained as the browser source of truth. |
| 6 | Release identity | Active release surfaces and manifest aligned to PMIA 0.10.1; historical 0.10.0 records left historical. |
| 7 | Package allowlist | Current/archive builders include the runtime, launcher, review companion, active project bundle, templates, and operator guide. |
| 8 | Privacy exclusions | Git metadata, worktrees, task temp, evidence, logs, browser profiles, settings, and secrets are excluded and rejected. |
| 9 | Source binding | Deployment manifests bind version, source commit, source root, paths, counts, bytes, and UTC generation time. |
| 10 | Integrity inventory | Every packaged file except the inventory itself is SHA-256 listed; omitted, added, duplicate, and changed files fail verification. |
| 11 | Archive identity | Installed archive records profile, extension ID, registered path, resolved path, version, and source commit. |
| 12 | Archive verification | Real 0.6.1 archive verified independently with 96 checksum entries and source commit `66ea17e`. |
| 13 | Atomic current staging | Current deployment builds in a sibling staging directory, verifies, promotes atomically, and rolls back a failed replacement. |
| 14 | Rollback usability | Detailed Edge load, validation, old-entry removal, troubleshooting, and 0.6.1 rollback procedure documented. |
| 15 | Launcher portability | Deployment launcher resolves runtime resources relative to its own directory and recovers invalid browser settings. |
| 16 | Extension packaging | Manifest V3 runtime, dashboard, dynamic imports, hidden-tab helper, and command resources remain validator-reachable. |
| 17 | AutoHotkey | Platform smoke, launcher tests, main launcher, review companion, and runtime platform validation passed. |
| 18 | Admission/outbox | Dedicated durable admission and sender-outbox lanes remain non-blocking, ordered, restart-safe, and lossless. |
| 19 | Adaptive Turn | Pause, accumulation, combined resume, durable `resume_pending`, success finalization, and protected-Pause rollback passed. |
| 20 | Dashboard | Monotonic resync generations, null-safe startup, semantic deltas, and Resume control projection passed. |
| 21 | Transport | Direct/fallback lanes, circuit recovery, correlation fencing, credits, and deterministic 12-check drill passed. |
| 22 | Storage/privacy/end | Session-only logs, safe exports, support bundle redaction, pressure rules, and exact end-session cleanup passed. |
| 23 | Worktree integration | Focused 248-test matrix passed; all eight worktrees are included/accounted with exact historical dispositions. |
| 24 | Browser evidence | Disposable Edge smoke passed all five Adaptive Turn scenarios, three rendered finals, UI gates, transport, outbox/gap, and cleanup. |
| 25 | Release evidence | Reproduced UTF-16LE PowerShell gate-log parsing failure; BOM-aware parser and regression now pass all seven evidence tests. |

## Verification snapshots

- Focused production matrix: **248/248**.
- Exact `e09e284` complete gate: **1,337/1,337**, 514 JavaScript files, 18 runtime surfaces, 287 production modules.
- Exact `e09e284` isolated Edge smoke: delivery proof, all Adaptive Turn scenarios, transport drill, Pilot/Production/Assist/Reliability/Operations UI, self-test, outbox/gap, and cleanup all passed.
- Installed archive: `C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed`.

The final documentation checkpoint must receive one fresh exact-HEAD gate and smoke before local `main` promotion and current package creation.
