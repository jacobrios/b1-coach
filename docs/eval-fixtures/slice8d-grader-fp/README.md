# Slice 8d, Task 5: the grader's false-positive rate, measured

This directory holds two fresh live grading runs against the fully fixed
tool (the negated-exceedance guard from Task 2, wired into `claimVerdict.js`
before both the count comparison and the Slice 8c sibling-bucket rule), plus
a by-hand check of every claim either run flagged. The goal was the number
this project's What's Next list has called unmeasured since Slice 8b: how
often the grader calls a true coach statement false.

## What is here, and the exact commands

- `regrade-8b-after.json` / `.txt`, the live grading transcript from:

  ```
  node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
    --input docs/eval-fixtures/slice8b-threshold-counts/after --builder current \
    --handed-era slice8b --seed 20260814 \
    --out docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.json \
    | tee docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.txt
  ```

  This re-grades the same 52 debriefs Slice 8c's own "before round" graded
  (Slice 8b's after-round bench output), with `--handed-era slice8b` because
  that is the prompt era those 52 debriefs were actually generated under.

- `regrade-8c-after.json` / `.txt`, the live grading transcript from:

  ```
  node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
    --input docs/eval-fixtures/slice8c-strike-zone-counts/after --builder current \
    --handed-era current --seed 20260814 \
    --out docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.json \
    | tee docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.txt
  ```

  This re-grades Slice 8c's own after-round bench output, with
  `--handed-era current` because that is the prompt era those 52 debriefs
  were generated under.

- `replay-8c-rounds.txt`, carried over from Task 4 (the deterministic,
  no-spend replay of Slice 8c's two stored rounds against the fixed verdict
  code). Not new to this task; kept here because Task 5's own numbers lean
  on it.

**Both `--out` files use the newer `{ meta, results }` shape**, not the bare
array older committed fixtures use. `meta` carries `generatedAt`, `model`,
`source`, `builder`, `seed`, and `handedEra`, so a committed grading run now
names its own era and seed instead of relying on its file path to say so (a
gap named in `CLAUDE.md`'s What's Next list; this task's two files are the
first grading runs to close it for themselves specifically, not a general
fix to older committed files). `results` is the array of one entry per
record, each carrying `record`, `claims`, `flagged`, `malformedCount`,
`usage`, and `diagnosis`.

**Important: these are fresh live extractions, not replays.** The 52 input
debriefs (the coach's actual prose) are unchanged, committed data, but the
grading model runs a brand new extraction pass through the improved
extraction prompt (Task 3) every time this command runs, so which claims get
found and how they get worded can differ from both the originally stored
grading runs and from Task 4's deterministic replay of those stored claims.
That is expected and is exactly why this task ran two fresh live rounds
instead of only replaying: the false-positive rate needed to be checked
against what the tool does today, extraction included, not only against
whether old stored verdicts flip under the new verdict code.

## Headline numbers, both rounds

|                          | round 1 (era slice8b) | round 2 (era current) |
|---|---|---|
| Records graded           | 52                     | 52                     |
| Claims found             | 421                    | 433                    |
| TRUE                     | 262                    | 298                    |
| FALSE (flagged)          | 18                     | 19                     |
| UNVERIFIABLE             | 141                    | 116                    |
| Flagged debriefs         | 11 of 52               | 16 of 52               |
| Cost                     | $0.3087                | $0.3162                |

## Hand-check: every flagged claim in both rounds

Every FALSE claim from both transcripts was read against its own record's
text, then checked against ground truth. For `power-s1` (session 1 in every
cell that uses it), ground truth is the fixed fifteen swings in
`src/sessionOneSwings.js`, read by hand. For the generated cells
(`power-s2`, `contact-s4`, `allfields-s4`, `popup-s4`), ground truth was
pulled directly from the same swing data the fact sheet reads
(`resolveSessions` from `scripts/grade-coach-accuracy.mjs`), not just taken
on the grader's own word, so a wrong-basis mismatch could be told apart from
a genuine coach error rather than assumed.

**Round 1 (18 flagged claims, 2 false positives):**

| Record | Field | Quote | Verdict |
|---|---|---|---|
| power-s1/run4 | tip1 | "two of those pitches were below 1.5 feet" | Genuine. All 3 named swings (1.2, 1.4, 0.8 ft) are below 1.5, not 2. |
| power-s1/run6 | tip1 | "Swings 2, 4, 9, and 12 were all on pitches at 1.4 feet or lower" | Genuine. Swing 4 is at 2.3 ft, not below 1.4. |
| power-s1/run6 | tip2 | "all came on pitches between 2.4 and 3.1 feet high" | **False positive.** The subject is "your three power-zone swings" (3, 5, 15), whose real heights are 3.1, 2.6, 2.5, all inside the range: true. The grader compared "3" against the whole session's count in that band (7) instead of intersecting with the named three. |
| power-s1/run8 | tip1 | "four of those were on pitches below 2.5 feet" | Genuine. Among the six swings under 15 degrees (1, 2, 4, 7, 9, 12), five are below 2.5 ft, not four (only swing 1 at 2.8 is not). |
| power-s1/run8 | tip2 | "at launch angles of 25 to 27 degrees" | Genuine. Swing 5 is at 28 degrees, outside 25 to 27. |
| power-s1/run9 | tip1 | "four of them were on pitches at or below 1.4 feet off the ground" | Genuine. Only 3 of the six under-15-degree swings are at or below 1.4 ft. |
| power-s1/run9 | tip2 | "all came on pitches between 2.4 and 3.1 feet high" | **False positive.** Same mechanism as run6/tip2 above: the three named power-zone swings are all genuinely in range; graded against the whole-session count of 7 instead. |
| power-s1/run11 | tip1 | "Swings 2, 4, and 12 all came in under 75 mph" | Genuine. Swing 4 is exactly 75 mph, not under it. |
| power-s1/run11 | tip2 | "...all left the bat between 88 and 92 mph at 26 to 27 degrees" | Genuine. Swing 5 is at 28 degrees, outside 26 to 27. |
| open-s4/run6 | whatThisMeans | "six balls clearing that mark in Session 3" | Genuine, per the grader's own factSheet.js count for the generated session (7, not 6). |
| open-s4/run6 | tip2 | "Swings 12 and 13 both came in under 10 degrees launch angle" | Genuine, per factSheet.js (only 1 of the 2 named swings is below 10). |
| allfields-s4/run3 | coachingSummary | "down from 83 and 84 in Sessions 2 and 3" (x2, one claim per session) | Genuine. Session 2's real average is 84 and Session 3's is 83; the coach stated the two numbers in the wrong order. This is a handed-number contradiction, not a self-derived miscount. |
| allfields-s4/run8 | coachingSummary | "hitting 83 and 84 in Sessions 2 and 3" (x2) | Genuine. Same transposition as run3, same two real values swapped. |
| popup-s4/run1 | tip2 | "none of them reached 75 mph" | Genuine. Named swings 1, 7, 13 have real exit velocities 75, 74, 78; swing 13 at 78 did reach it. |
| popup-s4/run2 | coachingSummary | "11 of 15 swings landed in the target zone" | Genuine, per factSheet.js (12, not 11). |
| popup-s4/run3 | tip2 | "none of them got above 75 mph" | Genuine. Same swings, same real values, same contradiction as run1. |

**Round 2 (19 flagged claims, 8 false positives):**

| Record | Field | Quote | Verdict |
|---|---|---|---|
| power-s1/run2 | whatThisMeans | "When you squared it up, you hit it 310 to 346 feet" | **False positive.** Not a count claim at all; it describes the power-zone swings' distance range (310, 345, 346, all inside 310 to 346: true). The extractor forced it into a count-of-1 claim and compared that invented "1" to the whole session's count of 3, which was never what the sentence asserted. |
| power-s1/run2 | tip2 | "all came on pitches between 2.4 and 3.1 feet high" | **False positive.** Same wrong-basis mechanism as round 1's two instances above. |
| power-s1/run3 | tip2 | same wording, different run | **False positive.** Same mechanism. |
| power-s1/run5 | tip2 | same wording, different run | **False positive.** Same mechanism. |
| power-s1/run6 | tip1 | "four of those were on pitches below 1.5 feet" (handed) | Genuine. Among the six under-15-degree swings, only 3 (2, 9, 12) are below 1.5 ft. This is the prompt's own zone-count line being intersected with a different named group and getting it wrong, the known open failure shape from Slice 8c's own close. |
| power-s1/run8 | tip1 | "four of those were on pitches below 1.5 feet" (handed) | Genuine, same mechanism as run6. |
| power-s1/run8 | tip2 | "all came on pitches between 2.4 and 3.1 feet high" | **False positive.** Same wrong-basis mechanism. |
| power-s1/run10 | tip1 | "four of those were on pitches at 1.4 feet or lower" | Genuine, same intersection mistake, worded slightly differently. |
| power-s1/run12 | tip2 | "Your three swings in the power zone... averaged over 88 mph" | **False positive.** The named subset's real average is (88+91+92)/3 = 90.33, which is over 88: true. The grader compared it against the whole session's `avgExitVelocity` (82), a stat that was never what the sentence was about. |
| power-s2/run1 | tip2 | "all three came in under your exit velocity average" | Genuine. Named swings 7, 9, 15 are 88, 87, 83 mph against a session average of 84; only swing 15 is under it. |
| power-s2/run2 | tip2 | "Swings 3, 5, and 13 went 88-90 mph" | Genuine. Real values 86, 84, 90; only swing 13 is in range. |
| power-s2/run3 | tip1 | "the pitch was below 1.5 feet" (handed) | **False positive.** Swing 7's real pitch height is 0.79 ft, which is below 1.5: true. The extractor structured a threshold claim as an exact-value claim and compared 1.5 to 0.79 for equality, the value-vs-threshold mechanism the Slice 8c fixture already named once, still unfixed. |
| power-s2/run6 | tip1 | "your exit velocity dropped to 87, 87, and 83 mph on those" (handed) | Genuine, narrowly. Swing 7's real value is 88, not 87 (a 1 mph miss); the other two named values, 87 and 83, are exactly right. |
| contact-s4/run1 | coachingSummary | "You matched your Session 3 count of 8 swings in the target launch angle window" | **False positive.** Session 3's real count in Contact's target band is 8 and Session 4's is also 8: the claim is true. The extractor misclassified the whole claim as an unrelated "launch angle exactly 0" count (actual 0), a full metric mismatch rather than a subset-vs-session mismatch, so it never checked the right fact at all. |
| contact-s4/run2 | coachingSummary | "you matched Session 1's high of 8 swings in the target zone" (handed) | Genuine. Session 1's real count in Contact's target band is 6, not 8. |
| contact-s4/run6 | tip2 | "swings 2, 9, 11, and 12 all came in under 80 mph" | Genuine. Swing 2 is exactly 80 mph, not under it. |
| contact-s4/run6 | tip2 | "...with launch angles below 15 degrees" | Genuine. Swing 9 is exactly 15 degrees, not below it. |
| allfields-s4/run1 | tip2 | "Swings 4 and 5 were your only pull-side contact, and both came in under 82 mph" | Genuine. Swing 5 is exactly 82 mph, not under it. |
| allfields-s4/run3 | tip2 | "On swings like 12 and 4, you were under 78 mph" | Genuine. Swing 4 is 80 mph, not under 78. |

## The false-positive rate, per round

Using the same debrief-level framing Slice 8c's own README used ("of the
raw flagged debriefs, how many turn out to have zero genuine claims once the
false positives are pulled out"):

|                                  | round 1 | round 2 |
|---|---|---|
| Raw flagged debriefs            | 11      | 16      |
| Of those, false positive only   | 0       | 6       |
| Genuine coach error present     | 11      | 10      |

At the individual-claim level, the rate this task set out to produce:
**round 1: 2 of 18 flagged claims (11.1%) are false positives. Round 2: 8 of
19 flagged claims (42.1%) are false positives.**

## Against Slice 8c's own hand-counted numbers

Slice 8c's README hand-checked the same two underlying 52-debrief record
sets, but graded by the tool as it stood before this slice's negated-
exceedance fix, and reported **2 of 15 before-round flagged debriefs** and
**10 of 21 after-round flagged debriefs** as false positive only, at the
debrief level.

This task's round 1 regrades the identical 52 debriefs Slice 8c's before
round graded (same input directory, same `--handed-era slice8b`), and its
false-positive-only debrief count dropped from 2 to 0. This task's round 2
regrades the identical 52 debriefs Slice 8c's after round graded, and its
false-positive-only debrief count dropped from 10 to 6.

**Read this as a real, if partial, improvement, with two honest caveats.**
First, the raw flagged-claim counts also moved (15 to 18, 21 to 19), because
extraction is stochastic and this task ran fresh live calls rather than
replaying the stored claims, so the two comparisons are not claim-for-claim
identical; some claims present before may not recur, and new ones may
appear. Second, and more precisely: the negated-exceedance guard this slice
built targets exactly one of Slice 8c's three named false-positive
mechanisms (the "none of them broke/exceeded X" complement bug), and it
fired zero times in either of this task's two live rounds. That is not
because the coach stopped producing "none of them broke/exceeded X"
statements. Counting every claim with a negation word, a stated count of
exactly zero, and a comparison the guard cares about (`above`, `below`, or
`atMost`, the exact shape the bug and the fix both act on): the stored
after round carried 9 such claims, live round 2 carried 18, roughly twice
as many, not fewer. **What changed is the outcome, not the input.** Of the
stored after round's 9, all 9 were extracted with the broken `below`/`atMost`
comparison the guard exists to catch, producing 8 wrongly-FALSE verdicts
(the same 8 Task 4's replay flips) and 1 UNVERIFIABLE. Of live round 2's
18, all 18 were extracted with the correct `above` comparison on the first
pass, so none needed the guard's reroute at all. The stored before round
carried 2 such claims (1 wrongly flagged FALSE, matching Task 4's single
before-round flip exactly); live round 1 carried 9, all 9 correctly
extracted as `above`. Task 3's extraction-prompt guidance now appears to
structure negated exceedance correctly at the source, which is a stronger
result than "the guard fixed it," not a weaker one: the miscoded shape the
guard reroutes almost never reaches the verdict layer any more. **The
guard's own deterministic proof still rests on Task 4's replay, not on
this task**, since neither live round exercised the reroute path even
once; it stands as the backstop for the day extraction regresses, not as
something this task's live calls demonstrated firing correctly. **The
other two mechanisms Slice 8c named, wrong basis and value-vs-threshold,
are unfixed and account for every false positive in both of this task's
rounds**: 7 of round 2's 8 false positives are wrong-basis (a named-subset
claim checked against a whole-session total, including one variant checked
against a whole-session average, and one full metric misclassification),
and 1 is value-vs-threshold (`power-s2/run3`). Round 1's 2 false positives
are both the same wrong-basis shape.

## The Task 4 replay proof, restated correctly

The brief's own working notes said the replay would show an "8-and-only-8"
result. The actual number, established by Task 4's own commit and report,
is **9, not 8**: replaying Slice 8c's two stored rounds through the fixed
verdict code flips 9 stored claims from FALSE to TRUE (1 in the before
round, 8 in the after round), all of them the negated-exceedance shape, with
zero movement anywhere else (no other verdict class touched, UNVERIFIABLE
counts unchanged in both rounds). That takes the before round's stored
flagged-debrief count from 15 to 14, and the after round's from 21 to 14.
The ninth flip, `power-s2/run4`'s `tip1` claim ("none of them cracked 88
mph"), was not named in the brief's own arithmetic notes and was found only
by reading the claim's stored data during Task 4's acceptance check. This
README's own live rounds (above) are a separate, later measurement and do
not supersede the replay; both stand together.

## The power-s2/run4 correction to Slice 8c's own README

Slice 8c's committed hand-check judged the after round's `power-s2/run4`
claim, "none of them cracked 88 mph," as a genuine coach error. It was not.
The three named swings (7, 9, 15) have real exit velocities 88, 87, and 83
mph; none of them is strictly above 88, so the claim is true, and the
stored FALSE verdict (which compared the claimed 0 against the below-88
bucket's count of 2, rather than the above-88 bucket's count of 0) is the
same negated-exceedance complement bug as the other 8 flips Task 4's replay
found. This was a grader false positive, not a coach error.

**This corrects Slice 8c's own numbers, stated plainly rather than buried:**
the after round's genuine-error count drops from 11 to 10, and Slice 8c's
headline "13 to 11" before-and-after comparison (its README's "Total
genuine" row) should read **13 to 10**, a slightly larger improvement than
Slice 8c reported at its own close. `docs/eval-fixtures/slice8c-strike-
zone-counts/` itself is left untouched; this correction lives here, in this
slice's own record, per this project's append-only convention.

## Known limits, named rather than silently discovered later

**The negated-exceedance guard is not clause-aware.** `NEGATED_EXCEEDANCE`
in `scripts/claimVerdict.js` matches a negation word and an exceedance verb
anywhere within 60 characters of each other, with no understanding of
clause boundaries. A contrived compound sentence ("none of them were tired,
though several broke 90 mph doing it") could in principle satisfy the
pattern for the wrong reason and get rerouted when it should not be. This
was judged low-likelihood against how real bench transcripts actually read,
and is recorded as debt rather than fixed, per Task 2's review.

**Wrong basis and value-vs-threshold are measured here, not fixed.** Every
false positive in both of this task's rounds is one of these two
mechanisms (see the per-round tables above). Fixing wrong basis would mean
teaching the fact sheet to intersect a named-subset claim against the right
swings instead of defaulting to a whole-session count whenever a range or
sessionStat claim carries no `ofSwings`; fixing value-vs-threshold would
mean recognizing when an extracted "exact value" claim is actually a
restated threshold. Neither change was in scope for this task.

## What is NOT safe to conclude from this task

- **That this is a general false-positive rate for the tool.** Two rounds,
  52 debriefs each, six goal cells, one seed, one model
  (`claude-haiku-4-5-20251001`). A different set of prompts, a different
  goal mix, or a different day's extraction could read differently.
- **That extraction is deterministic.** Both rounds are fresh live calls
  through the same prompt against the same underlying swing data as
  earlier committed rounds, and produced different claim counts and
  different specific claims than those earlier rounds. Treat every number
  here as one draw, not a repeated-trials average.
- **That the negated-exceedance fix was exercised by this task's own live
  calls.** It fired zero times in both rounds. The evidence that the fix
  itself works is Task 4's deterministic replay, not this task.
- **That every claim not named above as a false positive is definitely a
  genuine coach error.** Session 1 claims carry the highest confidence,
  checked against the fixed, hand-readable swings in
  `src/sessionOneSwings.js` directly. Claims in the four generated cells
  lean on `resolveSessions`/`scripts/factSheet.js`'s own per-swing values as
  ground truth, deterministic code reading the real generated rows rather
  than a model guess, but independently re-deriving the generator's output
  by hand was out of scope here.
- **That wrong basis and value-vs-threshold are now fully catalogued.**
  This task found one new variant of wrong basis not named in Slice 8c's
  README (a named-subset's *average* checked against the whole session's
  average) and one case that is closer to a full metric misclassification
  than a basis mismatch (`contact-s4/run1`). There may be others neither
  round happened to surface.

## Spend, this task

| Run | Cost |
|---|---|
| `regrade-8b-after` (52 records, era slice8b) | $0.3087 |
| `regrade-8c-after` (52 records, era current) | $0.3162 |
| **Task 5 total** | **$0.6249** |
| **Slice 8d total so far** | **$0.6249**, against the $5 no-ask ceiling |

## Reproducing this

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8b-threshold-counts/after --builder current \
  --handed-era slice8b --seed 20260814 \
  --out docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.json

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/after --builder current \
  --handed-era current --seed 20260814 \
  --out docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.json

node scripts/replay-grading.mjs \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.json \
  --handed-era slice8b

node scripts/replay-grading.mjs \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.json \
  --handed-era current
```

Both live commands spend real money (roughly $0.31 each, as measured here);
the two replay commands spend nothing.
