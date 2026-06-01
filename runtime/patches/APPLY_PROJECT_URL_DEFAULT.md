# Apply PM Helper Project URL Default

Use the PowerShell patcher script, not `git apply`.

The hand-written `.patch` file is kept only as reference. It failed twice in local apply due to fragile hunk formatting against the long AHK file. The supported apply path is now:

`runtime/patches/apply-project-url-default.ps1`

## Purpose

Make the main AHK launcher open the configured `PM Interview Helper` Project URL by default instead of generic ChatGPT.

Project URL:

`https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project`

## What the script does

1. Adds:

```ahk
global PM_HELPER_PROJECT_URL := "https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project"
global REVIEW_LAB_PROJECT_URL := ""
```

2. Updates `AutoStartup()` to use `PM_HELPER_PROJECT_URL`.

3. Opens both windows as:

```text
<PM_HELPER_PROJECT_URL>?vb_role=sender
<PM_HELPER_PROJECT_URL>?vb_role=receiver
```

or uses `&vb_role=` if the URL later contains query parameters.

4. Adds helper:

```ahk
UrlWithRole(baseUrl, role)
```

## How to apply locally

From repo root:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "runtime\patches\apply-project-url-default.ps1"
git diff -- runtime\Final_2_Window_Fixed.ahk
```

Commit:

```powershell
git add runtime\Final_2_Window_Fixed.ahk runtime\patches\apply-project-url-default.ps1 runtime\patches\APPLY_PROJECT_URL_DEFAULT.md
git commit -m "feat: open PM Helper Project URL by default"
git push origin main
```

## Do not use

Do not use this anymore:

```powershell
git apply --check runtime\patches\project-url-default.patch
git apply runtime\patches\project-url-default.patch
```

The `.patch` file is reference only.

## Local verification later

Only after Sundar asks for testing:

1. Run `runtime/Final_2_Window_Fixed.ahk`.
2. Press `Alt+R`.
3. Confirm Win1/Win2 open inside the PM Interview Helper Project.
4. Confirm bridge still marks windows as `VB_SENDER` and `VB_RECEIVER`.
