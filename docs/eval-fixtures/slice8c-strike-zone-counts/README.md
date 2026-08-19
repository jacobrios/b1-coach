# Eval fixture: did the strike-zone count lines, the 18-degree fix and the fact-sheet leak fix actually move the coach's accuracy?

Written 19 August 2026, Slice 8c. These files are the before/after grading
behind this slice's own version of Slice 8b's question: did pre-counting a
new dimension (the strike-zone thresholds) reduce the coach's self-derived
miscounts, and by how much.

**Dated note, 19 August 2026, added by the whole-branch review that closed
this slice.** The grading transcripts committed in this directory were
produced before a one-line bug fix landed in `scripts/grade-coach-accuracy.mjs`:
the tool computed the correct handed-versus-self-derived label for every
FALSE claim internally, then dropped it before printing the report, so the
FALSE breakdown line and the per-claim (handed)/(self-derived) tags never
appeared in either transcript. Every handed-versus-derived split quoted in
this README was derived by hand from the individual claims and the handed
set, as the Task 9 report records, and re-verified by the whole-branch
review that found the bug. From the fix onward, the tool prints the split
itself; a future re-grading run does not need this hand-check step.

## What each file holds and how it was produced

    before-grading.json / .txt    Slice 8b's committed after-round bench
                                   records (docs/eval-fixtures/slice8b-
                                   threshold-counts/after/shipped-52.json,
                                   the UNCHANGED prompt Slice 8c inherited),
                                   re-graded with this slice's fixed grading
                                   tool (Task 9). Not a new bench round: no
                                   new debriefs were generated for the
                                   "before" side, only re-graded.
    after/shipped-52.json         52 fresh live debriefs against the CHANGED
                                   prompt (Slice 8c's strike-zone count
                                   lines, the 18-degree fly-ball fix, the "1
                                   swings" grammar fix, done in Tasks 1-9 of
                                   this slice, already merged before this
                                   task ran).
    after-grading.json / .txt     Grading output for the after round, same
                                   tool, same run.

Exact commands, in the order run:

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8b-threshold-counts/after --builder current \
  --handed-era slice8b --seed 20260814 \
  --out docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.json \
  | tee docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.txt

node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice8c-strike-zone-counts/after/shipped-52.json

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/after --builder current \
  --handed-era current --seed 20260814 \
  --out docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.json \
  | tee docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.txt
