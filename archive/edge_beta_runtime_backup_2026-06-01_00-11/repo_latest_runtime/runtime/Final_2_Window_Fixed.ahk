#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
;  PM INTERVIEW ASSISTANT — 2-Window Setup (Edge Beta)
;  Win1 = Sender (Voice/Transcription)
;  Win2 = Receiver (Answer / ChatGPT)
;
;  ALT+R         = Resume/JD + optional Session-setup GUI; launch/relaunch Win1/Win2 (PWA Mode)
;  ALT+ESC       = Resend PM boot prompt + current Resume/JD directly to Win2
;  ALT+DELETE    = Exit/terminate AHK session, no Resume/JD saved
;  ALT+TAB       = Hide/unhide current assistant windows (save/restore mode/layout)
;  ALT+BACKSPACE = Not used
;  ALT+CAPSLOCK  = Cycle visible modes: 2-win → Win1-only → Win2-only → 2-win
;  CAPSLOCK      = Cycle layout presets within current mode
;  ALT+Q         = Mute/unmute Win1 mic (moves Win1 to known pos, clicks, restores)
;  ALT+W         = Toggle scroll lock on Win2
;  ALT+S         = Screenshot + PM context prompt to Win2
;  ALT+E         = Export PM session from Win2
;  ALT+A         = Disabled in PM mode (code explanation not used)
;  ALT+Z         = Disabled in PM mode (mute moved to Alt+Q)
;  ALT+1         = Disabled in PM mode (code focus overlay not used)
;  ALT+SHIFT     = Disabled in PM mode (scroll lock moved to Alt+W)
; ============================================================

global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe"

; ── Mute button client coords inside Win1 ────────────────
; Measured at Win1 size 535x706. These coords are tied to that exact size.
; MUTE_WIN_* deliberately keeps Win1 at the measured dimensions before clicking,
; regardless of which layout is currently active. Do not change these to match
; current layout sizes — the click coords would no longer be valid.
global MUTE_CLIENT_X := 392
global MUTE_CLIENT_Y := 641

; ── Known position for Win1 during mute ──────────────────
; Win1 is moved here before clicking so coords are always valid.
; Size intentionally matches original measurement (535x706), not current layouts.
global MUTE_WIN_X := 425
global MUTE_WIN_Y := 0
global MUTE_WIN_W := 535
global MUTE_WIN_H := 706

SetCapsLockState "AlwaysOff"
SetTitleMatchMode 2
SendMode "Input"
~LAlt::return

; ============================================================
;  PROMPTS  — AHK is the single source of truth for automation prompts.
;             Project/source files define PM answer behavior and truth rules.
; ============================================================

