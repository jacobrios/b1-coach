# Slice 6: honest ball flight

Written 14 August 2026. Agreed scope for this slice is items 1, 2 and 9 of
"credibility polish" in `docs/queued-slices.md`, which is the data-model half of
what that document scoped. The surface-polish half is Slice 6b.

---

## Settled before building. Do not relitigate.

The product manager decided each of these on 14 August 2026, three of them
against options that were put to him with numbers attached.

- **Split at the data-model seam, this half first.** `queued-slices.md` warned
  the nine items might be too large for one slice and named this seam. They are.
- **Power on-target feel: correlate, lift, re-roll.** Not a widened target band
  and not a hard floor. Reasoning below.
- **The simulated hitter stays at 82 to 83 mph average.** Raising him would have
  dissolved the empty-band problem on its own; the product manager chose the
  honest high-school hitter over the more impressive college one.
- **Distance means carry, not total with roll.** That is what TrackMan measures,
  and it is what makes launch angle visibly matter.
- **The 65/35 improve-or-decline design is untouched**, as is `varianceFactor`.
- **The Reduce Pop-Ups card becomes `LA 10–25° · Level it out`.** Decided in this
  session, but it is Slice 6b work, not this slice's.

## Not in this slice

- **Items 3 to 8 of credibility polish** (favicon, scaffolding files, lint,
  README, `.env.example`, Pop-Ups card copy): **Slice 6b**, now unblocked because
  the only copy decision it was waiting on is settled above.
- **Everything in Slice 7, coach fidelity:** stays in **Slice 7**, including the
  `__tips__` seam and the hardcoded 15 degrees. One exception is folded in here
  and explained below, because this slice creates it.
- **The strike-zone bounds, still written out six times:** stays behind the
  existing third-drift trigger in CLAUDE.md.
- **How large the improvement arc should be** (`varianceFactor`): stays on the
  What's Next list, unchanged and unmeasured by this slice.

## How this gets verified

Written before any code, because a plan that decides its evidence afterwards
decides it to fit what happened.

1. **Unit tests, each seen red first.** Reference points on the distance curve,
   the three bucket-edge copies agreeing with each other, and the re-roll firing
   when a targeted goal comes up empty and not otherwise.
2. **A hand-run measurement script**, provably outside the test runner's
   collection, reporting empty-band rate per goal per session over 20,000
   replays. The suite cannot settle a distributional claim, and a single session
   that happens to look fine is not evidence. Baseline and after numbers go in
   the decision log.
3. **A browser pass**, because the suite covers no screens at all. Session 1 on
   Power, then sessions 2 through 4, then one other goal.

## Debt this slice is expected to open

- **The re-roll is a deliberate nudge on the generator**, and it must be recorded
  as one. A future session reading `generateSwings` should not mistake it for an
  unbiased simulation.
- **The distance curve is tuned constants, not derived physics.** They live in
  one tested file with their reference points written down, but they were chosen
  by judgment against general baseball knowledge, not fitted to real data.
- **A fourth thing the generator now knows about goals.** `generateSwings` gains
  a `goalId` argument. That coupling is new and is the seam a future goal-aware
  change would extend.

---

# Task-by-task

Full length deliberately. This half of the document is written for whoever
executes it, and it is what stands in for the product manager being in the room.

Test baseline recorded before any code: **242 passing across 8 files**, working
tree clean, branch `slice-6-honest-ball-flight` cut from `main` at `2c069d6`.
No pre-existing failures to carry.

## Task 1: the distance function, in its own file

**New file `src/ballFlight.js`.** It follows the precedent set by
`goalTargets.js`, `sessionStats.js` and `chartSlots.js`: logic that needs testing
lives outside the two big screen files, so a test can reach it without loading
Recharts and a DOM. Do not put this in `App.jsx`.

Export one function, `carryDistance({ exitSpeed, angle })`, returning feet as a
rounded integer.

The shape it must have:

    potential = max(0, (exitSpeed - 45) * 7.5)      // carry at the ideal angle
    shape(angle) =
      angle <= 28 : 0.30 + 0.70 * ((angle + 5) / 33) ** 0.9
      angle >  28 : max(0.55, 1 - (angle - 28) * 0.02)
    carry = round(potential * shape)

These constants are a starting point, not a result. They may be adjusted during
the browser pass in Task 8 if the rendered chart argues for it; if they move, the
reference points in the tests and the numbers in the decision record move with
them, and the reason is written down.

