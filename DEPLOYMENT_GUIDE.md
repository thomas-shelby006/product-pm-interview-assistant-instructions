# PMIA 0.12.1 — Deployment guide

The current application is a Microsoft Edge unpacked extension, launched by Windows PowerShell or the browser's **Open PMIA Studio** toolbar action. There is no AutoHotkey requirement.

**Installed runtime**: `runtime/extension/__pmia012_deploy` under the original repository directory. It is an ignored deployment copy, not a second source of truth. **Authoritative source**: `runtime/extension` in the clean main/feature worktrees.

**Start** using the existing `PMIA Studio (0.12.1)` desktop shortcut, or:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Launch_PMIA_Studio.ps1
```

The launcher uses an isolated persistent Edge profile under `%LOCALAPPDATA%\PMInterviewAssistant\EdgeProfile`. It does not clear or migrate the existing regular Edge cookies, logins, sessions, windows or extensions.

**Validate source** before deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

This runs the 0.12.1 unit/contract tests, extension graph/syntax validation, dry-run PowerShell launcher validation, and two isolated Edge smokes. **Do not call the system fully authenticated-provider-tested until signed-in W1→W2/W3 acceptance is observed.**

When no PMIA interview session is active, synchronize the verified source extension to the stable unpacked deployment folder and reload the extension/PMIA-managed tabs between sessions. Never rewrite `Preferences` or `Secure Preferences`, copy authentication or reset unrelated profiles. Details: `runtime/PMIA_LOCAL_DEPLOYMENT.md`, `runtime/README_INSTALL_TEST.md`, and `docs/PMIA_0.12.1_HARDENING.md`.

The previous 0.11 architecture is preserved in Git history and the legacy backup worktree; its AutoHotkey launch/manual is not the active deployment path.
