# 01 — Candidate Profile and Story Bank

Confirmed positioning and reusable stories. Make the three roles sound like one coherent PM arc. **No unconfirmed stories are in this file** (see "Story gaps" at the end).

## Positioning

**Product Manager with experience across AI-ready B2B SaaS, fintech workflows, enterprise software, analytics dashboards, internal platforms, and operational automation.** Common thread: turning messy business workflows into software that reduces manual work and improves visibility and decisions. Title is always "Product Manager"; specialization is "product area."

## Company arc (fixed facts)

1. **TPI Composites** — Product Manager, internal manufacturing technology & quality systems. May 2022 – April 2024.
2. **Pemo** — Product Manager, SME onboarding & expense automation (B2B fintech). May 2024 – March 2026.
3. **DataCaliper** — Product Manager, B2B SaaS / enterprise workflow / analytics / AI-ready automation. April 2026 – present. (Current role: avoid long-tenure or large-impact claims.)

## Fixed opening anchor — "tell me about yourself" (~75 words, speak from memory)

> "I'm a Product Manager focused on workflow-heavy B2B software products. I started at TPI Composites on manufacturing and quality systems, then moved to Pemo, where I worked on fintech workflows like onboarding, expense automation, approvals, and spend visibility. Now at DataCaliper, I work on B2B SaaS, enterprise workflow, analytics, and decision-support products. My strength is turning messy business workflows into software that reduces manual work and gives teams better visibility — that pattern connects all three roles."

Use this by default; do not regenerate it each time. JD-specific variants:
- **Fintech JD:** lead with Pemo (onboarding, expense automation, approvals, spend visibility, finance-admin workflows); TPI = ops/analytics foundation; DataCaliper = enterprise SaaS/data depth.
- **AI/data/analytics JD:** frame around data, dashboards, automation improving decisions; TPI foundation → Pemo automation → DataCaliper enterprise analytics / AI-ready decision support.

## Company stories (use the 60-second shape; front-load the first sentence)

### TPI 1 — Quality-issue visibility
Use: product improvement, ambiguity, stakeholder alignment, metrics, internal tools, speed-vs-quality.
> "At TPI, I worked on internal manufacturing technology and quality systems for wind-blade operations. Quality problems weren't always visible in a structured way across shifts and teams. Production supervisors and quality teams needed a clearer way to capture defects, categorize issues, assign ownership, and track follow-up. I worked with inspectors, supervisors, and process teams to map the workflow, find missing fields and handoff gaps, and turn that into dashboard and workflow requirements — making quality issues easier to see, escalate, and resolve."
AI/tech angle: operational analytics, internal platform, data quality, decision support. No AI ownership.

### TPI 2 — Reducing manual reporting
Use: prioritization, dashboards, internal tools, process improvement, measuring success.
> "At TPI, production and quality reporting was fragmented across manual updates, Excel-style tracking, and shift summaries, which made leadership reviews slow and inconsistent. I worked with plant stakeholders to find which information actually drove daily decisions — line status, inspection progress, open defects, rework, blockers, corrective actions — and translated that into dashboard requirements, prioritizing the most-used views first. The lesson: internal tools should optimize for faster, clearer decisions, not more data."

### TPI 3 — Speed vs quality tradeoff
Use: tradeoff, conflict, risk, operational execution, stakeholder disagreement.
> "At TPI, a recurring tradeoff was speed versus quality. Delays have real operational cost, but quality issues can't be shortcut without downstream risk. I worked with production and quality stakeholders to identify which steps were essential controls versus manual handoffs causing unnecessary delay. The goal wasn't removing checks; it was making ownership, status, and escalation clearer."

### Pemo 1 — SME onboarding & activation
Use: fintech, product improvement, onboarding, activation, compliance tradeoffs, cross-functional execution.
> "At Pemo, my product area was SME onboarding and expense automation. Signup alone didn't mean activation — a company only got value after verification, card setup, inviting users, and using the spend workflow. I treated onboarding as a funnel: signup, document submission, KYC, card activation, first transaction, early usage. The PM challenge was reducing friction while keeping compliance and risk controls intact. I worked with design, engineering, compliance, operations, and customer-facing teams to improve the journey and measure activation more meaningfully."
AI/tech angle: automation, document flow, risk checks, activation funnels. No model ownership.

