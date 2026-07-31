# Next PMIA Setup Tasks

Last updated: 2026-08-01

This file tracks the isolated PMIA 0.7.0 runtime candidate only. The original checkout, canonical `main`, legacy runtime, and private session tracker must remain unchanged unless a later instruction explicitly authorizes publication or tracker writes.

## Read first

1. `docs/CURRENT_STATUS_DASHBOARD.md`
2. `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
3. `runtime/README_INSTALL_TEST.md`
4. `docs/SESSION_TRACKER_SETUP.md`
5. `docs/superpowers/specs/2026-08-01-pmia-0.7-reliability-coherence-design.md`

## Candidate completion sequence

1. Finish source, test, and active-documentation changes without intermediate test runs.
2. Inspect the exact worktree diff, encoding, and unrelated-file boundary.
3. Run the single complete validator from `product-pm-interview-assistant-improvement`.
4. Resolve any failure from exact output and rerun the same complete gate.
5. Use synthetic browser evidence for material live-runtime claims where the candidate can be loaded without altering unrelated browser state.
6. Verify the original checkout remains clean and still points to canonical `main`.
7. Commit the verified candidate branch locally. Do not push, merge, tag, retarget the installed extension, close issues, or delete worktrees without a separate instruction.

## Operational checks

- Session Studio shows the selected Edge profile, route, live runtime health, Check Live, Run Preflight, Fast Repair, structured session fields, Resume, Job Description, notes, layout, and launch controls.
- Check Live uses the production F11 counterpart preflight in both exact managed windows.
- Fast Repair uses the current in-memory context and existing `RepairLaunch()` / `RunManagedLaunch(true)` path.
- Registry and role logs use `chrome.storage.session`; no transcript or answer log falls back to local storage.
- Startup purges only legacy `pmia_log_*` local records.
- End-session and final-tab closure clear registry, pending final, sequence state, and both role logs.
- Dead registrations are replaced only after an active owner probe fails.
- Receiver wake recovery never activates a tab or focuses Edge.
- Schema 2.1 exports preserve tracker headers and include safe review summaries with the full setup event redacted.

## Do not do

- Do not enable Edge Beta, Tampermonkey, or the fixed launcher beside the active runtime.
- Do not persist real interview context during release verification.
- Do not push synthetic or real evidence to the private tracker.
- Do not change browser preference files, unrelated Edge tabs, rollback assets, canonical main, or the original checkout.
