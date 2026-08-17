# PMIA 0.12 User-Feature Migration Design

## Objective
Finish the real Stable Edge ChatGPT -> Claude + ChatGPT route, then migrate the highest-value 0.11 user-facing outcomes into 0.12 without recreating the 0.11 control plane.

The invariant remains: `W1 rendered turn -> direct port -> concurrent W2/W3 delivery -> provider-rendered proof`.

## Current evidence
- Current 0.11 production surface: 331 HTML/CSS/JS files, 26,629 lines, about 1.50 MB.
- 0.11 dashboard alone: 73 files, 6,163 lines, about 481 KB.
- Current 0.12 production surface: 32 files, 1,349 lines, about 62 KB.
- 0.12 already has Studio route selection, Resume/JD boot context, Auto/Gather, Pause/Resume, Send gathered, Export, Help/shortcuts, bounded stage history, concurrent fan-out, unresolved-role retry, and rendered-turn proof.
- Remaining live-route work: remove redundant router timeout ownership, then verify the exact Stable Edge ChatGPT -> Claude + ChatGPT route to terminal provider-owned results.
## Selection rubric
Each old capability is evaluated on five dimensions:
1. **Interview value** — does it help the user answer, control, recover, or review a live interview?
2. **Implementation complexity** — new modules, state machines, provider-specific code, or ownership boundaries.
3. **Hot-path cost** — any work added between W1 capture and W2/W3 rendered proof.
4. **Continuous cost** — polling, alarms, always-on observers, or repeated background derivation.
5. **State/privacy cost** — duplicated transcript/answer text, durable session state, or migration burden.

A feature is accepted only when it can stay outside the delivery hot path and does not create a second owner for delivery, sequencing, retry, or provider readiness.

## Non-negotiable budgets
- No new extension permissions.
- No new alarms or background polling loops.
- No new continuous provider DOM observer for analytics.
- No persistent copy of transcript or answer text; text inspection is on-demand and ephemeral.
- Active production size target: <= 45 HTML/CSS/JS files and <= 2,500 lines.
- Core delivery imports remain independent from review/navigation/accessibility UI.
- Synthetic fan-out retains no intentional serial delay and <25 ms in-memory dispatch target.
- Real-route success remains provider-rendered user-turn proof, not composer fill or backend receipt.
## Migration matrix
| 0.11 capability | Decision | 0.12 form | Reason |
|---|---|---|---|
| Provider route / comparison lane | Keep | Existing Studio selectors | Already simple and explicit. |
| Resume + JD context | Keep | Existing Studio boot context | High value; outside live sequencing. |
| Auto-submit / manual gather | Keep | Existing Auto/Gather + Send gathered | Core live control with one sender owner. |
| Pause / resume | Keep | Existing Pause/Resume | Core live control; no extra state machine. |
| Question path / truth rail | Keep simplified | Existing six-stage path row plus stable reason | High value; stage log already exists. |
| Readiness / Check live | Simplify | Derived Connected / Ready / Degraded status from registered roles + stage truth | Remove heartbeat, self-test trust, gap, storage, and repair dependencies. |
| Managed-window navigation | Keep simplified | Focus W1/W2/W3/Cockpit + Restore layout from launch-owned window IDs | Explicit command only; no delivery effect. |
| Session review / live scorecard | Keep simplified | On-demand Review sheet from stage history and one-shot role inspection | High user value; no continuous analytics. |
| Live answer analytics | Keep simplified | On-demand latest-answer word count + estimated speaking time | Avoid first-token/WPM observers and generation-time mutation processing. |
| Recent questions / timeline | Keep simplified | On-demand recent W1 turns + latest 20 stage events | Read page truth only when Review opens; do not persist text. |
| Strong / review / follow-up markers | Keep simplified | Bounded metadata-only markers keyed by turn ID | Useful for debrief; no text duplication. |
| Guided debrief | Keep simplified | Review summary + marked items + export | Avoid goals, threads, scenario engine, coverage matrix. |
| Export / support bundle | Keep simplified | Existing export plus route/status/summary/markers/version | One explicit user action; metadata only by default. |
| Graceful end | Keep simplified | End action checks unresolved deliveries, offers Export / Cancel / End anyway | Safety value without ledger/archive machinery. |
| Accessibility / keyboard help | Keep | Session-only text size, contrast, reduced motion + shortcuts | Pure UI state; zero delivery impact. |
| Session clock / phases | Keep only clock | Elapsed time in cockpit, derived locally | Useful during interviews; no phase state machine or runbook. || Inbox ledger search/filter/archive | Drop | None | 0.12 role queues already own delivery; a second user-visible ledger would recreate sequencing/state complexity. |
| Batch planner / drain one/all / interruption policy | Drop | Auto/Gather/Pause only | Queue ownership and provider Send readiness already serialize safely; extra policies add branches and failure modes. |
| Draft conflict arbitration | Drop | None | Requires PMIA-owned draft state and manual/automatic merge semantics; not needed in direct write path. |
| Outbox / sequence gap / storage pressure panels | Drop | Stable failure/reconnect status only | These expose retired persistence machinery rather than user outcomes. |
| Recovery scheduler / budget / crash-resume state machine | Drop | Automatic unresolved-role replay on reconnect | Multiple recovery owners caused complexity; reconnect retry is sufficient. |
| Runtime Pilot / Reliability Center / Operations Lab | Drop | Exported metadata + simple status | Development/operator surfaces, not interview controls. |
| Production control / operating profiles / containment | Drop | Explicit Auto/Gather/Pause | Hidden policy bundles are harder to reason about than direct controls. |
| Transport assurance / route doctor / self-test drill | Drop as live UI | Retain isolated automated tests and validator | Valuable for engineering evidence, not live interview UI. |
| Command palette / command history | Drop | Small fixed controls + shortcuts | Five primary controls remain faster and easier to learn. |
| Universal search / threads / workspaces | Drop | Recent questions in Review | High UI/state cost for limited live value. |
| Competency goals / scenario coach | Drop | External interview content remains in project prompt/context | Product coaching taxonomy is separate from transport/runtime. |
| Bookmarks beyond three markers | Drop | Strong / review / follow-up markers only | Keeps debrief value without a metadata workspace. |
| Focus mode / quiet mode | Drop | Cockpit remains visually minimal by default | The simple UI already solves the distraction problem. |
| Mic / scroll automation | Drop | Provider-native controls | Provider-specific UI automation adds fragility and is not required for transport. |
| Interrupt-latest / forced submit | Drop | Pause/Gather and provider FIFO | Destructive preemption conflicts with lossless simple delivery. |
| Hold-after-answer / retry-answer / no-response workflow | Drop | Provider Send availability + explicit Pause | Would require answer-generation ownership and more state. |

