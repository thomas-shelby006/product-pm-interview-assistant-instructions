# Story-Bank Completion Workflow (DRAFT — NOT FOR PROJECT UPLOAD)

> Do not upload this file into the ChatGPT Project. It is a working guide to help Sundar
> capture **real** stories. Nothing here is a confirmed story. The assistant must never
> invent stories or fill these for Sundar.

## How the workflow runs

1. **Pick a story type** below (start with the high-probability ones: failure, conflict, proudest achievement, strongest skill).
2. **Capture** the real situation by answering the questions for that type in `drafts/STORY_BANK_TODO_CONFIRM_WITH_SUNDAR.md`.
3. **Claim-check** every sentence against `drafts/CLAIM_SAFETY_CHECKLIST.md`. Remove or soften anything not safe/confirmed.
4. **Confirm**: Sundar reads it aloud once and confirms it is true and natural.
5. **Promote**: move the finished, claim-safe version into `project_source_files/PM_INTERVIEW_STORY_BANK_TEMPLATE.md` and add a story-selection-table row. Only confirmed stories go into uploaded Project files.

General rules for every story:
- First person, spoken, front-loaded (first 1–2 sentences are a complete answer).
- One real situation, not a composite of several.
- A real constraint or rough edge — not a polished success.
- No invented metrics, ownership, revenue, customer names, team size, A/B tests, ML/compliance ownership.
- Use the real company (TPI Composites / Pemo / DataCaliper); use the role title "Product Manager" only.

## Story types

For each: **what's tested**, **fitting situation**, **questions to answer**, **banned claims**, **safe claim examples**, **target spoken length**, **how to convert to a live answer**.

### 1. Failure / mistake
- **What's tested:** honesty, self-awareness, real learning (not a disguised success).
- **Fitting situation:** a decision/launch that genuinely went wrong or was delayed; e.g. over-discovery delaying a call (matches the prepared weakness).
- **Questions:** What did you decide? What went wrong and why? When did you realize? What did you do? What changed afterward in how you work?
- **Banned:** "but it turned out great"; invented recovery metrics; blaming others entirely.
- **Safe examples:** "we lost time we could have spent testing"; "I now set an explicit decision date."
- **Length:** 120–150 words.
- **Convert:** context → what went wrong → what you did when you saw it → concrete learning. End on the change, not a win.

### 2. Stakeholder conflict
- **What's tested:** whether you hold a position, not just keep everyone happy.
- **Fitting situation:** a stakeholder pushed for speed/scope/a one-off; you pushed back with user signal, workflow risk, or maintainability.
- **Questions:** Who wanted what? Why did you disagree? How did you make the risk concrete? What principled middle path did you land on?
- **Banned:** "I just aligned everyone"; claiming authority you didn't have; inventing the outcome.
- **Safe examples:** "I disagreed because [user/workflow risk]"; "we kept the essential control and phased the rest."
- **Length:** 120–150 words.
- **Convert:** context → your position + the concrete risk → the disagreement → principled resolution → one-line lesson.

### 3. Proudest achievement
- **What's tested:** judgment, ownership, real impact.
- **Fitting situation:** a workflow/feature you drove that meaningfully reduced manual work or improved visibility.
- **Questions:** What was it? What was *your* specific PM contribution? What was the hard part? What was the real (claim-safe) outcome? Why are you proud?
- **Banned:** revenue/percentage uplift you can't verify; "I owned the whole thing" if you didn't.
- **Safe examples:** qualitative outcomes ("teams stopped tracking it in spreadsheets"); a decision you'd defend.
- **Length:** 120–150 words.
- **Convert:** state the achievement + your role first sentence → the hard part → outcome → why it mattered.

### 4. Strongest PM skill
- **What's tested:** self-knowledge shown through a real moment, not adjectives.
- **Fitting situation:** a recurring strength (e.g. turning messy workflows into shippable scope; data-validation-before-hypothesis).
- **Questions:** What's the one skill? Why is it your strength? One proof moment? How does it show up day-to-day?
- **Banned:** "I'm a great communicator/leader" with no proof; generic strengths.
- **Safe examples:** anchor to a real TPI/Pemo/DataCaliper moment.
- **Length:** 55–90 words.
- **Convert:** name the skill → one-line why → one concrete proof → one habit.

