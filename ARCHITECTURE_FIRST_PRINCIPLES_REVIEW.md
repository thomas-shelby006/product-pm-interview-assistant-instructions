# Architecture — First-Principles Review (PM Interview Copilot)

Purpose: define how the PM Interview Helper should behave as a **live interview copilot**, from the user's perspective, under pressure. This is the design-of-record. Where a change is implemented in this pass, it says **[implemented]**. Where it is specified for a tested follow-up, it says **[spec only]**.

The real goal is not cleaner files. It is: **fast, speakable, truthful, role-tuned answers, with strong follow-up handling and reliable session context** — without drifting into frontend/SWE framing and without inventing claims.

---

## 1. Executive recommendation

Treat the system as **four layers plus one safety floor**, not one big prompt:

```
[ SAFETY FLOOR ]  Truth constraints — banned/safe claims. Overrides everything, always.
Layer 1  PERMANENT BRAIN     ChatGPT Project: canonical PM profile, story bank, metrics,
                             router, delivery rules, role profiles, opening anchor. Stable.
Layer 2  SESSION CONTEXT     Per interview: role-specific Resume + JD + optional metadata.
                             Re-weights EMPHASIS. Never adds facts or claims.
Layer 3  LIVE TRANSCRIPT      Classify each chunk (fresh / follow-up / pushback / logistics /
                             filler / interrupt) and keep a tiny rolling context tail.
Layer 4  SPOKEN CONTRACT      Front-loaded, first sentence = complete answer, length-capped,
                             follow-ups shorter, no route labels.
            ↓ POST-SESSION LEARNING LOOP (Alt+E export → review prompt → source-file edits)
```

The highest-leverage change is conceptual: **the AHK boot prompt must stop duplicating the Project's behavior.** The Project (Layer 1) holds *behavior*; the boot prompt (Layer 2) should hold *session data + a short operating reminder that points back at the Project*. Duplication is the root cause of every drift bug found so far.

Three confirmed product decisions:
- **Do not bake one full resume as the only truth.** Bake the canonical PM profile + story bank; paste the role-specific resume per session.
- **Latest-actionable-question-wins** with a short prior-context tail (not queue-everything).
- **Add lightweight optional session fields** to the GUI, but keep Resume + JD as the two primary boxes.

---

## 2. Current architecture diagnosis

What exists today (verified against the code):

- **Permanent brain:** Project custom instructions (~7.3k chars) + uploaded source files.
- **Session context:** AHK GUI collects Resume + JD; `BuildBootPrompt()` embeds positioning + roles + company contexts + live rules + Resume/JD, sends to Win1 (`Ctrl+Shift+F5`); Win1 forwards to Win2 via `vb_payload`.
- **Live state:** `bridge.user.js` polls the Win1 voice transcript, filters filler/partial, buffers, forwards the latest actionable question to Win2; Win2 injects + submits; the bridge captures the answer, counts words, guesses route/company, logs to `pm_session_log`; export writes JSON + MD.

Structural problems:

1. **Two brains.** Boot prompt re-states behavior already in the Project → drift, larger clipboard payload, unclear source of truth.
2. **No explicit precedence rule.** Nothing answers "if the resume conflicts with the story bank or truth constraints, who wins?" → unsafe by omission.
3. **Session metadata is half-built and unused.** The bridge schema already has `target_role`, `company`, `interview_round`, `mode`, `resume_id`, `jd_id`, and `extractSessionMetadata()` already parses them — but nothing populates them.
4. **Single-path context delivery.** Boot goes Win1 → forward → Win2; the `Alt+Esc` direct-to-Win2 path is the manual fallback (now fails loudly).
5. **No interrupt model.** The bridge forwards the latest actionable question but has no concept of "a new question arrived while Win2 is still generating."

---

## 3. Proposed improved architecture (the four layers)

**Layer 1 — Permanent brain (Project).** Stable, versioned, loaded every turn. Holds the canonical PM profile, story bank, metrics library, answer router, delivery guide, role profiles, opening anchor, and the spoken-answer contract. This is the only place full behavior lives.

**Layer 2 — Session context (boot, per interview).** Role-specific Resume + JD + optional metadata (company / role / round / emphasis / avoid / answer-mode). Re-weights emphasis and vocabulary. **Never introduces a new fact or a new claim.** Should be thin: data + a 3–5 line operating reminder, not a second copy of Layer 1.

**Layer 3 — Live transcript state (bridge, ephemeral).** Classify each chunk; keep a tiny rolling tail (last question + 1-line gist of last answer). Latest-actionable-question-wins.

