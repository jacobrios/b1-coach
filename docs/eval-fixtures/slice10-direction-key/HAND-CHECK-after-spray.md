# Hand-check: the Slice 10 after-spray round

What this is: two things done against one round of 64 live coach debriefs. First,
a direct test of whether the shipped spray fix actually worked, which is the
reason the round was bought. Second, a claim-by-claim adjudication of every claim
the grading tool marked FALSE, each ruled GENUINE (the coach really was wrong) or
FALSE POSITIVE (the tool was wrong).

- **Round:** `docs/eval-fixtures/slice10-direction-key/after-spray/`
  (`shipped-64.json`, graded to `grading.json` / `grading.txt`)
- **Compared against:** `docs/eval-fixtures/slice10-direction-key/after/`, the
  round measuring the prompt the product manager rejected. Same 64 cells, same
  seed, same swing data, one prompt generation apart.
- **Seed:** 20260814. **Builder:** `current`. **Handed era:** `current`. All three
  read from that directory's `BUILDER.txt` and used unchanged to rebuild ground
  truth.
- **Flags adjudicated:** 23 claims across 17 of 64 debriefs.
- **Standing rule this exists to honour:** a raw flag is a lead, not a finding.
  This project has measured this tool's false-positive rate at 11%, 42%, 12.5%,
  34.5%, 40% and, in the previous round, 61.9%. An unchecked flag count has
  previously reported an 80% regression where the hand-check found no change.

Ground truth was rebuilt with the grader's own `resolveSessions` export, and the
prompt the coach actually saw was rebuilt with `buildDebriefUserMessage` from
`src/coachApi.js`, so "handed" versus "self-derived" is decided against the real
prompt text rather than assumed.

Two conventions decide several of these. `DISTANCE_BUCKETS` in
`src/ballFlight.js` is half-open, `dist >= min && dist < max`, so a ball at
exactly 305 feet is in `305+`, not in `265-305`. And `SPRAY_CUTOFFS` in
`src/sessionStats.js` is `{ pull: -15, oppo: 15 }`, strict on both sides, which
is what the spray chart colours by.

---

# Job 1: did the defect actually get fixed?

**Answer: yes, and cleanly.** The coach in the new round classifies spray by the
chart's -15 and +15 cutoffs, not by the sign of the direction number. It never
once names a swing between -15 and 0 as pull side, which is the specific mistake
the product manager saw on screen.

## Method

Every sentence in both rounds containing a spray word (pull, pulled, opposite
field, oppo, the other way, up the middle, center field, spray, gap, left field,
right field) was pulled out and read. Sentences carrying no classification were
discarded: the metaphorical "those low pitches are pulling your barrel down", the
coaching cues ("drive it toward the opposite gap"), and the vague "you pulled the
ball a lot". What remains is a **classification-bearing statement**: one that
either names specific swings as pull side, opposite field or up the middle, or
gives a count of one of those categories for a named session. Each was then
checked against both rules.

One statement is excluded as genuinely ambiguous, and is named below rather than
counted either way.

## The comparison

| | after (rejected prompt) | after-spray (shipped prompt) |
|---|---|---|
| Classification-bearing spray statements | 15 | 33 |
| Match the **cutoff** rule, where the sign rule would give a different answer | 14 | 23 |
| Consistent with both rules (non-discriminating, all correct) | 0 | 8 |
| Match the **sign** rule only | **1** | **0** |
| Match neither rule (coach arithmetic slip) | 0 | 2 |
| Debriefs carrying at least one such statement | 9 of 64 | 24 of 64 |

The raw totals understate the change, because Hit to All Fields is the one goal
whose prompt has always carried pull and opposite-field counts at the -15 and +15
cutoffs, through `GOAL_COUNT_SPECS`. On that goal the coach could not go wrong in
either round, and it accounts for 14 of the 15 statements in the old round.
Stripping it out is the real test:

| Five goals with no handed spray counts before this slice | after | after-spray |
|---|---|---|
| Classification-bearing spray statements | 1 | 20 |
| Cutoff rule (discriminating) | 0 | 11 |
| Consistent with both rules | 0 | 7 |
| **Sign rule only** | **1** | **0** |
| Neither rule | 0 | 2 |

## The old round's single non-allfields classification, and it is the defect

`contact-s1/run4`, tip2, in `after/shipped-64.json`:

> "Swings 7 and 11 hit 89 and 87 mph and came out at 15 and 14 degrees - right in
> the line drive window. On both of those, you attacked pitches in the lower half
> of the zone and **drove them to the pull side** with a flat, direct path."

