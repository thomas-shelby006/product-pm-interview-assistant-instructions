# File Map

## Root files

- `README.md` — repository overview and setup notes.
- `AI_SYSTEM_CONTEXT.md` — complete system context for an AI reviewer.
- `ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md` — design-of-record: context layers, precedence rules, session setup, fast follow-up protocol, failure modes, and the runtime implementation spec for the AHK/bridge follow-up phases.
- `AHK_PHASE_2_IMPLEMENTATION_PLAN.md` — exact, ready-to-apply runtime changes deferred from the architecture pass (structured dropdown GUI fields + bridge interrupt/supersede). Not uploaded to the Project; for the runtime follow-up only.
- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` — compact custom instructions for the ChatGPT Project.
- `FILE_MAP.md` — this file.

## `project_upload_bundle/` — recommended ChatGPT Project upload set

The condensed, internally consistent set to upload into the PM Interview Helper Project: **1 pasted field + 5 uploaded files**. See `project_upload_bundle/PROJECT_UPLOAD_BUNDLE_MANIFEST.md` for exact setup.

- `PROJECT_UPLOAD_BUNDLE_MANIFEST.md` — what to paste, what to upload, what NOT to upload.
- `00_PROJECT_CORE_INSTRUCTIONS.md` — behavior contract, live-answer rules, truth floor, special tokens, length policy, source precedence.
- `01_CANDIDATE_PROFILE_AND_STORY_BANK.md` — confirmed profile, company contexts, confirmed story bank, prepared answers, banned claims.
- `02_ROUTER_METRICS_DELIVERY.md` — route classifier + answer shapes, metrics trees, spoken delivery.
- `03_SESSION_RUNTIME_AND_CONTEXT.md` — Resume/JD/session metadata, context precedence, fast follow-up, noisy transcript, export/review behavior.
- `04_TESTS_REVIEW_AND_MOCK_LOOP.md` — regression tests, post-session review prompt, mock loop, action tags.

## `project_source_files/` — reference/source (not the preferred upload set)

Detailed source files the upload bundle was condensed from. Keep for history and editing. **Upload the bundle instead of these** to avoid duplication. They contain routing, delivery, story bank, metrics, truth constraints, session setup, export schema, mock playbook, and test prompts.

## `runtime/`

Local runtime files for the two-window interview assistant.

- `Final_2_Window_Fixed.ahk` — main AutoHotkey script.
- `README_INSTALL_TEST.md` — install and manual test checklist.
- `tm_scripts/bridge.user.js` — active bridge userscript.
- `tm_scripts/virtual-scroll.user.js` — active virtual-scroll userscript.
- `tm_update_support/start_tm_update_server.ps1` — optional local update server for Tampermonkey scripts.

## `drafts/`

Working drafts that are **not** uploaded to the ChatGPT Project and are **not** loaded by the runtime. Used for unfinished content that must be reviewed before it can be used live.

- `STORY_BANK_TODO_CONFIRM_WITH_SUNDAR.md` — unfinished failure/conflict story scaffolds with placeholders. Confirm against real experience and fill in, then move the finished version into `project_source_files/PM_INTERVIEW_STORY_BANK_TEMPLATE.md`. Do not upload this file.
- `STORY_BANK_COMPLETION_WORKFLOW.md` — guide for capturing real stories across 11 interview story types (what's tested, questions to answer, safe vs banned claims, target length, how to convert to a live answer). Not uploaded.
- `CLAIM_SAFETY_CHECKLIST.md` — classifies claims as safe / resume-only / confirm-only / banned; run story sentences through it before promoting them into the uploaded story bank. Not uploaded.

## Keep out of this repo

- Old review notes.
- External AI handoff prompts.
- Previous ZIP files.
- Archived unused scripts.
- Coding-interview or frontend-interview content.
