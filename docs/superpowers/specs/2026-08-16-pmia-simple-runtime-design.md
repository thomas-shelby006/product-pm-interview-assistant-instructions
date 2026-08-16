# PMIA Simple Runtime Design

## Goal
Make the core interview path small, fast, and observable:

`Window 1 submitted user turn -> concurrent fan-out -> Window 2 write+submit -> Window 3 write+submit -> compact status`

The runtime must optimize for latency and correctness. The fact that development/testing should avoid disturbing the user's viewport is an operator constraint only and does not influence architecture.

## Fresh findings from the 0.11 source

1. Launch is sequential across sender, receiver, comparison, and dashboard lifecycle phases.
2. Boot/context is sent through Window 1 using clipboard + Ctrl+Shift+F5 and then routed through the same delivery machinery as live questions.
3. Comparison delivery is intentionally fire-and-forget and comparison startup can degrade to primary-only.
4. One live question currently crosses many owners: sender tracker -> sender outbox -> persistence lanes -> Pilot -> background delivery coordinator -> role-port/fallback transport -> receiver sequence buffer -> batch runtime -> provider adapter -> proof reconciliation.
5. The cockpit is a large independent dashboard with many recovery/analytics panels, which makes the active failure path hard to read.

## Architecture decision

### Hot path: Extension native
AutoHotkey is not part of question delivery.

- Window 1 content runtime owns capture of a newly submitted user turn.
- A direct long-lived extension port sends the turn to the service worker/background coordinator.
- The coordinator fans out to Window 2 and Window 3 concurrently with `Promise.allSettled`-style behavior.
- Each answer runtime owns one FIFO queue and one provider adapter.
- Adapter contract is exact: `write(text) -> verifyComposer(text) -> submit() -> verifyRenderedTurn(text)`.
- Success means rendered user-turn proof. Backend receipt, queue admission, or visible-but-unsubmitted composer text is not success.

### Reliability without blocking the fast path
- Sender keeps unacknowledged turn IDs in a tiny per-tab queue.
- Background keeps only unresolved per-role deliveries for the active session.
- Successful fan-out does not wait for analytics, export, cockpit rendering, or generic session persistence.
- Retries happen only for a role that did not reach rendered-turn proof; a successful role is never replayed.
- Deduplication key is `{sessionId, turnId, role}`.

### Boot/context path
Boot is not routed through Window 1.

- Studio sends context directly to Window 2 and Window 3 as `kind: boot`.
- Boot uses the same provider write/submit primitive, but it is outside live question sequencing.
- Live sequence begins at question 1 after boot.
- Studio may show one line per answer role: `boot pending | submitted | rendered | failed`.

### AutoHotkey responsibility
AutoHotkey is reduced to:
- start/restart PMIA Studio;
- launch Edge app windows with the selected profile/provider URLs;
- apply the chosen window geometry;
- optional global hotkeys that send control commands to the extension.

It does not copy prompt text, activate provider windows to deliver messages, own session state, or run a full GUI.

### Studio UI
A small extension web page replaces the large AHK setup GUI.

Default surface:
- Window 1 provider
- Window 2 provider
- Window 3 provider / Off
- Resume
- Job description
- `Launch`

Secondary settings are under one `More` disclosure.

### Cockpit UI
A narrow dock under the provider windows, not a fourth equal-size work surface.

Default contents:
- Auto Forward toggle
- Pause / Resume
- Manual Gather toggle
- Export
- Help
- one compact path row for the latest turn:
  `W1 captured -> W2 submitted/rendered | W3 submitted/rendered`

No flashing `resyncing live` loop. If runtime state is stale, show one stable `Disconnected`/`Recovering` indicator with the last transition time.

### Logging
Keep one bounded stage log per role, maximum 200 entries in session storage.

Allowed stages:
- `captured`
- `fanout`
- `composer_written`
- `submitted`
- `rendered`
- `failed`

Each entry contains only timestamp, role, turn ID, stage, elapsed milliseconds, and reason code. Transcript text is not duplicated into the diagnostic log.

## Performance target

Internal PMIA overhead target, excluding provider/model/network generation:
- Window 1 rendered turn -> fan-out dispatch: < 25 ms typical
- fan-out dispatch to both roles: concurrent, no intentional wait between W2 and W3
- cockpit/logging work: asynchronous and never blocks delivery

Provider composer/write/submit latency is measured separately per role.

## Migration strategy

Build the simple runtime alongside the 0.11 runtime in an isolated branch. Do not delete the old implementation until the new focused contract tests and isolated browser smoke pass. Then switch the manifest/launcher to the simple path and remove only code proven unused by the new entry points.
