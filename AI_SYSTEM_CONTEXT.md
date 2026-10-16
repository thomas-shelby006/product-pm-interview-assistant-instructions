# PMIA 0.12.1 — Current system context

The application is an unpacked Microsoft Edge Manifest V3 extension; there is **no AutoHotkey runtime or native message bridge**. The only Windows helper is `runtime/Launch_PMIA_Studio.ps1`, which starts a dedicated Edge profile and opens the extension's Session Studio after extension readiness is confirmed. The extension toolbar can also open Studio directly.

The authoritative active source is `runtime/extension/`; the persistent unpacked deployment copy is `runtime/extension/__pmia012_deploy` under the separately preserved main repository checkout. The `feature/pmia-simple-runtime` and `main` branches have clean dedicated worktrees. The original, dirty 0.11 checkout is preserved on `backup/pmia-legacy-011-wip-20261016`. Never reset or overwrite that checkout or its private state.

The browser extension's service worker owns session/window registration, durable sender admission, per-role delivery checkpoints, concurrent W2/W3 fan-out, small diagnostic metadata, and Studio/Cockpit messaging. Provider content scripts own observation, native composer write/submit, new rendered-user-turn proof, and role-specific FIFO. **W2 and W3 have equal production priority.** Ambiguous post-submit outcomes are held for inspection rather than blindly replayed.

Provider authentication, cookies, Resume, JD and interview transcript data remain out of Git; do not copy the user's browser profile into test automation. An isolated Edge fixture test is not equivalent to a signed-in end-to-end provider test.

Read `README.md`, `runtime/README_INSTALL_TEST.md`, and `docs/PMIA_REWORK_OPERATING_RULES.md` for current operation, safety, and testing. The old 0.11 architecture and documentation remain accessible in Git history and the legacy backup branch.
