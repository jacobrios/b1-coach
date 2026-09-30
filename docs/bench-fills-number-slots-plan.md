# Micro-PR: the bench grades what a visitor reads

30 September 2026, from the pre-visibility audit. Approved by the product manager the same day.

## Front section

**Settled, do not relitigate.** Since Slice 15 the coach writes placeholders such as `{{s1.sw5.ev}}` and the app fills them (`fillDebriefNumbers`, `src/coachApi.js:696`). The bench never did, so it grades placeholders the grader cannot rule on, which would flatter any round. The bench must fill exactly as the app does, and keep the raw reply so slot adoption can be counted from the same calls.

**Non-goals.** No grader change (the audit keeps the instrument identical to Slice 11; the pitch-rounding false positive is named in the hand-check instead). No prompt change. No live spend in this PR. The audit round itself lands in the audit PR.

**Verification.** Tests first, seen failing: the fill-for-grading seam and the adoption counter. The bench's `--dry-run` must exercise the fill step via a canned placeholder and still exit 0. Not tested: the live network path (unchanged).

**Debt.** Committed bench records before this PR hold unfilled text for any round after Slice 15; none exist, so nothing is stranded.

## Tasks

### Task 1: the bench fills number slots before grading, and keeps the raw reply

Files: `scripts/bench-coach-brevity.mjs`, a new tested module `scripts/benchFill.js`, `scripts/benchFill.test.js`.

1. New module `scripts/benchFill.js` exporting `fillForGrading(parsed, sessions)` returning `{ filled, rawFields }`:
   - `filled` is `fillDebriefNumbers(parsed, sessions)` from `src/numberSlots.js`, called exactly as the app calls it (sessions already limited to the viewed session; the bench's `buildSessions({ upTo: cell.session })` does that).
   - `rawFields` is the five text fields of `parsed` as the coach wrote them: `coachingSummary`, `whatThisMeans`, `tipsIntro`, `tip1`, `tip2`. Match whatever shape `grade()` already uses for `fields` (check `grade()` in the bench; tips may arrive as `nextSessionTips`).
   - If `fillDebriefNumbers` throws, let it throw; the bench's existing catch turns it into a failure record via `buildFailureRecord`.
   - Confirm the bench's session objects have the shape `numberSlots.js` reads (`sessionNumber`, `swings`); adapt in `fillForGrading` only if they do not, and say so in the report.
2. Tests, written first and seen failing: a placeholder is replaced by the right number (use a real session built the way the bench builds it, or session 1 from `src/sessionOneSwings.js`); pitch height rounds to one decimal as in the app; `rawFields` keeps the placeholder verbatim; a slot naming a nonexistent swing drops its sentence (app behaviour) and an emptied field throws.
3. In the bench main loop, call `fillForGrading` after `callCoach`, pass `filled` to `grade()`, and store `rawFields` on the record beside `fields`.
4. The dry run's canned reply gains at least one placeholder so `--dry-run` exercises the fill. It must still print "Every path exercised" and exit 0.
5. Keep the bench's existing comment density and style. Update the file-count/test-count comment only if it states a number this change makes false.

### Task 2: slot adoption is a tested function, not a probe-only calculation

Files: `scripts/probe-number-slots.mjs`, new `scripts/slotAdoption.js`, `scripts/slotAdoption.test.js`.

1. Move the probe's adoption calculation (resolvable placeholders divided by resolvable placeholders plus bare recitals, where a bare recital is a typed number equal to one of the six values of a swing named in the same sentence) into `scripts/slotAdoption.js` unchanged in behaviour, exported. The probe imports it. Do not change the probe's wording, output path, or anything else.
2. Tests first: counts on hand-written text with a known number of placeholders and bare recitals; the probe's committed records at `docs/eval-fixtures/slice15-number-slots/probe/probe-records.json` still produce 89% (or whatever the probe printed; read `docs/product-decisions-log.md` Slice 15 entry for the exact figure) when fed through the extracted function. That second test is the proof the move changed nothing.
3. The function must accept a bench record's `rawFields` plus its sessions, so the audit can count adoption over a bench round. If the probe's input shape differs, add a thin adapter rather than changing the counting.

## Global constraints

- Run `npm test` from the worktree root, never `npx vitest` (see CLAUDE.md "Do not switch this hook"). Baseline: 751 tests, 26 files.
- No network calls, no `.env.local` reads, no live bench or probe runs.
- Plain JavaScript, `.js` extensions on relative imports in `scripts/`, matching neighbouring modules.
- No em dashes or en dashes in new prose or comments.
