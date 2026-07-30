# PMIA Runtime v0.6.1 Verification

Final verification date: 2026-07-31
Branch under test: `feature/runtime-0.6.1-completion`
Base release: `pmia-runtime-v0.6.0`

## Scope

v0.6.1 keeps the verified v0.6 provider transport unchanged and completes two operational workflows:

1. structured, memory-only interview metadata in Session Studio;
2. a current-runtime post-session Review Studio with exact export pairing and private tracker handoff.

The Review Studio is consolidated into `runtime/Session_Tracker_End_Session.ahk`; no second competing review companion is shipped.

## Automated gate

The complete candidate tree passed:

- Node test suite: **303 passed, 0 failed**;
- JavaScript validation: **62 files checked**;
- main launcher AutoHotkey validation: passed;
- Review Studio AutoHotkey validation: passed;
- `runtime/Validate_Extension_Runtime.ps1`: passed;
- `git diff --check`: passed;
- focused secret-pattern scan: no hits.

The runtime validator ran the full Node suite and JavaScript validation again before validating both active AutoHotkey programs.

## Additional release defects found and fixed

The final review found three issues beyond the original 0.6.1 checklist:

1. two validation tests described an unimplemented direct extension-control protocol instead of the approved Review Studio -> launcher -> browser-command path; the tests now verify the maintained end-to-end architecture and the export command remains outside durable serialization;
2. the outbound transcript cache keyed final questions only by normalized text for 30 seconds, which could suppress a legitimate repeated interviewer question; finals are now keyed by provider turn identity while duplicate copies of the same turn remain suppressed;
3. Claude's first-run `Create files and artifacts` promotional dialog could cover the composer and hold lifecycle at REGISTERED until timeout; the Claude adapter now dismisses only that strict allow-listed onboarding dialog and refuses unknown dialogs.

Two incomplete cache rollback call sites were also corrected to preserve turn identity after failed preview/final delivery.

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

A fresh ChatGPT sender -> Claude receiver session was launched from the exact 0.6.1 worktree after reloading the unpacked extension.

Observed:

- Profile Doctor reported version `0.6.1`, exact path match, and `OK` for Edge Stable profile `Default`;
- sender reached READY, then the receiver moved from REGISTERED to READY in six seconds;
- Review Studio detected exactly one complete READY pair: `pmia_20260731_033400_9576`;
- Review Studio remained foregrounded while **Export and Pair** posted through the hidden launcher control window;
- launcher log recorded `Alt+E browser export command triggered`;
- one fresh sender Markdown and one fresh receiver Markdown were created and paired automatically;
- both files carried the same PMIA session ID and the correct `sender / chatgpt` and `receiver / claude` headers;
- neither export contained Resume or Job Description markers, and neither contained a Unicode replacement character;
- Review Studio reported `Paired fresh sender and receiver Markdown exports.`;
- **End Session** posted through the same control channel, the launcher logged `Alt+Delete exit requested`, both managed PMIA tabs closed, and the launcher exited;
- unrelated Edge tabs remained open.

The prior no-session control-smoke case also remains covered by automated and manual validation: the hidden control bridge starts without Session Studio and reports the precise no-active-session outcome.

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

## Merged-main and installed-runtime verification

Canonical `main` was fast-forwarded from v0.6.0 through the complete 0.6.1 feature history. The full validator then passed from the canonical Windows checkout, including the CRLF-specific launcher verification that exposed and fixed one final test portability defect.

The two compatibility junctions used by the installed Edge profile now resolve directly to canonical `main/runtime/extension`. Their manifest hashes match canonical main. The PMIA extension card was reloaded after the junction change, and Profile Doctor reported:

- profile: `Default` (`Profile 1`);
- extension version: `0.6.1`;
- registered compatibility path: present;
- resolved source: canonical `main/runtime/extension`;
- path match: `True`;
- issue: `OK`.

No PMIA interview or Review Studio process remained after the live smoke. Temporary extension-management windows were closed and unrelated Edge tabs remained open.

## Release decision

The exact 0.6.1 tree is approved for publication as `pmia-runtime-v0.6.1` after:

- 303/303 automated tests passed;
- 62 JavaScript files validated;
- both active AutoHotkey programs validated;
- the exact Review Studio export/pair/shutdown path passed live;
- merged canonical `main` passed the complete gate;
- canonical Edge reload and Profile Doctor passed;
- diff, secret-pattern, redaction, and cleanup-boundary checks passed.

The legacy launcher, session tracker history, Tampermonkey scripts, update support, archives, user browser profile, and unrelated tabs remain preserved.
