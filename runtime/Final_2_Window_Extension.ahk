#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
;  PM INTERVIEW ASSISTANT — ChatGPT + Claude (Edge Default Profile)
;  Win1 = Sender (Voice/Transcription)
;  Win2 = Receiver (Answer / ChatGPT or Claude)
;
;  ALT+R         = Resume/JD + optional Session-setup GUI; launch/relaunch Win1/Win2 (PWA Mode)
;  ALT+ESC       = Resend PM boot prompt + current Resume/JD directly to Win2
;  ALT+DELETE    = Exit/terminate AHK session, no Resume/JD saved
;  ALT+TAB       = Hide/unhide current assistant windows (save/restore mode/layout)
;  ALT+BACKSPACE = Not used
;  ALT+CAPSLOCK  = Cycle visible modes: 2-win → Win1-only → Win2-only → 2-win
;  CAPSLOCK      = Cycle layout presets within current mode
;  ALT+Q         = Mute/unmute Win1 mic through provider DOM adapter
;  ALT+W         = Toggle scroll lock on Win2
;  ALT+E         = Export sender and receiver PM session records
; ============================================================

global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
global COMPOSER_READY_TIMEOUT_MS := 60000
global RUNTIME_LIFECYCLE_TIMEOUT_MS := 60000

; Default ChatGPT Project targets.
; PM_HELPER_PROJECT_URL is used by Alt+R for the live two-window PM helper runtime.
; REVIEW_LAB_PROJECT_URL is intentionally blank until the PM Interview Review Lab Project is created.
global PM_HELPER_PROJECT_URL := "https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project"
global REVIEW_LAB_PROJECT_URL := ""
global CLAUDE_URL := "https://claude.ai/new"

; Microphone control is handled by the extension provider adapter.
; No provider-specific screen coordinates are used.

if (A_Args.Length >= 1 && A_Args[1] = "--validate") {
    FileAppend "AHK_VALID`n", "*"
    ExitApp 0
}

SetCapsLockState "AlwaysOff"
SetTitleMatchMode 2
SendMode "Input"

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
;  Win2-only mode keeps Win1 alive/ghosted to avoid breaking the sender voice session.
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
global g_senderProviderDdl   := 0
global g_receiverProviderDdl := 0
global g_routeSummary        := 0
global g_contextStatus       := 0
global g_launchStatus        := 0
global g_launchButton        := 0
global g_sessionResume       := ""
global g_sessionJD           := ""
global g_sessionMeta         := ""
global g_senderProvider      := "chatgpt"
global g_receiverProvider    := "chatgpt"
global g_sessionId           := ""
global g_interviewActive     := false
global SETTINGS_DIR          := EnvGet("LOCALAPPDATA") "\PMInterviewAssistant"
global SETTINGS_FILE         := SETTINGS_DIR "\settings.ini"
global EDGE_USER_DATA_ROOT   := EnvGet("LOCALAPPDATA") "\Microsoft\Edge\User Data"
global PROFILE_DOCTOR_SCRIPT := A_ScriptDir "\Browser_Profile_Doctor.ps1"
global EXPECTED_EXTENSION_PATH := A_ScriptDir "\extension"
global LOG_DIR               := SETTINGS_DIR "\logs"
global LOG_FILE              := LOG_DIR "\session_debug.log"
global g_selectedProfileDirectory := "Default"
global g_layoutMode          := "TwoWindow"
global g_profileRecords      := []
global g_profileChoiceMap    := Map()
global g_selectedProfileRecord := Map()
global g_profileDdl          := 0
global g_layoutDdl           := 0
global g_runtimeHealth       := 0
global g_preflightButton     := 0
global g_repairButton        := 0
global g_shortContextArmedUntil := 0
global g_launchStateCode     := "PREFLIGHT"
global g_lastLaunchFailure   := Map()

LoadStudioPreferences()
ShowSessionLaunchGui()
~LAlt::return


; ============================================================
;  ALT+R — LAUNCH / RELAUNCH FLOW
;  Opens Resume/JD window first, then launches/relaunches in --app mode with
;  performance flags to prevent the background/ghost window from sleeping.
;  Resume/JD are kept only in this AHK process memory and never saved to disk.
; ============================================================

!r:: {
    ShowSessionLaunchGui()
}

LoadStudioPreferences() {
    global SETTINGS_DIR, SETTINGS_FILE
    global g_selectedProfileDirectory, g_senderProvider, g_receiverProvider, g_layoutMode
    DirCreate SETTINGS_DIR
    try {
        g_selectedProfileDirectory := IniRead(SETTINGS_FILE, "Studio", "ProfileDirectory", "Default")
        g_senderProvider := NormalizeProvider(IniRead(SETTINGS_FILE, "Studio", "SenderProvider", "chatgpt"))
        g_receiverProvider := NormalizeProvider(IniRead(SETTINGS_FILE, "Studio", "ReceiverProvider", "chatgpt"))
        g_layoutMode := NormalizeLayoutMode(IniRead(SETTINGS_FILE, "Studio", "LayoutMode", "TwoWindow"))
    } catch {
        g_selectedProfileDirectory := "Default"
        g_senderProvider := "chatgpt"
        g_receiverProvider := "chatgpt"
        g_layoutMode := "TwoWindow"
    }
}