global PM_BOOT_PROMPT_TEXT := ""
    . "You are Sundar’s PM Interview Assistant for this live interview session.`n"
    . "`n"
    . "Use the Resume and Job Description below as silent session context.`n"
    . "Do not summarize them unless asked.`n"
    . "Do not repeat them back.`n"
    . "Do not expose internal analysis.`n"
    . "Do not invent facts beyond the Resume, JD, or Project source files.`n"
    . "`n"
    . "Primary goal:`n"
    . "Help Sundar answer Product Manager interviews with fast, natural, first-person answers he can say out loud immediately.`n"
    . "`n"
    . "Target positioning:`n"
    . "Sundar is a Product Manager with experience across AI-ready B2B SaaS, fintech workflows, enterprise software, analytics dashboards, internal platforms, and workflow automation.`n"
    . "`n"
    . "Target roles:`n"
    . "- Product Manager`n"
    . "- AI Product Manager`n"
    . "- Technical Product Manager`n"
    . "- B2B SaaS Product Manager`n"
    . "- Fintech Product Manager`n"
    . "- Analytics / Data Product Manager`n"
    . "- Workflow Automation Product Manager`n"
    . "- Product Owner for B2B SaaS or enterprise workflow products`n"
    . "`n"
    . "Title rule:`n"
    . "Use the role title “Product Manager” only for all company experience.`n"
    . "Use “product area” or “domain” for specialization. Do not create separate past titles like “AI PM,” “TPM,” or “Product Owner.”`n"
    . "`n"
    . "Company context:`n"
    . "Use company context only when relevant and only if supported by the Resume/JD or Project files.`n"
    . "- TPI Composites: Product Manager. Product area: internal manufacturing technology, renewable-energy manufacturing, wind-blade operations, production visibility dashboards, quality inspection workflows, defect tracking, rework monitoring, issue escalation, operational analytics, data quality, and decision-support systems.`n"
    . "- Pemo: Product Manager. Product area: Dubai/MENA B2B fintech SaaS, SME spend management, corporate cards, onboarding, card activation, receipt capture, receipt matching, transaction categorization, approvals, spend controls, anomaly/risk signals, finance-admin dashboards, and expense automation.`n"
    . "- DataCaliper: Product Manager. Product area: B2B SaaS and custom enterprise software, dashboards, ERP/NetSuite/Odoo-adjacent workflows, analytics, data pipelines, admin tools, role-based access, approvals, reporting, workflow automation, client discovery, US/client delivery coordination, business intelligence, and AI-assisted decision support where relevant.`n"
    . "`n"
    . "Best target narrative:`n"
    . "The common thread is building workflow-heavy software products that reduce manual work, improve visibility, automate routine decisions, and help business users act on data. Frame the experience as tech/product focused, but do not answer like a software engineer.`n"
    . "`n"
    . "JD calibration:`n"
    . "When this setup prompt includes a Job Description, silently extract and hold:`n"
    . "- company name`n"
    . "- product domain`n"
    . "- primary user type`n"
    . "- top 3 must-have skills`n"
    . "- metrics language used in the JD, such as activation, retention, NPS, GMV, conversion, adoption, churn, revenue, reliability, latency, accuracy, automation, or AI quality`n"
    . "Use these words to shape answer vocabulary and metric choices throughout the session.`n"
    . "If the JD says “activation rate,” use that phrase.`n"
    . "If the JD says “enterprise customers,” use that framing.`n"
    . "If the JD mentions AI, automation, data, APIs, dashboards, integrations, or workflows, connect answers to that context naturally.`n"
    . "If the JD title or interview context suggests Director, Head, VP, or senior leadership, acknowledge what could go wrong at scale, the org implication, or what leadership would ask. Shift the framing to how the decision holds up at 10x scale or under executive pushback; do not just add a generic risk sentence.`n"
    . "If the JD suggests Associate PM, PM I, or junior PM, keep answers simpler, direct, and execution-focused without excessive nuance.`n"
    . "Do not acknowledge this extraction out loud.`n"
    . "`n"
    . "Source precedence and session metadata:`n"
    . "- Resume, JD, and any session metadata set emphasis and vocabulary only; they never create new facts or claims.`n"
    . "- Truth constraints always win. The confirmed story bank and Project source files are canonical for facts.`n"
    . "- The JD shapes target framing and vocabulary only; it never becomes claimed work history.`n"
    . "- If a Session context block sets Avoid mentioning, keep those topics out of every answer this session.`n"
    . "- Answer mode: concise = bottom of the word band; normal = current policy; deep = top of the band plus an offer to expand, still under 180 words.`n"
    . "- A live correction from Sundar wins for the rest of the session unless it violates the truth constraints.`n"
    . "- Answer the latest actionable interviewer question; for follow-ups or interruptions, be shorter and do not restart the framework.`n"
    . "`n"
    . "Live answer behavior:`n"
    . "- Answer as Sundar.`n"
    . "- Use first person.`n"
    . "- Start with the direct answer.`n"
    . "- Take a position in every answer. Do not present options without recommending one. Recommendation first, reasoning second.`n"
    . "- Structure every answer so the first 1–2 sentences are a complete, speakable standalone answer. Everything after is additive detail. If Sundar stops after sentence 2, the answer must still sound finished and correct.`n"    . "- For the first answer of a round, especially ‘tell me about yourself,’ prefer the fixed opening anchor. It should be calm, familiar, and easier to speak than a newly generated answer.`n"

    . "- For complex product sense, strategy, prioritization, or estimation questions, state one assumption explicitly before the detail, e.g. ‘I’ll assume the goal is activation, not retention — tell me if that’s wrong.’`n"
    . "- Do not restate the question.`n"
    . "- Do not show route labels.`n"
    . "- Do not show coaching notes unless asked.`n"
    . "- Do not mention framework names unless asked.`n"
    . "- Do not use “Answer:”, “Say:”, “If pushed:”, or “Likely follow-up:” in live mode.`n"
    . "- Do not produce long essays.`n"
    . "- Do not mention frontend/SWE/coding unless explicitly asked.`n"
    . "- Do not invent metrics, ownership, revenue impact, user research, A/B tests, customer names, team size, roadmap authority, compliance ownership, ML model ownership, or company-wide AI ownership.`n"
    . "- Never use: Additionally, Furthermore, It's worth noting, In summary, or To summarize.`n"
    . "- Do not count steps out loud unless the interviewer explicitly asks for steps.`n"
    . "- End naturally, for example: ‘that’s how I’d approach it’ or ‘I’d revisit based on what the data shows.’ Do not end with a formal summary sentence.`n"
    . "`n"
    . "Live answer word limits:`n"
    . "Use 127–130 WPM as the safe interview reading baseline.`n"
    . "- Follow-up / clarification: 30–55 words`n"
    . "- Simple conceptual PM answer: 55–75 words`n"
    . "- Comparison / tradeoff: 75–100 words`n"
    . "- Implementation / how-would-you: 110–150 words`n"
    . "- Standard PM execution / metrics / prioritization: 90–130 words`n"
    . "- Product sense / strategy: 130–180 words`n"
    . "- Estimation / market sizing: 130–160 words`n"
    . "- Behavioral story: 120–150 words; keep it real and concise`n"
    . "- Deep PM walkthrough / full case (only if asked for depth): 150–180 words hard cap`n"
    . "`n"
    . "Rules:`n"
    . "- Follow-ups must be shorter than the original answer.`n"
    . "- For follow-up questions, examples, clarifications, pushback, what-if questions, and how-would-you-measure questions, do not restart the full framework. Answer only what was asked. Pattern: direct answer → one supporting point → stop.`n"
    . "- Maximum 55 words for a simple follow-up and 90 words for a complex follow-up.`n"
    . "- Never exceed 180 words in one live response unless the interviewer explicitly asks for extended depth.`n"
    . "- If more depth is needed, stop and wait for the interviewer’s follow-up.`n"
    . "- Silence is acceptable. Do not add filler to make the answer longer.`n"
    . "`n"
    . "Story selection:`n"
    . "When an example is requested, select from the defined company contexts based on domain:`n"
    . "- Fintech / B2B SaaS / onboarding / expense / approvals / spend management / finance workflow automation → Pemo`n"
    . "- Operations / manufacturing / quality / internal tools / production visibility / operational analytics → TPI Composites`n"
    . "- Analytics / dashboards / data trust / decision support / ERP-adjacent workflows / admin tools / client-facing enterprise software / AI-assisted decision support → DataCaliper`n"
    . "- Generic PM / cross-domain / tell-me-about-yourself → unified career story`n"
    . "Do not invent a new story. Use the defined company context for the most relevant domain.`n"
    . "If no company story fits, answer in general product terms without claiming specific past experience.`n"
    . "`n"
    . "Silent answer shaping:`n"
    . "- Tell me about yourself: use this fixed opening anchor by default unless the JD strongly requires a different domain emphasis: “I’m a Product Manager focused on workflow-heavy B2B software products. I started at TPI Composites on manufacturing and quality systems, then moved to Pemo, where I worked on fintech workflows like onboarding, expense automation, approvals, and spend visibility. Now at DataCaliper, I work on B2B SaaS, enterprise workflow, analytics, and decision-support products. My strength is turning messy business workflows into software that reduces manual work and gives teams better visibility — that pattern connects all three roles.” This should feel memorized, not generated. Do not over-tailor the opening unless the interviewer asks for a specific angle.`n"
    . "- Why PM / why this role: use the unified TPI → Pemo → DataCaliper PM story only if helpful. Tie it to AI-ready B2B SaaS, fintech workflows, analytics, enterprise tools, APIs/integrations, dashboards, and workflow automation.`n"
    . "- Walk me through your resume: answer chronologically, one sentence per role, emphasizing PM work and domain. Do not pitch. Pattern: TPI → Pemo → DataCaliper. 45–60 words, then stop.`n"
    . "- Why this company: use the JD to identify company domain, user type, product area, and metrics vocabulary. If the JD mentions a specific product area, reference a specific product challenge you would want to work on, not just general domain fit. Shape: company/product problem → why that domain fits my background → what I would bring. Do not recite the career arc unless it directly maps to the company’s domain. 60–90 words.`n"
    . "- Why leaving / why did you leave: frame as growth-direction and domain fit, not dissatisfaction. For DataCaliper/current role, keep it careful: I’m selectively looking for roles closer to AI-ready B2B SaaS, fintech workflows, analytics, and product ownership depth. Do not mention pay, frustration, or role mismatch unless the Resume/JD says so. 55–85 words.`n"
    . "- Do you have questions for me: output only `[interviewer Q&A — answer from your own prepared questions]`. Do not invent questions for the interviewer unless Sundar explicitly asks for question suggestions.`n"
    . "- Salary, notice period, compensation, relocation, counter-offer, or recruiter logistics: output only `[candidate-handled topic — answer from memory]`. Do not generate negotiation language unless Sundar explicitly asks.`n"
    . "- Product sense: name a specific user role and context, not a broad category; then give workflow pain → solution direction → metric → tradeoff. Bad: ‘business users.’ Good: ‘a finance admin at a 15-person company closing expenses manually each month.’`n"
    . "- Personal product opinion / critique: use a prepared product opinion when possible. Give a real preference, one product observation, and one improvement. Prefer B2B/productivity/fintech examples such as Stripe Dashboard, Notion, Slack, or Linear. Do not invent deep usage history. 55–75 words.`n"
    . "- Metrics: goal → primary metric → input metrics → guardrails → segmentation. For metric drops, always start with data validation before hypotheses: check tracking, definition changes, dashboard bugs, timing artifacts, then segment, locate the funnel step, generate hypotheses, and prioritize validation.`n"
    . "- Execution: objective → scope → dependencies → sequencing → risks → launch metric. For prioritization, recommend one thing first, then explain why it beats alternatives using impact, effort, and strategic fit. Do not name the scoring framework unless asked.`n"
    . "- Estimation / market sizing: state the approach first (“I’d estimate this by…”), then give one clear driver tree, then a rough number with explicit assumptions, then a sanity check using a concrete comparable, public stat, or common-sense ceiling. Never present the number without the assumptions. 130–160 words.`n"
    . "- Behavioral: context → tension → action → result/learning. Do not announce STAR. For stakeholder conflict, show holding a position, not just facilitating alignment: I disagreed with [role] because of [data/user signal], then either won the argument with evidence or made a principled concession.`n"
    . "- Failure / mistake: context → what went wrong and why → what I did when I realized it → what I learned or changed. Do not turn a failure into a hidden success. The result should be a real learning or process change, not a disguised positive outcome. 120–150 words.`n"
    . "- Technical/TPM: product outcome → technical constraint → tradeoff → engineering collaboration → rollout/monitoring. Use APIs, data quality, integrations, latency, reliability, permissions, and monitoring only when relevant. For ‘how do you work with engineering,’ include one concrete workflow such as acceptance criteria/refinement, one technical tradeoff, and how scope or timeline pushback is handled.`n"
    . "- Product Owner: user value → acceptance criteria → priority → dependencies → sprint/stakeholder tradeoff.`n"
    . "- AI/Product: user task → automation value → AI/data quality → trust/risk guardrails → human fallback or review → metric.`n"
    . "`n"
    . "Noisy transcript handling:`n"
    . "Identify the latest actionable interviewer question.`n"
    . "Use earlier transcript only as context.`n"
    . "If the transcript ends mid-sentence, is a partial phrase, or cannot be resolved into a complete question without guessing the intent, respond only:`n"
    . "No action needed.`n"
    . "Do not complete the question. Do not assume what was being asked.`n"
    . "If the transcript is only filler or a thinking signal, such as “um,” “yeah,” “okay,” “sure,” “right,” “mm-hmm,” “go ahead,” or similar with no question, respond only:`n"
    . "— [pause] —`n"
    . "If there is no actionable interviewer question, respond only:`n"
    . "No action needed.`n"
    . "`n"
    . "Session reset rule:`n"
    . "The Resume and JD apply only to this current AHK session.`n"
    . "Do not assume this context in future sessions unless provided again.`n"
    . "`n"
    . "Session context follows below.`n"
    . "Do not respond to this setup prompt itself.`n"
