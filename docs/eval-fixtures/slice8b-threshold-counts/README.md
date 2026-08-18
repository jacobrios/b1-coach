# Eval fixture: the before/after that measured "count every threshold"

Written 18 August 2026, Slice 8b. These two files are the bench and grader
output behind the slice's headline claim: the targeted miscount is gone, and
the coach's overall accuracy did not otherwise move.

## What these are

    baseline/shipped-52.json    52 debriefs written against the unfixed prompt
    after/shipped-52.json       52 debriefs written against the fixed prompt
    baseline-grading.txt        console output of grading the baseline round
    after-grading.txt           console output of grading the after round

Each is one live run of `scripts/bench-coach-brevity.mjs --condition shipped
--runs 8` (12 runs on `power-s1`, 8 each on the other five cells: `power-s2`,
`contact-s4`, `allfields-s4`, `popup-s4`, `open-s4`). `allfields-s4` and
`popup-s4` are new in this slice; nothing had ever graded those two goals
before. Every record carries the five debrief fields as written, the bench's
own word counts and citation grades, and the elapsed call time. `baseline` was
run first, against the shipped prompt byte-identical to what shipped in
Slice 8; `after` was run second, once the count lines and the two approved
prompt sentences (`src/coachApi.js`) had landed.

~~The grading behind both is committed only as console text, not as JSON, at
`.superpowers/sdd/slice-8b-plan/baseline-grading.txt` and `after-grading.txt`.
Those two files are scratch, not part of this fixture, and are not committed;
this README and the decision-log entry for 18 August 2026 are where their
numbers are recorded permanently.~~ **Corrected 18 August 2026, from
whole-branch review.** Both files are now committed in this directory, as
`baseline-grading.txt` and `after-grading.txt`, copied from the gitignored
scratch location named above. Every global figure this README and the
decision log quote (18 of 52 flagged both rounds, 26 to 27 flagged claims of
463 to 414 extracted, 11 to 11 on the pitch-location class) is checkable
directly against those two files rather than resting on a run nobody outside
the build session ever saw.

## Same seed, different model draw

The session data behind every cell is seeded and identical in both rounds:
`power-s1` reads the same fifteen hand-written swings both times, and every
generated session in the other cells is produced by the same session-4 or
session-2 draw. **What is not identical is what the model wrote.** Each round
is 52 fresh live Anthropic calls, so a claim appearing in `after/run3` is not
a rewrite of `baseline/run3`, it is a new sample from the same prompt (or the
fixed prompt) against the same numbers. Comparing the two rounds is a
before/after comparison of the prompt, not a diff of paired debriefs.

## What this fixture supports concluding

- **The targeted error is gone.** The class the product manager caught by
  eye on 15 August, a self-derived subset like "four of those were under 80
  mph" when the real count differed, appeared 8 times across the 52 baseline
  debriefs and 0 times across the 52 after debriefs. This is the one result
  the slice was built to produce, and it held.
- **The mechanism read from the fixture holds in both directions.** Claims the
  coach derives itself over pitch-location data, the one dimension this slice
  did not pre-count, sat unchanged at 11 flagged occurrences in both rounds.
  Where a count is handed to the coach, it stops getting it wrong. Where a
  count is not handed to it, the error rate is exactly what it was before.
- **Citation density held.** Grounded citations per debrief went from 5.37 to
  5.27, unmatched leads from 0.56 to 0.50, and every tip in both rounds opened
  with a real cited number. The new "never count, total, or tally swings
  yourself" sentence did not push the coach toward vaguer, uncited writing.

## What this fixture does NOT support concluding

