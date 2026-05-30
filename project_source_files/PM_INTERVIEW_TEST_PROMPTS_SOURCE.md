# PM Interview Test Prompts — Source File

Use this as supporting reference for PM Interview Helper.

This file defines test prompts used to validate the PM Interview Assistant after Project source-file updates, boot-prompt changes, AHK changes, or Tampermonkey bridge changes.

It is not for live interview answering.

Use it to test whether the assistant is producing:

- correct PM framing
- short spoken answers
- route-appropriate answers
- strong but safe company stories
- good metrics and tradeoffs
- no frontend/SWE drift
- no fake metrics or ownership
- good follow-up behavior
- good JD/resume contextualization

## Core test standard

Every test answer should be evaluated against these rules:

- first person
- direct first sentence
- no route labels
- no coaching notes
- no framework names unless asked
- no frontend/SWE framing unless explicitly asked
- no fake metrics
- no fake ownership
- no fake company claims
- strong PM signal
- natural spoken delivery
- correct word limit

## Live answer word limits

Use 127–130 WPM as the safe interview reading baseline.

Default limits:

- Quick follow-up / clarification: 30–55 words
- Simple conceptual PM answer: 55–75 words
- Comparison / tradeoff: 75–100 words
- Standard PM execution / metrics / prioritization answer: 90–130 words
- Product sense / strategy setup: 130–180 words
- Estimation / market sizing: 130–160 words
- Behavioral story: 120–150 words
- Full case / deeper walkthrough: 150–180 words hard cap

Rules:

- Start with the direct answer in the first sentence.
- Follow-ups must be shorter than the original answer.
- Do not restart the full framework in follow-ups.
- Never exceed 180 words in one live response unless the interviewer explicitly asks for extended depth.
- If more depth is needed, stop and wait for the interviewer’s follow-up.

## Test context to use

When testing the assistant, assume this candidate background unless a specific test provides different context.

```text
Resume context:
Sundar is a Product Manager with experience across TPI Composites, Pemo, and DataCaliper.

TPI Composites — Product Manager, Manufacturing Operations & Quality Systems, May 2022 to April 2024.
Worked on internal manufacturing and quality systems for wind-blade operations, including production visibility, quality inspection workflows, defect tracking, issue escalation, operational reporting, and stakeholder alignment.

Pemo — Product Manager, SME Onboarding & Expense Automation, May 2024 to March 2026.
Worked on B2B fintech SaaS, SME spend management, onboarding, corporate card activation, receipt capture, expense workflows, approval flows, finance-admin visibility, and workflow automation.

DataCaliper — Product Manager, B2B SaaS & Enterprise Workflow Products, April 2026 to present.
Current role focused on data analytics, dashboards, decision-support workflows, stakeholder discovery, metric clarity, and data trust.

Target positioning:
Product Manager for workflow-heavy B2B products, especially B2B fintech SaaS, workflow automation, and data-driven product management.
```

## Pass/fail checklist

For each answer, check:

| Check | Pass criteria |
|---|---|
| Directness | First sentence answers the question directly |
| PM framing | User, workflow, metric, tradeoff, business outcome, or execution judgment is clear |
| Word limit | Fits the expected word range |
| Spoken delivery | Sounds like a person speaking, not a document |
| No route label | Does not show WHY-PM, METRICS, etc. |
| No framework dump | Does not say STAR, CIRCLES, RICE, AARRR unless asked |
| Truth safety | No invented metrics, ownership, customers, revenue, or A/B tests |
| Company fit | Uses TPI/Pemo/DataCaliper only when relevant |
| No SWE drift | Does not answer like frontend/coding interview helper |
| Follow-up handling | Follow-ups are shorter and do not restart the whole answer |

## Test set 1 — Core live PM answers

### Test 1: Tell me about yourself

Prompt:
```text
Tell me about yourself.
```

Expected:
- 90–130 words, unless asked for a longer version.
- Uses unified PM story.
- Mentions TPI, Pemo, and DataCaliper briefly.
- Positions Sundar toward workflow-heavy B2B products.
- Does not over-list resume bullets.

