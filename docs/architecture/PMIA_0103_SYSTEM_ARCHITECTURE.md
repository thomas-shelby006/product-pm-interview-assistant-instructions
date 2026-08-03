# PMIA 0.10.3 System Architecture

## Ownership graph

`background`, `content`, and `dashboard` may depend on `shared`. Shared contracts may not depend back on browser, provider, or UI owners. Content and dashboard may not import one another. The source-level gate in `architecture-boundaries.test.js` enforces this direction.

## Runtime topology

- AutoHotkey Session Studio owns local operator setup, exact managed windows and memory-only context.
- The Manifest V3 service worker owns session registry, durable admission, persistence, alarms, command routing and cleanup.
- Window 1 owns provider observation, disposable preview and authoritative final admission.
- Window 2 owns combined drafts, provider submission, rendered proof and answer observation.
- Runtime Pilot owns visualization and validated operator commands; it never writes provider DOM.
- Shared modules own provider-neutral state machines, schemas, indexes, policies and diagnostics.

## Release topology

Source, deployment and rollback are separate trust boundaries. Git main is the source of truth. `PMIA Deployment/current` is an atomic source-bound package. `archive/pmia-0.6.1-installed` is immutable rollback. Edge activation is reload-first and remains a manual browser-internal boundary.

## Known pressure points

The controller, dashboard renderer, Pilot state and content entry remain large orchestration owners. 0.10.3 does not split them speculatively. A growth envelope prevents silent expansion while future extraction requires a reproduced ownership defect and dedicated tests.
