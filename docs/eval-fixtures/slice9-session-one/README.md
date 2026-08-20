# Slice 9: rewriting the first screen's fifteen swings, measured

This directory holds the three live rounds behind Slice 9, plus the by-hand
adjudication of every claim the grading tool flagged in any of them. The
question the rounds were bought to answer is narrow and was stated before
anything was spent: **did replacing session 1's fifteen hand-written swings
make the coach describe them any less accurately?**

The answer, in one line: **no, and also not better; the run-to-run noise in
this measurement is larger than any effect the rewrite had.** The reasoning is
below, and so are the two things it would be easy to over-read.

## What is here

    session-one-before.mjs      A frozen snapshot of the FIFTEEN OLD SWINGS,
                                 committed so the before round can still be
                                 graded after the working tree stopped holding
                                 what those debriefs describe. Read by the
                                 grader's `slice9-before` builder. Not app
                                 code; nothing ships from it.
    before/shipped-64.json      64 live debriefs written about the OLD session
                                 1, generated before any data changed.
    before/BUILDER.txt          Which session data those 64 debriefs describe,
                                 and at which seed. The grader reads this and
                                 refuses a flag that disagrees with it.
    before/grading.json|.txt    The grading run for that round.
    after-a/…                   The same four files for the first after round:
                                 the NEW session 1, at the SAME seed as before.
    after-b/…                   The same, for the second after round: the same
                                 new session 1, at a DIFFERENT seed.
    HAND-CHECK.md               All 60 flagged claims across the three rounds,
                                 each read against rebuilt session data and
                                 judged a genuine coach error or a tool false
                                 positive, with the rules stated up front and
                                 applied identically everywhere.

Each round is 64 debriefs across seven bench cells: `power-s1` 12,
`contact-s1` 12, `power-s2` 8, `contact-s4` 8, `open-s4` 8, `allfields-s4` 8,
`popup-s4` 8. `contact-s1` is new in this slice; it is the screen the rewrite
most changes, and nothing had ever measured it.

## The exact commands

The three bench rounds, in the order run. The first was run at commit
`f4eb87b`, against the old data still in the working tree; `8b07ab0` is the
commit that carries its output, not the code it ran against. The other two ran
after the rewrite landed at commit `3d13cb5`.

```
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice9-session-one/before/shipped-64.json

node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice9-session-one/after-a/shipped-64.json

node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260819 --out docs/eval-fixtures/slice9-session-one/after-b/shipped-64.json
```

The three grading rounds:

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice9-session-one/before --builder slice9-before --seed 20260814 \
  --out docs/eval-fixtures/slice9-session-one/before/grading.json \
  | tee docs/eval-fixtures/slice9-session-one/before/grading.txt

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice9-session-one/after-a --builder current --seed 20260814 \
  --out docs/eval-fixtures/slice9-session-one/after-a/grading.json \
  | tee docs/eval-fixtures/slice9-session-one/after-a/grading.txt

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice9-session-one/after-b --builder current --seed 20260819 \
  --out docs/eval-fixtures/slice9-session-one/after-b/grading.json \
  | tee docs/eval-fixtures/slice9-session-one/after-b/grading.txt