**Reference points this produces**, against the app's own bounds of 65 to 97 mph
and -5 to 35 degrees:

    70 mph @  4°  ->   97 ft    a ground ball, carries almost nothing
    75 mph @  6°  ->  126 ft
    82 mph @ 12°  ->  190 ft    a line drive
    85 mph @ 20°  ->  254 ft
    88 mph @ 26°  ->  310 ft
    88 mph @ 28°  ->  323 ft    the centre of the Power target
    91 mph @ 28°  ->  345 ft
    97 mph @ 28°  ->  390 ft    the hardest ball this app can generate
    65 mph @ -5°  ->   45 ft    the softest
    97 mph @ 35°  ->  335 ft    hit too high, loses carry

Compare against what ships today, `round(ev * 4.0 + la * 1.8)`: 70 mph at 4
degrees is currently recorded as **287 feet** and 91 mph at 28 degrees as **414
feet**. The old formula's floor is 251 feet, which is why the first two distance
buckets can never fill.

*(A number correction for the record: the design conversation quoted the Power
target as carrying 310 feet. Under the final curve above, 88 mph at 28 degrees
carries 323 and 88 mph at 26 carries 310. Nothing decided changes; a
warning-track flyball either way.)*

**Tests, in `src/ballFlight.test.js`, each seen failing before the file exists:**

- A ball below 10 degrees carries no more than two-thirds of what the same exit
  velocity carries at 28. This is the whole point of the change and the thing
  the old formula got wrong. The threshold is two-thirds rather than a half
  because the curve was measured before this was written: at 88 mph, 8 degrees
  carries 194 feet against 323 at 28, a ratio of 0.60. A test asserting "less
  than half" would fail against the curve this plan specifies, which is worth
  saying out loud, since a plan that specifies an impossible test wastes the
  first red run rather than earning it.
- Carry is monotonic in exit velocity at a fixed angle.
- Carry peaks near 28 degrees: 28 beats both 15 and 35 at a fixed exit velocity.
- The extremes of the app's own range produce sane feet: nothing negative,
  nothing above 400.
- Non-finite or missing inputs return 0 rather than `NaN`. `computeStats` already
  had a `NaN` bug of exactly this shape, fixed in Slice 4; do not reintroduce the
  pattern in a new file.

## Task 2: route both swing sources through it

Two places produce swings and both must use the same function, or the fixed
session every visitor sees will contradict the generated ones. That contradiction
is the specific failure this task exists to prevent.

1. **`generateSwings` at `src/App.jsx:723`**: replace
   `const dist = Math.round(ev * 4.0 + la * 1.8)` with a call to
   `carryDistance`.
2. **The hand-written `mockSwings` at `src/App.jsx:649-665`**: recompute all
   fifteen `landing.distance` values through the same function.

**Keep every `exitSpeed`, `angle`, `direction`, `plateLocHeight` and
`plateLocSide` in `mockSwings` exactly as they are.** Only distance moves. Those
fifteen swings are the first thing every visitor sees, they already show three
Power swings on target, and changing the launch angles would change that first
impression for reasons unrelated to this slice.

Recomputed by hand from the curve above, for checking the implementation rather
than for pasting blind:

    78/12 -> 170   72/ 8 -> 122   88/26 -> 310   75/ 6 -> 126   91/28 -> 345
    82/18 -> 224   76/10 -> 150   85/24 -> 277   79/14 -> 185   83/20 -> 241
    87/22 -> 279   70/ 4 ->  97   86/25 -> 290   80/16 -> 201   92/27 -> 346

These fifteen were computed from the curve, not estimated. Recompute them in the
implementation anyway rather than pasting them; if any disagree with the
function, the function wins and this table was wrong.

Note what this does to the opening session: the longest ball drops from 416 feet
to about 346, and the shortest from 287 to 97. That is the intended outcome.

## Task 3: the generator's contact quality and goal awareness

Three changes inside `generateSwings`, and one signature change.

**3a. Exit velocity and launch angle share a contact-quality term.** Today they
are drawn independently at `src/App.jsx:720-721`, which is why a hitter averaging
17 to 19 degrees essentially never produces a swing that is an outlier on both at
once. Real batted balls do not work that way: a barrel is high exit velocity and
a good angle in the same swing.

Draw one shared term per swing and mix it with independent noise at a correlation
of 0.6, keeping the total spread identical to today's so the charts do not
visibly tighten:

    q  = random() - 0.5                     // shared contact quality
    nEV = random() - 0.5                    // independent
    nLA = random() - 0.5                    // independent
    k = sqrt(1 - 0.6²)
    ev = round(clamp(65, 97, sessionEV + (0.6*q + k*nEV) * 16 * varianceFactor))
    la = round(clamp(-5, 35, sessionLA + (0.6*q + k*nLA) * 22 * varianceFactor))

