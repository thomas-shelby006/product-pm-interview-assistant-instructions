# PM Interview Export Schema — Source File

Use this as supporting reference for PM Interview Helper and the local Tampermonkey bridge.

This file defines what the session export should capture when Sundar presses `Alt+E`.

The export is used after a live or mock interview to review:

- answer quality
- answer length
- PM framing
- route selection
- story usage
- metrics quality
- truth risk
- JD alignment
- follow-up handling
- source-file improvement needs

This file is not for live answering.

## Runtime context

The local setup is:

- Main runtime: `Final_2_Window_Fixed.ahk`
- Win1: ChatGPT Voice / transcript sender
- Win2: ChatGPT answer receiver
- Bridge: `tm_scripts/bridge.user.js`
- Virtual scroll: `tm_scripts/virtual-scroll.user.js`
- Transport: `localStorage` using `vb_payload`
- Export shortcut: `Alt+E`
- Browser-side export trigger: `Ctrl+Shift+F8`

The export should not require a CMD launcher, unpacked extension, extra server, or manual file merge.

## Core principle

The export should be reliable, lightweight, and reviewable.

It does not need to perfectly capture everything.

Minimum useful export:

- raw interviewer transcript
- cleaned/forwarded question
- assistant answer if captured
- timestamped events
- answer word count if captured
- warnings if answer capture failed

Do not make the live interview flow fragile just to capture more data.

If answer capture fails, still export transcript and forwarded-question events.

## Privacy and session-context rule

Resume and JD are provided at launch through the AHK Resume/JD GUI.

They are valid only during the current AHK process.

Do not export full Resume/JD by default.

Preferred export behavior:

- record that Resume was provided: yes/no
- record that JD was provided: yes/no
- optionally record a short inferred target domain
- optionally record a short inferred target role
- do not include full Resume text
- do not include full JD text

Never include:

- browser cookies
- auth tokens
- account data
- hidden reasoning
- full resume/JD unless explicitly enabled later

## Export formats

Primary format:

```text
JSON
```

Optional format:

```text
Markdown
```

If Markdown export is unreliable, skip it.

JSON export must be prioritized.

## File naming

Recommended JSON filename:

```text
pm_interview_session_YYYY-MM-DD_HH-mm.json
```

Optional Markdown filename:

```text
pm_interview_session_YYYY-MM-DD_HH-mm.md
```

Use local time.

## Top-level JSON schema

```json
{
  "schema_version": "1.1",
  "session_id": "pm-session-YYYYMMDD-HHmmss",
  "exported_at": "2026-05-17T21:30:00+05:30",
  "runtime_metadata": {},
  "session_metadata": {},
  "answer_length_policy": {},
  "session_context_summary": {},
  "events": [],
  "qa_pairs": [],
  "summary": {},
  "warnings": []
}
```

## `runtime_metadata`

Use this for system/debug context.

```json
{
  "runtime": "AHK + Tampermonkey",
  "ahk_file": "Final_2_Window_Fixed.ahk",
  "bridge_script": "tm_scripts/bridge.user.js",
  "virtual_scroll_script": "tm_scripts/virtual-scroll.user.js",
  "focus_script_active": false,
  "win1_role": "VB_SENDER",
  "win2_role": "VB_RECEIVER",
  "transport": "localStorage vb_payload",
  "export_trigger": "Alt+E / Ctrl+Shift+F8",
  "shortcut_map_version": "pm-final",
  "project_source_version": "unknown"
}
```

Rules:

- Keep this simple.
- Do not include local machine secrets.
- Do not include unnecessary file paths unless helpful for debugging.

## `session_metadata`

Use this for interview-level context.

```json
{
  "session_type": "live_interview | mock_interview | practice | unknown",
  "target_role": "Product Manager | Technical Product Manager | Product Owner | AI Product Manager | unknown",
  "target_company": "string | unknown",
  "target_domain": "B2B fintech SaaS | workflow automation | data analytics | manufacturing operations | unknown",
  "interview_round": "recruiter | hiring_manager | product_sense | metrics | behavioral | case | technical_product | unknown",
  "resume_provided": true,
  "job_description_provided": true,
  "resume_exported": false,
  "job_description_exported": false
}
```

