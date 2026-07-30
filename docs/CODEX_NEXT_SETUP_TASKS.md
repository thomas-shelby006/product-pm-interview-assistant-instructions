# Next PMIA Setup Tasks

Last updated: 2026-07-30

This file tracks only current Edge Stable / Manifest V3 work. Edge Beta, Tampermonkey, the fixed launcher, and project-URL patch tasks are complete historical migration work and must not be reapplied.

## Read first

1. `docs/CURRENT_STATUS_DASHBOARD.md`
2. `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
3. `runtime/README_INSTALL_TEST.md`
4. `docs/SESSION_TRACKER_SETUP.md`
5. Latest verification record under `docs/evidence/`

## Current release sequence

1. Run the complete Node, extension, main AutoHotkey, and tracker-helper validators.
2. Smoke-test Session Studio structured fields with synthetic values; do not launch or persist real interview context.
3. Run the tracker push script with synthetic exports and `-DryRun`; confirm the private tracker repository is unchanged.
4. Inspect the exact diff and verify legacy files and unrelated Edge state are untouched.
5. Publish the feature branch, fast-forward `main`, rerun the complete merged-main gate, push `main`, and tag the verified release.
6. Reload only the PMIA unpacked extension card in the selected Edge Stable profile and verify Profile Doctor path/version.
7. Close obsolete GitHub issue #7 with the Edge Stable/Manifest V3 resolution.
8. Remove only the merged worktree and task-created temporary files.

## Current operational checks

- Session Studio shows Target company, Target role, Interview round, Emphasis, Avoid mentioning, Answer mode, Resume, Job Description, Additional notes, and launch controls.
- Session metadata remains memory-only; `settings.ini` stores only profile, route, and layout.
- Tracker helper discovers one complete PMIA lifecycle-title pair and exports both roles with `Ctrl+Shift+F8`.
- Missing or multiple sessions produce explicit errors.
- Dry run creates only `README.md`, `win1_sender.md`, and `win2_receiver.md` under the supplied dry-run path and performs no Git write.

## Do not do

- Do not enable Edge Beta or Tampermonkey beside the active runtime.
- Do not reapply legacy project-URL patches.
- Do not push synthetic or real session evidence to the tracker during release verification.
- Do not delete rollback files, archives, or unrelated browser state.
