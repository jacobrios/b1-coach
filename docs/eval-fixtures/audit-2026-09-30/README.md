# Pre-visibility audit, 30 September 2026

Two fresh 64-debrief rounds on the shipped prompt, graded and hand-checked, plus
the live-site pass. Read this before quoting any number from here.

## The headline

**12 of 128 debriefs (9.4%) carried a hand-checked factual error, against 23 of
127 (18.1%) in Slice 11's two rounds.** Same seeds, same swings, same grader
(Slice 11's graded claims replay through today's verdict code with 0 of 1,732
verdicts changing); the only differences are the prompt changes since (number
slots, best swing) and the bench now filling placeholders as the app does.

| | Slice 11 after-a | Slice 11 after-b | Audit after-a | Audit after-b |
|---|---|---|---|---|
| Debriefs with a genuine error | 14 of 64 | 9 of 63 | 9 of 64 | 3 of 64 |
| Genuine, share of ruled claims | 3.47% | 1.84% | 2.05% | 0.60% |
| Flagged transcription errors | 5 | 3 | 0 | 0 |

**Caveats, all of which matter:**
- **Two rounds cannot prove the drop.** after-a sits inside Slice 11's recorded
  same-condition band (8 to 19 genuine errors); after-b falls below it, the
  first round in the series to do so. Read it as a likely improvement, not a
  measured one.
- **Flagged claims only**, as in Slice 11. Errors the grader misses are not
  counted; one unflagged transcription error (a misordered prior-session count)
  and two zone mischaracterisations were seen in passing.
- **Not comparable with the one-in-twelve baseline** (different grader, cells,
  prompt and generator). It is left out on purpose.
- **Raw flags overstate errors badly here.** 67 of 85 were one tool mechanism:
  the app writes pitch height to one decimal (1.78 as 1.8) and the grader
  compares against two. Tool false-positive rate 77% and 94%.

## What the errors are now

The transcription class number slots were built to remove (8 of Slice 11's 23)
is absent from the flags. 10 of the 12 genuine errors are one shape: a blanket
claim about a handed group of pitches that one member breaks ("swings 2, 9 and
12 ... none of them got above 8 degrees", swing 9 being 24). A new variant:
the coach uses a placeholder as a threshold ("below {{s1.sw9.ht}} feet"), so
the digit is right and the sentence is false.

## Slot adoption

**95.1% on the shipped wording** (635 placeholders, 33 typed values, 0
unresolvable, 0 failed calls in 128), up from 85.3% in the 16-debrief probe of
the draft wording. `node docs/eval-fixtures/audit-2026-09-30/count-adoption.mjs`
recomputes it for free and first proves the rebuilt sessions are the ones the
coach saw.

## Files

- `after-a/`, `after-b/`: bench records (`shipped-64.json`), `BUILDER.txt`,
  grading output. Seeds 20260814 and 20260819.
- `HAND-CHECK.md`: every flag adjudicated; four rulings re-verified
  independently against rebuilt sessions.
- `browser-pass/`: live-site notes (22 debriefs, 1 chat, five goals at
  sessions 1 and 4, desktop and iPad) and screenshots.

Spend: bench $2.59, grading $0.81, live site about $0.45 (estimated).
