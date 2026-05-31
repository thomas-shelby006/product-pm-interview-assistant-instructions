# Session Tracker MVP

Purpose: keep interview practice/live session evidence in a separate private GitHub repo so ChatGPT can review performance over time.

## Decision

Use exactly two raw Markdown files per session:

- `win1_sender.md`
- `win2_receiver.md`

No combined Q&A file in the MVP. No separate blocked-word file. Blocked/ignored events are written inside the relevant window file.

## Repo separation

Instruction/source repo:

- `product-pm-interview-assistant-instructions`
- Contains Project instructions, upload bundle, runtime scripts, docs.
- Human-reviewed changes only.

Session tracker repo:

- Suggested name: `pm-interview-session-tracker`
- Private repo.
- Stores append-only session logs and ChatGPT review outputs.
- Auto-merge is acceptable because this repo stores session data, not behavior/source instructions.

## Folder layout

```text
practice/
  0001_2026-06-01_pemo_pm_behavioral_mock/
    win1_sender.md
    win2_receiver.md

real/
  0001_2026-06-05_razorpay_pm_recruiter_live/
    win1_sender.md
    win2_receiver.md

reviews/
  practice/
    0001_2026-06-01_pemo_pm_behavioral_mock/
      review.md
      improvement_actions.md
  real/
    0001_2026-06-05_razorpay_pm_recruiter_live/
      review.md
      improvement_actions.md

patterns/
  recurring_patterns.md
  system_update_candidates.md
```

## Window ownership

### Win1 sender

`win1_sender.md` owns everything that happened in the sender/transcription window:

- raw interviewer transcript
- cleaned transcript if available
- blocked/ignored transcript events
- forwarded question events
- any manual text typed into Win1
- any assistant/system output visible in Win1

### Win2 receiver

`win2_receiver.md` owns everything that happened in the receiver/answer window:

- received questions
- injected prompts/questions
- assistant answers
- manual prompts typed directly into Win2
- regenerated answers
- answer word counts if available
- route/company guesses if available

## File format

Each file should use fixed Markdown blocks optimized for ChatGPT review.

Example event block:

```md
---
event_seq: 0003
time: 2026-06-01T21:14:03+05:30
window: win1_sender
type: raw_transcript
status: blocked
block_reason: filler_only
question_id:
text: |
  yeah okay
system_output: |
  — [pause] —
---
```

Blocked events remain inside the relevant window file. They do not need a separate tracker file in the MVP.

## Session types

Track both:

- `practice/` — solo practice and mock interviews with friends.
- `real/` — real interviews or serious external interviews.

Practice and real sessions are separated in the repo because patterns may differ.

## End-session flow

1. User presses end-session shortcut.
2. Win1 exports `win1_sender.md`.
3. Win2 exports `win2_receiver.md`.
4. Local script creates the next session folder under `practice/` or `real/`.
5. Local script commits/pushes a session branch.
6. Local script merges the session branch into tracker `main`.
7. Local script opens the Review Lab Project prompt.

## Review flow

A separate ChatGPT Project should be used:

- `PM Interview Review Lab`

It should review the two files and produce:

- what went well
- what went badly
- score
- unsafe claims
- answer length issues
- weak first sentences
- missed JD alignment
- blocked transcript mistakes
- story-bank gaps
- router/update candidates
- recurring patterns over time

The Review Lab may write review outputs into the tracker repo later. The instruction/source repo should only be updated after a pattern is clear and the user decides to update the PM Interview Helper system.

## Guardrails

- Do not push directly from ChatGPT windows to GitHub.
- Browser/Tampermonkey captures and exports only.
- Local script owns Git branch/commit/push/merge.
- Tracker repo can auto-merge session data.
- Instruction repo must not auto-merge behavior changes.