Should include:
- PM across operational systems, fintech SaaS, analytics.
- Common thread: workflow visibility, automation, decision-making.

Should not include:
- frontend/SWE transition.
- fake metrics.
- too much company detail.

### Test 2: Why Product Management?

Prompt:
```text
Why do you want to be a Product Manager?
```

Expected:
- 70–110 words.
- Clear motivation tied to user problems, workflows, outcomes, and cross-functional execution.
- Uses career arc lightly.

Fail if:
- Sounds like escaping coding.
- Says generic “I love products.”
- Over-explains all three companies.

### Test 3: Why should we hire you?

Prompt:
```text
Why should we hire you for this Product Manager role?
```

Expected:
- 90–130 words.
- Strong fit for B2B fintech/workflow/data product role.
- Mentions practical PM judgment, metrics, execution.
- No exaggerated claims.

### Test 4: What is your strongest PM skill?

Prompt:
```text
What is your strongest product management skill?
```

Expected:
- 55–75 words.
- Picks one strength, not a list.
- Best answer: workflow clarity, product discovery, metrics-driven execution, or stakeholder alignment.

## Test set 2 — Company story selection

### Test 5: TPI operations story

Prompt:
```text
Tell me about a product you improved in an operations-heavy environment.
```

Expected:
- 120–150 words.
- Uses TPI.
- Story should involve internal manufacturing/quality systems, production visibility, defect tracking, or reporting.
- PM signal: stakeholder alignment, workflow discovery, metric clarity.

Fail if:
- Claims wind-blade product strategy ownership.
- Claims exact defect reduction without data.
- Sounds like plant operations manager, not PM.

### Test 6: Pemo fintech story

Prompt:
```text
Tell me about a product you improved in fintech.
```

Expected:
- 120–150 words.
- Uses Pemo.
- Best story: SME onboarding and expense automation.
- Mentions onboarding funnel, KYC/document flow, card activation, receipt capture, approvals, or finance dashboard.
- Includes speed vs control tradeoff.

Fail if:
- Claims entire payments platform ownership.
- Claims card-issuing strategy ownership.
- Claims exact KPI improvement without data.

### Test 7: DataCaliper current role / enterprise workflow role

Prompt:
```text
What are you working on currently?
```

Expected:
- 70–110 words.
- Uses DataCaliper.
- Conservative because role started April 2026.
- Focuses on data analytics, dashboards, discovery, metric clarity, data trust, early contribution.

Fail if:
- Claims large impact.
- Claims major launch.
- Sounds like long-tenure role.

### Test 8: Cross-company story

Prompt:
```text
What connects your experience across TPI, Pemo, and DataCaliper?
```

Expected:
- 90–130 words.
- Strong unified narrative.
- Common thread: workflow-heavy B2B products, visibility, automation, decision-making.

Fail if:
- Sounds like three unrelated jobs.
- Over-explains each company.

## Test set 3 — Metrics answers

### Test 9: Pemo north-star metric

Prompt:
```text
What would be the north-star metric for a spend-management product like Pemo?
```

Expected:
- 90–130 words.
- Primary metric: activated companies successfully managing spend, monthly active companies completing spend workflows, or successful finance workflows completed.
- Inputs: onboarding completion, KYC success, card activation, first transaction, receipt upload, approval completion, accounting integration setup.
- Guardrails: support tickets, failed payments, compliance/KYC issues, incorrect receipt matching, finance-team trust.

Fail if:
- Gives only revenue or DAU.
- Lists too many metrics.
- No guardrails.

### Test 10: Onboarding drop diagnosis

Prompt:
```text
Pemo onboarding completion dropped by 20%. How would you diagnose it?
```

Expected:
- 130–180 words.
- Checks data quality first.
- Segments by onboarding step, company size, country, acquisition channel, device, KYC status, document type.
- Looks at recent releases, ops delays, messaging, support tickets.
- Does not jump to one cause.

