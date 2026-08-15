# PMIA 0.11.0 — Install, Operate, and Verify

## Direct source

The canonical repository is the runtime source. Load `runtime/extension` directly in Microsoft Edge Developer mode and run `runtime/Final_2_Window_Extension.ahk`.

## Installation and update

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Use **Load unpacked** for the first installation and select `runtime/extension`.
4. After source changes, run the complete validator and select **Reload** on the PMIA card.
5. Run Session Studio Preflight and require PMIA 0.11.0 from the expected repository path.

## Complete gate

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The gate runs the Node test suite, JavaScript reachability validation, main-launcher validation, Review Studio validation, and runtime-platform validation.

## Runtime expectations

Provisional transcript updates are disposable. Every authoritative final is accepted durably before sender ownership is released. The receiver keeps one immutable active batch and one mutable next batch. Multiple waiting questions remain present in the eventual submission, with the latest marked highest priority. Delivery is successful only after a newly rendered matching provider user turn appears.

Pause continues sender observation while withholding delivery. Resume & Catch Up reconciles all unresolved finals in sequence order. Repairs and background recovery do not focus provider windows. Session shutdown clears session-only registration, outbox, ledger, batch, dashboard, and log state.

## Private session tracker

Review Studio writes to `.local/session-tracker` by default. The folder is ignored by Git and contains `practice`, `real`, `reviews`, and `patterns`.

## Browser evidence

Material browser changes must be verified with an isolated Edge profile and synthetic context. Confirm sender and receiver registration, provider-rendered proof, batching during generation, pause and catch-up, transport drill, dashboard layouts, export privacy, and exact session cleanup without touching unrelated Edge tabs.
