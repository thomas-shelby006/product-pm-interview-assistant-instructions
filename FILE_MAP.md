# File Map

## Root files

- `README.md` — repository overview and setup notes.
- `AI_SYSTEM_CONTEXT.md` — complete system context for an AI reviewer.
- `ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md` — design-of-record: context layers, precedence rules, session setup, fast follow-up protocol, failure modes, and the runtime implementation spec for the AHK/bridge follow-up phases.
- `AHK_PHASE_2_IMPLEMENTATION_PLAN.md` — exact, ready-to-apply runtime changes deferred from the architecture pass (structured dropdown GUI fields + bridge interrupt/supersede). Not uploaded to the Project; for the runtime follow-up only.
- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` — compact custom instructions for the ChatGPT Project.
- `FILE_MAP.md` — this file.

## `project_source_files/`

Detailed source files for the ChatGPT Project. Upload these files into the PM Interview Helper Project. They contain routing, delivery, story bank, metrics, truth constraints, session setup, export schema, mock playbook, and test prompts.

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

## Keep out of this repo

- Old review notes.
- External AI handoff prompts.
- Previous ZIP files.
- Archived unused scripts.
- Coding-interview or frontend-interview content.
