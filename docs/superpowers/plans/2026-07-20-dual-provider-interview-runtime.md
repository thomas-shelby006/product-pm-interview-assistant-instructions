# Dual-Provider Interview Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested Manifest V3 extension and AutoHotkey v2 launcher supporting independent ChatGPT/Claude selection for sender and receiver windows.

**Architecture:** A provider-neutral extension core routes messages through a service worker. Small ChatGPT and Claude adapters encapsulate DOM differences. A new AHK launcher preserves the current layout/hotkey model while adding provider selectors and stable extension-controlled titles.

**Tech Stack:** JavaScript ES modules, Chrome/Edge Manifest V3 APIs, Node.js built-in test runner, AutoHotkey v2.

## Global Constraints
- Preserve the existing AHK and Tampermonkey runtime unchanged as fallback.
- Use visible DOM behavior; do not call undocumented ChatGPT or Claude APIs.
- Do not persist cookies, authorization headers, Resume text, or JD text.
- Run tests after each major logical slice.
- Do not commit raw capture exports.

---

### Task 1: Protocol and routing core
**Files:** Create `runtime/extension/shared/protocol.js`, `runtime/extension/background.js`, and protocol tests.
**Interfaces:** `parseRuntimeConfig(url)`, `makeEnvelope(input)`, `SessionRegistry.register()`, `SessionRegistry.route()`.
- [ ] Write failing tests for URL role/provider parsing, envelope validation, receiver replacement, and latest-message queue behavior.
- [ ] Run `node --test runtime/extension/tests/protocol.test.js` and confirm RED.
- [ ] Implement the minimal protocol and registry.
- [ ] Run the focused test and full test command; confirm GREEN.

### Task 2: Transcript filtering and provider adapters
**Files:** Create `shared/transcript-filter.js`, `content/adapters/chatgpt.js`, `content/adapters/claude.js`, fixtures, and adapter tests.
**Interfaces:** Each adapter exports `findComposer`, `setComposerText`, `submit`, `isGenerating`, `stopGenerating`, `getLatestUserText`, and `getLatestAssistantText`.
- [ ] Write failing tests using sanitized DOM fixtures derived from live captures.
- [ ] Confirm RED, then implement only the selectors and DOM operations needed by tests.
- [ ] Confirm focused and full tests GREEN.

### Task 3: Content runtime and status UI
**Files:** Create `content/main.js`, `content/runtime.js`, `content/status-overlay.js`, and runtime tests.
**Interfaces:** `createContentRuntime({adapter, transport, document, location})` registers roles, stabilizes sender text, routes receiver prompts, captures stable answers, and handles keyboard commands.
- [ ] Write failing tests for sender dedupe, receiver injection, generation supersede, title defense, and session export redaction.
- [ ] Confirm RED; implement minimal runtime; confirm GREEN.

### Task 4: Extension packaging
**Files:** Create `manifest.json`, `package.json`, `README.md`, and `scripts/validate-extension.mjs`.
- [ ] Write a failing manifest validation test.
- [ ] Add host permissions for `chatgpt.com`, `chat.openai.com`, and `claude.ai`; configure the service worker and content scripts.
- [ ] Run tests and validation.

### Task 5: AutoHotkey launcher
**Files:** Create `runtime/Final_2_Window_Extension.ahk` and `runtime/Validate_Extension_Runtime.ps1`.
- [ ] Copy only proven window/layout/hotkey behavior from the fallback launcher.
- [ ] Add Win1/Win2 provider dropdowns, provider URL mapping, session query parameters, stable window-title detection, and provider-safe mute behavior.
- [ ] Run AutoHotkey `/ErrorStdOut` syntax validation and PowerShell static checks.

### Task 6: Live Edge validation
- [ ] Load the unpacked extension into the existing Edge Default profile without resetting it.
- [ ] Run ChatGPT→Claude and Claude→ChatGPT benign round trips.
- [ ] Verify titles, routing, injection, answer capture, latest-question behavior, layout controls, and fallback preservation.
- [ ] Run fresh full verification and document exact results.