Session 1 directions: swing 7 is -22, swing 11 is **-5**. Under the chart's rule
swing 11 is up the middle. Under the sign rule it is pull. This is the product
manager's finding reproduced exactly: a swing between -15 and 0 called pull in the
prose while the chart on the same screen colours it Center.

## The new round, the discriminating statements

Every statement below would come out differently under the sign rule. All 23 are
right under the cutoff rule.

| Cell / run | Field | What the coach said | Cutoff truth | Sign-rule answer | Verdict |
|---|---|---|---|---|---|
| power-s2 / run5 | tip2 | "Six of your fifteen swings went pull side" | 6 | 8 | cutoff |
| power-s2 / run8 | tip2 | "up from three in Session 1" (pull) | 3 | 7 | cutoff |
| contact-s4 / run3 | tip2 | "Five of your swings went pull side, and three of them - swings 6, 13, and 15" | 5; set is 3, 6, 12, 13, 15 | 9 | cutoff |
| contact-s4 / run6 | tip2 | "Swings 4 and 5 ... you stayed through the ball **up the middle**" | -2 and -6, both up the middle | both would be pull | cutoff |
| open-s4 / run1 | tip2 | "Five of your 15 swings went opposite field" | 5 | 12 | cutoff |
| open-s4 / run2 | tip2 | "opposite field on swings 1, 2, 6, 8, and 15" | exactly that set | 12 swings | cutoff |
| open-s4 / run3 | tip2 | "Five of your 15 swings went opposite field" | 5 | 12 | cutoff |
| open-s4 / run4 | tip2 | "Five of your 15 swings went opposite field" | 5 | 12 | cutoff |
| open-s4 / run5 | tip2 | "five swings go opposite field this round" | 5 | 12 | cutoff |
| open-s4 / run5 | tip2 | "four in Session 3" (oppo) | 4 | 11 | cutoff |
| open-s4 / run6 | tip2 | "opposite field on swings 1, 2, 6, 8, and 15" | exactly that set | 12 swings | cutoff |
| allfields-s4 / run1 | coachingSummary | "five oppo swings" | 5 | 12 | cutoff |
| allfields-s4 / run1 | tip2 | "only 2 pull-side swings this round" | 2 | 3 | cutoff |
| allfields-s4 / run1 | tip2 | "down from 6 in Session 2" | 6 | 8 | cutoff |
| allfields-s4 / run2 | tip2 | "pull side on just swings 4 and 5" | exactly 4 and 5 | 4, 5, 7 | cutoff |
| allfields-s4 / run3 | tip2 | "only pulled the ball on swings 4 and 5" | exactly 4 and 5 | 4, 5, 7 | cutoff |
| allfields-s4 / run4 | tip2 | "only 2 pull-side swings this round" | 2 | 3 | cutoff |
| allfields-s4 / run5 | coachingSummary | "just 2 swings that way" (pull) | 2 | 3 | cutoff |
| allfields-s4 / run5 | tip1 | "just 2 pull-side swings this round" | 2 | 3 | cutoff |
| allfields-s4 / run5 | tip1 | "after 6 in Session 2" | 6 | 8 | cutoff |
| allfields-s4 / run6 | tip2 | "pulled the ball on only 2 swings this round" | 2 | 3 | cutoff |
| allfields-s4 / run7 | tip2 | "only got 2 pull-side swings this round" | 2 | 3 | cutoff |
| allfields-s4 / run8 | tip2 | "only got 2 pull-side swings this round" | 2 | 3 | cutoff |

`contact-s4 / run6` is worth singling out. It is the exact mirror of the rejected
prompt's defect: two swings at -2 and -6 degrees, which the old sign rule would
have called pull, described as "up the middle". The coach is now on the chart's
side of the line in both directions, not just the safe one.

`contact-s4 / run3` is the tightest case in the round. Swing 15 sits at -16
degrees, one degree past the cutoff, and the coach puts it in the pull group,
which is correct. A sign-rule coach would have had no way to tell -16 from -6.

## Does the new round ever name a swing between -15 and 0 as pull side?

**No.** Every swing the new round names or identifies as pull side, with its
direction:

- power-s2 run2: swings 11 (-29), 13 (-22)
- power-s2 run4: swings 13 (-22), 11 (-29), 7 (-20)
- power-s2 run8: swings 11 (-29), 13 (-22)
- contact-s1 run1: swing 7 (-22)
- contact-s1 run7: swing 7 (-22)
- contact-s4 run3: swings 6 (-23), 13 (-22), 15 (-16)
- contact-s4 run8: swings 6 (-23), 13 (-22)
- allfields-s4 runs 2, 3, 7, 8: swings 4 (-25), 5 (-19)
- allfields-s4 run4, on Session 2: swings 11 (-29), 13 (-22)

