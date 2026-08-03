# PMIA 0.10.3 Bug-Fix Cycles

Date: 2026-08-04

Fifty source and runtime failure-path cycles. One evidence-runner race was fixed; all other inspected contracts were retained after focused proof.

| Cycle | Area | Result | Evidence or decision |
|---:|---|---|---|
| 1 | Baseline source | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 2 | Deployment rollback | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 3 | First promotion cleanup | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 4 | Archive cleanup | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 5 | Path separation | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 6 | Reparse safety | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 7 | Manifest truth | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 8 | PowerShell exit status | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 9 | UTF-8 source integrity | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 10 | Smoke admission projection | fixed | Smoke now waits for each paused admission to reach the canonical next batch before injecting the next final |
| 11 | Admission identity | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 12 | Sequence order | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 13 | Attempt leases | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 14 | Ledger indexes | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 15 | Duplicate proof | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 16 | Stale acknowledgement | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 17 | Outbox restore | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 18 | Retry ownership | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 19 | Session isolation | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 20 | Shutdown fencing | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 21 | Pause admission | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 22 | Combined draft | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 23 | Resume pending | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 24 | Carryover | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 25 | Stop failure | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 26 | Manual conflict | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 27 | Exact batch proof | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 28 | No-response choice | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 29 | Restart reconciliation | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 30 | Concurrent commands | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 31 | Schema migration | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 32 | State quarantine | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 33 | Monotonic snapshots | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 34 | Semantic deltas | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 35 | Command journal | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 36 | Recovery budget | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 37 | Managed windows | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 38 | Storage pressure | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 39 | Support redaction | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 40 | End-session cleanup | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 41 | Visible controls | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 42 | Composer readiness | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 43 | Sender authority | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 44 | Profile discovery | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 45 | Executable fallback | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 46 | Unsafe flags | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 47 | Lifecycle titles | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 48 | Context memory | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 49 | Extension registration | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
| 50 | Normal-profile isolation | retained | Focused runtime, state, provider, packaging or cleanup evidence passed |