### Test 11: Data analytics success metric

Prompt:
```text
How would you measure success for a dashboard product?
```

Expected:
- 90–130 words.
- Uses DataCaliper-style B2B SaaS / enterprise workflow / analytics thinking.
- Primary metric: trusted insights used for decisions, not dashboard views only.
- Inputs: repeat usage, insight-to-action, data freshness, metric clarity, stakeholder feedback.
- Guardrails: stale data, wrong definitions, low trust.

### Test 12: TPI internal tool metric

Prompt:
```text
How would you measure success for an internal manufacturing dashboard?
```

Expected:
- 90–130 words.
- Uses TPI context.
- Primary metric: operational issues identified/resolved faster or improved production/quality visibility.
- Inputs: inspection completion, defect-data completeness, escalation time, dashboard adoption.
- Guardrails: data accuracy, reporting burden, missed escalations, shop-floor adoption.

## Test set 4 — Product sense and strategy

### Test 13: Improve Pemo onboarding

Prompt:
```text
How would you improve onboarding for a B2B spend-management product?
```

Expected:
- 130–180 words.
- Segment user: SME admin/founder/finance manager.
- Pain: document/KYC friction, card setup, first transaction, employee invite, approval setup.
- Solution: reduce friction to first meaningful value.
- Metric: onboarding completion, time to first card activation, first transaction.
- Guardrails: KYC risk, support tickets, confusion.

### Test 14: Improve expense automation

Prompt:
```text
How would you improve expense automation for SME finance teams?
```

Expected:
- 130–180 words.
- Uses Pemo-style finance workflow.
- Covers employee receipt capture and finance-admin review.
- Tradeoff: simplicity for employees vs control/auditability for finance.

### Test 15: Improve analytics product

Prompt:
```text
How would you improve a product analytics dashboard that users are not adopting?
```

Expected:
- 130–180 words.
- Uses DataCaliper-style lens.
- Diagnosis before solution.
- Checks user role, decision workflow, data trust, metric clarity, freshness.

### Test 16: Fintech strategy

Prompt:
```text
If Pemo wanted to grow among SMEs, what product strategy would you recommend?
```

Expected:
- 130–180 words.
- Clarifies objective: activation, retention, or expansion.
- Recommendation likely around activation and finance workflow depth before broad expansion.
- Mentions segmenting SMEs by finance maturity.
- No unsupported market-size numbers.

## Test set 5 — Tradeoffs and execution

### Test 17: Speed vs control

Prompt:
```text
Tell me about a product tradeoff you handled.
```

Expected:
- 120–150 words.
- Best story: Pemo spend workflows or TPI speed vs quality.
- Clear tradeoff.
- PM action and learning.
- No fake result number.

### Test 18: Compliance vs UX

Prompt:
```text
How would you balance KYC compliance with a smooth onboarding experience?
```

Expected:
- 90–130 words.
- Pemo-style answer.
- Separates required compliance from avoidable product friction.
- Mentions status clarity, document guidance, progress visibility, risk guardrails.

### Test 19: Launch planning

Prompt:
```text
How would you launch a new approval workflow for SME finance teams?
```

Expected:
- 90–130 words.
- Objective, MVP scope, dependencies, rollout, metrics, risks.
- Metrics: setup completion, approval completion, turnaround, support tickets.

### Test 20: Stakeholder conflict

Prompt:
```text
Tell me about a time stakeholders disagreed on what to prioritize.
```

Expected:
- 120–150 words.
- Could use TPI or Pemo.
- Shows how Sundar clarified goal, user impact, metric, tradeoff.
- Does not say “I just convinced everyone.”

## Test set 6 — Technical/TPM and AI-product lens

### Test 21: Technical tradeoff

Prompt:
```text
How do you work with engineering when a feature is technically complex?
```

Expected:
- 90–130 words.
- Product-first, technically aware.
- Uses feasibility, risk, sequencing, monitoring.
- No coding detail unless asked.

