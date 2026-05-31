Review this PM interview session using exactly two raw files:

- `win1_sender.md`
- `win2_receiver.md`

Treat `win1_sender.md` as the source of truth for interviewer transcript capture, blocked/ignored events, manual Win1 input, and forwarding behavior.
Treat `win2_receiver.md` as the source of truth for received questions, assistant answers, manual Win2 prompts, answer quality, length, and truth safety.

Do not ask Sundar to manually inspect the raw files. You are the reviewer. Compare both files and produce a decision-ready review.

## Review output

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

## Action tags

Use action tags for each issue:

- KEEP
- REVISE
- ADD_STORY
- ADD_TEST
- UPDATE_ROUTER
- UPDATE_TRUTH_CONSTRAINT
- UPDATE_BLOCK_FILTER
- NO_ACTION

Use this table:

```text
question_or_event | problem | action_tag | exact_change
```

## Pattern discipline

Do not recommend changing the main PM Interview Helper system after one weak answer unless it is severe or truth-risky.

Classify each update candidate as:

- session-only coaching
- repeated-pattern candidate
- urgent system fix

Only repeated patterns and urgent truth-safety fixes should later move into the instruction repo.
