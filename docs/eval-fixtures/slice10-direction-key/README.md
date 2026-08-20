# Slice 10: two rounds, because the first prompt did not ship

This directory holds **two** live rounds of 64 coach debriefs each, their grading
transcripts, the by-hand adjudication of every claim either grading run flagged,
and the browser capture showing the prompt lines in a request the app really
sends.

*This file described one round until 20 August 2026. It now describes two,
because the product manager's browser QA pass rejected the prompt the first round
measured. What follows is the corrected version; the round itself, its grading
and its hand-check are untouched.*

**Read this first if you read nothing else.** `after/` measured a prompt that
**never shipped**. `after-spray/` measured the prompt that did. Do not quote a
number out of `after/` as a fact about the app as it stands.

## The two rounds

    after/         The direction key as first written: "negative direction is
                   pull side." Rejected by the product manager's browser QA pass
                   the same day, because it disagreed with the spray chart.
    after-spray/   What shipped: the key naming the -15 and +15 cutoffs, plus
                   three pre-counted spray lines per session, on every goal, in
                   both prompts, all reading one constant.

Each directory holds `shipped-64.json` (the 64 live debriefs), `BUILDER.txt`
(which session data they describe, at which seed, and the ways the round can go
stale), and `grading.json` / `grading.txt`. Beside them:

    HAND-CHECK.md               All 21 flagged claims from the `after` round.
    HAND-CHECK-after-spray.md   All 23 flagged claims from the `after-spray`
                                 round, plus a direct test of whether the
                                 shipped fix worked.
    browser-payload-capture.md  What the browser actually sent.

The 64 debriefs in each round are the bench's seven cells: `power-s1` 12,
`contact-s1` 12, `power-s2` 8, `contact-s4` 8, `open-s4` 8, `allfields-s4` 8,
`popup-s4` 8.

## Why the rejected round is kept, and why it is the right comparison

It is the only measurement of the defect. Without it there is no evidence that
the coach ever used the sign rule, only an anecdote from one browser session.
With it, the fix is checkable.

The two rounds are also the correct comparison partner for each other: **same
seed (20260814), same swing data, same cells, one prompt generation apart.**
Slice 9's `after-a`, which the first round was originally paired against, is now
two generations back and should not be compared directly.

## Job one: did the fix work? Yes, and it is measurable

Full method and every quote in `HAND-CHECK-after-spray.md`. In short, every
sentence in both rounds that classifies a swing's direction was pulled out and
checked against both rules.

Hit to All Fields is excluded from the table below, because its prompt has always
carried pull and opposite-field counts at the -15 and +15 cutoffs, so the coach
could not go wrong there in either round. The five goals that had no spray counts
before this slice are the real test:

| Five goals with no handed spray counts before this slice | after | after-spray |
|---|---|---|
| Statements classifying a swing's direction | 1 | 20 |
| Follow the chart's cutoffs, where the sign rule differs | 0 | 11 |
| Consistent with both rules | 0 | 7 |
| **Follow the sign rule only** | **1** | **0** |
| Follow neither (coach arithmetic slip) | 0 | 2 |

The rejected round's single statement is the defect itself: `contact-s1/run4`
calls swing 11, at -5 degrees, pull side. That is the product manager's finding
reproduced independently, without anyone looking for it.

Across the whole shipped round, counting Hit to All Fields back in, there are 33
classification statements, 23 of which the two rules answer differently, and
every one follows the chart. **The smallest magnitude called pull anywhere in the
round is -16.** The mirror case appears too: `contact-s4/run6` calls swings at -2
and -6 "up the middle," which the sign rule would have called pulls.

## Job two: the claim counts, and why they support no verdict on accuracy

| | after (rejected) | after-spray (shipped) |
|---|---|---|
| Claims extracted | 504 | 543 |
| TRUE | 343 | 402 |
| Raw FALSE flags | 21 | 23 |
| UNVERIFIABLE | 140 | 118 |
| of which the extractor could not structure at all | 82 | 51 |
| Flagged debriefs | 18 of 64 | 17 of 64 |
| **Genuine coach errors, hand-checked** | **8** | **13** |
| **Tool false positives** | **13 (61.9%)** | **10 (43.5%)** |
| Cost (bench + grading) | $1.12 + $0.3718 | $1.19 + $0.3895 |

