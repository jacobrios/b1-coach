# Hand-check: every flagged claim in Slice 11's three rounds

Written 21 August 2026, Slice 11 Task 13. Three rounds, 64 flagged claims,
adjudicated one at a time. Each is ruled **GENUINE** (the coach really was
wrong) or **FALSE POSITIVE** (the grading tool was wrong), with the coach's own
sentence quoted, the ground truth it should have matched, and the mechanism
named.

**The standing rule this document exists to honour: a raw flag is a lead, not a
finding.** This project has measured this tool's false-positive rate at 11%,
42%, 12.5%, 34.5%, 40%, 61.9% and 43.5% across seven previous rounds. Nothing in
`grading.json` reaches a report without a by-hand read.

| | `before/` | `after-a/` | `after-b/` |
|---|---|---|---|
| Generator the coach saw | pre-Slice-11, frozen | post-Slice-11 | post-Slice-11 |
| Seed | 20260814 | 20260814 | 20260819 |
| Builder used to rebuild ground truth | `slice11-before` | `current` | `current` |
| Debriefs graded | 64 | 64 | 63 of 64 |
| Claims found | 544 | 564 | 624 |
| Ruled on (TRUE plus FALSE) | 421 | 404 | 490 |
| Raw FALSE flags | 19 | 20 | 25 |
| Flagged debriefs | 13 | 19 | 16 |

Every row above is computed from the three `grading.json` files in this
directory, not transcribed from a printed report.

## How ground truth was rebuilt

Each round's sessions were rebuilt through the grader's own exported
`resolveSessions`, using the builder and seed each round's `grading.json`
records in its own `meta` block, and the prompt the coach actually read was
rebuilt with `buildDebriefUserMessage` from `src/coachApi.js`. So "handed to the
coach" versus "worked out by the coach" is decided against the real prompt text
rather than assumed.

The builder matters more here than in any previous hand-check in this
repository. `before/` grades prose written about the **frozen pre-Slice-11
generator**; both after rounds grade prose written about the **rewritten** one.
Rebuilding either through the other's builder would produce a complete and
entirely plausible fact sheet for swings no coach ever saw. Three tasks of this
slice exist to close that trap, and this document is downstream of them.

Two cheap confirmations that the reconstruction is the right one. First,
`scripts/bench-coach-brevity.mjs` and `scripts/grade-coach-accuracy.mjs` build
sessions with byte-identical code: a fresh `mulberry32(seed)` per cell, session
1 as the baseline, then `generateSwings({ sessionNum, goalId, baselineSwings,
random })` for each later session. Second, if the reconstruction were wrong the
rounds would not have ruled 402, 384 and 465 claims TRUE.

## Two conventions that decide several rulings

`DISTANCE_BUCKETS` in `src/ballFlight.js` is half-open (`dist >= min && dist <
max`), so a ball at exactly 305 feet belongs to `305+` and not to `265-305`.
`SPRAY_CUTOFFS` in `src/sessionStats.js` is `{ pull: -15, oppo: 15 }`, strict on
both sides.

## One declared deviation, so nobody thinks it was an oversight

This project's standing rule bans em dashes and en dashes in written output.
Every line of my own prose here obeys it. **Quoted coach sentences are verbatim
and unaltered**, and the coach uses em dashes freely, so they appear inside
quotation marks. Editing a quote to satisfy a formatting rule would break the
rule that matters far more in this document: nothing enters a quoted block that
was not copied out of a run or a committed file. The same choice was made in
`../slice10-direction-key/HAND-CHECK-after-spray.md`.

---

# The bottom line

**The coach did not get worse.** Hand-checked, the three rounds carry 12, 14 and
9 genuine error claims, which is 2.85%, 3.47% and 1.84% of the claims the tool
was able to rule on. This project's demonstrated same-condition spread, measured
across earlier slices, is 8 to 19 genuine errors and 1.8 to 3.8 percent of ruled
claims. **All three rounds sit inside that band**, and the two after rounds
straddle the before round in opposite directions.

| | before | after-a | after-b |
|---|---|---|---|
| Raw FALSE flags | 19 | 20 | 25 |
| **GENUINE coach errors** | **12** | **14** | **9** |
| **FALSE POSITIVES** | **7** | **6** | **16** |
| Tool false-positive rate | **36.8%** | **30.0%** | **64.0%** |
| Genuine as a share of ruled claims | 2.85% | 3.47% | 1.84% |
| Distinct genuine errors (merging sentences flagged twice) | 9 | 14 | 9 |
| Debriefs carrying a genuine error | 8 of 64 (12.5%) | 14 of 64 (21.9%) | 9 of 63 (14.3%) |
| Debriefs flagged only falsely | 5 | 5 | 7 |

**The sharpest thing in that table is that the two after rounds disagree with
each other by more than either disagrees with the before round.** 14 genuine
against 9, at the two seeds, on the same code and the same prompt. Either seed
read alone would support a confident story: `after-a` that the rewrite cost the
coach accuracy, `after-b` that it improved it. Neither story survives the other
seed. That is the third time in this project a single-seed excursion would have
been reported as a result, and it is what the second seed was bought to prevent.

**Two of `after-a`'s 14 are the weakest genuine errors in the wave** (claims 1
and 2 below, a self-chosen range of "2.9 to 3.2 feet" that excludes a 3.23-foot
pitch by three hundredths). They are ruled GENUINE for consistency with this
project's own precedent on strict boundaries, but a reader who discounts them
gets `after-a` at 12 genuine and 2.97% of ruled claims, which is indistinguishable
from the before round's 12 and 2.85%. Stated so the bottom line does not rest on
the two most arguable rulings in it.

## What the comparison is not

**It is not like-for-like, and this must be stated rather than assumed.** The
before round's coach was reading the old generator's data. The after rounds'
coaches were reading data that changed in eight measured ways. The coach is
describing **different sessions**, not the same sessions differently.

What that permits: a non-inferiority read. If honest data had broken the coach
that reads it, the genuine error rate would have moved outside the band this
project has already measured for two rounds of the same condition. It did not,
at either seed.

What that forbids: reading any per-cell or per-round difference as a coach
behaviour change. A cell whose session-4 data happens to contain four wide
pitches will produce different sentences from a cell whose data contains two,
and that is a property of the draw, not of the coach.

## The raw flag delta is unusable, and this round proves it again

Task 11 measured the instrument's noise floor directly: re-grading one
**unchanged** round through a fresh extraction pass moved its flagged debrief
count from 17 to 13. Three of the four flags that fell away had already been
adjudicated false positives in Slice 10's hand-check, and the fourth had been
adjudicated a genuine coach error that the fresh pass simply missed. Noise in
both directions, on data that did not change.

