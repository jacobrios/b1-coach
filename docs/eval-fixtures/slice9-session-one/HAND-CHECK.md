# Slice 9 hand-check: adjudicating all 60 FALSE claims

Written 19 August 2026. Offline throughout: no API calls, no `--env-file`, no tracked
file edited. Ground truth was rebuilt with `resolveSessions` from
`scripts/grade-coach-accuracy.mjs`, through the inline extensionless-import loader hook
copied from `scripts/measure-swing-generation.mjs`, with the builder and seed each round
was actually graded under:

| round | builder | seed |
| --- | --- | --- |
| before | `slice9-before` | 20260814 |
| after-a | `current` | 20260814 |
| after-b | `current` | 20260819 |

## Two structural facts established before any claim was judged

**1. `power-s1` and `contact-s1` are byte-identical between rounds A and B.** Verified by
comparing the rebuilt swing arrays: `after-a` and `after-b` produce the same fifteen
session-1 swings, because session 1 is not generated. Those 24 records per round are the
seed-independent comparison.

**2. Sessions 2, 3 and 4 are byte-identical between the `before` round and the `after-a`
round.** Also verified by comparison. Both rounds ran at seed 20260814, and the generator
drives every later session off session 1's *averages*, which the rewrite deliberately held
constant (82 mph, 17 degrees). So on the four session-4 cells and `power-s2`, the coach in
the before round and the coach in the after-a round were looking at exactly the same
swings. The only thing that differs is the session-1 baseline quoted in the prompt. This
makes before-vs-after-a a controlled comparison across all 64 records, not just the 24.

`after-b` used a different seed, so its `power-s2` and session-4 cells are different data
entirely and are NOT comparable to the other two rounds on those cells.

### The old and new session 1, side by side

| # | old EV/LA/dist/ph | new EV/LA/dist/ph |
| --- | --- | --- |
| 1 | 78 / 12 / 170 / 2.8 | 86 / 22 / 272 / 2.8 |
| 2 | 72 / 8 / 122 / 1.2 | 72 / 8 / 122 / 1.2 |
| 3 | 88 / 26 / 310 / 3.1 | 76 / 19 / 192 / 3.1 |
| 4 | 75 / 6 / 126 / 2.3 | 75 / 13 / 159 / 2.3 |
| 5 | 91 / 28 / 345 / 2.6 | 92 / 27 / 346 / 2.6 |
| 6 | 82 / 18 / 224 / 3.8 | 81 / 24 / 249 / 3.8 |
| 7 | 76 / 10 / 150 / 2.1 | 89 / 15 / 246 / 2.1 |
| 8 | 85 / 24 / 277 / 2.9 | 87 / 20 / 266 / 2.9 |
| 9 | 79 / 14 / 185 / 1.4 | 74 / 24 / 201 / 1.4 |
| 10 | 83 / 20 / 241 / 3.3 | 78 / 22 / 219 / 3.3 |
| 11 | 87 / 22 / 279 / 2.7 | 87 / 14 / 229 / 2.7 |
| 12 | 70 / 4 / 97 / 0.8 | 78 / 2 / 117 / 0.8 |
| 13 | 86 / 25 / 290 / 2.4 | 89 / 25 / 311 / 2.4 |
| 14 | 80 / 16 / 201 / 3.6 | 78 / 19 / 204 / 3.6 |
| 15 | 92 / 27 / 346 / 2.5 | 82 / 6 / 156 / 2.5 |

Power zone (`power`: LA 25-35 and EV >= 88): old = swings 3, 5, 15. New = swings 5, 13.

## Rules applied, stated up front and applied identically everywhere

