# Edge Beta Runtime Backup Notes

Timestamp: 2026-06-01 00:11 Asia/Calcutta

Purpose: archive the current PM Interview Helper / Edge Beta / AHK / Tampermonkey setup before disabling or replacing any installed Edge Beta scripts.

## Source paths inspected

- `C:\Users\Sundar\Documents\PM Interview Assistant`
- `C:\Users\Sundar\Documents\PM Interview Assistant\runtime`
- `C:\Users\Sundar\Documents\PM Interview Assistant\tm_scripts`
- `C:\Users\Sundar\Documents\Interview Automation\userscripts`
- `C:\Users\Sundar\Documents\Interview Automation\pm_interview_assistant_revision3_files\pm_interview_revision3_files`
- Repository latest runtime files under `runtime/`

## Archived current local setup

- `current_local_pm_interview_assistant\Final_2_Window_Fixed.ahk`
- `current_local_pm_interview_assistant\runtime\Final_2_Window_Fixed.ahk`
- `current_local_pm_interview_assistant\runtime\tm_scripts\bridge.user.js`
- `current_local_pm_interview_assistant\runtime\tm_scripts\virtual-scroll.user.js`
- `current_local_pm_interview_assistant\tm_scripts\bridge.user.js`
- `current_local_pm_interview_assistant\tm_scripts\virtual-scroll.user.js`

These appear to be the current local PM Interview Assistant runtime and Tampermonkey script copies from `C:\Users\Sundar\Documents\PM Interview Assistant`.

## Archived duplicate candidates

- `duplicate_candidates\interview_automation_userscripts\bridge.user.js`
- `duplicate_candidates\interview_automation_userscripts\virtual-scroll.user.js`
- `duplicate_candidates\interview_automation_userscripts\focus.user.js`
- `duplicate_candidates\revision3_files\Final_2_Window_Fixed.ahk`
- `duplicate_candidates\revision3_files\bridge.user.js`
- `duplicate_candidates\revision3_files\virtual-scroll.user.js`
- `duplicate_candidates\revision3_files\focus.user.js`

These appear to be older or duplicate helper scripts from the `Interview Automation` folders. They were archived as candidates only; no installed Edge Beta scripts were disabled or deleted during this archive step.

## Archived latest repo versions for comparison

- `repo_latest_runtime\runtime\Final_2_Window_Fixed.ahk`
- `repo_latest_runtime\runtime\tm_scripts\bridge.user.js`
- `repo_latest_runtime\runtime\tm_scripts\virtual-scroll.user.js`

These are the latest runtime files from the repository checkout at the time of backup.

## Active installed scripts

Active Edge Beta Tampermonkey scripts were not inspected or exported yet. Per the safety workflow, installed scripts must not be changed until this archive is safely pushed to GitHub.

## Safety notes

- Old setup was archived before disabling or replacing installed scripts.
- No browser profile folders, cookies, ChatGPT session data, credentials, tokens, `.git`, `node_modules`, cache folders, or unrelated large runtime folders were archived.
- Edge Beta Tampermonkey export was not completed in this step because GitHub push was blocked by credentials; installed scripts should be exported before any browser-side changes.
