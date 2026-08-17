# Regrading 96 debriefs for counting and swing-attribution errors

Question: did the length budget (condition B, shipped) make the coach's
counting/attribution arithmetic worse than the unbudgeted baseline?

Answer up front: **no evidence found that it did.** Among 96 real debriefs
(24 baseline, 24 each of A/B/C), B has zero verified hard findings, the
fewest of any condition. C (the tightest budget) has the most. The counts
involved are small enough (0 to 4 out of 24 per condition) that this should
be read as "no signal that budgeting hurt accuracy," not as proof B is more
accurate than baseline. See the honesty section near the end.

The exact false claim quoted in the task ("six under 15 degrees... four of
those under 80 mph") could not be reproduced from this dataset, because it
was on session 1, which is hand-written in `src/App.jsx` and not something
this bench's data covers (the bench uses a stand-in for session 1 whose
averages match but whose individual swings differ). Everything below is
about the same class of error, found independently in the 96 debriefs that
were collected, which do cover real generated session data.

## Methodology note (read before the numbers)

The bench script (`scripts/bench-coach-brevity.mjs`) is not structured to be
imported: it calls `main()` unconditionally at module load, which would try
to make a live API call. So `rebuild.mjs` in this scratchpad directory is a
verbatim copy of its `mulberry32`, `standInSessionOne`, `buildSessions` and
`CELLS`, not a reimplementation, importing the same real `src/` modules the
bench does (`generateSwings`, `computeStats`, `carryDistance`).

**Sanity check, done before trusting anything else:** rebuilt `power-s2`,
got 15 swings per session, plausible EV/LA ranges, and cross-checked against
a real baseline debrief's own claims ("top swings hit 91 and 92 mph... 4
balls over 305 feet"). The rebuild's session 2 top-3 EVs were exactly
92/92/91 and its count of balls >=305ft was exactly 4. The rebuild matches
what the debriefs are talking about.

**A regex bug was found and fixed mid-analysis, and it matters for
credibility:** the first version of the swing-list extractor could not
parse Oxford-comma lists ("2, 4, and 5" was truncated to "2, 4"), which is
exactly the shape of the motivating example's own list ("1, 2, 4, 7, 9, and
12"). Fixed by testing the extractor directly against that sentence before
trusting any output. A second bug (a bare threshold like "below 15 degrees"
being misread as an asserted actual value) was also found and fixed the
same way, using a real example from the data (`B/power-s2/run7`) that
turned out to be a false alarm once inspected. Both fixes are described
inline in `regrade.mjs`. Every "hard" finding below was additionally
verified by hand against the rebuilt session data, not just trusted from
the regex output.

`viewingSessionSwings(cell)` returns the last session in that cell (session
2 for `power-s2`, session 4 for `contact-s4`/`open-s4`). "Swing N" in the
coach's text is assumed to mean swing N of the session currently being
debriefed, since the prompt's per-swing numbering restarts at 1 for every
session and every quoted example in the data reads that way ("this round",
"this session"). No case was found where a debrief clearly meant an earlier
session's swing N.

## Automated checks 1 to 4, hit rate per condition (n=24 each)

| Check | baseline | A | B | C |
|---|---|---|---|---|
| 1. Impossible swing number (outside 1 to 15) | 0/24 | 0/24 | 0/24 | 0/24 |
| 2. Stated total isn't 15 | 0/24 | 0/24 | 0/24 | 0/24 |
| 3. Count vs. enumerated list length mismatch | 0/24 | 0/24 | 0/24 | 1/24* |
| 4. Misattributed per-swing value | 1/24 | 0/24 | 0/24 | 2/24 |

\* The one check-3 hit (`C/contact-s4/run8`) is a **false positive for that
specific reason**: the list it flagged was introduced with "including,"
which signals a partial example, not an exhaustive enumeration, so a
length mismatch there isn't a counting error. It does, however, sit inside
a sentence with a *different*, genuine error, described below.

Checks 1 and 2 are completely clean across all 96 debriefs: the coach never
invents a swing number outside 1 to 15, and never states a total other than
15. Those are non-findings, not "not tested."

## Hard findings (checks 1 to 4), quoted, with real data

### Finding A: swing 12/14 launch-angle order transposed

Three debriefs state the launch angles for swings 12 and 14 in the wrong
order. Real data for `open-s4` (session 4): swing 12 = 14 degrees, swing 14
= 11 degrees.

- **`baseline / open-s4 / run 4` (tip2):** "Swings 12 and 14 were your two
  flat ones this round, both sitting at **11 and 14 degrees**..." Stated
  order is swing 12 to 11 degrees, swing 14 to 14 degrees. Real: swing 12
  to 14 degrees, swing 14 to 11 degrees. Reversed.
- **`C / open-s4 / run 2` (tip2):** "swings 12 and 14 both came in at **11
  and 14 degrees**..." Same reversal.
- **`C / open-s4 / run 8` (tip2):** "Swings 12 and 14 were your only flat
  swings, both at **11 and 14 degrees**..." Same reversal.

