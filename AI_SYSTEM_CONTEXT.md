# PMIA 0.11.0 System Context

PMIA is a local Microsoft Edge Manifest V3 extension with an AutoHotkey v2 launcher. The repository at `C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions` is the only application source and deployment source.

The extension runs content scripts on ChatGPT and Claude pages. The service worker owns registration, durable final-question acceptance, sequence ordering, lossless delivery state, receiver batch ownership, recovery, transport control, and shared dashboard state. Content runtimes own provider-specific DOM observation, provisional previews, authoritative finalization, composer interaction, rendered-turn proof, answer tracking, and compact status overlays. The Runtime Pilot Dashboard exposes the same authoritative state and commands.

AutoHotkey owns Session Studio, browser profile selection, read-only preflight, provider-window launch, window layout, native hotkeys, session shutdown, and Review Studio launch. It does not implement transcript transport or provider DOM logic.

Private session exports are written to `.local\session-tracker`, which is ignored by the application repository. Active Resume, job description, notes, prompts, answers, and session data remain in process or browser-session memory and are not committed.

The runtime is fail-closed. A final remains owned until the receiver has staged it or a matching provider-rendered user turn proves delivery. Preview text never becomes durable truth. New questions arriving during answer generation are accumulated for the next batch instead of interrupting the active answer unless the operator explicitly requests an interruption.