**Layer 4 — Spoken-answer contract.** Front-loaded; **first sentence must work as a complete answer**; length-capped; follow-ups shorter; no route labels or framework names unless asked.

**First-principles point on latency:** front-loading is the real latency weapon, not the follow-up protocol. Under an interrupt, the tail may never be spoken — so optimize for "usable in sentence one." The follow-up/interrupt protocol is the backstop.

---

## 4. Session setup design

Keep Resume + JD as the two primary boxes. Add **one optional secondary block** (dropdowns where possible — no typing under time pressure). Everything optional; if blank, infer from the JD.

```
Resume / Profile for this role     [large text box]   ← primary
Job Description                    [large text box]   ← primary

▾ Optional session setup (auto-inferred from JD if left blank)
  Target company:    [____]
  Target role:       [____]
  Interview round:   [ recruiter | HM | product sense | metrics | behavioral | technical PM | PO ]
  Emphasis:          [ fintech | AI | analytics | enterprise | ops/internal-tools | PO ]
  Avoid mentioning:  [____]
  Answer mode:       [ concise | normal | deep ]
```

**"Deep" ≠ long.** In a spoken interview, deep = "top of the existing length band + explicitly offer to expand," still under the 180-word hard cap. `concise` = bottom of band / hard short caps; `normal` = current policy.

These fields flow into the boot prompt **and** the bridge's existing session-log slots. The bridge already parses `Target role:`, `Company:`, `Interview round:`, `Mode:`; this pass extends it to also parse `Emphasis:` and `Avoid mentioning:` **[implemented]**. The GUI controls that produce them are **[spec only]** (see §9) because the launcher is safety-critical and AHK cannot be tested in this environment.

---

## 5. Fast-follow-up protocol (live)

Principle: **stale answers are dangerous.** Latest-actionable-question-wins, preserving short prior context.

| Situation | Action |
|---|---|
| Win2 idle, fresh question | Forward latest actionable question + short context tail. |
| Win2 idle, clearly a follow-up | Forward with the **follow-up wrapper**: do not restart the framework; be shorter than the previous answer. |
| Two questions in one chunk | Keep the **latest** as primary; include the earlier as context; let the model decide multi-part vs interrupt. |
| **New actionable question while Win2 is generating** | Treat as **interrupt**: supersede the in-flight answer (stop generation if feasible, else mark stale), forward the new latest question with "this supersedes the previous; answer only the latest." |
| Filler / partial / logistics | Existing handling (partial-transcript detection was repaired in the reliability pass). |

Wrapper the bridge sends:
```
Prior context (reference only): [last question + 1-line gist of last answer]
Latest interviewer question: [latest actionable question]
Instruction: Answer only the latest question. If it connects to the prior one, treat it as a follow-up and be shorter. Do not restart the framework.
```

Implementation note: "idle + forward" and the follow-up wrapper are easy and largely present. **Reliably stopping an in-flight generation** in ChatGPT's DOM is the fiddly part, so it is staged as a later runtime phase **[spec only]**.

---

## 6. Context precedence rules

Three different questions need three different answers. This is the part the system was missing.

| Dimension | Precedence (highest → lowest) | Why |
|---|---|---|
| **Claims / safety** (metrics, ownership, ML, revenue, team size, compliance) | **Truth constraints ONLY** | A role-tuned resume must never authorize a banned claim. |
| **Facts** (roles, dates, what he did) | Project story bank (canonical) > Resume > JD | Story bank is the verified record; resume conflicts on a *fact* get flagged, not silently chosen. |
| **Emphasis / ordering** (which company leads, framing, vocabulary) | Live user correction > Emphasis field > Resume > JD > Project defaults | Emphasis is exactly what *should* vary by role. |
| **Target framing** (what the role wants) | JD — framing only, never converted into work history | Prevents inventing experience to match the JD. |

**One-line principle:** *Resume and JD change what I emphasize. They never change what's true or what I'm allowed to claim.*

**Conflict behavior:** if the assistant detects a resume/JD claim that the truth constraints ban, or a resume fact that contradicts the story bank, it surfaces **one short flag at the start of the session** and then proceeds safely on confirmed claims only. It must not silently comply and must not silently ignore.

**Live correction:** if Sundar types a correction mid-session (e.g., "I didn't own pricing"), that correction wins for the rest of the session over emphasis defaults — but still cannot override the truth-constraint floor.

---

## 7. Communication map + where context is lost/duplicated

