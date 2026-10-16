# PMIA 0.12.1 — Delivery hardening and release notes

## Scope

This change hardens the existing small Manifest V3 extension. It does not restore the 0.11 Runtime Pilot, introduce Go/native messaging, or add extension permissions. The production path remains sender -> extension service worker -> concurrent answer lanes -> verified provider-rendered user turns.

## Correctness changes

- Sender questions become *seen* only after the service worker acknowledges acceptance. Failed acceptance is retried by a bounded work-triggered timer; repeated DOM scans do not duplicate an in-flight send.
- The router checkpoints each configured answer lane before sending the acceptance receipt. Offline lanes retain unresolved work for later registration. Accepted question IDs are bounded, stored in `chrome.storage.session`, and survive service-worker restarts within the browser session.
- Receiver port registration uses current-port identity. A late disconnect cannot revoke its replacement, and delivery acknowledgements must come from the exact requested port.
- Rendered-turn proof compares provider user-message DOM identities against a pre-submit baseline. Identical old turns no longer count as proof.
- Overlapping Claude selectors no longer duplicate one DOM message.
- A known pre-submit failure (e.g. unavailable writer or send control) can be retried on reconnect. In-flight or post-submit ambiguous outcomes remain unresolved/uncertain and are not automatically resent. **Exactly-once submission cannot be guaranteed** through undocumented external provider web interfaces.
- Auto/Gather/Pause controls acknowledge actual sender-side application. Their settings and held-turn IDs survive same-tab navigation without persisting held question text in those control settings. Missing held source DOM is reported rather than silently dropped.

## Verification completed locally

- 162 deterministic Node tests, including new negative regression tests for receipt failure, duplicate capture, stale-port disconnect, old rendered-turn false proof, offline role checkpoint, and ambiguous retry.
- Module graph/syntax validator.
- Isolated Edge MV3 transport and reconnect smoke with a synthetic known *pre-submit* failure and safe recovery.
- Isolated Edge ChatGPT and Claude provider-fixture composer/write/submit/render proof.
- Original release: optional AutoHotkey v2 bootstrap validation (later removed; current gate validates the PowerShell launcher directly).
- `git diff --check` and active source budget (37 HTML/CSS/JS files, 2,443 lines at the time of this report).

## What this does not prove

Isolated browser fixtures are not a substitute for real authenticated ChatGPT/Claude acceptance after October 2026 provider UI changes. Before relying on the application for a real session, launch a fresh test route and confirm W1 -> W2/W3 provider-rendered proof, both directions of provider selection, navigation and reconnect. Never clear existing browser cookies, sessions, profiles, or unrelated tabs.

## Source and deployment

- Authoritative code: `.worktrees/pmia-simple-runtime`, branch `feature/pmia-simple-runtime`.
- Separate unpacked deployment directory: `runtime/extension/__pmia012_deploy` under the preserved main repository.
- The dirty 0.11 main working directory is intentionally left unchanged.
- GitHub Actions runs Node tests and extension validation. Native Edge fixture smokes and PowerShell launcher validation remain local release gates.

### Safe update

Run `npm test`, `npm run validate`, and `runtime/Validate_Extension_Runtime.ps1` from the feature worktree. After verifying the local release, synchronize only the 0.12 deployment copy. In Edge, reload the correct unpacked extension and the managed PMIA provider tabs **only between sessions**. Preserve the 0.11 source for rollback.

### Known design limit

An external provider can accept a Send click immediately before a page/worker failure. Without an idempotency API, that outcome is inherently uncertain. PMIA favors surfacing uncertainty over silently losing or duplicating a question.


## October 16 final deployment acceptance

- Unpacked deployment folder checked against the source worktree: 80 matching files, zero differences.
- The **deployment folder itself** passed isolated Edge transport/reconnect and both provider fixture tests.
- The Windows launcher was repaired to load the extension before opening its Studio URL. A brand-new scratch Edge profile opened an actual `PMIA Studio` window, confirmed through native UI automation.
- Desktop shortcut: `PMIA Studio (0.12.1)`.
- Live public-provider read-only probe: a clean, unauthenticated ChatGPT page showed a login prompt and no composer; Claude redirected to `/login`. Therefore **authenticated end-to-end sending is not verified** and cannot be represented as a passing production acceptance test.
- The user's existing Edge Stable profile and their dirty 0.11 main worktree were left intact. The PMIA-specific browser profile lives under `%LOCALAPPDATA%\PMInterviewAssistant\EdgeProfile` and is ready for a manual provider sign-in.
- For reproducibility: `node runtime/scripts/run-simple-live-readiness-smoke.mjs`, `runtime/Launch_PMIA_Studio.ps1 -ValidateOnly`, and `runtime/Validate_Extension_Runtime.ps1`.
