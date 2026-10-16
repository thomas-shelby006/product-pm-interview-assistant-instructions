# PMIA 0.12.1 — Active file map

- `runtime/extension/manifest.json` — Manifest V3 entrypoints and extension permissions.
- `runtime/extension/simple/service-worker.js` — session coordination, role ports, delivery admission, and UI launch.
- `runtime/extension/simple/content-main.js` and `simple/browser-entry.js` — provider page bootstrap and role entry.
- `runtime/extension/simple/adapters/` and provider MAIN-world scripts — vendor-specific reading, writing, submit and render verification.
- `runtime/extension/studio/` — web Session Studio.
- `runtime/extension/cockpit/` — compact controls, diagnostics, and exports.
- `runtime/extension/tests/simple-*.test.js` — focused regression tests.
- `runtime/extension/testing/` — synthetic transport fixtures.
- `runtime/scripts/run-simple-isolated-smoke.mjs` — real isolated Edge MV3 transport/reconnect smoke.
- `runtime/scripts/run-simple-provider-fixture-smoke.mjs` — isolated simulated provider composer/submit/render smoke.
- `runtime/scripts/run-simple-live-readiness-smoke.mjs` — read-only public provider login/composer readiness probe.
- `runtime/Launch_PMIA_Studio.ps1` — single Windows bootstrap; isolated Edge profile and stable verified extension folder.
- `runtime/Validate_Extension_Runtime.ps1` — local release gate, including launcher validation. Does not require AutoHotkey.
- `runtime/PMIA_LOCAL_DEPLOYMENT.md` — deployment, authentication and acceptance instructions.
- `project_source_files/`, `project_upload_bundle/`, `review_lab_project/`, and `templates/` — interview behavior, truth and review sources.

For authoritative operating rules, see `docs/PMIA_REWORK_OPERATING_RULES.md`. For the superseded 0.11 platform, use Git history or the preserved legacy backup branch. Older `docs/PMIA_CURRENT_SYSTEM_*` artifacts document historical versions and should not be used as the active runtime map.
