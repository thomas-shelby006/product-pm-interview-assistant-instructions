# PMIA Production Readiness Cycles 196-245 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the verified 0.8.0 candidate into a production-handoff-ready live interview system with decisive operator controls, production diagnostics, and deterministic release evidence.

**Architecture:** Preserve the lossless ledger, provider adapters, and transport owners. Add pure snapshot-derived production models, one bounded persisted `productionControls` object, three allow-listed commands, a Production Pilot view, and repository-owned handoff tooling.

**Tech Stack:** Manifest V3 JavaScript modules, Node test runner, AutoHotkey validation, PowerShell release tooling, standalone HTML atlas.

## Global constraints

- Do not persist question, answer, setup, clipboard, credential, or raw URL content in new models.
- Do not add a second transport, ledger, recovery, or state store.
- Provider-window focus remains explicit-user-gesture only.
- Tests are authored with development and executed only after Cycle 245 source completion.
- HTML is updated only after final automated and isolated-browser verification.
- No push, merge, tag, or original-checkout mutation.

---

### Cycle 196: Decision synthesis

- **Bug fix:** Combine pending no-response, draft conflict, readiness blockers, incidents, gaps, end guard, and storage pressure into one bounded decision set.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 197: Decision ranking

- **Bug fix:** Rank decisions deterministically by severity, urgency, age, and stable identifier.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 198: Decision actions

- **Bug fix:** Map each decision to an existing safe command or internal dashboard destination.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 199: Decision traceability

- **Bug fix:** Attach source reason codes and affected role or ledger counts without content.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 200: Decision Center UI

- **Bug fix:** Expose the primary decision and bounded queue in a Production view.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 201: Operating profiles

- **Bug fix:** Define Safe, Balanced, and Fast profiles from existing receiver controls.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 202: Profile preview

- **Bug fix:** Show exact hold, auto-submit, drain, idle-submit, and pause-after-answer changes before application.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 203: Atomic profile apply

- **Bug fix:** Apply profile commands through existing owners and persist only after every command succeeds.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 204: Profile guardrails

- **Bug fix:** Block Fast profile when storage, state compatibility, or provider capability evidence is unsafe.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 205: Profile audit

- **Bug fix:** Persist selected profile and bounded change metadata in session-only state.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 206: Context routes

- **Bug fix:** Map operational decisions to the correct Pilot tab and anchor.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 207: Next safe action

- **Bug fix:** Derive one executable next action with command payload and explanation.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 208: Command relevance

- **Bug fix:** Boost command palette relevance from the active decision and session phase.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 209: Internal navigation

- **Bug fix:** Navigate inside the Pilot without focusing provider windows.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 210: Navigation evidence

- **Bug fix:** Record the last internal route and reason as metadata only.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 211: Containment state

- **Bug fix:** Derive Normal, Watch, Queue-only, or Blocked containment from authoritative evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 212: Automatic containment

- **Bug fix:** Keep queue-only enforcement tied to root cause and consistency evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 213: Bounded override

- **Bug fix:** Allow a time-bounded override only for non-critical containment causes.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 214: Override expiry

- **Bug fix:** Expire overrides deterministically and restore derived policy automatically.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 215: Containment UI

- **Bug fix:** Show cause, protected data, override eligibility, and recovery action.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 216: Transport aggregation

- **Bug fix:** Combine sender and receiver lane state, RTT, score, circuit, and fallback evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 217: Correlation assurance

- **Bug fix:** Detect command or trace correlation gaps without inspecting message content.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 218: Lane forecast

- **Bug fix:** Forecast direct-lane recovery and fallback continuity.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 219: Active probe

- **Bug fix:** Reuse the no-content self-test as a user-triggered transport probe.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 220: Transport Assurance UI

- **Bug fix:** Expose per-role and aggregate transport state with one probe action.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 221: Provider capability matrix

- **Bug fix:** Summarize required and optional adapter surfaces for both roles.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 222: Route readiness

- **Bug fix:** Derive whether the current sender-to-receiver provider route is safe.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 223: Context readiness

- **Bug fix:** Include context armed and resend eligibility in route readiness.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 224: Manual failover checklist

