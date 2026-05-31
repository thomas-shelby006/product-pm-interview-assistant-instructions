# Session Tracker Setup

Create a separate private GitHub repo named:

`pm-interview-session-tracker`

Suggested local path:

`C:\Users\Sundar\Documents\pm-interview-session-tracker`

## Folder structure

```text
practice/
real/
reviews/
patterns/
```

Each session contains only two raw files in the MVP:

```text
practice/<session_id>/win1_sender.md
practice/<session_id>/win2_receiver.md

real/<session_id>/win1_sender.md
real/<session_id>/win2_receiver.md
```

## Session ID

`0001_YYYY-MM-DD_company_role_round_mode`

Examples:

```text
0001_2026-06-01_pemo_pm_behavioral_mock
0001_2026-06-05_razorpay_pm_recruiter_live
```

Practice and real sessions are numbered separately.

## Setup steps

1. Create the private GitHub repo.
2. Clone it locally.
3. Run `runtime/scripts/init-session-tracker-repo.ps1` or manually create folders.
4. Push the initial structure.
5. Use `runtime/Session_Tracker_End_Session.ahk` after each session.

## Rules

- Keep repo private.
- Do not store tokens or credentials.
- Auto-merge is acceptable only for this tracker repo.
- Do not auto-update the PM Interview Helper instruction repo.
