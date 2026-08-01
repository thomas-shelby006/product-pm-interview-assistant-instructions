# PMIA Legacy Feature Parity

## Decision rule

The upgraded runtime ports useful operator capabilities, not obsolete mechanisms. Manifest V3 remains the authority for identity, ordering, queueing, recovery and provider-rendered delivery proof.

| Older capability | Decision | PMIA 0.7 implementation |
|---|---|---|
| Pause and resume forwarding | Ported and improved | Session-level transport mode. Sender observation continues, previews are suppressed, and authoritative finals enter a bounded queue. |
| PM buffer | Ported and redesigned | Twenty-item `chrome.storage.session` operator queue with envelope identity, sequence, age, attempts and state. |
| Force/manual buffer flush | Replaced | Resume Latest or Send Selected uses normal sequence gates and rendered-turn proof; no unsafe forced finalization. |
| Queue while receiver generates | Already superior, exposed | Receiver supersession remains authoritative; dashboard shows generation and queue state. |
| Silence warning | Ported and improved | Source silence, runtime heartbeat and composer readiness are separate health markers. |
| Status indicator | Ported and expanded | Compact role overlays plus complete dashboard health. |
| Scroll lock | Ported | Existing shortcut and dashboard command share one semantic receiver action. |
| Sender microphone toggle | Ported | Existing shortcut and dashboard command share the provider adapter. |
| Context resend | Ported | Sender retains the current setup only in process memory and can restage it semantically. |
| Session export | Ported and improved | Dashboard and shortcuts request schema 2.1 role exports with safe review summaries. |
| Long code/text wrapping | Ported narrowly | Generic overflow-safe rendering; no coding overlay or DOM pruning. |
| Screenshot injection | Rejected | Focus, clipboard and privacy risk; unrelated to PM mock interviews. |
| Code-focus overlay | Rejected | Coding-specific behavior outside PMIA scope. |
| DOM-removing virtual scroll | Rejected | Can corrupt provider observation and message proof. Dashboard timeline is virtualized instead. |
| `localStorage` relay | Rejected | Replaced by authenticated extension messaging and session-only state. |
| Route guessing from prompt text | Rejected | Provider route is explicit Session Studio configuration. |
| `Alt+A`, `Alt+X`, `Alt+1`, `Alt+Z`, `Alt+Shift` | Rejected | They were compatibility no-ops, not features. |

## Active controls

- Dashboard: pause, resume latest, resume without sending, send/discard selected, discard all, health check, runtime repair, context resend, microphone, scroll lock, composer focus, export, layout, hide/restore and end session.
- Global shortcuts: `Alt+R`, `Alt+D`, `Alt+H`, `Alt+Shift+R`, `Alt+Esc`, `Alt+Delete`, `Alt+Tab`, `Alt+CapsLock`, `CapsLock`, `Alt+Q`, `Alt+W`, `Alt+E`, and `Alt+Shift+E`.

## Safety invariants

- Previews are disposable and never queued.
- Only validated final envelopes enter the operator queue.
- A duplicate acknowledgement closes delivery without resubmitting.
- A stale acknowledgement marks the older item superseded; it is not counted as delivered.
- A provider-rendered matching user turn is the delivery proof.
- Resume, JD, notes and setup text never enter disk-backed extension storage or safe diagnostics.