- **Bug fix:** Provide ordered, non-automatic failover steps without changing providers.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 225: Route Readiness UI

- **Bug fix:** Expose blockers and existing Check Live or Resend Context actions.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 226: State compatibility gate

- **Bug fix:** Summarize schema, migration, integrity, and quarantine evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 227: Storage headroom gate

- **Bug fix:** Require safe session-storage headroom for upgrade readiness.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 228: Delivery barrier gate

- **Bug fix:** Block upgrade readiness while unresolved or in-flight ownership exists.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 229: Rollback readiness

- **Bug fix:** Report last-known-good and cleanup journal evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 230: Upgrade Safety UI

- **Bug fix:** Expose Ready, Wait, or Blocked with exact reasons.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 231: Marker scorecard

- **Bug fix:** Aggregate answer and review markers by category.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 232: Phase scorecard

- **Bug fix:** Summarize phase duration and question coverage.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 233: Delivery and answer scorecard

- **Bug fix:** Separate rendered delivery success from answer availability.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 234: Follow-up scorecard

- **Bug fix:** Count linked, deferred, pinned, and unresolved follow-ups.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 235: Live Scorecard UI

- **Bug fix:** Expose a metadata-only session scorecard and review readiness.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 236: Production health score

- **Bug fix:** Combine readiness, containment, transport, storage, and consistency into one score.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 237: Privacy audit

- **Bug fix:** Prove diagnostics contain no question, answer, setup, clipboard, credential, or raw URL fields.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 238: Environment fingerprint

- **Bug fix:** Build a bounded version, route, schema, and capability fingerprint.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 239: Support completeness

- **Bug fix:** Report whether the support bundle contains every required metadata section.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 240: Escalation summary

- **Bug fix:** Provide a copyable metadata-only escalation summary.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 241: Release checklist

- **Bug fix:** Derive source, automated, browser, cleanup, privacy, and handoff gates.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 242: Handoff manifest

- **Bug fix:** Generate a deterministic main-worktree handoff manifest.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 243: Cleanup manifest

- **Bug fix:** List assistant-created temporary artifacts separately from repository evidence.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 244: Release seal

- **Bug fix:** Require exact commit, clean tree, evidence hashes, and no push or tag.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

### Cycle 245: Release Readiness UI

- **Bug fix:** Expose final handoff state and downloadable manifest in the Production view.
- **New feature:** Expose the result through the Production view or existing safe command surface.
- **Implementation:** Keep the owner pure or session-only, add a regression contract, and update the cycle log.

## Files

- Create: `runtime/extension/shared/operator-decision-center.js`
- Create: `runtime/extension/shared/operating-profile.js`
- Create: `runtime/extension/shared/cockpit-navigation.js`
- Create: `runtime/extension/shared/containment-status.js`
- Create: `runtime/extension/shared/transport-assurance.js`
- Create: `runtime/extension/shared/provider-route-readiness.js`
- Create: `runtime/extension/shared/upgrade-readiness.js`
- Create: `runtime/extension/shared/live-scorecard.js`
- Create: `runtime/extension/shared/production-diagnostics.js`
- Create: `runtime/extension/shared/release-handoff.js`
- Modify: `runtime/extension/shared/runtime-pilot-state.js`
- Modify: `runtime/extension/shared/runtime-pilot-controller.js`
- Modify: `runtime/extension/shared/dashboard-protocol.js`
- Modify: `runtime/extension/dashboard/index.html`
- Modify: `runtime/extension/dashboard/dashboard.js`
- Modify: `runtime/extension/dashboard/dashboard.css`
- Create: `runtime/scripts/build-handoff-manifest.mjs`
- Create: `runtime/extension/tests/cycles-196-245-production-readiness.test.js`
- Modify: `docs/ITERATIVE_IMPROVEMENT_LOG.md`

## Final verification

1. Run the complete repository validator.
2. Run the isolated Edge release smoke against the exact committed HEAD.
3. Generate deterministic release evidence and handoff manifest.
4. Verify original checkout and normal Edge remain unchanged.
5. Remove only assistant-created temporary files.
6. Update and validate the standalone technical HTML.