Total for the slice: **$3.07**. Zero parse failures across all 128 calls,
confirmed by reading both record files rather than by trusting a log line.

Before the **first** round, the grader's free `--dry-run --input` was run and
exited 0, which is not a formality: that gate was silently dead for a whole
previous slice and nothing said so. Whether it was re-run before the second round
is not recorded anywhere, so this file does not claim it was.

**Genuine errors moved from 8 to 13, and this directory claims neither a
regression nor an improvement.** Three reasons, each sufficient alone:

1. **The noise is bigger than the difference.** Slice 9 ran two rounds on
   identical data with an identical prompt and hand-checked to 19 and 9. The
   demonstrated same-condition spread is 10; this gap is 5.
2. **The denominator moved too.** 504 claims to 543, so the per-claim rate went
   1.6% to 2.4%, a smaller move than "8 to 13" sounds.
3. **The instrument changed between the rounds, and now sees more.**
   `scripts/handedCounts.js` and `scripts/grade-coach-accuracy.mjs` were both
   corrected before the second round was bought, because the new prompt hands
   direction counts on every goal and the tool did not know it. Coverage rose:
   unstructurable claims fell 82 to 51, unrulable ones 140 to 118. Some of the
   extra genuine errors are errors that existed in the first round and were
   invisible to the tool that graded it.

Anyone re-grading `after/` today gets the corrected tool, not the one that
produced `after/grading.json`. No re-grade was bought. Say so rather than
assuming the two transcripts are strictly comparable.

### The pre-registered null band, kept because it is a process record

Before any money was spent on the first round, `docs/slice-10-plan.md` wrote the
band down: **15 to 29 raw flags is a null; only a result outside it is a
signal.** The band came from measured noise, Slice 9's `after-a` and `after-b`
flagging 29 and 15 on the same condition at two seeds, and its before round 16.
The first round came back at 21, inside the band, and was reported as the null it
was predicted to be. One footnote on the lower bound: that 15 is one
verdict-code generation stale, since Slice 9's M4 fix later moved `after-b` to
14. The band would be 14 to 29 today, and 21 sits comfortably inside either.

That band was written against a comparison with Slice 9's `after-a`, which the
QA rejection then superseded. It is kept here as a record of the discipline, not
as a live verdict on the shipped prompt. The shipped round's 23 raw flags also
sit inside it, which is worth noting and is not evidence of anything on its own,
given everything above about raw flag counts.

## What the shipped round did change, and nobody asked for it

**The coach now talks about spray in 24 of 64 debriefs, up from 9.** That is what
the prompt was for, and it is visible on screen. It also means the surface area
for a future spray error is much larger than it was, and the grading tool
currently sees very little of it. See the coverage gaps below.

## One correction to both hand-checks

Both hand-check documents say in places that the grading tool "has no spray
statistic." **That is not true.** `scripts/factSheet.js:164-170` carries all
three spray counts and their swing numbers per session, added in the same change
as the prompt lines, and spray sentences in the shipped round were correctly
ruled TRUE off them (`open-s4` runs 3 and 5, both matched against
`oppoFieldCount`). The ground truth is there.

What is missing is upstream of it, and it is two specific gaps, both verified by
reading `after-spray/grading.json` directly:

1. **A spray count can be extracted as a `threshold` claim carrying no
   comparison, and then falls out as UNVERIFIABLE.** `power-s2/run8`: "You put
   five swings to the pull side in Session 2" was extracted with
   `comparison: undefined`, reasoned as `unknown comparison`, and never ruled. It
   was wrong; the handed count is 6.
2. **The prior-session half of a cross-session comparison is never extracted at
   all.** `open-s4/run5`: "five swings go opposite field this round, up from
   three in Session 1 and four in Session 3." The tool extracted the first half
   and correctly ruled it TRUE. The error is in "three in Session 1," where the
   truth is 4, and that half produced no claim.

Gap 2 matters more now than it did last week, because the shipped prompt makes
the coach write exactly this kind of comparison more often.

## A new coach failure shape, and it is a limit on this project's whole strategy

`contact-s4/run5`. The prompt said "Swings with exit velocity 85 mph or higher: 6
swings." The coach wrote "Six of your swings came in under 85 mph." The number is
copied correctly and the sentence is inverted around it; the true answer is 9.

