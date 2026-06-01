# Codex Next Setup Tasks

Use this file when Codex takes over local setup. Do not redesign the system.

## Read first

1. `docs/CURRENT_STATUS_DASHBOARD.md`
2. `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
3. `runtime/patches/APPLY_PROJECT_URL_DEFAULT.md`
4. `review_lab_project/README.md`

## Task 1 — Apply PM Helper Project URL default patch

From repo root:

```powershell
git checkout main
git pull --ff-only origin main
git apply --check runtime\patches\project-url-default.patch
git apply runtime\patches\project-url-default.patch
git diff -- runtime\Final_2_Window_Fixed.ahk
```

Expected behavior after patch:

- `PM_HELPER_PROJECT_URL` is hardcoded to the PM Interview Helper Project URL.
- `REVIEW_LAB_PROJECT_URL` remains blank.
- `AutoStartup()` opens Win1 and Win2 using PM Helper Project URL plus `vb_role=sender` / `vb_role=receiver`.

Commit:

```powershell
git add runtime\Final_2_Window_Fixed.ahk runtime\patches\project-url-default.patch runtime\patches\APPLY_PROJECT_URL_DEFAULT.md
git commit -m "feat: open PM Helper Project URL by default"
git push origin main
```

Do not run full smoke test in this task unless Sundar asks.

## Task 2 — Create ChatGPT Review Lab Project

Project name:

`PM Interview Review Lab`

Use instructions from:

`docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md`

Optional source/prompt file:

`templates/session-tracker/review_lab_prompt.md`

Rules:

- Do not upload runtime scripts.
- Do not upload archives.
- Do not upload main PM Interview Helper bundle files.
- Do not upload tracker session logs as permanent Project source.
- Session files should be attached/pasted per review session.

## Task 3 — Fix Edge Beta ChatGPT Project access

Edge Beta must use the account/workspace that can open:

`https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project`

Do not touch Vivaldi unless needed to copy the working Project URL.

## Stop conditions

Stop and report if:

- patch does not apply cleanly,
- Edge Beta cannot access the PM Interview Helper Project after account switch,
- Review Lab Project creation is blocked by account/project limits,
- any UI step asks for payment, workspace switch, or irreversible changes.

## Final report format

Report:

1. whether patch was applied and pushed,
2. commit SHA,
3. whether Review Lab Project was created,
4. whether Edge Beta account/project access is fixed,
5. what was intentionally not tested,
6. remaining next step.
