# PMIA 0.10.4 High-Level Design Cycles 1–50

**Scope:** Release authorities, evidence flow, failure domains, activation, and non-goals.

| Cycle | Inspection | Outcome | Evidence |
|---:|---|---|---|
| 1 | Source/package authority | **Define** | Repository gate and package verifiers own deterministic source truth. |
| 2 | Deterministic browser authority | **Define** | Isolated Edge owns extension runtime, UI, transport, and cleanup truth. |
| 3 | Provider canary authority | **Define** | External provider owns rendered-turn availability. |
| 4 | Normal-profile activation authority | **Define** | Profile Doctor and operator acceptance own installed-state truth. |
| 5 | Single binary release status | **Reject** | One boolean hid which failure domain actually failed. |
| 6 | Commit binding | **Retain** | Every source and browser artifact remains bound to one exact commit. |
| 7 | Package-blocking source failure | **Retain** | Failed source/package proof blocks promotion. |
| 8 | Package-blocking deterministic browser failure | **Define** | Runtime/UI/transport failure blocks promotion. |
| 9 | Package-blocking provider limitation | **Reject** | Uncontrolled anonymous-provider limitation is advisory, not deterministic. |
| 10 | Activation-blocking provider failure | **Define** | Activation requires a real rendered-turn canary. |
| 11 | Activation-blocking profile mismatch | **Retain** | Wrong path/version blocks activation. |
| 12 | Manual boundary | **Define** | Edge Reload/Load-unpacked remains an explicit browser operation. |
| 13 | Success inferred from click | **Reject** | Click acknowledgement is not rendered proof. |
| 14 | Success inferred from cleared composer | **Reject** | Empty composer is not rendered proof. |
| 15 | Success inferred from transport acknowledgement | **Reject** | Transport ownership is not provider rendering. |
| 16 | Provider canary status vocabulary | **Define** | Passed, limited, failed, and skipped are explicit. |
| 17 | Deterministic status vocabulary | **Define** | Boolean checks remain independently inspectable. |
| 18 | Source/package lane inputs | **Define** | Tests, validation, checksums, AutoHotkey parse, clean commit. |
| 19 | Deterministic browser lane inputs | **Define** | Self-test, Adaptive Turn, transport drill, four UI surfaces, cleanup. |
| 20 | Provider lane inputs | **Define** | Exact new rendered user turn and reason-coded failure. |
| 21 | Activation lane inputs | **Define** | Expected extension path/version and real-provider acceptance. |
| 22 | External outage isolation | **Improve** | Provider canary cannot erase deterministic extension evidence. |
| 23 | Runtime regression isolation | **Improve** | Provider success cannot hide deterministic runtime failure. |
| 24 | Profile drift isolation | **Improve** | Package truth remains separate from Edge registration truth. |
| 25 | Rollback authority | **Retain** | Immutable 0.6.1 package remains independently verified. |
| 26 | Deployment script dependency direction | **Retain** | Scripts do not become extension production imports. |
| 27 | Extension dependency direction | **Retain** | Content/background/dashboard/shared boundaries stay one-way. |
| 28 | Evidence-manifest versioning | **Improve** | Four-lane evidence requires v2 schema. |
| 29 | Readiness schema versioning | **Improve** | Operator readiness requires v2 schema. |
| 30 | Inventory schema versioning | **Improve** | Retained deployment inventory requires v3 schema. |
| 31 | Raw evidence retention | **Retain** | Hashes remain sufficient after task cleanup. |
| 32 | Limited-canary diagnostics | **Define** | Exact reason and last sample are preserved. |
| 33 | Canary rerun policy | **Define** | Rerun is optional; normal-profile acceptance can satisfy activation. |
| 34 | Deterministic rerun policy | **Define** | Any failure must be fixed and rerun before packaging. |
| 35 | Profile activation rerun policy | **Define** | Reload first; Load unpacked only when registration cannot update. |
| 36 | Preference-file mutation | **Reject** | No direct Edge Preferences or Secure Preferences edits. |
| 37 | Enterprise-policy installation | **Out-of-scope** | Requires explicit authorization and is unnecessary locally. |
| 38 | Store publication | **Out-of-scope** | No publication authority granted. |
| 39 | Cloud deployment | **Out-of-scope** | System is a local unpacked extension/launcher. |
| 40 | Observability privacy | **Retain** | Evidence records metadata/reasons, not prompts or answers. |
| 41 | Storage pressure separation | **Retain** | Release topology does not alter runtime state management. |
| 42 | Recovery ownership | **Retain** | Runtime repair remains distinct from deployment retry. |
| 43 | Service-worker restart model | **Retain** | Evidence must tolerate MV3 worker restart. |
| 44 | Browser process ownership | **Retain** | Isolated smoke owns only its disposable profile tree. |
| 45 | Normal profile protection | **Retain** | Automated smoke never touches normal user data. |
| 46 | Evidence aggregation | **Improve** | Status derives from lane authorities instead of ad hoc booleans. |
| 47 | Operator next action | **Improve** | Failure domain maps to a single owning remediation. |
| 48 | Architecture tests | **Add** | Topology tests reject lane collapse and false promotion. |
| 49 | Focused HLD verification | **Pass** | Topology tests pass 2/2. |
| 50 | Scope containment | **Pass** | Architecture record and tests add no production runtime dependency. |

**Count:** 50 cycles.
