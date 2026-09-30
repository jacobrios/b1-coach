# Hand-check: every flagged claim in the 30 September 2026 audit rounds

30 September 2026. Two rounds of 64 debriefs against the shipped prompt,
`after-a/` (seed 20260814) and `after-b/` (seed 20260819). 85 raw FALSE flags.
67 were pre-sorted as one known mechanism (pitch height and side rounded to one
decimal by `src/numberSlots.js`, compared by exact equality against a
two-decimal fact sheet); 5 of those were spot-checked here. The other 18 are
adjudicated one at a time below.

Ground truth was rebuilt through `resolveSessions` exported from
`scripts/grade-coach-accuracy.mjs` (builder `current`, each round's seed), and
the prompt the coach read through `buildDebriefUserMessage` in
`src/coachApi.js`, to decide handed versus derived. The rebuild is confirmed by
`node docs/eval-fixtures/audit-2026-09-30/count-adoption.mjs`, run today:
"Every record re-filled to exactly its stored text, so the rebuilt sessions are
the ones the coach saw."

Conventions as in Slice 11: `STRIKE_ZONE` inclusive (height 1.5 to 3.5, side
-0.7 to 0.7), `DISTANCE_BUCKETS` half-open, `SPRAY_CUTOFFS` strict. A value
sitting exactly on a threshold the coach stated as strict ("under 82") is ruled
GENUINE, following Slice 11's precedent, and flagged as weak where it applies.

Quoted coach sentences are verbatim and keep the coach's em dashes; my own
prose uses none.

---

## 1. Summary per round

Ruled claims are TRUE plus FALSE from each `grading.json`.

| | `after-a` (20260814) | `after-b` (20260819) |
|---|---|---|
| Claims ruled (TRUE + FALSE) | 440 (401 + 39) | 499 (453 + 46) |
| Raw FALSE flags | 39 | 46 |
| Rounding false positives | 26 | 41 |
| Other false positives | 4 | 2 |
| **GENUINE** | **9** | **3** |
| Tool false-positive rate | 30 of 39, **76.9%** | 43 of 46, **93.5%** |
| Tool false-positive rate, rounding set aside | 4 of 13, 30.8% | 2 of 5, 40.0% |
| Genuine as a share of ruled claims | **2.05%** | **0.60%** |
| Debriefs carrying a genuine error | **9 of 64** (14.1%) | **3 of 64** (4.7%) |

No sentence among the 18 was flagged twice, so the 12 genuine claims are 12
distinct errors in 12 distinct debriefs.

Two of `after-a`'s nine are boundary-weak (claims A5 and A6: a value exactly on
the coach's own strict threshold). Discounting them gives `after-a` 7 genuine,
1.59% of ruled claims.

## 2. Beside Slice 11

| | Slice 11 `after-a` | Slice 11 `after-b` | Audit `after-a` | Audit `after-b` |
|---|---|---|---|---|
| Seed | 20260814 | 20260819 | 20260814 | 20260819 |
| Debriefs graded | 64 | 63 | 64 | 64 |
| Claims ruled | 404 | 490 | 440 | 499 |
| Raw FALSE flags | 20 | 25 | 39 | 46 |
| Rounding false positives | 0 (no placeholders then) | 0 | 26 | 41 |
| Other false positives | 6 | 16 | 4 | 2 |
| GENUINE | 14 | 9 | 9 | 3 |
| Tool false-positive rate | 30.0% | 64.0% | 76.9% | 93.5% |
| Genuine as a share of ruled | 3.47% | 1.84% | 2.05% | 0.60% |
| Debriefs with a genuine error | 14 of 64 | 9 of 63 | 9 of 64 | 3 of 64 |

**Against the recorded same-condition band (8 to 19 genuine, 1.8% to 3.8% of
ruled claims): `after-a` sits inside it at 9 and 2.05%; `after-b` sits below
it on both measures, at 3 and 0.60%, the first round in this series to come in
under the band rather than inside it.** Read that as a lead, not a result: it
counts flagged claims only, like Slice 11's table, and this pass found one
unflagged genuine error in `after-b` in passing (section 6), which would make
it 4 and 0.80%, still below the band.

## 3. Genuine errors by kind

Transcription means a wrong per-swing figure or a handed count copied wrong.
Derivation or characterisation means counting, intersecting or describing a
group the coach assembled itself.

| | Transcription | Derivation or characterisation |
|---|---|---|
| Slice 11 `after-a` (14) | 5: claims 4, 5, 6 (swing 11's 87 mph written as 89), 7 (handed oppo count contradicted), 20 (handed weak-grounder count contradicted) | 9: claims 1, 2 (self-chosen height range), 12 to 16, 18, 19 (subsets of the four wide swings) |
| Slice 11 `after-b` (9) | 3: claims 4, 8, 9 (a per-swing value collapsed across a named pair) | 6: claims 1, 2, 11, 15, 18 (subset or boundary), 20 (a pair described with one distance) |
| Audit `after-a` (9) | **0** | 9 |
| Audit `after-b` (3) | **0** | 3 |

Slice 11's document makes this split possible; every genuine claim there quotes
the sentence and names its shape.

**Every flagged genuine error in the audit rounds is a derivation, and eleven
of the twelve concern a handed pitch-location group.** *(Corrected on review,
same day: an earlier draft said ten of the twelve were one shape.)* Eight are
blanket claims that one member breaks (A1, A3, A5, A6, A7, B1, B2, B3); three
are miscounted subsets of the wide group (A9, A11, A13); A4 is the blanket
shape over a launch-angle group. Seven are about session 1's
three low pitches (swings 2, 9 and 12), which are handed verbatim as "Swings on
pitches low (height below 1.5ft): 3 swings — numbers: 2, 9, 12", and swing 9
(74 mph, 24 degrees, 201 feet) is the outlier every time. Three are about the
four wide pitches in the shared `after-a` session 4 draw (swings 2, 3, 8, 12 at
77, 84, 77, 84 mph), the identical group and near-identical sentence Slice 11
recorded seven times. Of Slice 11's 8 transcription errors, the 6
per-swing ones (the class slots target) are absent here; the 2 handed-count
contradictions did not recur among flags either, but slots do not cover counts. One unflagged transcription error was seen in
passing (section 6), and it is a handed prior-session count, which placeholders
do not cover.

**A new coach-side shape, and it is Slice 15's own limit showing up in the
data:** twice in `after-a` (A5, A7) the coach wrote a placeholder where a
threshold belonged, "below {{s1.sw9.ht}} feet" and "below {{s1.sw2.ht}} ft".
The app filled each digit correctly, and the sentence is false anyway, because
the coach used one group member's own value as the boundary for the whole
group. `after-b` B3 is the same move typed by hand ("above 122 feet", swing 2's
own distance). The digit is guaranteed; the relationship around it is not.

## 4. Spot-check of 5 rounding flags

Each was checked against the rebuilt session and against `rawFields` to confirm
the number came from a placeholder.

| Flag | Cell and run | Coach wrote | Placeholder | True value | Rounded |
|---|---|---|---|---|---|
| `after-a` rounding #0 | power-s2 run1 tip1, S2 swing 12 | "swing 12 was at 4.2 ft" | `{{s2.sw12.ht}}` | 4.19 | 4.2 |
| `after-a` rounding #5 | contact-s4 run6 tip1, S4 swing 12 | "-1.4 feet wide" | `{{s4.sw12.side}}` | -1.44 | -1.4 |
| `after-a` rounding #11 | open-s4 run5 tip1, S4 swing 8 | "-0.8 feet wide" | `{{s4.sw8.side}}` | -0.79 | -0.8 |
| `after-b` rounding #1 | contact-s4 run1 tip2, S4 swing 9 | "3.8 and 3.7 feet" | `{{s4.sw9.ht}}` | 3.66 | 3.7 |
| `after-b` rounding #12 | open-s4 run1 tip2, S4 swing 11 | "a pitch at 2 feet" | `{{s4.sw11.ht}}` | 1.96 | 2 (2.0) |

**All five: the stated value is the true value rounded to one decimal, and each
was written by the app, not the coach.** No exception found. Beyond the five, a
script compared all 67 flags' stated values against their `actual` fields: all
67 equal the true value rounded to one decimal.

---

## 5. The 18 claims

Session 1 is hand-written and identical in every cell and seed. The rows that
decide most of this section:

```
Swing 2: 72 mph, 8°, 122 ft, pitch 1.2 / -0.3
Swing 9: 74 mph, 24°, 201 ft, pitch 1.4 / 0.5
Swing 12: 78 mph, 2°, 117 ft, pitch 0.8 / -0.2
```

The `after-a` session 4 draw shared by `open-s4` and `allfields-s4`: wide
swings 2, 3, 8, 12 at pitch side 1.38, -0.76, -0.79, 0.75 and exit velocity 77,
84, 77, 84 (mean 80.5), handed as "Swings on pitches wide (side outside -0.7 to
0.7ft): 4 swings — numbers: 2, 3, 8, 12".

### Round `after-a`

**A1. power-s1 / run4, tip1**

"Six of your swings came on pitches outside the strike zone, and those produced
your flattest contact — swings 2, 9, and 12 all came in below 15 degrees launch
angle."

Ground truth: launch angles 8, **24**, 2. The handed below-15 line is "5 swings
— numbers: 2, 4, 11, 12, 15", which does not contain 9.

**GENUINE.** Intersection of two handed groups (low pitches, below 15 degrees)
derived by the coach. Numbers typed, derived.

**A2. power-s1 / run4, tip1**

"Next session, let the borderline pitch go and wait for something between 1.5
and 3.5 feet — that's where swing 5 lived at 2.6 feet, and it went 346 feet."

Ground truth: swing 5 pitch height 2.6. Correct. The tool compared it against
pitch side (0.4).

**FALSE POSITIVE.** M5, wrong statistic (height filed as side). Written by a
placeholder (`{{s1.sw5.ht}}`).

**A3. power-s1 / run5, tip2**

"You swung at pitches below the zone on swings 2, 9, and 12, and none of them
got above 8 degrees of launch angle."

Ground truth: 8, **24**, 2. Swing 9 is 16 degrees over.

**GENUINE.** Blanket claim over a handed pitch-location group that one member
breaks. Group handed; the claim derived.

**A4. power-s1 / run7, tip1**

"Five swings came in below 15 degrees of launch angle, and those stayed under
175 feet."

Ground truth: the five (2, 4, 11, 12, 15) are handed, and correct. Their
distances are 122, 159, **229**, 117, 156. Swing 11 did not stay under 175.

**GENUINE, though the tool's reason is wrong.** It checked a whole-session count
of balls under 175 (4) against 5; the coach's actual error is that one of its
five named swings carried 229 feet. Named group over-generalised, the Slice 9
"all flat and weak" shape. The count was handed; the characterisation derived.

**A5. power-s1 / run8, tip1**

"Swings 2, 9, and 12 were all on pitches below 1.4 feet, and none of them got
above 24 degrees of launch."

Ground truth: pitch heights 1.2, **1.4**, 0.8. Swing 9 is not below 1.4. The
launch-angle half is true (8, 24, 2; none above 24).

**GENUINE, and boundary-weak.** The coach wrote `below {{s1.sw9.ht}} feet`: a
placeholder used as the threshold, which puts swing 9 exactly on its own
boundary. The digit was written by the app and is right; the relationship was
derived and is wrong.

**A6. power-s2 / run8, tip1**

"Swings 1, 11, 12, and 14 were all on pitches above 3.5 feet, and all four came
in under 82 mph."

Ground truth: heights 3.63, 3.55, 4.19, 3.60, handed as the high group, all
correct. Exit velocities **82**, 77, 69, 80. Three under 82.

**GENUINE, boundary-weak.** Subset over a handed pitch-location group; derived.

**A7. contact-s1 / run10, tip2**

"You swung at 6 pitches outside the zone, including swings 2, 9, and 12 down
below 1.2 ft."

Ground truth: heights **1.2**, **1.4**, 0.8. Only swing 12 is below 1.2.

**GENUINE.** Same placeholder-as-threshold shape as A5 (`below {{s1.sw2.ht}}
ft`), and not weak: swing 9 is 0.2 feet above the stated ceiling. The count of 6
is handed and right.

**A8. contact-s4 / run5, whatThisMeans**

"That is why your angles are cleaner and your line drive count jumped to 9
swings this round."

Ground truth: handed verbatim for session 4, "Swings with launch angle in the
target 8-18 degrees (including both 8 and 18): 9 swings". Session 3 was 8, so
"jumped" is generous but not false. The tool graded it against the fly-ball
count (5).

**FALSE POSITIVE.** M5, wrong statistic. Handed.

**A9. open-s4 / run2, tip1**

"Swings 2, 3, 8, and 12 were all on pitches wide of the zone, and three of them
came in under 85 mph."

Ground truth: 77, 84, 77, 84. All **four** are under 85.

**GENUINE.** Subset of the handed wide group, derived. Identical to Slice 11
`after-a` claims 13 and 14, on the identical draw.

**A10. open-s4 / run5, tip2**

"Swing 7 was your best of the day at 92 mph and 353 feet — that pitch was at
3.1 feet, right in your power zone."

Ground truth: swing 7 pitch height 3.07, which fills to 3.1. The tool compared
3.1 against pitch side (0.17).

**FALSE POSITIVE.** M5, wrong statistic (height filed as side). Placeholder
(`{{s4.sw7.ht}}`).

**A11. allfields-s4 / run1, tip2**

"Swings 2, 3, 8, and 12 were all on pitches off the plate wide, and three of
those came in under 84 mph."

Ground truth: 77, **84**, 77, **84**. Two under 84.

**GENUINE.** Subset of the handed wide group, derived. Same as Slice 11
`after-a` claims 12, 15, 16, 18.

**A12. allfields-s4 / run3, tip1**

"Four of your six swings on pitches outside the zone this session went wide —
swings 2, 3, 8, and 12 — and those four averaged below 82 mph."

Ground truth: the mean of 77, 84, 77, 84 is 80.5, below 82. True. The tool
counted swings under 82 (2) against a stated 4.

**FALSE POSITIVE.** An average of a named subset ruled as a count, the
mechanism Slice 11 first recorded at `after-b` claim 19. Handed group, derived
average, correct.

**A13. allfields-s4 / run8, tip1**

"Swings 2, 3, 8, and 12 were all on pitches wide of the zone, and three of
those four came in under 84 mph."

Ground truth: two of four.

**GENUINE.** Same as A11, word for word the sentence Slice 11 recorded at
`after-a` claim 12.

### Round `after-b`

**B1. power-s1 / run1, tip2**

"Swings 2, 9, and 12 were all on pitches below 1.5 feet, and none of them got
above 8 degrees of launch angle."

Ground truth: 8, **24**, 2.

**GENUINE.** Same as A3. Derived.

**B2. power-s1 / run2, tip1**

"Swings 2, 9, and 12 were all on pitches below 1.5 feet, and none of them broke
75 mph."

Ground truth: 72, 74, **78**. Swing 12 broke 75.

**GENUINE.** Blanket claim over the handed low group. Derived.

**B3. power-s1 / run5, tip1**

"Swing 5 left the bat at 92 mph and went 346 feet, but swings 2, 9, and 12 were
all on pitches below 1.5 feet and none of them got above 122 feet."

Ground truth: 122, **201**, 117. Swing 9 carried 201 feet.

**GENUINE.** Blanket claim over the handed low group, with a typed number that
is swing 2's own distance used as the ceiling (the typed analogue of A5 and
A7). Derived.

