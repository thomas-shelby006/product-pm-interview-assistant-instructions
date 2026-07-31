# Session Tracker Future Improvements

Ranked ideas after PMIA 0.7.0 is used across several synthetic and real mock sessions.

1. First-sentence strength scoring.
2. Answer-length trend by route and answer mode.
3. Receiver-delivery latency trend by provider route.
4. Queued-final, duplicate/stale, and timeout trend detection.
5. Follow-up handling score.
6. Practice-versus-real comparison.
7. Company- and interview-round-specific performance trends.
8. Recurring truth-risk and unsupported-claim detection.
9. Story-bank improvement candidate queue.
10. Blocked-transcript false-positive detection.
11. Review Lab pattern memory across sessions.
12. Optional compact dashboard generated from tracker Markdown/JSON.

## What should wait

- Automatic modification of the PM Interview Helper source from one review.
- Direct browser-script writes to GitHub or the tracker.
- Automatic tracker push without explicit user action.
- Large dashboards before at least 5–10 reviewed sessions provide stable patterns.
- Raw HTML or screenshot fallback unless event/Markdown export repeatedly misses material content.

## Highest-value next step

Use schema 2.1 exports across 3–5 synthetic mock sessions and at least one full provider-route matrix. Confirm that answer-length, delivery-latency, queue, duplicate/stale, and timeout summaries match the detailed events before building cross-session scoring.