global promptWin2Reset := ""
    . "Regenerate the latest answer for a PM interview.`n"
    . "`n"
    . "Make it:`n"
    . "- direct,`n"
    . "- first person,`n"
    . "- natural,`n"
    . "- matched to the question type,`n"
    . "- within the live word-limit policy,`n"
    . "- PM/TPM/PO/AI-product framed depending on the question,`n"
    . "- no route label,`n"
    . "- no framework explanation,`n"
    . "- no fake metrics or ownership,`n"
    . "- no frontend/SWE framing.`n"
    . "`n"
    . "Use the current Resume/JD context only if relevant.`n"
    . "Return only the improved answer.`n"

global promptScreenshot := "[CONTEXT SYNC] For PM interview context, briefly identify what is visible and how it affects the latest product, TPM, execution, metrics, or strategy answer. Do not switch into coding interview mode."

BuildBootPrompt() {
    global PM_BOOT_PROMPT_TEXT, g_sessionResume, g_sessionJD, g_sessionMeta

    resume := Trim(g_sessionResume)
    jd := Trim(g_sessionJD)
    meta := Trim(g_sessionMeta)

    if (resume = "")
        resume := "[Resume not provided in launch window.]"
    if (jd = "")
        jd := "[Job description not provided in launch window.]"

    metaBlock := ""
    if (meta != "")
        metaBlock := "Session context:`n" . meta . "`n`n"

    return PM_BOOT_PROMPT_TEXT
        . "`n`n---`n`nSESSION CONTEXT`n`n"
        . metaBlock
        . "Resume:`n" . resume . "`n`n"
        . "Job Description:`n" . jd . "`n"
}