SaveStudioPreferences() {
    global SETTINGS_DIR, SETTINGS_FILE
    global g_selectedProfileDirectory, g_senderProvider, g_receiverProvider, g_layoutMode
    DirCreate SETTINGS_DIR
    IniWrite g_selectedProfileDirectory, SETTINGS_FILE, "Studio", "ProfileDirectory"
    IniWrite g_senderProvider, SETTINGS_FILE, "Studio", "SenderProvider"
    IniWrite g_receiverProvider, SETTINGS_FILE, "Studio", "ReceiverProvider"
    IniWrite g_layoutMode, SETTINGS_FILE, "Studio", "LayoutMode"
}

RunProfileDoctor(profileDirectory := "") {
    global PROFILE_DOCTOR_SCRIPT, EDGE_USER_DATA_ROOT, EXPECTED_EXTENSION_PATH
    if !FileExist(PROFILE_DOCTOR_SCRIPT)
        return []
    command := 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' PROFILE_DOCTOR_SCRIPT '"'
        . ' -UserDataRoot "' EDGE_USER_DATA_ROOT '"'
        . ' -ExpectedExtensionPath "' EXPECTED_EXTENSION_PATH '"'
    if (profileDirectory != "")
        command .= ' -ProfileDirectory "' profileDirectory '"'
    try {
        process := ComObject("WScript.Shell").Exec(command)
        output := process.StdOut.ReadAll()
    } catch {
        return []
    }
    return ParseProfileDoctorOutput(output)
}

ParseProfileDoctorOutput(output) {
    lines := StrSplit(StrReplace(output, "`r"), "`n")
    if (lines.Length < 1 || Trim(lines[1]) = "")
        return []
    headers := StrSplit(lines[1], "`t")
    records := []
    Loop lines.Length - 1 {
        line := lines[A_Index + 1]
        if (Trim(line) = "")
            continue
        fields := StrSplit(line, "`t")
        record := Map()
        Loop headers.Length
            record[headers[A_Index]] := A_Index <= fields.Length ? fields[A_Index] : ""
        records.Push(record)
    }
    return records
}

SelectRecommendedProfile(records, savedDirectory := "") {
    if (savedDirectory != "") {
        for record in records {
            if (record["directory"] = savedDirectory && record["issueCode"] = "OK")
                return record
        }
    }
    for record in records {
        if (record["issueCode"] = "OK")
            return record
    }
    for record in records {
        if (record["directory"] = savedDirectory)
            return record
    }
    for record in records {
        if (record["directory"] = "Default")
            return record
    }
    return records.Length ? records[1] : Map()
}

RefreshRuntimeDoctor(updateUi := true) {
    global g_profileRecords, g_selectedProfileRecord, g_selectedProfileDirectory
    g_profileRecords := RunProfileDoctor()
    g_selectedProfileRecord := SelectRecommendedProfile(g_profileRecords, g_selectedProfileDirectory)
    if (g_selectedProfileRecord.Count)
        g_selectedProfileDirectory := g_selectedProfileRecord["directory"]
    if updateUi
        RenderDoctorStatus()
    return g_selectedProfileRecord
}

RefreshSelectedProfileDoctor() {
    global g_selectedProfileDirectory, g_selectedProfileRecord
    records := RunProfileDoctor(g_selectedProfileDirectory)
    g_selectedProfileRecord := records.Length ? records[1] : Map()
    return g_selectedProfileRecord
}

WaitForSelectedProfileReady(timeoutMs := 15000) {
    deadline := A_TickCount + Max(0, timeoutMs)
    loop {
        record := RefreshSelectedProfileDoctor()
        if !record.Count || record["issueCode"] != "EXTENSION_VERSION_MISMATCH"
            return record
        if (A_TickCount >= deadline)
            return record
        Sleep 500
    }
}

NormalizeProvider(value) {
    normalized := StrLower(Trim(value))
    return normalized = "claude" ? "claude" : "chatgpt"
}

NormalizeLayoutMode(value) {
    normalized := Trim(value)
    return (normalized = "SenderOnly" || normalized = "ReceiverOnly") ? normalized : "TwoWindow"
}

