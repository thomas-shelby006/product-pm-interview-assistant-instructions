# PMIA 0.10.3 High-Level Design Cycles

Date: 2026-08-04

These 50 cycles re-evaluate system boundaries, data flows, failure domains, deployment topology and non-functional requirements. The result is a one-way architecture gate plus explicit hotspot budgets; no broad runtime rewrite was justified.

| Cycle | Area | Result | Decision |
|---:|---|---|---|
| 1 | Launcher boundary | retained | Session Studio owns profile, route, windows and in-memory context |
| 2 | Service worker boundary | retained | Background owns registry, persistence, alarms and command routing |
| 3 | Sender boundary | retained | Window 1 owns observation and authoritative final admission |
| 4 | Receiver boundary | retained | Window 2 owns draft, submit, proof and answer capture |
| 5 | Dashboard boundary | retained | Pilot observes snapshots and emits validated commands only |
| 6 | Storage boundary | retained | Session storage owns ephemeral runtime state; deployment files contain no session data |
| 7 | Adapter boundary | retained | Provider-specific DOM semantics stay inside adapters |
| 8 | Evidence boundary | retained | Release evidence is metadata-only and commit-bound |
| 9 | Deployment boundary | retained | Stable current and immutable archive are outside source |
| 10 | Review boundary | retained | Tracker export is explicit and separate from live delivery |
| 11 | Boot context flow | retained | AHK memory to sender transport to receiver context |
| 12 | Preview flow | retained | Disposable provider preview never enters durable ledger |
| 13 | Final flow | retained | Authoritative final enters outbox and durable admission |
| 14 | Outbox flow | retained | Sender retains ownership until persistence acknowledgement |
| 15 | Ledger flow | retained | Every unique final remains until proof or explicit archive |
| 16 | Batch flow | retained | Receiver partitions without deleting later members |
| 17 | Proof flow | retained | Provider-rendered identity proves exact frozen membership |
| 18 | Answer flow | retained | Answer lifecycle remains separate from delivery truth |
| 19 | Export flow | retained | Explicit export writes safe role-scoped records |
| 20 | Cleanup flow | retained | Two-phase end clears exact session owners |
| 21 | Browser restart | retained | Session state and outbox recovery remain fail-closed |
| 22 | Worker suspension | retained | Alarms and storage restore bounded recovery |
| 23 | Tab replacement | retained | Instance fencing and role leases prevent stale ownership |
| 24 | Provider drift | retained | Capability probation blocks unsafe writes |
| 25 | Storage pressure | retained | Actionable data is protected before telemetry compaction |
| 26 | Network loss | retained | Queue-only persistence continues without provider writes |
| 27 | Duplicate commands | retained | Command journal replays original results |
| 28 | Stale evidence | retained | Release and self-test evidence expire or mismatch |
| 29 | Package corruption | retained | Checksum and unexpected-file verification fail closed |
| 30 | Operator interruption | retained | Pause and explicit choices preserve ownership |
| 31 | Immutable archive | retained | 0.6.1 remains an independently verified rollback |
| 32 | Stable current path | retained | Current is atomically replaced at one fixed path |
| 33 | Compatibility alias | retained | Legacy registration may resolve to stable current only |
| 34 | Reload-first activation | retained | Existing unpacked card reloads before fallback load |
| 35 | Manual browser boundary | retained | Browser internal extension activation stays explicit |
| 36 | No preference mutation | retained | Preferences and Secure Preferences are never edited |
| 37 | Isolated smoke | retained | Disposable Edge profile proves browser behavior |
| 38 | Exact commit evidence | retained | Gate and smoke bind to one source identity |
| 39 | Atomic promotion | retained | Failed verification restores previous current |
| 40 | Rollback decision | retained | Rollback occurs only after verified current failure |
| 41 | Latency | retained | Ready paths remain event-driven without fixed sleeps |
| 42 | Durability | retained | Every final has one durable owner |
| 43 | Privacy | retained | No prompts, answers, credentials or raw URLs in diagnostics |
| 44 | Accessibility | retained | Keyboard, live regions, narrow reflow and print remain gates |
| 45 | Observability | retained | Reason-coded metadata identifies one owning layer |
| 46 | Bounded memory | retained | Collections, histories and telemetry have explicit limits |
| 47 | Determinism | retained | Fixtures and source-bound manifests replace timing guesses |
| 48 | Compatibility | retained | Schema migration and stable paths protect upgrades |
| 49 | Recovery | retained | Repair is bounded, idempotent and background-safe |
| 50 | Maintainability | retained | One-way dependencies and hotspot budgets block drift |