The smallest magnitude called pull anywhere in the round is -16. Nothing inside
the -15 to 0 band is called pull side even once.

## The two statements that match neither rule, and the one excluded

These are coach arithmetic slips, not rule confusion. Both are off by one against
a **handed** spray count, and neither is anywhere near what the sign rule would
have produced, so neither weakens the finding above. Both matter separately,
because **the grading tool flagged neither**: it has no spray statistic, so Job 2's
counts cannot see spray claims at all.

> *Annotation, 20 August 2026, final review of Slice 10. "It has no spray
> statistic" is false and should not be acted on.* `scripts/factSheet.js:164-170`
> carries all three spray counts and their swing numbers for every session. The
> ground truth is there. What is missing sits upstream of it, in extraction and
> in the verdict path, which is why these two claims went unflagged. The two
> specific gaps are set out under "One correction to the hand-checks" in
> `README.md`. Nothing below is changed: both adjudications stand, and both
> statements are still genuine coach errors that the tool did not catch.

1. **power-s2 / run8, tip2.** "You put five swings to the pull side in Session 2,
   up from three in Session 1." Session 2's handed line reads "Swings pull side
   ...: 6 swings - numbers: 3, 7, 11, 12, 13, 14". The coach said five. The
   Session 1 half is right. Sign rule would give 8. **A genuine coach error,
   contradicting a handed count.**
2. **open-s4 / run5, tip2.** "You had five swings go opposite field this round, up
   from three in Session 1 and four in Session 3." Session 1's handed line reads
   4, not 3. The Session 3 and Session 4 halves are right. Sign rule would give 8.
   **A genuine coach error, contradicting a handed count.**

Excluded as ambiguous: **open-s4 / run7, tip1**, "A lot of your hardest contact
this round came on middle-middle pitches you hit to the opposite field at 78 and
81 mph." Session 4 has four swings at 78 and two at 81, and the pair the coach
means cannot be pinned down. On the reading that it means swings 2 and 6 the
classification is right under both rules; on the reading that it means swings 2
and 14 it would be wrong under the cutoff rule. Stated rather than counted.

One further unflagged coach error found in passing during this sweep, recorded
because it is real even though it is not a spray classification: **open-s4 / run3,
tip2** says the five opposite-field balls "most of them came in under 200 feet",
when their distances are 126, 185, 244, 237 and 248, so two of five, not most.

## What Job 1 concludes

The rejected prompt produced one spray classification outside Hit to All Fields in
64 debriefs, and it was wrong by the chart's rule. The shipped prompt produced 20,
and all 18 that are rulable are right by the chart's rule, including the two that
sit within one degree of a cutoff and the one that correctly refuses to call a
small negative number a pull. The two errors that remain are counting slips
against handed numbers, the error class this project already tracks, not the
prose-versus-chart disagreement the product manager rejected the branch over.

A second, secondary product change is worth naming, because nobody asked for it
and it is visible on screen. The coach now talks about spray on **five goals that
were previously almost silent about it**: statements in 24 of 64 debriefs, up from
9. That is what the shipped prompt was for, but it means the surface area for a
future spray error is much larger than it was, and the grading tool still cannot
see any of it.

---

# Job 2: every flagged claim, adjudicated

23 claims, in report order.

---

## 1. power-s1 / run2 - coachingSummary

**Coach:** "Jake, the bat speed is real - you topped out at 92 mph and had three
swings at 89 mph."

**Asserted:** three swings in Session 1 had an exit velocity of 89 mph.

**True numbers.** Session 1 exit velocities: 86, 72, 76, 75, 92, 81, 89, 87, 74,
78, 87, 78, 89, 78, 82. Exactly two are 89 (swings 7 and 13). The prompt hands
"Top 3 exit velocities: 92, 89, 89 mph", which lists two.

**Verdict: GENUINE.** The likely mechanism on the coach's side is a misread of the
handed "Top 3" line, turning "top 3" into "three swings at 89". It is wrong either
way, and the second-highest value is the one a reader would check first.

---

## 2. power-s1 / run5 - tip2

**Coach:** "Swings 2, 9, and 12 were all on pitches below 1.5 feet and all came in
under 78 mph."

