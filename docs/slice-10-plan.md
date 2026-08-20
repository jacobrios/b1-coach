# Slice 10: tell the coach which way is which

Two prompt-wording changes, both approved by the product manager on 20 August
2026 before any code was written. Nothing about the swing data moves.

## Settled before work started. Do not relitigate.

- **The exact direction sentence is approved and is not to be reworded**:
  `- Direction key: negative direction is pull side, positive direction is opposite field, near zero is up the middle.`
- **The zero-count fix is approved**: the Power under-15 line drops its
  `— numbers:` clause when the count is zero.
- **Spray counts on all six goals were considered and declined for now.**
  Measured across Slice 9's 128 committed debriefs, the coach makes a claim
  about where balls went in 10 of 16 Hit to All Fields debriefs and in 0 of the
  other 112. Handing spray counts to the other five goals would create new
  behaviour rather than guard existing behaviour.
- **The slice is split from the generator work.** Symptoms 2, 3 and 4 of the
  direction-and-location scope are Slice 11.
- **One 64-call bench round is bought, at seed 20260814**, paired against
  `after-a`. The product manager chose this knowing a null result is the
  expected outcome.

## Not in this slice

Every exclusion names where it does belong.

- **Spray counts on all six goals.** Its own product slice, which must extend
  `scripts/factSheet.js` in the same slice (an uncounted new stat is what
  produced Slice 8b's false positives) and buy its own eval round. It changes
  what the coach writes about, so it is a product expansion, not a fix.
- **The zone-to-contact link, the spray bias, and the pop-up ceiling**
  (symptoms 2, 3 and 4). Slice 11, the generator slice.
- **The `CONTACT_CORRELATION` comment, and the two test files that hardcode
  session 1's distances** (`src/ballFlight.test.js:184`,
  `src/coachApi.test.js:831`). Slice 11. Both are already on What's Next as
  riding with the generator work.
- **Repairing Slice 9's three BUILDER.txt markers.** Slice 11. They are correct
  today and only become wrong when the generator moves, so repairing them here
  would be repairing a file this slice does not break.
- **The two new findings below** (the 35-degree pile-up, and Hit to All Fields
  failing its own stated bar). Recorded in the decision log by this slice,
  built in Slice 11.
- **`--cell` on the bench.** Already on What's Next. This slice buys a full
  round anyway, so it would save nothing here.

## How this slice will be verified

Written before any code exists.

1. **A failing test first, for each of the two line builders.** Neither is
   trusted until it has been seen red against the unfixed code.
2. **Suite before and after.** Baseline measured on this branch before any
   edit: **529 tests across 22 files, all green**, which matches the number
   Slice 9 finished on. No pre-existing failure to carry.
3. **A real browser session with the request payload captured**, showing both
   lines in what the app actually sends. This is not an `api/coach.js` change,
   so the local-dev trap in CLAUDE.md does not apply and `npm run dev` is a
   valid place to capture it.
4. **One 64-call bench round at seed 20260814**, graded, paired against
   `docs/eval-fixtures/slice9-session-one/after-a`. Roughly $1.10 to $1.45 for
   the round plus roughly $0.35 for grading.
5. **A pre-registered null band, written here before the money is spent: 15 to
   29 raw flags.** Slice 9's `after-a` and `after-b` are the same condition
   twice, differing only in seed, and they flagged 29 and 15; the before round
   flagged 16. A result inside that band is a null and will be reported as one.
   Only a result outside it is a signal.
6. **Every flagged claim hand-checked** before it is called a coach error. The
   tool's measured false-positive rate is 11 to 42 percent across five rounds.

## The debt this slice is expected to open

- **The direction key ships with no accuracy claim attached.** The error class
  it fixes appears in 0 of 112 measured non-All-Fields debriefs, so no bench
  round at this scale could detect its effect. It is insurance. The PR must say
  so plainly rather than implying the coach got better.
