# PMIA Current Source Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the canonical Git repository the only current PMIA application copy and produce a verified current-system technical guide.

**Architecture:** Edge loads the Manifest V3 extension directly from the repository. AutoHotkey owns native launch and window lifecycle. The private session tracker is stored under ignored `.local` state. Historical implementation files are removed from the working tree but remain recoverable from Git history.

**Tech Stack:** Microsoft Edge Manifest V3, JavaScript modules, Chrome extension APIs, AutoHotkey v2, PowerShell, Node test runner, Git, self-contained HTML/CSS/SVG.

## Global Constraints

- Do not modify Browser Evidence Capture registrations or files.
- Do not push, tag, publish, or deploy outside the local machine.
- Do not delete the canonical Git history.
- Do not delete the session tracker data; move it transactionally.
- Do not delete the old deployment tree until direct-source Edge registration and Preflight pass.
- Keep one current version only: PMIA 0.10.4.

### Task 1: Inventory and classify
- Record all PMIA-related roots, legacy assets, active references, sizes, hashes, Edge registrations, and processes.
- Produce a machine-readable deletion manifest with reasons and retained replacements.

### Task 2: Simplify the current source tree
- Update Review Studio defaults and documentation to `.local\session-tracker`.
- Remove archive-only, Tampermonkey, fixed-launcher, old-release, stale evidence, stale cycle, and obsolete deployment-package files.
- Update tests and active documentation so only current architecture is authoritative.
- Run focused tests and the full validator.

### Task 3: Create the technical guide
- Create one self-contained HTML guide explaining current architecture, end-to-end transport, module lifecycle, reliability mechanisms, current-versus-previous gains, Tampermonkey comparison, Browser Evidence Capture distinction, alternatives, trade-offs, operations, maintenance, and pending user actions.
- Include accessible SVG diagrams, full-sentence explanations, source file map, commands, and research sources.
- Audit desktop, 320-pixel, print, anchors, duplicate IDs, offline assets, and mojibake.

### Task 4: Integrate and migrate runtime
- Merge the verified cleanup branch into local `main`.
- Move the session tracker to `.local\session-tracker`.
- Remove the old PMIA unpacked registration and load `runtime\extension` directly.
- Verify one PMIA card, correct version/path, Profile Doctor, and Session Studio Preflight.

### Task 5: Destructive cleanup
- Delete `PMIA Deployment`, repository archives/drafts/legacy assets, compatibility junctions, temporary worktrees/branches, task logs, screenshots, and helpers listed in the deletion manifest.
- Generate the final inventory and verify exact survivors.
- Run one final source, browser, process, and filesystem audit.