Every coach error of this family previously recorded here was a miscount or a
transposition, which handing over the number fixes. This one is not. **Nine of
the shipped round's 13 genuine errors rest on a handed number, against zero of
eight in the round before it.** That is evidence for the open decision CLAUDE.md
already carries, about letting the coach write the sentence and having the app
fill in the figure, rather than a new idea.

## Read this first: a raw flag is a lead, not a finding

The tool's hand-checked false-positive rate across this project's rounds now
reads 11%, 42%, 12.5%, 34.5%, 40%, **61.9%** and **43.5%**. Nothing in either
`grading.json` should be reported as a coach error without being read by hand.
The two `HAND-CHECK` files are the adjudication; the JSON is raw output.

The `after` round produced two false-positive mechanisms new to this project's
records, both written up in `HAND-CHECK.md`: a handed distribution bucket
re-derived with an inclusive upper bound (deterministic, in the verdict code, so
free to fix and free to validate by offline replay), and the denominator of an
"N out of fifteen" phrase absorbed as the numeric threshold. The `after-spray`
round produced **no new tool mechanism**, the first time that has been true here.
Two of its mechanisms recurred on the *identical sentence in the identical cell*
one round apart, which suggests the known ones are stable and fixable rather than
random.

**The non-neutrality warning stands and now has a named cell.** M5 accounted for
7 of the first round's 13 false positives, four of them the same `power-s2`
sentence: "you cut your under-175-foot swings from 4 down to 1," a correctly
repeated pair of handed distance-bucket numbers graded against a launch-angle
count. It recurred in the second round. Any comparison including that cell
carries roughly four spurious flags from one sentence shape, so a raw flag-count
delta between two rounds is not usable without a hand-check of at least the M5
candidates.

## What is NOT safe to conclude

- **That the direction key or the spray counts made the coach more accurate
  overall.** Not claimed anywhere here. See the three reasons above.
- **That they made it worse.** Same three reasons, in the other direction.
- **That the two rounds' claim counts are strictly comparable.** The instrument
  moved between them and no re-grade was bought.
- **That 8 genuine errors was better than 13, or than Slice 9's 9 to 19.** Three
  or five rounds is not a distribution, and two Slice 9 rounds on identical data
  differ from each other by 10.
- **That any figure here is repeatable.** One round of 64, one model writing and
  another extracting, with live re-extraction every time, so the same debriefs
  graded twice do not produce the same claims. Every number here is one draw.
- **That the coach's spray grouping is now flawless.** Two of the shipped round's
  spray statements are arithmetic slips against handed counts, and the grading
  tool caught neither. What *is* supported is the narrower claim above: the coach
  now uses the chart's rule rather than the sign rule.
- **That the tool's false-positive mechanisms are now enumerated.** Each wave of
  measurement has produced new ones. This wave produced two.

## Both rounds go stale the moment the generator changes

Each `BUILDER.txt` carries the full explanation and should be read before any
re-grade. In short: the `current` builder rebuilds ground truth from the working
tree, and it reads **the generator** as well as session 1. Slice 11 is expected
to change `src/swingGenerator.js`. The moment it does, sessions 2, 3 and 4 stop
being reconstructible while session 1 stays correct, so a re-grade would produce
a complete and entirely plausible fact sheet for swings the coach never saw on 40
of each round's 64 records. Nothing would look broken.

Slice 9's three markers have the identical exposure and say nothing about it,
because they were written believing session 1 was the only moving part. Repairing
all five markers, and giving both Slice 10 rounds a frozen generator snapshot, is
Slice 11's first task.

## The exact commands

```
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice10-direction-key/<round>/shipped-64.json

node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice10-direction-key/<round> --builder current --seed 20260814 \
  --out docs/eval-fixtures/slice10-direction-key/<round>/grading.json \
  | tee docs/eval-fixtures/slice10-direction-key/<round>/grading.txt
```

`<round>` is `after` or `after-spray`. Both flags on the grading command can be
omitted; each `BUILDER.txt` names the builder and the seed, the grader fills them
in, and it refuses outright when a passed flag disagrees.

One near miss worth recording from the first round, because it cost nothing only
by design: that grading invocation omitted `--validate`, and the script refused
with exit 1 before making a single API call.

## Reproducing this

Both commands spend real money and neither is needed to read the result: every
transcript and both hand-checks are committed. A future session that does re-run
a round must not overwrite these files, because the comparison depends on these
particular draws and re-running produces different ones.
