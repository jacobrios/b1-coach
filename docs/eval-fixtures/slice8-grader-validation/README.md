# Eval fixture: the run that proved the first grader could not be trusted

Written 17 August 2026, Slice 8. These two files are the output of the
claim-accuracy grader's first and only live run in its original form, against
the committed 96-debrief fixture in `../slice7-debriefs/`.

    validate-96-before.json         raw graded claims, all 96 records
    validate-96-before-report.txt   the full console report from the same run

They are committed for one reason: they are the evidence that the grader was
broken. A later session reading only "the grader was rebuilt in Slice 8" would
have no way to see what it was rebuilt from, and this project has twice nearly
lost exactly this class of ground truth to a scratch directory that was about
to be deleted.

## What was run

    node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --out <path>

All 96 fixture records, `--builder frozen`, `claude-haiku-4-5-20251001`, the
script's own default model. All 96 rather than a sample: the fixture supports a
hard recall test only if the 8 known-wrong records are actually in the run, and
`--sample 40` would have been expected to hold about 3 of them.

**Cost $2.56**, 2,048,116 input and 101,913 output tokens.

## What it showed

| Measure | Result |
|---|---|
| Claims found | 801 (TRUE 660, FALSE 109, UNVERIFIABLE 32) |
| Debriefs flagged | 72 of 93 graded |
| Known-wrong debriefs flagged | 7 of 8 |
| Known-wrong debriefs flagged **for the right reason** | **1 of 7 graded** |
| FALSE verdicts whose own reasoning argues TRUE | 24 of 109 (22%) |
| Hard failures, response not JSON at all | 3, including known-wrong record #5 |

## The one thing this fixture must not be read as

**"7 of 8" is not a recall number and must never be quoted as one.** Six of
those seven records were flagged for a completely different sentence while the
grader walked straight past the actual error. At a 77% flag rate, catching seven
is roughly what indiscriminate flagging produces by chance. Recall on the errors
themselves is **1 in 8**.

The blind comparison behind that row was done once, by hand, against the
`../slice7-debriefs/README.md` table of 8, after the run. The script was never
told which records are the known-wrong ones, and still is not. That split is
deliberate and is described at length in the methodological note at the top of
`scripts/grade-coach-accuracy.mjs`.

## The three faults, for anyone reading the raw file

**Fault 1, the verdict came before the evidence.** The response shape was
`{field, quote, verdict, actual, reasoning}` in that order, so the model ruled
before writing down what it had found. Grep the JSON for `should be TRUE` to see
this directly; several FALSE claims argue their own opposite in as many words.

**Fault 2, FALSE where UNVERIFIABLE was meant.** On "six pitches outside the
strike zone" the grader worked out correctly that 15 minus 9 in-zone is 6, then
marked it FALSE because a rule told it not to do arithmetic.

**Fault 3, unreliable table reading.** Search the report for `305`: the same
distance row is read as `above = 4`, `above = 3` and `above = 0` in different
records, against real distances of 323 to 331 feet.

## What replaced it

`scripts/claimVerdict.js`, added in the same slice, with the model reduced to
extraction only and every verdict computed in plain JavaScript against the same
deterministic fact sheet. Its unit tests are `scripts/claimVerdict.test.js` and
they cost nothing to run, which is the second reason for the split.

**The after-run belongs beside these files when it happens**, and its framing
has to be honest: this run was the blind test and it failed, so any rerun is a
retest against a fixture whose failure modes are now known, and its number is
weaker evidence than this one's would have been.

## What is deliberately not here

No re-run, no comparison table, and no "fixed" version of these numbers. This
directory is the before. Adding an after to it later is expected; editing these
two files is not.