This document reproduces that finding independently. The `before/` round is the
same 64 debriefs Slice 10 shipped. Slice 10's own hand-check of them found 13
genuine and 10 false positives out of 23 flags. Today's fresh extraction of the
identical prose gives 12 genuine and 7 false positives out of 19. **Those two
adjudications agree exactly**: 10 minus 3 false positives dropped, 13 minus 1
genuine dropped, matching the four records Task 11 named one by one. The coach
prose is byte-identical. The whole difference is one extraction pass.

## The pop-up work is invisible here, and that is expected

Rebuilding the exact bench sessions: seed 20260814 carries **zero** pop-ups
across its 13 session blocks and seed 20260819 carries **five**. So `after-a` is
written entirely about sessions with no pop-ups, and its `popup-s4` prompt hands
the coach the exact "0 swings" string the defect was about. That is sampling, not
the fix failing. The evidence the fix landed is a deterministic 0.394 pop-ups per
session across 18,000 swings, and it lives elsewhere. Round B does carry them, and
its `popup-s4/run1` debrief writes about the one pop-up correctly, which is
adjudicated as claim 25 below.

---

# Round 1: `before/`

Slice 10's `after-spray` prose, re-graded 21 August 2026 through today's
instrument, on the frozen pre-Slice-11 generator at seed 20260814. **19 flagged
claims across 13 of 64 debriefs.**

Session 1 is the hand-written `SESSION_ONE_SWINGS` and is identical in all three
rounds. Its values, as they reach the prompt:

```
Swing 1: 86mph EV, 22° LA, 13° direction, 272ft distance, pitch height 2.8ft / pitch side 0.2ft | Swing 2: 72mph EV, 8° LA, 11° direction, 122ft distance, pitch height 1.2ft / pitch side -0.3ft | Swing 3: 76mph EV, 19° LA, -24° direction, 192ft distance, pitch height 3.1ft / pitch side -0.5ft | Swing 4: 75mph EV, 13° LA, -9° direction, 159ft distance, pitch height 2.3ft / pitch side 0.9ft | Swing 5: 92mph EV, 27° LA, 29° direction, 346ft distance, pitch height 2.6ft / pitch side 0.4ft | Swing 6: 81mph EV, 24° LA, -9° direction, 249ft distance, pitch height 3.8ft / pitch side 0.1ft | Swing 7: 89mph EV, 15° LA, -22° direction, 246ft distance, pitch height 2.1ft / pitch side -0.6ft | Swing 8: 87mph EV, 20° LA, 24° direction, 266ft distance, pitch height 2.9ft / pitch side 0.3ft | Swing 9: 74mph EV, 24° LA, 21° direction, 201ft distance, pitch height 1.4ft / pitch side 0.5ft | Swing 10: 78mph EV, 22° LA, -6° direction, 219ft distance, pitch height 3.3ft / pitch side -0.4ft | Swing 11: 87mph EV, 14° LA, -5° direction, 229ft distance, pitch height 2.7ft / pitch side 0.6ft | Swing 12: 78mph EV, 2° LA, 17° direction, 117ft distance, pitch height 0.8ft / pitch side -0.2ft | Swing 13: 89mph EV, 25° LA, 7° direction, 311ft distance, pitch height 2.4ft / pitch side -0.3ft | Swing 14: 78mph EV, 19° LA, 8° direction, 204ft distance, pitch height 3.6ft / pitch side 0.8ft | Swing 15: 82mph EV, 6° LA, -20° direction, 156ft distance, pitch height 2.5ft / pitch side 0.1ft
```

---

## 1. power-s1 / run2, coachingSummary

**Coach:** "Jake, the bat speed is real — you topped out at 92 mph and had three
swings at 89 mph."

**Ground truth.** Exactly two swings hit 89 mph, swings 7 and 13. The prompt
hands "Top 3 exit velocities: 92, 89, 89 mph", which lists two.

**Verdict: GENUINE.** The handed "Top 3" line read as "three swings at 89".

## 2. power-s1 / run5, tip2

**Coach:** "Swings 2, 9, and 12 were all on pitches below 1.5 feet and all came
in under 78 mph."

**Ground truth.** The low-pitch set is handed verbatim as swings 2, 9, 12 and is
right. Their exit velocities are 72, 74 and **78**. 78 is not under 78, so two
of three.

**Verdict: GENUINE.** A value sitting exactly on the stated threshold placed on
the wrong side of it.

## 3. power-s2 / run3, coachingSummary

**Coach:** "five swings reached the 265-305 foot range"

**Ground truth.** Handed verbatim: Session 2 "265-305ft: 5 swings, 305+ft: 2
swings". The five are 301, 266, 287, 304 and 270 feet; the two 305-plus balls
are 305 and 312.

**Tool's ruling:** "distance between 265 and 305 inclusive: 6".

**Verdict: FALSE POSITIVE.** A handed distribution bucket re-derived with an
inclusive upper bound where the real one is half-open, sweeping the 305-foot ball
back in. Known mechanism, third appearance on this cell.

## 4 and 5. power-s2 / run4, coachingSummary (one sentence, flagged twice)

**Coach:** "you cut your under-175ft swings from 4 down to 1"

**Ground truth.** Handed verbatim in both sessions: Session 1 "Under 175ft: 4
swings", Session 2 "Under 175ft: 1 swing". Correct.

**Tool's ruling:** the "4" graded against Session 1's `underFifteenCount` of 5,
the "1" against Session 2's `underFifteenCount` of 3.

**Verdict: FALSE POSITIVE, twice.** The claim filed under the wrong statistic
entirely, a distance bucket ruled against a launch-angle count. This is the
textbook example already recorded in CLAUDE.md, on the cell it has always
occurred on.

## 6 and 7. contact-s1 / run1, tip1 (one sentence, flagged twice)

**Coach:** "Nine of your swings came out above 18 degrees, and a lot of those
were on pitches you had no business swinging at — like swings 6 and 14 on
pitches above 3.5 feet."

**Ground truth.** Handed verbatim: "Swings on pitches high (height above 3.5ft):
2 swings — numbers: 6, 14". Swing 6 is at 3.8 feet, swing 14 at 3.6. Both above
3.5. The lead-in count of nine is also right.

**Tool's ruling:** "swing 6 pitchHeight: 3.8 ... claimed 3.5".

**Verdict: FALSE POSITIVE, twice.** A restated threshold read as an exact value.

