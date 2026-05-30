# Claim-Safety Checklist (DRAFT — NOT FOR PROJECT UPLOAD)

> Run every story sentence and every answer claim through this before it goes into
> `project_source_files/`. The truth constraints in `PM_INTERVIEW_TRUTH_CONSTRAINTS.md`
> always win. When in doubt, downgrade to the safer column. The assistant must never
> upgrade a claim on its own.

## Classification

- **SAFE** — say freely; qualitative, role-appropriate, no hard numbers/ownership.
- **RESUME-ONLY** — say only if the pasted Resume explicitly supports it (and it doesn't contradict the story bank).
- **CONFIRM-ONLY** — say only if Sundar has explicitly confirmed it is true for him.
- **BANNED** — do not say; too risky / unverifiable / overclaim, regardless of source.

## Claim types

| Claim type | SAFE | RESUME-ONLY | CONFIRM-ONLY | BANNED |
|---|---|---|---|---|
| **Metrics** | qualitative direction ("reduced manual steps", "teams stopped using spreadsheets") | a specific number only if it is on the resume verbatim | a rough range Sundar confirms he can defend | invented %/$, precise uplift, made-up baselines |
| **Ownership** | "I drove / I worked on / I was the PM for" | scope stated on resume | "I led" for a specific workstream Sundar confirms | "I owned the whole product/org", authority not held |
| **Team size** | "I worked with engineering and design" | a number on the resume | a size Sundar confirms | invented headcount, "I managed N people" if not a manager |
| **Revenue impact** | "supported the business / reduced cost of manual work" | a figure on the resume | a directional claim Sundar confirms | invented revenue, ARR, or growth figures |
| **Customer names** | "an SME customer", "a finance team", generic personas | names allowed by resume/JD context | a named customer Sundar confirms is OK to mention | dropping real customer names without confirmation |
| **A/B tests / experiments** | "we shipped a small reversible version and watched usage" | an experiment named on the resume | an experiment Sundar confirms he ran | invented A/B tests, p-values, experiment results |
| **AI / ML ownership** | "AI-assisted decision support", "data-quality guardrails", "human fallback" | model work stated on resume | specific model involvement Sundar confirms | "I owned the ML model", "I built the fraud model", company-wide AI ownership |
| **Roadmap ownership** | "I prioritized within my area" | roadmap scope on resume | roadmap authority Sundar confirms | "I owned the company roadmap / strategy" |
| **Compliance ownership** | "I worked within compliance constraints" | compliance scope on resume | a specific compliance role Sundar confirms | "I owned compliance/KYC/SOC2" |
| **Title** | "Product Manager" (use for all roles) | — | — | "Senior/Lead/Head/Director" or "AI PM/TPM/PO" as a past *title* |
| **Frontend / SWE** | technical background as PM leverage | — | — | framing self as engineer; "I coded the feature"; debugging/code-explanation framing |
| **Company-specific** | the defined TPI/Pemo/DataCaliper product areas | details supported by resume/JD | specifics Sundar confirms | TPI strategy overclaim, Pemo platform overclaim, DataCaliper recency/scope overclaim |

## Quick rules

- A claim with a **number** is RESUME-ONLY or CONFIRM-ONLY — never SAFE by default.
- A claim with **"owned" / "led" / "I built"** needs CONFIRM unless the resume backs the scope.
- If the JD wants something Sundar hasn't done, that is **target framing**, not experience — never convert it to a claim.
- A live correction from Sundar can soften a claim for the session, but can never upgrade a BANNED claim.
- If you can't classify a claim, treat it as CONFIRM-ONLY and flag it.