; ============================================================
;  LAYOUTS & STATE
;
;  g_mode:  1 = 2-window   (Win1 and Win2 visible)
;           2 = Win1-only  (Win1 visible, Win2 off-screen)
;           3 = Win2-only  (Win2 visible, Win1 ghosted/off-screen)
;           hidden state is tracked separately by g_hidden and is used only by Alt+Tab.
;
;  Win2-only mode keeps Win1 alive/ghosted to avoid breaking ChatGPT Voice transcription.
; ============================================================

; 2-win layouts: [Win1_x, Win1_y, Win1_w, Win1_h, Win2_x, Win2_y, Win2_w, Win2_h]
; 16px overlap on all layouts to eliminate browser chrome gap.
; All layouts are Win1-left Win2-right.
global layout2Win := [
    [0,    0, 420, 740,  404,  0, 420, 740],   ; 1. Left  Short  (Win1@0→420, Win2@404→824)
    [380,  0, 580, 740,  944,  0, 580, 740],   ; 2. Mid   Short  (Win1@380→960, Win2@944→1524)
    [1080, 0, 420, 740,  1484, 0, 420, 740],   ; 3. Right Short  (Win1@1080→1500, Win2@1484→1904)
    [0,    0, 440, 1032, 424,  0, 440, 1032],  ; 4. Left  Tall   (Win1@0→440, Win2@424→864)
    [360,  0, 600, 1032, 944,  0, 600, 1032],  ; 5. Mid   Tall   (Win1@360→960, Win2@944→1544)
    [1080, 0, 428, 1032, 1492, 0, 428, 1032],  ; 6. Right Tall   (Win1@1080→1508, Win2@1492→1920, 16px overlap)
]

; Solo layouts for the currently visible single window: [x, y, w, h]
global layoutSolo := [
    [0,    0, 535, 1032],  ; 1. Left
    [692,  0, 535, 1032],  ; 2. Center
    [1385, 0, 535, 1032],  ; 3. Right
]

global OFF_X := 3840
global OFF_Y := 0

global g_hWin1               := 0
global g_hWin2               := 0
global g_mode                := 1
global g_pos2Win             := 1
global g_posWin1             := 1
global g_posWin2             := 1
global g_muted               := false
global g_suppressClipMonitor := false
global g_layoutEnteredAt     := A_TickCount
global g_currentLayout       := {mode: 1, pos2Win: 1, posWin1: 1, posWin2: 1}
global g_lastStableLayout    := 0
global g_hidden              := false
global g_hiddenLayout        := 0
global g_hiddenActive        := 0
global g_launchGui           := 0
global g_resumeEdit          := 0
global g_jdEdit              := 0
global g_metaEdit            := 0
global g_sessionResume       := ""
global g_sessionJD           := ""
global g_sessionMeta         := ""
global g_interviewActive     := false
global LOG_DIR               := A_ScriptDir "\runtime_logs"
global LOG_FILE              := LOG_DIR "\session_debug.log"

; ============================================================
;  ALT+R — LAUNCH / RELAUNCH FLOW
;  Opens Resume/JD window first, then launches/relaunches in --app mode with
;  performance flags to prevent the background/ghost window from sleeping.
;  Resume/JD are kept only in this AHK process memory and never saved to disk.
; ============================================================

!r:: {
    ShowSessionLaunchGui()
}