## 8. contact-s1 / run5, tip1

**Coach:** "Swings 6 and 14 were on pitches above 3.5 feet, and both came off
the bat over 19 degrees."

**Ground truth.** Swing 6 launch angle 24, swing 14 launch angle **19**. 19 is
not over 19.

**Verdict: GENUINE.** Same boundary shape as claim 2.

## 9. contact-s1 / run5, tip2

**Coach:** "Seven of your swings came in above 18 degrees"

**Ground truth.** Handed verbatim: "Swings with launch angle strictly above 18
degrees (not including 18): 9 swings". The same debrief's own summary says "Most
swings came in above 18 degrees".

**Verdict: GENUINE.** A handed count contradicted outright.

## 10. contact-s1 / run11, coachingSummary

**Coach:** "you touched 92 and had three swings at 89 mph"

**Ground truth.** Two swings at 89, as in claim 1.

**Verdict: GENUINE.** The handed "Top 3" line misread the same way, in a
different cell.

## 11. contact-s1 / run12, tip1

**Coach:** "Nine of your swings came off the bat above 18 degrees, including
swings 1, 5, 6, 8, and 13 — those are fly balls, not line drives."

**Ground truth.** The count of nine is handed and right. Swings 1, 5, 6, 8 and
13 have launch angles 22, 27, 24, 20 and 25. All five are genuinely above 18.
The word "including" makes the list illustrative.

**Tool's ruling:** "the count matches but the named swings do not".

**Verdict: FALSE POSITIVE.** An illustrative list read as exhaustive.

## 12. contact-s4 / run5, tip2

**Coach:** "Six of your swings came in under 85 mph, and five of those went
under 225 feet."

**Ground truth.** The prompt says "Swings with exit velocity 85 mph or higher: 6
swings". Nine swings were under 85. The coach copied the handed 6 correctly and
inverted the sentence around it.

**Verdict: GENUINE.** A handed count attached to the opposite side of its own
threshold. This is the error family that pre-counting structurally cannot fix,
and it already has its own entry on the What's Next list.

## 13 and 14. contact-s4 / run6, tip2 (one sentence, flagged twice)

**Coach:** "Swings 4 and 5 went 248 and 247 feet at 88 and 86 mph with launch
angles of 18 and 16 degrees"

**Ground truth.** Swing 4 is 86 mph, 18 degrees, 248 feet. Swing 5 is 88 mph, 16
degrees, 247 feet. The distances and the launch angles are in the right order.
The two exit velocities are swapped.

**Verdict: GENUINE, twice.** Two handed values recited in the wrong order.

## 15 and 16. allfields-s4 / run1, coachingSummary (one sentence, flagged twice)

**Coach:** "your exit velocity dropped to 79 mph this round, down from 83 and 84
in Sessions 2 and 3"

**Ground truth.** Session 2 average exit velocity is 84, Session 3 is 83. Both
handed. Swapped.

**Verdict: GENUINE, twice.** Same shape as claims 13 and 14.

## 17 and 18. popup-s4 / run3, tip2 (one sentence, flagged twice)

**Coach:** "Swings 10 and 12 both came in at 5 and 9 degrees on pitches right in
the zone at 2.08 and 1.92 feet"

**Ground truth.** Swing 10 is 9 degrees at 2.08 feet; swing 12 is 5 degrees at
1.92 feet. The pitch heights are in swing order. The launch angles are swapped.

**Verdict: GENUINE, twice.** Same shape again, and it is the third instance in
this round.

## 19. popup-s4 / run6, tip2

**Coach:** "Swings 12 and 10 both came in at 5 and 9 degrees — just outside your
target zone on the low end — and both were on pitches in the zone."

**Ground truth.** Swing 12 is 5 degrees, swing 10 is 9 degrees. Listed in the
order 12 then 10, the values 5 then 9 are **correct**. This is the same data as
claims 17 and 18 with the pair named the other way round, and it is right.

**Tool's ruling:** "0 of swings 12, 10 are equal 0 launchAngle", a subset test
against a threshold of zero that the coach never mentioned.

**Verdict: FALSE POSITIVE.** A per-swing value recital re-cast as a subset test.

## Round 1 summary

| | Count |
|---|---|
| Flagged claims adjudicated | 19 |
| **GENUINE** | **12** |
| **FALSE POSITIVE** | **7** |
| False-positive rate | **36.8%** |

**8 of 64 debriefs carry a genuine error** (12.5%): power-s1 runs 2 and 5,
contact-s1 runs 5 and 11, contact-s4 runs 5 and 6, allfields-s4 run1, popup-s4
run3. **5 were flagged only falsely**: power-s2 runs 3 and 4, contact-s1 runs 1
and 12, popup-s4 run6. The 12 genuine claims collapse to **9 distinct coach
errors**, because three sentences were each flagged twice.

---

# Round 2: `after-a/`, seed 20260814

64 fresh debriefs against the rewritten generator. **20 flagged claims across 19
of 64 debriefs.**

Two blocks of ground truth carry most of this round. Session 2 of `power-s2`:

```
Swing 4: 88mph EV, 29° LA, -11° direction, 316ft distance, pitch height 2.92ft / pitch side 0.38ft | Swing 5: 88mph EV, 26° LA, -31° direction, 310ft distance, pitch height 3.23ft / pitch side -0.34ft | Swing 8: 89mph EV, 32° LA, -33° direction, 304ft distance, pitch height 3.02ft / pitch side -0.12ft
```

And session 4 of `open-s4`, `allfields-s4` and `popup-s4`, which is one shared
draw:

