# Pre-visibility audit, 30 September 2026

Two fresh 64-debrief rounds on the shipped prompt, graded and hand-checked, plus
the live-site pass. Read this before quoting any number from here.

## The headline

**12 of 128 debriefs (9.4%) carried a flagged, hand-checked factual error,
against 23 of 127 (18.1%) in Slice 11's two rounds.** Same seeds, same swings,
same grader: the extraction prompt, grading model and generator are unchanged
since Slice 11, and its stored claims replay through today's verdict code with
0 of 1,732 verdicts changing across all three of its rounds. The only
differences are the prompt changes since (number slots, best swing) and the
bench now filling placeholders as the app does.

| | Slice 11 after-a | Slice 11 after-b | Audit after-a | Audit after-b |
|---|---|---|---|---|
| Debriefs with a genuine error | 14 of 64 | 9 of 63 | 9 of 64 | 3 of 64 |
| Genuine, share of ruled claims | 3.47% | 1.84% | 2.05% | 0.60% |
| Flagged per-swing transcription errors | 3 | 3 | 0 | 0 |

**Caveats, all of which matter:**
- **9.4% is a floor, not a rate.** Only flagged claims are counted, as in Slice
  11, so the comparison is fair but the absolute figure is low. One unflagged
  genuine error and two zone mischaracterisations were seen in passing, and a
  full read of 10 live debriefs found a genuine error in 3 of them (4 by the
  stricter standard in `browser-pass/NOTES.md`).
- **Two rounds cannot prove the drop.** after-a sits inside Slice 11's recorded
  same-condition band (8 to 19 genuine errors); after-b falls below it, the
  first round in the series to do so. Likely an improvement, not a measured one.
- **Not comparable with the one-in-twelve baseline** (different grader, cells,
  prompt and generator). It is left out on purpose.
- **Raw flags overstate errors badly here.** 67 of 85 were one tool mechanism:
  the app writes pitch height or side to one decimal (1.78 as 1.8) and the
  grader compares against two. Tool false-positive rate 77% and 94%.

## What the errors are now

Of Slice 11's 8 transcription errors, 6 were per-swing values, the class number
slots target; none recurred among the flags. The other 2 were handed counts
contradicted, which slots do not cover, and one such error was seen unflagged
here.

11 of the 12 genuine errors concern a handed group of pitches: 8 are blanket
claims that one member breaks ("swings 2, 9 and 12 ... none of them got above 8
degrees", swing 9 being 24), and 3 are miscounted subsets of the four wide
pitches ("three of them came in under 85 mph", all four did). The 12th is the
blanket shape over a launch-angle group. A new variant: the coach uses a
placeholder as a threshold ("below {{s1.sw9.ht}} feet"), so the digit is right
and the sentence false.

## Slot adoption

**95.1% on the shipped wording** (635 placeholders, 33 typed values, 0
unresolvable, 0 failed calls in 128), up from 85.3% in the 16-debrief probe of
the draft wording. `node docs/eval-fixtures/audit-2026-09-30/count-adoption.mjs`
recomputes it for free and first proves the rebuilt sessions are the ones the
coach saw.

## Files

- `after-a/`, `after-b/`: bench records (`shipped-64.json`), `BUILDER.txt`,
  grading output. Seeds 20260814 and 20260819.
- `HAND-CHECK.md`: every flag adjudicated; rulings re-verified independently
  against rebuilt sessions.
- `browser-pass/`: live-site notes (22 debriefs, 1 chat, five goals at
  sessions 1 and 4, desktop and iPad) and screenshots.

Spend: bench $2.59, grading $0.81, live site about $0.45 (estimated).

*Postscript, 30 September 2026, later.* The grader now accepts a pitch height
or side stated to one decimal. Replayed under it, these rounds hold 13 and 5
raw flags, not 39 and 46; the hand-checked genuine counts are unchanged.
`replay-rounding-fix.txt` shows every change.
