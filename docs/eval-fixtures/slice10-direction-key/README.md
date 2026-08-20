# Slice 10: one round, bought to prove nothing got worse

This directory holds a single live round of 64 coach debriefs, its grading
transcript, the by-hand adjudication of every claim that grading flagged, and
the browser capture showing the two new prompt lines in a request the app really
sends.

The question it was bought to answer was stated in `docs/slice-10-plan.md`
before anything was spent, and it is narrower than it looks: **did adding a
direction key to the coach's prompt make the coach's claims any less accurate?**
Not "more accurate". The change fixes an error class that appears in 0 of 112
measured debriefs outside one goal, so no round at this scale could ever detect
an improvement. This round is a regression guard.

The answer, in one line: **no, and the result landed inside the null band that
was written down before the money was spent, which is what was predicted.**

## What is here

    after/shipped-64.json        64 live debriefs written with the direction key
                                  in the prompt, at seed 20260814.
    after/BUILDER.txt            Which session data these debriefs describe, at
                                  which seed, and the TWO ways this round can go
                                  stale. Read it before re-grading anything.
    after/grading.json|.txt      The grading run for that round.
    HAND-CHECK.md                All 21 flagged claims, each read against rebuilt
                                  session data and judged a genuine coach error
                                  or a tool false positive.
    browser-payload-capture.md   What the browser actually sent: the direction
                                  key in four live debrief requests and one live
                                  chat request, plus the zero-count branch
                                  exercised through the shipped module.

The 64 debriefs are the bench's seven cells: `power-s1` 12, `contact-s1` 12,
`power-s2` 8, `contact-s4` 8, `open-s4` 8, `allfields-s4` 8, `popup-s4` 8.

## Why one round, at this seed, against that baseline

`docs/eval-fixtures/slice9-session-one/after-a/` is the comparison partner, and
it was free. PR #31 touched only `src/DebriefScreen.jsx`, so every prompt file
and every data file was unchanged between the Slice 9 merge and the start of
this slice. Slice 9's two after rounds were therefore already a valid
before-baseline, at two seeds, for any change that leaves the swing data alone.
That is why this slice buys one round instead of two.

Seed `20260814` is the same seed `after-a` used. Session 1 is not generated and
so does not move with the seed, but sessions 2, 3 and 4 are, and the pairing is
the whole design: identical swings, identical generated sessions, one prompt line
different. Grading this round at any other seed rebuilds sessions that never
existed here.

## The exact commands

```
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice10-direction-key/after/shipped-64.json

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice10-direction-key/after --builder current --seed 20260814 \
  --out docs/eval-fixtures/slice10-direction-key/after/grading.json \
  | tee docs/eval-fixtures/slice10-direction-key/after/grading.txt
```

Both flags on the grading command can be omitted; `after/BUILDER.txt` names the
builder and the seed, the grader fills them in, and it refuses outright when a
passed flag disagrees.

The bench round cost $1.12 and the grading $0.3718, $1.49 in total. **Zero parse
failures across all 64 calls.** The grader's free `--dry-run --input` was run
first and exited 0, which is not a formality: that gate was silently dead for a
whole previous slice and nothing said so.

One near miss worth recording, because it cost nothing only by design: the first
grading invocation omitted `--validate`, and the script refused with exit 1
before making a single API call.

## The result, against a band written before the spend

The plan pre-registered the null band: **15 to 29 raw flags is a null; only a
result outside it is a signal.** The band comes from the noise this measurement
has already demonstrated. Slice 9's `after-a` and `after-b` are the same
condition at two seeds and flagged 29 and 15; its before round flagged 16.

**This round flagged 21 claims across 18 of 64 debriefs. Inside the band. A
null, as predicted.**

The full counts: 504 claims extracted, 343 TRUE, 21 FALSE, 140 UNVERIFIABLE, of
which 82 the extractor could not structure at all.

After the hand-check:

| | this round |
|---|---|
| flagged claims adjudicated | 21 |
| **genuine coach errors** | **8** |
| **tool false positives** | **13** |
| false-positive rate on flagged claims | **61.9%** |

For context, and read carefully: using the identical rules and the same
unchanged tool, Slice 9's three rounds hand-checked to 14, 19 and 9 genuine
errors. **The same-condition genuine range is 9 to 19, and this round's 8 sits
just below it. That is not an improvement claim**, and this directory does not
make one. Three rounds is not a distribution, the two Slice 9 after rounds look
at identical session-1 data and differ from each other by 10 genuine errors, and
one draw below a three-point range supports no direction at all.