ShowSessionLaunchGui() {
    global g_launchGui, g_resumeEdit, g_jdEdit, g_metaEdit
    global g_sessionResume, g_sessionJD, g_sessionMeta
    global g_senderProviderDdl, g_receiverProviderDdl, g_senderProvider, g_receiverProvider
    global g_profileDdl, g_layoutDdl, g_layoutMode
    global g_routeSummary, g_contextStatus, g_launchStatus, g_launchButton
    global g_runtimeHealth, g_preflightButton, g_repairButton

    try {
        if IsObject(g_launchGui) {
            g_launchGui.Show()
            RefreshRuntimeDoctor()
            UpdateLaunchRouteSummary()
            UpdateLaunchContextStatus()
            return
        }
    }

    RefreshRuntimeDoctor(false)
    choices := BuildProfileChoices()
    g_launchGui := Gui("+AlwaysOnTop -MaximizeBox +MinSize960x780", "PM Interview Assistant — Session Studio")
    g_launchGui.BackColor := "F4F7FB"
    g_launchGui.SetFont("s10 c334155", "Segoe UI")

    title := g_launchGui.Add("Text", "x30 y20 w600 h34", "PM Interview Assistant")
    title.SetFont("s22 w700 c0F172A", "Segoe UI")
    subtitle := g_launchGui.Add("Text", "x30 y57 w600 h22", "Build and verify your live interview workspace")
    subtitle.SetFont("s10 c64748B", "Segoe UI")
    healthBox := g_launchGui.Add("GroupBox", "x30 y91 w900 h112", "Browser and runtime health")
    healthBox.SetFont("s10 w600 c334155", "Segoe UI")
    edgeLabel := g_launchGui.Add("Text", "x52 y121 w215 h20", "Microsoft Edge Stable")
    edgeLabel.SetFont("s10 w600 c0F172A", "Segoe UI")
    g_profileDdl := g_launchGui.Add("DropDownList", "x270 y116 w300", choices.labels)
    if (choices.selectedIndex > 0)
        g_profileDdl.Choose(choices.selectedIndex)
    g_runtimeHealth := g_launchGui.Add("Text", "x52 y154 w605 h28", "Checking PMIA runtime registration...")
    g_runtimeHealth.SetFont("s9 c64748B", "Segoe UI")
    g_preflightButton := g_launchGui.Add("Button", "x676 y118 w108 h32", "Run Preflight")
    g_repairButton := g_launchGui.Add("Button", "x792 y118 w112 h32", "Repair Launch")

    routeBox := g_launchGui.Add("GroupBox", "x30 y216 w900 h138", "Conversation route")
    routeBox.SetFont("s10 w600 c334155", "Segoe UI")
    g_launchGui.Add("Text", "x52 y246 w200 h20", "Question source")
    g_senderProviderDdl := g_launchGui.Add("DropDownList", "x52 y269 w205", ["ChatGPT", "Claude"])
    g_senderProviderDdl.Choose(g_senderProvider = "claude" ? 2 : 1)
    swapBtn := g_launchGui.Add("Button", "x423 y267 w114 h32", "Swap route")
    swapBtn.SetFont("s9 w600", "Segoe UI")
    g_launchGui.Add("Text", "x678 y246 w200 h20", "Answer workspace")
    g_receiverProviderDdl := g_launchGui.Add("DropDownList", "x678 y269 w205", ["ChatGPT", "Claude"])
    g_receiverProviderDdl.Choose(g_receiverProvider = "claude" ? 2 : 1)
    g_routeSummary := g_launchGui.Add("Text", "x52 y315 w830 h24", "")
    g_routeSummary.SetFont("s9 w600 c0F766E", "Segoe UI")
    contextBox := g_launchGui.Add("GroupBox", "x30 y367 w900 h300", "Interview context")
    contextBox.SetFont("s10 w600 c334155", "Segoe UI")
    g_launchGui.Add("Text", "x52 y396 w410 h20", "Resume")
    g_resumeEdit := g_launchGui.Add("Edit", "x52 y419 w412 h154 -Wrap WantTab", g_sessionResume)
    g_launchGui.Add("Text", "x478 y396 w410 h20", "Job description")
    g_jdEdit := g_launchGui.Add("Edit", "x478 y419 w412 h154 -Wrap WantTab", g_sessionJD)
    g_launchGui.Add("Text", "x52 y586 w610 h20", "Session notes (optional)")
    g_metaEdit := g_launchGui.Add("Edit", "x52 y609 w610 h38 -Wrap WantTab", g_sessionMeta)
    g_launchGui.Add("Text", "x678 y586 w210 h20", "Initial layout")
    g_layoutDdl := g_launchGui.Add("DropDownList", "x678 y609 w212", ["Two windows", "Sender only", "Receiver only"])
    g_layoutDdl.Choose(g_layoutMode = "SenderOnly" ? 2 : g_layoutMode = "ReceiverOnly" ? 3 : 1)
    g_contextStatus := g_launchGui.Add("Text", "x52 y650 w838 h18", "")
    g_contextStatus.SetFont("s9 c475569", "Segoe UI")

    privacy := g_launchGui.Add("Text", "x30 y687 w430 h22", "Resume, JD, and notes stay in memory.")
    privacy.SetFont("s9 c64748B", "Segoe UI")
    g_launchStatus := g_launchGui.Add("Text", "x30 y716 w555 h34", "PREFLIGHT  •  Ready to verify the selected browser profile")
    g_launchStatus.SetFont("s9 w600 c0F766E", "Segoe UI")
    closeBtn := g_launchGui.Add("Button", "x648 y705 w92 h38", "Close")
    g_launchButton := g_launchGui.Add("Button", "x750 y705 w180 h38 Default", "Launch Interview")
    g_launchButton.SetFont("s10 w600", "Segoe UI")
    g_profileDdl.OnEvent("Change", HandleProfileChange)
    g_senderProviderDdl.OnEvent("Change", UpdateLaunchRouteSummary)
    g_receiverProviderDdl.OnEvent("Change", UpdateLaunchRouteSummary)
    g_layoutDdl.OnEvent("Change", UpdateLaunchLayoutMode)
    g_resumeEdit.OnEvent("Change", UpdateLaunchContextStatus)
    g_jdEdit.OnEvent("Change", UpdateLaunchContextStatus)
    swapBtn.OnEvent("Click", SwapLaunchProviders)
    g_preflightButton.OnEvent("Click", RunStudioPreflight)
    g_repairButton.OnEvent("Click", RepairLaunch)
    g_launchButton.OnEvent("Click", StartLaunchFromGui)
    closeBtn.OnEvent("Click", CloseSessionLaunchGui)
    g_launchGui.OnEvent("Close", CloseSessionLaunchGui)
    g_launchGui.OnEvent("Escape", CloseSessionLaunchGui)

    RenderDoctorStatus()
    UpdateLaunchRouteSummary()
    UpdateLaunchContextStatus()
    g_launchGui.Show("w960 h780")
}

