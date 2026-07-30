# Product PM Interview Assistant

This repository contains Sundar's Product Management Interview Assistant instructions, source material, and Manifest V3 dual-provider runtime.

**Current release: PMIA runtime 0.6.1.**

## Active architecture

- A ChatGPT Project and its source bundle define answer behavior, truth constraints, story selection, and PM interview framing.
- `runtime/extension/` is the authoritative provider runtime for ChatGPT and Claude.
- `runtime/Final_2_Window_Extension.ahk` is the active Windows launcher, layout manager, and PM-only hotkey host.
- Microsoft Edge Stable supplies the two managed provider windows.
- The extension service worker owns registration, authorization, durable final ordering, latest-only recovery, and role-scoped logs.
- Content scripts own disposable transcript previews, authoritative final commits, receiver staging/submission, answer capture, health status, and export.

Tampermonkey scripts, the older fixed AutoHotkey launcher, archives, and rollback assets are retained for history and recovery. They are not part of the active architecture and should not be enabled alongside the extension runtime. `runtime/Session_Tracker_End_Session.ahk` is the active optional post-session companion.

## Question transport

### ChatGPT

Placeholder or growing text is mirrored through the disposable preview lane. Values such as listening, transcribing, translating, processing, and recording are ignored. A question is committed once when ChatGPT renders the following assistant turn. Timer-based and force-forward finalization are disabled.

If ChatGPT replaces a submitted message ID during project-to-conversation navigation, canonical user text prevents a duplicate commit. An intentional repeated question remains possible when the earlier turn is still present earlier in the ordered conversation.

### Claude

Each distinct `transcript_interim` value updates the same preview. `user_input_end` is a processing hint. `server_interrupt` preserves the current utterance. `transcript_empty` clears it. Only a human `message_complete` commits the question.

## Structured session setup

Session Studio keeps Resume and Job Description as the primary inputs and adds memory-only controls for **Target company**, **Target role**, **Interview round**, **Emphasis**, **Avoid mentioning**, and **Answer mode**. Optional freeform notes remain available. These values are assembled into the in-memory `Session context:` block used by the boot prompt; they are not persisted to `settings.ini`.

## Post-session tracker

`runtime/Session_Tracker_End_Session.ahk` is the PM Session Tracker Review Studio. It detects exactly one READY PMIA pair, requests both role exports through the launcher's focus-independent control channel, pairs and validates the fresh Markdown files, pushes them to the private tracker, and opens the configured Review Lab. The push script supports `-DryRun` before any Git operation.

## PM-only shortcut surface

- `Alt+R`: open Session Studio and launch or relaunch the selected route.
- `Alt+Esc`: resend current in-memory PM context.
- `Alt+Delete`: end the exact managed session and exit the launcher.
- `Alt+Tab`: hide or restore the managed interview windows.
- `Alt+CapsLock`: cycle two-window, sender-only, and receiver-only modes.
- `CapsLock`: cycle layout presets in the current visible mode.
- `Alt+Q`: toggle the sender microphone through the provider adapter.
- `Alt+W`: toggle receiver scroll lock.
- `Alt+E`: export sender and receiver session records.

There is no screenshot/Greenshot workflow, coding shortcut, code-focus overlay, or force-forward shortcut in the active runtime.

## Main files

- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md`: ChatGPT Project instructions.
- `project_upload_bundle/`: recommended five-file Project upload set.
- `project_source_files/`: detailed editable source material.
- `ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md`: product and interaction design background.
- `runtime/extension/README.md`: runtime 0.6.1 architecture and operational boundaries.
- `runtime/README_INSTALL_TEST.md`: installation and verification procedure.
- `docs/superpowers/specs/2026-07-30-pmia-final-architecture-design.md`: final migration design.

## Verification

From the repository root:

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The AutoHotkey validator uses `--validate`, which exits before showing Session Studio or opening browser windows. Browser evidence checks must target only managed PMIA tabs and must not alter unrelated Edge windows.
