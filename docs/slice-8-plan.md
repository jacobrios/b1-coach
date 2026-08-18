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

## Task 4b. What three live records found, before the full run

Unplanned, and the best 13 cents this slice spent. A three-record smoke test
ran before committing to the full set, and found three defects the rebuild had
introduced or left open. None was predicted.

1. **A window read as a cutoff.** The coach wrote about "the 25-to-35-degree
   power window"; the extractor flattened it to "at least 25", a different
   question, and marked a correct sentence false. Every goal in this app is
   defined as a range, so this would have inflated the flag rate across the
   whole run and undermined the gate. Fixed with a `range` claim kind counted
   from two precomputed rows.
2. **A window with two halves.** The Power window asks for 25-35 degrees AND
   88+ mph, and the app's own prompt hands the coach that combined count. On
   the session in question, five swings are in the angle range and two meet the
   full zone. The coach said two, and was **right**. The grader called it
   false. Such a claim is now UNVERIFIABLE by construction. **Written into the
   extraction prompt first, where it did not hold; moved into code, where it
   cannot be ignored.**
3. **No vocabulary for pitch location.** The coach cites pitch height often.
   The metric list held only what the swing did, so the extractor had no honest
   label and graded "a pitch 0.6 feet off the ground" against that swing's
   direction of 7 degrees. The values were in the per-swing table all along.

**What survived all three is a genuine coach error**, hand-verified: one
debrief claims six swings at 16 degrees or under where the true count is three.
Sixteen is a number the prompt never hands over, which is the mechanism the
fixture identified.

Flagged on those three records went from 2, with three false positives, to 1
with none.

### Two near-misses worth recording, both about evidence rather than code

- **A mutation test reported "no effect" because the mutation never applied**,
  killed by shell escaping. A mutation that does not mutate looks exactly like
  a test that does not bite. Re-run with the substitution verified, it failed
  as it should.
- **Three tests written for the pitch-location bug passed on their first run.**
  The verdict layer was already correct; the bug was one layer up in the
  extractor's metric whitelist. They were kept, because they pin behavior worth
  pinning, but they were proven by mutation rather than counted as evidence of
  the fix.

## Task 4c. Cache the fact sheet

Not in the original plan; added when the re-validation cost was put to the
product manager. Every debrief in a cell sends a byte-identical fact sheet, and
that is most of the input: 2.05M of the first run's 2.05M input tokens were
prompt, a few hundred per record were the debrief itself.

**The breakpoint sits after the fact sheet, not on the system prompt, and that
is load-bearing.** On Haiku 4.5 the minimum cacheable prefix is 4096 tokens and
the system prompt alone is about 900. A breakpoint there caches nothing and
reports no error, only a `cache_creation_input_tokens` of zero. Caching is a
prefix match and system renders before messages, so a breakpoint on the first
user block covers both.

Measured live on three records: 1 cache write, 2 reads, $0.0307 against $0.0520
uncached. The report prints the cached and uncached figures side by side, and
says so explicitly when a run reports no cached tokens at all, because that
silence is a finding rather than a formatting choice.

## Task 5. Re-validate the rebuilt grader. RAN TWICE; see below.

**The gate:** the known-wrong records are flagged for the right reason, and the
flag rate is low enough that catching them means something.

### First re-validation, 17 August 2026: $0.74, real progress, two defects

| Measure | Failed grader | First re-validation |
|---|---|---|
| Known-wrong flagged for the right reason | 1 of 7 | 6 of 8, all six right-reason |
| Debriefs flagged | 72 of 96 | 28 of 96 |

Every flag outside the known 8 was adjudicated by hand, per the fixture
README's rule that the other 88 are "no verified error found", not proven
clean. That adjudication found the two remaining defects and two genuine coach
errors the original hand analysis had missed.

**Defect: the extractor could peek.** The two misses were the transposition
errors ("swings 12 and 14 at 11 and 14 degrees", true values reversed), and the
extractor returned those pairs already corrected to the true values, so the
verdict code graded the coach's mistake as TRUE. It could only have learned the
true values from the fact sheet, included in the prompt "for context". **Fix:
the extractor is blind.** It sees only the coach's words. A prompt rule could
not have held; removing the data cannot not hold. Side effect: requests shrank
about twenty-fold, which retired the fact-sheet cache built earlier the same
day. The dry run now checks blindness the way it used to check the breakpoint.

**Defect: named swings graded session-wide.** Fifteen of 21 range flags were
"swings 4, 5, 6, and 7 ... all between 88 and 92 mph": a claim about four named
swings, counted against the whole session. Ranges now carry `ofSwings` and are
answered from those swings' own rows.

**Two genuine finds, hand-verified against the rebuilt session data**: "6 of
your 15 swings landed between 20 and 31 degrees" is truly 8, and "eight of 15
between 15 and 24" is truly 9. Both are self-derived counts, the fixture's
mechanism, found by the instrument and missed by the original hand analysis.

**Blinding exposed one more mislabel class**, caught by a 24-record smoke: with
no fact sheet to lean on, the extractor sometimes labels a distance claim as a
session statistic, so "4 balls hit 305 feet or more" was graded against the
in-zone count. No session stat measures feet, so a units-contradiction guard in
the verdict code now answers UNVERIFIABLE ("this claim was mislabeled by
extraction") instead of announcing the gap between two unrelated numbers. The
same smoke confirmed the blind extractor catches the transposition it used to
repair, on the exact swapped pair, both directions.

### Final validation run, 18 August 2026: the gate passed

$0.63, all 96 records, zero hard failures.

| Measure | Failed grader | Final |
|---|---|---|
| Known-wrong flagged for the right reason | 1 of 7 graded | **8 of 8** |
| Debriefs flagged | 72 of 93 | 20 of 96 |

Both transposition errors the peeking extractor used to repair are now caught,
on the exact swapped pair, in both directions.

All twelve flags outside the known 8 were adjudicated by hand: five solid new
coach errors (each verified directly against the rebuilt session data), three
boundary errors ("under 14 degrees" about a swing at exactly 14), and four
false positives recorded as known limits rather than patched, because a fourth
round of hardening against the same fixture would shade from fixing the
instrument into fitting it. The four: an only-X exclusivity claim mis-extracted
as a value claim, a pitch-side sign convention ("0.86ft outside" against a
stored -0.86), and two scope ambiguities where the coach described the
two-metric power zone loosely.

So the instrument's measured state: 100% right-reason recall on the 8, roughly
80% precision across everything it flags, at about $0.63 per 96 debriefs.

**The honest framing, which goes in the decision log too:** the first run was
the blind test and it failed. Everything after is a retest against a fixture
whose failure modes are known, and each pass is weaker evidence than the one
before, because the instrument has now been corrected against this data three
times. The unit tests (37 on the verdict module alone) are the instrument's
primary warranty going forward; the fixture run is the demonstration.

## Task 6. Records

Decision-record entry, CLAUDE.md current-state and What's Next updated, and
`docs/queued-slices.md` annotated with the split and with Slice 8b's full scope.