The `16` and `22` spreads and the `varianceFactor` are unchanged. Do not touch
`varianceFactor`; how big the improvement arc should be is a separate open
question on the What's Next list.

**3b. Goal-aware launch angle, Power only, on a ramp.** `generateSwings` takes a
new `goalId` argument. When it is `'power'`, add a lift to `sessionLA`:

    lift = (sessionNum - 1) * 2     // session 2: +2, session 3: +4, session 4: +6

The product story is that a player who selected the Power goal is working on
launch angle, which the generator currently ignores completely. A flat +5 was
measured and rejected: it scores marginally better but moves session 2's average
launch angle 5.5 degrees away from session 1's 17.3 in a single round of batting
practice, which is exactly the kind of implausible number this slice exists to
remove. The ramp lands session 2 at 19.9 degrees and session 4 at 23.8.

The single call site is `src/App.jsx:1051`, inside a component where
`selectedGoal` is already in scope.

**3c. Re-roll a session that would render an empty target band.** After
generating, if the goal has a target (`hasTarget` in `src/goalTargets.js`) and
zero of the fifteen swings meet it (`meetsTarget`), generate once more and keep
the second attempt whichever way it comes out. Once, not until it succeeds: an
unbounded loop would guarantee a nicer answer than the design admits to.

**Write this generally, not for Power.** Measured over 20,000 replays, Line
Drives & Contact renders an empty band 16 to 19 percent of the time for the same
underlying reason, which nobody had noticed. A general re-roll fixes that for
free. Reduce Pop-Ups measures 0 percent and is unaffected either way.

**Correction, 14 August 2026, during execution.** The paragraph above is wrong
and the reason it is wrong matters more than the number. The 16 to 19 percent
was measured with the correlation change already switched on. Line Drives &
Contact renders empty **9.7 percent** of the time as the app ships today
(10.8 percent at session 4), re-measured twice, once by the implementer and once
independently.

**The correlation change makes Contact worse, not better**, and that is not a
defect in it. Contact asks for a hard-hit ball at a *moderate* launch angle, 8 to
18 degrees. Tying exit velocity and launch angle together means the hardest-hit
balls now tend to be the highest ones, which pushes them through Contact's
18 degree ceiling. So the correlation alone would have taken Contact from 9.7 to
16.7 percent.

The general re-roll more than pays that back, landing Contact under 4 percent,
better than it ships today. But the honest description of this task is that
**writing the re-roll generally is load-bearing rather than a free bonus**:
without it, this slice would have shipped a regression on the second most likely
goal a visitor clicks.

**Measured effect of 3a, 3b and 3c together, on the Power goal:**

    sessions showing an empty band, session 2:  56%  ->  13%
    sessions showing an empty band, session 4:  62%  ->  11%
    Line Drives & Contact, session 2:           17%  ->  ~3%

**Tests, seen red first:** the re-roll fires when the first attempt is empty on a
goal with a target; it does not fire for `allfields` or `open`, which have no
target; and it re-rolls at most once. Inject the random source rather than
testing against real randomness, so the test can force an empty first attempt.

## Task 4: the distance buckets, in all three copies

Only after Tasks 1 to 3 are landed, because the buckets must be set from the
range the data actually occupies rather than guessed.

**Run the measurement script from Task 7 first** and read the real percentiles
off the new generator. Under the formula and generator above, an early
measurement gave a median near 222 feet, a 10th percentile near 162 and a 90th
near 293, but that was taken before the correlation change and will have moved.

Then set five bucket edges that give the chart visible shape across at least four
of its five columns, and write the same edges in all three places:

    src/DebriefScreen.jsx:547-553    the chart itself
    src/coachApi.js:382              the debrief prompt
    src/coachApi.js:407              the chat prompt, easy to miss

A provisional candidate to check against the measurement, not to adopt blind:
`<150`, `150-200`, `200-250`, `250-300`, `300+`.

**Fixing two of the three is the specific failure mode here.** The chat prompt is
the one that gets missed; CLAUDE.md already records these three copies as known
debt, and leaving the chat prompt describing ranges the chart no longer draws is
the exact drift this project keeps having to clean up.

**Add a test that the three agree.** Extract the edges to a single exported
constant if that is the cleanest way to make such a test possible, but do not
turn this into a wider consolidation exercise: the strike-zone bounds are
explicitly out of scope.

Today's first debrief renders 0, 0, 1, 4, 10. Record what it renders after.

## Task 5: the spray chart's distance handling

**Not named in `docs/queued-slices.md`.** Found while reading the code during
design on 14 August 2026, and it is the only one of these changes that is
visually obvious rather than numerically obvious.

`src/DebriefScreen.jsx:708` sizes every dot by its distance:

    const scale = Math.max(40, Math.min(200, 120 + (dist - 300) * 0.65))