```

**Both flags can be omitted.** Each directory's `BUILDER.txt` names its own
builder and its own seed, the grader fills them in when they are absent, and it
refuses outright when a passed flag disagrees. That mechanism was built during
this slice, and it was built because the alternative is silent: grading a round
against the wrong fifteen swings does not crash, it produces a complete,
plausible-looking report in which correct coaching is marked wrong.

**Note the third seed.** Round B ran at `20260819`, not the `20260814` the
other two rounds and the script's own default use. Nothing in the file paths or
the record contents says so, which is exactly why `after-b/BUILDER.txt` says it.

Both commands spend real money. The bench rounds cost $1.11, $1.10 and $1.10;
the grading rounds cost $0.3758, $0.3905 and $0.3791. Slice total $4.46.

## Read this first: a raw flag is a lead, not a finding

The grading tool's false-positive rate on these three rounds, measured by
reading every flagged claim against the real data:

| round | raw flags | genuine coach errors | tool false positives | FP rate |
|---|---|---|---|---|
| before  | 16 | 14 | 2  | **12.5%** |
| after-a | 29 | 19 | 10 | **34.5%** |
| after-b | 15 | 9  | 6  | **40.0%** |
| all     | 60 | 42 | 18 | 30.0% |

Three things follow from that table, and all three matter more than any other
number in this directory.

1. **No single flag in `grading.json` should be reported as a coach error
   without being read by hand.** Between one in eight and two in five of them
   are the tool being wrong. `HAND-CHECK.md` records the verdict on all 60.
2. **The false-positive rate is not evenly distributed across the rounds**, and
   it is worse on the after rounds specifically. The most common mechanism
   fires on sentences the coach only started writing after the rewrite. So the
   tool systematically over-flags the after side of this particular comparison.
3. **A raw flag count would have reported a regression that is not there.**
   16 flags before against 29 in the first after round reads as a coach roughly
   80 percent worse. Ten of those 29 were false positives, and the second after
   round, on identical data, flagged 15.

## The controlled comparison is wider than it looks

**Sessions 2, 3 and 4 are byte-identical between the `before` round and the
`after-a` round.** Verified by rebuilding and comparing the swing arrays, not
argued from the design. Both rounds ran at seed `20260814`, and the generator
builds every later session from session 1's two averages, which the rewrite
deliberately held to the same exact sums. So on the four session-4 cells and on
`power-s2`, the coach in both rounds was looking at exactly the same swings; the
only difference is what the prompt said about session 1.

That makes **all 64 records** of before-versus-after-a a controlled comparison,
not only the 24 session-1 ones. Nobody specified this; it fell out of the
decision to hold both averages, and it is the single largest thing that decision
bought.

Separately, `power-s1` and `contact-s1` are byte-identical between rounds A and
B, because session 1 is not generated and so does not depend on the seed. Those
24 records per round are a pure run-to-run noise measurement.

`after-b`'s `power-s2` and session-4 cells are different data entirely and are
**not** comparable to the other two rounds on those cells.

## The result

Genuine coach errors, after the hand-check:

| view | before | after-a | after-b |
|---|---|---|---|
| genuine claim errors, all 64 records | 14 | 19 | 9 |
| debriefs holding at least one genuine error | 11 / 64 | 16 / 64 | 8 / 64 |
| genuine claim errors, the 24 seed-independent records | 6 | 7 | 3 |
| substantive miscounts only (the three mildest shapes stripped out) | 8 | 8 | 8 |

The last row strips three shapes, not two: a reversed pair of correct values, a
value sitting exactly on the coach's own stated threshold, and a range boundary
off by one. That is deliberate and worth saying out loud, because it is the
**flattest** cut available. Stripping only the first two gives 11 / 8 / 8, which
would read as an improvement this data cannot support. The conservative cut was
chosen over the flattering one.

**The two after rounds bracket the before round on every view.** They are
looking at identical session-1 data and differ from each other by more than
either differs from before. That is what a null result looks like, and it is why
this directory does not claim an improvement in overall accuracy.

Two things do point in a direction, and both are named in `HAND-CHECK.md`.
Before either, the two session-1 cells side by side, because reading one of them
as signal and the other as noise is a judgment that has to be made out loud:

| cell, 12 records per round | before | after-a | after-b |
|---|---|---|---|
| `contact-s1` | 3 | 0 | 0 |
| `power-s1`   | 3 | 7 | 3 |

**`contact-s1` is read as signal and `power-s1` as noise, on this standard: a
cell whose two after rounds agree with each other is measuring something, and a
cell whose two after rounds disagree by more than either disagrees with before
is measuring its own variance.** `contact-s1` reads 0 and 0 against 3, and it
also has a mechanism behind it that was predicted before the data came in.
`power-s1` reads 7 and 3 against 3, which brackets the before round the same way
the full 64-record view does, so it supports no direction at all. Anyone who
wants to read `power-s1`'s 7 as a real regression has to also read its 3 as a
real improvement, which is the point.

- **Favourable, and the one thing this slice claims.** The `contact-s1` cell
  went from 3 genuine errors on the old data to **zero** in both after rounds.
  That is the cell whose target band used to be empty, and the coach used to
  keep miscounting the "low and soft" group it had nothing else to talk about.
- **Unfavourable, and accepted deliberately by the product manager.** The coach
  habitually groups swings 2, 9 and 12 as "the low pitches" and asserts they
  were all flat and all weak. That was true of the old data by coincidence. It
  is false of the new data, where swing 9 now lofts and swing 12 is not weak. Six
  of the 28 genuine after-round errors are that one sentence. The decision was to
  record it rather than re-tune the swings to hide a pre-existing flaw in how the
  coach generalises.

The hard gate held: **zero parse failures across all 192 debriefs.** That was the
real risk, not accuracy. Slice 7b found session 1 pushing the coach past its
output ceiling on 14 of 36 calls, and a rewritten session 1 could have brought it
back.

## What is NOT safe to conclude

- **That the rewrite improved the coach.** It did not, measurably, and this
  directory does not say it did. `contact-s1` is the only cell that moved
  consistently in one direction, on 12 records per round, which is a small
  cell. `power-s1` moved too, by more, in both directions, which is why it is
  read as noise; see the table above for the standard being applied.
- **That the rewrite made the coach worse.** Same reason, in the other
  direction. The noise floor demonstrated here is wider than the effect.
- **That any of these are repeatable numbers.** Three rounds of 64, one model
  for the coach and one for the grading, and a grading pass that re-extracts
  live every time, so the same debriefs graded twice do not produce the same
  claims. Treat every figure here as one draw.
- **That a flag in `grading.json` is a coach error.** See the false-positive
  table above. `HAND-CHECK.md` is the adjudication, not the raw output.
- **That the before-versus-after-b comparison is controlled on the generated
  cells.** It is not; only the 24 session-1 records are comparable across all
  three rounds.
- **That the adjudication rules are the only defensible ones.** Two of them are
  judgment calls, stated openly in `HAND-CHECK.md`: counting a reversed pair of
  correct values as an error, and counting an undercount as an error. Relaxing
  either moves the comparison further toward "no change", never away from it,
  which is why they were kept.
- **That the grading tool's remaining false-positive mechanisms are fixed.**
  They are catalogued here and left alone. Fixing them was Slice 8d's scope, not
  this slice's, and two of the three mechanisms it named are still live.

## Reproducing this

Every command above spends real money and none of it is needed to read the
result: the grading transcripts and the hand-check are committed. If a future
session does re-run a round, it must not overwrite these files, because the
comparison depends on these particular draws and re-running produces different
ones.

---

## Postscript, 20 August 2026: the grading tool changed after these rounds were graded

Added by the whole-branch review that closed Slice 9. The three `grading.json`
files in this directory are untouched and stay untouched. What changed is the
code that produced them, and this note exists so a future reader can tell the
two apart.

**One verdict rule was fixed.** `scripts/claimVerdict.js` was ruling a claim
FALSE when it carried the correct count and named no individual swings at all,
because the "the count matches but the named swings do not" guard tested only
that `statedSwings` was an array, and an empty array is one. That is mechanism
M4 in `HAND-CHECK.md`, already adjudicated there as a false positive.

**The effect on these rounds was measured, not assumed.** All three were re-run
through the fixed verdict code with `scripts/replay-grading.mjs`, which replays
stored claims offline with no re-extraction, no network call and no spend:

```
node scripts/replay-grading.mjs --input docs/eval-fixtures/slice9-session-one/before/grading.json
node scripts/replay-grading.mjs --input docs/eval-fixtures/slice9-session-one/after-a/grading.json
node scripts/replay-grading.mjs --input docs/eval-fixtures/slice9-session-one/after-b/grading.json
```

Across 1,583 replayed claims, **exactly one verdict changed**:

| round | claims | stored FALSE | replayed FALSE | flagged debriefs, stored -> replayed |
|---|---|---|---|---|
| before | 516 | 16 | 16 | 13 -> 13 |
| after-a | 542 | 29 | 29 | 22 -> 22 |
| after-b | 525 | 15 | **14** | 14 -> **13** |

The single change is `shipped/contact-s1/run12`, tip1, "Nine of your fifteen
swings came out above 18 degrees", FALSE to TRUE. Nine is correct and the
sentence names no swings.

**Nothing in the result section above moves.** Every number there is drawn from
the hand-check, and the hand-check had already ruled this claim a false
positive, so it was never counted as a coach error in the first place. What
moves is the tool's raw flag count on after-b, which the README already warns
should not be read on its own.

**The bullet above saying "two of the three mechanisms it named are still
live" is superseded for M4 only.** M4 is fixed. M1 and M5 are still live, and
M5 is now recorded on CLAUDE.md's What's Next list as the one that should be
fixed before this tool is used for another before/after comparison, because it
over-flags the after side specifically.

**Separately, the grader stopped choking on this directory.** Slice 9 is the
first slice to commit grading output inside a round directory beside the bench
records, and `--input` reads every `.json` in the directory. The
`{ meta, results }` files here crashed it, which took the free dry run down
with it; a pre-19-August bare-array grading file would instead have been
concatenated silently and graded as if it were coach prose, at real cost. The
loader now identifies each file by its contents and sets aside anything that is
not bench records, naming it in the run header. The commands in "The exact
commands" above are unchanged and all three now pass a free
`--dry-run --input <dir>`.