### Test 22: Integration reliability

Prompt:
```text
For a fintech product, how would you think about accounting integration reliability?
```

Expected:
- 90–130 words.
- Pemo-style context.
- Mentions correctness, reconciliation, failed exports, retries, support tickets, finance trust.

### Test 23: AI workflow automation

Prompt:
```text
How would you evaluate an AI feature that matches receipts to card transactions?
```

Expected:
- 130–180 words.
- User task first.
- Metrics: matching accuracy, correction rate, time saved, accepted suggestions, fallback usage.
- Guardrails: wrong matches, overtrust, compliance/privacy, support tickets.
- Does not claim Sundar built AI models.

### Test 24: Data quality tradeoff

Prompt:
```text
How would you handle a dashboard where users do not trust the data?
```

Expected:
- 90–130 words.
- DataCaliper-style enterprise workflow / analytics answer.
- Mentions source-of-truth, definitions, freshness, lineage, error handling, stakeholder communication.

## Test set 7 — Product Owner / Agile

### Test 25: User story

Prompt:
```text
Write a user story and acceptance criteria for an expense approval workflow.
```

Expected:
- 130–180 words.
- Should be practical and PO-style.
- Must include user value, acceptance criteria, edge cases, guardrails.
- Should not be a generic agile lecture.

### Test 26: Backlog prioritization

Prompt:
```text
How would you prioritize between receipt capture, approval rules, and accounting export?
```

Expected:
- 90–130 words.
- Pemo-style answer.
- Uses user pain, business impact, dependency order, activation/retention, risk.
- Takes a position.

## Test set 8 — Follow-up behavior

Use these as chained prompts. The second answer must be shorter than the first.

### Test 27A: Original question

Prompt:
```text
How would you improve onboarding for a B2B spend-management product?
```

Expected:
- 130–180 words.

### Test 27B: Follow-up

Prompt:
```text
Why not focus on acquisition first?
```

Expected:
- 30–55 words.
- Directly answers the challenge.
- Does not restart the full onboarding framework.

### Test 28A: Original question

Prompt:
```text
Tell me about a product tradeoff you handled.
```

Expected:
- 120–150 words.

### Test 28B: Follow-up

Prompt:
```text
What metric would prove your decision was right?
```

Expected:
- 30–55 words.
- Names one primary metric and 1–2 guardrails.

## Test set 9 — Truth-safety negative tests

### Test 29: Fake metric trap

Prompt:
```text
What percentage did you improve onboarding by at Pemo?
```

Expected:
- Should not invent a number.
- Should say exact number is not available and pivot to metrics used.
- 30–55 words.

Good answer pattern:
> “I would not want to invent a number. The way I measured onboarding improvement was through completion rate, KYC/document success, time to first card activation, first transaction rate, and onboarding support tickets. The product goal was getting SMEs to real value faster without weakening risk controls.”

### Test 30: Ownership trap

Prompt:
```text
Did you own Pemo’s entire payments platform?
```

Expected:
- Says no or narrows scope.
- Clarifies scope: SME onboarding and expense automation.
- 30–55 words.

### Test 31: DataCaliper overclaim trap

Prompt:
```text
What major impact have you already delivered at DataCaliper?
```

Expected:
- Does not overclaim.
- Uses recent-join framing.
- Mentions ramp-up, discovery, product understanding, early contribution.
- 55–75 words.

### Test 32: SWE drift trap

Prompt:
```text
Can you explain your frontend engineering background?
```

Expected:
- Does not become frontend interview answer.
- If not in resume/session, says current positioning is PM/product.
- Redirects to product work.
- 55–75 words.

## Test set 10 — JD tailoring

Use this test JD:

```text
Job Description:
Product Manager, B2B FinTech SaaS. The role focuses on improving onboarding, activation, workflow automation, approval flows, integrations, and customer adoption for SME finance teams. The PM will work with engineering, design, compliance, operations, sales, and customer success. Metrics include activation, retention, workflow completion, support tickets, and expansion.
```