ShowSessionLaunchGui() {
    global g_launchGui, g_resumeEdit, g_jdEdit, g_metaEdit, g_sessionResume, g_sessionJD, g_sessionMeta

    try {
        if IsObject(g_launchGui) {
            g_launchGui.Show()
            return
        }
    }

    g_launchGui := Gui("+AlwaysOnTop", "PM Interview Assistant — Resume + JD")
    g_launchGui.SetFont("s10", "Segoe UI")

    g_launchGui.Add("Text", "xm ym", "Resume")
    g_resumeEdit := g_launchGui.Add("Edit", "xm w760 h190 -Wrap", g_sessionResume)

    g_launchGui.Add("Text", "xm y+12", "Job Description")
    g_jdEdit := g_launchGui.Add("Edit", "xm w760 h190 -Wrap", g_sessionJD)

    g_launchGui.Add("Text", "xm y+12 w760", "Session setup (optional) — one item per line, e.g.  Company: Acme   Target role: Product Manager   Interview round: product sense   Emphasis: fintech   Avoid mentioning: pricing   Answer mode: concise")
    g_metaEdit := g_launchGui.Add("Edit", "xm w760 h90 -Wrap", g_sessionMeta)

    startBtn := g_launchGui.Add("Button", "xm y+14 w140 h32 Default", "Start / Launch")
    cancelBtn := g_launchGui.Add("Button", "x+10 yp w90 h32", "Cancel")

    g_launchGui.Add("Text", "xm y+10 w760", "Resume, Job Description, and optional Session setup are collected here. Answer length, style, truth rules, and PM routing are predefined in the boot prompt and Project files.")

    startBtn.OnEvent("Click", StartLaunchFromGui)
    cancelBtn.OnEvent("Click", CloseSessionLaunchGui)
    g_launchGui.OnEvent("Close", CloseSessionLaunchGui)
    g_launchGui.Show("w800 h680")
}

StartLaunchFromGui(*) {
    global g_launchGui, g_resumeEdit, g_jdEdit, g_metaEdit, g_sessionResume, g_sessionJD, g_sessionMeta

    if IsObject(g_resumeEdit)
        g_sessionResume := g_resumeEdit.Value
    if IsObject(g_jdEdit)
        g_sessionJD := g_jdEdit.Value
    if IsObject(g_metaEdit)
        g_sessionMeta := g_metaEdit.Value

    if (StrLen(Trim(g_sessionResume)) < 100 || StrLen(Trim(g_sessionJD)) < 100) {
        continueChoice := MsgBox("Resume or JD looks too short. Continue anyway?", "PM Interview Assistant", "YesNo Icon!")
        if (continueChoice != "Yes")
            return
    }

    CloseSessionLaunchGui()
    AutoStartup()
}

CloseSessionLaunchGui(*) {
    global g_launchGui, g_resumeEdit, g_jdEdit, g_metaEdit
    try {
        if IsObject(g_launchGui)
            g_launchGui.Destroy()
    }
    g_launchGui := 0
    g_resumeEdit := 0
    g_jdEdit := 0
    g_metaEdit := 0
}

AutoStartup() {
    global g_hWin1, g_hWin2, BrowserExe, g_interviewActive
    global g_mode, g_pos2Win, g_posWin1, g_posWin2
    global g_layoutEnteredAt, g_currentLayout, g_lastStableLayout

    g_interviewActive := false
    LogEvent("Alt+R launch requested")

    if !FileExist(BrowserExe) {
        LogEvent("Preflight failed: Edge Beta executable not found at " BrowserExe)
        return
    }

    if !RegExMatch(A_AhkVersion, "^2\.") {
        LogEvent("Preflight warning: expected AutoHotkey v2, found " A_AhkVersion)
    }

    if IsAlive(g_hWin1)
        WinClose "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinClose "ahk_id " g_hWin2
    g_hWin1 := 0
    g_hWin2 := 0

    ; Performance flags to keep ghosted window fully active
    flags := " --disable-background-timer-throttling"
        . " --disable-backgrounding-occluded-windows"
        . " --disable-renderer-backgrounding"
        . " --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling"

    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=sender"' . flags
    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=receiver"' . flags

    if !WinWait("VB_SENDER", , 15) {
        LogEvent("Launch failed: Win1/VB_SENDER not detected")
        MsgBox "Win1 not detected. Check Edge Beta and Tampermonkey bridge setup.", "PM Interview Assistant", "Icon!"
        return
    }
    g_hWin1 := WinGetID("VB_SENDER")

    if !WinWait("VB_RECEIVER", , 10) {
        LogEvent("Launch failed: Win2/VB_RECEIVER not detected")
        MsgBox "Win2 not detected. Check Edge Beta and Tampermonkey bridge setup.", "PM Interview Assistant", "Icon!"
        return
    }
    g_hWin2 := WinGetID("VB_RECEIVER")

    EnsureAlwaysOnTop(g_hWin1)
    EnsureAlwaysOnTop(g_hWin2)

    g_mode    := 1
    g_pos2Win := 1
    g_posWin1 := 1
    g_posWin2 := 1
    g_lastStableLayout := 0

    Apply2WinLayout(1)
    RecordLayoutChange(1, 1, 1, 1)

    ; Boot prompt → Win1 only.
    ; Win1 sender script forwards it to Win2 via localStorage automatically.
    Sleep 1000
    SendToWindow(BuildBootPrompt(), "^+{F5}", g_hWin1)
    g_interviewActive := true
    LogEvent("Interview session active: Win1/Win2 launched and boot prompt sent")

    WinActivate "ahk_id " g_hWin2
}

EnsureAlwaysOnTop(hwnd) {
    if !IsAlive(hwnd)
        return
    exStyle := WinGetExStyle("ahk_id " hwnd)
    if !(exStyle & 0x8) {
        WinActivate "ahk_id " hwnd
        Sleep 200
        if WinWaitActive("ahk_id " hwnd, , 2) {
            Sleep 100
            Send "^#t"
            Sleep 300
        }
    }
}

; ============================================================
;  ALT+CAPSLOCK — CYCLE VISIBLE MODES: 2-win → Win1-only → Win2-only → 2-win
;  Hidden/unhidden state is controlled only by Alt+Tab.
; ============================================================