**Asserted:** two things. Those three swings were on low pitches (handed verbatim
as "Swings on pitches low (height below 1.5ft): 3 swings - numbers: 2, 9, 12",
correct). And all three were under 78 mph.

**True numbers.** Swing 2 = 72, swing 9 = 74, swing 12 = **78**. 78 is not under
78, so 2 of 3.

**Verdict: GENUINE.** A strict-boundary error, the same shape the previous round
carried three times.

---

## 3. power-s2 / run2 - coachingSummary

**Coach:** "You also cut your under-175-foot swings from 4 down to 1."

**Asserted:** a session-over-session comparison of the under-175-foot distance
bucket.

**True numbers.** Handed verbatim in both sessions: Session 1 "Under 175ft: 4
swings", Session 2 "Under 175ft: 1 swing". Confirmed against the swings.

**Tool's ruling:** graded against `underFifteenCount: 3`, the count of swings with
launch angle strictly below 15 degrees.

**Verdict: FALSE POSITIVE.** Mechanism M5, the claim filed under the wrong
statistic entirely. This is the textbook M5 example already in CLAUDE.md, and it
recurred four times in the previous round of this same cell.

---

## 4. power-s2 / run3 - coachingSummary

**Coach:** "You cut your under-175-foot swings from four down to one, and five
swings reached the 265-305 foot range."

**Asserted:** Session 2 had five swings in the 265-305 foot bucket.

**True numbers.** Handed verbatim: Session 2 "265-305ft: 5 swings, 305+ft: 2
swings". Session 2 distances in that half-open bucket are 301, 266, 287, 304, 270
= 5. The two 305-plus balls are 305 and 312.

**Tool's ruling:** "distance between 265 and 305 inclusive: 6", sweeping the
305-foot ball back in.

**Verdict: FALSE POSITIVE.** Mechanism: a handed distribution bucket re-derived
with an inclusive upper bound. Second appearance, on the same cell, in consecutive
rounds.

---

## 5. power-s2 / run4 - coachingSummary (first of two flags on one sentence)

**Coach:** "you cut your under-175ft swings from 4 down to 1"

**Tool's ruling:** the "4" graded against Session 1's `underFifteenCount: 5`.

**Verdict: FALSE POSITIVE.** Mechanism M5. Handed as "Under 175ft: 4 swings".

---

## 6. power-s2 / run4 - coachingSummary (second flag, same sentence)

**Tool's ruling:** the "1" graded against Session 2's `underFifteenCount: 3`.

**Verdict: FALSE POSITIVE.** Mechanism M5, same sentence, counted twice because
the extractor emitted one claim per session endpoint.

---

## 7. contact-s1 / run1 - tip1 (first of two flags on one sentence)

**Coach:** "Nine of your swings came out above 18 degrees, and a lot of those were
on pitches you had no business swinging at - like swings 6 and 14 on pitches above
3.5 feet."

**Asserted:** swings 6 and 14 were on pitches **above** 3.5 feet. A threshold
claim, not a value claim.

**True numbers.** Handed verbatim: "Swings on pitches high (height above 3.5ft): 2
swings - numbers: 6, 14". Swing 6 height 3.8, swing 14 height 3.6. Both above 3.5.
The claim is exactly right, and so is the "nine above 18 degrees" lead-in.

**Tool's ruling:** "swing 6 pitchHeight: 3.8 ... claimed 3.5, the table says 3.8".

**Verdict: FALSE POSITIVE.** Mechanism: a restated threshold read as an exact
value. Same sentence, same cell, same mechanism as the previous round's claims 8
and 9.

---

## 8. contact-s1 / run1 - tip1 (second flag, same sentence)

**Tool's ruling:** "swing 14 pitchHeight: 3.6 ... claimed 3.5, the table says 3.6".

**Verdict: FALSE POSITIVE.** Same mechanism, counted twice because the extractor
emitted one claim per named swing.

---

## 9. contact-s1 / run5 - tip1

**Coach:** "Swings 6 and 14 were on pitches above 3.5 feet, and both came off the
bat over 19 degrees."

**Asserted:** both swings had a launch angle over 19 degrees. The pitch-height
half is handed and correct.

**True numbers.** Swing 6 launch angle = 24, swing 14 = **19**. 19 is not over 19,
so 1 of 2.

**Verdict: GENUINE.** A strict-boundary error. Note the coach chose the threshold
itself here, and chose one that its own second swing sits exactly on.

---

## 10. contact-s1 / run5 - tip2

