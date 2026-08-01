# PMIA Cycles 46–70 Verification

Date: 2026-08-02
Branch: `improvement/pmia-0.7.0`
Verified HEAD: `6682f03`
Candidate: PMIA `0.7.0`

## Result

Cycles 46–70 passed the complete automated gate and the repository-owned isolated Edge smoke. The test used only fixed synthetic questions and a disposable browser profile. Normal Edge remained unchanged.

## Automated gate

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

Result:

- 719 tests passed; 0 failed, skipped, or cancelled.
- 244 JavaScript files checked.
- 18 required runtime surfaces checked.
- 121 reachable production modules checked.
- Manifest, import reachability, forbidden-pattern, packaging, and runtime validation passed.
- Both active AutoHotkey programs validated.
- Exit code: 0.
- Log: `C:\Users\Sundar\Documents\ChatGPT Work\Temp\pmia_cycles_46_70_final_head_gate.log`.

## Isolated browser smoke

Command owner: `runtime/scripts/run-isolated-release-smoke.ps1`

Evidence directory copied into this repository:

- `docs/evidence/2026-08-02-pmia-cycles-46-70/isolated-release-evidence.json`
- `docs/evidence/2026-08-02-pmia-cycles-46-70/pilot-desktop.png`
- `docs/evidence/2026-08-02-pmia-cycles-46-70/pilot-320px.png`

Observed result:

- Exact extension: `PM Interview Dual-Provider Runtime` version `0.7.0`.
- Isolated extension ID: `nehkofdhampeehnilphkckhflbmbjohn`.
- Window 1 and Window 2 were both hidden and composer-ready.
- Active no-content self-test passed: sender direct RTT 4 ms, receiver direct RTT 3 ms, storage RTT 4 ms, dashboard connected.
- Synthetic Q1 was rendered and proven as one batch.
- Synthetic Q2 and Q3 accumulated while Q1 answer observation was active, then rendered and proved as one exact two-member batch.
- All three ledger entries ended in `proven` state.
- Sender outbox count ended at 0.
- Sequence gap state was clear.
- Anonymous answer text was unavailable; this did not weaken rendered delivery proof.

## No-content transport drill

All seven checks passed in 11 ms without reading or mutating prompt, answer, clipboard, or delivery content:

1. Protocol handshake and capability negotiation.
2. Direct role-port probes.
3. One-time message fallback probes.
4. Current epoch/reconnect evidence.
5. Exact selective NACK range `[[2,2]]`.
6. Alarm rehydration audit.
7. Runtime invariant audit with 0 blocked findings.

## Pilot UI evidence

- Desktop viewport: 1200 × 900; scroll width 1185; no horizontal overflow.
- 320 CSS-pixel viewport: 320 × 900; scroll width 305; no horizontal overflow.
- Forecast, recovery budget, transport drill, trace search, trace results, and trace detail surfaces were present in both views.
- Three trace results were available.
- Forecast state was `clear`; recovery budget state was `available`.

## Isolation and cleanup

- Browser Evidence Capture preflight passed at version 1.7.8 with control connected.
- The same nine normal Edge tab handles, tab IDs, URLs, titles, and semantic generations were present before and after the smoke.
- No normal tab was inspected, focused, navigated, or modified.
- The disposable Edge process tree closed completely.
- The temporary profile was removed.
- `normalProfileTouched` remained false.

## Defects closed during verification

- Legacy composer adapters now retain manual-draft conflict detection without a DOM composer handle.
- Registration heartbeat, same-tab replacement, and owner-generation semantics were reconciled.
- Provider budgeting no longer overrides a stricter configured planner budget.
- Transactional store and direct-port test doubles now model multi-key storage and mandatory handshakes correctly.
- Attempt lease and correlation-journal configuration no longer apply hidden minimums.
- Smoke cleanup verifies the complete owned Edge process tree.
- Final smoke evidence cannot report success unless delivery proof, transport drill, Pilot reflow, process cleanup, and profile cleanup all pass.
- Smoke failures now retain the final readiness sample and bounded Send-control diagnostics.

## Repository boundary

No push, merge, tag, canonical checkout replacement, or unrelated browser change was performed. The condensed technical HTML remains deliberately deferred until the later requested mechanics phase is complete.
