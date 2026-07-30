# PMIA Final Architecture Design

## Objective

Complete the Manifest V3 Product Management Interview Assistant migration with lower latency, exactly-once question submission, a PM-only shortcut surface, and verification that does not interrupt the user's active desktop.

## Binding decisions

- The Manifest V3 extension is the authoritative provider runtime and transport.
- AutoHotkey remains a thin Windows launcher, layout manager, and PM hotkey host.
- Legacy Tampermonkey and prior AutoHotkey files remain preserved as rollback/reference material but are not active architecture.
- No private ChatGPT or Claude API calls, no raw audio capture, and no transcript persistence beyond the existing bounded session policy.
- Automated verification must be terminal-only. Browser verification may use already-open background sessions or managed windows launched minimized/off-screen without focus activation; it must never steal the foreground.

## Finalization architecture

### ChatGPT

ChatGPT user-message text is treated as a preview while it is transient, growing, or awaiting an authoritative conversation boundary. Placeholder values such as listening, transcribing, translating, processing, or recording are ignored. Each actionable text revision updates the receiver preview lane. The final commit is emitted exactly once when the corresponding assistant turn appears. Stable-tail timers must not submit ChatGPT questions.

Cross-navigation replacement IDs are not new turns. A canonical user-text fingerprint suppresses replacement DOM identities. A genuine repeated question is allowed only when the earlier emitted user turn still exists earlier in the ordered conversation.

### Claude

`transcript_interim` updates one preview turn and never submits. `user_input_end` is a processing hint only. `server_interrupt` preserves the current turn and preview. `transcript_empty` clears and advances the turn. A human `message_complete` frame is the only voice final commit. The extension then suppresses the later DOM shadow of that same committed turn.

### Receiver

Preview delivery is disposable and coalesced. Final delivery is durable and sequence-gated. When the normalized final text equals the staged preview, the receiver confirms and submits the existing composer content instead of rewriting it. A newer final supersedes queued or generating older work according to the existing latest-question policy.

## PM-only shortcut surface

Retain only shortcuts that directly support a PM interview:

- Alt+R: open Session Studio and launch/relaunch the selected route.
- Alt+Esc: resend current PM session context.
- Alt+Delete: safely end the managed session.
- Alt+Tab: hide or restore managed interview windows.
- Alt+CapsLock: cycle two-window, sender-only, and receiver-only layouts.
- Alt+Q: toggle the sender microphone through the provider adapter.
- Alt+W: toggle receiver scroll lock.
- Alt+E: export sender and receiver session records.

Remove the Alt+S screenshot workflow and remove active coding/code-focus compatibility handlers and descriptions. Preserve old files unchanged; do not delete archives or prior scripts.

## Silent-operation contract

Normal user launches may show the Session Studio because the user invoked Alt+R. Development and verification launches must use a silent test path that starts AHK hidden and creates managed browser windows minimized before navigation or uses existing background tabs. Tests must assert that unrelated Edge windows remain active and untouched.

## Acceptance criteria

- ChatGPT preview revisions never become timer-finalized questions.
- One ChatGPT submitted turn produces one receiver user turn across project-home navigation and streaming assistant updates.
- Claude interruption preserves the current preview; only transcript-empty resets it.
- All four provider routes submit one question and produce one answer in live verification.
- The >60-second minimized/background gate passes without re-registration or duplication.
- Alt+Delete closes only the managed pair and terminates the PMIA AHK process.
- Active runtime exposes only the PM interview shortcut surface above.
- Complete Node, extension validator, AutoHotkey validator, diff, secret, encoding, and repository checks pass from the exact release commit and merged main.
- Old files and unrelated browser state remain preserved.
