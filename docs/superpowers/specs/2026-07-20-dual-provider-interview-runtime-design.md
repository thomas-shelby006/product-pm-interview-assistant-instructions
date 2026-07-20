# Dual-Provider Interview Runtime Design

## Goal
Replace the ChatGPT-only Tampermonkey transport with a Manifest V3 extension plus AutoHotkey launcher that supports ChatGPT and Claude independently for Win1 and Win2.

## Evidence
Live Edge captures confirmed ChatGPT exposes a `Chat with ChatGPT` composer, `Send prompt`, assistant messages, stop-generation controls, HTTP preparation calls, and a user WebSocket. Claude exposes a separate composer/submit lifecycle and HTTP conversation completion calls. The runtime will use visible DOM behavior, not private authenticated endpoints.

## Architecture
- AutoHotkey owns session setup, provider selection, browser launch, window handles, layouts, hide/restore, screenshots, and global hotkeys.
- The extension service worker owns cross-origin session registration, sender-to-receiver routing, latest-message queueing, and tab recovery.
- Provider adapters own composer discovery, injection, submission, generation detection, stop-generation, user transcript extraction, and answer extraction.
- Content scripts own role registration, transcript stabilization, status UI, keyboard bridge commands, and session export.

## Provider combinations
Support ChatGPT→ChatGPT, ChatGPT→Claude, Claude→ChatGPT, and Claude→Claude. ChatGPT Win1 uses native voice transcripts where present. Claude Win1 uses submitted/composer text, including Windows voice typing.

## Safety and compatibility
The existing `Final_2_Window_Fixed.ahk` and Tampermonkey bridge remain unchanged as fallback. The extension does not call undocumented provider APIs, persist cookies, or commit captured private content. Resume and JD remain process-memory/clipboard session data.

## Success criteria
Both tabs register under one generated session ID; messages cross provider origins; receiver injection and generation tracking work; latest actionable question wins; stable window titles let AHK find both windows; syntax/unit tests pass; unpacked extension loads in the existing Edge Default profile; live smoke tests cover at least ChatGPT→Claude and Claude→ChatGPT.