```
Swing 1: 78mph EV, 18° LA, -39° direction, 199ft distance, pitch height 1.79ft / pitch side -0.04ft | Swing 2: 77mph EV, 7° LA, 7° direction, 140ft distance, pitch height 1.87ft / pitch side 1.38ft | Swing 3: 84mph EV, 26° LA, -7° direction, 281ft distance, pitch height 3.15ft / pitch side -0.76ft | Swing 4: 91mph EV, 26° LA, 34° direction, 332ft distance, pitch height 2.82ft / pitch side 0.48ft | Swing 5: 86mph EV, 9° LA, -42° direction, 192ft distance, pitch height 1.16ft / pitch side 0.08ft | Swing 6: 84mph EV, 18° LA, 22° direction, 236ft distance, pitch height 1.12ft / pitch side -0.11ft | Swing 7: 92mph EV, 28° LA, -38° direction, 353ft distance, pitch height 3.07ft / pitch side 0.17ft | Swing 8: 77mph EV, 13° LA, 33° direction, 169ft distance, pitch height 3.19ft / pitch side -0.79ft | Swing 9: 82mph EV, 19° LA, -28° direction, 229ft distance, pitch height 2.84ft / pitch side -0.14ft | Swing 10: 82mph EV, 16° LA, 14° direction, 213ft distance, pitch height 3.26ft / pitch side 0.08ft | Swing 11: 78mph EV, 16° LA, -8° direction, 190ft distance, pitch height 2.21ft / pitch side -0.57ft | Swing 12: 84mph EV, 12° LA, -34° direction, 200ft distance, pitch height 3.17ft / pitch side 0.75ft | Swing 13: 88mph EV, 15° LA, -10° direction, 241ft distance, pitch height 1.78ft / pitch side 0.51ft | Swing 14: 82mph EV, 22° LA, 17° direction, 245ft distance, pitch height 2.78ft / pitch side -0.28ft | Swing 15: 76mph EV, 20° LA, -39° direction, 197ft distance, pitch height 3.25ft / pitch side -0.01ft
```

The prompt hands "Swings on pitches wide (side outside -0.7 to 0.7ft): 4 swings
— numbers: 2, 3, 8, 12" for that session. Those four have exit velocities 77,
84, 77 and 84, and distances 140, 281, 169 and 200 feet. **Six of this round's
fourteen genuine errors are one sentence about that group of four swings**,
written in six different debriefs across three cells.

---

## 1. power-s2 / run1, tip2

**Coach:** "Swings 4, 5, and 8 all hit 88 mph or better with launch angles
between 26 and 32 degrees, and every one of those was on a pitch between 2.9 and
3.2 feet — right in the middle of the zone."

**Ground truth.** The exit velocities (88, 88, 89) and launch angles (29, 26,
32) are both right. Pitch heights are 2.92, **3.23** and 3.02. Swing 5 is above
the coach's own upper bound.

**Verdict: GENUINE, and the weakest genuine ruling in this document.** The coach
chose the range itself and one member misses it by 0.03 feet. Ruled genuine for
consistency with claims 2 and 8 of round 1, where a value sitting exactly on a
stated threshold was ruled genuine. A reader who prefers to treat this as
rounding should discount it and claim 2 below.

## 2. power-s2 / run7, tip2

**Coach:** "Your three power zone swings in Session 2 — swings 4, 5, and 8 — all
came on pitches between 2.3 and 3.2 feet high, right in the heart of the zone."

**Ground truth.** The power zone count of three is handed and right, and swings
4, 5 and 8 are the three. Pitch height 3.23 again exceeds the coach's own 3.2.

**Verdict: GENUINE, same weak shape as claim 1**, on the same cell one run
apart.

## 3. contact-s1 / run2, tip2

**Coach:** "Nine of your fifteen swings came out above 18 degrees, so the ball
is getting under too much at contact."

**Ground truth.** Handed verbatim: "Swings with launch angle strictly above 18
degrees (not including 18): 9 swings". Correct.

**Tool's ruling:** the extractor recorded `statedSwings` as `[1,2,3,...,15]` and
then reported "the count matches but the named swings do not".

**Verdict: FALSE POSITIVE.** **A new variant.** This project already records the
denominator of an "N out of fifteen" phrase being absorbed as the numeric
*threshold*. Here it is absorbed as the *named-swing list*, which then trips the
named-swing check. Note that the M4 fix from Slice 9, which requires a non-empty
`statedSwings`, cannot catch this: the list is non-empty, it is just fabricated
from the denominator.

## 4, 5 and 6. contact-s1 runs 5, 7 and 11, tip1 (three debriefs, one sentence shape)

**Coach, run 5:** "Swings 7 and 11 were your cleanest — 89 mph each, launch
angles of 15 and 14 degrees, right in the target window."

**Coach, run 7:** "Swings 7 and 11 were your best of the session — 89 mph each,
launch angles of 15 and 14 degrees, right in the line drive window."

**Coach, run 11:** "Swings 7 and 11 were your best of the session — 89 mph each,
launch angles of 15 and 14 degrees, both right in the line drive window."

**Ground truth.** Swing 7 is 89 mph at 15 degrees. Swing 11 is **87** mph at 14
degrees. The launch angles are right in all three; the exit velocity is wrong in
all three.

**Verdict: GENUINE, three times.** A per-swing value collapsed across a named
pair whose members differ. **Worth noting for the bottom line: this is session
1, which Slice 11 did not touch.** The identical pair is described correctly in
round 1's contact-s1 run11 ("89 and 87 mph") and in round 3's contact-s1 run10.
It is coach variance on unchanged data, not a consequence of the rewrite.

## 7. contact-s4 / run3, tip1

**Coach:** "You hit 7 balls to the opposite field in Session 4, up from 3 in
Session 3 and 4 in Session 1."

**Ground truth.** Session 4 oppo is handed as 7 and Session 1 as 4, both right.
Session 3's handed line reads "Swings opposite field (direction strictly above
+15 degrees, not including +15): 4 swings — numbers: 4, 6, 8, 14". The coach
said 3.

**Verdict: GENUINE.** A handed count contradicted outright.

## 8. contact-s4 / run4, tip2

**Coach:** "Seven of your 15 swings went opposite field, and your exit velocity
on those ranged from 75 to 92 mph — that 92 on swing 8 at 19 degrees is exactly
what a line drive looks like."

**Ground truth.** Session 4 of `contact-s4` hands seven opposite-field swings (3,
5, 6, 7, 8, 9, 15) whose exit velocities are 92, 89, 78, 75, 92, 79 and 84. The
range 75 to 92 is exactly right, and swing 8 is 92 mph at 19 degrees.

**Tool's ruling:** "exitVelocity between 75 and 92 inclusive: 14".

**Verdict: FALSE POSITIVE.** A named subset checked against a whole-session
total.

## 9. contact-s4 / run8, tip1

**Coach:** "The problem is your opposite field swings, 7 of them, produced exit
velos mostly in the 75-84 mph range"

**Ground truth.** Seven opposite-field swings is handed and right. Four of the
seven fall in 75 to 84, which is what "mostly" claims.

**Tool's ruling:** "exitVelocity between 75 and 84 inclusive: 8", reading the
"7 of them" as the count inside the range.

**Verdict: FALSE POSITIVE.** A named subset checked against a whole-session
total, compounded by the hedge "mostly" being read as an exact count.

## 10. open-s4 / run2, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all off the side of the plate, and none
of them did much damage — 77, 84, 77, and 84 mph with the ball landing between
140 and 200 feet on the worst of them."