BuildProfileChoices() {
    global g_profileRecords, g_profileChoiceMap, g_selectedProfileDirectory
    labels := []
    g_profileChoiceMap := Map()
    selectedIndex := 0
    for record in g_profileRecords {
        label := record["displayName"] "  —  " record["directory"]
        labels.Push(label)
        g_profileChoiceMap[label] := record
        if (record["directory"] = g_selectedProfileDirectory)
            selectedIndex := labels.Length
    }
    if !labels.Length {
        labels.Push("Default  —  profile doctor unavailable")
        selectedIndex := 1
    }
    return {labels: labels, selectedIndex: selectedIndex}
}
HandleProfileChange(*) {
    global g_profileDdl, g_profileChoiceMap, g_selectedProfileDirectory, g_selectedProfileRecord
    if !IsObject(g_profileDdl)
        return
    label := g_profileDdl.Text
    if g_profileChoiceMap.Has(label) {
        g_selectedProfileRecord := g_profileChoiceMap[label]
        g_selectedProfileDirectory := g_selectedProfileRecord["directory"]
    }
    RenderDoctorStatus()
    SaveStudioPreferences()
}

RenderDoctorStatus() {
    global g_runtimeHealth, g_profileDdl, g_profileRecords, g_selectedProfileRecord
    if IsObject(g_profileDdl) {
        choices := BuildProfileChoices()
        g_profileDdl.Delete()
        g_profileDdl.Add(choices.labels)
        if (choices.selectedIndex > 0)
            g_profileDdl.Choose(choices.selectedIndex)
    }
    if !IsObject(g_runtimeHealth)
        return
    if !g_profileRecords.Length || !g_selectedProfileRecord.Count {
        g_runtimeHealth.Text := "Profile doctor failed. Verify Edge Stable and the PMIA extension manually."
        g_runtimeHealth.SetFont("s9 cB91C1C", "Segoe UI")
        return
    }
    code := g_selectedProfileRecord["issueCode"]
    version := g_selectedProfileRecord["version"]
    if (code = "OK") {
        g_runtimeHealth.Text := "PMIA " version " is registered from the expected path in this profile."
        g_runtimeHealth.SetFont("s9 c15803D", "Segoe UI")
    } else {
        g_runtimeHealth.Text := code ": " g_selectedProfileRecord["issueMessage"]
        g_runtimeHealth.SetFont("s9 cB45309", "Segoe UI")
    }
}
UpdateLaunchRouteSummary(*) {
    global g_senderProviderDdl, g_receiverProviderDdl, g_routeSummary
    global g_senderProvider, g_receiverProvider
    sender := IsObject(g_senderProviderDdl) ? g_senderProviderDdl.Text : "ChatGPT"
    receiver := IsObject(g_receiverProviderDdl) ? g_receiverProviderDdl.Text : "ChatGPT"
    g_senderProvider := NormalizeProvider(sender)
    g_receiverProvider := NormalizeProvider(receiver)
    if IsObject(g_routeSummary)
        g_routeSummary.Text := sender " captures the question  →  " receiver " prepares the live answer"
    SaveStudioPreferences()
}

SwapLaunchProviders(*) {
    global g_senderProviderDdl, g_receiverProviderDdl
    if !IsObject(g_senderProviderDdl) || !IsObject(g_receiverProviderDdl)
        return
    senderIndex := g_senderProviderDdl.Value
    g_senderProviderDdl.Choose(g_receiverProviderDdl.Value)
    g_receiverProviderDdl.Choose(senderIndex)
    UpdateLaunchRouteSummary()
}

