# Eval fixture: 96 real debriefs, 8 of them known wrong

Rescued into the repo on 17 August 2026, at the start of Slice 7b. Until that
day these files lived in a temporary scratch directory that would have been
deleted without warning, taking the only ground truth this project has with it.

**Dated note, 20 August 2026: this directory was nearly lost a second way, and
by then nobody was looking.** Everything below describes `rebuild.mjs` as a
frozen copy that reconstructs exactly what these 96 debriefs saw. That was true
of the code written inside it and false of one thing it called. Sessions 2, 3
and 4 are not stored anywhere; they are worked out from session 1 by the app's
swing generator, and until this date `rebuild.mjs` reached into the live app for
that generator. All three cells here are session 2 or later.

Slice 11 rewrites that generator. The moment it had, this fixture would have
been reconstructed from swings none of these 96 debriefs was written about: not
an error message, not a gap, but a complete and entirely believable set of
numbers, with nothing on screen suggesting anything was wrong. The grading
tool's own claim to catch a real coach error rests on this fixture and no
other, so the tool would then have been checked against a fiction and passed.

It is fixed. `rebuild.mjs` now reads a frozen copy of the old generator kept in
`../frozen/`, every swing all three cells produce is written down in the record
beside that copy, and the test suite rebuilds and compares them on every run. A
drift now turns tests red by name instead of passing quietly. Found by review
after five earlier passes had signed off on the work that repaired five other
directories and missed this one.

## What these are

96 real debriefs the coach actually wrote, from Slice 7's measurement round on
14 August 2026. Every one was produced by a live Anthropic call through the
app's real prompt, not hand-written and not simulated.

    baseline-records.json    24 debriefs written with NO length budget
    budget-records.json      72 debriefs, 24 each of conditions A, B and C

Each record carries the five debrief fields as written (`coachingSummary`,
`whatThisMeans`, `tipsIntro`, `tip1`, `tip2`), plus the word counts and
citation grades the bench scored at the time, plus wall-clock elapsed time.
A record is addressed by the triple `conditionKey` / `cell` / `run`, for
example `C/contact-s4/run7`.

The three cells are `power-s2`, `contact-s4` and `open-s4`. Condition B is the
budget that shipped (45/30/12/50 words); A is looser, C is tighter.

## Why they are worth committing: they exist to grade the grader

This project's next question about the coach is an accuracy question, and
answering it means having a grader read a debrief and judge whether its
countable claims are true. A grader is itself a model, and a model marking
another model's homework is an opinion until something independent says it is
any good.

These 96 are that independent something. We know which ones lie. A candidate
grader can be pointed at them and measured: does it catch the 8 known errors,
and does it stay quiet on the rest? Without this fixture, a grader's verdicts
would have to be taken on trust, which is the exact failure the grader was
built to remove.

## The 8 known-wrong debriefs, and why each is wrong

All eight were verified by hand against the rebuilt session data, not accepted
from a regex. Each is quoted in full with its real data in `regrade-report.md`.

| # | Record | Field | What it claims | What is true |
|---|---|---|---|---|
| 1 | `baseline/open-s4/run4` | tip2 | swings 12 and 14 "at 11 and 14 degrees" | swing 12 = 14 deg, swing 14 = 11 deg. Order reversed. |
| 2 | `C/open-s4/run2` | tip2 | same pair "at 11 and 14 degrees" | same reversal |
| 3 | `C/open-s4/run8` | tip2 | same pair "both at 11 and 14 degrees" | same reversal |
| 4 | `A/power-s2/run1` | tip2 | of swings 3, 8 and 12, "two of those came in under 84 mph" | real EVs 84, 88, 78. Only one is under 84. |
| 5 | `baseline/contact-s4/run3` | tip2 | "Nine of your 15 swings ... above 20 degrees" | 7 |
| 6 | `A/contact-s4/run3` | tip2 | "Six ... above 20 degrees, swings 2, 4, 5, 6, 7, and 8" | 7. The list is also wrong: swing 7 is exactly 20, and real members 3 and 11 are missing. |
| 7 | `C/contact-s4/run7` | tip1 | "5 launch angles above 20 degrees" | 7 |
| 8 | `C/contact-s4/run8` | tip2 | "Six ... above 20 degrees" | 7 |

