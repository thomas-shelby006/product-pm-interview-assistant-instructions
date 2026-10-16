# PMIA local deployment (Windows Edge)

The installed 0.12.1 unpacked extension is synchronized to the preserved repository's `runtime/extension/__pmia012_deploy` folder. Its actual Edge extension ID on this machine is `ldhkaojbodiibhhdllkiffbcfhofiimk`.

Launch with:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime/Launch_PMIA_Studio.ps1
```

AutoHotkey is not used. Open Studio from the existing desktop shortcut or the **Open PMIA Studio** button in the dedicated browser's extension toolbar. Windows shortcut key assignment is optional and can be configured on the desktop shortcut.

The launcher uses its own persistent Edge user data under `%LOCALAPPDATA%\PMInterviewAssistant\EdgeProfile`. This does not migrate cookies or sign-in from regular Edge and intentionally does not affect existing profiles, tabs, extensions, or authentication. Sign into both providers manually in that dedicated profile, then launch Studio and test a harmless question before use. **The isolated test profile is not already authenticated.**

The extension is loaded by Edge command-line switches, so moving its folder changes the generated ID. If moving to another installation path, verify its ID with the isolated transport smoke before launching, and use `-ExtensionDir` and `-ExtensionId` explicitly.

Validation:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime/Launch_PMIA_Studio.ps1 -ValidateOnly
$env:PMIA_EXTENSION_DIR = Join-Path (Split-Path (& git rev-parse --path-format=absolute --git-common-dir) -Parent) 'runtime\extension\__pmia012_deploy'
node runtime/scripts/run-simple-isolated-smoke.mjs
node runtime/scripts/run-simple-provider-fixture-smoke.mjs
```


## Cold-start verification

The launcher waits until the Edge toolbar exposes the PMIA extension before opening the Studio URL. This avoids the first-run network-error tab observed when Edge attempted an extension URL before loading an unpacked extension. An isolated fresh-profile launch was verified to display `PMIA Studio`.

## Live provider acceptance status

The real public URLs were checked in a disposable, **unauthenticated** Edge profile on October 16, 2026. Both required sign-in and had no usable chat composer. No real user messages were sent. Use the desktop shortcut, sign into both services in the dedicated PMIA Edge profile, and verify a harmless W1 question arrives as a new rendered W2 and W3 user turn before a real interview session.