- **A third round lands in the fixture tree whose BUILDER.txt goes stale the
  moment Slice 11 moves the generator.** This slice's marker must anticipate a
  generator change in its own text. Slice 9's three markers anticipate only a
  session-1 rewrite, which is the gap that made this predictable.
- **The `near zero` in the approved sentence is deliberately vague.** It gives
  the coach no countable threshold, which is the point, but it also means the
  coach picks its own boundary between centre and the two sides. Accepted.

---

# The findings this slice produced that are not fixes

All measured while scoping on 20 August 2026. All go to the decision record
whether or not anything is ever done about them. None is fixed here.

### 1. The launch-angle clamp is a visible artefact, not just a missing pop-up

On Power session 4, **1,886 of 45,000 generated swings (4.2 percent) sit at
exactly 35.0 degrees**, because the generator clamps launch angle there. That
draws a flat row of dots pinned to the top edge of the Launch Angle vs Exit
Velocity scatter. It is the same class of first-screen credibility defect as
the impossible hit distances Slice 6 removed and the ruler-straight session 1
Slice 9 removed, and it is recorded nowhere in this repository. It strengthens
the case for symptom 4 independently of the Reduce Pop-Ups goal.

### 2. Hit to All Fields fails its own stated bar four times in ten, and gets worse every session

The goal's prose asks for at least 3 pull and at least 3 opposite field. Across
4,000 generated sessions per cell, it is met **64 percent at session 2, 59
percent at session 3, 52 percent at session 4**. The cause is mechanical: spray
direction is multiplied by `varianceFactor`, which shrinks 1.00 / 0.95 / 0.90,
so the hitter sprays less every session and both counts fall toward zero. This
is exactly the shape of Slice 9's finding 2, on the one goal Slice 9 never
checked, and it means a visitor who picks Hit to All Fields and clicks through
watches the demo get worse at its own goal.

### 3. `carryDistance` has a free stopping point at 50 degrees

The shape term is `1 - (angle - 28) * 0.02` and reaches its 0.55 floor at
exactly 50.5 degrees. **A pop-up ceiling of 50 degrees therefore needs no change
to `src/ballFlight.js` at all.** Above that the coupling risk named on What's
Next is real and confirmed: at 90 mph, 55, 60 and 70 degrees all return exactly
186 feet. Slice 11 should read this before deciding the ceiling.

### 4. Session 1 has zero pop-ups and a maximum launch angle of 27

So every pop-up the generator learns to make is a regression against a frozen
session 1, on the one goal that asks the player to eliminate them. That is a
product question for Slice 11, not a tuning one, and it is not answerable by
changing the generator alone.

### 5. The builder trap is live, and Slice 9's markers do not anticipate it

`after-a/BUILDER.txt` and `after-b/BUILDER.txt` both say `builder = current`,
and their own comments anticipate only session 1 being rewritten again. **A
generator change breaks them too, and nothing in them anticipates it.** The
moment Slice 11 moves the generator, three committed fixture directories point
at a builder that rebuilds the wrong sessions 2 to 4 while producing a
complete, plausible-looking fact sheet. Left for Slice 11 to repair, as an
append-only dated annotation, not a rewrite.

### 6. The free baseline, and why this slice is cheap

PR #31 touched only `src/DebriefScreen.jsx`. Diffing every prompt and data file
against the Slice 9 merge shows no change, so **Slice 9's `after-a` and
`after-b` are already a valid before-baseline, at two seeds, for any change that
leaves the data alone.** That is why this slice buys one round instead of two.
The baseline expires the moment Slice 11 moves the generator.

---

# Tasks

Each task is one implementer and one independent reviewer. The coordinator
writes nothing.

## Task 1: the direction key, in both prompts

**Write the test first and see it red.**

New tests in `src/coachApi.test.js`. **Mirror the existing three-test block at
`src/coachApi.test.js:858` that does exactly this job for the distance
distribution**: a debrief assertion, a chat assertion whose own test name calls
the chat prompt "the copy that is easy to miss", and a cannot-drift-apart test.
That block already reaches both prompts through the `capturedMessage` helper, so
**no production code needs extracting or exporting to make the chat prompt
testable**. Follow it rather than inventing a second pattern.

