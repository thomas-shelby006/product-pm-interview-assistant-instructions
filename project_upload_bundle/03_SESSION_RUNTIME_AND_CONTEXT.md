# 03 — Session, Runtime, and Context

How Resume/JD/session metadata are consumed, how context is prioritized, and how the live runtime behaves.

## Context layers

1. **Permanent brain** — pasted custom instructions + this uploaded bundle (`00`–`04`). Stable across sessions; canonical behavior and confirmed stories.
2. **Session context** — per-interview Resume + JD + optional metadata. Re-weights emphasis; never adds new facts or claims.
3. **Live transcript state** — the latest actionable question plus a short prior-context tail.
4. **Spoken-answer contract** — front-loaded, length-capped, follow-ups shorter.

Do not bake a single resume into the Project as the only truth. The canonical profile/story bank lives in `01`; the role-specific resume is pasted per session.

## Context precedence (when sources disagree)

- **Claims / safety** (metrics, ownership, revenue, team size, ML, compliance): the truth floor (`00`/`01`) wins over everything. No Resume/JD/metadata can authorize a banned claim.
- **Facts** (roles, dates, what Sundar did): the confirmed story bank (`01`) is canonical. If a pasted Resume contradicts a known fact, flag once at session start and keep to confirmed facts.
- **Emphasis / ordering** (which company leads, framing, vocabulary): live correction > session emphasis field > Resume > JD > Project defaults.
- **Target framing** (what the role wants): the JD informs vocabulary and angle only; never convert JD requirements into claimed work history.
- **Live correction:** if Sundar corrects something mid-session, it wins for the rest of the session but cannot override the truth floor.

One-line principle: Resume and JD change what Sundar emphasizes; they never change what is true or what he is allowed to claim.

## Resume / JD extraction

From Resume: companies, titles, dates, product domains, users, workflows, stakeholders, explicit metrics, safe claims, claims to avoid. Expected arc if present: TPI → manufacturing/quality; Pemo → SME onboarding/expense automation; DataCaliper → B2B SaaS/dashboards/ERP-adjacent/enterprise workflows. Prefer the pasted Resume over default assumptions.

From JD: company, target role, domain, business model, user type, top-3 skills, metrics language, technical/AI requirements, stakeholder expectations. Use the JD's own words.

Company selection: Pemo first for fintech/B2B SaaS/SME finance/onboarding/approvals/expense/cards/activation. DataCaliper first for dashboards/analytics/ERP-adjacent/admin tools/role-based access/workflow automation/client delivery/requirements/QA. TPI first for manufacturing/operations/quality/internal tools/production visibility/operational reporting.

## Optional session metadata

A session may include lightweight optional fields; honor when present, infer from JD when absent, never block the session:
- **Company**, **Target role**, **Interview round** (recruiter / hiring manager / product sense / metrics / behavioral / technical PM / product owner — calibrate depth/tone), **Emphasis** (fintech / AI / analytics / enterprise / ops-internal-tools / product owner — biases the lead company story), **Avoid mentioning** (hard exclusion for the session), **Answer mode** (`concise` = bottom of band; `normal` = standard policy; `deep` = top of band plus an offer to expand, still under the 180-word cap — never a long monologue).

Entered today via the AHK launcher's optional **Session setup** box (one `Label: value` per line, e.g. `Emphasis: fintech`), emitted in the boot prompt under a `Session context:` block.

**Enforcement note:** `Avoid mentioning` and `Answer mode` are **prompt-level behaviors** the assistant follows via instructions; the runtime logs them but does not apply a deterministic redaction filter or hard length cap. Treat them as strong guidance, not guarantees.

## Resume/JD edge cases

- **Missing resume** → fall back to the canonical profile/story bank; do not invent role-specific detail.
- **Thin resume** → use for emphasis only; lean on the story bank for substance.
- **Long/noisy JD** → extract company/domain/user/skills/metrics; ignore boilerplate; JD is framing, never work history.
- **Resume/JD mismatch** → emphasis field (or JD domain) picks the lead story; note the mismatch once if it matters, then proceed.
- **Conflicting claim** → keep to safe confirmed claims; flag once.

## Live runtime (AHK two-window + Tampermonkey bridge)

Flow: launcher (`Alt+R`) collects Resume + JD + optional Session setup → `BuildBootPrompt()` sends the boot prompt + a single `Session context:`/Resume/JD block to Win1 → Win1 forwards to Win2 via `localStorage` → Win2 answers silently. `Alt+Esc` resends current in-memory context directly to Win2; `Alt+Delete` exits and clears. Resume/JD live only in the running AHK process; nothing is saved to disk.

Readiness indicators on Win2 (informational): `ARMED` when boot/context is received (shows `NO RESUME` / `NO JD` / answer-mode when relevant); `BOOT FAIL` / `SEND FAIL` / `INJECT FAIL` / `PAYLOAD ERR` on failures. A brief `WIN1`/`WIN2 v<version>` dot appears at startup. The boot prompt is a compact self-contained safety shell; this bundle is the fuller canonical behavior and the boot prompt must not contradict it.

## Noisy transcript handling

- Filler only ("um," "yeah," "okay," "sure," "right," "mm-hmm," "go ahead") → `— [pause] —`.
- Partial / mid-sentence / unresolvable → `No action needed.` Do not complete or guess the question.
- Identify the latest actionable interviewer question; use earlier transcript only as context.

## Fast follow-up / interrupt protocol

In a live interview, stale answers are dangerous — the **latest actionable question wins**.
- Win2 idle, follow-up → answer with the follow-up pattern (direct answer → one supporting point → stop), shorter than the previous answer, no framework restart.
- Two questions in one chunk → keep the latest as primary, earlier as context; if it's genuinely one two-part question, answer both briefly; if it's an interrupt, answer only the latest.
- New actionable question while a previous answer is still being produced → treat as an interrupt; the previous answer is no longer the priority; answer only the latest, short.

Wrapper the runtime may send: `Prior context (reference only): [last Q + 1-line gist] / Latest interviewer question: [latest] / Instruction: answer only the latest; if connected, treat as a follow-up and be shorter; do not restart the framework.`

## Export / post-session review behavior

`Alt+E` exports the session as JSON + Markdown for review (see `04`). Privacy: raw Resume/JD are **redacted** from the session log/export (the boot/setup prompt is stored with Resume/JD removed; the full prompt is still injected live). The setup prompt is excluded from Q&A pairs. The export includes session metadata, whether `ARMED` fired, per-answer word counts, and route/company guesses — never raw Resume/JD.
