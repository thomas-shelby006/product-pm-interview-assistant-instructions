# PMIA Runtime v0.6.1 Verification

Date: 2026-07-30
Branch under test: `feature/runtime-0.6.1-completion`
Base release: `pmia-runtime-v0.6.0`

## Scope

v0.6.1 keeps the verified v0.6 provider transport unchanged and completes two operational workflows:

1. structured, memory-only interview metadata in Session Studio;
2. a current-runtime post-session Review Studio with exact export pairing and private tracker handoff.

The Review Studio is consolidated into `runtime/Session_Tracker_End_Session.ahk`; no second competing review companion is shipped.

## Automated gate

The complete candidate tree passed:

- Node test suite: **280 passed, 0 failed**;
- JavaScript validation: **60 files checked**;
- main launcher AutoHotkey validation: passed;
- Review Studio AutoHotkey validation: passed;
- `runtime/Validate_Extension_Runtime.ps1`: passed;
- `git diff --check`: passed;
- focused secret-pattern scan: no hits.

The runtime validator ran the full Node suite and JavaScript validation again before validating both active AutoHotkey programs.

## Structured session setup

Tests verify that Session Studio exposes company, target role, interview round, emphasis, avoid-mentioning, answer mode, and additional notes; reads them only at launch/resend; integrates them into the boot prompt; and destroys every control reference when the Studio closes.

Only Edge profile, provider route, and layout preferences remain in `settings.ini`. Resume, Job Description, session metadata, prompts, and answers are not persisted by Session Studio.
## Review control channel

The main launcher now owns a hidden `PMIA_RUNTIME_CONTROL` window registered under `PMIA_RUNTIME_CONTROL_V1`.

Commands share the production implementations:

- command `1`: `ExportActiveSession()`;
- command `2`: `EndActiveSession()`.

`Alt+E` and `Alt+Delete` call those same functions. `Alt+Shift+E` opens or focuses the consolidated Review Studio. The companion does not inject export or shutdown hotkeys and does not compete for a global shortcut.

### Live smoke

The launcher was started with `--control-smoke` from the candidate worktree.

Observed:

- hidden control HWND existed;
- a registered export command posted successfully;
- launcher log recorded `Alt+E ignored: no active interview session`, proving dispatch reached the shared production function;
- Session Studio did not open in control-smoke mode.

The Review Studio was then opened without any managed PMIA browser session. Its native controls showed:

- title: `PM Session Tracker - Review Studio`;
- full Detect / Export and Pair / Push and Open Review Lab / End Session surface;
- precise status: `No complete READY PMIA sender/receiver pair is running.`

Only the two smoke-test AutoHotkey processes were terminated afterward.

## Exact export resolver

Synthetic tests verify:

- one fresh sender and one fresh receiver Markdown export are paired;
- shared PMIA session ID and role/provider headers are validated;
- stale, malformed, duplicate-role, and mismatched-session files fail;
- the resolver writes a structured JSON result and never guesses between ambiguous files.
## Tracker push integration

The push script was exercised against synthetic v0.6 Markdown exports and temporary local repositories.

Verified cases:

- dry run creates the staged session folder before any Git command;
- mixed or mismatched exports fail before tracker state is written;
- Windows PowerShell 5.1 works against a local bare remote;
- `-NoAutoMerge` leaves the pushed session branch available;
- default flow merges to `main` and removes the temporary remote branch;
- numeric session allocation occurs after pulling a newer remote `main`;
- result JSON reports success/failure, source PMIA session, tracker session/folder, relative path, branch, dry-run state, and auto-merge state.

The real tracker repository was not used during release tests.

## Review Studio safety

Only these values persist in `%LOCALAPPDATA%\PMInterviewAssistant\review-settings.ini`:

- tracker repository path;
- browser download directory;
- Review Lab URL.

Company, role, round, mode, PMIA session ID, Resume, Job Description, prompts, and answers are not persisted by the companion.

Review Lab and the local tracker folder open only after a successful structured push result. A failed export pair or tracker push leaves the interview session open.

## Release decision

The candidate is eligible for v0.6.1 integration after:

1. committing the reviewed tree;
2. verifying the exact commit from a clean worktree;
3. reloading Edge Stable from canonical `main`;
4. validating Profile Doctor and the Review Studio on the installed path;
5. pushing `main` and tagging `pmia-runtime-v0.6.1`;
6. removing only assistant-created temporary files and merged worktrees.
