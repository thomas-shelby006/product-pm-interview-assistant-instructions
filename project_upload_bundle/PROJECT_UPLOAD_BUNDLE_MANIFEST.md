# ChatGPT Project Upload Bundle — Manifest

This folder is the **recommended upload set** for the "PM Interview Helper" ChatGPT Project. It condenses the detailed `project_source_files/` into a small, internally consistent bundle so a ChatGPT Plus Project stays under practical file limits.

## What to do (exact setup)

1. **Custom instructions field** (paste this): the contents of `../CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` (compact always-on contract, < 8000 chars).
2. **Upload these 5 files** from this folder:
   - `00_PROJECT_CORE_INSTRUCTIONS.md` — behavior contract, live-answer rules, truth floor, special tokens, length policy, source precedence.
   - `01_CANDIDATE_PROFILE_AND_STORY_BANK.md` — confirmed candidate profile, company contexts, confirmed story bank, prepared answers, story selection, banned claims.
   - `02_ROUTER_METRICS_DELIVERY.md` — route classifier + per-route answer shapes, metrics trees, spoken delivery guide.
   - `03_SESSION_RUNTIME_AND_CONTEXT.md` — Resume/JD/session metadata behavior, context precedence, fast follow-up, noisy transcript, answer mode, avoid-mentioning, export/review behavior.
   - `04_TESTS_REVIEW_AND_MOCK_LOOP.md` — regression tests, post-session review prompt, mock-session loop, improvement action tags.

That's **1 pasted field + 5 uploaded files**.

## What NOT to upload

- Anything in `../drafts/` — unconfirmed story scaffolds, claim-safety checklist, story-bank completion workflow. These contain placeholders and must never enter the Project.
- `../runtime/` — AHK script, Tampermonkey scripts, install/test docs (local automation only).
- `../ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md`, `../AHK_PHASE_2_IMPLEMENTATION_PLAN.md`, `../AI_SYSTEM_CONTEXT.md`, `../FILE_MAP.md`, `../README.md` — repo orientation/design docs, not Project behavior.
- The individual `../project_source_files/*` files — these remain as **source/reference** (the bundle is derived from them) but are **not** the preferred upload set. Upload the bundle instead, not both, to avoid duplication.

## Source-of-truth relationship

- **Canonical detailed behavior:** this bundle (`00`–`04`).
- **Always-on compact contract:** the pasted custom instructions. It defers to the bundle for detail; its truth/safety rules always hold.
- **Reference/source:** `project_source_files/*` (the bundle was condensed from these; keep for history/editing, do not upload alongside the bundle).
- **Local automation safety shell:** the AHK boot prompt (`project_source_files/PM_BOOT_PROMPT_FOR_AHK.md` + the copy embedded in `runtime/Final_2_Window_Fixed.ahk`) is a compact, self-contained safety shell so a live session stays safe even if Project retrieval is imperfect. The bundle is the fuller canonical behavior; the boot prompt must not contradict it.
- **Draft-only (never uploaded):** `drafts/*`.

## Consistency rules baked into this bundle

- PM-only. Never frontend/SWE/coding framing unless explicitly asked.
- Estimation answers target **130–160 words** (deeper only if asked, hard cap 180).
- Truth floor: no invented metrics, ownership, revenue, team size, customer names, A/B tests, ML/compliance ownership.
- Special tokens: `— [pause] —`, `No action needed.`, `[interviewer Q&A — answer from your own prepared questions]`, `[candidate-handled topic — answer from memory]`.
- No unconfirmed stories: failure / stakeholder-conflict / proudest-achievement / strongest-skill stories are **not yet in the bundle** — Sundar fills them via `drafts/` and promotes confirmed versions into `01_…`.