That is centred on 300 feet, which was the middle of the old distribution and is
now near the top of the new one. Left alone, every dot collapses toward the
minimum radius and the spray chart reads as though every ball died in the
infield.

`src/DebriefScreen.jsx:701-702` hardcodes two ring labels, `300ft` and `400ft+`.
Under the new formula almost nothing reaches 400 feet, so the outer label
describes a ring no ball will ever occupy.

Re-centre the scale on the new median and move both labels to distances the data
actually reaches. Both are judgment calls that need the rendered chart to settle,
so do this task with the browser open rather than by arithmetic alone. This is
the task most likely to need a second pass.

## Task 6: the coach's "home run distance" claim

`src/coachApi.js:33` currently tells the coach:

    These are the conditions for home run distance contact.

That was defensible while 88 mph at 26 degrees was recorded as 399 feet. After
Task 1 it carries 310, and the coach would be saying "home run" beside a chart
showing a warning-track flyball. **This slice creates the contradiction, so this
slice fixes it**, rather than leaving it for Slice 7's coach-fidelity work.

Replace with wording the product manager approved on 14 August 2026: the target
describes **the player's best contact**, not home run contact. Keep the sentence
short; that prompt is already long.

Do not change the numbers in `src/goalTargets.js`. Raising the Power exit
velocity target to make the old wording true was offered and declined, because it
would move the chart band and make the empty-band problem substantially worse.

## Task 7: the measurement script

A named, hand-run script, kept **provably outside the test runner's collection**
so it can never masquerade as the suite. Confirm that by running `npm test` after
adding it and checking the file count is still 8 plus whatever this slice adds
deliberately, never plus this script.

It replays the generator 20,000 times per goal per session and reports:

- empty target band rate, per goal, per session
- the distance distribution's min, 10th, 25th, 50th, 75th, 90th percentiles and
  max
- the fill percentage of each chosen distance bucket

Run it before the generator changes and after, and put both sets of numbers in
the decision record. The before numbers for Power are already measured and are
56 percent at session 2 and 62 percent at session 4; reproduce them rather than
citing this document, since a number nobody can rerun is not evidence.

## Task 8: the browser pass

The suite covers no screens, so nothing above is verified until this is done.
`npm run dev` is sufficient for this slice: nothing here touches `api/coach.js`,
so the trap that makes local development useless for server changes does not
apply. Model calls still go straight to Anthropic through the Vite proxy, which
is what makes the coach's own sentences checkable.

Check, on the Power goal:

1. **Session 1, first click.** The raw data table's distances are plausible
   beside the exit velocity and launch angle printed on the same row. The 70 mph
   at 4 degrees swing reads near 97 feet, not 287.
2. **The distance bar chart has fill in more than one column.** Today it renders
   0, 0, 1, 4, 10.
3. **The spray chart's dots spread**, and both ring labels name distances balls
   actually reach.
4. **The coach's opening sentence quotes a distance that matches the table.**
   This is the one that mattered enough to start the slice: the live app was
   observed saying "ten of your fifteen swings carried 340 feet or more" on a
   session averaging 82 mph.
5. **Generate sessions 2, 3 and 4.** The orange target band has swings in it in
   most sessions, and the session-over-session numbers still read as a plausible
   hitter rather than a leap.
6. **One non-Power goal**, to confirm the goal-aware lift did not leak. Line
   Drives & Contact is the right choice, since it is the other goal with a target
   and the re-roll now covers it.

Screenshots for the ones that are visual. A claim that a chart looks right
without a rendered screenshot is not evidence, per the project's own standard.

## Task 9: close the slice

- **`docs/product-decisions-log.md`**, most recent first, in product language:
  what was decided and why, including the four decisions the product manager made
  on 14 August 2026 and the reasoning behind each rejected option. Baseline and
  after numbers from Task 7. 400 to 600 words.
- **`CLAUDE.md`**: the "Where things live" line counts, a note that
  `src/ballFlight.js` exists and is the single source for hit distance, the
  generator's new goal awareness and re-roll written down plainly as a deliberate
  nudge, and the distance buckets moved from known debt to done.
- **The What's Next list**: items 1, 2 and 9 of credibility polish come off,
  Slice 6b goes on with items 3 to 8 and its now-settled Pop-Ups wording, and
  anything this slice surfaced goes on.
- **`docs/queued-slices.md`** gets a dated postscript recording that Slice 6 was
  split, which half shipped, and that the spray chart was a fourth place the
  distance change landed that the original scope did not name. Append-only; do
  not edit what is already written there.
- **An independent read-only code review before the PR**, per the standing rule.
  The PR body proves it happened.