UpdateLaunchLayoutMode(*) {
    global g_layoutDdl, g_layoutMode
    if !IsObject(g_layoutDdl)
        return
    g_layoutMode := g_layoutDdl.Value = 2 ? "SenderOnly" : g_layoutDdl.Value = 3 ? "ReceiverOnly" : "TwoWindow"
    SaveStudioPreferences()
}

UpdateLaunchContextStatus(*) {
    global g_resumeEdit, g_jdEdit, g_contextStatus
    ResetShortContextConfirmation()
    if !IsObject(g_contextStatus)
        return
    resumeChars := IsObject(g_resumeEdit) ? StrLen(Trim(g_resumeEdit.Value)) : 0
    jdChars := IsObject(g_jdEdit) ? StrLen(Trim(g_jdEdit.Value)) : 0
    readiness := (resumeChars >= 100 && jdChars >= 100) ? "Context ready" : "More context recommended"
    g_contextStatus.Text := "Resume: " resumeChars " characters   •   Job description: " jdChars " characters   •   " readiness
}
ArmShortContextConfirmation() {
    global g_shortContextArmedUntil, g_launchButton
    g_shortContextArmedUntil := A_TickCount + 10000
    if IsObject(g_launchButton)
        g_launchButton.Text := "Launch Anyway"
    SetLaunchState("PREFLIGHT", "Resume or JD is short. Click Launch Anyway within 10 seconds.", "warn")
    SetTimer ResetShortContextConfirmation, -10000
}

ResetShortContextConfirmation(*) {
    global g_shortContextArmedUntil, g_launchButton
    g_shortContextArmedUntil := 0
    if IsObject(g_launchButton)
        g_launchButton.Text := "Launch Interview"
}

StartLaunchFromGui(*) {
    global g_resumeEdit, g_jdEdit, g_metaEdit
    global g_sessionResume, g_sessionJD, g_sessionMeta
    global g_senderProviderDdl, g_receiverProviderDdl, g_senderProvider, g_receiverProvider
    global g_shortContextArmedUntil

    if IsObject(g_resumeEdit)
        g_sessionResume := g_resumeEdit.Value
    if IsObject(g_jdEdit)
        g_sessionJD := g_jdEdit.Value
    if IsObject(g_metaEdit)
        g_sessionMeta := g_metaEdit.Value
    if IsObject(g_senderProviderDdl)
        g_senderProvider := NormalizeProvider(g_senderProviderDdl.Text)
    if IsObject(g_receiverProviderDdl)
        g_receiverProvider := NormalizeProvider(g_receiverProviderDdl.Text)

    shortContext := StrLen(Trim(g_sessionResume)) < 100 || StrLen(Trim(g_sessionJD)) < 100
    if shortContext && (g_shortContextArmedUntil = 0 || A_TickCount > g_shortContextArmedUntil) {
        ArmShortContextConfirmation()
        return
    }
    ResetShortContextConfirmation()
    SaveStudioPreferences()
    RunManagedLaunch(false)
}
CloseSessionLaunchGui(*) {
    global g_launchGui, g_resumeEdit, g_jdEdit, g_metaEdit
    global g_senderProviderDdl, g_receiverProviderDdl, g_profileDdl, g_layoutDdl
    global g_routeSummary, g_contextStatus, g_launchStatus, g_launchButton
    global g_runtimeHealth, g_preflightButton, g_repairButton
    try {
        if IsObject(g_launchGui)
            g_launchGui.Destroy()
    }
    g_launchGui := 0
    g_resumeEdit := 0
    g_jdEdit := 0
    g_metaEdit := 0
    g_senderProviderDdl := 0
    g_receiverProviderDdl := 0
    g_profileDdl := 0
    g_layoutDdl := 0
    g_routeSummary := 0
    g_contextStatus := 0
    g_launchStatus := 0
    g_runtimeHealth := 0
    g_preflightButton := 0
    g_repairButton := 0
    g_launchButton := 0
    ResetShortContextConfirmation()
}

SetLaunchState(code, message, tone := "info") {
    global g_launchStateCode, g_launchStatus
    g_launchStateCode := code
    LogEvent("Launch state " code ": " message)
    if !IsObject(g_launchStatus)
        return
    g_launchStatus.Text := code "  •  " message
    color := tone = "ok" ? "15803D" : tone = "warn" ? "B45309" : tone = "error" ? "B91C1C" : "0F766E"
    g_launchStatus.SetFont("s9 w600 c" color, "Segoe UI")
}
RunStudioPreflight(*) {
    global g_preflightButton, g_selectedProfileRecord
    if IsObject(g_preflightButton)
        g_preflightButton.Enabled := false
    SetLaunchState("PREFLIGHT", "Checking Edge profile and PMIA extension registration...", "info")
    WaitForSelectedProfileReady()
    RenderDoctorStatus()
    if (g_selectedProfileRecord.Count && g_selectedProfileRecord["issueCode"] = "OK") {
        SetLaunchState("PREFLIGHT", "Selected Edge profile and PMIA runtime path verified.", "ok")
        result := true
    } else {
        code := g_selectedProfileRecord.Count ? g_selectedProfileRecord["issueCode"] : "PROFILE_DOCTOR_FAILED"
        message := g_selectedProfileRecord.Count ? g_selectedProfileRecord["issueMessage"] : "Profile doctor returned no usable records."
        SetLaunchState("ERROR", code ": " message, "error")
        result := false
    }
    if IsObject(g_preflightButton)
        g_preflightButton.Enabled := true
    return result
}