**Ground truth.** The four wide swings are handed. Their exit velocities are 77,
84, 77 and 84 in exactly that order. The three the coach calls "the worst of
them" landed at 140, 169 and 200 feet.

**Tool's ruling:** "distance between 140 and 200 inclusive: 7", against a
`statedCount` of 1 that the coach never wrote.

**Verdict: FALSE POSITIVE.** Named subset against a whole-session total, with the
hedge "on the worst of them" dropped in extraction.

## 11. open-s4 / run3, tip1

**Coach:** "You swung at 4 pitches wider than 0.7 feet off the plate in Session
4 — swings 2, 3, 8, and 12 — after swinging at zero wide pitches in Session 2."

**Ground truth.** Handed verbatim: "Swings on pitches wide (side outside -0.7 to
0.7ft): 4 swings — numbers: 2, 3, 8, 12". Session 2's handed wide count is 0.
Both halves right.

**Tool's ruling:** "pitchSide above 0.7: 2 (swings 2, 12)".

**Verdict: FALSE POSITIVE.** **A new mechanism:** a two-sided handed band, "side
outside -0.7 to 0.7", re-derived as a one-sided signed comparison, which discards
the two swings that were wide on the negative side.

## 12. allfields-s4 / run3, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all on pitches wide of the zone, and
three of those four came in under 84 mph."

**Ground truth.** Their exit velocities are 77, 84, 77, 84. Two are under 84.

**Verdict: GENUINE.**

## 13. allfields-s4 / run4, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all on pitches outside the zone by side,
and three of those four came off the bat under 85 mph."

**Ground truth.** All **four** are under 85.

**Verdict: GENUINE**, and note it errs in the opposite direction from claim 12
on the identical four swings.

## 14. allfields-s4 / run5, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all on pitches wide of the zone, and
three of those four came off the bat under 85 mph."

**Ground truth.** Four of four.

**Verdict: GENUINE.**

## 15. allfields-s4 / run6, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all wide of the zone, and three of those
four came off the bat under 84 mph."

**Ground truth.** Two of four.

**Verdict: GENUINE.**

## 16. allfields-s4 / run7, tip1

**Coach:** "You chased four pitches that were well off the side of the plate —
swings 2, 3, 8, and 12 — and three of those came in under 84 mph."

**Ground truth.** Two of four.

**Verdict: GENUINE.**

## 17. allfields-s4 / run7, tip2

**Coach:** "When you get a pitch between 1.5 and 3.5 feet and inside 0.7 feet,
trust your swing, stay tall through contact, and drive it."

**Ground truth.** This is a coaching instruction naming the strike zone. It
asserts no count about the session at all.

**Tool's ruling:** "pitchHeight between 1.5 and 3.5 inclusive: 13", against a
`statedCount` of 1.

**Verdict: FALSE POSITIVE.** **A new mechanism:** a prescriptive coaching cue
extracted as a factual count claim. Nothing in the sentence is checkable, and
nothing in it was wrong.

## 18. popup-s4 / run1, tip1

**Coach:** "You swung at four pitches off the side of the plate in Session 4 —
swings 2, 3, 8, and 12 — and three of those four came in under 84 mph."

**Ground truth.** Two of four.

**Verdict: GENUINE.**

## 19. popup-s4 / run4, tip1

**Coach:** "Swings 2, 3, 8, and 12 were all on pitches outside the zone by side,
and three of those four went under 200 feet."

**Ground truth.** Their distances are 140, 281, 169 and **200** feet. 200 is not
under 200, so two of four.

**Verdict: GENUINE.** Boundary shape, on the same group of four swings.

## 20. popup-s4 / run8, coachingSummary

**Coach:** "Jake, you finished clean — zero pop-ups, zero weak grounders across
all four sessions."

**Ground truth.** Session 1's handed line reads "Swings hit as weak grounders
(launch angle strictly below 5 degrees, not including 5): 1 swing". Swing 12 of
session 1 is at 2 degrees. Sessions 2, 3 and 4 are all zero, so the pop-up half
is right and the weak-grounder half is not.

**Verdict: GENUINE.** A handed count contradicted outright.

## Round 2 summary

| | Count |
|---|---|
| Flagged claims adjudicated | 20 |
| **GENUINE** | **14** |
| **FALSE POSITIVE** | **6** |
| False-positive rate | **30.0%** |

**14 of 64 debriefs carry a genuine error** (21.9%). **5 were flagged only
falsely**: contact-s1 run2, contact-s4 runs 4 and 8, open-s4 runs 2 and 3. No
sentence was flagged twice, so the 14 genuine claims are 14 distinct errors.

**The dominant story of this round is one sentence.** Seven of the fourteen
genuine errors are the coach counting a subset of the four wide-pitch swings in
one shared session-4 draw, and six of those seven are the same "three of those
four came in under 84 or 85 mph" construction. It is right on none of them: the
true answer is 2 at a threshold of 84 and 4 at a threshold of 85, and the coach
writes 3 either way. This is the self-derived-subset-over-pitch-location error
class that CLAUDE.md already tracks as open, arriving in bulk because the
rewritten generator gave the coach a real reason to talk about wide pitches.

---

# Round 3: `after-b/`, seed 20260819

64 fresh debriefs against the rewritten generator at a second seed. One record,
`contact-s1/run7`, failed to grade because the grading model's reply was not
valid JSON, so the denominator is 63. **25 flagged claims across 16 of 63
debriefs.**

Session 4 of `contact-s4`, `open-s4`, `allfields-s4` and `popup-s4` is one
shared draw and carries most of this round:

```
Swing 1: 75mph EV, 21° LA, -41° direction, 195ft distance, pitch height 3.27ft / pitch side 0.4ft | Swing 2: 76mph EV, 12° LA, -44° direction, 159ft distance, pitch height 1.75ft / pitch side -0.85ft | Swing 3: 85mph EV, 12° LA, -25° direction, 206ft distance, pitch height 1.45ft / pitch side -0.26ft | Swing 4: 83mph EV, 14° LA, 7° direction, 207ft distance, pitch height 3.11ft / pitch side -0.37ft | Swing 5: 74mph EV, 43° LA, 24° direction, 152ft distance, pitch height 3.82ft / pitch side -0.28ft | Swing 6: 89mph EV, 23° LA, 25° direction, 298ft distance, pitch height 2.92ft / pitch side 0.62ft | Swing 7: 74mph EV, 17° LA, 12° direction, 171ft distance, pitch height 1.86ft / pitch side -1.46ft | Swing 8: 82mph EV, 20° LA, -4° direction, 235ft distance, pitch height 1.82ft / pitch side 0.67ft | Swing 9: 77mph EV, 23° LA, 8° direction, 217ft distance, pitch height 3.66ft / pitch side 0.68ft | Swing 10: 75mph EV, 7° LA, 0° direction, 131ft distance, pitch height 1.42ft / pitch side -0.44ft | Swing 11: 88mph EV, 28° LA, 21° direction, 323ft distance, pitch height 1.96ft / pitch side 0.25ft | Swing 12: 85mph EV, 18° LA, -12° direction, 242ft distance, pitch height 3.31ft / pitch side -0.64ft | Swing 13: 84mph EV, 17° LA, 3° direction, 230ft distance, pitch height 2.76ft / pitch side -0.64ft | Swing 14: 78mph EV, 12° LA, -17° direction, 170ft distance, pitch height 3.1ft / pitch side -0.4ft | Swing 15: 87mph EV, 14° LA, 25° direction, 229ft distance, pitch height 2.43ft / pitch side -0.59ft
```

Its handed pitch-location lines read: outside the zone 6 swings (2, 3, 5, 7, 9,
10); high 2 swings (5, 9); low 2 swings (3, 10); wide 2 swings (2, 7). Swing 5
is this round's one pop-up, at 43 degrees.

---

## 1. power-s1 / run10, tip2

**Coach:** "Swings 2, 4, and 12 all came in under 13 degrees launch angle on
pitches at or below the zone, and none broke 160 feet."

**Ground truth.** Session 1 launch angles: swing 2 is 8, swing 4 is **13**, swing
12 is 2. 13 is not under 13.

**Verdict: GENUINE.** Boundary shape. The distances (122, 159, 117) are right.
The "pitches at or below the zone" half is also wrong, since swing 4's pitch is
at 2.3 feet, and the tool did not flag that half at all; it is recorded below
with the other unflagged errors.

## 2. power-s2 / run5, tip1

**Coach:** "Swings 9, 10, 12, 14, and 15 were all on pitches below 1.5 feet, and
four of those five came off the bat under 84 mph."

**Ground truth.** The low-pitch set is handed as swings 9, 10, 12, 14, 15 and is
right. Their exit velocities are **84**, 82, 79, 71 and 86. Three are under 84.
The coach's four is what you get by counting 84 itself.

**Verdict: GENUINE.** Boundary shape again.

## 3. power-s2 / run7, tip1

**Coach:** "You swung at five pitches below 1.5 feet, and those gave you launch
angles of 24, 20, 25, 11, and 7 degrees with exit velos ranging from 71 to 86
mph."

**Ground truth.** Swings 9, 10, 12, 14, 15 have launch angles 24, 20, 25, 11 and
7, in exactly that order, and exit velocities 84, 82, 79, 71 and 86, whose range
is 71 to 86. Every number is right.

**Tool's ruling:** "exitVelocity between 71 and 86 inclusive: 12".

**Verdict: FALSE POSITIVE.** A named subset checked against a whole-session
total.

## 4. contact-s1 / run9, tip2

**Coach:** "Your two cleanest in-zone swings were 7 and 11, both at 89 mph with
launch angles of 15 and 14 degrees — right in the target window."

**Ground truth.** Swing 11 is 87 mph.

**Verdict: GENUINE.** Same shape as round 2's claims 4, 5 and 6, on the same
unchanged session-1 pair.

## 5. contact-s1 / run10, tip2

**Coach:** "Swings 7 and 11 were both in the zone, both hit hard at 89 and 87
mph, and both came off at 15 and 14 degrees — right in the line drive window."

**Ground truth.** Swing 7 is 89 mph at 15 degrees on a pitch at 2.1 feet and
-0.6 side; swing 11 is 87 mph at 14 degrees at 2.7 feet and 0.6 side. Both in the
zone. Every number right, in order.

**Tool's ruling:** "1 of swings 7, 11 are equal 89 exitVelocity".

**Verdict: FALSE POSITIVE.** A per-swing value recital re-cast as a subset test,
collapsing "89 and 87" into a single threshold of 89.

## 6 and 7. contact-s4 / run1, tip1 (one phrase, flagged twice)

**Coach:** "including swings 5 and 9 on pitches above 3.5 feet"

**Ground truth.** Handed verbatim: "Swings on pitches high (height above 3.5ft):
2 swings — numbers: 5, 9". Swing 5 is at 3.82 feet, swing 9 at 3.66.

**Verdict: FALSE POSITIVE, twice.** A restated threshold read as an exact value.

## 8. contact-s4 / run1, tip1

**Coach:** "those came off the bat at 74 mph each with launch angles of 43 and
23 degrees"

**Ground truth.** Swing 5 is 74 mph, swing 9 is **77**. The launch angles, 43 and
23, are right.

**Verdict: GENUINE.** A per-swing value collapsed across a named pair.

## 9. contact-s4 / run6, tip2

**Coach:** "including swings 5 and 9 on pitches above 3.5 feet, and those two
came off the bat at 74 mph with launch angles of 43 and 23 degrees"

**Ground truth.** Same as claim 8. Swing 9 is 77 mph.

**Verdict: GENUINE.**

## 10. contact-s4 / run7, tip2

**Coach:** "Your avg exit velocity dropped to 81 mph in Session 4 after climbing
from 82 to 83 to 84"

**Ground truth.** The four handed session averages are 82, 83, 84 and 81, for
sessions 1, 2, 3 and 4. The sentence is exactly right.

**Tool's ruling:** the "82" graded against **Session 2's** average of 83.

**Verdict: FALSE POSITIVE.** **A new mechanism, in a known family.** This project
records an ordinal phrase being read as a swing index. Here a three-value
session sequence is misaligned by one when session numbers are assigned, so
every value in the sequence is compared against its neighbour.

## 11. open-s4 / run7, tip1

**Coach:** "including swings 5 and 9 up at 3.82 and 3.66 feet — both came off
your bat under 77 mph"

**Ground truth.** Swing 5 is 74 mph, swing 9 is **77**. 77 is not under 77. The
two pitch heights are quoted exactly right.

**Verdict: GENUINE.** Boundary shape.

## 12 and 13. open-s4 / run8, tip1 (one sentence, flagged twice)

**Coach:** "You swung at swings 2 and 7 on pitches 0.85 and 1.46 feet wide of
the plate. Those two alone produced 76 and 74 mph."

