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

## Load the current extension in Microsoft Edge

1. In the Edge profile used for interviews, open `edge://extensions`.
2. Turn on **Developer mode**.
3. Find the existing **PM Interview Dual-Provider Runtime** entry. Record its version and leave it enabled until the new entry has loaded successfully.
4. Select **Load unpacked**.
5. Choose this directory, not its parent:

```text
C:\Users\Sundar\Documents\PMIA Deployment\current\runtime\extension
```

6. Confirm the loaded card says **PM Interview Dual-Provider Runtime** and version **0.10.1**.
7. Select **Reload** on the new card once.
8. If Edge reuses the same extension ID and replaces the old path, verify the card's inspected source points to the `PMIA Deployment\current` path.
9. If Edge shows two PMIA cards, keep both temporarily until the current one passes preflight.

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

- `version` = `0.10.1`
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
4. Confirm the health line says PMIA 0.10.1 is registered from the expected path.
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
