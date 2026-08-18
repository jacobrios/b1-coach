# Slice 8: build an instrument that can tell whether the coach is lying

Written 17 August 2026, on branch `slice-8-coach-fidelity`, cut from a current
main at `1e2dae0`. Test-suite baseline at slice start: **392 tests across 16
files, all green**, matching the number recorded at the close of Slice 7b, so
nothing is carried in broken. Safety-net drift check: clean.

---

## Settled before work started, do not relitigate

- **This slice ships no coach change.** It was scheduled as coach fidelity, and
  the first task, validating the grader, failed outright (Task 1). The product
  manager split the work at that seam on 17 August 2026 rather than carry a
  coach fix that could not be measured. The coach fix is **Slice 8b**, scoped in
  full in `docs/queued-slices.md`.
- **The grader's judgment is rebuilt in code, not re-prompted.** Approved over a
  minimal prompt fix. The model's claim-finding works; its ruling is where every
  failure lives, so the ruling moves into plain JavaScript.
- **Tonight's failed run is committed as evidence**, not discarded. A future
  session reading only "the grader was fixed" would have no way to see what it
  was fixed from.

## Not in this slice, and where each belongs

- **Every coach-prompt change**: counting the named thresholds, the tips worked
  example, the citation rule. All of it is Slice 8b, scoped in
  `docs/queued-slices.md`.
- **The two new bench cells** (`allfields-s4`, `popup-s4`). They exist to measure
  a coach change, so they belong with it, in Slice 8b.
- **Queued items 1 and 4** (the coach never receiving its own tips; the two
  fields that can blank the screen). Unchanged, still queued, neither is an
  accuracy problem.

## How this slice is verified

1. Every verdict rule gets a unit test, seen failing first, against fixture data
   already committed. This is the point of moving judgment into code: the
   instrument becomes testable without spending money.
2. One re-validation run against the committed 96-debrief fixture. The gate is
   **catching the known-wrong records for the right reason**, which the failed
   run did once in seven.
3. The retest framing goes in the record honestly: the first run was blind and
   failed, so this one is weaker evidence than a first run would have been.

## Debt this slice is expected to open

The rebuilt grader rules only on claim shapes its verdict code understands, and
everything else becomes UNVERIFIABLE. That is honest but it narrows what one run
can say, and the narrowing is invisible unless the UNVERIFIABLE rate is reported
beside the rest.

---

# Tasks

## Task 1. Validate the claim-accuracy grader against the fixture. DONE, FAILED.

Run 17 August 2026: all 96 fixture records, `--builder frozen`, Haiku 4.5, the
script's own default model. All 96 rather than a sample, because the fixture
supports a hard recall test only if the 8 known-wrong records are actually in
the run, and `--sample 40` would have been expected to hold about 3 of them.

    node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --out <path>

**Cost: $2.56** (2,048,116 input + 101,913 output tokens). This overran the
$1.50 to $2.00 estimate given to the product manager beforehand, by about 30%.
The estimate came from one dry-run prompt measurement on a two-session cell and
under-counted the four-session cells.

### Results

| Measure | Result |
|---|---|
| Claims found | 801 (TRUE 660, FALSE 109, UNVERIFIABLE 32) |
| Debriefs flagged | 72 of 93 graded |
| Known-wrong debriefs flagged | 7 of 8 |
| Known-wrong debriefs flagged **for the right reason** | **1 of 7 graded** |
| FALSE verdicts whose own reasoning argues TRUE | 24 of 109 (22%) |
| Hard failures, response not JSON at all | 3, including known-wrong record #5 |

The blind comparison was done once, by hand, against the fixture README's table
of 8, after the run, exactly as the script's methodological note requires. The
script was never told which records were the known-wrong ones and still is not.

**The 7-of-8 headline is an artefact and must not be quoted as recall.** Six of
those seven were flagged for a completely different sentence while the grader
walked past the actual error. At a 77% flag rate, seven catches is roughly what
indiscriminate flagging produces by chance. Recall on the errors themselves is
**1 in 8**. The fixture did precisely the job it was committed for: it caught a
grader that would otherwise have been trusted.

### Diagnosis, and why the fix is not a better prompt