For contrast, correctly-ordered examples exist in the same cell across
every condition, e.g. `baseline/open-s4/run5`: "both coming in at 14 and 11
degrees" (correct), and `C/open-s4/run5`: "at 14 and 11 launch angle,
degree symbol used" (correct). So the model gets this right most of the
time and flips it occasionally, in both the unbudgeted and budgeted
conditions.

**Rate against attempts, not against all 24:** not every `open-s4` debrief
states explicit values for swings 12/14 (many just say "both under 15
degrees" with no numbers). Counting only debriefs that state an explicit
two-number pair for swings 12 and 14: baseline 1 wrong of 6 resolvable
attempts, A 0 of 2, B 0 of 3, C 2 of 5 (a 3rd correct case in C uses the
degree symbol and was caught by hand, not by the automated regex). These
denominators are too small to support a rate comparison; see the honesty
section.

### Finding B: "N of those under X" subset miscount

- **`A / power-s2 / run 1` (tip2):** "Swings 3, 8, and 12 were on pitches
  well outside the zone, and **two of those came in under 84 mph**..."
  Real EVs: swing 3 = 84 mph (not under 84), swing 8 = 88 mph (not under),
  swing 12 = 78 mph (under). Only **one** of the three is under 84 mph, not
  two.

This is the same shape as the motivating example: a whole-session number
handed directly by the prompt gets reused correctly (the "3, 8, 12" list is
literally the "pitches in strike zone" complement), but a *derived*
subset-count computed by the model itself ("two of those... under 84 mph")
is wrong.

## The "swings above 20 degrees" pattern (found by hand, not by check 3/4)

Grepping all 96 debriefs for "of your 15 swings ... above 20 degrees" and
its close variants turned up a striking result: **every debrief that makes
this specific whole-session count claim gets it wrong**, and it never
appears in condition B at all.

Real count of swings with launch angle above 20 degrees in `contact-s4`
session 4 is **7** (swings 2, 3, 4, 5, 6, 8, 11, verified from the rebuilt
session). This number is *not* handed to the model directly in the prompt
(unlike the "under 15 degrees" count, which is spelled out explicitly); the
model has to derive it itself by scanning the individual-swing listing.

- **`baseline / contact-s4 / run 3` (tip2):** "**Nine** of your 15 swings
  in Session 4 came in above 20 degrees..." Real: 7. Wrong.
- **`A / contact-s4 / run 3` (tip2):** "**Six** of your 15 swings in
  Session 4 came in above 20 degrees, swings 2, 4, 5, 6, 7, and 8..." Real
  count: 7. Also wrong: the enumerated list itself is wrong (swing 7's real
  angle is exactly 20 degrees, not above it; the list omits real members 3
  and 11).
- **`C / contact-s4 / run 7` (tip1):** "You had **5** launch angles above
  20 degrees in Session 4..." Real: 7. Wrong.
- **`C / contact-s4 / run 8` (tip2):** "**Six** of your 15 swings in
  Session 4 came in above 20 degrees, including swings 2, 5, and 6 at 30,
  31, and 28 degrees." Real: 7. The "including" sub-list (2, 5, 6) happens
  to be a genuinely correct subset of the real 7, that part isn't wrong,
  but the "six" total is.
- **`B`: zero attempts.** No `B` debrief in this dataset makes this
  specific claim at all.

By contrast, the "under 15 degrees" count, which the prompt hands the model
directly as a solved number plus an explicit swing list, was checked
separately across all 96 debriefs and **never found wrong** once false
positives were removed (see "abandoned/adjusted checks" below). That
contrast is the clearest mechanistic story this analysis found: **the coach
reliably repeats counts it is handed, and is unreliable at counts it has to
derive itself** (a threshold not given in the prompt, or a subset defined
mid-sentence by "of those"). The motivating example fits this story
exactly: the six-under-15 half was handed to the model and stated
correctly, the four-under-80-among-those half was not handed to it and was
wrong.

## Distinct debriefs with at least one verified hard finding

Combining Findings A, B, and the "above 20 degrees" pattern (all manually
verified against real session data), counting each affected (cell, run)
pair once even if it has more than one issue:

| Condition | Debriefs with >=1 verified error | of 24 |
|---|---|---|
| baseline | 2 (`open-s4/run4`, `contact-s4/run3`) | 8.3% |
| A | 2 (`power-s2/run1`, `contact-s4/run3`) | 8.3% |
| **B (shipped)** | **0** | **0%** |
| C | 4 (`open-s4/run2`, `open-s4/run8`, `contact-s4/run7`, `contact-s4/run8`) | 16.7% |

## Check 5 candidates: threshold counts, NOT verdicts

The "of those" subset pattern (check 5's core case) turned out to be rare
in this dataset and hard to extract reliably. Only one instance was cleanly
resolved by the automated regex (the `A/power-s2/run1` case reported as a
hard finding above, once resolved by hand). The regex has real limits, see
below.

The broader "whole-session threshold" pattern produced 61 raw candidate
matches. Of those, 17 disagreed between the stated count and a naive
whole-session recount. **Most of these 17 are false positives from a
different cause, not new findings**: they refer to *Session 1's* count
being compared against the current session ("went from 5 swings below 15
degrees, in Session 1, to just 1 now"), which the automated check couldn't
distinguish from a same-session claim. Verified by hand against the
rebuilt session 1 data: session 1's real under-15-degree count is 5 for
both cells that use it, and session 1's real under-175ft count is 3 for
`contact-s4`, both match what the coach said. These are correct claims,
not errors, and are listed here only so nobody mistakes the raw 17-count
for 17 real findings.

Stripped of that false-positive class, the *only* genuine disagreements
left in the whole-session threshold data are the four "above 20 degrees"
instances already reported above as hard findings (found by hand, because
the automated regex mis-extracted them, see next section).

## Checks tried and abandoned or limited

- **The whole-session threshold regex collides with "Session N."** A
  sentence like "Six of your 15 swings in Session 4 came in above 20
  degrees" was mis-parsed by the automated regex as "**4** came in above 20
  degrees," grabbing the "4" from "Session 4" instead of "Six" from the
  sentence's real subject, because the regex requires the count word to sit
  close to the verb phrase and "in Session 4" sits in between. All four
  "above 20 degrees" findings above were located by a manual grep for the
  literal phrase and verified by hand, not trusted from the automated
  threshold-candidate output. The automated check-5 machinery in
  `regrade.mjs` should be read as low-recall and, on this specific
  collision, actively misleading; it is kept in the script and in
  `regrade-results.json` for transparency, not as a trustworthy candidate
  list.
- **"Of those" antecedent resolution has very low recall.** Only one
  instance was found across 96 debriefs by the automated regex, despite
  "of those" / "of which" style subset language appearing more often than
  that in the raw text (e.g. the `C/power-s2/run8` "two of those still went
  289 and 323 feet" case, which the script never flagged as a check-5
  candidate at all; it was found only by hand while double-checking a
  different result, and turned out to be correct: swing 8 to 323ft and
  swing 10 to 289ft are both real, just given in reversed print order
  relative to the swing list, which isn't an error since no per-position
  correspondence was claimed).
- **A per-swing value check for `direction` (pull/oppo degrees) was folded
  into the `degrees` unit bucket rather than kept separate**, because the
  prompt gives both launch angle and spray direction in degrees and the
  coach sometimes cites either. This trades a small amount of precision
  (a wrong launch-angle claim could theoretically be masked by a coincident
  real direction value) for avoiding false positives; no case in the data
  was found where this mattered in practice.
- **A stricter version of check 4a that required the claimed value to be
  the very first number in the clause was tried and dropped** in favor of
  scanning the whole clause, because tips routinely open with an EV value
  and follow with a launch-angle value for the same swing ("swing 4 hit 92
  mph at 24 degrees"), and the stricter version missed the second value
  entirely.

## Honest assessment: is baseline-vs-B real or noise?

**This is noise at n=24, and probably noise even at n=96.** The strongest
argument against a real budget effect: verified errors do not scale with
how tight the budget is. If shortening the prompt degraded arithmetic, the
expected order would be baseline less than A less than B less than C in
error rate (loosest to tightest). What was actually found is baseline (2)
about equal to A (2), less than B (0), less than C (4). B, the middle-tight
shipped budget, is the *cleanest* of the four, and C, the tightest, is the
*worst*. That is not the shape a real budget-driven effect would take. It
is far more consistent with: these errors are rare (0 to 4 out of 24
debriefs per condition), scattered across specific session/goal
combinations rather than spread evenly, and any handful of counts this
small will reorder conditions by chance alone.

One caveat worth naming rather than hiding: B and A's shorter prose may
simply state fewer of the elaborate multi-clause claims that are prone to
this error in the first place (the "above 20 degrees" attempts and the "of
those" subset claims are exactly the kind of extra elaboration a tighter
word budget would prune). If so, B's clean record could partly reflect
fewer opportunities to be wrong rather than more careful arithmetic when it
does make a claim. This analysis cannot distinguish those two explanations
with the data at hand; doing so would need many more runs specifically on
the `contact-s4`/`above-20-degrees` and swing-12/14 cases, which is a
recommendation, not something this task asked for.

**Bottom line for the product decision:** nothing here supports pulling the
shipped budget (B) on counting-accuracy grounds. The one class of error
found repeatedly (deriving a count/list the prompt doesn't hand over
directly, and occasionally transposing values when restating a list) is
present in the unbudgeted baseline too, and was not made measurably worse
by shortening the prompt. The original production example (session 1) is a
real, confirmed defect in its own right; it just isn't evidence about the
budget specifically, since this dataset has no way to test session 1 with
and without the budget.

## Files

- `rebuild.mjs`: verbatim copy of the bench's session-building machinery,
  used to reconstruct the exact swings every debrief was written about.
- `regrade.mjs`: the five checks, run over both record files.
- `regrade-results.json`: full per-record, per-field output of all five
  checks, for anyone who wants to re-derive a different summary.
- `diag-12-14.mjs`: focused denominator diagnostic for Finding A (the
  swing 12/14 transposition rate against attempts, not against all 24).
