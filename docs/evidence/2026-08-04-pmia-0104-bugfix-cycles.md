# PMIA 0.10.4 Bugfix Cycles 1–50

**Scope:** Receiver submission, rendered proof, retry safety, and regression boundaries.

| Cycle | Inspection | Outcome | Evidence |
|---:|---|---|---|
| 1 | First submit clears composer without a user turn | **Fix** | Reproduced RED; old predicate required original text to remain. |
| 2 | Rendered user-turn proof authority | **Retain** | Success still requires a new user identity after the original baseline. |
| 3 | Retry count | **Retain** | Maximum remains two submit attempts. |
| 4 | Empty-composer retry threshold | **Fix** | Added independent bounded 12-second threshold. |
| 5 | Matching-composer retry threshold | **Retain** | Existing check-count or elapsed-time rule remains. |
| 6 | Active generation during proof wait | **Retain** | Generation blocks all retries. |
| 7 | Newer operator/provider draft | **Retain** | Different non-empty composer content is never overwritten. |
| 8 | Superseded delivery identity | **Retain** | `isCurrent` terminates recovery before a second click. |
| 9 | Baseline user identities | **Retain** | Second attempt reuses the original baseline set. |
| 10 | Provider normalization | **Retain** | Proof compares normalized visible user text. |
| 11 | Composer read contract | **Adapt** | Runtime uses existing `getComposerText` with `isComposerEmpty` fallback. |
| 12 | Adapter compatibility | **Retain** | ChatGPT and Claude already expose both composer-state methods. |
| 13 | Boolean return contract | **Retain** | Function still returns only confirmed success/failure. |
| 14 | Failure reason ownership | **Retain** | Caller continues to emit `rendered_turn_not_confirmed`. |
| 15 | Sequence admission | **Retain** | No sequence or ledger code changed. |
| 16 | Receiver batch ownership | **Retain** | Retry occurs inside the existing owned submission. |
| 17 | Sender outbox behavior | **Retain** | No sender persistence path changed. |
| 18 | Pause accumulation | **Retain** | No pause/resume transition changed. |
| 19 | Duplicate rendered turn | **Retain** | Baseline identity prevents stale proof reuse. |
| 20 | Same text from an older turn | **Retain** | Identity plus baseline prevents false proof. |
| 21 | Composer write failure | **Retain** | Immediate failure remains fail-closed. |
| 22 | Send control unavailable | **Retain** | Readiness loop and timeout remain authoritative. |
| 23 | Submit click returns false | **Retain** | No proof wait starts for an untriggered submit. |
| 24 | Late first rendered turn | **Retain** | First attempt can still prove during the full confirmation window. |
| 25 | Second click after proof appears | **Retain** | Proof check runs before retry eligibility. |
| 26 | Retry while page hidden | **Adapt** | Elapsed-time threshold works when frame cadence is sparse. |
| 27 | Yield source selection | **Retain** | Existing provider-yield abstraction remains. |
| 28 | Maximum confirmation wait | **Retain** | Default 45-second runtime limit unchanged. |
| 29 | Test-controlled confirmation wait | **Retain** | Existing injectable timing parameters remain. |
| 30 | Empty text input | **Retain** | Normalization still rejects empty submission. |
| 31 | Whitespace-only composer | **Adapt** | Composer sampling trims before empty-state classification. |
| 32 | Missing composer reader | **Retain** | Fallback uses adapter `isComposerEmpty`; no unsafe inference. |
| 33 | Missing empty-state methods | **Retain** | Unknown composer state does not authorize retry. |
| 34 | Microphone state | **Retain** | Submission recovery does not touch voice controls. |
| 35 | Stop-generation surface | **Retain** | Ordinary recovery never interrupts generation. |
| 36 | Provider-specific selectors | **Retain** | No selector broadening or DOM workaround added. |
| 37 | Content instance lifecycle | **Retain** | No registration or lease behavior changed. |
| 38 | Back-forward cache lifecycle | **Retain** | No resource teardown behavior changed. |
| 39 | Telemetry privacy | **Retain** | No prompt text added to diagnostics. |
| 40 | Retry telemetry | **No-change** | Existing submission/proof spans remain sufficient. |
| 41 | Error retry budget | **Retain** | This local submit retry is not runtime repair-budget consumption. |
| 42 | Direct transport | **Retain** | No transport lane behavior changed. |
| 43 | Fallback transport | **Retain** | No fallback authority changed. |
| 44 | Anonymous-provider canary failure | **Fix** | Root cause now has one safe recovery attempt. |
| 45 | Authenticated-provider behavior | **Retain** | Same proof and retry bounds apply. |
| 46 | ChatGPT compact composer | **Retain** | Existing adapter read/write methods cover it. |
| 47 | Claude contenteditable composer | **Retain** | Existing adapter read/write methods cover it. |
| 48 | Regression suite breadth | **Adapt** | Added four focused negative/positive contracts. |
| 49 | Focused runtime verification | **Pass** | Runtime and adapter suite passes 72/72. |
| 50 | Scope containment | **Pass** | Only runtime submission logic and tests changed. |

**Count:** 50 cycles.
