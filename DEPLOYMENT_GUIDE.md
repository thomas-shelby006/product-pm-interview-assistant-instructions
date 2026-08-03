# PM Interview Assistant — Local Browser Deployment Guide

This guide deploys the verified PMIA runtime from the stable local deployment tree. It does not require a Git worktree and does not edit Microsoft Edge preference files directly.

## Final local layout

```text
C:\Users\Sundar\Documents\PMIA Deployment\
├── archive\
│   └── pmia-0.6.1-installed\   # immutable rollback copy
├── current\                     # verified current release
└── DEPLOYMENT_INVENTORY.json    # authoritative local inventory
```

The current unpacked extension path is:

```text
C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\extension
```

The current launcher is:

```text
C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\Final_2_Window_Extension.ahk
```

## Before changing Edge

1. Close any active PMIA interview session with `Alt+Delete`.
2. Confirm no PMIA sender, receiver, dashboard, or Session Studio window remains.
3. Leave ordinary Edge tabs open if needed; the installation itself is performed in `edge://extensions`.
4. Open `deployment-manifest.json` in the `current` directory and confirm the expected version and source commit.
5. Run package verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\Test-PMIADeployment.ps1" `
  -PackageRoot "C:\Users\Sundar\Documents\PMIA Deployment\current" `
  -ExpectedKind current
```

The command must return JSON with `"ok": true`.

## Recommended readiness and Edge workflow

Run the generated readiness report first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\Get-PMIADeploymentReadiness.ps1" `
  -DeploymentRoot "C:\Users\Sundar\Documents\PMIA Deployment" `
  -SourceRoot "C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions" `
  -ProfileDirectory "Default"
```

Required package fields are `current.ok=true`, `archive.ok=true`, and all prerequisites available. A path-matched card that still reports the older cached version should produce only `EXTENSION_VERSION_MISMATCH` and `readyForManualEdgeReload=true`. Any checksum, source, path, prerequisite, or archive issue is a hard stop.

Then use the reload-first helper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\Open-PMIAEdgeDeployment.ps1" `
  -DeploymentRoot "C:\Users\Sundar\Documents\PMIA Deployment" `
  -ProfileDirectory "Default" `
  -OpenEdge
```

The helper verifies both packages and prerequisites, copies the exact current extension path, opens `edge://extensions`, and returns either `action=reload` or `action=load_unpacked`. It never edits Edge `Preferences`, `Secure Preferences`, registry policy, cookies, or session data.

## Activate the current extension in Microsoft Edge

1. In the Edge profile used for interviews, open `edge://extensions`.
2. Turn on **Developer mode**.
3. Find the existing **PM Interview Dual-Provider Runtime** entry.
4. Select **Reload** first. The retained compatibility path resolves to the stable `PMIA Deployment\current` package.
5. Confirm the card says **PM Interview Dual-Provider Runtime** and version **0.10.3**.
6. If the card is missing, Reload fails, or Edge remains on an older version, select **Load unpacked** and choose this exact directory:

```text
C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\extension
```

7. If Edge shows two PMIA cards, keep both temporarily until the current card passes Preflight, then remove only the old card.

Before Reload, Profile Doctor may report `pathMatches=True` with `EXTENSION_VERSION_MISMATCH`; that means the path is correct but Edge still caches the old manifest. After Reload it must report version 0.10.3 and `issueCode=OK`.

Do not manually edit `Preferences` or `Secure Preferences`. Do not use command-line `--load-extension` with the normal profile.

## Validate the loaded extension

Run Profile Doctor against the current deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\Browser_Profile_Doctor.ps1" `
  -UserDataRoot "$env:LOCALAPPDATA\Microsoft\Edge\User Data" `
  -ExpectedExtensionPath "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\extension" `
  -ProfileDirectory "Default" `
  -BrowserName "EDGE"
```

The selected row must report:

- `version` = `0.10.3`
- `pathMatches` = `True`
- `issueCode` = `OK`

Then start the launcher by double-clicking:

```text
C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\Final_2_Window_Extension.ahk
```

In Session Studio:

1. Select the same Edge profile.
2. Select the required sender and receiver providers.
3. Select **Preflight**.
4. Confirm the health line says PMIA 0.10.3 is registered from the expected path.
5. Launch a disposable session without sensitive Resume/JD content.
6. Confirm sender, receiver, and Runtime Pilot Dashboard all reach READY.
7. Run **Check Live** or press `Alt+H`.
8. In Runtime Pilot, run the self-test and the 12-check transport drill.
9. Confirm no role conflict, path mismatch, version mismatch, sequence gap, or sender-outbox warning remains.
10. End the disposable session with `Alt+Delete`.

## Remove the old browser entry

Only after all current-version checks pass:

1. Return to `edge://extensions`.
2. If the old 0.6.1 card still exists as a separate entry, select **Remove** on that old card.
3. If there is one card and it already points to the current deployment path, do not remove it.
4. Run Profile Doctor again and require exactly one path-matched PMIA entry for the selected profile.

Removing the old Edge entry does not delete the rollback archive.

## Roll back to the archived installed version

Use rollback only when the current version fails a verified operational check.

1. End the current PMIA session.
2. Open `edge://extensions` in the interview profile.
3. Remove or disable the current unpacked PMIA entry.
4. Select **Load unpacked**.
5. Choose:

```text
C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed\runtime\extension
```

6. Confirm version 0.6.1.
7. Start the archived launcher:

```text
C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed\runtime\Final_2_Window_Extension.ahk
```

8. Run Profile Doctor and Preflight against the archive path.
9. Keep the current package unchanged for diagnosis; do not overwrite either package.

## Common deployment failures

### `EXTENSION_PATH_MISMATCH`

The selected Edge profile still points to another unpacked directory. Open `edge://extensions`, load or reload the exact `current\runtime\extension` directory, and run Profile Doctor again.

### `EXTENSION_VERSION_MISMATCH`

The card has not reloaded the current manifest. Select **Reload** on the path-matched PMIA card, wait a few seconds, and rerun Profile Doctor.

### Browser executable missing

The launcher now ignores a saved executable that no longer exists and falls back to the installed executable for the selected browser family. Open **Browser settings** only when using a deliberate custom browser installation.

### Profile Doctor shows no registration

Verify that Profile Doctor is using the same profile directory shown by Edge. The normal interview setting is `Default`, whose display name may appear as `Profile 1`.

### Two PMIA extension cards remain

Compare versions and source paths. Remove only the card that does not point to `PMIA Deployment\current\runtime\extension` after the current card passes Preflight.

## Package integrity commands

Verify current:

```powershell
& "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\Test-PMIADeployment.ps1" `
  -PackageRoot "C:\Users\Sundar\Documents\PMIA Deployment\current" -ExpectedKind current
```

Verify rollback archive:

```powershell
& "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\Test-PMIADeployment.ps1" `
  -PackageRoot "C:\Users\Sundar\Documents\PMIA Deployment\archive\pmia-0.6.1-installed" `
  -ExpectedKind installed-archive
```

Any checksum mismatch is a hard stop. Rebuild the package from the verified source instead of editing packaged files in place.

Regenerate the authoritative inventory after final package verification, browser diagnosis, and cleanup:

```powershell
& "C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\scripts\New-PMIADeploymentInventory.ps1" `
  -DeploymentRoot "C:\Users\Sundar\Documents\PMIA Deployment" `
  -SourceRoot "C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions" `
  -ProfileDirectory "Default" `
  -EvidenceDirectory "<final evidence directory>"
```

## PMIA 0.10.4 four-lane verification

Release status is reported through four independent lanes: source/package, deterministic browser, provider canary, and normal-profile activation. Package promotion requires the first two lanes. Final activation additionally requires a passed provider canary and Profile Doctor confirmation for the expected normal-profile path and version.

A provider canary marked `limited` preserves its exact reason and diagnostic evidence. It is not a pass. Use a real-provider normal-profile acceptance flow before declaring activation ready.

Use Reload on the existing unpacked extension card first. Use Load unpacked only when the card is missing or resolves to the wrong path. Never edit Edge Preferences or Secure Preferences directly.
