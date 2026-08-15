# PMIA 0.11.0 Direct-Source Deployment Guide

The canonical Git repository is both the development source and the local deployment source:

```text
C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions
```

The unpacked Edge extension directory is:

```text
C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\extension
```

The launcher is:

```text
C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\Final_2_Window_Extension.ahk
```

## Updating an existing installation

1. Finish or end any active PMIA session.
2. Run the complete validator from the repository root.
3. Open `edge://extensions`.
4. Select **Reload** on the PMIA card.
5. Reload any already-open managed provider tabs, or start a fresh PMIA session.
6. Run Session Studio **Preflight**.

**Reload** is the normal update path.

## First installation

1. Open `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the exact `runtime\extension` directory shown above.
5. Confirm the card is **PM Interview Dual-Provider Runtime** and displays version **0.11.0**.

**Load unpacked** is needed only when the card is missing or Edge points to a different directory.

## Profile verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\Browser_Profile_Doctor.ps1" `
  -ExpectedExtensionPath "C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\extension" `
  -ProfileDirectory Default `
  -BrowserName "Microsoft Edge Stable"
```

The required result is:

```text
version      0.11.0
pathMatches  True
issueCode    OK
```

`EXTENSION_VERSION_MISMATCH` means Edge has not reloaded the current source. `EXTENSION_PATH_MISMATCH` means the card was loaded from another directory.

## Complete validation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\Validate_Extension_Runtime.ps1"
```

Do not edit Edge `Preferences` or `Secure Preferences`. Do not use registry policy or `--load-extension` to bypass the normal unpacked-extension workflow.

## Session tracker

The Review Studio default is:

```text
C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\.local\session-tracker
```

This private data directory is ignored by the application Git repository.
