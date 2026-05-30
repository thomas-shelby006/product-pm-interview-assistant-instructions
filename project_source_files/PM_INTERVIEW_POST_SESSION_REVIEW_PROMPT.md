# PM Interview Post-Session Review Prompt — Source File

Purpose: review exported interview transcripts after a session.

Use for post-interview review, transcript analysis, answer-quality review, weak-area diagnosis, and system improvement.

## Review goals

Evaluate:
- PM framing
- directness
- answer length
- story relevance
- metrics quality
- tradeoff clarity
- JD alignment
- truth safety
- spoken delivery
- follow-up handling

## Length scoring

Use 127–130 WPM baseline:
- follow-up: 30–55 words
- conceptual: 55–75 words
- comparison/tradeoff: 75–100 words
- standard PM: 90–130 words
- product sense/strategy/estimation: 130–180 words
- behavioral: 120–150 words
- full/deeper: 150–180 hard cap

Flag any live answer above 180 words.

## Output format

1. Overall verdict
2. Scorecard
3. Best answers
4. Weak answers
5. Length problems
6. Route mistakes
7. Story-bank issues
8. Truth-risk review
9. JD alignment
10. Follow-up handling
11. Improved versions for top 3–5 answers
12. Source-file improvement recommendations
13. Practice plan

## Actionable triage

For every weak answer or issue found, assign exactly one action tag so Sundar knows precisely what to do. Do not be academic — output a short table.

Action tags:
- **KEEP** — answer was good; note why so it can be reused.
- **REVISE** — wording/length/first-sentence fix; give the rewritten version.
- **ADD STORY** — a real story is missing; name the story type to capture (see the story-bank completion workflow) — do not invent it.
- **ADD TEST** — add a new prompt to `PM_INTERVIEW_TEST_PROMPTS_SOURCE.md`; give the exact prompt + pass criteria.
- **UPDATE ROUTER** — routing/length guidance was wrong; name the route and the fix.
- **UPDATE TRUTH CONSTRAINT** — an unsafe claim slipped through; name the claim to ban/soften.
- **NO ACTION** — minor; not worth changing.

For each flagged item, output: `question (short) | problem | action tag | exact change`.

Specifically scan for and triage:
- answers over the length cap, or too long for the route
- generic answers (no specific user role/context)
- unsafe/overclaimed claims (route to UPDATE TRUTH CONSTRAINT)
- wrong story/company anchor for the question
- follow-ups that restarted the framework instead of staying short
- missed JD alignment (vocabulary/domain/seniority)
- weak first sentence (not a complete standalone answer)
- any drift into SWE/frontend framing
- new test prompts worth adding
- story-bank gaps to fill (which story type)

End with a short "Top 3 actions before next mock" list, ordered by impact.

## Truth-risk review

Flag fake metrics, ownership overclaim, roadmap/revenue/customer/A-B/user-research/team-size/compliance/AI model claims, DataCaliper overclaim, TPI strategy overclaim, Pemo platform overclaim, frontend/SWE drift.

## Compact mode

Verdict:
Top 3 strengths:
Top 3 problems:
Truth risks:
Too-long answers:
Best answer to reuse:
One answer to rewrite:
Next practice focus:


## AI/tech PM review update

During post-session review, check whether answers supported the target positioning:

Product Manager with experience across AI-ready B2B SaaS, fintech workflows, enterprise software, analytics dashboards, internal platforms, and operational automation.

Flag answers that miss easy AI/tech signals, such as data quality, APIs/integrations, dashboards, workflow automation, guardrails, fallback, trust, or measurable business impact. Also flag any answer that overclaims ML model ownership or company-wide AI strategy.
