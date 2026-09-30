# Micro-PR: the grader accepts a correctly rounded pitch position

30 September 2026, from the pre-visibility audit. Approved by the product manager the same day.

## Front section

**Settled, do not relitigate.** The app writes pitch height and side to one decimal (1.78 as 1.8, `src/numberSlots.js`). The grader's per-swing check (`swingValueVerdict`, `scripts/claimVerdict.js`) demands exact equality against the two-decimal table, so it rules a correct "1.8 feet" false. That was 67 of 85 raw flags in the audit rounds, every one hand-checked as a grader mistake. Fix: for pitch height and side only, a stated value equal to the true value rounded to one decimal is TRUE. Exact matches stay TRUE; any other value stays FALSE.

**Non-goals.** No app, prompt or bench change. No change to any other metric or claim kind. No new paid round.

**Verification.** Test first, seen failing. Then replay every committed grading file through the fixed verdict code (free, `scripts/replay-grading.mjs`) and show that the only verdicts that move are FALSE to TRUE on a pitch height or side stated as the true value rounded to one decimal, and that none of them was ruled GENUINE in a committed hand-check.

**Debt.** Totals quoted from rounds graded before this fix count these flags as FALSE; their hand-checks already ruled them false positives, so no conclusion changes.

## Tasks

### Task 1: accept one-decimal rounding for pitch height and side

Files: `scripts/claimVerdict.js`, `scripts/claimVerdict.test.js`.

1. In `swingValueVerdict`, for `metric` `pitchHeight` or `pitchSide` only, rule TRUE when `statedValue` equals the table value, or equals it rounded to one decimal the way the app rounds (`Math.round(value * 10) / 10`, `src/numberSlots.js:73`). Reuse the rounding rather than retyping it if it can be exported cleanly from `src/numberSlots.js` without changing that module's behaviour; otherwise match it exactly and name the source in a comment. The TRUE reason should say the value matches when rounded, so a reader can tell the two cases apart.
2. Tests first, seen failing: 1.8 against 1.78 is TRUE; -1.4 against -1.44 is TRUE; 2 against 1.96 is TRUE; 1.7 against 1.78 is FALSE; 1.78 against 1.78 stays TRUE; a two-decimal stated value that is not the table value stays FALSE; exit velocity 88 against 87.6 (if the table can hold a decimal there) stays governed by the old exact rule, i.e. no other metric gains tolerance.

### Task 2: prove on every saved round that only false flags disappear

Files: a committed report `docs/eval-fixtures/audit-2026-09-30/replay-rounding-fix.txt` (and a small script beside it only if the replay tool cannot produce the evidence alone).

1. Run `node scripts/replay-grading.mjs --input <file>` on every committed grading file that tool accepts (find them with `find docs/eval-fixtures -name "*grading*.json" -o -name "regrade-*.json" -o -name "validate-*.json"`; say which it refuses and why).
2. For every verdict that changes, record round, cell, run, quote, metric, stated value, true value. Assert each change is FALSE to TRUE, on pitch height or side, with the stated value equal to the true value rounded to one decimal. Any other change is a failure: stop and report it.
3. Cross-check against the committed hand-checks (`HAND-CHECK*.md` in the same fixture directories): no changed claim may have been ruled GENUINE. Say how you matched claims to hand-check entries.
4. Report totals per round: FALSE before, FALSE after, changed. For the audit rounds expect 26 and 41 changes (39 to 13, 46 to 5).

## Global constraints

- `npm test` from the repo root, never `npx vitest`. Baseline: 789 tests, 28 files.
- No network, no `.env.local` reads, no paid runs.
- Plain JavaScript, `.js` extensions on relative imports in `scripts/`.
- No em dashes or en dashes in new prose or comments.
