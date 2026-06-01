# Apply PM Helper Project URL Default Patch

This patch is intentionally stored separately instead of overwriting the full AHK file through GitHub UI/API.

Patch file:

`runtime/patches/project-url-default.patch`

## Purpose

Make the main AHK launcher open the configured `PM Interview Helper` Project URL by default instead of generic ChatGPT.

Project URL:

`https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project`

## What the patch does

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

or uses `&vb_role=` if the URL already contains query parameters.

4. Adds helper:

```ahk
UrlWithRole(baseUrl, role)
```

## How to apply locally

From repo root:

```powershell
git apply --check runtime\patches\project-url-default.patch
git apply runtime\patches\project-url-default.patch
```

Then inspect:

```powershell
git diff -- runtime\Final_2_Window_Fixed.ahk
```

Commit:

```powershell
git add runtime\Final_2_Window_Fixed.ahk runtime\patches\project-url-default.patch runtime\patches\APPLY_PROJECT_URL_DEFAULT.md
git commit -m "feat: open PM Helper Project URL by default"
git push origin main
```

## Local verification later

After Edge Beta is logged into the correct ChatGPT account/workspace:

1. Run `runtime/Final_2_Window_Fixed.ahk`.
2. Press `Alt+R`.
3. Confirm Win1/Win2 open inside the PM Interview Helper Project.
4. Confirm bridge still marks windows as `VB_SENDER` and `VB_RECEIVER`.
