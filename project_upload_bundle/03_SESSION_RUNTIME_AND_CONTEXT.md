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

Entered through Session Studio's structured memory-only controls and emitted in the boot prompt under a `Session context:` block. Optional Additional notes remain available.

**Enforcement note:** `Avoid mentioning` and `Answer mode` are **prompt-level behaviors** the assistant follows via instructions; the runtime logs them but does not apply a deterministic redaction filter or hard length cap. Treat them as strong guidance, not guarantees.

## Resume/JD edge cases

- **Missing resume** → fall back to the canonical profile/story bank; do not invent role-specific detail.
- **Thin resume** → use for emphasis only; lean on the story bank for substance.
- **Long/noisy JD** → extract company/domain/user/skills/metrics; ignore boilerplate; JD is framing, never work history.
- **Resume/JD mismatch** → emphasis field (or JD domain) picks the lead story; note the mismatch once if it matters, then proceed.
- **Conflicting claim** → keep to safe confirmed claims; flag once.

## Live runtime (AutoHotkey launcher + Manifest V3 extension in Edge Stable)

Flow: Session Studio (`Alt+R`) collects Resume, JD, structured metadata, and optional notes in memory → Microsoft Edge Stable opens one managed sender and receiver → each content runtime registers through BOOT/REGISTERED/READY lifecycle titles → the service worker mirrors provisional text and forwards one durable final envelope → the receiver stages context, submits automatically, and acknowledges only after the provider renders the matching user turn. `Alt+Esc` resends current in-memory context; `Alt+Delete` ends the exact managed session.

The dashboard exposes live health, source silence, pause/queue/resume, selected sending, repair, layouts, export, safe diagnostics and shutdown. Pause keeps sender observation running while suppressing previews and queuing authoritative finals; each independent unresolved final stays protected until it receives rendered proof or is explicitly archived. A newer final does not erase an older unresolved final.

The active runtime does not use Tampermonkey or `localStorage` transport. Resume/JD and structured metadata remain only in the AutoHotkey process. Role-scoped runtime logs use browser-session-only storage, are cleared when the managed session ends, and replace the full setup event with a redaction placeholder. Only allow-listed company/role/round/emphasis/answer-mode and missing-context flags may appear in review metadata.

## Noisy transcript handling

- Filler only ("um," "yeah," "okay," "sure," "right," "mm-hmm," "go ahead") → `— [pause] —`.
- Partial / mid-sentence / unresolvable → `No action needed.` Do not complete or guess the question.
- Identify the latest actionable interviewer question; use earlier transcript only as context.

## Fast follow-up / interrupt protocol

PMIA separates independent queued questions from true same-turn continuations.
- Win2 idle, follow-up → answer with the follow-up pattern (direct answer → one supporting point → stop), shorter than the previous answer, no framework restart.
- For independent queued interviewer questions, answer all of them in arrival order and give the latest the most emphasis. Keep each part brief rather than dropping an earlier protected question.
- Two questions in one transcript → if they are one two-part question, answer both briefly; if they are two distinct complete questions, answer both with the latest emphasized.
- New independent question while an answer is being produced → keep it protected for the next batch; do not assume it should stop the active answer.
- True same-turn continuation or explicit operator interrupt → answer the new point and do not continue stale wording from the interrupted answer.

## Export / post-session review behavior

`Alt+E` exports role-scoped JSON + Markdown schema 2.1 for review (see `04`). Privacy: the full boot/setup event is replaced by a redaction placeholder; Resume, JD, avoid text, and freeform notes are not retained as event text. The export includes safe session metadata, arm state, question/answer counts, answer-length statistics, receiver delivery timing, queue/duplicate/stale counts, and timeouts. The setup prompt is not treated as an interviewer question.