**Coach:** "Seven of your swings came in above 18 degrees, but swing 11 was a
14-degree line drive at 87 mph - that's exactly what we want."

**Asserted:** seven Session 1 swings had a launch angle above 18 degrees.

**True numbers.** Handed verbatim: "Swings with launch angle strictly above 18
degrees (not including 18): 9 swings". Confirmed: swings 1, 3, 5, 6, 8, 9, 10, 13,
14 = 9. The swing 11 half is right (14 degrees, 87 mph).

**Verdict: GENUINE, and the most serious kind.** This directly contradicts a count
line the prompt handed the coach, on the goal's headline number, and the same
debrief's own `whatThisMeans` quotes the complementary handed figure ("Only 4
swings landed in the 8-18 degree line drive window") correctly.

---

## 11. contact-s1 / run11 - coachingSummary

**Coach:** "you touched 92 and had three swings at 89 mph"

**Asserted, true numbers, mechanism:** identical to claim 1. Two swings at 89, not
three.

**Verdict: GENUINE.** Second occurrence of the same misread of the handed "Top 3
exit velocities: 92, 89, 89 mph" line, in a different cell on the same session
data.

---

## 12. contact-s1 / run12 - tip1

**Coach:** "Nine of your swings came off the bat above 18 degrees, **including**
swings 1, 5, 6, 8, and 13 - those are fly balls, not line drives."

**Asserted:** a handed count of nine, plus five example swings offered explicitly
as a partial list.

**True numbers.** Handed count is 9 and correct. The true set is 1, 3, 5, 6, 8, 9,
10, 13, 14. Every one of the five named swings is in it: 22, 27, 24, 20 and 25
degrees respectively.

**Tool's ruling:** "the count matches but the named swings do not".

**Verdict: FALSE POSITIVE.** Mechanism: an illustrative list read as exhaustive.
The word "including" is doing exactly the work it exists to do, and the tool
ignored it. Note this is *not* the empty-`statedSwings` bug fixed on 20 August
2026; `statedSwings` here is a genuine, and genuinely correct, subset.

---

## 13. contact-s4 / run5 - tip2

**Coach:** "Six of your swings came in under 85 mph, and five of those went under
225 feet."

**Asserted:** six Session 4 swings were under 85 mph.

**True numbers.** Session 4 exit velocities under 85: swings 1, 2, 7, 9, 10, 11,
12, 14, 15 = **9**. What the prompt hands is the *complement*: "Swings with exit
velocity 85 mph or higher: 6 swings". The coach took the handed 6 and attached it
to the opposite side of the threshold.

The follow-on fails too, under either reading. Of the true nine, eight went under
225 feet, not five. Of the six hard-hit swings the coach may have had in mind,
two did.

**Verdict: GENUINE.** A handed count read in the wrong direction, which is a
distinct and more worrying shape than a miscount: the number on screen is right
and the sentence around it inverts its meaning.

---

## 14. contact-s4 / run6 - tip2 (first of two flags on one sentence)

**Coach:** "Swings 4 and 5 went 248 and 247 feet at 88 and 86 mph with launch
angles of 18 and 16 degrees - that is exactly what a line drive looks like."

**Asserted:** a positional recital. Swing 4 went 248 feet at 88 mph and 18
degrees; swing 5 went 247 feet at 86 mph and 16 degrees.

**True numbers.** Swing 4 = 86 mph, 18 degrees, 248 ft. Swing 5 = 88 mph, 16
degrees, 247 ft. The distances are in the coach's stated order and so are the
launch angles, which fixes the sentence's own positional convention beyond doubt.
The exit velocities are the one pair that is transposed.

**Verdict: GENUINE.** A transposition of two handed per-swing values, the same
shape this project recorded in Slice 8c for prior-session averages. The
alternative reading, that the coach means the set {86, 88} unordered, is
contradicted by the two other pairs in the same sentence being in order.

---

## 15. contact-s4 / run6 - tip2 (second flag, same sentence)

**Tool's ruling:** "swing 5 exitVelocity: 88 ... claimed 86, the table says 88".

**Verdict: GENUINE.** The other half of the same transposition, counted twice
because the extractor emitted one claim per named swing. One underlying coach
error.

---

## 16. allfields-s4 / run1 - coachingSummary (first of two flags on one sentence)

**Coach:** "But your exit velocity dropped to 79 mph this round, down from 83 and
84 in Sessions 2 and 3."

**Asserted:** Session 2 averaged 83 mph and Session 3 averaged 84.