FindLifecycleWindow(role, provider, sessionId, minimumPhase := "boot") {
    phases := minimumPhase = "ready" ? ["ready"]
        : minimumPhase = "registered" ? ["ready", "registered"]
        : ["ready", "registered", "boot"]
    for phase in phases {
        title := RuntimeLifecycleTitle(role, provider, sessionId, phase)
        hwnd := WinExist(title)
        if hwnd
            return Map("hwnd", hwnd, "phase", phase, "title", title)
    }
    return Map()
}

WaitForLifecycleTitle(role, provider, sessionId, phase, timeoutMs) {
    deadline := A_TickCount + Max(0, timeoutMs)
    loop {
        match := FindLifecycleWindow(role, provider, sessionId, phase)
        if match.Count
            return match
        if (A_TickCount >= deadline)
            return Map()
        Sleep 100
    }
}
DiagnoseLaunchFailure(stage, role := "") {
    global g_selectedProfileRecord, g_lastLaunchFailure
    RefreshSelectedProfileDoctor()
    if !g_selectedProfileRecord.Count {
        result := Map("code", "PROFILE_DOCTOR_FAILED", "message", "Could not inspect Edge profile registration.")
    } else if (g_selectedProfileRecord["issueCode"] != "OK") {
        result := Map("code", g_selectedProfileRecord["issueCode"], "message", g_selectedProfileRecord["issueMessage"])
    } else if (stage = "boot") {
        result := Map("code", "EXTENSION_NOT_BOOTED", "message", role " window opened but PMIA did not start.")
    } else if (stage = "registered") {
        result := Map("code", "EXTENSION_NOT_REGISTERED", "message", role " runtime did not register with the PMIA background service.")
    } else {
        result := Map("code", "PROVIDER_NOT_READY", "message", role " provider composer was not ready before timeout.")
    }
    g_lastLaunchFailure := result
    SetLaunchState("ERROR", result["code"] ": " result["message"], "error")
    RenderDoctorStatus()
    return result
}

WaitForLifecyclePair(phase, timeoutMs) {
    global g_senderProvider, g_receiverProvider, g_sessionId
    deadline := A_TickCount + timeoutMs
    sender := WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, phase, Max(0, deadline - A_TickCount))
    if !sender.Count
        return Map("ok", false, "role", "sender")
    receiver := WaitForLifecycleTitle("receiver", g_receiverProvider, g_sessionId, phase, Max(0, deadline - A_TickCount))
    if !receiver.Count
        return Map("ok", false, "role", "receiver")
    return Map("ok", true, "sender", sender, "receiver", receiver)
}

