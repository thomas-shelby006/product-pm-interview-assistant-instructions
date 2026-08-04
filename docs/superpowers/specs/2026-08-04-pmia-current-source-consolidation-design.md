# PMIA Current Source Consolidation Design

## Objective

Consolidate every active PMIA application asset under `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions`, make that Git repository the only editable and deployed application copy, retain the private session tracker under an ignored `.local\session-tracker` directory, and remove all archives, generated deployment copies, legacy runtime implementations, stale release evidence, and task traces.

## Final structure

- `runtime\extension`: the unpacked Microsoft Edge Manifest V3 extension loaded directly by Edge.
- `runtime\Final_2_Window_Extension.ahk`: the only live launcher.
- `runtime\Session_Tracker_End_Session.ahk`: Review Studio and tracker integration.
- `project_source_files`: canonical answer-behavior sources.
- `project_upload_bundle`: curated ChatGPT Project upload bundle generated from the source material.
- `review_lab_project`: current review-project instructions.
- `templates`: current session/export templates.
- `docs\PMIA_CURRENT_SYSTEM_TECHNICAL_GUIDE.html`: current architecture, lifecycle, maintenance, alternatives, trade-offs, and cleanup findings.
- `docs\PMIA_CURRENT_SYSTEM_INVENTORY.json`: final machine-verifiable state.
- `.local\session-tracker`: ignored private session repository moved from the Documents root.

## Deletion scope

Delete the separate `PMIA Deployment` tree, its 0.6.1 archive, the repository `archive` and `drafts` directories, the Tampermonkey scripts, the fixed legacy launcher, archive-building scripts, historical release tests, historical evidence and cycle documents, temporary worktrees, old compatibility junction, generated logs, screenshots, and helper scripts. Preserve Git history; deleted files remain recoverable from repository history without occupying the working tree.

## Runtime migration

Because an unpacked extension ID is path-derived when no manifest key is present, the old PMIA registration must be removed and `runtime\extension` loaded directly. No active PMIA session exists, so resetting extension-local state is acceptable. Browser Evidence Capture extensions remain untouched.

## Verification

The migration is complete only when the pruned source tree is clean, the complete current test and validation suite passes, Edge shows the direct source path and version 0.10.4, Session Studio Preflight passes, the session tracker default resolves to `.local\session-tracker`, only one PMIA extension registration remains, and all removed paths are absent.