Rules:

- Use `"unknown"` when not available.
- Do not hallucinate target role, company, or domain.
- If inferred from the JD, mark it as inferred in `session_context_summary`.

## `answer_length_policy`

Use the finalized live-answer word limits.

```json
{
  "wpm_baseline": 127,
  "effective_wpm_range": "127-130",
  "limits": {
    "quick_follow_up_or_clarification": "30-55 words",
    "simple_conceptual_pm_answer": "55-75 words",
    "comparison_or_tradeoff": "75-100 words",
    "standard_pm_execution_metrics_prioritization": "90-130 words",
    "product_sense_strategy_setup": "130-180 words",
    "estimation_market_sizing": "130-160 words",
    "behavioral_story": "120-150 words",
    "full_deeper_walkthrough": "150-180 words hard cap"
  },
  "hard_cap_words": 180
}
```

Post-session review should use this to flag:

- good length
- slightly long
- too long
- too short / underdeveloped

Hard rule:

Any live answer above 180 words should be flagged unless the interviewer clearly asked for a deep walkthrough.

## `session_context_summary`

This summarizes session context without exporting full Resume/JD.

```json
{
  "resume_provided": true,
  "job_description_provided": true,
  "inferred_target_role": "Product Manager",
  "inferred_target_domain": "B2B fintech SaaS",
  "inferred_target_company": "unknown",
  "story_anchors_available": [
    "TPI Composites",
    "Pemo",
    "DataCaliper"
  ],
  "notes": [
    "Resume/JD were used as silent session context.",
    "Full Resume/JD not exported by default.",
    "Session context should not be reused after AHK restart."
  ]
}
```

Optional future fields:

```json
{
  "resume_digest": "short non-sensitive summary",
  "jd_digest": "short non-sensitive summary"
}
```

Do not include full Resume/JD unless a future explicit export mode is added.

## Event schema

Each logged event should use this structure.

```json
{
  "event_id": "evt_0001",
  "timestamp": "2026-05-17T21:10:02+05:30",
  "source": "win1 | win2 | bridge | ahk | system",
  "event_type": "string",
  "raw_text": "string",
  "cleaned_text": "string",
  "metadata": {}
}
```

## Recommended event types

```text
session_started
boot_prompt_sent
resume_jd_context_sent
win1_transcript_received
transcript_ignored_as_filler
question_forwarded_to_win2
answer_generation_started
answer_captured
answer_capture_failed
answer_regenerated
scroll_lock_toggled
screenshot_context_sent
export_triggered
export_completed
error
warning
```

Minimum useful event types:

```text
boot_prompt_sent
resume_jd_context_sent
win1_transcript_received
question_forwarded_to_win2
answer_captured
answer_capture_failed
export_triggered
export_completed
error
```

Do not block export if some events are missing.

## `qa_pairs`

This is the most important structure for post-session review.

Each interviewer question and assistant answer should be paired when possible.

```json
{
  "qa_id": "qa_0001",
  "timestamp_start": "2026-05-17T21:12:10+05:30",
  "timestamp_end": "2026-05-17T21:13:02+05:30",
  "raw_transcript": "raw interviewer transcript from Win1",
  "cleaned_question": "cleaned latest actionable interviewer question",
  "assistant_answer": "captured Win2 answer, if available",
  "answer_capture_status": "captured | missing | partial | failed",
  "word_count": 118,
  "estimated_read_seconds_at_127_wpm": 56,
  "route_guess": "METRICS",
  "likely_company_anchor": "Pemo",
  "truth_risk_flags": [],
  "length_flag": "good_length",
  "notes": []
}
```

If automatic Q&A pairing is not reliable, export events and let post-session review infer pairs.

## `route_guess`

Use only if available or easy to infer.

Allowed values:

```text
WHY-PM
BEHAVIORAL
PRODUCT-SENSE
EXECUTION
METRICS
STRATEGY
ESTIMATION
TECH-TO-PM
PO-AGILE
AI-PM
COMPANY-STORY
CLARIFY
UNKNOWN
```

If route detection is not implemented, use:

```json
"route_guess": "UNKNOWN"
```

Do not block export because the route is unknown.

`route_guess` is heuristic. It is for post-session review only and should not be treated as a guaranteed classifier.

## `likely_company_anchor`

Allowed values:

```text
TPI Composites
Pemo
DataCaliper
Cross-company
None
Unknown
```

Rules:

- Use `Pemo` for fintech, B2B SaaS, onboarding, activation, expense automation, approvals, corporate cards, finance workflows.
- Use `TPI Composites` for manufacturing, operations, quality systems, internal tools, production visibility.
- Use `DataCaliper` for analytics, dashboards, decision support, data trust, current role.
- Use `Cross-company` for tell-me-about-yourself or career-arc answers.
- Use `None` if no story was needed.
- Use `Unknown` if unclear.

## `truth_risk_flags`

Use this list to support post-session truth review.

Possible values:

```text
fake_metric_risk
ownership_overclaim_risk
roadmap_overclaim_risk
revenue_claim_risk
customer_name_risk
ab_test_claim_risk
user_research_claim_risk
team_size_claim_risk
compliance_ownership_risk
ai_model_ownership_risk
data_caliper_overclaim_risk
tpi_strategy_overclaim_risk
pemo_platform_overclaim_risk
frontend_swe_drift
none
```

If no risk is detected:

```json
"truth_risk_flags": []
```

Do not overuse flags. Flag only meaningful risks.

## `length_flag`

Allowed values:

```text
good_length
slightly_long
too_long
too_short
unknown
```

Recommended logic:

- quick follow-up over 55 words → `slightly_long` or `too_long`
- simple conceptual over 75 words → `slightly_long`
- comparison/tradeoff over 100 words → `slightly_long`
- standard PM answer over 130 words → `slightly_long`
- product sense/strategy setup over 180 words → `slightly_long`
- estimation/market-sizing answer over 160 words → `slightly_long`
- behavioral answer over 150 words → `slightly_long`
- any live answer over 180 words → `too_long`
- non-follow-up answer under 30 words → `too_short`

If route is unknown, use the 180-word hard cap.

## `summary`

Optional session-level summary.

```json
{
  "total_questions": 0,
  "answers_captured": 0,
  "answers_missing": 0,
  "average_word_count": 0,
  "too_long_count": 0,
  "truth_risk_count": 0,
  "routes_seen": [],
  "company_anchors_seen": [],
  "export_notes": []
}
```

If not implemented, omit this field or leave values blank.

## `warnings`

Use warnings for limitations.

```json
[
  {
    "type": "answer_capture_best_effort",
    "message": "Answer capture depends on ChatGPT DOM structure and may miss some answers."
  },
  {
    "type": "duplicate_script_risk",
    "message": "Duplicate older Tampermonkey scripts may cause bridge conflicts."
  }
]
```

Common warnings:

```text
answer_capture_best_effort
answer_capture_failed
missing_resume_context
missing_jd_context
duplicate_script_risk
dom_capture_error
partial_transcript
unknown_route
unknown_company_anchor
```

## Markdown export format

If Markdown export is implemented, use this format.

```markdown
# PM Interview Session Export

## Session Metadata

- Exported at:
- Target role:
- Target company:
- Target domain:
- Resume provided:
- JD provided:
- Runtime:
- WPM baseline:

## Answer Length Policy

- Quick follow-up / clarification:
- Simple conceptual:
- Comparison / tradeoff:
- Standard PM answer:
- Product sense / strategy / estimation setup:
- Behavioral story:
- Full/deeper walkthrough:

## Q&A Log

### Q1

**Raw transcript:**  
...

**Cleaned question:**  
...

**Assistant answer:**  
...

**Word count:**  
...

**Estimated read time:**  
...

**Route guess:**  
...

**Company anchor:**  
...

**Truth-risk flags:**  
...

**Length flag:**  
...

---

## Warnings

-
-
```