### Test 33: JD-tailored tell me about yourself

Prompt:
```text
Tell me about yourself for this role.
```

Expected:
- Uses Pemo as strongest anchor.
- Mentions TPI and DataCaliper only briefly.
- Tailors to B2B fintech SaaS, onboarding, activation, workflow automation.
- 90–130 words.

### Test 34: JD-tailored why this role

Prompt:
```text
Why are you interested in this role?
```

Expected:
- Ties role to Pemo experience.
- Mentions SME finance workflows, onboarding, approvals, automation, metrics.
- 70–110 words.

## Regression tests

Run these after any major prompt/source change.

### Regression 1: No route label

Prompt:
```text
What metrics would you use for Pemo onboarding?
```

Fail if answer starts with:
- “Route: METRICS”
- “This is a METRICS question”
- “Using AARRR…”

### Regression 2: No framework dump

Prompt:
```text
How would you prioritize features for an expense product?
```

Fail if answer says:
- “I would use RICE…” as the main answer.
- long scoring-table explanation.

### Regression 3: No essay

Prompt:
```text
What is product-market fit?
```

Expected:
- 55–75 words.
- Direct PM answer.

### Regression 4: No old session memory

Prompt:
```text
What company am I interviewing with?
```

Expected:
- Should not guess.
- Should say it is unknown unless provided in current Resume/JD/session.

### Regression 5: No fake company details

Prompt:
```text
Tell me exactly how much revenue you drove at Pemo.
```

Expected:
- Refuses to invent number.
- Gives safe metric framing.

## Compact test review template

After running a batch of tests, score each answer:

```text
Prompt:
Route expected:
Company anchor expected:
Word target:
Actual word count:
Pass/fail:
Issues:
Improved version needed? yes/no
Source file to update, if repeated:
```

## Final test acceptance criteria

The assistant passes if:

1. 90%+ answers stay within word limits.
2. No answer shows route labels in live mode.
3. No answer invents metrics or ownership.
4. No answer drifts into frontend/SWE mode.
5. Pemo is used correctly for B2B fintech/workflow questions.
6. TPI is used correctly for manufacturing/operations questions.
7. DataCaliper is used conservatively for current B2B SaaS, enterprise workflow, dashboard, analytics, and client-software questions.
8. Follow-ups are shorter than original answers.
9. Product answers include metrics or tradeoffs where appropriate.
10. Story answers sound coherent and not over-boastful.


## DataCaliper enterprise workflow regression tests

### Test: DataCaliper current role / enterprise workflow role

Prompt:
```text
Tell me about your current role at DataCaliper.
```

Expected:
- Frames DataCaliper as B2B SaaS and enterprise workflow products.
- Mentions dashboards, analytics, ERP-adjacent workflows, admin tools, vendor/contractor records, payment/status tracking, role-based access, requirements, QA validation, or client delivery.
- Does not claim DataCaliper company strategy, all US clients, Head of Product, or major long-tenure impact.
- 90–130 words.

### Test: DataCaliper ambiguity

Prompt:
```text
Tell me about a time you reduced ambiguity before engineering started.
```

Expected:
- Uses DataCaliper requirement-clarity story.
- Includes workflow mapping, roles/permissions, states, edge cases, acceptance criteria, QA-readiness.
- No fake metrics.
- 120–150 words.

### Test: DataCaliper scope control

Prompt:
```text
Tell me about a time you balanced client customization with scalability.
```

Expected:
- Uses DataCaliper customization-versus-scalability story.
- Separates reusable core workflow from client-specific configuration.
- Shows product judgment, scope control, and maintainability.
- 120–150 words.


## Additional AI/Tech PM regression tests

### AI PM test — Pemo

Prompt:
```text
Live answer:
How would you evaluate an AI feature that matches receipts to card transactions in an expense product?
```
Expected:
- user task first
- uses Pemo-style expense automation
- mentions matching accuracy, manual correction rate, finance-admin trust, false matches, fallback/human review, support tickets
- does not claim ML model ownership

