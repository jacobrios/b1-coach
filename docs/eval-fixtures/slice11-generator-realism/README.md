# Slice 11: did the rewritten generator make the coach worse?

Written 21 August 2026, at the close of Slice 11 Task 12. Three rounds of 64
graded debriefs live here. **This directory is a non-inferiority guard, not the
evidence that the slice worked.** The evidence that the slice worked is
deterministic and free, and it lives in `scripts/measure-swing-generation.mjs`
and the task reports under `.superpowers/sdd/slice-11-plan/`. What these rounds
are for is the one question those measurements cannot answer: whether making the
data honest broke the coach that reads it.

## What is in here

| directory | what it is | generator the coach saw | seed | bought |
|---|---|---|---|---|
| `before/` | Slice 10's 64 shipped debriefs, re-graded | pre-Slice-11, frozen | 20260814 | 20 Aug 2026 |
| `after-a/` | 64 fresh debriefs | post-Slice-11, live | 20260814 | 21 Aug 2026 |
| `after-b/` | 64 fresh debriefs | post-Slice-11, live | 20260819 | 21 Aug 2026 |

`before/` holds no coach prose of its own; it is a grading of
`../slice10-direction-key/after-spray/shipped-64.json`. It was re-graded rather
than quoted so that all three rounds pass through one generation of the
instrument, on one day. This project has been bitten once by comparing two
rounds graded by two generations of the tool (the Slice 8b false positives).

Each directory carries its own `BUILDER.txt`. Read it before re-grading
anything. The short version: `after-a` and `after-b` say `builder = current`,
and **"current" names the working tree**, so the moment any later slice changes
`src/swingGenerator.js` these two rounds are stranded exactly as Slice 9's and
Slice 10's were. The fix is a frozen snapshot and a new builder name, never an
edit to a marker.

## The exact commands

```
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed <20260814|20260819> \
  --out docs/eval-fixtures/slice11-generator-realism/<round>/shipped-64.json

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice11-generator-realism/<round> \
  --out docs/eval-fixtures/slice11-generator-realism/<round>/grading.json
```

`--validate` is not optional and its absence is not obvious: without it the
grading script refuses and exits 1 before making a single call. It failed safe
for Task 11 and the plan text still omits it. The builder and the seed are read
from each directory's own `BUILDER.txt` rather than passed as flags, and the
script refuses outright when a passed flag disagrees with the marker.

Measured spend: $1.19 and $1.20 for the two bench rounds, $0.4031 and $0.4241
for their gradings, plus $0.3882 for `before/` in Task 11. $3.61 in total.

## The numbers

Every figure below is computed from the three `grading.json` files, except the
costs, which are quoted from the runs.

| | before | after-a | after-b |
|---|---|---|---|
| debriefs graded | 64 | 64 | 63 of 64 |
| claims found | 544 | 564 | 624 |
| TRUE | 402 | 384 | 465 |
| FALSE | 19 | 20 | 25 |
| UNVERIFIABLE | 123 | 160 | 134 |
| unstructurable | 57 | 78 | 75 |
| flagged debriefs | 13 | 19 | 16 |
| FALSE, handed a number | 13 | 3 | 16 |
| FALSE, self-derived | 6 | 17 | 9 |
| attribution: handed / derived / no flag | 366 / 121 / 57 | 347 / 139 / 78 | 433 / 116 / 75 |

Per cell, claims / FALSE claims / flagged debriefs:

```
                before        after-a       after-b
  power-s1      106  2  2     112  0  0     111  1  1
  power-s2       65  3  2      58  2  2      65  2  2
  contact-s1     99  6  4     103  4  4      96  2  2
  contact-s4     71  3  2      67  3  3      84  5  3
  open-s4        59  0  0      73  2  2      93  3  2
  allfields-s4   72  2  1      65  6  5      97 11  5
  popup-s4       72  3  2      86  3  3      78  1  1
```

**`after-b` graded 63 debriefs, not 64.** One record, `contact-s1/run7`,
produced no claims because the *grading* model's reply was not valid JSON. The
coach's own debrief for that run is intact: all five fields present, 64 words in
the box. This is an extraction failure on the instrument side, not a coach
failure, and it means round B's claim total is drawn from 63 debriefs while the
other two rounds draw from 64.

## What is safe to conclude

- **The coach did not stop working.** 128 of 128 live calls returned a parseable
  debrief, and 0 of 128 were missing a required field. Zero parse failures is
  the expectation rather than a triumph, but it is not automatic: a previous
  slice found 14 of 36 calls failing to parse and that was the finding of the
  slice.
- **The coach did not get vaguer.** Grounded citations per debrief went 5.23
  (before) to 6.34 (after-a) and 7.05 (after-b); unmatched citations went 0.13
  to 0.00 and 0.03; length is flat, at 66.9 / 65.0 / 69.6 words in the summary
  box. Read `grounded` as a citation *density* measure and nothing stronger:
  this project has already recorded that the value sets it matches against do
  not discriminate evenly, so a grounded count is not proof against fabrication
  on its own.
- **Latency is unchanged**, at a median of 10.2s and 10.3s a debrief.

## What is NOT safe to conclude

