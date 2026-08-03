# PMIA 0.10.4 Low-Level Design

## RecoveryBudget contract

`RecoveryBudget` retains the existing public methods `consume`, `reset`, and `snapshot`. The additive constructor option `maxStoredAttempts` defaults to 32 and is normalized to at least `maxAutomatic`.

## State

- `attempts`: bounded chronological records `{ at, source }`.
- `exhaustedAt` and `cooldownUntil`: unchanged automatic-recovery authority.
- `lastResetAt` and `resetCount`: unchanged operator reset metadata.

## Pruning algorithm

1. Remove attempts older than the active recovery window.
2. When within the storage bound, preserve the active list unchanged.
3. When over the bound, retain the newest automatic entries up to `maxAutomatic`.
4. Fill remaining capacity with the newest manual entries.
5. Sort retained entries chronologically.

## Invariants

- Storage cannot evict an active automatic attempt needed to calculate exhaustion.
- Manual attempts never consume the automatic budget.
- Snapshot callers cannot mutate internal attempt records.
- State names, reasons, cooldown behavior, and serialization fields remain compatible.

## Complexity

State size is O(`maxStoredAttempts`). Pruning is O(n log n) over a small bounded list; all other calculations remain linear in the bounded list.

## Verification

The focused recovery-budget suite covers exhaustion, cooldown, rapid manual attempts, oversized restore normalization, and snapshot immutability.
