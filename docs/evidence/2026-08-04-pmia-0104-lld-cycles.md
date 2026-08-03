# PMIA 0.10.4 Low-Level Design Cycles 1–50

**Scope:** RecoveryBudget state, invariants, bounds, compatibility, and complexity.

| Cycle | Inspection | Outcome | Evidence |
|---:|---|---|---|
| 1 | Automatic attempt count within active window | **Retain** | Automatic exhaustion semantics remain unchanged. |
| 2 | Rapid manual attempts | **Fix** | Manual attempts can no longer grow state without bound. |
| 3 | Storage limit option | **Fix** | Added normalized `maxStoredAttempts`, default 32. |
| 4 | Minimum storage capacity | **Fix** | Limit cannot be smaller than `maxAutomatic`. |
| 5 | Time-window pruning | **Retain** | Expired attempts are removed before size pruning. |
| 6 | Automatic-attempt preservation | **Fix** | Newest active automatic attempts are retained up to the budget. |
| 7 | Manual-attempt selection | **Fix** | Only newest manual attempts fill remaining capacity. |
| 8 | Chronological snapshot order | **Fix** | Retained attempts are sorted by timestamp. |
| 9 | Constructor restore normalization | **Fix** | Oversized persisted arrays are pruned on first snapshot/consume. |
| 10 | Snapshot immutability | **Retain** | Attempts are cloned before exposure. |
| 11 | State string `available` | **Retain** | No state vocabulary change. |
| 12 | State string `used` | **Retain** | No state vocabulary change. |
| 13 | State string `exhausted` | **Retain** | No state vocabulary change. |
| 14 | State string `cooldown` | **Retain** | No state vocabulary change. |
| 15 | Automatic rejection reason | **Retain** | `automatic_recovery_exhausted` remains. |
| 16 | Manual acceptance reason | **Retain** | `manual_recovery_accepted` remains. |
| 17 | Cooldown rejection reason | **Retain** | `recovery_cooldown` remains. |
| 18 | Cooldown transition | **Retain** | Cooldown starts only after automatic exhaustion. |
| 19 | Cooldown expiry | **Retain** | Expiry still clears attempts and exhausted marker. |
| 20 | Reset count | **Retain** | Manual reset accounting is unchanged. |
| 21 | Last reset timestamp | **Retain** | Reset metadata remains stable. |
| 22 | Source normalization | **Retain** | Only `manual` is special; all other input becomes `automatic`. |
| 23 | Timestamp normalization | **Retain** | Numeric coercion and non-negative clamping remain. |
| 24 | Window lower bound | **Retain** | Minimum window remains 1000 ms. |
| 25 | Cooldown lower bound | **Retain** | Minimum cooldown remains 1000 ms. |
| 26 | Automatic maximum lower bound | **Retain** | Minimum automatic allowance remains one. |
| 27 | Default compatibility | **Pass** | Existing constructor callers require no changes. |
| 28 | Persisted unknown fields | **Retain** | Constructor continues selecting only known state fields. |
| 29 | Malformed attempts input | **Retain** | Non-array input normalizes to empty. |
| 30 | Malformed attempt timestamp | **Retain** | Invalid timestamps normalize to zero and age out. |
| 31 | Malformed attempt source | **Retain** | Unknown sources normalize to automatic. |
| 32 | Equal timestamps | **Retain** | Stable array/filter order is preserved by numeric sort. |
| 33 | Storage limit one | **Adapt** | Normalized minimum still preserves automatic authority. |
| 34 | Storage limit zero | **Adapt** | Falls back to default rather than disabling storage. |
| 35 | Large configured limit | **Retain** | No artificial upper cap beyond caller policy. |
| 36 | Automatic attempts above maximum in restored state | **Adapt** | Newest automatic entries are retained for truthful active-window state. |
| 37 | Manual attempts during exhausted state | **Retain** | Manual intervention remains allowed. |
| 38 | Manual attempts during cooldown | **Retain** | Cooldown blocks all sources as before. |
| 39 | Automatic remaining calculation | **Retain** | Derived from active automatic attempts only. |
| 40 | Exhausted timestamp persistence | **Retain** | No reset until cooldown completion or manual reset. |
| 41 | Snapshot mutation of nested attempts | **Fix** | Dedicated test proves caller changes do not affect internal state. |
| 42 | Repeated snapshot pruning | **Pass** | Pruning is deterministic and idempotent. |
| 43 | Repeated consume pruning | **Pass** | Every mutation re-applies time and size bounds. |
| 44 | Memory complexity | **Improve** | Stored attempts are O(configured bound) instead of unbounded manual history. |
| 45 | CPU complexity | **Retain** | Small bounded filter/sort cost is acceptable. |
| 46 | Serialization shape | **Retain** | Snapshot fields remain backward compatible. |
| 47 | Migration requirement | **No-change** | No schema migration is needed for additive constructor policy. |
| 48 | Regression tests | **Adapt** | Added bounded, restore, and immutability contracts. |
| 49 | Focused LLD verification | **Pass** | Recovery-budget suite passes 5/5. |
| 50 | Scope containment | **Pass** | Only recovery budget, tests, and design evidence changed. |

**Count:** 50 cycles.