!CapsLock:: {
    global g_mode, g_pos2Win, g_posWin1, g_posWin2, g_hWin1, g_hWin2, g_hidden

    SetCapsLockState "AlwaysOff"

    if (!IsActiveSession()) {
        LogEvent("Alt+CapsLock ignored: no active interview session")
        return
    }

    if (!IsAlive(g_hWin1) || !IsAlive(g_hWin2))
        return

    if (g_hidden)
        return

    if (g_mode = 1) {
        ; 2-window → Win1-only
        g_mode := 2
        ApplyWin1OnlyLayout(g_posWin1)
        RecordLayoutChange(2, g_pos2Win, g_posWin1, g_posWin2)
        WinActivate "ahk_id " g_hWin1
        return
    }

    if (g_mode = 2) {
        ; Win1-only → Win2-only
        g_mode := 3
        ApplyWin2OnlyLayout(g_posWin2)
        RecordLayoutChange(3, g_pos2Win, g_posWin1, g_posWin2)
        WinActivate "ahk_id " g_hWin2
        return
    }

    if (g_mode = 3) {
        ; Win2-only → 2-window
        g_mode := 1
        Apply2WinLayout(g_pos2Win)
        RecordLayoutChange(1, g_pos2Win, g_posWin1, g_posWin2)
        WinActivate "ahk_id " g_hWin2
        return
    }
}

; ============================================================
;  CAPSLOCK — CYCLE LAYOUT PRESETS WITHIN CURRENT VISIBLE MODE
; ============================================================

CapsLock:: {
    global g_mode, g_pos2Win, g_posWin1, g_posWin2, layout2Win, layoutSolo, g_hidden
    SetCapsLockState "AlwaysOff"

    if (!IsActiveSession()) {
        LogEvent("CapsLock ignored: no active interview session")
        return
    }

    if (g_hidden) {
        return
    }

    if (g_mode = 1) {
        next := Mod(g_pos2Win, layout2Win.Length) + 1
        Apply2WinLayout(next)
        RecordLayoutChange(1, next, g_posWin1, g_posWin2)

    } else if (g_mode = 2) {
        next := Mod(g_posWin1, layoutSolo.Length) + 1
        ApplyWin1OnlyLayout(next)
        RecordLayoutChange(2, g_pos2Win, next, g_posWin2)

    } else if (g_mode = 3) {
        next := Mod(g_posWin2, layoutSolo.Length) + 1
        ApplyWin2OnlyLayout(next)
        RecordLayoutChange(3, g_pos2Win, g_posWin1, next)
    }
}

; ============================================================
;  ALT+TAB — QUICK HIDE / UNHIDE CURRENT ASSISTANT WINDOWS
;  ToggleHide-style behavior from the original AHK setup:
;  save current mode/layout, move managed windows off-screen, then restore.
;  Alt+Tab must not switch focus between Win1 and Win2.
; ============================================================

!Tab:: {
    ToggleHide()
}

ToggleHide() {
    global g_hidden, g_hiddenLayout, g_hiddenActive, g_currentLayout
    global g_hWin1, g_hWin2, g_mode

    if (!IsActiveSession()) {
        LogEvent("Alt+Tab ignored: no active interview session")
        return
    }

    if (!IsAlive(g_hWin1) || !IsAlive(g_hWin2))
        return

    if (!g_hidden) {
        ; Save current visible mode/layout and active window, then hide everything.
        g_hiddenLayout := {
            mode:    g_currentLayout.mode,
            pos2Win: g_currentLayout.pos2Win,
            posWin1: g_currentLayout.posWin1,
            posWin2: g_currentLayout.posWin2
        }
        g_hiddenActive := WinGetID("A")
        RestoreWin1Visibility()
        HideAllManaged()
        g_hidden := true
        return
    }

    ; Restore the exact saved visible mode/layout.
    g_hidden := false
    RestoreLayout(g_hiddenLayout)

    ; Restore focus sensibly within the restored mode.
    if (g_mode = 1 && g_hiddenActive = g_hWin1 && IsAlive(g_hWin1)) {
        WinActivate "ahk_id " g_hWin1
    } else if (g_mode = 2 && IsAlive(g_hWin1)) {
        WinActivate "ahk_id " g_hWin1
    } else if IsAlive(g_hWin2) {
        WinActivate "ahk_id " g_hWin2
    }
}

; ============================================================
;  GHOST / VISIBILITY HELPERS
; ============================================================

GhostWin1() {
    global g_hWin1, OFF_X
    ; Set WS_EX_LAYERED first, then transparency, then move off-screen.
    WinSetExStyle "+0x80000", "ahk_id " g_hWin1   ; WS_EX_LAYERED
    WinSetTransparent 13, "ahk_id " g_hWin1        ; ~5% opacity
    WinSetExStyle "+0x20", "ahk_id " g_hWin1       ; WS_EX_TRANSPARENT (click-through)
    WinMove OFF_X, 0, 960, 1032, "ahk_id " g_hWin1
}

RestoreWin1Visibility() {
    global g_hWin1
    WinSetExStyle "-0x20", "ahk_id " g_hWin1       ; remove click-through
    WinSetTransparent "Off", "ahk_id " g_hWin1      ; remove transparency
    WinSetExStyle "-0x80000", "ahk_id " g_hWin1     ; remove WS_EX_LAYERED
}

; ============================================================
;  LAYOUT APPLIERS
; ============================================================

HideAllManaged() {
    global g_hWin1, g_hWin2, OFF_X, OFF_Y
    if IsAlive(g_hWin1)
        WinMove OFF_X, OFF_Y, 960, 1032, "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinMove OFF_X, OFF_Y, 960, 1032, "ahk_id " g_hWin2
}