1. The debrief message contains the exact line
   `- Direction key: negative direction is pull side, positive direction is opposite field, near zero is up the middle.`
2. The chat message contains the identical line.
3. The two cannot drift apart: extract the line from each with the same regex
   and assert they are equal, and assert both equal the exported constant. That
   third assertion is what proves the request leaving the browser is not some
   third independent value, which is the shape the distance-distribution test
   already uses.
4. The line appears **immediately above** the `- Individual swings:` line, in
   both messages. Assert on adjacency, not merely on presence: the fact is only
   useful next to the data it explains.

**Then implement.**

- Add `export const DIRECTION_KEY_LINE = '- Direction key: negative direction is pull side, positive direction is opposite field, near zero is up the middle.'` to `src/coachApi.js`, near the other prompt-building helpers.
- Interpolate it immediately above `- Individual swings:` in
  `buildDebriefUserMessage` (around `src/coachApi.js:532`) and in
  `sendChatMessage` (around `src/coachApi.js:563`).
- **Do not touch `goalContext`.** The Hit to All Fields context already names
  the convention in approved wording and agrees with this line (negative is
  pull, positive is opposite field). It will now say it twice on that one goal.
  That is redundancy, not disagreement, and removing it would be reopening
  approved copy.

**Why one constant.** `DISTANCE_BUCKETS` lived in three copies before Slice 6
and the chat prompt was the one that kept getting missed. This is the same
shape of fact in the same two prompts.

## Task 2: the dangling `numbers:` clause

**Write the test first and see it red.**

New tests in `src/coachApi.test.js`, on the Power goal:

1. A session where no swing is under 15 degrees produces a line ending at
   `0 swings`, with no trailing `— numbers:`.
2. A session where some swings are under 15 degrees is **unchanged**: the line
   still reads `... : 3 swings — numbers: 2, 7, 11`.

Test 2 matters as much as test 1. The guard must not quietly change the shape
of the line in the common case.

**Then implement.** In `goalCountLines`, `case 'power'`, wrap the numbers clause
in the same conditional `zoneCountLines` already uses four lines below:

    `- Swings with launch angle strictly below 15 degrees (not including 15): ${swingCountPhrase(v.underFifteen.count)}` +
      (v.underFifteen.count ? ` — numbers: ${v.underFifteen.swings.join(', ')}` : '')

Nothing else in `goalCountLines` changes. The other goals' lines never printed
swing numbers, so none of them can have this fault.

## Task 3: the browser payload capture

Serve the app, load a real session, and capture the request body the browser
actually sends. Show both new lines in it. Session 2 on the Power goal is the
right one to capture: it is the only goal whose count lines can produce the
zero case, and a generated session will sometimes have no swing under 15
degrees. If the first capture does not produce a zero count, re-roll the
session until it does, and capture that one; do not assert the zero case from a
session that had no zero in it.

The evidence for the PR is the captured payload text, not a description of it.

## Task 4: the bench round, and grading it

Only after tasks 1 to 3 are green and reviewed. This spends real money.

1. **Confirm the null band is written down** (it is, above) before spending.
2. Run the bench:

       node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 --seed 20260814 --out docs/eval-fixtures/slice10-direction-key/after/shipped-64.json

   64 calls, roughly $1.10 to $1.45. The bench creates its output directory
   itself since the 18 August 2026 fix; do not rely on that from memory,
   confirm the directory exists after the run before doing anything else.
3. **Write `BUILDER.txt` beside the records immediately**, before grading, while
   the answer is still known. It says `builder = current`, `handed-era =
   current`, `seed = 20260814`. Its prose must anticipate **two** future
   invalidations, not one: a session-1 rewrite, and **a generator change**. Say
   in it that Slice 9's own markers named only the first, and that this round
   goes stale the moment Slice 11 moves the generator.
