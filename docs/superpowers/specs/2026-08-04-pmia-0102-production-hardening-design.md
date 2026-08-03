# PMIA 0.10.2 Production Hardening Design

Date: 2026-08-04
Approved by the user's explicit instruction to continue and complete 50 bug-fix cycles, 50 deployment-polish cycles, packaging, archiving, and cleanup.

## Objective

Produce one exact PMIA 0.10.2 local release candidate from the verified 0.10.1 source. Preserve the immutable installed 0.6.1 rollback archive, replace only `PMIA Deployment\current` after exact verification, and finish with one clean `main`, one final evidence package, and no task-owned temporary state.

## Scope

The campaign covers the existing runtime only: AutoHotkey launcher/platform, Manifest V3 extension, sender admission/outbox, receiver batching and rendered proof, Adaptive Turn, Runtime Pilot dashboard, session cleanup, packaging, Profile Doctor, release evidence, and operator documentation.

It does not add a provider-specific special case, weaken exact rendered proof, edit Edge Preferences or Secure Preferences, push Git, create a tag or PR, publish a package, or perform cloud deployment.

## Cycle contract

Cycles 1-50 are defect-focused. Every cycle names one owning surface, inspects the cheapest reliable signal, and ends as either `fixed` with a failing regression observed before implementation or `retained` with no defect reproduced.

Cycles 51-100 are polish-focused. They improve clarity, accessibility, performance, diagnostics, deployment repeatability, and documentation without changing product semantics unless a defect is first reproduced.

## Release identity

The new current candidate is version 0.10.2. The archive remains version 0.6.1 at source commit `66ea17e`. The current package must be built only from the final clean `main` commit after full gate and isolated-browser evidence.

## Verification model

Use focused tests during red-green work, then one widened matrix per coherent batch. The decisive release gate runs the complete Node suite, extension validator, packaged-runtime validator, launcher/platform AutoHotkey validation, package integrity tests, and one isolated Edge smoke from an exact commit.

Anonymous-provider failures remain failures and are retained as diagnostics. A green browser result may be transferred across a docs/tooling-only final commit only when a deterministic Git-object equivalence manifest proves every production extension object, launcher, and smoke script is identical.

## Deployment and rollback

`New-PMIACurrentDeployment.ps1` builds a sibling staging package, verifies it, promotes it atomically, and removes the previous current package only after success. `Test-PMIADeployment.ps1` must reject changed, missing, added, or duplicated files.

The stable current extension path remains `C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\extension`. The Edge compatibility junction may point to this path until the normal profile is registered directly. The user-facing final action remains Reload in `edge://extensions`, with Load unpacked as fallback.

## Cleanup

After local main promotion and package verification, remove the temporary hardening worktree and branch, obsolete current package remnants, staging directories, task scripts, disposable browser profiles, and superseded evidence. Retain only the 0.6.1 archive, the 0.10.2 current package, final inventory/guide, one final evidence directory, clean main, and the compatibility junction only while Edge still references it.
