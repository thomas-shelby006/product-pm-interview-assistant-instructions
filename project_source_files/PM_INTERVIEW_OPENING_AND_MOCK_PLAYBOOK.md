# PM Interview Opening & Mock Playbook — Source File

Use this file to make the system more useful in real interview practice, not just prompt testing.

This file is not for live answer generation unless explicitly referenced. It defines the fixed opening answer, high-confidence interview question patterns, and the mock-session loop to improve delivery.

## Fixed opening answer

Memorize this answer. Use it for the first “tell me about yourself” question.

> “I’m a Product Manager focused on workflow-heavy B2B software products. I started at TPI Composites on manufacturing and quality systems, then moved to Pemo, where I worked on fintech workflows like onboarding, expense automation, approvals, and spend visibility. Now at DataCaliper, I work on B2B SaaS, enterprise workflow, analytics, and decision-support products. My strength is turning messy business workflows into software that reduces manual work and gives teams better visibility — that pattern connects all three roles.”

Purpose:
- Gives Sundar a stable first 30–40 seconds while Win1/Win2 settle.
- Avoids reading unfamiliar generated text at the most nervous moment.
- Establishes the exact target positioning: workflow-heavy B2B software, fintech, enterprise workflow, analytics, and decision-support products.

## What the assistant should do after the opening

After the fixed opening, the assistant should use live answers normally:
- follow-up answers should be shorter
- company story should match the question domain
- do not repeat the whole career arc
- use JD vocabulary naturally

## Three mock sessions before live use

Run three 20-minute mocks before first live use.

### Mock 1 — Recruiter screen

Questions to test:
1. Tell me about yourself.
2. Walk me through your resume.
3. Why are you interested in this role?
4. Why this company?
5. Why are you looking now?
6. What kind of PM role are you targeting?
7. What is your strongest product experience?
8. Do you have any questions for me?

What to review:
- opening answer delivery
- eye movement
- whether answers sound memorized but natural
- whether “why this company” uses JD-specific product challenge

### Mock 2 — Hiring manager / behavioral

Questions to test:
1. Tell me about a product you improved.
2. Tell me about a time you handled ambiguity.
3. Tell me about a failure.
4. Tell me about a stakeholder conflict.
5. Tell me about a tradeoff you made.
6. How do you prioritize when stakeholders disagree?
7. Give me an example of working with engineering.
8. What would you do differently in one past project?

What to review:
- story selection
- rough-edge realism
- failure not becoming disguised success
- behavioral answer under 150 words

### Mock 3 — Product sense / metrics / technical PM

Questions to test:
1. Improve onboarding for an SME spend-management product.
2. How would you measure success for expense automation?
3. Activation dropped 20%; how would you investigate?
4. Design an AI assistant for finance admins.
5. How would you prioritize dashboard improvements for enterprise users?
6. Estimate the market size for expense-management software for SMEs.
7. How would you handle an API integration reliability issue?
8. What guardrails would you use for AI-assisted receipt matching?

What to review:
- position-taking
- specific user segment
- data validation before hypotheses
- concrete estimation sanity check
- AI framing without claiming model ownership

## High-confidence interview prompts by round

### Recruiter / HR

- Tell me about yourself.
- Walk me through your resume.
- Why PM?
- Why this company?
- Why are you interested in this role?
- What kind of product work have you done?
- Why are you a fit for this domain?
- What are your salary expectations?
- What is your notice period?
- Do you have any questions for me?

### Hiring manager

- Tell me about a product you owned or improved.
- What is your strongest PM project?
- How do you prioritize?
- Tell me about a time you changed your mind.
- Tell me about a failure.
- Tell me about a conflict with engineering or stakeholders.
- How do you work with ambiguous requirements?
- What metrics did you use in your last product area?

### Product sense

- Improve onboarding for a B2B SaaS product.
- Improve expense submission for employees.
- Improve finance-admin dashboards.
- Design an AI workflow assistant for finance teams.
- Improve dashboard adoption for enterprise users.
- Design a product for small businesses to manage spend.
- What would you build first and why?

### Metrics / execution

- What is the north-star metric for this product?
- Activation dropped 20%; diagnose it.
- How would you measure dashboard success?
- How would you launch an approval-workflow feature?
- How would you know if an AI automation feature is working?
- What guardrails would you track?
- How would you roll back a launch if metrics moved badly?

### Technical PM / AI PM

- How do you work with engineering on technical tradeoffs?
- How would you evaluate an AI feature?
- What are the risks of automating receipt matching?
- How would you handle data quality issues in dashboards?
- How would you prioritize API integrations?
- How would you balance latency, reliability, and cost?
- What fallback would you add if AI output is wrong?

## Regression rule

After each mock, add 5–10 real questions to `PM_INTERVIEW_TEST_PROMPTS_SOURCE.md` with expected answer shape. This makes the test file a real regression suite rather than a generic checklist.

## Delivery scoring

For each answer, score 1–5:
- direct first sentence
- position taken
- specific user/context
- natural spoken tone
- story relevance
- no fake claims
- stopped at the right time

The system is good only if the answer is usable while speaking, not just correct when read silently.


## Mock gap additions

Add these to the first three mock sessions before live use.

### Recruiter screen additions

1. Why are you leaving / why are you looking now?
2. Walk me through your resume.
3. Where do you see yourself in five years?
4. Do you have any questions for me?

For salary, notice period, counter-offer, relocation, CTC, expected CTC, or joining-date questions: answer from memory. Win2 should show `[candidate-handled topic — answer from memory]`, not generate an answer.

### Product opinion additions

Practice these:

1. What product do you use every day and how would you improve it?
2. Critique a B2B SaaS product.
3. What product do you think is poorly designed?
4. What PM do you admire and why?

### Follow-up chain additions

Practice this chain:

1. How would you improve onboarding for a spend-management product?
2. How would you measure that?
3. What if activation improves but support tickets also increase?
4. Give me an example from your work.

Goal: each answer should get shorter and more specific.
