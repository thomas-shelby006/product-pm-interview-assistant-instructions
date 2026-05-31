# Session Tracker — Setup

The session tracker is a **separate, private** GitHub repo that stores raw interview/mock
sessions as append-only data. It is intentionally **not** part of this instruction repo.

- Suggested name: `pm-interview-session-tracker`
- Visibility: **private** (sessions can contain Resume/JD-derived and interviewer content).
- Governance: append-only data → session branches may **auto-merge**. (The instruction repo
  is the opposite: human-reviewed, never auto-merged from session reviews.)

## 1. Create the private repo

On GitHub: New repository → name `pm-interview-session-tracker` → **Private** → create empty.

## 2. Clone locally

```powershell
cd "$HOME\Documents"
git clone https://github.com/thomas-shelby006/pm-interview-session-tracker.git
```

## 3. Create the folder structure

```
pm-interview-session-tracker/
  practice/      # practice + mock sessions
  real/          # real (live-mock) sessions, kept separate
  reviews/       # optional: Review Lab outputs per session
  patterns/      # optional: recurring-pattern notes over time
  README.md
```

Quick create (PowerShell, from inside the cloned repo):

```powershell
mkdir practice, real, reviews, patterns -ErrorAction SilentlyContinue
"# PM Interview Session Tracker`n`nPrivate, append-only store of practice/real interview sessions.`nEach session folder holds win1_sender.md + win2_receiver.md + README.md." | Set-Content README.md -Encoding UTF8
git add .
git commit -m "init: tracker structure"
git push -u origin main
```

Or run the helper: `runtime/scripts/init-session-tracker-repo.ps1 -TrackerRepoPath "<path>"`.

## 4. Configure git auth (no tokens in this project)

Use your existing local git credentials:
- HTTPS: Git Credential Manager will prompt once and cache (recommended), or
- SSH: add an SSH key to GitHub and use the SSH clone URL.

**Do not** put a PAT in any file in this repo, in Tampermonkey, in the browser, or in a Project prompt. The push script (`push-session-to-tracker.ps1`) relies only on these local credentials.

## 5. Test push

```powershell
cd "$HOME\Documents\pm-interview-session-tracker"
"test" | Set-Content practice\_authtest.txt
git add . ; git commit -m "test: auth"; git push
git rm practice\_authtest.txt ; git commit -m "test: cleanup"; git push
```

If that succeeds, the tracker is ready. End a session with the companion AHK
(`runtime/Session_Tracker_End_Session.ahk`, Alt+Shift+E) or run
`runtime/scripts/push-session-to-tracker.ps1` directly.

## Privacy note

`real/` sessions may contain an actual interviewer's questions. Keep the repo private,
treat `real/` as sensitive, and only store what you are comfortable retaining. This system
is for interview **preparation/mock practice**.
