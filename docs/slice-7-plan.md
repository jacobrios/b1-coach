# Slice 7: the coach says less, and the screen gets bigger

Written 14 August 2026, on branch `slice-7-coach-brevity`, after the measurement
round that this document's numbers come from.

---

## Settled, do not relitigate

**Budget B ships**: 45 words for `coachingSummary`, 30 for `whatThisMeans`, 12
for `tipsIntro`, 50 per tip. Chosen by the product manager from three measured
options. **The reason is the player, not the layout**: this is built for high
school hitters and their attention span is short. The type bump and the 2.8
seconds it saves are consequences, not the motive.

**The charts keep their height.** They are already small. When the summary text
is too long the box scrolls, which is what it does today. No layout change.

**Type goes up**: session summary 16px to 20px, chat panel 14px to 16px.

**Model behaviour is proven by the bench, never by the test suite**, which still
must not call the model.

## Not in this slice

- **Rewriting session 1's fifteen swings.** The next slice. It needs those
  swings extracted into their own module first, which is that slice's first task.
- **A length budget for the chat prompt.** The bench grades debriefs only, so a
  chat budget would be an unmeasured guess, which is the exact thing this slice
  exists to stop. Belongs to a slice that benches the chat path.
- **Slice 6b surface polish.** After the session-1 slice, unchanged.

## How this is verified, written before any code

Bench before and after, 24 runs per condition, scoring length **and** citation
grounding together. A browser pass at four window sizes with screenshots. Suite
green from its 326-test baseline.

## Debt this is expected to open

The bench cannot grade session 1. Its grader reads only numbers carrying a unit.
Nothing in the suite can pin the budget, because it is model behaviour. At 20px
the box will scroll on short windows, by decision.

---

# The tasks

## Task 1: put a real number on the test-hook trigger in CLAUDE.md

CLAUDE.md currently says to adopt the template's per-edit / end-of-task split
when the suite gets "painful", which is an adjective doing a threshold's job, and
this project has now re-checked it three times without ever deciding anything.

Measured 14 August 2026: **326 tests, about 1.0 second of runner time, 1.5
seconds of wall clock** including npm's own startup.

Write the threshold in as **10 seconds of wall clock**, with the reasoning: at 10
seconds an edit-time hook stops being a safety net you forget about and becomes a
pause you notice, which is when people start reaching for `--no-verify` and
similar. Below that the split costs a moving part and buys nothing. Record that
the current suite is about one seventh of that, so the trigger is nowhere near.

This is Task 1 because CLAUDE.md loads at the start of every session, and a rule
that cannot be acted on works against every session that reads it.

## Task 2: the budget in the debrief prompt

Append budget B to `DEBRIEF_SYSTEM` in `src/coachApi.js`, in the wording the
bench measured, not a paraphrase of it. The exact text is in
`scripts/bench-coach-brevity.mjs` in the `budget()` template; the shipped prompt
must match what condition B sent, or the measurements stop describing the app.

Two things about that wording are load-bearing and must survive:

1. It names word counts, not sentence counts. The prompt already caps each tip at
   three sentences and the model already obeys that, writing longer sentences
   instead. Any instruction counting sentences would report success while the
   panel overflowed.
2. It says out loud that a vague tip inside the budget is a failure, and that the
   three-part tip shape survives the cut. Brevity bought with vagueness is the
   failure mode this slice was warned about.

Move `budget()` out of the bench and into `src/coachApi.js`, exported, so the
bench imports the shipped wording rather than holding a second copy of it. A
budget that drifts between the bench and the app is the same class of bug as a
prompt that drifts between two call sites, which this repo has already been
bitten by twice.

## Task 3: the two font bumps, which are not equally risky

**Chat panel, 14px to 16px.** Near free: the panel already scrolls and is meant
to. Three sizes at `src/DebriefScreen.jsx:261`, `:281` and `:309`, plus the
`__tips__` block that renders the two tips.

**Session summary, 16px to 20px** at `src/DebriefScreen.jsx:1145` and `:1164`.
The 17px "WHAT THIS MEANS" heading between them scales to match.

Measured capacity of the summary box, so a future reader does not have to
re-derive it:

| Viewport | Box height | 16px | 18px | 20px |
|---|---|---|---|---|
| 1280x720 | 167px | 70 words | 64 | 48 |
| 1440x790 | 237px | 154 | 106 | 96 |
| 1440x900 | 347px | 231 | 199 | 154 |
| 1920x1080 | 527px | 533 | 410 | 364 |

Budget B's worst box over 24 runs was **77 words**, so 20px fits every one of
those runs on 1440x790 and up, with 19 words to spare. It will scroll on
1280x720. That is the accepted decision, not an oversight.

## Task 4: make the scroll visible

**Proposed, needs the product manager's yes before building.**

The box already scrolls. What it does not do is admit it: text stops mid-sentence
with no scrollbar, no fade, no hint. That is what made the 1280x720 screenshot
read as broken software rather than as a long summary, and accepting scrolling
makes the affordance matter more, not less.

Cheapest honest fix is a fade at the bottom edge that appears only when there is
more below. If the product manager declines, this comes out and goes on the
What's Next list; nothing else in the slice depends on it.

## Task 5: re-run the bench against the shipped prompt

The numbers in this document came from a condition the bench constructed. Once
the budget ships inside `DEBRIEF_SYSTEM`, the same 24 runs go again against the
real prompt, and those are the numbers that reach the decision log. If they
disagree with condition B's, the shipped prompt is not what was measured, and
that is a defect rather than a rounding difference.

Record before and after for: box words median and worst, grounded citations per
debrief, share of tips leading with a citation, and wall-clock seconds.

## Task 6: the browser pass

Four window sizes: 1280x720, 1440x790, 1440x900, 1920x1080. At each, confirm the
summary reads well at 20px, the chat is comfortable at 16px, and where the box
scrolls it looks deliberate. Screenshots for the PR.

Also serve on the LAN and look at it on a real phone, per the standing rule.
**Expect that to be a finding rather than a check**: this app is built at
`100vw`/`100vh` with a fixed two-column grid and has no mobile layout at all, so
the honest outcome is probably "unusable on a phone, pre-existing, out of scope,
recorded". Say that plainly rather than skipping the step.

## Task 7: the record

Decision log entry for 14 August 2026, 400 to 600 words, in product language:
what the budget is, why brevity is about the player's attention rather than the
layout, that the box already truncated mid-sentence before this slice touched
anything, and the before and after numbers.

CLAUDE.md current-state section: the new `ballFlight`-style section for the
bench, the exports added to `coachApi.js`, the font sizes, and the threshold from
Task 1. What's Next: this slice's entry off, and on go the bench's blind spot on
session 1, the coach's rounding, and anything the browser pass surfaces.

`docs/queued-slices.md` gets the renumbering: what it calls Slice 7, coach
fidelity, is not this. Say so there rather than leaving two Slice 7s in the repo.