### Pemo 2 — Expense automation, receipt capture & matching
Use: workflow automation, AI-product automation, business users, finance workflows, metrics.
> "At Pemo, I worked on expense automation for SME finance teams. Employees made purchases, receipts were scattered, approvals lagged, and finance had to chase information before closing expenses. I focused on the workflow from transaction to receipt capture, matching, submission, approval, and finance review — simple for employees, controlled and visible for finance. Success wasn't feature usage; it was whether expenses moved through faster with fewer manual follow-ups and support issues."
AI/tech angle: receipt capture/matching, categorization, anomaly/risk signals, manual-correction rate, human review. No ML ownership.

### Pemo 3 — Spend controls & approvals tradeoff
Use: tradeoff, fintech risk, trust, compliance, admin controls, stakeholder conflict.
> "At Pemo, spend management had a tension between ease of use and control. Too strict and people avoid it; too loose and finance won't trust it. I worked the workflow from both sides: employees needed simple spend and submission, admins needed permissions, limits, approval rules, risk signals, and visibility. The PM decision wasn't speed versus control — it was designing the right control at the right point in the workflow."

### DataCaliper 1 — Ambiguous client requirements → enterprise workflow products
Use: current role, client discovery, Technical PM, enterprise SaaS, requirement clarity.
> "At DataCaliper, I work on B2B SaaS and custom enterprise software where clients arrive with business problems, not ready-made requirements. A recurring challenge is turning messy workflows into clear scope: user roles, permissions, approval steps, data fields, reporting views, acceptance criteria. I work with clients, engineering, design, QA, and delivery to clarify workflows before development, reduce rework, and validate releases through demos and feedback — making business processes easier to operate, measure, and scale."
AI/tech angle: strongest bridge to Technical/AI PM — software delivery, data modeling, workflows, integrations, dashboards, AI-ready processes.

### DataCaliper 2 — Making dashboards/analytics actionable
Use: analytics, dashboards, data trust, BI, decision support, AI-assisted insights.
> "At DataCaliper, a recurring theme is making business data actionable, not just visible. For dashboards I focus on who uses the data, what decision they need, which metric supports it, and whether they trust the underlying data. I look for friction — unclear definitions, stale data, missing drilldowns, manual exports, repeated stakeholder questions. Success isn't dashboard usage; it's whether users can act on the insight with confidence."
AI/tech angle: AI-assisted decision support framed as data readiness, trust, metric definitions, insight-to-action, fallback. No model ownership.

### DataCaliper 3 — Customization vs scalable enterprise design
Use: enterprise SaaS, technical tradeoffs, scope control, platform thinking, ERP-adjacent workflows.
> "At DataCaliper, a common tradeoff is client-specific customization versus scalable product design. If every request becomes a one-off build, the product gets hard to maintain. I separate reusable workflow logic from client-specific configuration — roles, permissions, statuses, reports, approval rules — so we meet the immediate need while keeping the module easy to extend and support."

## Story selection table

| Question | Story |
|---|---|
| Tell me about yourself | Fixed opening anchor |
| Why fintech? | Pemo 1 or Pemo 3 |
| Why Technical PM? | DataCaliper 1 or 3 |
| Why AI PM? | DataCaliper 2 first; Pemo 2 for workflow automation (no ML claims) |
| Product you improved | Pemo 1, Pemo 2, TPI 1 |
| Workflow automation | Pemo 2 or DataCaliper 1 |
| Dashboards / analytics | DataCaliper 2 or TPI 2 |
| Ambiguity | DataCaliper 1 or TPI 1 |
| Tradeoff | Pemo 3, TPI 3, DataCaliper 3 |
| Current role | DataCaliper 1 |
| Risk / control | Pemo 3 |
| Data trust | DataCaliper 2 |

Anchor rule: Pemo = fintech/activation/expense/approvals/finance workflows. DataCaliper = enterprise SaaS/analytics/AI-ready/dashboards/ERP-adjacent/Technical PM. TPI = operations/manufacturing/quality/internal tools/operational analytics. Pick one company; never force all three into one answer; never invent a new story.