**Fault 1, the verdict is emitted before the evidence.** The required response
shape is `{field, quote, verdict, actual, reasoning}`, in that order. The model
commits to a verdict, then writes down the fact-sheet data and its reasoning.
Two dozen FALSE verdicts carry reasoning that concludes the opposite, several
saying so outright:

> "All three values match exactly; the claim is TRUE, not FALSE. Correction:
> verdict should be TRUE."

That claim was returned as FALSE.

**Fault 2, FALSE is used where UNVERIFIABLE is meant.** On "six pitches outside
the strike zone" the grader reasoned correctly that 15 minus 9 in-zone is 6,
then marked it FALSE because a rule told it not to do arithmetic. Rule 332 says
to use UNVERIFIABLE there; the model resolves the conflict the other way.

**Fault 3, unreliable table reading.** The same 305-foot distance row is read as
`above = 4`, `above = 3` and `above = 0` across different records, against real
distances of 323 to 331 feet.

## Task 2. Commit tonight's run as a fixture

`docs/eval-fixtures/slice8-grader-validation/`, already written, 576 KB: the raw
graded claims (`validate-96-before.json`) and the full run log
(`validate-96-before.log`). Needs a README on the pattern the Slice 7 fixture
set, covering what the files are, what they prove, and the one thing they must
not be read as (that 7 of 8 is a recall number).

This project has twice nearly lost exactly this class of evidence to a scratch
directory, and says so about itself in two places. Committing it is not
housekeeping.

## Task 3. Rebuild the grader so verdicts are computed, not generated

The reasoning is this project's own standing rule: structured extraction returns
claims, which get validated, normalized, and branched on as a normalized shape,
rather than a raw model response deciding the outcome. The current grader hands
the model both jobs, find the claim and rule on it. The finding half works: 801
claims located and quoted accurately. Every failure lives in the ruling half.

**The model's new job is extraction only.** Per countable claim it returns the
field, the exact quote, and the claim in structured form: metric, threshold,
comparison direction, stated count or value, and any swing numbers named. No
verdict, no reasoning.

**A new tested module does every verdict in plain JavaScript**, beside
`scripts/factSheet.js`, reading the same deterministic fact sheet. It owns the
comparison-direction mapping, the distance rounding tolerance, and the
"N of those [swings X, Y, Z]" set intersection, all of which the system prompt
currently asks a model to apply by hand. A claim shape the verdict code does not
understand becomes UNVERIFIABLE by construction rather than by instruction.

This removes Faults 1 and 3 outright: there is no model verdict to contradict
its own reasoning, and no model reading of a table. Fault 2 becomes a code
branch rather than a prompt rule.

Every verdict rule gets a test, seen failing first, against fixture data already
committed. That is the second reason for this shape and the one that pays off
every time the instrument is touched again.

## Task 4. Capture why a grader call failed

Three of 96 responses were not JSON at all, and `callGraderModel` records neither
`stop_reason` nor the output token count, so the script cannot tell a truncated
answer from a malformed one. Slice 7b closed exactly this blind spot for the
bench with `scripts/coachFailureRecord.js`, in a script written the same week.

It matters beyond tidiness. If the cause is truncation at `GRADER_MAX_TOKENS`,
the failures cluster on the debriefs carrying the most claims, which is a
**biased** loss rather than a random one, and it lands hardest on the debriefs
most likely to contain an error. One of the three lost records was known-wrong
record #5, which is that bias showing up on the very first run.

Extraction-only output is smaller than verdict-plus-reasoning output, so Task 3
may reduce this on its own. Capture the diagnosis rather than assuming it did.

## Task 5. Re-validate the rebuilt grader

One run, all 96. Budget it from measured token counts this time, not from a
single-cell extrapolation, and put the figure to the product manager before
spending.

**The gate to call this slice done:** the known-wrong records are flagged for
the right reason, and the flag rate is low enough that catching them means
something. A grader that flags three quarters of everything has not passed,
whatever its recall looks like.

**The honest framing goes in the decision log**: the first run was the blind
test and it failed. This one is a retest against a fixture whose failures are
now known, so its number is weaker evidence than the first run's would have
been. Do not report the two as equals.

## Task 6. Records

Decision-record entry, CLAUDE.md current-state and What's Next updated, and
`docs/queued-slices.md` annotated with the split and with Slice 8b's full scope.
