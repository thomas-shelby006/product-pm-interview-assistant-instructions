# PM Interview Test Prompts — Source File

Use this as supporting reference for PM Interview Helper.

This file defines test prompts used to validate PM interview preparation behavior after source-file updates.

It is not for real-time interview answering. Use it for mock sessions, regression checks, and answer-quality review.

## Core test standard

Every test answer should be evaluated against these rules:

- first person
- direct first sentence
- no route labels
- no coaching notes unless review mode is requested
- no framework names unless asked
- no frontend/SWE framing unless explicitly asked
- no fake metrics
- no fake ownership
- no fake company claims
- strong PM signal
- natural spoken delivery
- correct word limit

## Opening tests

1. Tell me about yourself.
2. Walk me through your resume.
3. Why Product Management?
4. Why are you looking now?
5. What kind of PM role are you targeting?
6. Why are you a fit for this role?
7. What is your strongest product experience?
8. Where do you see yourself in five years?

Expected behavior:
- Use unified PM arc.
- Mention TPI, Pemo, DataCaliper only if useful.
- Keep answer concise and spoken.
- Avoid frontend/SWE framing.

## Behavioral tests

1. Tell me about a time you handled ambiguity.
2. Tell me about a product you improved.
3. Tell me about a stakeholder conflict.
4. Tell me about a failure.
5. Tell me about a tradeoff you made.
6. Tell me about a time you worked with engineering.
7. Tell me about a time you changed your mind.
8. Tell me about a time you had competing priorities and how you resolved it.

Expected behavior:
- Natural STAR without saying STAR.
- Show PM judgment.
- Include a real constraint or rough edge.
- Avoid fake success metrics.
- Keep under 150 words unless asked for depth.

## Product sense tests

1. Improve onboarding for a B2B SaaS product.
2. Improve expense submission for employees.
3. Design a product for small businesses to manage spend.
4. Improve finance-admin dashboards.
5. Improve dashboard adoption for enterprise users.
6. Design an AI assistant for finance teams.
7. Improve a workflow-heavy product with low activation.
8. Design a better approval workflow for expenses.

Expected behavior:
- Make one reasonable assumption if needed.
- Pick a specific user.
- State goal, pain, solution direction, metric, and tradeoff.
- Avoid listing too many ideas.

## Metrics tests

1. What is the north-star metric for SME expense automation?
2. How would you measure dashboard success?
3. Activation dropped 20%; how would you diagnose it?
4. Expense approval completion dropped; what would you check?
5. How would you know if AI-assisted receipt matching is working?
6. What guardrails would you track for onboarding automation?
7. How would you measure success for enterprise workflow automation?
8. What metrics would you use for a quality-inspection tracking product?

Expected behavior:
- Goal first.
- Primary metric.
- Input metrics.
- Guardrails.
- Segmentation.
- No invented exact numbers.

## Prioritization / execution tests

1. You have five features and can ship only one. How do you prioritize?
2. Engineering says a requested feature is too complex. What do you do?
3. Sales wants a client-specific feature; engineering wants platform cleanup. How do you decide?
4. How would you launch an approval-workflow feature?
5. How would you handle bad metrics after launch?
6. How do you manage stakeholder disagreement?
7. How do you define MVP for a B2B SaaS workflow product?
8. How do you decide whether to automate a manual step?

Expected behavior:
- Recommendation first.
- Explain criteria.
- Name tradeoff.
- Include validation and rollback where relevant.

## Technical PM tests

1. How do you work with engineering on technical tradeoffs?
2. How would you prioritize API integrations?
3. How would you handle an integration reliability issue?
4. How would you balance latency, reliability, and cost?
5. How would you manage data quality issues in dashboards?
6. How would you handle role-based access complexity?
7. How would you scope a reporting/export feature?
8. How would you handle a feature that depends on backend API support?

Expected behavior:
- Product impact first.
- Engineering partnership second.
- Avoid deep coding explanations.
- Discuss reliability, risk, rollout, and user impact.

## AI PM tests

1. How would you evaluate an AI feature?
2. What are the risks of automating receipt matching?
3. Design an AI assistant for finance admins.
4. What fallback would you add if AI output is wrong?
5. How would you build trust in an AI-assisted workflow?
6. How would you measure automation quality?
7. How would you prevent over-automation in fintech workflows?
8. How would you handle AI hallucination risk in analytics?

Expected behavior:
- User task first.
- Automation value.
- Quality and trust metrics.
- Guardrails.
- Human review or fallback.
- No ML model ownership claims.

## Product opinion tests

1. What product do you use every day and how would you improve it?
2. Critique a B2B SaaS product.
3. What product do you think is poorly designed?
4. What PM do you admire and why?
5. What product trend are you excited about?
6. What is an example of a product with good onboarding?

Expected behavior:
- Sound like a real opinion.
- One product.
- One clear observation.
- One improvement.
- One metric.
- Avoid generic teardown language.

## Follow-up chain test

Practice this sequence:

1. How would you improve onboarding for a spend-management product?
2. How would you measure that?
3. What if activation improves but support tickets also increase?
4. Give me an example from your work.

Expected behavior:
- Each follow-up gets shorter.
- Do not restart the whole answer.
- Use Pemo for fintech/onboarding.
- Mention guardrails and support tickets.

## Truth-risk tests

Ask:

1. Did you own the whole product?
2. What exact metric improved?
3. Were you responsible for revenue?
4. Did you build the AI model?
5. Was TPI customer-facing?
6. Did you own DataCaliper’s full SaaS strategy?

Expected behavior:
- Correct the scope honestly.
- Do not invent numbers.
- Use safe phrasing.
- Stay confident, not defensive.

## Scoring rubric

Score each answer 1–5 on:

- directness
- PM framing
- story relevance
- metric quality
- tradeoff clarity
- truth safety
- spoken delivery
- length control

A good answer should be usable aloud, not just accurate on paper.