**B4. contact-s1 / run5, coachingSummary**

"But only 4 of 15 swings landed in the line drive window."

Ground truth: handed verbatim, "Swings with launch angle in the target 8-18
degrees (including both 8 and 18): 4 swings". Correct. The tool graded it
against the strike-zone count (9).

**FALSE POSITIVE.** M5, wrong statistic. Handed.

**B5. contact-s4 / run8, tip2**

"You swung at 6 pitches outside the zone, and swings like 5 and 9 — both high at
3.8 and 3.7 feet — produced a 43-degree pop-up and a 23-degree fly ball under 80
mph."

Ground truth: swing 5 is 74 mph at 43 degrees, pitch 3.82; swing 9 is 77 mph at
23 degrees, pitch 3.66. Outside-the-zone count 6 is handed. Every number is
right, and "under 80 mph" is true whether it modifies one ball or both. The
tool read the phrase as "exactly one of the two under 80".

**FALSE POSITIVE.** A description attached to one member read as an exclusive
count, a variant of "illustrative list read as exhaustive". Heights by
placeholder, angles typed and correct.

### Tally

| | Genuine | False positive |
|---|---|---|
| `after-a` | A1, A3, A4, A5, A6, A7, A9, A11, A13 (9) | A2, A8, A10, A12 (4) |
| `after-b` | B1, B2, B3 (3) | B4, B5 (2) |