All 8 genuine errors are numbers the coach derived for itself from the per-swing
table. **None is a contradiction of a count the prompt handed it.** Six of the
eight are the over-generalisation habit CLAUDE.md already records: the coach
names a group of swings and asserts a property across all of them that one
member breaks.

Note that `grading.txt` labels 7 of its 21 raw flags "contradicting a number the
prompt handed the coach". That label is applied before adjudication, and all 7
turned out to be false positives. The label also runs wrong in the other
direction: `power-s2/run3` is recorded `handed: false` on two numbers the prompt
gave the coach word for word.

## Read this first: a raw flag is a lead, not a finding

61.9 percent false positives is the highest rate this project has measured. The
recorded band across five previous rounds was 11 to 42 percent; this round is
above it.

**Nothing in `grading.json` should be reported as a coach error without being
read by hand.** `HAND-CHECK.md` is the adjudication; `grading.json` is raw
output.

Two false-positive mechanisms are new to this project's records:

1. **A handed distribution bucket re-derived with an inclusive upper bound.**
   `DISTANCE_BUCKETS` in `src/ballFlight.js` is half-open, so a 305-foot ball
   belongs to `305+`, not to `265-305`. The tool recomputes that bucket
   inclusively and sweeps the boundary ball back in, turning a correctly
   repeated handed 5 into a "should be 6". This one is **deterministic and sits
   in the verdict code rather than in extraction**, so it is cheap to fix and can
   be validated by replaying the committed rounds offline at zero cost, the same
   route Slice 9 used for its M4 fix.
2. **The denominator of an "N out of fifteen" phrase absorbed as the numeric
   threshold.** "Four swings hit the target zone out of fifteen" became a
   threshold test at 15 degrees. This one sits in extraction.

A third, a new shape of the already-recorded M5: a plain two-value recital
("swings like 5 and 13 left the bat at 92 and 89 mph") converted into a subset
test against 88 mph, a threshold appearing nowhere in the sentence.

## The non-neutrality warning, which outlives this round

M5 accounts for 7 of the 13 false positives, and **four of those seven are the
same sentence in the same cell**: Power session 2's "you cut your under-175-foot
swings from 4 down to 1", a correctly repeated pair of handed distance-bucket
numbers graded against a launch-angle count.

Any future comparison run with this tool that includes the `power-s2` cell
carries roughly four spurious flags from that one recurring sentence shape. **A
raw flag-count delta between two rounds is not usable here without a hand-check
of at least the M5 candidates.**

## What is NOT safe to conclude

- **That the direction key made the coach more accurate.** It cannot be shown at
  this scale and is not claimed anywhere. The error class it addresses did not
  appear in the measured population often enough to move a number.
- **That the direction key made the coach worse.** Same reason, in the other
  direction. That is what the round was bought to check, and it is the one thing
  it does support.
- **That 8 genuine errors is better than Slice 9's 9 to 19.** See above.
- **That any figure here is repeatable.** One round of 64, one model writing and
  another extracting, with live re-extraction every time, so the same debriefs
  graded twice do not produce the same claims. Every number here is one draw.
- **That the coach's spray grouping is fixed.** The browser capture shows it
  stating the convention correctly and getting every sign right, then
  contradicting its own grouping three times in one answer. That is one reply to
  a question written to force spray grouping, on a topic the coach raises by
  itself in 0 of 112 measured debriefs. It is a lead for a future slice, not a
  defect in this one.
- **That the tool's false-positive mechanisms are now enumerated.** Two more
  turned up here. Each wave of measurement has produced new ones.

## This round goes stale the moment the generator changes

`after/BUILDER.txt` carries the full explanation and should be read before any
re-grade. In short: the `current` builder rebuilds ground truth from the working
tree, and it reads **the generator** as well as session 1. Slice 11 is expected
to change `src/swingGenerator.js`. The moment it does, sessions 2, 3 and 4 stop
being reconstructible, while session 1 stays correct, so a re-grade would
produce a complete and entirely plausible fact sheet for swings the coach never
saw on 40 of these 64 records. Nothing would look broken.

Slice 9's three markers have the identical exposure and say nothing about it,
because they were written believing session 1 was the only moving part.
Repairing them, and giving this round a frozen generator snapshot, is Slice 11's
first task.

## Reproducing this

Both commands above spend real money and neither is needed to read the result:
the grading transcript and the hand-check are committed. A future session that
does re-run a round must not overwrite these files, because the comparison
depends on these particular draws and re-running produces different ones.