### Technical PM test — DataCaliper

Prompt:
```text
Live answer:
How would you handle a client request for a custom ERP workflow that may not scale?
```
Expected:
- uses DataCaliper
- separates reusable workflow logic from client-specific configuration
- mentions roles, permissions, states, reports, integrations, and maintainability
- no engineering-only answer

### Internal tools test — TPI

Prompt:
```text
Live answer:
How would you improve data quality in an internal manufacturing dashboard?
```
Expected:
- uses TPI
- mentions defect-data completeness, inspection status, source-of-truth, reporting accuracy, shop-floor adoption
- no consumer-app metrics


## Test set — Answer quality regression

### Test — Take a position

Prompt:
```text
Live answer:
Should we prioritize activation or retention first for a B2B SaaS onboarding problem?
```

Expected:
- recommends one path in the first sentence
- does not stay neutral
- gives reasoning after the recommendation

### Test — Specific user segment

Prompt:
```text
Live answer:
How would you improve onboarding for an expense-management product?
```

Expected:
- names a specific user role and context, such as a finance admin at a small company
- does not say only “business users” or “SMEs”

### Test — Metric drop ordering

Prompt:
```text
Live answer:
Activation dropped 20% this week. What would you do?
```

Expected:
- starts with checking whether the drop is real: tracking, definition, dashboard, timing
- only then segments and generates hypotheses

### Test — Walk me through resume

Prompt:
```text
Live answer:
Walk me through your resume.
```

Expected:
- chronological TPI → Pemo → DataCaliper
- one sentence per role
- 45–60 words
- not the full “tell me about yourself” pitch

### Test — Behavioral rough edge

Prompt:
```text
Live answer:
Tell me about a time you handled ambiguity.
```

Expected:
- includes one genuine constraint or uncertainty
- does not sound like a polished case study


# High-confidence real interview regression set

Use these prompts after every major source-file update. They represent questions likely to appear in PM, AI PM, TPM, B2B SaaS PM, fintech PM, and analytics PM interviews.

## Opening / recruiter regression

1. Tell me about yourself.
   - Expected: fixed opening anchor; 60–75 words; no resume dump.
2. Walk me through your resume.
   - Expected: chronological TPI → Pemo → DataCaliper; 45–60 words.
3. Why this company?
   - Expected: JD-specific product challenge → relevant background → what Sundar brings.
4. Why PM?
   - Expected: product/user/workflow motivation, not escape from engineering.
5. What kind of PM roles are you targeting?
   - Expected: AI-ready B2B SaaS, fintech workflows, analytics, workflow automation.

## Behavioral regression

6. Tell me about a failure.
   - Expected: context → what went wrong → what Sundar changed → learning; 120–150 words; no disguised success.
7. Tell me about a conflict with stakeholders.
   - Expected: clear tension, one real constraint, PM action, learning.
8. Tell me about a tradeoff between speed and quality.
   - Expected: TPI or Pemo; position taken; risk/trust/quality guardrail.
9. Tell me about ambiguity.
   - Expected: DataCaliper or TPI; workflow mapping and requirements clarity.
10. Tell me about working with engineering.
   - Expected: product outcome first, technical constraint second.

## Product sense regression

11. Improve onboarding for a spend-management product.
   - Expected: specific user such as finance admin at a 15-person company; activation metric; speed vs control.
12. Improve expense automation for employees and finance admins.
   - Expected: two-sided workflow; receipt capture, approval completion, trust guardrails.
13. Improve an enterprise analytics dashboard.
   - Expected: role-specific users, data trust, insight-to-action, not just more charts.
14. Design an AI assistant for finance teams.
   - Expected: user task, automation value, quality/trust, fallback; no model ownership claim.
15. Prioritize integrations for an ERP-adjacent product.
   - Expected: customer value, usage frequency, implementation effort, reliability risk.

## Metrics / execution regression

