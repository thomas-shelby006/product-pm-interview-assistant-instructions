# WIN1 SENDER LOG

SESSION_META
session_id:
session_type: practice
session_number:
date:
start_time:
end_time:
company:
target_role:
round:
mode:
project_used:
bridge_version:
ahk_version:

WINDOW_ROLE
window: win1_sender
role: sender
source_of_truth: interviewer_transcript_forwarding_and_win1_visible_output

EVENTS

---
event_seq: 0001
time:
type: raw_transcript
status: blocked
block_reason: filler_only
question_id:
text: |
  yeah okay
system_output: |
  — [pause] —
forwarded_to_win2: false
---

---
event_seq: 0002
time:
type: interviewer_question
status: forwarded
block_reason:
question_id: Q-0001
text: |
  Why fintech?
system_output: |
forwarded_to_win2: true
---

REVIEW_HINTS_FOR_CHATGPT
- This file is the source of truth for interviewer transcript capture and Win1-side behavior.
- Blocked/ignored events remain in this file. If a blocked event looks like a real question, flag a filter issue.
- If a question was forwarded but Win2 has no matching answer, flag a missing-answer issue.
- If the user manually typed something in Win1, evaluate it as Win1-only context.