4. Grade it:

       node --env-file=.env.local scripts/grade-coach-accuracy.mjs --input docs/eval-fixtures/slice10-direction-key/after --builder current --seed 20260814 --out docs/eval-fixtures/slice10-direction-key/after/grading.json

5. **Run the grader's free `--dry-run` first**, before the paid grading call.
   What's Next records that nothing runs it automatically and that it was
   silently broken for a whole slice. Running it by hand here is cheap and is
   the only thing standing between us and that recurrence.
6. **Hand-check every flagged claim.** Genuine or false positive, one at a time,
   written to `docs/eval-fixtures/slice10-direction-key/HAND-CHECK.md` in the
   shape Slice 9 used. A raw flag is a lead, not a finding.
7. Compare against `after-a` (29 raw flags, 22 flagged debriefs, 542 claims).
   **Report against the pre-registered band.** If the result lands inside 15 to
   29, the write-up says the round was a null and that this was the predicted
   outcome. Do not go looking for a direction the noise cannot support; Slice 9
   proved two identical-condition rounds differ by 19 genuine errors against 9.

## Task 5: the records

1. **`docs/product-decisions-log.md`**, most recent first, 400 to 600 words.
   What was decided and why, including the declined spray-counts expansion and
   the reasoning that declined it, the six findings above, and the honest
   statement that the direction key is unmeasurable at bench scale.
2. **`CLAUDE.md`**: update the current-state section (test counts, the
   `src/coachApi.js` line count and what changed in it, the new fixture
   directory and its size), take this slice's items off What's Next, and add
   what it surfaced: findings 1 to 5 above, and the spray-counts-on-every-goal
   expansion as a candidate slice with its cost named.
3. **`docs/queued-slices.md`** gets nothing. It has held no slice heading since
   Slice 8b and CLAUDE.md's What's Next is where this project actually records
   intended work. Noted so a future session does not read the silence as an
   oversight.

## Task 6: review, then the pull request

1. An independent read-only reviewer, which cannot edit and treats the
   implementer's reports as unverified claims.
2. Then a pull request, near 300 words: what changed, how it was verified with
   the test numbers before and after, what the review found and what was
   deliberately not fixed, and a pointer to the decision log. Every touch to
   already-shipped code or to a file this document never named gets its own
   line.
3. **The QA script goes in the chat message, not the PR body**, ready to run:
   state seeded, server running, every link in place.
4. **Open the PR and stop.** No local merge.

---

# Addendum, 20 August 2026: the browser QA gate rejected the slice

Appended, not rewritten. Everything above records what was planned and what
was measured before the product manager ran the QA script. This section
records why that was not enough.

## What the QA pass found

Asked "which of my swings went to the pull side and which went the other
way," the coach listed **six** pull-side swings on session 1. The spray chart
on the same screen coloured **three**. Both were behaving correctly, and the
app was the thing that was wrong: it holds two definitions of "pull" and had
been handing the coach the one the screen does not use.

- The line this slice shipped said "negative direction is pull side." By that
  rule session 1 has six: swings 3, 4, 7, 10, 11, 15.
- The spray chart, and the Hit to All Fields goal prose, call it pull only
  below -15 degrees. That gives three: swings 3, 7, 15.

So swings 4, 10 and 11 read as "pull side" in the prose and "Center" in the
chart, at the same time, on the same screen.

**This was a controller error, not an implementation error.** The wording was
chosen deliberately over an option that named the -15 and +15 cutoffs, on the
grounds that naming a threshold the prompt does not pre-count is what makes
this coach invent counts. That reasoning was sound and incomplete: it never
weighed the cost of leaving the coach with a *different* definition from the
chart. The product manager's instinct in the original wording conversation
pointed at this and was talked out of it.

It also survived this slice's own verification. Task 3 ran the identical
question, saw the coach list seven swings as pull side, recorded that its
buckets contradicted **each other**, and never checked them against the chart.