RunManagedLaunch(reuseSession := false) {
    global g_hWin1, g_hWin2, BrowserExe, g_interviewActive
    global g_mode, g_pos2Win, g_posWin1, g_posWin2
    global g_layoutEnteredAt, g_currentLayout, g_lastStableLayout
    global g_senderProvider, g_receiverProvider, g_sessionId
    global g_selectedProfileDirectory, g_layoutMode, g_launchButton, g_launchGui

    if !RunStudioPreflight()
        return false
    if !FileExist(BrowserExe) {
        SetLaunchState("ERROR", "Microsoft Edge Stable was not found at the configured path.", "error")
        return false
    }
    if IsObject(g_launchButton)
        g_launchButton.Enabled := false
    g_interviewActive := false
    if !reuseSession || (g_sessionId = "") {
        CloseManagedPmiaWindows()
        g_sessionId := CreateSessionId()
    } else {
        CloseManagedPmiaWindows(g_sessionId)
    }
    SetLaunchState("LAUNCHING", "Opening managed Edge windows in profile " g_selectedProfileDirectory "...", "info")
    flags := " --disable-background-timer-throttling"
        . " --disable-backgrounding-occluded-windows"
        . " --disable-renderer-backgrounding"
        . " --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling"
    senderUrl := UrlWithRuntime(ProviderUrl(g_senderProvider), g_sessionId, "sender", g_senderProvider)
    receiverUrl := UrlWithRuntime(ProviderUrl(g_receiverProvider), g_sessionId, "receiver", g_receiverProvider)
    Run BrowserExe ' --new-window --profile-directory="' g_selectedProfileDirectory '" --app="' senderUrl '"' . flags
    SetLaunchState("WAITING_BOOT", "Waiting for PMIA sender runtime...", "info")
    senderBoot := WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, "boot", RUNTIME_LIFECYCLE_TIMEOUT_MS)
    if !senderBoot.Count {
        DiagnoseLaunchFailure("boot", "sender")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }

    SetLaunchState("WAITING_REGISTRATION", "Sender started; waiting for sender registration...", "info")
    senderRegistered := WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, "registered", RUNTIME_LIFECYCLE_TIMEOUT_MS)
    if !senderRegistered.Count {
        DiagnoseLaunchFailure("registered", "sender")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }
    try WinActivate "ahk_id " senderRegistered["hwnd"]
    Sleep 250

    SetLaunchState("WAITING_COMPOSER", "Sender registered; waiting for sender composer...", "info")
    senderReady := WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, "ready", COMPOSER_READY_TIMEOUT_MS)
    if !senderReady.Count {
        DiagnoseLaunchFailure("ready", "sender")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }

    Run BrowserExe ' --new-window --profile-directory="' g_selectedProfileDirectory '" --app="' receiverUrl '"' . flags
    SetLaunchState("WAITING_BOOT", "Sender ready; waiting for PMIA receiver runtime...", "info")
    receiverBoot := WaitForLifecycleTitle("receiver", g_receiverProvider, g_sessionId, "boot", RUNTIME_LIFECYCLE_TIMEOUT_MS)
    if !receiverBoot.Count {
        DiagnoseLaunchFailure("boot", "receiver")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }

    SetLaunchState("WAITING_REGISTRATION", "Receiver started; waiting for receiver registration...", "info")
    receiverRegistered := WaitForLifecycleTitle("receiver", g_receiverProvider, g_sessionId, "registered", RUNTIME_LIFECYCLE_TIMEOUT_MS)
    if !receiverRegistered.Count {
        DiagnoseLaunchFailure("registered", "receiver")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }
    try WinActivate "ahk_id " receiverRegistered["hwnd"]
    Sleep 250

    SetLaunchState("WAITING_COMPOSER", "Receiver registered; waiting for receiver composer...", "info")
    receiverReady := WaitForLifecycleTitle("receiver", g_receiverProvider, g_sessionId, "ready", COMPOSER_READY_TIMEOUT_MS)
    if !receiverReady.Count {
        DiagnoseLaunchFailure("ready", "receiver")
        if IsObject(g_launchButton)
            g_launchButton.Enabled := true
        return false
    }
    readyPair := Map("ok", true, "sender", senderReady, "receiver", receiverReady)

    g_hWin1 := readyPair["sender"]["hwnd"]
    g_hWin2 := readyPair["receiver"]["hwnd"]
    EnsureAlwaysOnTop(g_hWin1)
    EnsureAlwaysOnTop(g_hWin2)
    ApplyConfiguredInitialLayout()
    SendToWindow(BuildBootPrompt(), "^+{F5}", g_hWin1)
    g_interviewActive := true
    SaveStudioPreferences()
    SetLaunchState("READY", "Session linked and boot context delivered.", "ok")
    if IsObject(g_launchButton)
        g_launchButton.Enabled := true
    Sleep 500
    if IsObject(g_launchGui)
        g_launchGui.Hide()
    WinActivate "ahk_id " g_hWin2
    return true
}
ApplyConfiguredInitialLayout() {
    global g_layoutMode, g_mode, g_pos2Win, g_posWin1, g_posWin2, g_lastStableLayout
    g_pos2Win := 1
    g_posWin1 := 1
    g_posWin2 := 1
    g_lastStableLayout := 0
    if (g_layoutMode = "SenderOnly") {
        g_mode := 2
        ApplyWin1OnlyLayout(1)
        RecordLayoutChange(2, 1, 1, 1)
    } else if (g_layoutMode = "ReceiverOnly") {
        g_mode := 3
        ApplyWin2OnlyLayout(1)
        RecordLayoutChange(3, 1, 1, 1)
    } else {
        g_mode := 1
        Apply2WinLayout(1)
        RecordLayoutChange(1, 1, 1, 1)
    }
}

RepairLaunch(*) {
    global g_selectedProfileRecord, g_lastLaunchFailure, BrowserExe, g_selectedProfileDirectory
    RefreshSelectedProfileDoctor()
    RenderDoctorStatus()
    issue := g_selectedProfileRecord.Count ? g_selectedProfileRecord["issueCode"] : "PROFILE_DOCTOR_FAILED"
    lastCode := g_lastLaunchFailure.Count ? g_lastLaunchFailure["code"] : ""
    if (issue != "OK" || InStr(lastCode, "EXTENSION_") || lastCode = "PROFILE_DOCTOR_FAILED") {
        extensionId := g_selectedProfileRecord.Count ? g_selectedProfileRecord["extensionId"] : ""
        repairUrl := extensionId != "" ? "edge://extensions/?id=" extensionId : "edge://extensions/"
        Run BrowserExe ' --new-window --profile-directory="' g_selectedProfileDirectory '" "' repairUrl '"'
        SetLaunchState("ERROR", "Opened Edge extension settings for the selected profile. Reload or correct PMIA, then run Preflight.", "warn")
        return false
    }
    SetLaunchState("LAUNCHING", "Retrying the current route with the same session context...", "info")
    return RunManagedLaunch(true)
}

