# Hand-check: every flagged claim in the Slice 10 after round

What this is: a claim-by-claim adjudication of every claim the grading tool
marked FALSE in one round of 64 live coach debriefs. Each one is ruled GENUINE
(the coach really was wrong) or FALSE POSITIVE (the tool was wrong).

- **Round:** `docs/eval-fixtures/slice10-direction-key/after/` (`shipped-64.json`,
  graded to `grading.json` / `grading.txt`)
- **Seed:** 20260814. **Builder:** `current`. **Handed era:** `current`. Both read
  from that directory's `BUILDER.txt` and used unchanged to rebuild ground truth.
- **Flags adjudicated:** 21 claims across 18 of 64 debriefs.
- **Standing rule this exists to honour:** a raw flag is a lead, not a finding.
  This project has measured this tool's false-positive rate at 11%, 42%, 12.5%,
  34.5% and 40% across five previous rounds. An unchecked flag count has
  previously reported an 80% regression where the hand-check found no change.

Ground truth was rebuilt with the grader's own `resolveSessions` export, and the
prompt the coach actually saw was rebuilt with `buildDebriefUserMessage` from
`src/coachApi.js`, so "handed" versus "self-derived" is decided against the real
prompt text rather than assumed.

One convention that decides several of these: `DISTANCE_BUCKETS` in
`src/ballFlight.js` is half-open, `dist >= min && dist < max`. A ball at exactly
305 feet is in the `305+` bucket, not in `265-305`.

---

## 1. power-s2 / run1 — coachingSummary

**Coach:** "Jake, you made real gains from Session 1 to Session 2. Exit velocity
climbed from 82 to 84 mph, and your average launch angle jumped from 17 to 21
degrees. You also cut your sub-175ft swings from 4 down to 1."

**Asserted:** a session-over-session comparison of the *under-175-foot distance
bucket*: 4 in Session 1, 1 in Session 2.

**True numbers.** The prompt handed the coach both figures verbatim:

    Session 1: Distance distribution: Under 175ft: 4 swings, ...
    Session 2: Distance distribution: Under 175ft: 1 swing, ...

Confirmed against the swings: Session 1 distances under 175 are 122, 159, 117,
156 (swings 2, 4, 12, 15) = 4. Session 2 has only 169 (swing 12) = 1.

**Tool's ruling:** graded against `underFifteenCount: 3`, the count of swings
with launch angle strictly below 15 degrees.

**Verdict: FALSE POSITIVE.** Mechanism M5, the claim filed under the wrong
statistic entirely. This is the textbook M5 example already recorded in
CLAUDE.md: a distance-under-175 claim graded against a launch-angle-under-15
count. The two numbers are unrelated.

---

## 2. power-s2 / run3 — coachingSummary

**Coach:** "Jake, your avg launch angle jumped from 17 to 21 degrees and you cut
flat swings from 5 down to 3. Distance improved too — you had 5 swings reach
265-305ft compared to 2 in Session 1. Good progress."

**Asserted:** Session 2 had 5 swings in the 265-305ft bucket; Session 1 had 2.

**True numbers.** Both handed verbatim:

    Session 1: ... 265-305ft: 2 swings, 305+ft: 2 swings
    Session 2: ... 265-305ft: 5 swings, 305+ft: 2 swings

Session 2 distances in that bucket under the app's half-open rule: 301, 266,
287, 304, 270 = 5. The two 305-plus balls are 305 and 312, which sit in the
`305+` bucket.

**Tool's ruling:** "distance between 265 and 305 inclusive: 6". It re-derived the
bucket with an inclusive upper bound and swept the 305-foot ball in, producing 6.

**Verdict: FALSE POSITIVE.** Mechanism: **a handed distribution bucket
re-derived with an inclusive upper bound**, double-counting the boundary value.
New in this wave. Note also that the tool recorded this claim as `handed: false`
when both numbers were handed word for word.

---

## 3. power-s2 / run4 — coachingSummary

**Coach:** "You also cut your under-175-foot balls from 4 down to 1."

**Asserted, true numbers, tool's ruling:** identical to claim 1. Handed as
`Under 175ft: 4 swings` then `1 swing`; graded against `underFifteenCount: 3`.

**Verdict: FALSE POSITIVE.** Mechanism M5.

---

## 4. power-s2 / run6 — coachingSummary

**Coach:** "You cut your under-175-foot swings from 4 down to 1."

**Verdict: FALSE POSITIVE.** Mechanism M5. Same claim, same handed figures, same
mis-filing under `underFifteenCount`.