### 5. Product judgment moment
- **What's tested:** how you make a call with incomplete information.
- **Fitting situation:** you chose to build/cut/sequence something based on user/workflow insight.
- **Questions:** What was the call? What signal drove it? What did you deprioritize? Were you right, and how did you know?
- **Banned:** inventing usage data or experiment results.
- **Safe examples:** "I prioritized X because [observed workflow pain]"; "I deferred Y because it served few users."
- **Length:** 120–150 words.
- **Convert:** the call first → the signal → the tradeoff → what you learned.

### 6. Data / metrics decision
- **What's tested:** metric rigor; validating data before hypotheses.
- **Fitting situation:** a metric you chose, or a drop/anomaly you investigated.
- **Questions:** What was the goal metric and why? How did you validate the data first? What did you find? What did you change?
- **Banned:** specific numbers you can't stand behind; claiming an A/B test you didn't run.
- **Safe examples:** "I checked tracking/definitions before forming hypotheses"; "I segmented to find the funnel step."
- **Length:** 120–150 words.
- **Convert:** goal/metric → data validation → finding → action.

### 7. Ambiguity / unclear requirements
- **What's tested:** structuring a fuzzy problem without freezing.
- **Fitting situation:** vague ask from a stakeholder/client; you framed it into shippable scope.
- **Questions:** What was unclear? How did you reduce ambiguity? What assumption did you make explicit? What did you ship first?
- **Banned:** pretending there was no ambiguity; invented stakeholder counts.
- **Safe examples:** "I stated the assumption explicitly and shipped a small reversible version."
- **Length:** 120–150 words.
- **Convert:** the ambiguity → how you framed it → the explicit assumption → the first slice.

### 8. Tradeoff under deadline
- **What's tested:** prioritization and principled cuts under pressure.
- **Fitting situation:** you had to cut scope to hit a date.
- **Questions:** What was the deadline/pressure? What did you keep vs cut, and why? What risk did you accept? How did it land?
- **Banned:** claiming zero cost; inventing the result.
- **Safe examples:** "I kept the core workflow and deferred the configurable part."
- **Length:** 120–150 words.
- **Convert:** the pressure → keep/cut + reasoning (impact/effort/strategic fit) → accepted risk → outcome.

### 9. Working with engineering
- **What's tested:** technical collaboration as PM leverage (not as an engineer).
- **Fitting situation:** a feature where you partnered closely with eng on constraints/tradeoffs.
- **Questions:** What was the product outcome? What technical constraint mattered? One concrete workflow (acceptance criteria/refinement)? How did you handle scope/timeline pushback?
- **Banned:** claiming you wrote production code/owned architecture; SWE/frontend framing.
- **Safe examples:** "I wrote acceptance criteria and ran refinement"; "we traded a strict deadline for data quality."
- **Length:** 90–130 words.
- **Convert:** outcome → constraint → tradeoff → collaboration workflow → rollout/monitoring.

### 10. Working with stakeholders
- **What's tested:** alignment across competing interests without losing the product goal.
- **Fitting situation:** finance/ops/sales/client with different priorities; you aligned them.
- **Questions:** Who were the stakeholders? Where did interests diverge? How did you align them to a product outcome? What did you concede?
- **Banned:** claiming org authority you lacked; inventing the result.
- **Safe examples:** "I reframed the debate around the user/workflow outcome."
- **Length:** 120–150 words.
- **Convert:** the divergence → how you reframed to the goal → the principled concession → result.

### 11. Leadership / ownership moment
- **What's tested:** initiative and ownership without formal authority.
- **Fitting situation:** you drove something end-to-end or stepped up when no one owned it.
- **Questions:** What did you take ownership of? Why you? What did you actually do? What was the claim-safe outcome?
- **Banned:** "I led the team" if you didn't manage people; inflated scope.
- **Safe examples:** "no one owned [workflow], so I drove discovery → scope → rollout."
- **Length:** 120–150 words.
- **Convert:** what you owned + why → what you did → outcome → what it shows about you.