- **That the coach got more accurate overall.** It did not, on this measure.
  18 of 52 debriefs were flagged in both rounds, exactly the same count.
  Flagged claims moved from 26 to 27 out of 463 to 414 claims extracted (5.6%
  to 6.5% per claim), which is flat to slightly worse, not an improvement.
  The slice fixed the specific class it targeted and left the rest of the
  coach's error rate where it was; do not round that up to "more accurate."

  **Correction, 18 August 2026, from whole-branch review.** The 18-to-18
  figure above is real, it is the raw grader output from both committed
  rounds, but it overstates how flat the result actually was, because it
  treats the two rounds as graded by an unchanged instrument. They were not:
  this slice's own new count lines hand the coach five kinds of number the
  grader's fact sheet has no matching stat for, and the grader's extraction
  step maps them onto the nearest stat that does exist instead, which
  produces false positives that could only appear in the after round. At
  least 5 of the 18 after-round flags are that mechanism, not a coach error:
  `contact-s4/run1` and `run3` (the coach correctly said "8 swings in the
  target zone," checked against an unrelated in-zone count of 12),
  `allfields-s4/run6` (the coach correctly said "5 opposite-field swings,"
  checked against 11), `allfields-s4/run7` (the coach correctly said "3
  swings cleared 82 mph or higher," checked against the strict above-82 row
  of 1 rather than the inclusive count), and `popup-s4/run6` (the coach
  correctly said "zero pop-ups again," checked against an unrelated
  under-15-degree count of 5). None of these five could have appeared in the
  baseline round, because contact, all-fields and popup were not handed
  those count lines before this slice. Removing them takes the after round
  from 18 to a conservative 13 (a sixth case, `popup-s4/run1`, carries the
  same false positive alongside one genuine error and is left counted). The
  baseline round has one comparable case, giving roughly 17. Corrected, the
  comparison is roughly 17 flagged before this fix against roughly 13 after:
  a modest real improvement, not the flat result reported above. The 18-to-18
  and 5.6%-to-6.5% figures above are left as originally reported, since they
  are the actual grader output; this annotation is the correction to how
  that output should be read, not a replacement for it. The mechanism behind
  the false positives is recorded as a known limit of the instrument below.
- **That every after-round flag is a real coach error.** Several named-
  threshold flags in the after round are grader literalism rather than a
  wrong claim. One example: the coach wrote "nothing cleared 265 feet" and the
  grader flagged it against a fact-sheet row that in fact agrees with the
  sentence. The Slice 8 grader was validated for recall against known-wrong
  debriefs (see `../slice8-grader-validation/`), never for how often it flags
  something that was actually correct. A flag rate from this grader is a
  reasonable proxy for comparing two rounds against each other, and a weak
  instrument for reading any single flag as proven wrong without a by-hand
  check.

  **Known limit, added 18 August 2026, from whole-branch review.** This
  round's flags are not that proxy at even strength between the two rounds,
  because of a gap in the grading tool itself: `scripts/factSheet.js`'s
  `sessionStatsExtras` still emits the old Power-only stats (a count of
  swings under 15 degrees, a count in Power's own zone) for every goal
  regardless of whether that goal's coaching prose still mentions them, and
  it emits no matching stat at all for any of the five new counts this slice
  added to Contact, Hit to All Fields and Reduce Pop-Ups. When the coach
  correctly repeats one of those five new counts, the grader checks it
  against the nearest old stat instead of the right one and calls a true
  statement false. That is the direct mechanism behind at least three of the
  five false positives named above, and it means the after round specifically
  carries a false-positive risk the baseline round structurally could not,
  not an equal weak spot in both. See CLAUDE.md's What's Next list for the
  fix this points to.
- **That a single round's numbers are a precise measurement rather than one
  draw.** 52 calls per round is enough to see an 8-to-0 change land cleanly
  and to see a flat global rate stay flat, but it is one live sample of a
  model, not a repeated-trials average. Treat the global percentages as
  directional, not to the decimal.

## Reproducing this

    node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8
    node --env-file=.env.local scripts/grade-coach-accuracy.mjs --input <records-file-or-dir>

The baseline round cost $0.91 to generate and $0.30 to grade; the after round
cost $0.89 to generate and $0.28 to grade. Total spend across both rounds,
$2.38 of the $6 ceiling the product manager approved before this slice's live
calls began.

## What is deliberately not here

Nothing further. Both rounds are complete as committed; a future change to the
count lines or the prompt sentences earns a new pair of rounds, not an edit to
these two files.
