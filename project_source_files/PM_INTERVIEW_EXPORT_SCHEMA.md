# PMIA Current Session Export Schema

The active Manifest V3 runtime exports one role-scoped JSON file and one role-scoped Markdown file for each managed sender or receiver. The current schema version is **2.1**.

## Ownership and entry points

- `runtime/extension/shared/session-log.js` builds the structured export and Markdown representation.
- `runtime/extension/content/entry.js` requests browser downloads for the active role.
- `runtime/extension/shared/session-control.js` targets one exact registered sender and receiver.
- `runtime/Session_Tracker_End_Session.ahk` and `runtime/scripts/resolve-pmia-session-exports.ps1` accept only one fresh matching pair.
- `runtime/scripts/push-session-to-tracker.ps1` writes the paired evidence to `.local/session-tracker`.

## File identity

A valid Markdown export contains:

```text
# PM Interview Assistant Session

Session: <session-id>
Window: sender / chatgpt
```

The provider may be `chatgpt` or `claude`, and the role must be `sender` or `receiver`. Review Studio rejects incomplete, stale, duplicate, malformed, or cross-session pairs.

## JSON structure

```json
{
  "schemaVersion": "2.1",
  "sessionId": "pmia-...",
  "role": "sender",
  "provider": "chatgpt",
  "exportedAt": "2026-08-04T00:00:00.000Z",
  "context": {
    "company": "allow-listed value",
    "role": "allow-listed value",
    "round": "allow-listed value",
    "emphasis": "allow-listed value",
    "answerMode": "normal",
    "resumeMissing": false,
    "jobDescriptionMissing": false
  },
  "events": [],
  "summary": {},
  "mockReview": {}
}
```

The exact event and summary fields vary by role and observed session behavior. The runtime derives answer length, delivery timing, queueing, duplicate acknowledgement, stale acknowledgement, timeout, explicit archive, Pace Guard, and other operational metrics when evidence exists.

## Privacy contract

The export does not include the complete Resume, job description, boot prompt, session notes, credentials, cookies, authorization data, or provider page URL. Setup events are redacted. Only allow-listed structured metadata and missing-context flags may leave the live runtime.

Active role logs use extension session storage. They are cleared when the managed session ends and are not stored in `localStorage`.

## Pairing contract

A tracker pair is valid only when:

1. both files were exported after the requested UTC boundary;
2. one file declares `sender` and one declares `receiver`;
3. both declare the same PMIA session ID;
4. filenames and Markdown headers are parseable;
5. no duplicate role candidate creates ambiguity.

The tracker README records the source format as `pmia-schema-2.1`.

## Current runtime identity

```json
{
  "launcher": "runtime/Final_2_Window_Extension.ahk",
  "extension_manifest": "runtime/extension/manifest.json",
  "service_worker": "runtime/extension/background.js",
  "export_schema": "2.1",
  "tracker": ".local/session-tracker"
}
```