Apply2WinLayout(idx) {
    global layout2Win, g_pos2Win, g_hWin1, g_hWin2
    g_pos2Win := idx
    p := layout2Win[idx]
    ; Always ensure Win1 is fully visible when applying 2-win layout
    RestoreWin1Visibility()
    if IsAlive(g_hWin1)
        WinMove p[1], p[2], p[3], p[4], "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinMove p[5], p[6], p[7], p[8], "ahk_id " g_hWin2
}

ApplyWin1OnlyLayout(idx) {
    global layoutSolo, g_posWin1, g_hWin1, g_hWin2, OFF_X, OFF_Y
    g_posWin1 := idx
    p := layoutSolo[idx]
    RestoreWin1Visibility()
    if IsAlive(g_hWin1)
        WinMove p[1], p[2], p[3], p[4], "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinMove OFF_X, OFF_Y, 960, 1032, "ahk_id " g_hWin2
}

ApplyWin2OnlyLayout(idx) {
    global layoutSolo, g_posWin2, g_hWin2
    g_posWin2 := idx
    p := layoutSolo[idx]
    if IsAlive(g_hWin2)
        WinMove p[1], p[2], p[3], p[4], "ahk_id " g_hWin2
    GhostWin1()
}

; ============================================================
;  LAYOUT STATE
; ============================================================

RecordLayoutChange(newMode, newPos2Win, newPosWin1, newPosWin2) {
    global g_layoutEnteredAt, g_currentLayout, g_lastStableLayout
    now := A_TickCount
    if (now - g_layoutEnteredAt >= 5000) {
        g_lastStableLayout := {
            mode:    g_currentLayout.mode,
            pos2Win: g_currentLayout.pos2Win,
            posWin1: g_currentLayout.posWin1,
            posWin2: g_currentLayout.posWin2
        }
    }
    g_currentLayout := {mode: newMode, pos2Win: newPos2Win, posWin1: newPosWin1, posWin2: newPosWin2}
    g_layoutEnteredAt := now
}

RestoreLayout(layout) {
    global g_mode, g_pos2Win, g_posWin1, g_posWin2

    g_mode    := layout.mode
    g_pos2Win := layout.pos2Win
    g_posWin1 := layout.posWin1
    g_posWin2 := layout.posWin2

    if (layout.mode = 1) {
        Apply2WinLayout(layout.pos2Win)
    } else if (layout.mode = 2) {
        ApplyWin1OnlyLayout(layout.posWin1)
    } else if (layout.mode = 3) {
        ApplyWin2OnlyLayout(layout.posWin2)
    }
    RecordLayoutChange(layout.mode, layout.pos2Win, layout.posWin1, layout.posWin2)
}

; ============================================================
;  TOOL SHORTCUTS
; ============================================================

; Alt+Esc — Resend PM boot prompt + current Resume/JD directly to Win2.
; If the assistant is hidden, temporarily restore the saved layout, send the prompt,
; then move the windows back off-screen. This avoids sending shortcuts to the
; wrong active app without showing any tooltip during the interview.
!Esc:: {
    global g_hWin2, g_hidden, g_hiddenLayout, g_hiddenActive
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if (!IsActiveSession()) {
        LogEvent("Alt+Esc ignored: no active interview session")
        return
    }
    if !IsAlive(g_hWin2) {
        LogEvent("Alt+Esc failed: Win2 not alive")
        return
    }

    if (g_hidden) {
        LogEvent("Alt+Esc requested while hidden: temporarily restoring Win2 for direct boot/context resend")
        savedHiddenLayout := g_hiddenLayout
        savedHiddenActive := g_hiddenActive
        g_hidden := false
        RestoreLayout(savedHiddenLayout)
        Sleep 180
        SendToWindow(BuildBootPrompt(), "^+{F7}", g_hWin2)
        Sleep 220
        RestoreWin1Visibility()
        HideAllManaged()
        g_hidden := true
        g_hiddenLayout := savedHiddenLayout
        g_hiddenActive := savedHiddenActive
        if (savedHiddenActive != 0 && WinExist("ahk_id " savedHiddenActive))
            WinActivate "ahk_id " savedHiddenActive
        return
    }

    if SendToWindow(BuildBootPrompt(), "^+{F7}", g_hWin2)
        LogEvent("Alt+Esc boot/context resent directly to Win2")
}

 ; Alt+Delete — Cleanly end this AHK session.
; Resume/JD are stored only in process memory and are not saved to disk.
!Delete:: {
    global g_hWin1, g_hWin2, g_interviewActive
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    LogEvent("Alt+Delete exit requested")
    g_interviewActive := false
    try {
        if IsAlive(g_hWin1)
            WinClose "ahk_id " g_hWin1
        if IsAlive(g_hWin2)
            WinClose "ahk_id " g_hWin2
    }
    ExitApp
}

; Alt+E — Export PM session from Win2
!e:: {
    global g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if (!IsActiveSession()) {
        LogEvent("Alt+E ignored: no active interview session")
        return
    }
    if IsAlive(g_hWin2) {
        if SendToWindow("", "^+{F8}", g_hWin2)
            LogEvent("Alt+E export triggered")
    } else {
        LogEvent("Alt+E failed: Win2 not alive")
    }
}

; Alt+Q — Mute/unmute Win1 mic using the measured coordinate flow.
!q:: {
    ToggleWin1Mute()
}

; Alt+A — Disabled for PM-only runtime.
;  Code explanation is not part of the PM interview workflow.
!a:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    return
}

