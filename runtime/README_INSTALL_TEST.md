# PMIA 0.12.1 — Windows installation and verification

The current PMIA is an unpacked Edge Manifest V3 extension with a small PowerShell launcher. There is **no AutoHotkey requirement** and no native backend. The extension handles question capture, concurrent W2/W3 fan-out, provider-native submit, new rendered user-turn proof, layout, Studio, and Cockpit.

## Start

Open the Windows desktop shortcut **PMIA Studio (0.12.1)** or run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Launch_PMIA_Studio.ps1
```

It loads the verified deployment from `runtime/extension/__pmia012_deploy` in a dedicated persistent Edge profile (`%LOCALAPPDATA%\PMInterviewAssistant\EdgeProfile`), without touching your regular Edge profile or sessions. You can also open Studio from the PMIA extension's toolbar button in that dedicated browser.

## Update and validate

From the clean repository worktree, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

This runs the Node contracts, JavaScript import checks, dry-run PowerShell launcher validation, isolated Edge MV3 transport/reconnect test, and synthetic ChatGPT/Claude composer/submit/render tests. It does **not** sign into providers or send a real prompt.

Do not erase browser profiles or install extra extension copies to upgrade. Keep the deployment directory byte-for-byte synchronized with `runtime/extension` after running the release gate. For full paths, rollback and sign-in requirements, see `runtime/PMIA_LOCAL_DEPLOYMENT.md`.

## Live acceptance

Sign into ChatGPT and Claude inside the dedicated PMIA Edge profile. From Studio create a harmless three-window session (W1 source; W2/W3 equal answer lanes) and verify each answer lane displays a newly rendered copy of the question before using PMIA in a real interview.
