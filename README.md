# Product PM Interview Assistant Instructions

This repository contains the clean instruction and runtime package for Sundar’s PM Interview Assistant.

It is designed for a ChatGPT Plus workflow using:

- a ChatGPT Project for PM interview answer generation,
- AutoHotkey for the two-window local runtime,
- Microsoft Edge Beta PWA windows,
- Tampermonkey userscripts,
- Win1 as the ChatGPT Voice/transcription sender,
- Win2 as the ChatGPT text-answer receiver.

## What this repo contains

- Project custom instructions to paste into the ChatGPT Project.
- Project source files to upload into the ChatGPT Project.
- Runtime files for the AHK + Tampermonkey two-window setup.
- One system context file for AI review.

## What this repo does not contain

- External AI reviewer prompts.
- Old review notes or change-history artifacts.
- Unused archived scripts.
- Previous ZIP packages.
- Coding-interview or frontend-interview material.

## Main files

- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` — paste this into the ChatGPT Project custom instructions.
- `AI_SYSTEM_CONTEXT.md` — full system context for an AI reviewer.
- `project_source_files/` — upload these Markdown files into the ChatGPT Project.
- `runtime/Final_2_Window_Fixed.ahk` — main local AutoHotkey runtime.
- `runtime/tm_scripts/bridge.user.js` — active ChatGPT bridge userscript.
- `runtime/tm_scripts/virtual-scroll.user.js` — active virtual-scroll userscript.

## First test rule

Before testing, open Tampermonkey and confirm exactly two active scripts:

1. `bridge.user.js`
2. `virtual-scroll.user.js`

Disable all old duplicate scripts. Duplicate bridge scripts are the most likely first-run failure.
