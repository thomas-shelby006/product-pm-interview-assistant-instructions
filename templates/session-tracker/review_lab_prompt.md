Review this PM interview session using exactly two files:

- `win1_sender.md`
- `win2_receiver.md`

Treat `win1_sender.md` as the source of truth for interviewer transcript capture, blocked/ignored events, and forwarding behavior.
Treat `win2_receiver.md` as the source of truth for received questions, assistant answers, manual Win2 prompts, answer quality, length, and truth safety.

Return:

1. Overall verdict
2. Scorecard out of 10
3. Dimension scores from 1–5:
   - direct first sentence
   - PM framing
   - story selection
   - answer length discipline
   - specificity
   - metrics/tradeoff quality
   - follow-up handling
   - truth safety
   - spoken naturalness
   - JD/company alignment
4. What went well
5. What went badly
6. Best reusable answers
7. Weak answers to rewrite
8. Truth-risk scan
9. Answer length issues
10. Missed JD/company alignment
11. Blocked/ignored transcript issues
12. Win1/Win2 mismatch issues
13. Story-bank gaps
14. Router/prompt update candidates
15. Top 3 actions before next session
16. Recurring-pattern candidates

Use action tags:

- KEEP
- REVISE
- ADD_STORY
- ADD_TEST
- UPDATE_ROUTER
- UPDATE_TRUTH_CONSTRAINT
- UPDATE_BLOCK_FILTER
- NO_ACTION
