# PM Interview Dual-Provider Bridge

Manifest V3 extension used by `runtime/Final_2_Window_Extension.ahk`.

## Scope
- Routes text between one sender tab and one receiver tab using the extension service worker.
- Supports ChatGPT and Claude independently in either role.
- Uses provider DOM adapters only. It does not call captured/private ChatGPT or Claude endpoints.
- Stores a bounded local session event log; Resume and Job Description bodies are redacted from logged text.

## Load in Edge
1. Open `edge://extensions` in the existing Edge Default profile.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `runtime/extension` directory.
5. Keep the extension enabled. The AHK launcher adds `pmia_session`, `pmia_role`, and `pmia_provider` to managed tabs.

Normal ChatGPT or Claude tabs without those parameters are untouched.

## Runtime status
Managed tabs show a small top-left status pill and defend stable titles:
- `PMIA_SENDER_CHATGPT`
- `PMIA_SENDER_CLAUDE`
- `PMIA_RECEIVER_CHATGPT`
- `PMIA_RECEIVER_CLAUDE`

## Keyboard bridge
- `Ctrl+Shift+F5`: sender boot/context send and local sender context load.
- `Ctrl+Shift+F7`: receiver direct boot/context resend.
- `Ctrl+Shift+F8`: receiver JSON and Markdown export.
- `Ctrl+Shift+F9`: focus receiver composer.
- `Ctrl+Shift+F10`: toggle receiver auto-scroll.
- `Ctrl+Shift+F12`: force-forward current sender candidate.
- `Ctrl+Alt+0`: pause/resume the managed tab.

## Development checks
From repository root:

```powershell
npm test
npm run validate
```

The original Tampermonkey and AHK runtime remain the fallback until live parity is confirmed.