- **No flag count in here is a coach error rate.** This tool's false-positive
  rate has measured 11, 42, 12.5, 34.5, 40, 61.9 and 43.5 percent across seven
  rounds, and each measurement wave has turned up failure mechanisms nobody had
  seen before. A raw flag is a lead. Task 13 hand-checks every flagged claim in
  all three rounds; until that exists, nothing here supports a statement about
  whether the coach got better or worse.
- **Do not read the flag delta as a signal.** Task 11 measured what the noise
  floor looks like: re-grading one *identical* round through a fresh extraction
  pass moved its flagged count from 17 to 13, and of the four flags that fell
  away, three had already been adjudicated false positives and one had been
  adjudicated a genuine coach error. The instrument moves in both directions on
  data that has not changed at all.
- **The handed-versus-derived split swings hard between the two seeds and should
  not be quoted from either alone.** `after-a` reports 3 FALSE claims on numbers
  the prompt handed the coach against 17 it derived itself; `after-b` reports 16
  against 9, which is the opposite shape. Both cannot be a property of the
  slice. This is the clearest argument in the directory for having bought two
  seeds rather than one.
- **`after-b` has no seed-matched before side.** Only `after-a` pairs with
  `before`. `after-b` exists to show whether `after-a` is one draw or a result,
  and it is read that way rather than as a second comparison.

## The pop-up change is nearly invisible here, by design and by prediction

Slice 11 item (c) was that Reduce Pop-Ups named a failure that could not happen:
the old generator clamped launch angle at exactly 35 and the goal calls a pop-up
anything above 35, so the coach was handed "0 swings" forever. The fix produces
**0.394 pop-ups per session, measured across 400 seeds and 18,000 swings**. That
deterministic figure is the evidence the fix landed.

These rounds cannot add to it, and that was measured before the money was spent.
The bench builds each cell's sessions once, outside the run loop, and the four
session-4 cells are 89 percent correlated, so a whole 64-call round sees only a
handful of distinct pop-up draws. Rebuilding the exact sessions behind these
cells confirms it: across the 13 generated session blocks the bench cells use,
seed 20260814 contains **0** pop-ups and seed 20260819 contains **5**. So
`after-a` reproduces the very "0 swings" string item (c) complained about. **Do
not read that as the fix failing.** It is ordinary sampling at one seed, and
Task 14's browser pass is where a visitor-facing pop-up is actually looked at.

## What the coach can now say that it could not have said honestly before

The old generator drew the pitch and the outcome independently, so its
strike-versus-ball exit velocity gap was 0.0 mph across 4,000 sessions. Since
Slice 8c the coach has been handed which pitches were outside the zone and has
reasoned about them out loud, which means every such sentence on a generated
session was a coincidence. Measured on the exact sessions these cells were built
from, 13 generated session blocks and 195 swings each:

```
seed 20260814  builder slice11-before  strike EV 82.69 (n=135)  ball EV 81.28 (n=60)  gap 1.41 mph  pop-ups 0
seed 20260814  builder current         strike EV 83.91 (n=126)  ball EV 81.13 (n=69)  gap 2.78 mph  pop-ups 0
seed 20260819  builder slice11-before  strike EV 81.05 (n=148)  ball EV 80.04 (n=47)  gap 1.00 mph  pop-ups 0
seed 20260819  builder current         strike EV 84.16 (n=121)  ball EV 79.78 (n=74)  gap 4.37 mph  pop-ups 5
```

Fifteen-swing sessions are noisy and these are small samples; the population
figure the slice aimed at is 4.5 mph. What the rounds show is the coach using
it. Chase-and-reach language appears in 35 of 64 before-round debriefs against
44 and 53 in the two after rounds, and pop-up language in 9 against 8 and 13,
tracking the seeds' actual pop-up counts. The sentence shape that could not have
been true before is visible in `after-b/shipped-64.json`, `popup-s4/run1`:

> You're controlling the barrel well on strikes, but chasing pitches up and out
> of the zone is costing you velocity and popping the ball up.

That single sentence needs both a real link from pitch location to contact
quality and pop-ups that can occur at all. Neither existed in the old generator.
Note carefully what this is and is not: it is evidence the coach now *talks
about* a relationship that is now real, not evidence that any particular
sentence is accurate. Accuracy is Task 13's question.

> *Added 21 August 2026, Task 13, and it answers the sentence just above.* Every
> flagged claim in all three rounds is now adjudicated one at a time in
> `HAND-CHECK.md` beside this file. **The headline: the coach did not get
> worse.** Hand-checked, the rounds carry 12, 14 and 9 genuine error claims, or
> 2.85%, 3.47% and 1.84% of the claims the tool could rule on, all inside the 8
> to 19 errors and 1.8 to 3.8 percent this project has measured as
> same-condition noise. The two after seeds differ from each other by more than
> either differs from before. The tool's false-positive rate on these rounds was
> 36.8%, 30.0% and **64.0%**, the last being the highest ever recorded here, and
> five failure mechanisms had never been seen before, four of them about pitch
> location. **Read no number out of any `grading.json` in this directory without
> reading `HAND-CHECK.md` first.** The `popup-s4/run1` debrief quoted above was
> checked claim by claim and is entirely accurate; the one flag against it is a
> tool error.

## Reproducing this

Both commands spend real money and neither is needed to read the result. A
future session that does re-run a round must not overwrite these files: the
comparison depends on these particular draws, and re-running produces different
ones.