## What changes

Approved by the product manager on 20 August 2026, before any code:

1. `DIRECTION_KEY_LINE` becomes:
   `- Direction key: below -15 degrees is pull side, above +15 degrees is opposite field, -15 to +15 is up the middle.`
2. Three pre-counted spray lines, per session, on **every** goal, naming the
   swings, in the shape the existing zone lines already use.
3. The grader's fact sheet gets matching rows, in the same change. A new count
   with no matching stat is precisely what produced Slice 8b's false positives.
4. The eval round is re-run. This change moves what the coach writes, which is
   the case where a round is worth buying. The first round is kept, labelled as
   measuring a prompt that did not ship.

## Deliberately NOT done

- **The coach is never told the spray chart exists.** It does not always
  render, and a coach citing a chart that is not on screen would be a fresh
  version of this same defect.
- **`src/DebriefScreen.jsx` is not touched.** The chart keeps its own inline
  -15 and +15. They agree with the new shared constant today. Consolidating the
  chart's copy is recorded as remaining debt rather than done here, to keep this
  fix out of the screen file entirely.

---

## Task 7: one definition of pull, and counts to go with it

**Write the tests first and see them red.**

1. The new `DIRECTION_KEY_LINE` value appears in both the debrief prompt and
   the chat prompt, and the two cannot drift (mirror the existing trio at
   `src/coachApi.test.js` that does this for the distance distribution).
2. The three spray count lines appear in **both** prompts. The chat prompt
   carries no count lines at all today; it must carry these, because the
   observed defect was in a chat reply.
3. Against session 1's real swings, the three lines read exactly:
   - pull: 3 swings, numbers 3, 7, 15
   - up the middle: 8 swings, numbers 1, 2, 4, 6, 10, 11, 13, 14
   - opposite field: 4 swings, numbers 5, 8, 9, 12
4. The three counts always sum to the session's swing count, on generated
   sessions as well as session 1.
5. A zero bucket ends cleanly with no dangling `— numbers:`, the same guard
   Task 2 applied.
6. The Hit to All Fields goal lines and the new universal lines report the
   **same** pull and opposite-field numbers. This is the drift that caused the
   defect; it must be impossible, not merely true today.

**Then implement.**

- Add `SPRAY_CUTOFFS` and `sprayBreakdown(swings)` to `src/sessionStats.js`,
  beside `STRIKE_ZONE` and `pitchZoneBreakdown`, which are the exact precedent:
  a classification convention that several places must agree on.
- `GOAL_COUNT_SPECS.allfields` reads its `pullDirection` and `oppoDirection`
  from `SPRAY_CUTOFFS` instead of writing -15 and +15 itself, the same way
  `goalCountSpecs.js` already reads from `goalTargets.js`.
- Add `sprayCountLines(swings)` in `src/coachApi.js` beside `zoneCountLines`,
  and render it in both prompt builders.
- `scripts/factSheet.js` gains one row per new count, from `sprayBreakdown`.

## Task 8: re-run the round

Same shape as Task 4: bench at seed 20260814, `BUILDER.txt` written before
grading, grader `--dry-run` before the paid call, `--validate` on the real run,
then hand-check every flagged claim. Output under
`docs/eval-fixtures/slice10-direction-key/after-spray/`. Roughly $1.49.

**Compare against the first round, not against Slice 9's after-a.** The first
round is now the nearest neighbour: same data, same seed, one prompt
generation apart. Say plainly that the null band was pre-registered against a
different comparison and state whether it still applies.

## Task 9: bring the records up to date

The decision log entry, `CLAUDE.md`, and the fixture READMEs all describe the
prompt that did not ship. Correct them by appending and annotating, never by
rewriting. The first round's README must say what it measured and why that is
not what shipped.

## Task 10: re-review, then update the pull request

Independent whole-branch review again, then update PR #32's body. The body must
name the QA rejection, since a stranger reading the repo later learns more from
a slice that was caught by its own gate than from one that was not.