1. **Paired-value reversal is a GENUINE error.** When the coach names two subjects and
   then two correct values in the wrong order ("down from 83 and 84 in Sessions 2 and 3"
   when S2 was 84 and S3 was 83; "swings 5 and 13 ... both went 311 and 346 feet" when 5
   went 346), the values are right and the attribution is wrong. Project precedent (Slice
   8c's own hand-check) counted this shape as a genuine contradiction of a handed number,
   so this adjudication does the same. Each such sentence produces two FALSE claims from
   the tool; both are counted GENUINE, and the count of *authorial* reversal events is
   reported separately so the number can be re-cut if the product manager disagrees.
2. **An explicit count is graded against the true count of the property, within the scope
   the sentence names.** An undercount is a genuine error, not a permitted understatement.
   This follows the project's own treatment of "four of those were under 80 mph" when all
   six were.
3. **"Including", "such as", "several of those were" followed by a correct partial list is
   NOT a claim of exhaustivity.** A tool flag on that basis is a false positive.
4. **A hedged quantifier ("most") is judged as a hedge**, not as a number.
5. **Threshold slips are genuine, including at the boundary.** "Under 88 mph" applied to a
   swing that is exactly 88 is a coach error. These are counted GENUINE but tallied
   separately as `equals-threshold`, because they are the mildest shape in the set.
6. **Loose rounding in the conservative direction is not an error** ("both went 305 feet or
   more" for 346 and 311). No claim in this set needed this rule to survive; the tool had
   already marked those UNVERIFIABLE.

## Named false-positive mechanisms

| code | mechanism | count |
| --- | --- | --- |
| M1 | Named subset graded against a whole-session total | 3 |
| M2 | Value matched against the wrong swing (an ordinal phrase read as a swing index) | 3 |
| M3 | Illustrative or partial list read as exhaustive | 2 |
| M4 | Named-swing check fired on an empty list (tool bug) | 1 |
| M5 | Graded against the wrong statistic entirely | 7 |
| M6 | Hedged quantifier turned into a numeric count of zero | 1 |
| M7 | An exclusion word ("five *other* swings") dropped in extraction | 1 |
| | **total** | **18** |

---

# Itemisation: all 60 FALSE claims

Format: round | cell | run — quote — what the coach actually said — the real data — verdict.

## Round: before (16 FALSE claims; 14 GENUINE, 2 false positives)

**1. before | power-s1 | run 6 | tip2**
Quote: "Your three power zone swings — 88, 91, and 92 mph — all came on pitches between 2.4
and 3.1 feet high".
Full claim: a statement about the three power-zone swings only.
Data: power-zone swings in the old session 1 are 3, 5, 15, at pitch heights 3.1, 2.6, 2.5 —
all inside 2.4-3.1.
Tool said: "pitchHeight between 2.4 and 3.1 inclusive: 7".
**FALSE_POSITIVE — M1.**

**2. before | power-s1 | run 8 | tip1**
Quote: "four of those were on pitches below 1.5 feet".
Full sentence: "Six of your swings came in under 15 degrees of launch angle, and four of
those were on pitches below 1.5 feet."
Data: the six under-15 swings are 1, 2, 4, 7, 9, 12; of those, below 1.5 ft are 2 (1.2), 9
(1.4), 12 (0.8) = **3**, not 4.
**GENUINE.** handed=true.

**3. before | power-s1 | run 8 | tip2**
Quote: "Swings 3, 5, and 15 all hit 88 mph or better with launch angles between 25 and 27
degrees".
Data: launch angles 26, 28, 27. Swing 5 is 28, outside the stated range.
**GENUINE (off-by-one range boundary).** handed=false.

**4. before | power-s1 | run 9 | tip2**
Quote: "Swings 3, 5, and 15 all hit 88 mph or better and landed between 25 and 27 degrees".
Same data, same defect as #3.
**GENUINE (off-by-one range boundary).** handed=false.

**5. before | power-s1 | run 12 | tip2**
Quote: "came on pitches between 2.4 and 3.1 feet high".
Full sentence: "Your three best swings — 88, 91, and 92 mph — all came on pitches between
2.4 and 3.1 feet high and landed within 0.5 feet of center."
Data: swings 3, 5, 15 at heights 3.1, 2.6, 2.5 and side -0.5, 0.4, 0.1. Both halves true.
**FALSE_POSITIVE — M1.**

**6. before | power-s2 | run 1 | tip1**
Quote: "five of your swings landed between 14 and 17 degrees".
Data (session 2): launch angles in 14-17 inclusive are swings 8 (17), 9 (16), 10 (14), 12
(14) = **4**.
**GENUINE.** handed=false.

**7. before | power-s2 | run 4 | tip2**
Quote: "none of them got above 87 mph" (of swings 7, 9, 15).
Data: 88, 87, 83. Swing 7 is 88.
**GENUINE.** handed=false.

**8. before | power-s2 | run 5 | tip1**
Quote: "all three came in under 88 mph exit velocity" (swings 7, 9, 15).
Data: 88, 87, 83. Swing 7 is exactly 88.
**GENUINE (equals-threshold).** handed=false.

**9. before | contact-s1 | run 4 | tip2**
Quote: "two of them came off under 80 mph".
Full sentence: "...three that were below 1.5 feet on swings 2, 9, and 12. Those low pitches
got you under the ball, and two of them came off under 80 mph."
Data: swings 2, 9, 12 are 72, 79, 70 mph — **all three** are under 80.
**GENUINE (undercount, rule 2).** handed=false.

**10. before | contact-s1 | run 11 | tip1**
Quote: "Six of your fifteen swings had a launch angle above 18 degrees".
Data: 7 (swings 3, 5, 8, 10, 11, 13, 15). The same debrief's own summary says "seven".
**GENUINE.** handed=true.

**11. before | contact-s1 | run 11 | tip2**
Quote: "two came back under 80 mph".
Full sentence: "...three below 1.5 feet on swings 2, 9, and 12. Those low pitches got you —
two came back under 80 mph and both had launch angles under 14 degrees."
Data: all three are under 80 (72, 79, 70). The conjoined clause is true of swings 2 and 12
only, so a reading exists on which the coach meant that pair. Under rule 2 the count claim
is still an undercount, and this is graded the same way as #9.
**GENUINE (undercount, rule 2; the most arguable call in the set).** handed=false.

**12. before | contact-s4 | run 8 | tip2**
Quote: "Three of your outside-zone swings — numbers 10 and 13 — were on pitches below 1.5
feet".
Data (session 4): below 1.5 ft are swings 10 (0.58) and 13 (0.61) = 2. The sentence says
"three" and then names two, so it is wrong against the data and against itself.
**GENUINE.** handed=false.

**13. before | open-s4 | run 8 | tip2**
Quote: "your launch angle on the weak ones — swings 1, 10, 12, 13 — was between 6 and 10
degrees".
Data: 6, 9, 5, 10. Swing 12 is 5, below the stated floor.
**GENUINE (off-by-one range boundary).** handed=false.

**14. before | allfields-s4 | run 4 | coachingSummary (S2)**
**15. before | allfields-s4 | run 4 | coachingSummary (S3)**
Quote: "down from 83 and 84 in Sessions 2 and 3".
Data: session 2 average exit velocity 84, session 3 average 83. The pair is reversed.
**GENUINE x2 (one authorial reversal event, rule 1).** handed=true for both.

**16. before | allfields-s4 | run 6 | tip2**
Quote: "swings like 1 and 2 came on pitches way out of the zone — 3.96 and 4.04 feet high".
Data: swing 1 is 3.96 ft (correct); swing 2 is **2.06 ft**, inside the zone. 4.04 is swing
13's height.
**GENUINE.** handed=true.

## Round: after-a (29 FALSE claims; 19 GENUINE, 10 false positives)

**17. after-a | power-s1 | run 1 | coachingSummary**
Quote: "You hit 92 and two swings at 89 mph" — graded against swing 1 (86 mph).
Data: top three exit velocities are 92 (swing 5), 89 (swing 7), 89 (swing 13). Correct.
**FALSE_POSITIVE — M2.**

**18. after-a | power-s1 | run 1 | coachingSummary**
**19. after-a | power-s1 | run 1 | coachingSummary**
Quote: "your two power-zone swings went 346 and 311 feet" — graded against swings 1 and 2.
Data: the two power-zone swings are 5 (346 ft) and 13 (311 ft). Correct, and in order.
**FALSE_POSITIVE x2 — M2.**

**20. after-a | power-s1 | run 1 | tip1**
Quote: "five swings came in below 15 degrees, including swings 2, 12, and 15".
Data: below 15 are swings 2, 4, 11, 12, 15 = 5, and all three named are in that set.
"Including" is not a claim of exhaustivity.
**FALSE_POSITIVE — M3.**

**21. after-a | power-s1 | run 2 | tip1**
Quote: "Swings 2, 9, and 12 all came on pitches below 1.5 feet, and none of them broke 75
mph".
Data: 72, 74, **78**. Swing 12 broke 75.
**GENUINE.** handed=false.

**22. after-a | power-s1 | run 7 | tip1**
Quote: "three of them came on pitches below 1.5 feet" (of swings 2, 4, 11, 12, 15).
Data: heights 1.2, 2.3, 2.7, 0.8, 2.5. Below 1.5 = swings 2 and 12 = **2**.
**GENUINE.** handed=false.

**23. after-a | power-s1 | run 8 | tip2**
**24. after-a | power-s1 | run 8 | tip2**
Quote: "Swings 5 and 13 ... both went 311 and 346 feet".
Data: swing 5 went 346, swing 13 went 311. Correct values, reversed against the named
swings.
**GENUINE x2 (one authorial reversal event, rule 1).** handed=true for both.

**25. after-a | power-s1 | run 9 | tip1**
Quote: "none of them broke 75 mph" (swings 2, 9, 12). Swing 12 is 78.
**GENUINE.** handed=false.

**26. after-a | power-s1 | run 10 | tip2**
Quote: "all three came off at 8 degrees or lower with exit velos under 78 mph" (swings 2,
9, 12).
Data: exit velocities 72, 74, 78 — swing 12 is exactly 78. (The launch-angle half of the
same sentence is also wrong: swing 9 is 24 degrees, not "8 or lower". The tool marked that
half UNVERIFIABLE and it is not counted here.)
**GENUINE (equals-threshold).** handed=false.

**27. after-a | power-s1 | run 12 | tip2**
Quote: "none of them broke 75 mph" (swings 2, 9, 12). Swing 12 is 78.
**GENUINE.** handed=false.

**28. after-a | power-s2 | run 1 | tip2**
Quote: "Swings 7 and 9 were on pitches well below the zone, and both came out under 88
mph".
Data: swing 7 is exactly 88, swing 9 is 87.
**GENUINE (equals-threshold).** handed=false.

**29. after-a | power-s2 | run 3 | coachingSummary**
Quote: "You also cut your sub-175ft balls from 4 down to 1" — graded against
`underFifteenCount: 3`.
Data: session 1 has 4 swings under 175 ft (122, 159, 117, 156); session 2 has 1 (169). The
identical sentence was marked TRUE in runs 1 and 5 of this same round.
**FALSE_POSITIVE — M5.**

**30. after-a | power-s2 | run 4 | coachingSummary**
Same sentence, same wrong statistic.
**FALSE_POSITIVE — M5.**

**31. after-a | power-s2 | run 7 | coachingSummary**
Same sentence, same wrong statistic.
**FALSE_POSITIVE — M5.**

**32. after-a | power-s2 | run 7 | tip1**
Quote: "swings 6, 12, and 10", with heights "3.23, 1.54, and 1.63 feet".
Data: swing 6 is 3.23 (correct), swing 12 is 1.54 (correct), swing 10 is **3.09**, not
1.63. 1.63 is swing 11's height.
**GENUINE.** handed=true.

**33. after-a | power-s2 | run 8 | coachingSummary**
"You cut your under-175ft swings from 4 down to 1", same wrong statistic.
**FALSE_POSITIVE — M5.**

**34. after-a | power-s2 | run 5 | tip1**
Quote: "Your low-pitch swings on 7, 9, and 15 all came in under 84 mph exit velocity".
Data: 88, 87, 83. Only swing 15 qualifies.
**GENUINE.** handed=false.

**35. after-a | contact-s4 | run 2 | coachingSummary**
Quote: "You swung at 12 of 15 strikes" — graded against "pitchSide equal 0: 0".
Data: session 4 `inZoneCount` is 12. Correct.
**FALSE_POSITIVE — M5.**

**36. after-a | contact-s4 | run 4 | tip1**
Quote: "both came off the bat under 86 mph" (swings 10, 13).
Data: 74 and **86**. Swing 13 is exactly 86.
**GENUINE (equals-threshold).** handed=false.

**37. after-a | contact-s4 | run 8 | tip1**
Quote: "Those pitches below 1.5 feet", referring to swings 2 and 12.
Data: swing 2 is at 1.56 ft and swing 12 is at **3.02 ft** — the second is a high pitch,
not a low one. (The swings actually below 1.5 ft are 10 and 13.)
**GENUINE.** handed=true.

**38. after-a | open-s4 | run 2 | tip2**
Quote: "Swings 12 and 13 both left the bat under 10 degrees".
Data: 5 and **10**. Swing 13 is exactly 10.
**GENUINE (equals-threshold).** handed=false.

**39. after-a | open-s4 | run 3 | coachingSummary (S2)**
**40. after-a | open-s4 | run 3 | coachingSummary (S3)**
"down from 83 and 84 in Sessions 2 and 3" — reversed (S2 = 84, S3 = 83).
**GENUINE x2 (one authorial reversal event).** handed=true for both.

**41. after-a | open-s4 | run 7 | tip2**
Quote: "all three came in under 78 mph" (swings 1, 7, 13).
Data: 75, 74, **78**. Swing 13 is exactly 78.
**GENUINE (equals-threshold).** handed=false.

**42. after-a | open-s4 | run 8 | tip2**
Quote: "You chased high pitches on swings 1, 7, and 13, and all three came in under 75
mph".
Data: 75, 74, 78. Only swing 7 is under 75; swing 13 misses by 3 mph.
**GENUINE.** handed=false.

**43. after-a | allfields-s4 | run 7 | coachingSummary (S2)**
**44. after-a | allfields-s4 | run 7 | coachingSummary (S3)**
"down from 83 and 84 in Sessions 2 and 3" — reversed.
**GENUINE x2 (one authorial reversal event).** handed=true for both.

**45. after-a | popup-s4 | run 1 | coachingSummary**
Quote: "your pitch selection was the best it's been all practice with 11 strikes" — graded
against `highPitchCount: 3`.
Data: session 4 `inZoneCount` is 11. Correct.
**FALSE_POSITIVE — M5.**

## Round: after-b (15 FALSE claims; 9 GENUINE, 6 false positives)

**46. after-b | power-s1 | run 7 | tip1**
Quote: "four of those were on pitches below 1.5 feet".
Full sentence: "Five of your swings came in below 15 degrees of launch angle, and four of
those were on pitches below 1.5 feet."
Data: the five under-15 swings are 2, 4, 11, 12, 15, at heights 1.2, 2.3, 2.7, 0.8, 2.5.
Below 1.5 = **2**. (Even the whole-session figure the tool used is 3.)
**GENUINE.** handed=true.

**47. after-b | power-s1 | run 8 | tip2**
Quote: "all three came out under 75 mph" (swings 2, 9, 12). Swing 12 is 78.
**GENUINE.** handed=false.

**48. after-b | power-s1 | run 11 | tip1**
Quote: "Swings 2, 9, and 12 came in below 1.5 feet and all three came off the bat under 15
degrees".
Data: launch angles 8, **24**, 2. Swing 9 is 24 degrees.
**GENUINE.** handed=false.

**49. after-b | power-s2 | run 1 | tip2**
Quote: "Your top exit velocities were 91, 90, and 88 mph, and all three of those came on
pitches in the heart of the zone between 2.4 and 3.2 feet".
Data: 91 = swing 2 (3.17 ft), 90 = swing 15 (3.14 ft), 88 = swing 13 (2.69 ft). All three
inside the stated band. Correct.
**FALSE_POSITIVE — M1.**

**50. after-b | power-s2 | run 4 | tip2**
Quote: "swings 3, 5, and 11 were all low and wide, and those came off the bat under 87
mph".
Data: 87, 85, 84. Swing 3 is exactly 87.
**GENUINE (equals-threshold).** handed=false.

**51. after-b | power-s2 | run 7 | tip2**
Quote: "Two of those were on pitches below 1.5 feet" (of swings 1, 5, 7).
Data: heights 1.78, 0.62, 1.76. Only swing 5 is below 1.5.
**GENUINE.** handed=false.

**52. after-b | contact-s1 | run 2 | coachingSummary**
Quote: "had five other swings at 85 or better".
Full sentence: "you touched 92 and had five *other* swings at 85 or better."
Data: six swings are at 85+ (1, 5, 7, 8, 11, 13). Swing 5 is the 92. Five others. Correct.
**FALSE_POSITIVE — M7.**

**53. after-b | contact-s1 | run 9 | tip2**
Quote: "Nine of your fifteen swings came out above 18 degrees" (tool objected to the named
swings 6 and 14).
Data: nine is correct, and the sentence names 6 and 14 only as examples of *chased* pitches
("several of those were on pitches you chased out of the zone"). Both are in the above-18
set.
**FALSE_POSITIVE — M3.**

**54. after-b | contact-s1 | run 12 | tip1**
Quote: "Nine of your fifteen swings came out above 18 degrees", with `statedSwings: []`.
Data: nine is correct and the sentence names no swings at all. The tool's "the count
matches but the named swings do not" fired on an empty list.
**FALSE_POSITIVE — M4.**

**55. after-b | contact-s4 | run 2 | tip1**
Quote: "most left at launch angles of 19 degrees or higher" (of swings 5, 6, 7, 9, 12).
Data: 15, 20, 19, 20, 28 — four of five are at 19+. "Most" is true. The tool recorded
`statedCount: 0` and compared it to the whole session's 8.
**FALSE_POSITIVE — M6.**

**56. after-b | contact-s4 | run 4 | tip1**
Quote: "three of those came out above 18 degrees" (of swings 5, 6, 7, 9, 12).
Data: above 18 are swings 6 (20), 7 (19), 9 (20), 12 (28) = **4**.
**GENUINE (undercount, rule 2).** handed=false.

**57. after-b | contact-s4 | run 7 | tip1**
Quote: "Swings 5, 6, 7, 9, and 12 were all on pitches above 3.5 feet, and every one of them
flew out above 19 degrees".
Data: launch angles 15, 20, 19, 20, 28. Only three are above 19; swing 5 is 15.
**GENUINE.** handed=false.

**58. after-b | open-s4 | run 6 | coachingSummary**
Quote: "your exit velo dipped to 79 mph this round after peaking at 84 in Session 2" —
graded against `topExitVelocity: 91`.
Data: the sentence is about the average. Session 2 average exit velocity is 84, session 4's
is 79. Correct.
**FALSE_POSITIVE — M5.**

**59. after-b | open-s4 | run 8 | coachingSummary**
Quote: "you had nothing over 265 feet".
Data: swing 14 went **279 feet**.
**GENUINE.** handed=false.

**60. after-b | open-s4 | run 8 | coachingSummary**
Quote: "Session 2 was your best round — 84 mph average and four balls 265-plus feet".
Data: session 2 has **five** balls at 265+ (325, 279, 270, 291, 292).
**GENUINE (undercount, rule 2).** handed=false.

---

# A. Per-round summary

| round | records | raw FALSE | GENUINE | false positives | FP rate |
| --- | --- | --- | --- | --- | --- |
| before | 64 | 16 | 14 | 2 | 12.5% |
| after-a | 64 | 29 | 19 | 10 | 34.5% |
| after-b | 64 | 15 | 9 | 6 | 40.0% |
| **all** | 192 | **60** | **42** | **18** | **30.0%** |

Debrief-level (a debrief counted once if it holds at least one genuine error):

| round | debriefs with >=1 raw FALSE | debriefs with >=1 GENUINE error |
| --- | --- | --- |
| before | 13 / 64 | 11 / 64 |
| after-a | 22 / 64 | 16 / 64 |
| after-b | 14 / 64 | 8 / 64 |

Severity breakdown of the 42 genuine errors:

| shape | before | after-a | after-b |
| --- | --- | --- | --- |
| paired-value reversal (claims / authorial events) | 2 / 1 | 6 / 3 | 0 / 0 |
| equals-threshold boundary slip | 1 | 5 | 1 |
| off-by-one range boundary | 3 | 0 | 0 |
| substantive miscount or wrong value | 8 | 8 | 8 |
| **total genuine claims** | **14** | **19** | **9** |

# B. Genuine errors by `handed`

| round | handed (coach contradicted a number it was given) | self-derived | total |
| --- | --- | --- | --- |
| before | 5 | 9 | 14 |
| after-a | 8 | 11 | 19 |
| after-b | 1 | 8 | 9 |

Two caveats on this split, both material:

- **Reversals dominate the handed column.** 2 of before's 5, and 6 of after-a's 8, are
  paired-value reversals — one sentence shape, counted twice each by the tool. Counting
  authorial events instead of claims gives handed errors of 4 (before), 5 (after-a), 1
  (after-b).
- **The `handed` flag is the tool's, not mine, and it over-attributes.** Claims like "six
  swings were under 15 degrees, and four of *those* were on pitches below 1.5 feet" are
  marked handed=true because the pitch-height count is handed, but the error is in an
  intersection the coach worked out for itself. Claims 2, 46 and 37 are of that shape.

# C. The seed-independent comparison (`power-s1` + `contact-s1`, 24 records per round)

These 24 records are written about byte-identical session-1 data in rounds A and B, so any
A-vs-B difference is pure run-to-run noise.

| round | raw FALSE | GENUINE claims | false positives | debriefs with >=1 genuine error |
| --- | --- | --- | --- | --- |
| before (old session 1) | 8 | 6 | 2 | 4 / 24 |
| after-a (new session 1, seed 20260814) | 11 | 7 | 4 | 6 / 24 |
| after-b (new session 1, seed 20260819) | 6 | 3 | 3 | 3 / 24 |

Split by cell:

| cell | before genuine | after-a genuine | after-b genuine |
| --- | --- | --- | --- |
| power-s1 (12 records) | 3 | 7 | 3 |
| contact-s1 (12 records) | 3 | 0 | 0 |

# D. Did the coach get worse on the rewritten session 1?

**Neither, as far as this data can tell. The noise is larger than the effect.**

On the 24 seed-independent records, the old session 1 produced 6 genuine claim-errors
across 4 debriefs. The new session 1 produced 7 across 6 debriefs in one round and 3 across
3 debriefs in the other. The two after rounds are looking at *identical* data, so the gap
between them — 7 versus 3 genuine claims, 6 versus 3 affected debriefs — is entirely
run-to-run variation. The before number sits inside that gap on both measures. The same
holds on the full 64: 14 genuine claims before, 19 and 9 after; 11 affected debriefs
before, 16 and 8 after. In both views the two after rounds bracket the before round rather
than sitting to one side of it, which is what a null result looks like.

One more figure is worth putting next to that. Stripping out the two mildest shapes
(paired-value reversals and boundary slips where a value sits exactly on the coach's own
stated threshold), the count of substantive miscounts and outright wrong values is **8, 8
and 8** across the three rounds. That is not a designed control, and with counts this small
it could easily have read 6-11-7 by chance, but it is the flattest cut available and it
points the same way as everything else here.

Two things do move in a direction, and both are worth naming even though neither is
conclusive. The first is favourable: `contact-s1` produced 3 genuine errors on the old
session 1 and **zero** in both after rounds (its 3 flags in after-b are all tool errors).
The old session 1's near-perfect exit-velocity/launch-angle straight line gave that goal no
on-target swings at all, and the coach kept miscounting the "low and soft" group; the
rewrite appears to have removed the trap. The second is unfavourable and is the most
actionable finding here: the coach has a habit of grouping **swings 2, 9 and 12** as "the
low pitches" and then asserting they were all flat and all weak. That was true of the old
session 1 (72/79/70 mph at 8/14/4 degrees). It is false of the new one, where swing 9 now
launches at 24 degrees and swing 12 comes off at 78 mph. Six of the 28 genuine errors in
the two after rounds are exactly that sentence (claims 21, 25, 26, 27, 47, 48). If anything
in this slice deserves a follow-up, it is that one recurring sentence, not the aggregate
rate.

Confidence: the adjudication of each individual claim is high-confidence, since every one
was recomputed from rebuilt session data. The *comparison* is low-confidence in the
statistical sense — three rounds of 64, with a noise floor demonstrably as wide as the
effect being measured, cannot separate a small real change from chance, and this document
does not claim it can.

# Concerns

1. **The grading tool's false-positive rate is worse in this wave than the 11-42% band the
   last measurement reported, and it is worse on the after rounds specifically** (12.5%
   before, 34.5% and 40% after). That is not neutral for a before/after comparison: the
   most common mechanism, M5 (7 of 18), fires on sentences the coach only started writing
   after the rewrite ("cut your sub-175ft balls from 4 down to 1"), so the tool
   systematically over-flags the after rounds. A raw flag-count comparison across these
   three rounds would have shown the coach getting substantially worse, and that reading
   would be wrong.
2. **M5 is a fixable tool bug with a clear signature.** The extractor assigns a `statName`
   that has nothing to do with the sentence — "sub-175-foot balls" graded against
   `underFifteenCount`, "12 of 15 strikes" against `pitchSide equal 0`, "11 strikes"
   against `highPitchCount`, an average against `topExitVelocity`. Four of the seven are the
   same sentence in different runs, so one fix would remove most of them. Worth noting that
   the identical sentence was graded TRUE in two other runs of the same round, so this is
   non-determinism in extraction, not a stable rule.
3. **M4 is an outright logic bug**: the "count matches but the named swings do not" check
   fires when the extractor recorded an empty list of named swings. That should be an
   automatic pass.
4. **M1 is the mechanism the last two slices already recorded and it is still live** (3
   cases here): a named subset graded against a whole-session total.
5. **Rule 1 (paired-value reversals count as genuine) carries 8 of the 42 genuine claims,
   4 of the 5 authorial events, and all of them are in the before and after-a rounds.** If
   the product manager decides a reversal is a tool artifact rather than a coach error, the
   genuine counts become before 12, after-a 13, after-b 9 — which moves the comparison
   further toward "no change", not away from it.
6. **Rule 2 (an undercount is an error) carries 4 genuine claims** (#9, #11, #56, #60),
   spread across all three rounds, so relaxing it would not tilt the comparison either.
7. **The before-vs-after-a comparison is tighter than anyone specified.** Sessions 2, 3 and
   4 are byte-identical between those two rounds, so all 64 records are a controlled
   comparison, not just the 24. That is worth recording in the fixture README: the
   session-4 cells in those two rounds differ only in what the prompt said about session 1.