## Prepared recruiter-risk answers

**Why are you leaving / looking (≈45s):**
> "I'm not leaving out of dissatisfaction. I'm being selective about the direction I want to grow as a PM — AI-ready B2B SaaS, fintech workflow automation, analytics, and enterprise workflow products. DataCaliper gives me useful enterprise and client-workflow exposure, but I'm looking for a role where I can go deeper on product ownership, customer problems, and measurable outcomes in that target domain."
Avoid: pay complaints, manager criticism, sounding rushed.

**Weakness (≈45s):**
> "I can over-index on discovery when a problem is ambiguous. That's useful early, but if I keep gathering context too long it delays the decision point. I've been setting clearer decision timelines — what we need to know, what can stay an assumption, and when we move to a small test or first version."
(Real weakness, concrete change, not a disguised strength.)

**Five years (≈35s):**
> "Leading product for a workflow-heavy B2B product — ideally fintech, analytics, or AI-assisted automation. Staying close to customer problems while taking more ownership of strategy, prioritization, and outcomes. Not just shipping features, but owning a product area that meaningfully improves how business users work."

## Prepared product opinions (pick one, 55–75 words, genuine preference not a teardown)

- **Stripe Dashboard** (fintech/B2B/payments/admin): likes how it turns a complex domain (payments, disputes, failed transactions, reconciliation) into a usable admin workflow; improvement = stronger failure guidance for small/non-technical businesses (what happened, what to do next, how urgent).
- **Notion** (productivity/workflow/onboarding): flexible building blocks are strong; weakness = blank-page problem for new teams; improvement = onboarding that asks what workflow they're running and starts them with a structured template.
- **Slack** (collaboration/enterprise): matches how work happens; risk = decisions/action items get buried; improvement = lightweight ownership/follow-up states in channels without becoming a project-management tool.
- **Admired PM — Shreyas Doshi** (30s): values his focus on influence without authority, clear tradeoffs, and activity-vs-impact; maps to aligning people on the right problem and making a defensible decision.

## Engineering collaboration pattern ("how do you work with engineering?", ≈60s)
> "I make the product problem and tradeoff clear before we discuss the solution. In workflow-heavy products I define the user outcome, acceptance criteria, edge cases, and what can be simplified in the first version. If engineering pushes back on complexity, I use that to separate what's truly required from what can be phased. The goal is to protect the product outcome while keeping the build realistic."
Signals: acceptance criteria, edge cases, scope tradeoffs, phased rollout, partnership.

## Banned / risky claims (truth floor — never override)

Never claim: company-wide/revenue/roadmap ownership; ML-model or AI-research/strategy ownership; full payments-platform or card-issuing strategy; global manufacturing strategy; Head of Product; large team management; exact KPI movement, customer names, A/B tests, team size, or compliance/pricing ownership unless explicitly provided.
Per company: **TPI** — no wind-blade product strategy, plant transformation, or defect-reduction numbers. **Pemo** — no full payments platform, card-issuing strategy, MENA expansion, revenue, compliance strategy, pricing, or AI-model ownership. **DataCaliper** — no full SaaS strategy, all-US-client ownership, flagship/from-scratch ownership, revenue, large-team management, or AI/data-science ownership; keep current-role impact modest.
Use instead: "I owned product requirements for…", "My product area was…", "I worked on workflows around…", "I partnered with…", "I measured success through…".

## Story gaps (Sundar must fill via `drafts/`, do not invent)

The bank still lacks confirmed: **failure/mistake**, **stakeholder conflict where Sundar held a position**, **proudest achievement**, **strongest PM skill**, and a dedicated **product-judgment / data-decision** story. Capture these in `drafts/STORY_BANK_TODO_CONFIRM_WITH_SUNDAR.md` using `drafts/STORY_BANK_COMPLETION_WORKFLOW.md`, run them through `drafts/CLAIM_SAFETY_CHECKLIST.md`, then promote confirmed versions here. Until then, for those questions, build a short principled answer from the profile without inventing specifics.
