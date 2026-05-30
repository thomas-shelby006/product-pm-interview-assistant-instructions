# 04 — Tests, Review, and Mock Loop

Regression checks, the post-session review prompt, the mock-session loop, and the improvement action tags that turn mock failures into source-file updates.

## Behavior regression cases (the assistant should pass all)

Special outputs:
- "Do you have any questions for me?" → only `[interviewer Q&A — answer from your own prepared questions]`.
- "Salary expectations / notice period?" → only `[candidate-handled topic — answer from memory]`. No invented numbers.
- Filler ("um, yeah, okay") → only `— [pause] —`. Partial/mid-sentence → only `No action needed.`

Answer quality:
- "Tell me about yourself" → uses the fixed opening anchor (~75 words), ends "that pattern connects all three roles," not regenerated.
- "Walk me through your resume" → chronological, one sentence per role, 45–60 words.
- Product opinion → one prepared opinion, one observation, one improvement, 55–75 words, no generic teardown.
- Product sense → names a specific user role + context (not "business users"); ≤180 words.
- Metric drop → validates data before hypotheses.
- Prioritization → recommends one item first, then impact/effort/strategic-fit justification.
- Estimation → approach first, driver tree, explicit assumptions, sanity check; **130–160 words** (deeper only if asked).
- Behavioral → one real rough edge; failure shows genuine learning, not disguised success; stakeholder conflict shows Sundar holding a position.
- Technical/TPM → PM framing, never SWE/coding.
- Follow-up → shorter than the original, no framework restart.

Context/precedence:
- Missing resume → canonical profile, no invented detail.
- Fintech JD + generic resume → leads with Pemo, fintech vocabulary, no fabricated experience.
- Resume/JD vs truth constraints conflict → banned claim not repeated; safe claims only.
- Live correction → honored for the session; never overrides the truth floor.
- `Avoid mentioning: X` → X never appears. `Answer mode: concise` shorter; `deep` ≤180.
- Interrupt while generating / two questions at once → latest actionable question wins.

Seniority: "prioritize this roadmap as a Director-level PM" → scale/org/leadership-pushback framing, not a generic risk sentence.

> Maintain the fuller regression list and JD-specific prompts in `project_source_files/PM_INTERVIEW_TEST_PROMPTS_SOURCE.md`; add 5–10 real questions after each mock.

## Post-session review prompt

Run this against an exported transcript. Use 127–130 WPM scoring.

Evaluate: PM framing, directness, length, story relevance, metrics quality, tradeoff clarity, JD alignment, truth safety, spoken delivery, follow-up handling.

Length reference: follow-up 30–55 · conceptual 55–75 · comparison/tradeoff 75–100 · standard PM 90–130 · product sense/strategy 130–180 · **estimation 130–160** · behavioral 120–150 · deep 150–180 hard cap. Flag any live answer over 180 words.

Truth-risk scan: flag fake metrics, ownership/roadmap/revenue/customer/A-B/research/team-size/compliance/ML claims, DataCaliper overclaim, TPI strategy overclaim, Pemo platform overclaim, and any frontend/SWE drift. Also flag answers that miss easy AI/tech signals (data quality, APIs/integrations, dashboards, workflow automation, guardrails, fallback, measurable impact).

Output format: 1) overall verdict; 2) scorecard; 3) best answers; 4) weak answers; 5) length problems; 6) route mistakes; 7) story-bank issues; 8) truth-risk review; 9) JD alignment; 10) follow-up handling; 11) improved versions of the top 3–5 answers; 12) actionable triage (below); 13) practice plan.

Compact mode: Verdict / Top 3 strengths / Top 3 problems / Truth risks / Too-long answers / Best answer to reuse / One answer to rewrite / Next practice focus.

## Actionable triage (the learning loop)

For every weak answer or issue, assign exactly one action tag and the exact change. Output a short table: `question (short) | problem | action tag | exact change`.

Action tags:
- **KEEP** — good; note why so it can be reused.
- **REVISE** — wording/length/first-sentence fix; give the rewritten version.
- **ADD STORY** — a real story is missing; name the story type to capture (do not invent it).
- **ADD TEST** — add a prompt to the test file; give the exact prompt + pass criteria.
- **UPDATE ROUTER** — routing/length wrong; name the route and fix.
- **UPDATE TRUTH CONSTRAINT** — an unsafe claim slipped through; name the claim to ban/soften.
- **NO ACTION** — minor.

End with "Top 3 actions before next mock," ordered by impact.

## Three mock sessions before live use (20 min each)

- **Mock 1 — Recruiter:** tell me about yourself; walk me through your resume; why this role; why this company; why looking now; target role; strongest experience; questions for me. Review: opening delivery, natural-but-memorized tone, JD-specific "why this company."
- **Mock 2 — Hiring manager / behavioral:** product you improved; ambiguity; failure; stakeholder conflict; tradeoff; prioritize when stakeholders disagree; working with engineering; what you'd do differently. Review: story selection, real rough edge, failure not a disguised success, ≤150 words.
- **Mock 3 — Product sense / metrics / TPM:** improve SME onboarding; measure expense automation; activation dropped 20% (diagnose); design an AI assistant for finance admins; prioritize dashboard improvements; estimate SME expense-management market size; API reliability issue; guardrails for AI receipt matching. Review: position-taking, specific user, data-validation-first, estimation sanity check, AI framing without model ownership.

Delivery scoring (1–5 each): direct first sentence; position taken; specific user/context; natural spoken tone; story relevance; no fake claims; stopped at the right time. The system is good only if the answer is usable while speaking, not just correct when read.

## Story promotion checklist (draft → bundle)

A draft story may move from `drafts/` into `01_CANDIDATE_PROFILE_AND_STORY_BANK.md` only when ALL are true:
1. It describes a **real** situation Sundar confirms.
2. Every claim passes `drafts/CLAIM_SAFETY_CHECKLIST.md` (no invented metrics/ownership/customers/team size/A-B/ML).
3. No `[bracketed]` placeholders remain.
4. It is front-loaded and within the target length for its type.
5. It includes one real rough edge (for behavioral/failure/conflict).
6. Sundar has read it aloud once and it sounds natural.
7. A story-selection-table row is added in `01`.

Until a story meets this bar, keep it in `drafts/` only and, for that question type, answer with a short principled response from the profile without inventing specifics.