**Ground truth.** The handed wide list is swings 2 and 7. Their `pitchSide`
values are **-0.85** and **-1.46**, so both are 0.85 and 1.46 feet off the plate
on the same side. The exit velocities 76 and 74 are right.

**Tool's ruling:** "swing 2 pitchSide: -0.85 ... claimed 0.85".

**Verdict: FALSE POSITIVE, twice.** **A new mechanism:** a signed coordinate
quoted as an unsigned distance ruled as a value mismatch. "Wide of the plate" is
a magnitude, and the coach used it correctly; the tool compared it against the
signed coordinate.

## 14. allfields-s4 / run2, tip1

**Coach:** "swing 2 was 0.85 feet wide"

**Ground truth.** `pitchSide` is -0.85.

**Verdict: FALSE POSITIVE.** Same new mechanism as claims 12 and 13.

## 15. allfields-s4 / run3, tip1

**Coach:** "You swung at 6 pitches outside the zone this round, and swings 2, 3,
5, 7, 9, and 10 all came in under 82 mph."

**Ground truth.** The outside-the-zone set is handed and the coach names it
correctly. Their exit velocities are 76, **85**, 74, 74, 77 and 75. Five of six.

**Verdict: GENUINE.** A self-derived subset over pitch-location groups.

## 16 and 17. allfields-s4 / run6, tip1 (one phrase, flagged twice)

**Coach:** "including swings 5 and 9 on pitches above 3.5 feet"

**Verdict: FALSE POSITIVE, twice.** Restated threshold read as an exact value.
Third and fourth occurrence of this exact phrase in this round.

## 18. allfields-s4 / run6, tip1

**Coach:** "and both came off the bat under 77 mph"

**Ground truth.** 74 and **77**.

**Verdict: GENUINE.** Boundary shape, identical to claim 11 in a different cell.

## 19. allfields-s4 / run7, tip1

**Coach:** "Swings 2, 3, 5, 7, 9, and 10 were all outside the zone, and those
six swings averaged well below the 82 mph hard-contact line."

**Ground truth.** The set is handed and right. Their exit velocities are 76, 85,
74, 74, 77 and 75, whose mean is 76.8, which is well below 82. The claim is about
an average and it is true.

**Tool's ruling:** "exitVelocity below 82: 7", a count of swings.

**Verdict: FALSE POSITIVE.** **A new mechanism:** an average of a named subset
ruled as a count of swings below the threshold. The tool has no way to express
"the mean of these six", so it filed the claim against the nearest count.

## 20. allfields-s4 / run7, tip2

**Coach:** "Swings 1 and 2 went pull side at just 75 and 76 mph, both well short
of 175 feet."

**Ground truth.** Swings 1 and 2 are pull side at -41 and -44 degrees, and 75 and
76 mph, all correct. Their distances are **195** and 159 feet. Swing 1 is not
short of 175, let alone well short.

**Verdict: GENUINE.** A single description asserted across a named pair whose
members differ.

## 21 and 22. allfields-s4 / run8, tip1 (one sentence, flagged twice)

**Coach:** "Swings 2 and 7 were on pitches outside by 0.85 and 1.46 feet off the
plate — both came off at 76 and 74 mph."

**Verdict: FALSE POSITIVE, twice.** Signed coordinate quoted as an unsigned
distance, the same new mechanism as claims 12, 13 and 14. Every number in the
sentence is right.

## 23 and 24. allfields-s4 / run8, tip2 (one phrase, flagged twice)

**Coach:** "Swings 5 and 9 were on pitches above 3.5 feet, and they came off at
74 and 77 mph with launch angles of 43 and 23 degrees."

**Ground truth.** 3.82 and 3.66 feet, 74 and 77 mph, 43 and 23 degrees. Every
number right, including the pair of exit velocities three other debriefs in this
round got wrong.

**Verdict: FALSE POSITIVE, twice.** Restated threshold read as an exact value.
Fifth and sixth occurrence in this round.

## 25. popup-s4 / run1, coachingSummary

**Coach:** "One pop-up snuck back in, and exit velocity dipped to 81 mph after
climbing three straight rounds."

**Ground truth.** The handed pop-up count for session 4 is 1. The handed session
4 average exit velocity is 81, and sessions 1 to 3 are 82, 83 and 84, which is
three straight climbs. Every part is right.

**Tool's ruling:** the 81 graded against `topExitVelocity` of 89.

**Verdict: FALSE POSITIVE.** The claim filed under the wrong statistic, an
average read as a top. Worth noting what this debrief is: it is the one Task 12
quoted as the sentence the old generator could not have supported honestly, and
the hand-check finds it entirely accurate.

## Round 3 summary

| | Count |
|---|---|
| Flagged claims adjudicated | 25 |
| **GENUINE** | **9** |
| **FALSE POSITIVE** | **16** |
| False-positive rate | **64.0%** |

**9 of 63 debriefs carry a genuine error** (14.3%): power-s1 run10, power-s2
run5, contact-s1 run9, contact-s4 runs 1 and 6, open-s4 run7, allfields-s4 runs
3, 6 and 7. **7 were flagged only falsely**: power-s2 run7, contact-s1 run10,
contact-s4 run7, open-s4 run8, allfields-s4 runs 2 and 8, popup-s4 run1. The 9
genuine claims are 9 distinct errors.

**64.0% is the highest false-positive rate this project has recorded**, past the
previous high of 61.9%. Two thirds of it is two phrases: six flags on "swings 5
and 9 on pitches above 3.5 feet" and five on quoting a pitch's distance off the
plate without its sign.

---

# False positives by mechanism, all three rounds

| Mechanism | before | after-a | after-b | Total | New? |
|---|---|---|---|---|---|
| Restated threshold read as an exact value | 2 | 0 | 6 | 8 | known |
| Signed coordinate quoted as an unsigned distance | 0 | 0 | 5 | 5 | **new** |
| Named subset checked against a whole-session total | 0 | 3 | 1 | 4 | known |
| Claim filed under the wrong statistic entirely | 2 | 0 | 1 | 3 | known |
| Per-swing value recital re-cast as a subset test | 1 | 0 | 1 | 2 | known |
| Handed distribution bucket re-derived with an inclusive upper bound | 1 | 0 | 0 | 1 | known |
| Illustrative list read as exhaustive | 1 | 0 | 0 | 1 | known |
| Denominator of "N out of fifteen" absorbed as the named-swing list | 0 | 1 | 0 | 1 | **new variant** |
| Two-sided handed band re-derived as a one-sided signed comparison | 0 | 1 | 0 | 1 | **new** |
| Prescriptive coaching cue extracted as a factual count claim | 0 | 1 | 0 | 1 | **new** |
| Session sequence misaligned by one when assigning session numbers | 0 | 0 | 1 | 1 | **new variant** |
| Average of a named subset ruled as a count | 0 | 0 | 1 | 1 | **new** |
| **Total** | **7** | **6** | **16** | **29** | |