```

`--handed-era` tells the grader's fact sheet which prompt generation it is
grading against, so a claim referencing a count line that did not exist yet
(`slice8b`) or one that does now (`current`) is checked against the right
stat. Both rounds use the identical seed, so every cell reads the same
underlying session data in both rounds; what differs is only the prompt and
the model's fresh draw against it. Same caveat the Slice 8b fixture
documented: this is a before/after comparison of the prompt, not a diff of
paired debriefs, and no single round's numbers are a precise measurement
rather than one draw.

## A tooling loss on the way here, and the fix that answers it

The first attempt at the after-round bench command completed all 52 live
calls, spent $0.96, and then crashed on `writeFileSync` because its output
directory did not exist yet; the script had no fallback and the calls'
results existed only in memory, so they were gone the moment the process
exited. That is recorded in full in
`.superpowers/sdd/slice-8c-plan/task-10-report.md`. Before re-running,
`scripts/bench-coach-brevity.mjs` was given a one-line guard
(`mkdirSync(path.dirname(args.out), { recursive: true })` immediately before
the write, commit `79b61a0`), verified against the full 489-test suite, and
committed on its own. The after round in this fixture is the *second*
attempt, run once the guard was in place; it did not fail again.

## Raw grader numbers

|                         | before (unchanged prompt) | after (Slice 8c prompt) |
|---|---|---|
| Debriefs graded         | 52                        | 52                      |
| Claims extracted        | 430                       | 434                     |
| TRUE                    | 274                       | 300                     |
| FALSE (flagged claims)  | 26                        | 26                      |
| UNVERIFIABLE            | 130                       | 108                     |
| **Flagged debriefs**    | **15 of 52**              | **21 of 52**            |

Read at face value, this says the after round got *worse*: more debriefs
flagged (21 vs 15), even though the count of FALSE claims held exactly
even (26 both rounds). Per this project's own standing rule, a raw flag is
not proof of a coach error without a by-hand check, and Slice 8b's own
fixture found the same kind of raw-number trap once before. The hand-check
below is what that rule requires, and it changes the read substantially.

## Hand-check: every flagged claim, both rounds, judged genuine or false positive

Every FALSE claim in both transcripts was read against its own record's
text and, where ground truth is directly available (`power-s1` runs the
same fixed fifteen swings in `src/sessionOneSwings.js` every time), checked
by hand-computed arithmetic against those swings, not just against the
grader's own "actual" line. For the generated cells (`power-s2`,
`contact-s4`, `open-s4`, `allfields-s4`), the grader's per-swing "actual"
values were trusted as ground truth, since those come from
`scripts/factSheet.js`, deterministic code reading the real generated
swing rows, not a model guess; what was checked by hand there is whether
the grader compared the coach's claim against the *right* stat, not
whether the stat itself is correct.

**Two false-positive mechanisms showed up repeatedly, both already-known
limits of this grading tool, and one systematic new one:**

1. **Wrong basis: a named-swing claim checked against a whole-session
   total.** The coach's "power zone" swings are always the *same* fixed
   set of three named swings; the grader's fact sheet has a total-session
   pitch-height count but no way to intersect it with the coach's named
   subset, so it checks the claimed count against the session-wide total
   instead. Session-1 ground truth confirms all four instances of "your
   three power-zone swings... all came on pitches between 2.4 and 3.1 feet
   high" (after-round `run2`/`run3`/`run5`/`run8`) are literally true
   (swings 3, 5, and 15 have heights 3.1, 2.6, and 2.5, all inside that
   range), but the grader compared "3" against the session-wide count of 7
   swings in that height band and flagged all four as false. The same
   mechanism appears three times in the before round's `power-s1/run6`
   (the identical power-zone-height claim, plus two EV/LA claims about a
   different named foursome checked against unrelated session-wide totals;
   all three confirmed true against session-1 ground truth by hand).
2. **A "none of them broke/exceeded X" claim checked as a value mismatch
   instead of a complement.** When 100% of a named group is below a
   threshold (so the claim "none of them exceeded X" is true), the fact
   sheet still sometimes compares the literal count differently than the
   claim's own phrasing and reports a mismatch anyway. After-round
   `power-s1/run12` ("none of them broke 80 mph," "none of them got above
   14 degrees" for swings 2, 9, 12) is confirmed true by hand (all three
   swings are under 80 mph and at or under 14 degrees), but both were
   flagged. This is the **exact same bug the Slice 8b fixture's "What This
   Fixture Does NOT Support Concluding" section already named**: "the
   coach wrote 'nothing cleared 265 feet' and the grader flagged it
   against a fact-sheet row that in fact agrees with the sentence." It is
   still present, unfixed, and it is what produced all five of the after
   round's `open-s4` "nothing got out past 265 feet" flags
   (`run1`/`run2`/`run3`/`run5`/`run6`) and the before round's
   `open-s4/run2` version of the identical sentence.
3. **A threshold restated as a value gets checked as if it were a
   specific measurement.** `power-s2/run3`'s "the pitch was below 1.5
   feet" for swing 7 was flagged with "claimed 1.5, the table says 0.79",
   but 0.79 *is* below 1.5, so the claim is true; the extractor structured
   it as an exact-value claim instead of a threshold claim. The before
   round's `open-s4/run7` has the same shape twice ("under 10 degrees"
   checked against exact values of 5 and 9, both of which are under 10).

**Corrected flagged-debrief counts, after removing every claim confirmed to
be one of these three mechanisms:**

|                                    | before | after |
|---|---|---|
| Raw flagged debriefs (grader)     | 15     | 21    |
| Of those, false positive only     | 2      | 10    |
| **Genuine coach error present**   | **13** | **11**|

That is a real, if modest, improvement in the same direction Slice 8b's own
corrected comparison found (roughly 17 to roughly 13 there): the raw
numbers read flat-to-worse, and once the grader's own false positives are
removed by hand, the after round has fewer debriefs with an actual coach
error, not more.

## The pitch-location error class specifically

This is the dimension Slice 8c's strike-zone count lines (Task 2 of the
five pieces) targeted. Two ways to count it, both reported because they
tell different stories:

**Using the same coarse handed-vs-self-derived split Task 9's report used**
(no false-positive removal, just "was this a handed number restated wrong,
or did the coach work it out itself"; see the dated note above on how that
split was actually produced): of the before round's 21
self-derived FALSE claims, 7 are pitch-location (height) claims. Of the
after round's 24 self-derived FALSE claims, 8 are pitch-location. **That
comparison alone reads as flat** (33% of self-derived errors were
pitch-location before, 33% after), which would say this slice's
zone-count work did nothing.

**After removing the false positives identified above**, the picture
changes: of the before round's 7 pitch-location self-derived claims, 1 is
the "power zone height vs session total" false positive described above,
leaving **6 genuine pitch-location coach errors**. Of the after round's 8,
5 are false positives (4 more instances of the same power-zone-height
mechanism, plus the `power-s2/run3` value-vs-threshold case), leaving
**3 genuine pitch-location coach errors**, all three the identical
pattern, "four of those [under-15-degree swings] were on pitches below
1.5 (or 1.4) feet" when the real count among that named group is 3
(`power-s1/run6`, `run8`, `run10`, all in the after round, all confirmed
by hand against session-1 ground truth).

**6 genuine pitch-location errors before, 3 after: a real reduction, not
a flat result, but the raw-number comparison above (7 of 21, 8 of 24)
would have missed it entirely.** The mechanism behind what is left is
narrower than "the coach invents pitch-location groupings" broadly: in
every one of the 3 remaining cases, the coach already had the right total
(the prompt hands "swings on pitches low: 3" as a whole-session count,
via `zoneCountLines` in `src/coachApi.js`) and still asserted a wrong
count of 4 when intersecting that with a *different* named group (the
under-15-degree swings) it had established earlier in the same tip. The
zone count lines this slice added are totals, not per-swing lists, so the
coach still has to self-derive any *intersection* between a zone count and
another named subset, which is exactly where it keeps getting it wrong.
This is a scoping note for whoever picks up the pitch-location item next,
not a claim that this slice's fix did nothing.

## The handed-versus-derived split, and the piece-5 number

Genuine (hand-confirmed) FALSE claims, split by whether the coach was
handed the number directly or worked it out itself:

|                          | before | after |
|---|---|---|
| Handed but restated wrong | 5      | 2     |
| Self-derived, genuine     | 14     | 11    |
| **Total genuine**         | **19** | **13**|

**Piece 5, the number `docs/queued-slices.md` scoped this measurement to
produce: how often the coach contradicts a count it was handed, at the
debrief level, pooled across both rounds.**

- Before: 3 debriefs (`allfields-s4/run3`, `allfields-s4/run8`,
  `popup-s4/run2`).
- After: 1 debrief (`allfields-s4/run2`).
- **Pooled: 4 of 104 debriefs graded across both rounds contradicted a
  handed number (roughly 1 in 26).**

**Stated against the decision rule in `docs/queued-slices.md`:** "roughly
one debrief in fifty means build the fill-in-the-numbers approach; closer
to one in several hundred means leave it alone and keep measuring." 1 in
26 is *worse* (more frequent) than the one-in-fifty trigger for building
the fill-in-the-numbers approach, not close to the one-in-several-hundred
threshold for leaving it alone.

**One caveat that matters for reading that number honestly: the sample is
small and narrow, not diverse.** 3 of the 4 flagged debriefs (2 before, 1
after) are the identical failure shape, two adjacent prior-session
averages recited in the wrong order ("down from 83 and 84 in Sessions 2
and 3" when Session 2 was actually 84 and Session 3 was 83). That is one
specific pattern (transposing two numbers stated back to back), not
evidence the coach broadly garbles handed numbers. The fourth
(`popup-s4/run2`, before round) is a distinct case, a target-zone count
off by one (11 vs the handed 12). Four events is not enough to be
confident in a rate to one significant figure, and this fixture does not
attempt to be. What it does support: this is not the "one in several
hundred, ignore it" case, and the specific order-swap pattern is common
enough among the four events that it is worth naming directly to whoever
next reads piece 5's recommendation, rather than only quoting a pooled
rate.

## What is NOT safe to conclude from this fixture

- **That extraction is deterministic.** 52 live calls per round, one
  sample each. The bench's own dry run and prior fixtures have shown the
  same prompt against the same data can draw a different debrief on a
  different call. Treat every count in this README as one draw, not a
  repeated-trials average.
- **That the grader's false-positive rate is now measured.** This
  fixture's hand-check found 2 of 15 before-round flags and 10 of 21
  after-round flags were false positives, but that is a count on two
  particular rounds against particular prompts, not a general
  false-positive rate for the tool. `CLAUDE.md`'s What's Next list already
  named this as unmeasured; this fixture adds evidence, it does not close
  the item.
- **That the pitch-location fix succeeded outright.** 6 genuine errors
  fell to 3, not to 0. Success here is a sharply lower miscount rate, not
  zero; the exact standard the brief asked this section to hold to. The
  narrower failure shape identified above (self-derived intersections
  between a handed total and a different named group) is still open.
- **That every flagged claim not named above as a false positive is
  definitely a genuine coach error.** The hand-check here was thorough for
  every flagged claim in both transcripts, but it leans on the fact
  sheet's own per-swing values as ground truth for the three generated
  cells (`power-s2`, `contact-s4`, `open-s4`, `allfields-s4`), since
  independently regenerating those sessions from the seed was out of scope
  for this task. Session-1 claims (`power-s1`) were checked against the
  fixed, hand-readable swings in `src/sessionOneSwings.js` directly and
  carry the highest confidence in this fixture.

## Cost, this slice

| What | Cost |
|---|---|
| Task 9: re-grading Slice 8b's after round with the fixed tool (`before-grading`) | $0.3042 |
| Task 10, attempt 1: bench round that completed all 52 calls, then lost every record to the `ENOENT` tooling bug above | $0.96 (spent, no usable output) |
| Guard-fix code commit (`79b61a0`) | $0 (code change only, no live calls) |
| Task 10, attempt 2: bench round, after the guard fix, succeeded (`after/shipped-52.json`) | $0.96 |
| Task 10: grading the after round (`after-grading`) | $0.3073 |
| **Slice total so far** | **$2.5315 of the $3.00 ceiling** |

The $0.96 lost to the tooling failure is a real cost of this slice, stated
plainly rather than folded silently into the successful attempt's number.
$0.4685 remains against the ceiling; nothing further is planned to spend
it.

## Reproducing this

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --input <dir-or-file> --handed-era <slice8b|current>
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8
```

## What is deliberately not here

Nothing further. Both rounds are complete as committed; a future change to
the count lines or the prompt sentences earns a new pair of rounds, not an
edit to these files.
