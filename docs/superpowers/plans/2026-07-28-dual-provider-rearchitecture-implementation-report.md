# Dual-Provider Rearchitecture Implementation Report

## Scope completed

The Manifest V3 extension is now the provider-neutral runtime for managed ChatGPT and Claude windows. AutoHotkey remains the Windows launcher and layout controller. The legacy Tampermonkey/AHK runtime remains unchanged as rollback material.

## Implemented runtime behavior

- Durable sender/receiver registry stored through `chrome.storage.session`.
- One live sender and receiver per session, with stale-role takeover only.
- Explicit receiver acknowledgement; rejected and transport-failed work is requeued latest-only.
- Monotonic sender sequences and duplicate/stale rejection in both service worker and receiver.
- Scoped MutationObserver candidate discovery with a one-second rerender watchdog.
- Historical submitted-turn baseline suppression on sender startup or reload.
- Source-aware stabilization for composer text versus finalized user turns.
- Receiver stop-and-wait before superseding active generation.
- Separate bounded sender and receiver logs and exports.
- Fresh Edge app windows with exact PMIA-only stale-window cleanup.

## Provider behavior

ChatGPT remains DOM-first because the supplied captures did not expose a stable RTC data-channel payload schema. Claude adds a passive main-world observer for its existing voice WebSocket. The observer ignores binary frames, treats interim transcripts as preview only, and forwards only a human `message_complete` as final voice input.

## Evidence-capture support tool

A separate v7 capture package was created under Documents in `PM Interview Assistant\tools\browser-evidence-capture-v7`.

It preserves the v6 original and adds IndexedDB persistence, 80% auto-rollover, metadata-only binary capture by default, PMIA provider flow presets, recursive export redaction, and a SHA-256 part manifest. It is not a dependency of the PMIA runtime.

## Automated verification

Repository checks:

```powershell
npm test
npm run validate
powershell -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Capture-tool checks:

```powershell
python build_v7.py
node --check "Legacy Users API Capture Tool-7.0.0.user.js"
node --test capture-core.test.mjs
```

## Deferred release gate

Live provider validation was not run in this implementation pass. Manual validation remains required for all four text combinations, both native-voice sender providers, interruption and latest-wins behavior, receiver reload recovery, and a 45-minute soak. Disable the legacy transport during this matrix to prevent duplicate routing.