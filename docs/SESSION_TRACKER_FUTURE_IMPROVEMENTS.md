# Session Tracker — Future Improvements (ideas only, not implemented)

Ranked by value-to-effort for the MVP's purpose: better PM interview performance over time.
None of these are built yet. Keep the MVP (two raw files + local push + Review Lab) intact first.

## Highest value, do sooner

1. **First-sentence strength score** — the MVP's biggest live lever is front-loading. Have the Review Lab score each answer's first 1–2 sentences as a standalone answer (0–2). Cheap, high signal. *Low risk.*
2. **Length-discipline trend** — track per-session % of answers over band / over 180 words. Cheap (data already in events). Surfaces the most common live failure. *Low risk.*
3. **Follow-up handling score** — did follow-ups stay shorter and avoid restarting the framework? Directly tied to live usability. *Low risk.*
4. **Recurring-weakness detection** — aggregate Review Lab action tags across sessions into `patterns/`; flag issues that repeat 3+ times. Turns one-off reviews into a real improvement loop. *Low–med effort.*
5. **Story-bank improvement candidates** — collect `ADD_STORY` tags over time; tell Sundar which real story to capture next, ranked by how often it was needed. *Low risk.*

## Medium value

6. **Blocked-transcript false-positive detection** — compare Win1 blocked/suppressed events against what a clean read of the transcript suggests was a real question; flag likely false blocks (`UPDATE_BLOCK_FILTER`). Improves capture reliability. *Med effort, needs care.*
7. **Answer-quality scoring over time** — a small rubric (PM framing, position, specificity, truth safety) scored per session and trended. Useful, but scoring drift is a risk; keep the rubric fixed. *Med.*
8. **Company-specific performance tracking** — index sessions by company/role/round; show where Sundar is weakest (e.g., fintech metrics vs enterprise ambiguity). *Med.*
9. **Practice vs real comparison** — compare performance/length/truth-risk between `practice/` and `real/` to see if live pressure degrades answers. *Med; depends on having real sessions.*
10. **Review Lab pattern memory** — periodically summarize `patterns/` into a short "known weaknesses" note the Review Lab reads first. *Med.*

## Lower priority / wait

11. **Optional JSON export** — add a structured `session.json` only if Markdown becomes limiting for aggregation. The bridge already holds structured data internally; export it only when an analytics step actually needs it. *Wait until aggregation is real.*
12. **Optional HTML fallback** — save Win1/Win2 full HTML into the session `raw/` folder for forensic recovery if DOM capture misses messages. Useful as a backup, but noisy and parse-heavy; add only if capture gaps show up in practice. *Wait.*

## What is risky (do not rush)

- Anything that auto-updates the **instruction repo** from a review → forbidden; keep human-reviewed PRs.
- DOM-level capture changes to the **bridge** during a live session → can break answering; validate on Windows first.
- Putting any GitHub token in the browser/Tampermonkey/AHK → never.
- Auto-merging anything other than the append-only tracker data.

## How this tracker improves the PM Interview Helper

The tracker closes the learning loop: each session produces two raw files → the Review Lab emits action tags → recurring tags reveal real weaknesses → those become **human-reviewed** PRs to the instruction repo (story-bank additions, router/length fixes, truth-constraint tightening, block-filter tuning). Over time the helper gets better because it learns from real sessions, not guesses — while the instruction repo stays human-governed and the tracker stays append-only data.
