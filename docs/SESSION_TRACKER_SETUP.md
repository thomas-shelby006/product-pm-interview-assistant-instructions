# PMIA 0.11.0 Session Tracker Setup

The PMIA Review Studio stores private session evidence under the canonical repository without committing it to the application source.

## Default location

```text
C:\Users\Sundar\Documents\product-pm-interview-assistant-instructions\.local\session-tracker
```

The application repository ignores `.local/`. The tracker remains its own private Git repository so practice and real interview evidence can be versioned separately from application code.

## Structure

```text
.local\session-tracker\
├── practice\
├── real\
├── reviews\
├── patterns\
└── README.md
```

## Review Studio workflow

1. Run the main PMIA launcher and complete a managed sender/receiver session.
2. Press `Alt+Shift+E` to open **PM Session Tracker — Review Studio**.
3. Review Studio detects one complete READY sender/receiver pair from PMIA lifecycle titles.
4. Select `practice` or `real`, add company, role, round, and mode, then choose **Export and Pair**.
5. The resolver accepts one fresh sender Markdown export and one fresh receiver Markdown export with the same session ID.
6. Use **Dry Run** before the first real tracker write after changing scripts or paths.
7. A real push writes the paired files into the private tracker and can open the Review Lab with the review prompt copied.

## Initialize an empty tracker

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  runtime\scripts\init-session-tracker-repo.ps1 `
  -TrackerRepoPath ".local\session-tracker"
```

## Maintenance boundaries

Application code changes belong in the main PMIA repository. Session evidence, reviews, and recurring patterns belong in the tracker. Do not commit Resume, job description, transcript, answer, or private review content to the application repository.