By condition: baseline 2, A 2, **B (shipped) 0**, C 4. Eight debriefs out of 96,
roughly one in twelve.

**The mechanism behind all eight, which is the most useful thing here.** The
coach reliably repeats a count the prompt hands it, and is unreliable at a count
it has to derive itself. "Swings under 15 degrees" is spelled out in the prompt
and was never once wrong across all 96. "Swings above 20 degrees" is not, and
every single debrief that attempted it got it wrong. The subset pattern in #4
("N of those ...") is the same shape: the list was handed over, the subset count
was not.

## The caveat that matters most for grading the grader

**The other 88 are "no verified error found," not "proven clean."** The analysis
that produced this ground truth says so about itself, at length, in the
"Checks tried and abandoned or limited" section of `regrade-report.md`. Two of
its automated checks had low recall, and one had a collision that made it
actively misleading (it read "Six of your 15 swings in Session 4 came in above
20 degrees" as the count being **4**, grabbing the digit out of "Session 4").
All four of the "above 20 degrees" findings had to be found by hand afterwards.

So this fixture supports a hard test in one direction only:

- **Recall is a real test.** A grader that misses the 8 is not good enough, and
  that verdict is trustworthy.
- **Precision is a soft test.** A grader that flags something among the other 88
  may have found a real error the hand analysis missed. Flags outside the 8 must
  be adjudicated by hand before being called false positives. Reporting a
  "false positive rate" against the 88 as though all 88 were clean would
  overstate what this fixture knows.

## Reproducing the session data each debrief saw

`rebuild.mjs` reconstructs the exact swings any given debrief was written
about, importing the app's real `generateSwings`, `computeStats` and
`carryDistance`. `regrade.mjs` runs the five checks over both record files and
writes `regrade-results.json`.

**Dated correction, 20 August 2026: `generateSwings` no longer comes from the
app, and that sentence is what the note at the top of this file is about.** It
now comes from a frozen copy kept in `../frozen/`, because the app's own version
is being rewritten and this fixture must keep reconstructing what its coaches
actually saw. `computeStats` and `carryDistance` still come from the app. The
first of those is deliberate and harmless: it summarises swings that have
already been decided, and nothing it produces is part of the record of what this
fixture made. The second is a genuine loose end, explained where it lives, at the
top of `rebuild.mjs`.

Both were re-run from this directory on 17 August 2026 after their scratch-only
absolute paths were made relative, and `regrade-results.json` came out
byte-for-byte identical to the rescued copy. So the pipeline reproduces, it is
not just an archive.

    node docs/eval-fixtures/slice7-debriefs/regrade.mjs

**Do not "update" `rebuild.mjs` to use the real session 1.** It carries a copy
of the bench's old `standInSessionOne`, and that is correct and deliberate:
these 96 debriefs were written against the stand-in, because in August 2026 the
bench could not load the hand-written swings out of `src/App.jsx`. Slice 7b
extracted those swings and pointed the live bench at the real ones, which is
right for new measurements and wrong here. Changing it would stop this fixture
reconstructing the inputs these debriefs actually saw, and would silently
invalidate all eight findings above.

`diag-12-14.mjs` is a focused diagnostic for findings 1 to 3: it counts how
often the swing 12/14 pair is stated explicitly at all, so that transposition
rate can be read against attempts rather than against all 24.

## Postscript, 17 August 2026: the grader this fixture was built for

`scripts/grade-coach-accuracy.mjs` now exists, built in Slice 7b against a
deterministic fact sheet (`scripts/factSheet.js`) so the grading model only
has to find and compare claims rather than count anything itself. Per the plan
that built it, it was supposed to be validated against this fixture's 8
known-wrong debriefs before being used for anything. That validation did not
happen: Slice 7b pivoted mid-flight to a live session-1 parse-failure bug (see
the product decisions log entry for 17 August 2026) before its `--validate`
run against these files was ever executed. Until that run happens, the
grader's verdicts should not be trusted, and this fixture's actual job,
grading the grader, is still undone.

## What was deliberately left out

The scratch directory also held Slice 7's own working files: a console log of
the baseline run, a byte-identical-prompt check, a tolerance verifier, and a
draft of the decision-log entry that was superseded by the committed one. None
of them is ground truth about the coach, so none was brought across.