```
AHK GUI ──(boot prompt + Resume/JD + metadata)──▶ Win1
Win1 ──(voice transcript polling)──▶ bridge ──(vb_payload via localStorage)──▶ Win2
Win2 ──(answer generation)──▶ bridge answer capture ──▶ pm_session_log
Alt+E export (JSON+MD) ──▶ post-session review prompt ──▶ source-file improvements
Project source files + custom instructions ──▶ loaded into every Win2 turn
```

Loss / duplication points and the fix:
- **Duplication (boot vs Project):** thin the boot prompt; Project owns behavior. *(Direction set here; boot-source updated; full thinning is a runtime follow-up.)*
- **Single delivery path (boot → Win1 → Win2):** keep the `Alt+Esc` direct-to-Win2 fallback; both clipboard paths now fail loudly.
- **Answer capture is best-effort:** affects export/review only, not live answers. Acceptable.
- **Metadata double-writer risk:** keep ONE writer — GUI → boot text → bridge parse. Do not also let the assistant invent metadata.

---

## 8. Failure modes and mitigations

| Failure mode | Simplest mitigation |
|---|---|
| Forgot to paste resume | Pre-launch warning exists → strengthen to require explicit "proceed"; assistant falls back to canonical profile; show persistent `NO RESUME` state. |
| Pasted wrong / huge / noisy JD | GUI length hint; assistant treats JD as **framing only**, never work history. |
| Target role unclear | Emphasis/round dropdowns; else infer from JD; never block the launch. |
| Role mismatch (resume vs JD) | Emphasis field decides lead story; assistant notes mismatch once, defaults JD-aligned, asks nothing live. |
| Answer too long | `concise` mode + existing word-count indicator; front-load so the usable part lands first. |
| Wrong company story chosen | Emphasis field biases selection; front-load lets Sundar redirect in ~2 seconds. |
| Unconfirmed story used | Truth floor + "never invent a story; if none fits, give a short principled answer from the profile"; drafts kept out of uploaded files. |
| Runtime silently fails | `BOOT/SEND/INJECT/PAYLOAD FAIL` indicators added in the reliability pass. |
| Stale Project source files | Bridge stamps `prompt_version` / `project_files_version`; surface version in the boot confirmation. |
| Follow-up restarts framework | Follow-up wrapper forbids restart and demands shorter. |
| General story when JD-specific needed | Emphasis + JD vocabulary bias; precedence: emphasis > JD > defaults. |
| Overfits to JD / invents experience | Precedence rule: JD is framing only; truth floor blocks invented work history. |
| Two questions at once / interrupt | Fast-follow-up protocol (§5). |

---

## 9. Runtime implementation spec (for the tested AHK follow-up) — [spec only]

This is deliberately **not** applied in this pass because the launcher is safety-critical and AHK cannot be linted/run here. Apply and mock-test on a Windows machine.

### 9.1 New GUI globals (near the other `global g_session*` declarations)
```ahk
global g_sessionCompany   := ""
global g_sessionRole      := ""
global g_sessionRound     := ""
global g_sessionEmphasis  := ""
global g_sessionAvoid     := ""
global g_sessionMode      := "normal"
global g_companyEdit := 0, g_roleEdit := 0, g_roundDdl := 0
global g_emphasisDdl := 0, g_avoidEdit := 0, g_modeDdl := 0
```

### 9.2 GUI controls (inside `ShowSessionLaunchGui`, after the JD Edit, before the buttons)
```ahk
g_launchGui.Add("Text", "xm y+12", "Optional session setup (leave blank to infer from JD)")

g_launchGui.Add("Text", "xm y+8 w110", "Target company")
g_companyEdit := g_launchGui.Add("Edit", "x+6 yp-3 w280", g_sessionCompany)
g_launchGui.Add("Text", "x+14 yp+3 w90", "Target role")
g_roleEdit := g_launchGui.Add("Edit", "x+6 yp-3 w250", g_sessionRole)

g_launchGui.Add("Text", "xm y+10 w110", "Interview round")
g_roundDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w200",
    ["(infer)","recruiter","hiring manager","product sense","metrics","behavioral","technical PM","product owner"])
g_roundDdl.Choose(1)
g_launchGui.Add("Text", "x+14 yp+3 w70", "Emphasis")
g_emphasisDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w200",
    ["(infer)","fintech","AI","analytics","enterprise","ops / internal tools","product owner"])
g_emphasisDdl.Choose(1)

g_launchGui.Add("Text", "xm y+10 w110", "Avoid mentioning")
g_avoidEdit := g_launchGui.Add("Edit", "x+6 yp-3 w280", g_sessionAvoid)
g_launchGui.Add("Text", "x+14 yp+3 w90", "Answer mode")
g_modeDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w160", ["concise","normal","deep"])
g_modeDdl.Choose(2)
```
Then change the final `g_launchGui.Show("w800 h585")` to a taller window, e.g. `Show("w800 h760")`, and verify the buttons remain visible.