## Target UI
The cockpit keeps the same five primary buttons: **Auto, Pause, Send gathered, Export, Help**.

`Help` becomes a compact **Tools & Help** dialog rather than adding more always-visible controls. It contains: runtime status, focus/restore buttons, Review, display preferences, End session, and shortcuts. The main path row remains always visible.
## New simple components
1. `session-tools.js` — pure derivation for readiness, elapsed session time, unresolved counts, and safe end-state labels.
2. `inspection.js` — one-shot request/response over existing role ports. Sender returns recent user turns only when requested; answer roles return metrics computed in-page from the latest completed assistant turn. No raw answer text leaves the provider tab.
3. `markers.js` — bounded metadata-only marker store, keyed by `{sessionId, turnId}` with category `strong_answer | needs_review | follow_up`.
4. Cockpit Review/Tools rendering — UI-only modules or focused functions, imported only by cockpit code.

No new module is imported by `sender.js`, `fanout.js`, `role-queue.js`, or `deliver-turn.js`.

## Runtime snapshot additions
The service worker may add only cheap event-driven/session fields:
- configured roles/providers;
- role connected booleans;
- launch-owned window IDs;
- session start timestamp;
- bounded stages and bounded marker metadata.

Snapshot publication remains event-driven. No timer is added to the service worker.

## One-shot inspection contract
`inspect_session` is initiated only by an explicit Review/Copy action.
- Sender: last <= 20 rendered user turns `{id, text}`; returned to cockpit, never persisted by PMIA.
- Receiver/comparison: latest completed assistant response metrics `{wordCount, estimatedSpeakingMs}` and provider label; raw answer text stays in the provider page.
- If provider DOM evidence is unavailable, Review shows `Unavailable`; it never blocks or changes delivery.
## Real-route completion design
The current live blocker is completed before feature migration.

1. Keep the router fix that removes the redundant 10-second delivery timer. `deliverTurn` remains the single owner of write/submit/render time bounds; a port disconnect fails immediately.
2. Run the exact Stable Profile 1 route with normal off-screen windows, not minimized windows, because minimized Chromium throttles startup and distorts readiness evidence.
3. The diagnostic wait must exceed the provider-owned maximum delivery window so the harness never times out first.
4. If Claude returns `composer_write_failed`, inspect only MAIN-world editor write/ack logic.
5. If Claude returns `submit_unavailable`, inspect current Claude Send control semantics/selectors and update only the adapter contract.
6. If Claude returns `render_not_verified`, inspect current user-turn markup/text normalization and update only rendered-proof logic.
7. Acceptance requires both Claude and ChatGPT terminal `rendered` plus independent UI evidence of the exact synthetic turn, with foreground ownership unchanged.