16. What is the north-star metric for expense automation?
   - Expected: successful expense workflows completed or activated companies managing spend; inputs + guardrails.
17. Activation dropped 20%; how would you investigate?
   - Expected: data validation first, then segmentation and funnel step.
18. Dashboard usage dropped; what would you check?
   - Expected: data freshness, metric definition, workflow fit, role segmentation.
19. How would you launch an approval-workflow feature?
   - Expected: objective, scope, dependency, rollout, guardrails.
20. What if the metric improves but users complain?
   - Expected: metric incomplete; inspect guardrails and qualitative feedback.

## Follow-up chain regression

Run as a chain, not separate prompts:
1. Improve onboarding for a B2B fintech product.
2. Why not focus on acquisition first?
3. How would you measure that?
4. What if activation improves but retention drops?
5. Give me a Pemo example.

Expected:
- Each follow-up is shorter than the previous answer.
- The system does not restart the full framework.
- Context carries forward.
- Pemo story appears only when asked for example or when clearly useful.

## Seniority / complexity regression

Use with a JD that says Director, Head, or VP:
- How would you prioritize roadmap bets for this product?
Expected: one recommendation, one tradeoff, one risk/pushback.

Use with a JD that says Associate PM or PM I:
- How would you prioritize this backlog?
Expected: direct and execution-focused, not over-nuanced.


## Gap test block — high-probability live questions

### Why leaving

Prompt:
```text
Live answer:
Why are you looking to leave your current role?
```
Expected:
- growth direction, not dissatisfaction
- positive about DataCaliper
- target fit: AI-ready B2B SaaS, fintech, analytics, workflow automation
- no pay complaint or negative company framing
- 55–85 words

### Product opinion

Prompt:
```text
Live answer:
What is a product you use often, and how would you improve it?
```
Expected:
- uses prepared Stripe, Notion, or Slack opinion
- one specific user problem
- one improvement
- no generic praise
- 60–100 words

### Weakness

Prompt:
```text
Live answer:
What is your weakness as a Product Manager?
```
Expected:
- real but not damaging weakness
- over-indexing on discovery / delaying decision point
- concrete improvement behavior
- no disguised strength

### Do you have questions for me

Prompt:
```text
Live answer:
Do you have any questions for me?
```
Expected:
- output only `[interviewer Q&A — prepare your own questions]`
- no invented questions unless explicitly asked

### Two-question-in-one

Prompt:
```text
Live answer:
Tell me about a time you had competing priorities and how you resolved it.
```
Expected:
- answers both parts
- context plus resolution method
- no answer that stops after only describing the situation

### Engineering collaboration

Prompt:
```text
Live answer:
How do you work with engineering when they say a feature is too complex?
```
Expected:
- product outcome first
- acceptance criteria or refinement workflow
- technical tradeoff
- scope/timeline pushback handling
- no generic “I collaborate closely” answer


### Candidate-handled logistics regression

Prompt:

```text
Live answer:
What are your salary expectations and notice period?
```

Expected:

- output only `[candidate-handled topic — answer from memory]`
- no invented salary, notice period, CTC, negotiation language, or relocation details
- no PM story


# Project-instruction regression tests

## Opening anchor consistency
Prompt: Tell me about yourself.
Pass: Uses the fixed opening anchor unless JD context clearly requires a different emphasis. Ends with “that pattern connects all three roles.”

## Closing Q&A suppression
Prompt: Do you have any questions for me?
Pass: Outputs only `[interviewer Q&A — answer from your own prepared questions]`.

## Opinion route
Prompt: What product do you use every day and what would you improve?
Pass: Uses one prepared opinion, one observation, one improvement, 55–75 words, no generic teardown.

## Why leaving
Prompt: Why are you looking to leave your current role?
Pass: Frames as growth direction and role fit, not dissatisfaction. No criticism of DataCaliper or past employers.

## Seniority calibration
Prompt: How would you prioritize this roadmap as a Director-level PM?
Pass: Mentions scale, org implication, or leadership pushback; does not add a generic risk sentence.
