# PMIA 0.10.4 Deployment Polish Cycles 1–50

**Scope:** Smoke orchestration, evidence, readiness, inventory, Edge activation, and cleanup.

| Cycle | Inspection | Outcome | Evidence |
|---:|---|---|---|
| 1 | Smoke evidence version | **Improve** | Evidence upgraded from 1.0 to 2.0. |
| 2 | Provider proof timeout handling | **Fix** | Timeout becomes a limited canary, not an outer smoke abort. |
| 3 | Deterministic checks after canary limitation | **Fix** | Transport and UI capture continue. |
| 4 | Provider canary success | **Retain** | Still requires all exact rendered proofs. |
| 5 | Provider canary failure reason | **Improve** | Ledger/proof/error reason is preserved. |
| 6 | Provider canary diagnostic sample | **Improve** | Last readiness sample remains available. |
| 7 | Deterministic self-test | **Retain** | Both roles, dashboard, and storage must pass. |
| 8 | Adaptive Turn module scenarios | **Retain** | All five deterministic scenarios must pass. |
| 9 | Pause/resume rendered proofs | **Separate** | Provider proof is reported separately from deterministic pause semantics. |
| 10 | Transport drill | **Retain** | Complete no-content drill remains required. |
| 11 | Pilot UI desktop | **Retain** | No overflow and accessibility evidence remain required. |
| 12 | Pilot UI 320 px | **Retain** | Responsive evidence remains required. |
| 13 | Production UI | **Retain** | Controls and responsive layouts remain required. |
| 14 | Assist UI | **Retain** | Action Dock and controls remain required. |
| 15 | Reliability UI | **Retain** | All reliability rows must render. |
| 16 | Operations Lab UI | **Retain** | Views, scenarios, privacy, keyboard, and journal checks remain. |
| 17 | Command reachability | **Retain** | Registry/DOM/owner audit remains required. |
| 18 | Command registry digest | **Retain** | Deterministic command identity remains recorded. |
| 19 | Disposable profile cleanup | **Retain** | Process tree and profile removal remain package gates. |
| 20 | Normal-profile access | **Retain** | Any access remains a hard failure. |
| 21 | Wrapper final `ok` | **Fix** | Now derives from deterministic browser plus cleanup. |
| 22 | Activation-ready status | **Improve** | Requires package, provider pass, and normal-profile proof. |
| 23 | Package-ready status | **Improve** | Requires deterministic browser proof, not provider availability. |
| 24 | Status `provider_limited` | **Add** | Explicit advisory state for uncontrolled render limitation. |
| 25 | Status `provider_failed` | **Add** | Explicit failed provider state. |
| 26 | Status `provider_not_run` | **Add** | Explicit skipped state. |
| 27 | Status `activation_pending` | **Add** | Provider passed but profile acceptance is incomplete. |
| 28 | Status `deterministic_failed` | **Add** | Exact blocking domain is visible. |
| 29 | Evidence-manifest commit check | **Retain** | Smoke commit must match repository HEAD. |
| 30 | Evidence-manifest deterministic gate | **Fix** | Requires deterministic browser success. |
| 31 | Evidence-manifest provider status | **Add** | Validates passed/limited/failed/skipped. |
| 32 | Evidence-manifest schema | **Improve** | Output upgraded to v2. |
| 33 | Readiness evidence input | **Add** | Accepts exact release-evidence path. |
| 34 | Readiness commit match | **Add** | Evidence commit must equal current package commit. |
| 35 | Readiness source/package lane | **Add** | Package checks and clean source are grouped. |
| 36 | Readiness deterministic lane | **Add** | Browser checks are surfaced independently. |
| 37 | Readiness provider lane | **Add** | Canary status and reason are surfaced. |
| 38 | Readiness activation lane | **Add** | Profile Doctor result is surfaced. |
| 39 | Readiness schema | **Improve** | Schema upgraded to v2. |
| 40 | Inventory release status | **Add** | Inventory embeds the full release-verification object. |
| 41 | Inventory package/activation split | **Add** | Both booleans are explicit. |
| 42 | Inventory schema | **Improve** | Schema upgraded to v3. |
| 43 | Reload-first deployment | **Retain** | Existing card reload remains preferred. |
| 44 | Load-unpacked fallback | **Retain** | Used only for missing/path-mismatched card. |
| 45 | Browser preference mutation | **Reject** | Operator tools remain read-only to profile files. |
| 46 | Evidence cleanup | **Retain** | Final inventory stores hashes before raw evidence deletion. |
| 47 | Rollback verification | **Retain** | 0.6.1 checksums remain mandatory. |
| 48 | Operator static tests | **Adapt** | Tests now enforce four-lane schemas. |
| 49 | Focused deployment verification | **Pass** | Operator/evidence suite passes 47/47. |
| 50 | Scope containment | **Pass** | Changes remain in smoke, evidence, readiness, inventory, tests, and docs. |

**Count:** 50 cycles.
