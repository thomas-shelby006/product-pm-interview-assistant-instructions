# PMIA 0.10.3 Low-Level Contracts

## Batch transaction

- Restored history retains at most 20 newest entries.
- Restored entries normalize canonical transition identity and clone safe metadata.
- Runtime transition data cannot override `from`, `to`, `at` or `reason`.
- Duplicate transitions are idempotent; illegal transitions do not mutate state.

## State and persistence

Versioned envelopes, one-way migrations, integrity digests, last-known-good recovery and metadata-only quarantine remain authoritative.

## Timers and collections

Every recurring timer has one owner and an explicit cancellation path. Service-worker durability uses alarms. Histories, samples, journals, maps and sets remain bounded at their owner.

## Normalization and errors

Numbers, timestamps, paths and identities normalize at ownership boundaries. Stable issue and reason codes carry safe remediation without session content.