---

## 5. power-s2 / run7 — coachingSummary

**Coach:** "You cut your under-175-foot swings from 4 down to 1."

**Verdict: FALSE POSITIVE.** Mechanism M5. Fourth instance of the identical
mis-filing in one cell.

---

## 6. power-s2 / run8 — coachingSummary

**Coach:** "You cut your under-175ft swings from 4 down to 1, and you added
three more balls in the 265-305ft range."

**Asserted:** a *delta*. Session 1 had 2 in the 265-305ft bucket, Session 2 has
5, so the increase is three.

**True numbers.** 5 - 2 = 3. Correct, and both endpoints were handed.

**Tool's ruling:** "distance between 265 and 305 inclusive: 6 ... claimed 3, the
rows give 6". It read the delta as a total, and computed that total with the
same inclusive-boundary error as claim 2.

**Verdict: FALSE POSITIVE.** Mechanism: a comparison or delta read as a total.

(The first half of the same sentence, "cut your under-175ft swings from 4 down
to 1", is correct and was not separately flagged here.)

---

## 7. power-s2 / run8 — tip2

**Coach:** "Swings 7, 9, and 15 were all on pitches below 1.5 feet, and all
three came in under 88 mph."

**Asserted:** two things. Swings 7, 9 and 15 were on pitches below 1.5 feet
(handed: "Swings on pitches low (height below 1.5ft): 3 swings — numbers: 7, 9,
15", correct). And all three had exit velocity under 88 mph.

**True numbers.** Session 2 exit velocities: swing 7 = **88**, swing 9 = 87,
swing 15 = 83. 88 is not under 88, so 2 of 3, not 3.

This is not a hair-splitting boundary. 88 mph is the Power goal's own hard-contact
threshold, and swing 7 is the single power-zone swing this same debrief's tip1
praises. The sentence contradicts the debrief beside it.

**Verdict: GENUINE.**

---

## 8. contact-s1 / run2 — tip1 (first of two flags on one sentence)

**Coach:** "Nine swings came out above 18 degrees, and several of those were on
pitches you chased outside the zone — like swings 6 and 14 on pitches above 3.5
feet."

**Asserted:** swings 6 and 14 were on pitches *above* 3.5 feet. A threshold
claim, not a value claim.

**True numbers.** Handed verbatim: "Swings on pitches high (height above 3.5ft):
2 swings — numbers: 6, 14". Swing 6 height 3.8, swing 14 height 3.6. Both above
3.5. The claim is exactly right.

**Tool's ruling:** "swing 6 pitchHeight: 3.8 ... claimed 3.5, the table says 3.8".

**Verdict: FALSE POSITIVE.** Mechanism: a restated threshold read as an exact
value.

---

## 9. contact-s1 / run2 — tip1 (second flag, same sentence)

**Tool's ruling:** "swing 14 pitchHeight: 3.6 ... claimed 3.5, the table says
3.6".

**Verdict: FALSE POSITIVE.** Same sentence, same mechanism, counted twice
because the extractor emitted one claim per named swing.

---

## 10. contact-s1 / run6 — tip1

**Coach:** "Nine of your swings came in above 18 degrees, and swings like 5 and
13 left the bat at 92 and 89 mph but climbed to 27 and 25 degrees."

**Asserted:** swing 5 was 92 mph at 27 degrees; swing 13 was 89 mph at 25
degrees. A recital of two per-swing values.

**True numbers.** Session 1: swing 5 = 92 mph, 27 degrees. Swing 13 = 89 mph, 25
degrees. Both exactly right. "Nine swings above 18 degrees" was handed and is
correct.

**Tool's ruling:** "0 of swings 5, 13 are equal 88 exitVelocity". The extractor
converted a two-value recital into a subset claim against a threshold of 88, a
number that appears nowhere in the sentence.

**Verdict: FALSE POSITIVE.** Mechanism M5, wrong statistic. The specific shape,
a per-swing value recital re-cast as a subset-threshold test against a number
not in the sentence, is a variant not previously recorded.

---

## 11. contact-s1 / run8 — tip1

**Coach:** "Your hardest swings — 92, 89, and 89 mph — all came out between 15
and 27 degrees, and the ones above 18 are fly balls, not line drives."

**Asserted:** the three hardest swings had launch angles in the 15 to 27 range.

**True numbers.** Handed: "Top 3 exit velocities: 92, 89, 89 mph". Those are
swing 5 (92 mph, 27 degrees), swing 7 (89 mph, 15 degrees) and swing 13 (89 mph,
25 degrees). 27, 15 and 25 are all within 15 to 27. The claim is right, and the
range the coach quotes is exactly the min and max of that set.

**Tool's ruling:** "launchAngle between 15 and 27 inclusive: 10 ... claimed 3,
the rows give 10". It counted every swing in the session inside that range.

**Verdict: FALSE POSITIVE.** Mechanism M1, a named subset checked against a
whole-session total.

---

## 12. contact-s1 / run9 — coachingSummary

**Coach:** "But most of your contact is sitting above 18 degrees, which means fly
balls, not line drives. Four swings hit the target zone out of fifteen."

**Asserted:** four of fifteen swings were in the goal's target zone.

**True numbers.** Handed verbatim: "Swings with launch angle in the target 8-18
degrees (including both 8 and 18): 4 swings". Confirmed: angles 8, 13, 15, 14
(swings 2, 4, 7, 11) = 4.

**Tool's ruling:** "launchAngle atMost 15: 6 ... claimed 4, the row says 6". The
extractor filed the claim as a threshold test with threshold **15**, taken from
the phrase "out of fifteen", and with `statedSwings` set to all fifteen swing
numbers. It graded a target-zone claim against a count of swings at or below 15
degrees, which is neither the goal's window nor anything the coach said.

**Verdict: FALSE POSITIVE.** Mechanism M5, with a new and specific shape: **the
denominator of an "N out of fifteen" phrase absorbed as the numeric threshold**.

**Ambiguity, stated.** On the debrief screen the Contact goal's shaded target
band requires both launch angle 8 to 18 *and* exit velocity 85+, and only two of
session 1's fifteen swings meet both (swing 7 at 89/15 and swing 11 at 87/14).
Under that stricter reading of "the target zone", the coach's four is wrong and
a visitor could count two dots in the band while reading "four". I rule FALSE
POSITIVE on the most natural reading, because the preceding clause frames the
whole sentence in launch angle and the coach is repeating a handed line that
literally uses the word "target". The alternative reading is real and worth a
separate look; it is a prompt-and-screen alignment question, not a tool question.
Either way the tool's own reason is wrong.

---

## 13. contact-s4 / run4 — tip2

**Coach:** "Your top exit velocities were 88, 87, and 86 mph — your hardest
swings were on pitches in the zone at heights between 1.5 and 3 feet."

**Asserted:** the three hardest swings came on in-zone pitches roughly between
1.5 and 3 feet high.

**True numbers.** Handed: "Top 3 exit velocities: 88, 87, 86 mph". Session 4:
88 = swing 5 (height 3.07), 87 = swing 6 (height 2.91), 86 = swings 3 (1.52), 4
(3.07) and 13 (0.61). The set the coach is plainly describing is swings 5, 6 and
3, at 3.07, 2.91 and 1.52 feet. All three are inside the strike zone (1.5 to 3.5
feet). Two of the three are strictly inside the stated 1.5 to 3 range; the third
is 3.07, over by 0.07 of a foot.

**Tool's ruling:** "pitchHeight between 1.5 and 3 inclusive: 8 ... claimed 3, the
rows give 8". It counted every swing in the session in that height range.

**Verdict: FALSE POSITIVE.** Mechanism M1, a named subset checked against a
whole-session total. The coach's range is loose by 0.07 feet on one swing, which
is this project's already-recorded loose-rounding behaviour rather than a
miscount; run8 of the same cell describes the same three swings precisely as
"between 1.52 and 3.07 feet". The "in the zone" half is correct.

---

## 14. contact-s4 / run7 — coachingSummary

**Coach:** "You also did a much better job laying off bad pitches, making contact
on 12 of 15 strikes."

**Asserted:** the 12-of-15 figure is the session's strike-zone rate.

**True numbers.** Handed verbatim: "Pitches in strike zone: 12/15". Correct.

**Tool's ruling:** graded against `contactTargetBandCount: 8`, the count of
swings with launch angle in the 8-18 window.

**Verdict: FALSE POSITIVE.** Mechanism M5, wrong statistic. The cited number is
handed and right.

**Ambiguity, stated.** The phrasing is loose in a way the numbers are not: read
literally, "making contact on 12 of 15 strikes" implies fifteen strikes with
three missed, when the data says twelve of fifteen *pitches* were strikes and
every swing made contact. That is a wording fault on a correctly cited figure,
not a wrong count, so it does not make the flag genuine.

---

## 15. contact-s4 / run7 — tip1

**Coach:** "The problem is your exit velocity dipped to 82 mph on average, and
swings 2 and 12 both came in under 80 mph with angles below 8 degrees."

**Asserted:** swings 2 and 12 were both under 80 mph and both under 8 degrees.

**True numbers.** Session 4: swing 2 = **80** mph at 4 degrees; swing 12 = 78 mph
at 7 degrees. The angles are right. On exit velocity, 80 is not under 80, so the
claim holds for 1 of 2 swings.

**Verdict: GENUINE.** A strict-boundary error: the coach put a swing sitting
exactly on the threshold on the wrong side of it.

---

## 16. contact-s4 / run8 — tip1

**Coach:** "Your three swings outside the zone on pitches 1, 10, and 13 all came
on balls low or high and wide — none of them reached 80 mph."

**Asserted:** none of swings 1, 10, 13 reached 80 mph.

**True numbers.** Handed correctly: "Swings on pitches outside the strike zone: 3
swings — numbers: 1, 10, 13". Their exit velocities are 79, 74 and **86**. Swing
13 at 86 mph comfortably clears 80, and it is also the session's joint third
hardest ball.

**Verdict: GENUINE.** Not a boundary case; the sentence is wrong by 6 mph and it
carries the tip's whole argument ("those are the swings that drive your average
down").

---

## 17. open-s4 / run1 — tip2

**Coach:** "Swings 5, 10, and 12 all had launch angles of 20 degrees or below and
exit velocities under 80 mph, and none of them got past 235 feet."

**Asserted:** three conditions over swings 5, 10 and 12.

**True numbers.** Session 4: swing 5 = **82** mph, 20 degrees, 235 ft; swing 10 =
79 mph, 9 degrees, 159 ft; swing 12 = 75 mph, 5 degrees, 121 ft. Angles at or
below 20: all three, correct. Distance not past 235: correct (235 is not past
235). Exit velocity under 80: swing 5 is 82, so 2 of 3.

**Verdict: GENUINE.**

---

## 18. open-s4 / run4 — tip2

**Coach:** "You had five balls go under 175 feet this round — swings 1, 7, 9, 12,
and 13 — and four of those were on pitches outside the zone."

**Asserted:** the identity of the five sub-175-foot balls, and that four of them
were outside the zone.

**True numbers.** Session 4 distances: 126, 185, 229, 212, 235, 244, 171, 237,
209, 159, 252, 121, 159, 191, 248. Under 175: swing 1 (126), swing 7 (171),
swing **10** (159), swing 12 (121), swing 13 (159) = five swings, **1, 7, 10, 12,
13**. The coach named swing 9, which went 209 feet, and omitted swing 10.

The follow-on fails too. Out-of-zone swings were handed as 1, 7, 9, 13. Against
the true list {1, 7, 10, 12, 13} the overlap is three, not four; the coach only
gets to four by including the swing it wrongly named.

**Verdict: GENUINE.** The count is right and the names are wrong, which is
exactly the tool's stated reason.

---

## 19. open-s4 / run6 — tip2

**Coach:** "You had five swings under 175 feet this round after just one in
Session 3. Several of those were on balls you hit flat — swings 10, 12, and 13
were all under 10 degrees of launch angle."

**Asserted:** swings 10, 12 and 13 all had launch angle under 10 degrees.

**True numbers.** Session 4: swing 10 = 9 degrees, swing 12 = 5 degrees, swing 13
= **10** degrees. 10 is not under 10, so 2 of 3.

(The lead-in is correct: five under 175 this round, one in Session 3, both
handed.)

**Verdict: GENUINE.** A strict-boundary error, the third of this shape in the
round.

---

## 20. popup-s4 / run1 — tip2

**Coach:** "You hit 11 swings in the target zone, but none reached 265 feet this
round — Sessions 2 and 3 both had five swings go 265 or farther."

**Asserted:** three things. 11 in the target zone this round (handed, correct).
None reached 265 this round (correct; Session 4's longest is 252). And that
Sessions 2 *and* 3 each had five balls of 265 feet or more.

**True numbers.** From the handed distributions:

    Session 2: 265-305ft: 5 swings, 305+ft: 0 swings  ->  5 at 265 or farther
    Session 3: 265-305ft: 6 swings, 305+ft: 1 swing   ->  7 at 265 or farther

Session 3's seven checked against the swings: 266, 284, 287, 270, 265, 331, 296.

**Verdict: GENUINE.** Session 2 is right, Session 3 is not; the coach needed to
add two handed bucket numbers together and used only one of them.

---

## 21. popup-s4 / run6 — tip2

**Coach:** "Swings 12 and 15 both came in at 5 degrees of launch angle on pitches
right in the zone at 1.92 and 3.36 feet."

**Asserted:** swings 12 and 15 both had a launch angle of 5 degrees.

**True numbers.** Session 4: swing 12 = 5 degrees at height 1.92; swing 15 =
**28** degrees at height 3.36. The pitch heights are both right and both in the
zone; the launch angle is right for swing 12 and wrong by 23 degrees for swing
15.

**Verdict: GENUINE.** The tip's advice ("that's too flat for pitches you should
be driving") is the opposite of true for swing 15, which was the session's
highest ball.

---

## Summary

| | Count |
|---|---|
| Flagged claims adjudicated | 21 |
| **GENUINE coach errors** | **8** |
| **FALSE POSITIVES** | **13** |
| False-positive rate on flagged claims | 61.9% |

At the debrief level: 18 of 64 debriefs were flagged. 8 of those carry at least
one genuine error (12.5% of the round). 10 were flagged **only** falsely
(power-s2 runs 1, 3, 4, 6, 7; contact-s1 runs 2, 6, 8, 9; contact-s4 run 4). Two
debriefs, power-s2 run8 and contact-s4 run7, carry one genuine flag and one false
one.

### False positives by mechanism

| Mechanism | Count | Where |
|---|---|---|
| M5, claim filed under the wrong statistic entirely | 6 | power-s2 runs 1, 4, 6, 7; contact-s1 run6; contact-s4 run7 |
| M5 variant, "out of fifteen" denominator absorbed as the numeric threshold | 1 | contact-s1 run9 |
| M1, named subset checked against a whole-session total | 2 | contact-s1 run8; contact-s4 run4 |
| Restated threshold read as an exact value | 2 | contact-s1 run2 (one sentence, counted twice) |
| Comparison or delta read as a total | 1 | power-s2 run8 |
| Handed distribution bucket re-derived with an inclusive upper bound | 1 | power-s2 run3 |

### Genuine errors by shape

| Shape | Count | Where |
|---|---|---|
| A value sitting exactly on the stated threshold placed on the wrong side of it | 3 | power-s2 run8 (88 mph), contact-s4 run7 (80 mph), open-s4 run6 (10 degrees) |
| A named group asserted uniform when one member is plainly outside | 3 | contact-s4 run8 (86 vs "none reached 80"), open-s4 run1 (82 vs "under 80"), popup-s4 run6 (28 vs "5 degrees") |
| Right count, wrong swing names | 1 | open-s4 run4 |
| Two handed bucket rows needing to be added, only one used | 1 | popup-s4 run1 |

Six of the eight genuine errors are the same underlying habit CLAUDE.md already
records: the coach names a group of swings and then over-generalises a property
across all of them. None of the eight is a contradiction of a number the prompt
handed the coach as a count; every one is something the coach derived itself
from the per-swing table.

### New mechanisms seen

Two, both new to this project's records:

1. **A handed distribution bucket re-derived with an inclusive upper bound.**
   The app's distance buckets are half-open, so a 305-foot ball belongs to
   `305+`. The tool recomputes `265-305` inclusively and sweeps it back in,
   turning a correctly repeated handed 5 into a "should be 6". Deterministic, in
   the verdict code rather than in extraction, and therefore cheap to fix and
   testable offline against the committed rounds.

2. **The denominator of an "N out of fifteen" phrase absorbed as the numeric
   threshold.** The extractor turned "Four swings hit the target zone out of
   fifteen" into a threshold test at 15 degrees over all fifteen swings. This
   sits in extraction, not in the verdict code.

One previously recorded mechanism showed a new shape worth naming: in
contact-s1 run6, M5 fired by converting a plain two-value recital ("swings like 5
and 13 left the bat at 92 and 89 mph") into a subset test against 88 mph, a
threshold that appears nowhere in the sentence.

### The finding that matters for before-and-after work

M5 accounts for 7 of the 13 false positives, and four of those seven are the
*same sentence* in the same cell: the Power session-2 "you cut your
under-175-foot swings from 4 down to 1", a correctly repeated pair of handed
distance-bucket numbers graded against a launch-angle count. That is the exact
non-neutrality CLAUDE.md already warns about. Any comparison run with this tool
that includes the power-s2 cell will carry roughly four spurious flags from one
recurring sentence shape, so a raw flag-count delta between two rounds is not
usable here without a hand-check of at least the M5 candidates.