### 9.3 Read values (inside `StartLaunchFromGui`, alongside the existing reads)
```ahk
if IsObject(g_companyEdit)  := g_companyEdit  ? g_companyEdit.Value : ""   ; (read into g_sessionCompany)
; explicit form:
g_sessionCompany  := IsObject(g_companyEdit)  ? g_companyEdit.Value  : ""
g_sessionRole     := IsObject(g_roleEdit)     ? g_roleEdit.Value     : ""
g_sessionRound    := (IsObject(g_roundDdl)    && g_roundDdl.Text != "(infer)")    ? g_roundDdl.Text    : ""
g_sessionEmphasis := (IsObject(g_emphasisDdl) && g_emphasisDdl.Text != "(infer)") ? g_emphasisDdl.Text : ""
g_sessionAvoid    := IsObject(g_avoidEdit)    ? g_avoidEdit.Value    : ""
g_sessionMode     := IsObject(g_modeDdl)      ? g_modeDdl.Text       : "normal"
```

### 9.4 Session-metadata block in the boot prompt (in `BuildSessionContextBlock` / where Resume/JD are assembled)
Emit only non-empty fields, using the exact labels the bridge parses:
```ahk
meta := ""
if (Trim(g_sessionCompany)  != "") || (Trim(g_sessionRole) != "") || (Trim(g_sessionRound) != "")
    || (Trim(g_sessionEmphasis) != "") || (Trim(g_sessionAvoid) != "") || (Trim(g_sessionMode) != "") {
    meta := "Session context:`n"
    if (Trim(g_sessionCompany)  != "")  meta .= "Company: "          . g_sessionCompany  . "`n"
    if (Trim(g_sessionRole)     != "")  meta .= "Target role: "      . g_sessionRole     . "`n"
    if (Trim(g_sessionRound)    != "")  meta .= "Interview round: "  . g_sessionRound    . "`n"
    if (Trim(g_sessionEmphasis) != "")  meta .= "Emphasis: "         . g_sessionEmphasis . "`n"
    if (Trim(g_sessionAvoid)    != "")  meta .= "Avoid mentioning: " . g_sessionAvoid    . "`n"
    if (Trim(g_sessionMode)     != "")  meta .= "Answer mode: "      . g_sessionMode     . "`n"
    meta .= "`n"
}
; prepend `meta` to the existing Resume/JD context block
```
The bridge already converts a block beginning with `Session context:` into session-log metadata, and this pass extends it to also capture `Emphasis:` and `Avoid mentioning:`.

### 9.5 Interrupt / supersede (bridge, later runtime phase)
On a new actionable `vb_payload` while `isGenerating()` is true: click the ChatGPT stop control (or send `Escape`), wait for generation to end, then inject the new question with the follow-up wrapper. Guard with a short debounce so rapid partial transcripts do not thrash. Mock-test interrupts explicitly before relying on it.

---

## 10. Implementation phases & what not to change

**Phases**
- **Phase 0 (done):** repo cleanup + reliability/consistency fixes.
- **Phase 1 (this PR):** layer model, precedence rules, session-setup model, fast-follow-up protocol, Resume/JD/metadata handling, failure mitigations — all in the Project source files + a small safe bridge parser extension. Fully mock-testable in ChatGPT.
- **Phase 2 (tested AHK follow-up):** GUI fields + boot session-metadata block (§9.1–9.4).
- **Phase 3 (tested bridge follow-up):** interrupt/supersede (§9.5) + visible session-state indicators (`NO RESUME`, version, mode).
- Each phase ends with the three mocks from the Opening & Mock Playbook.

**What not to change**
- Two-window architecture. **No Win3.**
- `localStorage` transport.
- Truth-constraint strength — only *add* precedence clarity.
- The front-load + length policy.
- Compact custom instructions (< 8,000 chars).
- No backend, no heavy tooling, no extra extensions.
- No unconfirmed stories in uploaded Project files.
- Do not over-build the GUI — one optional screen, dropdowns, infer from JD.