## The five new mechanisms, and why they arrived together

Four of the five concern **pitch location**, and that is not a coincidence. The
rewritten generator links where a pitch was to how well it was struck, so the
coach now writes about pitch location far more often, and the tool has never been
stress-tested on that subject. The new mechanisms in order of cost:

1. **Signed coordinate quoted as an unsigned distance, 5 occurrences, all in
   `after-b`.** "0.85 feet wide of the plate" is a magnitude; `pitchSide` is
   signed. Every one of the five sentences was completely correct. This is
   deterministic, sits in the verdict path rather than in extraction, and is
   therefore cheap to fix and free to validate by replaying the committed rounds
   offline. **Strongest candidate of the tool items.**
2. **Two-sided handed band re-derived as a one-sided signed comparison, 1
   occurrence.** Same root cause as the above: the prompt hands "side outside
   -0.7 to 0.7" and the tool rules `pitchSide above 0.7`. Also deterministic.
3. **Average of a named subset ruled as a count, 1 occurrence.** The claim shape
   "those six swings averaged well below 82" has no representation in the verdict
   code, so it lands on the nearest count. Deterministic.
4. **Session sequence misaligned by one, 1 occurrence.** Sits in extraction and
   cannot be validated without a fresh live round.
5. **Prescriptive coaching cue extracted as a factual count claim, 1
   occurrence.** Sits in extraction. Harmless in isolation, but it means a
   sentence with nothing checkable in it can be ruled FALSE.

The variant of the "N out of fifteen" mechanism is worth its own line because of
what it defeats. Slice 9's M4 fix requires `statedSwings.length > 0` before the
named-swing check fires. Here the extractor fabricated a fifteen-element list out
of the denominator, so the list is non-empty and the guard passes it straight
through.

**Five new mechanisms in one wave, again.** Slice 9 found five of seven new;
Slice 10 found two new; this wave finds five. The honest reading is unchanged
and now has more evidence behind it: this tool's failure modes are not
enumerated, and "a raw flag is a lead, not a finding" is a standing rule rather
than a caveat that will expire.

# Genuine errors by shape, all three rounds

| Shape | before | after-a | after-b | Total |
|---|---|---|---|---|
| Self-derived subset count over a pitch-location group | 0 | 7 | 1 | 8 |
| A value on the stated threshold placed on the wrong side of it | 2 | 1 | 4 | 7 |
| Two handed values recited in the wrong order | 6 | 0 | 0 | 6 |
| A per-swing value collapsed across a named pair | 0 | 3 | 3 | 6 |
| A handed count contradicted outright | 1 | 2 | 0 | 3 |
| The handed "Top 3 exit velocities" line misread | 2 | 0 | 0 | 2 |
| A self-derived range whose own bound excludes a member | 0 | 2 | 0 | 2 |
| A handed count attached to the opposite side of its threshold | 1 | 0 | 0 | 1 |
| A single description asserted across a named pair that differs | 0 | 0 | 1 | 1 |
| **Total** | **12** | **14** | **9** | **35** |

**Read the top two rows as one finding.** The before round's characteristic
error was transposing two handed values; the after rounds' is miscounting a
subset the coach worked out itself over a pitch-location group. That is a
composition change, and it tracks what the coach now has to talk about: the
rewritten generator gave pitch location real predictive force, so the coach
reasons about it aloud and gets its own arithmetic wrong in the way this project
already tracks as an open error class.

**It is not evidence that the coach got worse**, for the reason stated at the
top: the rounds describe different sessions. `after-a`'s session-4 draw contains
four wide pitches whose exit velocities are 77, 84, 77 and 84, and the coach
wrote about them in six separate debriefs, getting the count wrong every time.
`after-b`'s draw contains two wide pitches, and the same error class appears once.

# Unflagged genuine coach errors found in passing

Recorded because they are real and the tool did not see them, exactly as Slice
10's hand-check did. None is counted in any rate above.

1. **`after-a` contact-s4 / run8, tip2.** "swings 7 and 13 came off at 75 and 82
   mph with launch angles of 7 and 8 degrees — those are weak pull-side
   grounders." Swing 7's direction is **+31 degrees**, opposite field under the
   handed key. Swing 13 at -32 is pull. **A spray classification error, in the
   blind spot Slice 10's hand-check already named:** the tool has the spray rows
   in its fact sheet but the claim never reaches a verdict.
2. **`after-a` popup-s4 / run1, coachingSummary.** "zero pop-ups, zero weak
   grounders across all four sessions." Identical to claim 20 of that round,
   which was flagged in run8 and not here. Session 1's handed weak-grounder count
   is 1.
3. **`after-b` power-s1 / run10, tip2.** "Swings 2, 4, and 12 all came in under
   13 degrees launch angle **on pitches at or below the zone**." Swing 4's pitch
   is at 2.3 feet, in the zone. Only the launch-angle half of the sentence was
   flagged.
4. **`after-b` contact-s4 / run7, tip2.** "You also chased 5 high and low
   pitches outside the zone on swings 5, 9, 3, and 10." The handed high and low
   counts are 2 and 2, the coach names exactly those four swings, and then says
   five.
5. **`after-b` allfields-s4 / run2, tip1.** "Swings 1 and 2 came in at 75 and 76
   mph **on pitches way off the plate**." The handed wide list is swings 2 and 7.
   Swing 1's pitch side is 0.40 feet, inside the zone.

Three of the five are the same shape: a correct fact and an incorrect
pitch-location characterisation welded into one sentence, where the tool
extracts only the half it can rule on. That is a coverage gap worth a line of its
own on the What's Next list, alongside the two the previous slice recorded.

# The false-positive series, extended

| Round | FP rate |
|---|---|
| Slice 8d, round 1 | 11% |
| Slice 8c, after | 42% |
| Slice 9, before | 12.5% |
| Slice 9, after-a | 34.5% |
| Slice 9, after-b | 40% |
| Slice 10, after | 61.9% |
| Slice 10, after-spray | 43.5% |
| **Slice 11, before** | **36.8%** |
| **Slice 11, after-a** | **30.0%** |
| **Slice 11, after-b** | **64.0%** |

Ten rounds, 11% to 64%, with the new high set by this wave. The band is not
converging and should not be quoted as though it will.
