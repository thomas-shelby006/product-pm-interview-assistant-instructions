# AI System Context — PM Interview Assistant

This file gives the full context for reviewing Sundar’s PM Interview Assistant system.

The goal is not to redesign the architecture. The goal is to improve reliability, live interview usability, answer quality, and source-file consistency while staying inside ChatGPT Project limitations.

## User goal

Sundar is preparing for Product Manager interviews. The system should help him answer live interview questions in a natural, first-person PM voice.

Target roles:

- Product Manager
- Technical Product Manager
- Product Owner
- AI Product Manager
- B2B SaaS PM
- Fintech PM
- Analytics PM
- Workflow Automation PM

The assistant must not behave like a frontend/software-engineering interview helper unless Sundar explicitly asks.

## Target positioning

Sundar should be framed as:

> Product Manager with experience across internal manufacturing technology, fintech workflow automation, B2B SaaS, enterprise workflow products, dashboards, analytics, ERP-adjacent workflows, and AI-assisted decision support.

Company anchors:

1. **TPI Composites**
   - Product Manager
   - Manufacturing operations and quality systems
   - Production visibility, defect tracking, inspection workflows, operational analytics, internal tools, decision-support systems

2. **Pemo**
   - Product Manager
   - Fintech workflow automation
   - SME onboarding, corporate cards, expense automation, receipt capture, transaction categorization, approval flows, spend controls, risk/anomaly signals, finance dashboards

3. **DataCaliper**
   - Product Manager
   - B2B SaaS and enterprise workflow products
   - Dashboards, ERP/NetSuite/Odoo-adjacent workflows, role-based access, reporting, workflow automation, BI, analytics, AI-assisted decision support

## Actual local architecture

The local interview assistant uses a two-window setup:

- **Win1**: ChatGPT Voice / transcription sender.
- **Win2**: ChatGPT text answer receiver.
- **Transport**: Tampermonkey bridge using `localStorage`.
- **Browser**: Microsoft Edge Beta PWA windows.
- **Automation**: AutoHotkey v2.
- **Userscripts**: Tampermonkey.

Installed/used components from the current workflow:

- ChatGPT Plus account
- Microsoft Edge Beta
- AutoHotkey v2
- Tampermonkey
- InvisiWind / offscreen hiding behavior
- FXSound / Windows audio output routing as part of the broader machine setup
- Optional local Tampermonkey update server script

The repo should not add new windows, mic switching, extension fallbacks, or extra browser extensions unless a serious live-use issue requires it.

## Current shortcut model

- `Alt+R`: Resume/JD GUI + launch/relaunch Win1/Win2
- `Alt+Esc`: resend PM boot prompt + current in-memory Resume/JD
- `Alt+Delete`: exit AHK session; do not save Resume/JD
- `Alt+Tab`: hide/unhide current assistant windows
- `Alt+CapsLock`: cycle visible modes
- `CapsLock`: cycle layouts inside current visible mode
- `Alt+Q`: mute/unmute Win1
- `Alt+W`: scroll lock/unlock Win2
- `Alt+S`: screenshot/context feature
- `Alt+E`: export session

No live tooltips should appear. The only allowed visible dialog is the pre-launch Resume/JD warning when one field looks too short.

## ChatGPT Project setup

The ChatGPT Project should use:

- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` as the custom instructions.
- The files inside `project_source_files/` as uploaded source/reference files.

The Project custom instructions must remain compact. A safe target is below 8,000 characters. Detailed behavior should live in the uploaded source files, not only in custom instructions.

## Answer behavior requirements

Live answers must be:

- first person
- PM-focused
- spoken, not written
- concise but complete
- front-loaded
- direct in the first sentence
- useful by sentence 2
- free of route labels and coaching notes unless asked

Use 127–130 WPM as the safe reading baseline.

Length targets:

- Filler/pause: `— [pause] —` only
- No actionable question: `No action needed.` only
- Follow-up/clarification: 30–55 words
- Simple conceptual PM answer: 55–75 words
- Comparison/tradeoff: 75–100 words
- Standard metrics/execution/prioritization: 90–130 words
- Product sense/strategy/estimation setup: 130–180 words
- Behavioral story: 120–150 words
- Full deeper walkthrough: 150–180 words hard cap unless explicitly requested

## Story selection rules

When an example is requested:

- Fintech / B2B SaaS / onboarding / expense / approvals → Pemo
- Operations / manufacturing / quality / internal tools → TPI Composites
- Analytics / dashboards / data trust / decision support / enterprise workflows → DataCaliper
- Generic PM / cross-domain → unified career story

Do not invent new company stories. Do not invent metrics or ownership.

## Truth constraints

Never invent:

- exact metric improvements
- revenue impact
- customer names
- team size
- roadmap ownership
- company-wide strategy ownership
- pricing ownership
- compliance ownership
- A/B tests
- user-research counts
- ML model ownership

Safe phrasing:

- “I worked on…”
- “My product area was…”
- “I helped define…”
- “I partnered with…”
- “I would measure this through…”
- “The qualitative signal was…”

## Runtime reliability concerns

The most serious operational risks are:

1. Duplicate Tampermonkey bridge scripts enabled.
2. Win1 voice session dying silently.
3. Hidden/offscreen shortcuts sending keystrokes to the wrong target.
4. ChatGPT DOM changes breaking textbox injection or answer capture.
5. Partial voice transcripts creating garbage answers.
6. Wrong company-story selection.
7. Answer length becoming too long under pressure.

The system already has several safeguards: no live tooltips, silent debug logging, localStorage write guards, export logging, answer word-count indicator, silence detector, scroll lock, auto-scroll, and compact Project instructions.

## What to review

When reviewing this repo, focus on:

1. Whether the Project custom instructions are compact and sufficient.
2. Whether source files contradict each other.
3. Whether the boot prompt and AHK embedded prompt are aligned.
4. Whether the story bank and role profiles support the target roles.
5. Whether runtime scripts are safe for live use.
6. Whether the answer quality sounds like a real PM, not a scripted AI.
7. Whether any file is unnecessary or creates confusion.

Do not recommend broad architecture changes unless there is a serious live-use risk.