False-positive mechanisms among the 18: M5 wrong statistic 4 (A2, A8, A10, B4),
average read as a count 1 (A12), one-member description read as a count 1 (B5).
No mechanism seen here is new to the tool.

---

## 6. Unflagged errors noticed in passing

Only flagged debriefs were read, and only for pitch-location wording plus
anything that jumped out. Not counted in the tables above, as in Slice 11.

1. **`after-b` contact-s4 / run8, coachingSummary: a handed count sequence
   misordered.** "Jake, your launch angle control was the best it's been all
   practice — 8 swings in the target zone compared to 6, 5, and 4 in Sessions 1
   through 3." Handed launch-angle-window counts are 4, 6 and 5 for sessions 1,
   2 and 3. Clear transcription error of handed counts, the prior-session
   ordering shape Slice 8c recorded. Placeholders do not reach prior-session
   counts, so nothing stopped it. The tool flagged a different sentence in this
   debrief (B5) and missed this one.
2. **`after-a` popup-s4 / run8, tip2.** "That pitch was at 1.8 feet, middle of
   the zone." Swing 13's pitch is 1.78, 0.28 feet above the bottom of a zone
   whose middle is 2.5. The exact example Slice 11 named. The tool's flag here
   was the rounding one.
3. **`after-a` popup-s4 / run2, tip2.** "That height is the heart of the zone,
   and you drove it 241 feet up the middle — that is what staying through the
   ball looks like." Same pitch, 1.78.
4. Arguable, not counted: `after-a` open-s4 run2 tip2, "that pitch was right in
   the middle of the zone at 3.1 feet", and run6 tip2, "both on pitches middle
   of the zone", for swing 7 at 3.07 (upper fifth of the zone) and swing 4 at
   2.82; `after-b` popup-s4 run6 tip2, swing 6 "came off a pitch right in the
   heart of the zone", at height 2.92 but side 0.62, 0.08 feet inside the edge;
   `after-b` open-s4 run5 tip1, 3.66 called "well above the zone" (0.16 over).
5. Wording, not counted: `after-b` contact-s1 / run5, tip2, "including swings
   2, 9, and 12 on pitches below 1.2, 1.4, and 0.8 feet", where each number is
   a placeholder for that swing's own height, so read literally each pitch is
   below itself. Same placeholder-as-boundary habit as A5 and A7, harmless here
   because the meaning ("down at") is plain.