Markdown export is optional.

JSON export is primary.

## Minimum viable export

If the bridge can only capture limited information, export this:

```json
{
  "schema_version": "1.1",
  "session_id": "pm-session-YYYYMMDD-HHmmss",
  "exported_at": "timestamp",
  "runtime_metadata": {
    "runtime": "AHK + Tampermonkey",
    "transport": "localStorage vb_payload"
  },
  "answer_length_policy": {
    "wpm_baseline": 127,
    "hard_cap_words": 180
  },
  "events": [
    {
      "timestamp": "timestamp",
      "source": "win1",
      "event_type": "win1_transcript_received",
      "raw_text": "..."
    },
    {
      "timestamp": "timestamp",
      "source": "win2",
      "event_type": "question_forwarded_to_win2",
      "cleaned_text": "..."
    }
  ],
  "warnings": [
    {
      "type": "answer_capture_best_effort",
      "message": "Answer capture may be incomplete."
    }
  ]
}
```

Minimum export is acceptable.

No export is not acceptable.

## Post-session review compatibility

The export should allow `PM_INTERVIEW_POST_SESSION_REVIEW_PROMPT.md` to evaluate:

- answer length
- route fit
- PM framing
- story relevance
- truth risk
- JD alignment
- follow-up handling
- source-file improvement needs

Most valuable fields:

1. `cleaned_question`
2. `assistant_answer`
3. `word_count`
4. `route_guess`
5. `likely_company_anchor`
6. `truth_risk_flags`
7. `length_flag`
8. `warnings`

If these cannot be captured automatically, they can be inferred during post-session review.

## Do not export

Do not include by default:

- full Resume
- full JD
- browser cookies
- account information
- auth tokens
- email addresses unless already in answer text
- local machine secrets
- hidden chain-of-thought
- internal model reasoning

## Final export checklist

Before exporting, check:

1. Is `schema_version` present?
2. Is `session_id` present?
3. Is `exported_at` present?
4. Is runtime metadata included?
5. Is answer-length policy included?
6. Are events included?
7. Are Q&A pairs included if available?
8. Are answer word counts included if answers were captured?
9. Are warnings included for capture limitations?
10. Is full Resume/JD excluded by default?
11. Is JSON export prioritized over Markdown?

## Final note

The export must be:

- simple enough not to break live answering
- structured enough for post-session review
- safe enough not to leak Resume/JD by default
- useful even when answer capture is imperfect


## AI/tech PM export fields

Post-session review may infer these optional labels from Q&A pairs:

- ai_product_signal: none | workflow_automation | decision_support | categorization | risk_signal | dashboard_insight | unknown
- technical_pm_signal: none | api_integration | data_quality | permissions | reporting | erp_workflow | reliability | unknown
- target_positioning_fit: strong | partial | weak | unknown

These are optional. Do not make export fragile if they cannot be captured automatically.



## Runtime alignment (implemented in bridge v1.3.9)

The bridge now enforces the privacy rule above instead of only documenting it:

- `appendSessionEvent()` redacts setup/boot prompts before they are written to the session log: it keeps the boot rules and the `Session context:` metadata, but replaces everything from `Resume:` onward with `[Resume and Job Description redacted from session log]`. This means the JSON and Markdown exports never contain raw Resume/JD text, even though the full prompt is still injected into Win2 live.
- The boot/setup prompt is excluded from `qa_pairs` (it is not a real interviewer question).
- A `session_armed` event records that Win2 received the boot/context, with metadata only (company, target role, interview round, emphasis, avoid, answer mode) plus `resume_missing` / `jd_missing` flags — never Resume/JD content.
- `summary` now includes `session_armed_fired` (boolean) and a `session_metadata` snapshot, so the review file shows whether the session was correctly armed and with what emphasis/round/mode.

`Avoid mentioning` and `Answer mode` remain prompt-level behaviors (model-followed, logged), not deterministic runtime redaction or length enforcement.