## End-session behavior
`End session` is an explicit cockpit action.
- If no unresolved delivery exists: close only launch-owned PMIA windows after confirmation.
- If unresolved delivery exists: show count and offer **Export**, **Cancel**, or **End anyway**.
- Ending never deletes browser profile data, provider chats, tokens, cookies, or unrelated tabs.
- PMIA session storage may be left to browser-session lifecycle; no destructive cleanup is required for success.
## Verification contract
Every migrated feature gets a focused contract test first. Final verification must include:
- full `npm test` for active 0.12 tests;
- extension validator / reachability gate;
- isolated two-window and three-window Edge smokes;
- provider fixture smoke;
- synthetic fan-out performance benchmark;
- exact Stable Profile 1 ChatGPT -> Claude + ChatGPT real-route acceptance;
- a background/non-disturbance check that foreground window identity is unchanged during acceptance;
- final active-file/line-count check against the 45-file / 2,500-line budget;
- `git diff --check` and final diff review.

## Rollout
0.11 main stays untouched. 0.12 remains a separate unpacked extension and feature branch until all acceptance gates pass. The old 0.11 registration remains disabled, not deleted, for rollback. After verification, update the existing 0.12 deployment copy byte-for-byte from the feature branch and self-reload only that extension.

## Definition of done
The transition is complete when the real route passes, selected user-facing outcomes are present in the simple cockpit/Studio, rejected 0.11 machinery remains absent from the active import graph, performance budgets hold, and the installed 0.12 build matches the verified feature worktree without modifying dirty `main`.

### Architecture review 1
- Keep one bounded session-meta record in chrome.storage.session: route, configured roles/providers, session start time, and PMIA-owned window/tab IDs.
- Do not publish unresolved-delivery counts continuously; read unresolved storage only for explicit Review/End actions.
- This metadata is not crash-resume orchestration and contains no transcript, answer, Resume, JD, credential, or raw provider content.
- No delivery/sequencing/retry owner is added.

### User-value / UX review 2
- Keep exactly five always-visible cockpit controls. Secondary tools live behind the existing Help entry so provider windows remain dominant.
- Help dialog sections: **Status**, **Windows**, **Review**, **Display**, **End session**, **Shortcuts**.
- Add **Copy latest question** as a one-shot sender inspection + user-initiated clipboard action; do not persist copied text.
- Review shows at most 20 recent questions and 20 recent stage events; no separate Inbox, Timeline, Navigator, Assist, or Production tabs.
- A selected recent question may be marked `Strong`, `Needs review`, or `Follow-up`; marker storage contains only session ID, turn ID, category, and timestamp.
- Use interview language (`Ready`, `Waiting`, `Delivery issue`, `Latest answer`) instead of operator terms (`containment`, `ledger`, `recovery budget`, `transport assurance`).
- Elapsed session time may appear beside the connection state; it is UI-only and does not participate in runtime state.
### Performance / reliability review 3
- Answer metrics are computed only on explicit Review refresh; no generation observer, first-token tracker, or output-WPM loop is restored.
- Session clock is the only periodic UI activity: one cockpit-local 1 Hz text update, no storage/network/runtime messages.
- Role inspection requests are independent of role delivery queues and have short UI-side timeouts; inspection failure is display-only.
- Markers write only on explicit user action and are capped at 50 metadata records per session.
- Session meta is one bounded record; stage log remains capped at 200 entries.
- No feature module may import or wrap `deliverTurn`, `fanOutTurn`, `createRoleQueue`, or sender capture.
- No second timeout may preempt provider delivery. Transport failure is port disconnect; provider write/submit/render time bounds remain owned by `deliverTurn`.
- Performance acceptance: active source <=45 files / <=2,500 lines, no new permission, no background alarm, synthetic dispatch target unchanged, provider fixture skew remains within existing gate.
### Integration / rollback review 4
- Current 0.11 `main` is a read-only feature reference. Do not rebase or merge it into 0.12; migrate user outcomes manually into the simple architecture.
- Implement only in `feature/pmia-simple-runtime`; preserve all 27 current `main` working-tree changes.
- New owners are explicit: service worker = session meta/window commands; `session-tools.js` = pure status/end derivation; `inspection.js` = one-shot inspection protocol; `markers.js` = bounded metadata; cockpit = rendering/user actions.
- Every accepted feature has a focused contract test and a failure mode that is display-only unless it is an existing delivery failure.
- Sync the installed `__pmia012_deploy` copy only after automated gates pass; then self-reload only PMIA 0.12.
- Preserve the disabled 0.11 extension registration and its files for rollback.
- Leave the verified migration changes local unless the user separately authorizes staging/commit/push; do not merge into dirty `main` during this task.