CloseManagedPmiaWindows(sessionId := "") {
    managed := []
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        suffix := sessionId = "" ? "" : StrUpper(RegExReplace(sessionId, "[^A-Za-z0-9]+", "_"))
        for hwnd in WinGetList("ahk_exe msedge.exe") {
            title := ""
            try title := WinGetTitle("ahk_id " hwnd)
            catch
                continue
            if !RegExMatch(title, "^PMIA_(?:BOOT_|REGISTERED_)?(SENDER|RECEIVER)_(CHATGPT|CLAUDE)_")
                continue
            if (suffix != "" && !InStr(title, suffix))
                continue
            managed.Push(hwnd)
            try WinClose "ahk_id " hwnd
        }
        deadline := A_TickCount + 3000
        for hwnd in managed {
            while IsAlive(hwnd) && A_TickCount < deadline
                Sleep 50
            if IsAlive(hwnd)
                try WinKill "ahk_id " hwnd
        }
    } finally {
        DetectHiddenWindows previousDetectHidden
    }
}
AutoStartup() {
    return RunManagedLaunch(false)
}

ProviderUrl(provider) {
    global PM_HELPER_PROJECT_URL, CLAUDE_URL
    return provider = "claude" ? CLAUDE_URL : PM_HELPER_PROJECT_URL
}

UrlWithRuntime(baseUrl, sessionId, role, provider) {
    sep := InStr(baseUrl, "?") ? "&" : "?"
    return baseUrl . sep
        . "pmia_session=" . sessionId
        . "&pmia_role=" . role
        . "&pmia_provider=" . provider
}

RuntimeWindowTitle(role, provider, sessionId := "") {
    title := "PMIA_" . StrUpper(role) . "_" . StrUpper(provider)
    if (sessionId != "")
        title .= "_" . StrUpper(RegExReplace(sessionId, "[^A-Za-z0-9]+", "_"))
    return title
}

RuntimeLifecycleTitle(role, provider, sessionId, phase := "ready") {
    base := RuntimeWindowTitle(role, provider, sessionId)
    if (phase = "boot")
        return "PMIA_BOOT_" SubStr(base, 6)
    if (phase = "registered")
        return "PMIA_REGISTERED_" SubStr(base, 6)
    return base
}

CreateSessionId() {
    return "pmia_" . FormatTime(A_Now, "yyyyMMdd_HHmmss") . "_" . Random(1000, 9999)
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
    global g_interviewActive, g_hWin1, g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    LogEvent("Alt+Delete exit requested")
    if IsActiveSession() {
        target := IsAlive(g_hWin1) ? g_hWin1 : g_hWin2
        if IsAlive(target)
            SendToWindow("", "^+{F4}", target)
        Sleep 500
    }
    g_interviewActive := false
    CloseManagedPmiaWindows()
    ExitApp
}

; Alt+E — Export PM session from Win2
!e:: {
    global g_hWin1, g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if (!IsActiveSession()) {
        LogEvent("Alt+E ignored: no active interview session")
        return
    }

    exported := false
    if IsAlive(g_hWin1) {
        if SendToWindow("", "^+{F8}", g_hWin1) {
            LogEvent("Alt+E sender export triggered")
            exported := true
        }
    } else {
        LogEvent("Alt+E sender export skipped: Win1 not alive")
    }

    Sleep 180
    if IsAlive(g_hWin2) {
        if SendToWindow("", "^+{F8}", g_hWin2) {
            LogEvent("Alt+E receiver export triggered")
            exported := true
        }
    } else {
        LogEvent("Alt+E receiver export skipped: Win2 not alive")
    }

    if !exported
        LogEvent("Alt+E failed: no managed window accepted export")
}

; Alt+Q — Mute/unmute Win1 mic through the active provider adapter.
!q:: {
    ToggleWin1Mute()
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

; Mute/unmute Win1 mic through the extension adapter.
; This avoids provider-specific coordinates and works for ChatGPT or Claude
; whenever the provider exposes an accessible mute/unmute microphone control.
ToggleWin1Mute() {
    global g_hWin1, g_muted

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

    if SendToWindow("", "^+{F6}", g_hWin1) {
        g_muted := !g_muted
        LogEvent("Alt+Q provider mute toggle requested; local_state=" (g_muted ? "muted" : "unmuted"))
    }
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
    return RefreshManagedWindowHandles()
}

RefreshManagedWindowHandles() {
    global g_sessionId, g_senderProvider, g_receiverProvider
    global g_hWin1, g_hWin2
    if (g_sessionId = "")
        return false
    g_hWin1 := 0
    g_hWin2 := 0
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        sender := FindLifecycleWindow("sender", g_senderProvider, g_sessionId, "boot")
        receiver := FindLifecycleWindow("receiver", g_receiverProvider, g_sessionId, "boot")
        if sender.Count
            g_hWin1 := sender["hwnd"]
        if receiver.Count
            g_hWin2 := receiver["hwnd"]
    } finally {
        DetectHiddenWindows previousDetectHidden
    }
    return IsAlive(g_hWin1) && IsAlive(g_hWin2)
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
