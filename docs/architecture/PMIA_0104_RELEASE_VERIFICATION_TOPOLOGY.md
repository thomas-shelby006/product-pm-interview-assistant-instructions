# PMIA 0.10.4 Release Verification Topology

## Four independent lanes

### 1. Source and package

Owned by the repository validator and deployment package verifiers. It proves the exact commit, tests, reachable production modules, package checksums, clean source, AutoHotkey parsing, and immutable rollback archive. Failure blocks package promotion.

### 2. Deterministic browser

Owned by isolated Microsoft Edge with a disposable user-data directory. It proves extension identity, role self-test, Adaptive Turn module scenarios, transport drill, command reachability, responsive UI surfaces, and task-owned cleanup. Failure blocks package promotion.

### 3. Provider canary

Owned by the external provider. It proves only a new provider-rendered user turn relative to the captured baseline. Its status is `passed`, `limited`, `failed`, or `skipped`. A limitation never becomes success and never substitutes for deterministic browser proof.

### 4. Normal-profile activation

Owned by Profile Doctor and the Edge extensions UI. It proves the expected extension version and resolved path, followed by one real-provider acceptance flow. This is the final activation boundary.

## Authority rules

- A click, cleared composer, transport acknowledgement, or staged ledger entry is not rendered proof.
- Provider success cannot hide deterministic failure.
- Provider limitation cannot erase deterministic success.
- Normal-profile activation cannot be inferred from an isolated profile.
- All artifacts remain bound to one exact source commit.

## Failure routing

Source/package failures return to source or packaging owners. Deterministic browser failures return to extension runtime/UI owners. Provider limitations require a real-provider acceptance flow or provider-specific diagnosis. Profile mismatch requires Reload first and Load unpacked only when the existing card cannot update.

## Security and privacy

Automated smoke uses a disposable profile and never edits Edge Preferences, Secure Preferences, registry policy, or the user's normal browser data. Evidence records reason codes and metadata rather than prompt or answer content.
