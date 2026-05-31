# WIN2 RECEIVER LOG

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
window: win2_receiver
role: receiver
source_of_truth: receiver_questions_answers_and_manual_win2_prompts

EVENTS

---
event_seq: 0001
time:
type: received_question
status: received
question_id: Q-0001
related_event_id:
text: |
  [received question text]
---

---
event_seq: 0002
time:
type: assistant_answer
status: answered
question_id: Q-0001
answer_id: A-0001
word_count:
length_flag:
route_guess:
company_anchor_guess:
text: |
  [assistant answer text]
---

REVIEW_HINTS_FOR_CHATGPT
- This file is the source of truth for answer quality and Win2-side behavior.
- If the user manually typed something into Win2, keep it here and evaluate it separately from Win1 transcript.
- Compare received questions against Win1 forwarded questions.
- Evaluate directness, PM framing, answer length, story choice, truth safety, and JD alignment.