**True numbers.** Handed verbatim: Session 2 "Avg Exit Velocity: 84 mph", Session
3 "Avg Exit Velocity: 83 mph". The two are the right way round in the data and the
wrong way round in the sentence. Session 4's 79 is correct.

**Verdict: GENUINE.** Two handed session averages recited in reverse order. This
is the exact pattern CLAUDE.md already records from Slice 8c as the dominant
contradicted-handed-number shape.

---

## 17. allfields-s4 / run1 - coachingSummary (second flag, same sentence)

**Tool's ruling:** the Session 3 half, "claimed 84, the stats say 83".

**Verdict: GENUINE.** The other half of the same transposition. One underlying
coach error.

---

## 18. allfields-s4 / run2 - tip2

**Coach:** "You hit pull side on just swings 4 and 5 this round, and both went 80
and 82 mph to the 210-235 ft range."

**Asserted:** swings 4 and 5 were the pull-side swings (handed as "Swings pull
side ...: 2 swings - numbers: 4, 5", correct), and they went 80 and 82 mph within
a 210 to 235 foot span.

**True numbers.** Swing 4 = 80 mph, 212 ft. Swing 5 = 82 mph, 235 ft. In the
coach's stated order, and both inside the stated distance span. The claim is
entirely right.

**Tool's ruling:** "1 of swings 4, 5 are equal 80 exitVelocity ... claimed 2, the
intersection is 1".

**Verdict: FALSE POSITIVE.** Mechanism M5 in its per-swing-recital variant, first
recorded in the previous round: a two-value recital re-cast as a subset test
against a single threshold taken from the first value.

---

## 19. allfields-s4 / run7 - whatThisMeans

**Coach:** "You were making contact but not driving the ball. Most swings stayed
between 175 and 265 feet with nothing reaching 265 or beyond."

**Asserted:** two things. Most swings landed between 175 and 265 feet, and nothing
reached 265 or beyond.

**True numbers.** Handed verbatim: Session 4 "Under 175ft: 5 swings, 175-225ft: 4
swings, 225-265ft: 6 swings, 265-305ft: 0 swings, 305+ft: 0 swings". So 10 of 15
between 175 and 265, which is most, and nothing at 265 or beyond. The longest ball
in the session is 252 feet. Both halves are right.

**Tool's ruling:** "distance between 175 and 265 inclusive: 10 ... claimed 0, the
rows give 10". The extractor filed the *second* clause's zero as the stated count
for the *first* clause's range.

**Verdict: FALSE POSITIVE.** Mechanism M5, with the specific shape of a negated
trailing clause's zero attached to the neighbouring range statistic. Related to
the complement bug this project closed in Slice 8d, but not the same one: the
extraction did not flip the comparison, it welded two clauses into one claim.

---

## 20. popup-s4 / run1 - tip2

**Coach:** "Swings 10 and 12 both landed in the 5-degree range - just inside the
target but nearly weak grounders on pitches at 2.08 and 1.92 feet."

**Asserted:** both swings were around 5 degrees, and both were just inside the
goal's target zone.

**True numbers.** Swing 10 = **9** degrees, swing 12 = 5 degrees. The pitch
heights, 2.08 and 1.92, are correct and in order, so the sentence is genuinely
about those two swings. The goal's target is launch angle 10 to 25, handed in the
goal context, so both swings are below the target floor rather than "just inside"
it.

**Verdict: GENUINE.** A single value asserted across a named pair whose members
differ by 4 degrees, the coach's already-recorded habit of over-generalising
across a group it has named. The same debrief's neighbouring claim about the pitch
heights is right, which is what makes the launch-angle compression a real error
rather than a wording quibble. The "just inside the target" half is wrong too and
was not separately flagged.

Note the contrast with claim 23 below, which is the same pair in the same cell
written correctly as two distinct values. The tool fired identically on both; only
one is a coach error.

---

## 21. popup-s4 / run3 - tip2 (first of two flags on one sentence)

**Coach:** "Swings 10 and 12 both came in at 5 and 9 degrees on pitches right in
the zone at 2.08 and 1.92 feet."

**Asserted:** a positional recital. Swing 10 at 5 degrees, swing 12 at 9 degrees.

**True numbers.** Swing 10 = 9 degrees, swing 12 = 5 degrees. The pitch heights in
the same sentence, 2.08 and 1.92, *are* in the coach's stated order, which fixes
the sentence's positional convention. The launch angles are transposed.

**Verdict: GENUINE.** Same shape as claim 14. Stated alternative: on a purely
set-based reading of "came in at 5 and 9 degrees" the claim is true, and this would
be a false positive. I rule on the most natural reading, because the neighbouring
pitch-height pair in the same sentence is ordered and because run6 of this same
cell writes the identical pair the right way round.

---

## 22. popup-s4 / run3 - tip2 (second flag, same sentence)

**Tool's ruling:** the swing 12 half, "claimed 9, the table says 5".

**Verdict: GENUINE.** The other half of the same transposition. One underlying
coach error.

---

## 23. popup-s4 / run6 - tip2

**Coach:** "Swings 12 and 10 both came in at 5 and 9 degrees - just outside your
target zone on the low end - and both were on pitches in the zone."

**Asserted:** swing 12 at 5 degrees, swing 10 at 9 degrees, both below the goal's
target floor, both on in-zone pitches.

**True numbers.** Swing 12 = 5 degrees, swing 10 = 9 degrees. Correct, and in the
coach's stated order. The target is 10 to 25, so both are just below it. Neither
swing is in the handed out-of-zone list (1, 7, 9, 13), so both were on strikes.
Every part of the sentence is right.

**Tool's ruling:** "1 of swings 12, 10 are equal 5 launchAngle ... claimed 2, the
intersection is 1".

**Verdict: FALSE POSITIVE.** Mechanism M5, per-swing-recital variant, same as
claim 18.

---

## Summary

| | Count |
|---|---|
| Flagged claims adjudicated | 23 |
| **GENUINE coach errors** | **13** |
| **FALSE POSITIVES** | **10** |
| False-positive rate on flagged claims | 43.5% |

At the debrief level: 17 of 64 debriefs were flagged. **9 carry at least one
genuine error** (14.1% of the round): power-s1 runs 2 and 5, contact-s1 runs 5 and
11, contact-s4 runs 5 and 6, allfields-s4 run1, popup-s4 runs 1 and 3. **8 were
flagged only falsely**: power-s2 runs 2, 3 and 4, contact-s1 runs 1 and 12,
allfields-s4 runs 2 and 7, popup-s4 run6. No debrief carries both a genuine and a
false flag this round.

The 13 genuine claims collapse to **10 distinct coach errors**, because three
sentences were each flagged twice (contact-s4 run6, allfields-s4 run1, popup-s4
run3). Add the two unflagged spray errors Job 1 found and the unflagged distance
error in open-s4 run3, and the round holds **13 distinct coach errors across 12
debriefs**, three of which this tool structurally cannot see.

### False positives by mechanism

| Mechanism | Count | Where |
|---|---|---|
| M5, claim filed under the wrong statistic entirely | 3 | power-s2 runs 2, 4 (twice) |
| M5 variant, a per-swing value recital re-cast as a subset test | 2 | allfields-s4 run2; popup-s4 run6 |
| M5 variant, a negated trailing clause's zero filed against the neighbouring range statistic | 1 | allfields-s4 run7 |
| Restated threshold read as an exact value | 2 | contact-s1 run1 (one sentence, counted twice) |
| Handed distribution bucket re-derived with an inclusive upper bound | 1 | power-s2 run3 |
| Illustrative list read as exhaustive | 1 | contact-s1 run12 |

M5 and its variants account for 6 of the 10, consistent with every previous round.

### Genuine errors by shape

| Shape | Count of claims | Where |
|---|---|---|
| Two handed values recited in the wrong order | 6 | contact-s4 run6, allfields-s4 run1, popup-s4 run3 (two claims each) |
| A value sitting exactly on the stated threshold placed on the wrong side of it | 2 | power-s1 run5 (78 mph), contact-s1 run5 (19 degrees) |
| The handed "Top 3 exit velocities" line misread as three swings at the repeated value | 2 | power-s1 run2, contact-s1 run11 |
| A handed count contradicted outright | 1 | contact-s1 run5 (7 against a handed 9) |
| A handed count attached to the opposite side of its threshold | 1 | contact-s4 run5 ("under 85" from a handed "85 or higher") |
| A single value asserted across a named pair whose members differ | 1 | popup-s4 run1 |

Nine of the 13 rest on a number the prompt handed the coach: three on an explicit
handed count or session-stat line (claims 10, 13, 16 and 17), six on the handed
per-swing table. That is a meaningfully worse profile than the previous round,
where the hand-check found **none** of the eight genuine errors contradicting a
handed number.

### New mechanisms seen

**One, and it is on the coach's side rather than the tool's.** Claim 13,
contact-s4 run5: a handed count attached to the opposite side of its own
threshold. The prompt says "Swings with exit velocity 85 mph or higher: 6 swings";
the coach wrote "Six of your swings came in under 85 mph". Every previously
recorded coach error of this family is a miscount or a transposition. This one
copies the number correctly and inverts the sentence around it, which is a
different failure and one that pre-counting cannot fix, since the count was there
and was right. Worth its own line on the What's Next list.

**No new tool mechanisms.** All six false-positive mechanisms above are already in
this project's records. Two are recurrences on the *identical sentence in the
identical cell* one round apart: the power-s2 "under-175-foot swings from 4 down
to 1" M5 misfiling, and the contact-s1 "pitches above 3.5 feet" threshold-as-value
reading.

---

## This round against the previous one

| | after (rejected prompt) | after-spray (shipped prompt) |
|---|---|---|
| Claims extracted | 504 | 543 |
| Could not be ruled on (UNVERIFIABLE) | 140 | 118 |
| Raw FALSE flags | 21 | 23 |
| Flagged debriefs | 18 of 64 | 17 of 64 |
| **Genuine coach errors, hand-checked** | **8 claims** | **13 claims** |
| Distinct genuine errors (merging double-flagged sentences) | 8 | 10, plus 3 the tool cannot see |
| Debriefs carrying a genuine error | 8 of 64 (12.5%) | 9 of 64 (14.1%) |
| Tool false-positive rate | 61.9% | 43.5% |
| Genuine errors resting on a handed number | 0 of 8 | 9 of 13 |

**The instrument changed between these two rounds, and that has to be read
carefully before any of the above is treated as a coach comparison.**
`scripts/handedCounts.js` and `scripts/grade-coach-accuracy.mjs` were both
corrected before this round was bought, so `after/grading.json` was produced by a
tool that no longer exists in that form. Anyone re-grading the old round today
gets a different tool. The two are not strictly comparable without a re-grade,
and none was bought.

Three things can be said honestly about what that does and does not explain.

1. **The jump from 7 to 14 tool-labelled "handed" false claims is not the
   handedCounts fix.** That fix taught the tool that direction counts are handed
   on every goal, and **not one of the 23 flagged claims in this round is a
   direction claim**. The jump is composition: per-swing `swingValue` flags went
   from 2 to 6 and `threshold` flags from 3 to 5 between the rounds, and the tool
   labels both kinds handed. The hand-check reaches the same conclusion
   independently, by reading the actual prompt text, so the "9 of 13 rest on a
   handed number" figure above does not depend on the tool's label at all.
2. **The rise in genuine errors, 8 to 13 claims, is small and is inflated by
   double-flagging.** Merging the three sentences flagged twice gives 10 distinct
   errors against 8, on 9 debriefs against 8. That is within the noise this
   project has repeatedly warned about at these sample sizes, and it is not
   evidence that the shipped prompt made the coach worse.
3. **What is not noise is the handed-number profile.** The previous round's eight
   genuine errors were all self-derived; this round has four claims contradicting
   an explicit handed count or average, in three separate debriefs, plus six more
   misreading the handed per-swing table. Since this slice's whole method is
   pre-counting and handing numbers over, that shift deserves a look before the
   next comparison, and it is the one number in this table that would change a
   decision.

One further caution for anyone using this tool for before-and-after work in
future, restating what Slice 9 already found. ~~The tool has no spray statistic at
all.~~ This round's prompt made the coach write spray sentences in 24 of 64 debriefs
instead of 9, and every one of those sentences is invisible to the flag count.
Two of them are genuine coach errors that no flag caught. A comparison run across
a prompt change that alters *what the coach talks about* will systematically
mis-measure it, in whichever direction the new subject happens to fall.

> *Annotation, 20 August 2026, final review of Slice 10, and this is the more
> damaging of the two places this document says it.* "The tool has no spray
> statistic at all" is false, and a forward-looking recommendation for future
> before-and-after work must not rest on it. `scripts/factSheet.js:164-170`
> carries all three spray counts per session, and at least one spray sentence
> in this very round was correctly ruled TRUE off those rows. What is actually
> missing is narrower and sits upstream: a spray count can be extracted as a
> `threshold` claim carrying no comparison and then never ruled, and the prior-
> session half of a cross-session spray comparison is never extracted at all.
> Both gaps are set out under "One correction to the hand-checks" in
> `README.md`. **The caution in the paragraph above still holds on its own
> terms** and should still be acted on: spray claims are badly under-seen by
> the flag count, and a prompt change that alters what the coach talks about
> will still mis-measure. Only the stated reason was wrong.