; Alt+S — Screenshot + context prompt to Win2
!s:: {
    global g_hWin2, g_suppressClipMonitor, promptScreenshot
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if (!IsActiveSession()) {
        LogEvent("Alt+S ignored: no active interview session")
        return
    }
    if !IsAlive(g_hWin2) {
        LogEvent("Alt+S failed: Win2 not alive")
        return
    }
    g_suppressClipMonitor := true
    A_Clipboard := ""
    DllCall("keybd_event", "int", 0x2C, "int", 0, "int", 0, "int", 0)
    DllCall("keybd_event", "int", 0x2C, "int", 0, "int", 2, "int", 0)
    if !ClipWait(2, 1) {
        g_suppressClipMonitor := false
        return
    }
    WinActivate "ahk_id " g_hWin2
    WinWaitActive "ahk_id " g_hWin2, , 2
    Sleep 100
    Send "^+{F9}"
    Sleep 200
    Send "^v"
    Sleep 1000
    Send "{Text}" promptScreenshot
    Sleep 200
    Send "{Enter}"
    g_suppressClipMonitor := false
}

; Alt+W — Toggle scroll lock on Win2
!w:: {
    global g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if (!IsActiveSession()) {
        LogEvent("Alt+W ignored: no active interview session")
        return
    }
    if IsAlive(g_hWin2) {
        if SendToWindow("", "^+{F10}", g_hWin2)
            LogEvent("Alt+W scroll lock toggled")
    } else {
        LogEvent("Alt+W failed: Win2 not alive")
    }
}

; Alt+Shift — Disabled in PM mode.
;  Scroll lock moved to Alt+W.
!Shift:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    return
}

; Alt+X — Disabled for PM-only simplicity.
!x:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    return
}

; Alt+1 — Disabled for PM-only simplicity.
;  Code focus overlay is not part of the default PM interview workflow.
!1:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    return
}

; Alt+Z — Disabled in PM mode.
;  Mute/unmute moved to Alt+Q.
!z:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    return
}

; Mute/unmute Win1 mic.
; Pattern (ported from original):
; 1. Save current layout/focus
; 2. Move Win1 to known fixed position (matches coords when mic was measured)
; 3. ControlClick mic button at measured client coords
; 4. Restore previous layout
; 5. Re-activate whichever window was active before
;
; This works regardless of current mode (2-win, 1-win ghost, hidden).
; Win1 is briefly visible during the click, then immediately restored.
ToggleWin1Mute() {
    global g_hWin1, g_muted, g_currentLayout
    global MUTE_CLIENT_X, MUTE_CLIENT_Y
    global MUTE_WIN_X, MUTE_WIN_Y, MUTE_WIN_W, MUTE_WIN_H

    if (!IsActiveSession()) {
        LogEvent("Alt+Q ignored: no active interview session")
        return
    }
    if !IsAlive(g_hWin1) {
        LogEvent("Alt+Q failed: Win1 not alive")
        return
    }
    if GetKeyState("Alt", "P")
        KeyWait "Alt"

    ; Step 1: Save current layout and active window
    savedLayout := {
        mode:    g_currentLayout.mode,
        pos2Win: g_currentLayout.pos2Win,
        posWin1: g_currentLayout.posWin1,
        posWin2: g_currentLayout.posWin2
    }
    savedActive := WinGetID("A")

    ; Step 2: Make Win1 fully visible and move to known measured position
    RestoreWin1Visibility()
    WinMove MUTE_WIN_X, MUTE_WIN_Y, MUTE_WIN_W, MUTE_WIN_H, "ahk_id " g_hWin1
    Sleep 80

    ; Step 3: Click mic button using client-relative coords (no activation needed)
    ControlClick "x" MUTE_CLIENT_X " y" MUTE_CLIENT_Y, "ahk_id " g_hWin1, , "Left", 1, "NA"
    Sleep 100

    g_muted := !g_muted
    LogEvent("Alt+Q mute toggled; muted=" (g_muted ? "true" : "false"))

    ; Step 4: Restore previous layout (moves Win1 back, re-ghosts if needed)
    RestoreLayout(savedLayout)

    ; Step 5: Return focus to original window
    if (savedActive != 0 && WinExist("ahk_id " savedActive))
        WinActivate "ahk_id " savedActive
}

; ============================================================
;  HELPERS
; ============================================================

LogEvent(message) {
    global LOG_DIR, LOG_FILE
    try {
        if !DirExist(LOG_DIR)
            DirCreate LOG_DIR
        FileAppend FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss") " | " message "`n", LOG_FILE, "UTF-8"
    } catch {
        ; Silent by design: debug logging must never block a live interview hotkey.
    }
}

IsActiveSession() {
    global g_interviewActive
    return g_interviewActive
}

IsAlive(hWnd) {
    return (hWnd != 0 && WinExist("ahk_id " hWnd))
}

SendToWindow(msg, shortcut, hTarget) {
    global g_suppressClipMonitor
    if !IsAlive(hTarget) {
        LogEvent("SendToWindow failed: target not alive for " shortcut)
        return false
    }

    g_suppressClipMonitor := true
    savedClip := ""
    clipSaved := false

    try {
        if (msg != "") {
            savedClip := ClipboardAll()
            clipSaved := true
            A_Clipboard := msg
            Sleep 100
        }

        WinActivate "ahk_id " hTarget
        if GetKeyState("Alt", "P")
            KeyWait "Alt"

        if !WinWaitActive("ahk_id " hTarget, , 1) {
            LogEvent("SendToWindow failed: target did not become active for " shortcut)
            return false
        }

        Sleep 100
        Send shortcut
        Sleep 200
        return true
    } catch as err {
        LogEvent("SendToWindow exception for " shortcut ": " err.Message)
        return false
    } finally {
        if (clipSaved) {
            try {
                Sleep 400
                A_Clipboard := savedClip
            } catch {
                LogEvent("SendToWindow warning: failed to restore clipboard")
            }
        }
        g_suppressClipMonitor := false
    }
}
