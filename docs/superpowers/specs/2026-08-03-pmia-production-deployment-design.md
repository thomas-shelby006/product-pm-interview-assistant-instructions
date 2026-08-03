# PMIA Production Deployment Design

## Objective

Promote the verified PMIA candidate into one canonical local `main`, preserve the browser-installed 0.6.1 runtime as the only rollback archive, and create one extracted current deployment tree that can be loaded into Microsoft Edge without relying on a development worktree.

## Fixed decisions

- The currently registered Edge profile is `Default`.
- The installed extension is version `0.6.1`.
- Its registered junction resolves to the original checkout at `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\runtime\extension`.
- That installed tree remains unchanged until its archive is copied, hashed, and independently verified.
- The verified candidate is promoted locally only; no push, tag, PR, publication, or cloud deployment is authorized.
- The final deployment root is `C:\Users\Sundar\Documents\PMIA Deployment`.
- The final deployment root contains exactly `archive\pmia-0.6.1-installed` and `current` plus a top-level inventory file.
- Historical dirty worktree content may be removed only after the exact disposition manifest proves its maintained replacement is present in the promoted commit.

## Architecture

The source repository remains the development authority. Deployment scripts create immutable, checksum-bound copies outside Git: one rollback snapshot from the installed source and one current package from the exact clean promoted commit. The package is self-contained: launcher, extension, profile doctor, validation scripts, review companion, active documentation, source commit, release metadata, and SHA-256 inventory travel together.
## Deployment package contract

`current` is built through a temporary sibling directory and is renamed into place only after verification. It includes `runtime`, `project_upload_bundle`, `review_lab_project`, `templates`, selected active root documents, `package.json`, `DEPLOYMENT_GUIDE.md`, `deployment-manifest.json`, and `checksums.sha256`. It excludes Git metadata, historical archives, evidence, drafts, worktrees, task temp, logs, browser profiles, and secrets.

The archive records the registered and resolved extension paths, installed version, source commit when available, profile directory, extension ID, file count, byte count, and checksums. It contains the complete installed repository snapshot needed to restore the launcher and unpacked extension together.

## Safety and cleanup

Cleanup is allowlist-driven and occurs only after the current deployment verifies. It removes registered auxiliary worktrees, assistant-created PMIA task temp, superseded PMIA evidence directories, the obsolete 0.10 evidence folder, and the temporary diagnostic monitor. It does not remove the canonical repository, `PMIA Deployment`, browser profiles, settings, session tracker, unrelated repositories, or Remote Desktop Commander.

The old extension junction is retained until the user loads `PMIA Deployment\current\runtime\extension` in Edge. The deployment guide then instructs the user to remove or disable the old 0.6.1 unpacked entry so only one PMIA extension remains enabled.

## Verification

The candidate must pass the complete repository gate, targeted deployment-script tests, checksum verification, worktree integration readiness, and a fresh isolated Edge smoke. After local `main` promotion, the decisive gate is rerun from `main`; the deployment copy is then validated independently. Final inventory must show one archive, one current tree, no active PMIA worktrees, and no assistant-created PMIA temp/evidence directories outside the deployment root.

## Twenty-five production-readiness cycles

1. Repository and worktree integrity.
2. Installed version and registered-path identity.
3. Browser executable configuration recovery.
4. Browser user-data-root configuration recovery.
5. Profile Doctor path and version reporting.
6. Manifest and release-version coherence.
7. Deployment allowlist completeness.
8. Deployment exclusion/privacy boundary.
9. Deterministic deployment metadata.
10. SHA-256 inventory generation.
11. Archive source identity.
12. Archive verification before promotion.
13. Atomic current-package staging.
14. Rollback instructions and archive usability.
15. Launcher self-contained path resolution.
16. Extension resource reachability and packaging.
17. AutoHotkey launcher/review/platform validation.
18. Durable final admission and sender outbox.
19. Pause, accumulation, resume, and rollback.
20. Dashboard resync and control projection.
21. Direct/fallback transport and drill.
22. Storage, privacy, export, and end-session cleanup.
23. Worktree integration and disposition proof.
24. Fresh isolated browser release evidence.
25. Promoted-main, deployment-copy, and final filesystem inventory.
