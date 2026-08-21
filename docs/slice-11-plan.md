# Slice 11: the generator stops lying about the hitter and the pitcher

Eight measured defects in `src/swingGenerator.js`, all recorded in CLAUDE.md's
"Added at the close of Slice 10" block, plus the riders queued to travel with
them. One slice, because the items interact: the pitch-location link moves the
exit velocity distribution, spray moves Hit to All Fields, and the launch angle
ceiling moves the on-target counts.

## Settled before work started. Do not relitigate.

- **Bill is a varsity high school junior**, 16, good bat-to-ball skills, real
  but not elite bat speed, chases too much. Session 1's frozen 81.6 average and
  92 best ARE this hitter. First written statement of his level outside the
  coach's own voice.
- **Exit velocity ceiling 94.** Two above his measured best, reached rarely.
- **In-zone rate about 65%**, matching session 1's frozen 60%. Every row is a
  batted ball, so this is Bill's chase rate, not the thrower's accuracy.
- ~~**Pitch location predicts contact at about 6 mph**~~ **about 4.5 mph**, so
  session 1's measured 8.8 reads as an ordinary fifteen-swing draw rather than
  the population mean.

  **Amended 21 August 2026, and this is a product decision rather than an
  engineering trim, so do not relitigate it as one.** The 6 was written before
  anything measured what the structure could reach. Task 5 then measured it from
  both ends: 4.5 is what this generator produces once the exit velocity spread is
  widened to match session 1, which this slice wants anyway for its own reasons,
  and every route to 6 costs something the slice has already said it will not
  spend. The product manager took the decision on that evidence, on the reasoning
  that the reachable number is the honest one and that session 1's 8.8 is itself
  a high draw from fifteen swings. Section 6 below carries the full table. Task 9
  aims at 4.5.
- **Per-swing exit velocity spread widens to session 1's 6.11 mph.** The
  generator is 4.23, a 31% tighter hitter than the session it derives from,
  which nobody chose and nothing records.
- **Pop-ups exist, rarely, from getting under high pitches, and need an
  explicit mis-hit mode.** Decided after measurement showed a raised ceiling
  plus a pitch-height link delivers 0.01 to 0.03 per session, which is none.
- **The two prompt lines are approved word for word** and go in BOTH prompts,
  replacing the `Note:` paragraph at `src/coachApi.js:572`. 54 words against 61:
  `- Setting: a coach throws live from behind a screen, so pitch locations vary. Coach the player's swing decisions; never guess at the thrower's intent.`
  and
  `- Sessions: consecutive rounds in one continuous practice period. Refer to them by number, never "today" or "yesterday." Do not imply this is the final session unless it is Session 4.`
- **The Reduce Pop-Ups GOAL is unchanged**; an exit velocity requirement was
  rejected on 19 August 2026 because it collapses into Line Drives & Contact.
  **Exit velocity stays flat across sessions 2 to 4**; item 7 is the session 1
  to 2 step only. **Session 1's fifteen swings do not move.** **The spray legend
  says "Center" and the coach says "up the middle"**, on purpose.

## Not in this slice

- **The Reduce Pop-Ups goal card copy**, which points the wrong way: Slice 6b,
  scoped and approved there since 3 August 2026.
- **Consolidating the spray chart's four inline cutoff literals**: recorded
  debt, watched by Slice 10's tripwire, only worth closing when that screen file
  is open anyway.
- **The two grading-tool gaps from Slice 10**, and **era-gating the fact
  sheet's spray rows**: their own tool slice. Both sit in extraction, so
  validating a fix needs a fresh live round.
- **`--cell` on the bench**: on What's Next, and this slice buys full rounds
  anyway.
- **Dropping Hit to All Fields' duplicate count lines**, and **handedness**
  (the coach now names a field, which assumes a right-handed hitter): both need
  prompt approval and belong with the next prompt slice.

## How this slice will be verified

Written before any code exists.

1. **The deterministic half carries the weight.** All eight items are free to
   measure; `scripts/measure-swing-generation.mjs` grows a section per item and
   gains a seed, since nothing it has ever printed is reproducible today. The
   slice succeeds if the data got honest and the coach did not get worse.
2. **Task 1 is proved alone, before any tuning.** The frozen generator is the
   unproven mechanism. A digest of all seven cells at both seeds, taken from the
   LIVE builder before any generator edit, becomes a suite test the frozen
   builder must reproduce. Seen failing first against a mutated snapshot.
3. **Suite before and after.** Baseline on this branch before any edit: **573
   tests across 22 files, green**, matching Slice 10's finishing number. No
   pre-existing failure to carry.
4. **A failing test first for every new behaviour.** Distribution claims stay in
   the measurement script; the suite tests deterministic seams and never calls
   the model.
5. **The `varianceFactor` blind spot closes here**, because item 8 is about that
   constant's reach and a reviewer once changed it six-fold with all 22
   generator tests staying green.
6. **Two live after rounds at two seeds.** Not optional: this changes all the
   data, and Slice 9 proved one seed cannot separate signal from noise.
7. **The before round costs no bench calls.** Slice 10's `after-spray` rebuilds
   through the frozen builder. It is re-graded, about $0.35, so both sides pass
   through the identical instrument on the same day.
8. **A pre-registered non-inferiority band, written here before the money is
   spent.** Demonstrated same-condition spread of hand-checked genuine coach
   errors across four committed rounds is 8 to 19, or 1.8% to 3.8% of ruled
   claims. **The slice fails only if BOTH after rounds hand-check above 3.8%.**
   One round above it is inside the demonstrated noise. Raw flag counts are
   reported but are NOT the test.
9. **Every flagged claim is hand-checked**, and the write-up says so.
10. **A real browser pass** across several goals and both a session-1 and a
    session-4 screen, run after the eval and able to reject the slice. Slice
    10's gate rejected it after its round passed.
11. **Free dry runs, bench and grader, before every paid round.** That gate was
    silently dead for an entire slice once.

## The debt this slice is expected to open

- **The frozen snapshot carries its own copies of `carryDistance`,
  `meetsTarget` and the goal targets.** Deliberate: a snapshot reading the
  working tree is not a snapshot. It will drift from `src/` on purpose, and a
  future reader can still mistake that for rot.
- **Two prompt lines ship inside a round bought to measure the generator.** They
  carry no counts, so the expectation is nil effect, as Slice 10's direction key
  was. It is a confound and this slice claims nothing about them.
- **The mis-hit pop-up rate is chosen, not derived.** No real TrackMan pop-up
  rate was consulted, and the PR must say so.
- **No debt here, recorded because it was nearly opened.** The plan first
  carried a task to make the dev server reachable from a phone, so the standing
  real-phone rule could be honoured. The owner declined it on 20 August 2026:
  this app is consumed on a desktop or an iPad and does not need to work on a
  phone at all. The rule now has a permanent home as the fourth verification
  norm in CLAUDE.md, so it is not re-decided next slice. Task 14's browser pass
  is a desktop pass and that is complete, not a deviation.
- **Widening the spread moves numbers Slice 6 tuned.** Power's empty target band
  falls from 13.7% to roughly 3%. Lower is not a regression, but it arrives as a
  side effect rather than an aim, and Slice 6's reasoning was written against the
  old number.

---

# Tasks

Each task is one implementer and one independent reviewer. The coordinator
writes nothing.

## Task 1: freeze the generator, repair five markers, prove it

**Nothing in `src/swingGenerator.js` may be touched until this task is
reviewed and green.** The `current` builder in
`scripts/grade-coach-accuracy.mjs` rebuilds sessions 2 to 4 from the working
tree generator. The moment the generator moves, five committed fixture
directories begin producing complete, plausible-looking fact sheets for swings
their coaches never saw, and nothing looks broken.

**CLAUDE.md says four directories. It is five.** Correct that number as part of
this task. `docs/eval-fixtures/slice9-session-one/before` has the identical
exposure: its `slice9-before` builder swaps only which fifteen session-1 swings
it starts from and then calls the same `buildSessionsFromBaseline`, which
imports the generator from the working tree. The five are:

    slice9-session-one/before        builder = slice9-before
    slice9-session-one/after-a       builder = current
    slice9-session-one/after-b       builder = current
    slice10-direction-key/after      builder = current
    slice10-direction-key/after-spray builder = current

**Dated correction, 20 August 2026, after Task 1 was built, reviewed six times
and finished. It is six, not five.** The sixth is
`docs/eval-fixtures/slice7-debriefs`, the 96-debrief fixture, and it is the one
this project could least afford to lose: the grading tool's own ability to catch
a real coach error was established against those debriefs and no others, and the
tool forces that builder every time it runs that check. So a generator rewrite
would have re-validated the tool against a set of swings no coach in the fixture
ever saw.

It hid, through six passes, for a reason worth carrying forward. That directory
already freezes its own first session and its own list of cells, so to everyone
who looked it read as a directory that had already dealt with this. It had dealt
with half of it. The other half, the generator that turns session 1 into
sessions 2, 3 and 4, it took from the live app, exactly like the five above.
Every one of its cells is a later session, so every one of them was exposed.

The correction was written up as Task 1b and is done. What is worth taking from
it, more than the number: the summary table inside
`scripts/grade-coach-accuracy.mjs` listed three builders while the file had
four, and a provenance list a dozen lines above it named the missing one
correctly. Reviewers read the summary. A thing left out of the summary does not
exist as far as review is concerned.

**Write the digest first, from the live code, before anything changes.**

1. A script run resolves all seven cells (`power-s1`, `power-s2`, `contact-s1`,
   `contact-s4`, `open-s4`, `allfields-s4`, `popup-s4`) at both seeds, 20260814
   and 20260819, through today's `current` builder, and writes a stable digest
   to `docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json`. Also
   resolve the `slice9-before` cells at 20260814. This file is the ground truth
   for everything below and it can only be produced before the generator moves.
2. Commit it on its own, before the snapshot exists, so the order is provable
   from the history.

**Then build the snapshot.**

- `docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs`, recovered from
  `src/swingGenerator.js` at commit `53315e5`, not retyped.
- **It imports nothing from `src/`.** It carries frozen copies of
  `carryDistance` from `src/ballFlight.js`, and `hasTarget` / `meetsTarget` /
  the `GOAL_TARGETS` table from `src/goalTargets.js`. Precedent is
  `docs/eval-fixtures/slice7-debriefs/rebuild.mjs`, which freezes an entire
  stand-in generator for the identical reason one generation earlier.
- Its header says, in the same voice as
  `slice9-session-one/session-one-before.mjs`: what it is, why it must never be
  updated to match `src/`, and that its duplication of `carryDistance` and the
  goal targets is the point rather than an oversight.
- The export is named `generateSwingsPreSlice11`, not `generateSwings`, so an
  import can never be mistaken at a glance for the live module.

**Then restructure the builders.**

A builder becomes a pair, not a baseline. In `scripts/grade-coach-accuracy.mjs`:

    const BUILDERS = {
      current:          { baseline: loadCurrentBaseline,      generator: loadCurrentGenerator },
      'slice11-before': { baseline: loadCurrentBaseline,      generator: loadPreSlice11Generator },
      'slice9-before':  { baseline: loadSlice9BeforeBaseline, generator: loadPreSlice11Generator },
    }

- `buildSessionsFromBaseline` takes the generator as a parameter instead of
  reaching for `loadGeneratorDeps`. It stays ONE function shared by all three
  baseline-driven builders, for the reason its own comment already gives: two
  copies would let something else drift into the difference.
- `computeStats` continues to come from the working tree. It is not part of the
  generator and this slice does not touch `src/sessionStats.js`. Say so in the
  comment, because it is the next thing a reader will ask.
- `slice9-before` is **repointed, not renamed**. Its meaning was always "what
  that round was written against," which now requires the frozen generator too.
  Its marker keeps saying `slice9-before` and needs only an annotation.
- The builder comment block, which is the subtlest part of that file, gains a
  fourth dated section explaining that a builder is now a pair and why.

**Then repair the five markers**, as dated append-only annotations, never
rewrites. The four `builder = current` lines become `builder = slice11-before`,
with the old line left visible as a commented-out struck record directly above
and a dated paragraph saying what changed and why. `slice9-before/BUILDER.txt`
keeps its line and gains the same dated paragraph.

**Then the permanent guard.** New `scripts/frozenGenerator.test.js`, in the
suite:

1. Every cell at every seed resolved through `slice11-before` equals the
   committed digest exactly.
2. Every `slice9-before` cell equals its committed digest exactly.
3. Seen failing first, two ways, both recorded in the task report: mutate one
   constant inside the snapshot and watch it go red, and repoint one loader at
   the live generator and watch it go red once Task 4 lands.

**And correct the record**: CLAUDE.md's "four committed fixture directories"
becomes five, as a dated annotation. *(Dated correction, 20 August 2026: and
then six. See the correction under the list further up this task.)*

## Task 1b: the sixth directory, and the summary table that hid it

Written 20 August 2026, after Task 1 was finished and reviewed. It repoints
`docs/eval-fixtures/slice7-debriefs/rebuild.mjs` at the frozen snapshot, adds a
third group to the committed record of what the old generator produced so that
fixture's swings are re-checked on every test run, adds the missing fourth row
to the builder summary table in `scripts/grade-coach-accuracy.mjs`, and corrects
every place that said four or five. Full detail in the task's own brief and
report under `.superpowers/sdd/slice-11-plan/`.

**One residual it could not close, named here because Task 4 will meet it.**
That fixture works out how far each first-session ball carried by calling
`carryDistance` from `src/ballFlight.js`, live. It could not be pointed at the
frozen copy, because that copy is private to the snapshot and sits inside the
snapshot's pinned region, so reaching it would mean re-pinning a hash for
convenience, which this project has already decided in writing is how that guard
stops meaning anything. What it has instead is noise rather than prevention: a
change to the carry formula that reaches those first-session balls turns three
named tests red. Measured, along with the case it does NOT catch, in that
file's own header. Slice 11 does not currently plan to touch
`src/ballFlight.js`; if that changes, the answer is a frozen carry formula, and
never a new record of what the generator produced.

**Dated correction to the paragraph directly above, 20 August 2026, and Task 4
should read this rather than it.** That paragraph is carrying the version of the
sentence that the task's own work disproved, which matters because this document
is what Task 4 is pointed at. Three things in it are wrong:

- **It is four tests, not three.** The three cells plus the seed-honesty test,
  which is also a comparison against the same record. Measured.
- **"Noise rather than prevention" undersells the cover.** The only carry
  changes the record cannot see are ones this fixture never exercises: its first
  session is built at a fixed seed, so the same fifteen balls forever, and none
  of the 45 recorded ones is hit steeply enough to reach the part of the formula
  that is uncovered. For this fixture the record catches every carry change that
  can move a number it holds. The honest residual is that this cover comes from
  the data rather than from the wiring, ~~so it would quietly stop holding if
  somebody changed how that stand-in first session is built.~~

  *(Struck clause corrected 21 August 2026, by review. It was false about the
  very mechanism it named: changing that stand-in session's seed turns four
  tests red, loudly, because the record pins all forty-five of its balls one by
  one. Raising its angle limit does stay green, but only because no ball reaches
  the limit, so the cover did not change either. What is true is that the cover
  is complete for the shallow half of the carry formula and absent for the steep
  half, because none of the forty-five balls exceeds 28 degrees, and that absence
  is a property of the data rather than a requirement anyone wrote down, so a
  future slice that legitimately re-pins the record could change which half is
  covered without any test saying so.)*
- **It was not impossible, only declined.** The pinning rule rules out exporting
  the frozen copy from inside the snapshot. It does not rule out a second frozen
  copy of the carry formula sitting beside it, which would need no re-pin at all.
  That was declined because this project consolidates hard against duplicated
  formulas and the fixture is covered today; it is a judgment call and Task 4 has
  the option.

The full measurements are in `rebuild.mjs`'s own header, which carries the
corrected version.

## Task 2: grow the measurement script, and take the before numbers

`scripts/measure-swing-generation.mjs` gains one section per item, each
printing today's number so the after numbers have something to sit against.
No `src/` file is touched in this task.

1. **Zone gap.** Mean exit velocity on swings at pitches inside the strike zone
   minus outside, and the same split for launch angle. Today: 0.00 mph.
2. **Miss geometry.** For every out-of-zone pitch, how far outside it is, in
   feet, as a distribution, plus the minimum and maximum pitch height seen.
   Today the misses are 0.5 to 1.4 feet and 3.6 to 4.1 feet, so the closest a
   miss ever comes to the zone is 0.1 feet and the furthest is a ball that
   bounces. Session 1's own six misses print beside them as the target shape:
   0.10, 0.10, 0.20, 0.30, 0.30, 0.70.
3. **Spray.** Pull, middle and opposite field per session, per session number,
   using `sprayBreakdown` from `src/sessionStats.js` so the script and the
   coach's prompt cannot disagree. Today: 3.24 / 7.01 / 4.76, and it narrows
   every session.
4. **Pop-ups.** Swings above 35 degrees per session, per goal, and the share of
   them on pitches at or above the top of the zone. Today: zero everywhere.
5. **Ceiling pile-ups.** Share of swings at exactly the launch angle ceiling
   and exactly the exit velocity ceiling. Today: 2.16% at 35.0, and the Power
   session-4 figure of 4.2% that Slice 10 recorded.
6. **Top exit velocity.** The distribution of each session's highest exit
   velocity, and the share of sessions exceeding session 1's frozen best of 92.
   Today: median 90, p90 94, and 21.6% beat 92.
7. **The session 1 to 2 step.** The distribution of a session's average exit
   velocity against session 1's 81.6. Today: mean +1.74, and the improving
   branch can never return less than +1.
8. **Hit to All Fields against its own bar.** Share of sessions with at least 3
   pull and at least 3 opposite field, by session number. Today: 64 / 59 / 52.
9. **The regression guards**, which are the numbers this slice must not break:
   empty target band rate per goal per session, distance bucket fill, per-swing
   exit velocity and launch angle spread, and session average exit velocity.

**Seed it.** Both hand-run measurement scripts are unseeded today, and CLAUDE.md
records that no number either has ever printed is reproducible. Take a
`--seed` flag defaulting to a fixed value, so every number this slice quotes
can be re-run to the same answer. This is in lane: the slice's entire evidence
base is what this script prints.

Run it and paste the before numbers into the task report. They go in the
decision record.

## Task 3: the two prompt lines

**Write the tests first and see them red.** Mirror the `DIRECTION_KEY_LINE`
trio in `src/coachApi.test.js`, which already does this job through the
`capturedMessage` helper, so no production code needs extracting to reach the
chat prompt.

1. Both exact lines appear in the debrief message.
2. Both exact lines appear in the chat message. The chat prompt carries no
   setting note at all today, which is the gap this closes.
3. The two prompts cannot drift: extract each line from both with the same
   regex, assert equal, and assert both equal the exported constants.
4. The old `Note: All sessions shown here...` paragraph is gone from the
   debrief prompt. Assert its absence, or the change can half-land.

**Then implement.** Two exported constants beside `DIRECTION_KEY_LINE` in
`src/coachApi.js`, interpolated into both builders. Placement: with the other
session-level context, above the per-session blocks, since they describe the
whole practice rather than one session.

**Disclosed cost, carried into the PR:** adding the sessions line to the chat
prompt also fixes a pre-existing bug nobody asked about, since the chat coach
can say "yesterday" today and will stop.

## Task 4: the pitch is drawn first, and the misses are near misses

**Write the tests first and see them red.**

1. Given a random source that forces an out-of-zone pitch, the pitch never
   lands below 1.5 minus 0.80 feet or above 3.5 plus 0.80 feet, and never
   further sideways than 0.7 plus 0.80 feet. Today's floor is 0.5 feet, a ball
   that bounces, so this test is red against the unfixed code.
2. An out-of-zone pitch is out on ONE axis and plausible on the other. A low
   pitch still has an ordinary side value rather than a second independent
   miss.
3. The in-zone share responds to the constant, checked by driving `random` with
   values either side of it.

**Then implement**, in `src/swingGenerator.js`:

- The pitch is drawn before the swing outcome, because a pitch drawn after
  cannot influence it. This reorders the draws, which changes every generated
  session at a given seed. That is expected and is exactly why Task 1 came
  first.
- `IN_ZONE_RATE = 0.65`, replacing 0.70.
- Out of zone, a miss distance of `0.05 + random()**2 * 0.75`, which
  concentrates near the edge and tops out at 0.80 feet. Mean 0.30, matching
  session 1's own six misses whose mean is 0.28 and whose worst is 0.70.
- Axis chosen low 40% / high 30% / wide 30%. An engineering judgment, recorded
  in the comment with session 1's own three low, two high and one wide beside
  it.
- The comment says what this file now claims about the thrower, and that the
  in-zone number is a chase rate rather than a command rate, because that is
  the sentence a future reader will otherwise get backwards.

## Task 5: the pitch predicts the contact

**Write the tests first and see them red.**

1. Holding every noise draw identical, a pitch down the middle produces a
   higher exit velocity than a pitch outside the zone. Red today, where the two
   are identical by construction.
2. Holding every noise draw identical, a high pitch produces a higher launch
   angle than a low pitch.
3. The blend preserves spread: with the pitch term at full weight the swing's
   own scale constant still governs the spread, asserted on exact values from a
   fixed sequence.

**Then implement**, using the variance-preserving idiom this file already uses
for `CONTACT_CORRELATION`, which is the reason that idiom is worth following
rather than inventing a second one:

- A standardised pitch-quality term from the pitch's distance from the heart of
  the zone, normalised so it has the same scale as the existing uniform draws.
- A standardised signed pitch-height term, separate from it, because how far a
  pitch is from the middle and which way it is off are two different facts:
  distance hurts contact quality, direction moves launch angle.
- Both blended in with `sqrt(1 - w^2)` weights so total spread is set by the
  scale constants and not by how many terms were added. The first prototype
  added the pitch on top instead and produced an 11 mph gap with 10% of swings
  stacked against the exit velocity ceiling, which is worth one line in the
  comment so nobody re-adds it.

Constants are provisional here. Task 9 sets them.

## Task 6: pop-ups, and soft ceilings instead of walls

**Write the tests first and see them red.**

1. A forced mis-hit produces a launch angle in the pop-up band and an exit
   velocity below the session's own average. Red today: nothing above 35 exists.
2. A mis-hit is far more likely on a pitch at the top of the zone than on one
   at the bottom, checked by driving the same random source against two pitches.
3. **The ceiling no longer stacks.** Two different extreme inputs produce two
   different outputs. A hard clamp returns the same number for both, so this is
   red against today's `Math.min(35, ...)`.
4. Nothing ever exceeds the ceiling.

**Then implement.**

- An explicit mis-hit mode: a small per-swing chance, weighted by how high the
  pitch is, that the swing gets under the ball. Launch angle from its own band
  around 38 to 50 degrees, exit velocity knocked down, because a pop-up is a
  distinct contact outcome rather than an extreme line drive.
- **Soft compression replaces both hard clamps.** The defect in item 5 is not
  where the wall sits, it is that there is a wall: 2.16% of swings stack at
  exactly 35.0 today, and moving the wall to 50 only works because nothing
  reaches 50. Measured during design, widening the exit velocity spread put 3%
  of swings against a hard 94, which is the identical artefact relocated.
  Compression fixes both ends with one mechanism and survives future tuning.
- `carryDistance` needs no change. Slice 10's finding 3 measured its shape term
  reaching its floor at exactly 50.5 degrees, so a pop-up band topping out at
  50 sits under it. **Verify that rather than trusting the note**, and record
  the check.

## Task 7: exit velocity, and spray

**Write the tests first and see them red.**

1. The session 1 to 2 exit velocity step, driven at the extremes of the random
   source, never exceeds the new bound. Red today, where the improving branch
   returns +1 to +4.
2. Spray direction does not depend on session number. Red today, where `dir` is
   multiplied by `varianceFactor` and so narrows every session.
3. **`varianceFactor` becomes visible to a test.** Driven by a fixed
   non-neutral sequence, session 4's swings differ from session 2's by exactly
   the 0.90 factor. Today a reviewer changed that constant six-fold and all 22
   generator tests stayed green, which is the blind spot item 8 sits inside.

**Then implement.**

- Per-swing exit velocity spread widens toward session 1's measured 6.11 mph.
  The generator is 4.23 today, a 31% tighter hitter than the session it derives
  from, chosen by nobody.
- Exit velocity ceiling 94, soft, per Task 6.
- The session step shrinks so the systematic component sits under the sampling
  noise of a fifteen-swing average. Launch angle keeps its arc: **a hitter can
  change his launch angle inside one practice and cannot change his bat speed**,
  and that sentence is the whole product argument for treating the two
  differently. Put it in the comment.
- `dir` loses `varianceFactor`, widens, and leans slightly pull. Today's
  `(random() - 0.45) * 70 * varianceFactor` centres at +3.5 degrees, which is
  an opposite-field hitter, and shrinks toward zero every session.

**Considered and declined, recorded here so nobody re-proposes it:** giving Hit
to All Fields its own spread lift the way Power gets a launch angle lift.
Removing `varianceFactor` alone already takes that goal from 64 / 59 / 52 to a
flat 73, so the "gets worse every session" defect is fully closed without a
second special-cased goal. Power's lift exists because its band was empty 56%
of the time, which was a defect. A flat 73% is not.

## Task 8: the riders

Three small things queued to travel with this work.

1. **`CONTACT_CORRELATION` does not hold a correlation.** It reads `0.6` and is
   applied to both readings, so the correlation it produces is 0.36, confirmed
   by measurement. Anyone retuning it toward "0.5" would get 0.25. Fix the
   comment, not the constant.
2. **Two test files hold stale copies of session 1's distances.**
   `src/ballFlight.test.js:184` and `src/coachApi.test.js:831` each carry a
   hardcoded array and both stayed green with stale data after Slice 9 replaced
   all fifteen swings. **Do not collapse them into an import**: they are
   expected values inside an assertion, and this project has twice and
   correctly declined to collapse that shape. Add one cross-check per file
   asserting the literal equals what `SESSION_ONE_SWINGS` actually holds, so a
   future session-1 change turns them red instead of leaving them silently
   meaningless. Seen failing first by mutating one value.
3. **`scripts/search-session-one-swings.mjs` hand-copies the generator's
   clamps** and its comment calls them "the clamps the generator obeys" without
   saying they are a copy. This slice changes those clamps, so the copy becomes
   wrong today rather than theoretically. Either import them or annotate the
   comment to say plainly that it is a frozen copy of the Slice 10 clamps and
   that the script reproduces a search run under them.

## Task 9: the tuning pass, and the after numbers

The one task that sets every constant, because they interact and tuning them
inside their own tasks would mean tuning each of them three times.

Targets, in priority order:

1. Zone gap about 6.0 mph.
2. Power's empty target band no worse than today's 13.7%. It is expected to
   fall to roughly 3% as a side effect of the wider spread. Falling is fine;
   record it as a side effect rather than an aim.
3. Contact's empty band no worse than about 5%. It sat at 3.0 to 3.5% and rises
   as contact quality improves, because harder contact pushes launch angle
   through that goal's 18 degree ceiling. This is the guard Slice 6's re-roll
   exists to hold and it is the one most at risk here.
4. Pop-ups roughly 0.3 to 0.5 per session on goals other than Power, with the
   clear majority on pitches at or above the top of the zone. If the majority
   are not on high pitches, the mechanism is not doing what it was bought for
   and the constants are wrong.
5. Nothing stacked at either ceiling above 0.5%.
6. Per-swing exit velocity spread near 6.11, launch angle spread near 7.23.
7. Session average exit velocity step near +0.9 off session 1's 81.6.
8. Hit to All Fields meets its own bar at a rate that does not fall across
   sessions.
9. Distance bucket fill: no empty column on a typical session.

Re-run Task 2's script and put the full before-and-after table in the task
report. **If a target and a guard cannot both be met, stop and bring it to the
product manager rather than picking one.** That trade is his, and the most
likely place it bites is Contact's empty band against the zone gap.

## Task 10: free dry runs

Before any money is spent, and reported even when clean:

- `node scripts/bench-coach-brevity.mjs --dry-run`, which builds every prompt
  and grades a canned reply with no network calls.
- `node --env-file=.env.local scripts/grade-coach-accuracy.mjs --dry-run
  --input docs/eval-fixtures/slice10-direction-key/after-spray --builder
  slice11-before`, which must resolve the new builder and the marker together.

This gate was silently dead for an entire slice once, refusing every `--input`
directory holding one failed bench record, and nothing noticed until a human
ran it by hand at final review. Run both and paste the output.

## Task 11: the before round, re-graded free of bench cost

Slice 10's `after-spray` is 64 debriefs on the pre-Slice-11 generator at seed
20260814. Rebuild it through `slice11-before` and re-grade it, roughly $0.35,
so both sides of the comparison pass through the identical instrument on the
same day. No bench calls are bought.

**Confirm before grading, not after**, that the two new prompt lines do not
move attribution. They carry no counts, so the expectation is that
`scripts/handedCounts.js` reports the same handed-versus-derived split as
`after-spray/grading.json` already holds. If it moves, say so and treat the
comparison as needing the same care the Slice 10 marker demands.

## Task 12: two after rounds

`--runs 8` at seed 20260814, then again at 20260819. 64 calls each, roughly
$1.30 a round plus $0.35 to grade. `BUILDER.txt` written **before** grading, in
the moment the answer is actually known, and it must anticipate its own two
ways of going stale, since this is the slice that learned markers were written
too narrowly twice running.

Output under `docs/eval-fixtures/slice11-generator-realism/after-a/` and
`after-b/`, with a README covering what is and is not safe to conclude.

Total expected spend across Tasks 11 and 12: about $3.65.

## Task 13: hand-check every flagged claim

The tool's false-positive rate has measured 11%, 42%, 12.5%, 34.5%, 40%, 61.9%
and 43.5% across seven rounds, and the last wave produced two mechanisms never
seen before. **A raw flag is a lead, not a finding.** Every one gets read, in a
committed `HAND-CHECK.md` per round, adjudicated genuine or false positive with
the quote and the mechanism. Only then does the pre-registered band in the
verification section get applied.

Watch specifically for the two known gaps, since this slice makes the coach
write about spray and pitch location more, not less: a spray count extracted
as a threshold claim with no comparison and dropped as UNVERIFIABLE, and the
prior-session half of a cross-session comparison never extracted at all.

## Task 14: browser QA

After the eval, and able to reject the slice regardless of what the eval said.
Slice 10's gate rejected it after its round passed, which is the reason this
task exists as its own gate rather than as a line in Task 12.

**A desktop pass, and that is the whole gate**; see the fourth verification
norm in CLAUDE.md for why no phone check is owed here. At minimum: session 1
and session 4, on Power, Line Drives & Contact, Reduce Pop-Ups and Hit to All
Fields. Look at the Launch Angle vs Exit Velocity
scatter for the flat row of dots that should now be gone, the Pitch Location
chart for pitches that no longer bounce, and the spray chart. Ask the coach in
chat about pop-ups and about chased pitches, which are the two things this
slice newly gives it to talk about, and check its answers against the charts on
the same screen. That last check is exactly what Slice 10's own verification
skipped.

Capture the request payload once, so the two new prompt lines are proven inside
something the app really sent rather than only in a unit test.

## Task 15: the records, then the pull request

- The decision log entry, in product language.
- CLAUDE.md: the current-state sections, the file-by-file map, the test count,
  the "data is synthetic" section, which is now substantially wrong, the "four
  directories" correction from Task 1, and the What's Next items this slice
  closes and opens.
- The PR body, near 300 words, naming every touch to already-shipped code and
  to any file this plan did not name.
- The QA script goes to the chat message, not the PR body.

---

# The findings this task produced that are not fixes

Added 21 August 2026, at the close of Task 4, on the precedent of
`docs/slice-10-plan.md`'s section of the same name. These are things Task 4 found
and deliberately did not act on, either because they sit outside its lane or
because they are a judgment for somebody else. They are written here rather than
in the task's own report because that report lives under `.superpowers/`, which
this repository does not keep. This file travels inside the pull request.

## 1. The measurement script now says "mostly" where its own number says "all"

`scripts/measure-swing-generation.mjs`, section 2, generates the sentence "A
pitch that misses low while staying plausible sideways is what a real thrower
produces, and that is now what this one mostly does" in the same block where it
reports 0.0 percent of misses off on both axes and 100.0 percent off on one axis
only.

**"Mostly" is false against the script's own numbers.** It is all of them. The
word was correct while this was written, because before Task 4 the sentence
described a generator that could only ever reduce the defect, and it became wrong
the moment a generator arrived that removes it. Task 4 did not touch that file,
which is right, so this is flagged rather than fixed. One word, for whoever opens
it next, and it should be conditional on the measured share rather than typed
flat, the way the rest of that section's prose already is.

## 2. `scripts/handedCounts.js` is the cheapest strike-zone copy left to close

That file imports `SPRAY_CUTOFFS` from `src/sessionStats.js` at line 24 and uses
it at lines 49 and 50, under a comment saying it is read from the constant rather
than typed for exactly the reason this project consolidates. Seven lines further
down, at 57 to 58, `ZONE_HEIGHT_THRESHOLDS` writes 3.5 and 1.5 out by hand.

`STRIKE_ZONE` is exported from the same module the file already imports, on the
same line, so closing this is an import change and two field reads. It is the
only one of the six remaining copies where the module is already in scope and the
file already argues in its own comment for doing it. Not done in Task 4 because
that task had no reason to open the file.

## 3. The strike-zone copy census, hand-enumerated

Task 4 removed one copy: `src/swingGenerator.js` now reads `STRIKE_ZONE` from
`src/sessionStats.js` instead of writing the zone out as its own literals. Every
remaining site was then opened by hand rather than counted from memory.

**The definition:** `src/sessionStats.js:13`.

**Four copies in shipped code:**

- `src/DebriefScreen.jsx:810`, the drawn zone rectangle on the pitch location
  chart.
- `src/DebriefScreen.jsx:862-863`, `ZoneBreakdown`'s in-zone predicate.
- `src/DebriefScreen.jsx:1477-1478`, the raw data table's in-zone predicate.
- `src/coachApi.js:590`, the zone written into the prompt's prose.

**Two more in tooling:**

- `scripts/handedCounts.js:57-58`, per item 2 above.
- `scripts/bench-coach-brevity.mjs:326`.

**So: four in shipped code, six counting tooling, seven sites including the
definition.** Say which is meant when quoting the number.

**The census deliberately EXCLUDES the frozen snapshots**, meaning
`docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs` and
`docs/eval-fixtures/slice7-debriefs/rebuild.mjs`. Excluding them is correct
rather than convenient: they are frozen copies on purpose, they exist precisely
so they cannot follow a change in `src/`, and counting them as drift risk would
argue for the one edit their own headers forbid. Anybody quoting the census
should say the same, because a future reader who greps for the bounds will find
them there and wonder why they are not on the list.

**CLAUDE.md's own line saying the strike-zone bounds are "still written out six
times" predates this census and is not reconciled here.** It was already an
undercount before Task 4, since the generator held a copy too. Reconciling it is
a slice-close job for Task 15, not a Task 4 edit.

## 4. A density spike on the zone edge, for the browser gate

The floor under a miss is 0.05 feet, which is what stops the generator throwing
a ball that grazes the zone. It also means a missed pitch can never land inside
that floor, so the pitch location chart now has a visible line of dots one
twentieth of a foot outside the drawn rectangle, and a hard dead band between
the two.

The size of it comes off the formula rather than a sample: a miss rounds to the
nearest bin when it is under 0.055 feet, which is `sqrt(0.005 / 0.75)` of draws,
about 8.16 percent. So roughly one low miss in twelve sits on exactly 1.45 feet
and one high miss in twelve on exactly 3.55, while a wide miss splits between two
sides and puts about 4.08 percent on each of 0.75 and -0.75. Not one pitch
anywhere lands strictly between 1.45 and 1.50 feet, between 3.50 and 3.55, or
between 0.70 and 0.75 sideways.

**This is not the launch angle clamp in a second costume**, and the difference
decides whether it is a defect. A clamp piles values onto one extreme and nothing
exists beyond it; here the values fan out smoothly from the edge and the spike is
merely the nearest bin. Task 4 judged it acceptable and named it in
`src/swingGenerator.js` rather than tuning it away.

**What Task 14 should actually look at**: whether that line of dots reads as a
thrower missing just off the plate, or as a rendering artifact hugging the edge
of the zone rectangle. It is one twentieth of a foot outside a dashed border on a
chart every visitor sees, so the question is a visual one and no measurement can
answer it. If it reads badly, the fix is a smaller floor or a small jitter on it,
not a different miss distribution.

## 5. One thing Experiment A did not prove, so nobody cites it as though it did

Task 4 discharged the obligation inherited from Task 1 by repointing
`loadPreSlice11Generator` in `scripts/grade-coach-accuracy.mjs` at the live
generator and watching the frozen guard go red, 15 failed against 16 passed, then
restoring it and watching it go green at 31 of 31.

**That proves the guard bites for the loader route only.** Of the nine data tests
that stayed green, six are the `power-s1` and `contact-s1` cells across all three
digest groups, which do reach the repointed loader but contain no generated swing
at all, because `buildSessionsFromBaseline` seeds session 1 from the baseline
verbatim and only enters its generation loop at session 2. Those are benign. The
other three are the `slice7-debriefs` cells, which reach the frozen snapshot
through `docs/eval-fixtures/slice7-debriefs/rebuild.mjs` and not through the
loader that was repointed. **That binding has never been demonstrated to bite.**
Proving it needs its own experiment against that file's own loader. Cheap, and
worth doing the next time anything opens that directory.

## 6. Task 9 cannot reach a 6 mph zone gap by moving the pitch weight, and the arithmetic says so before it spends a run

Task 5 shipped the strike-versus-ball gap at **+3.40 mph pooled** across sessions
2 to 4, inside the 3 to 8 band it was given and short of the roughly 6 mph Task 9
is aiming at. The obvious next move is to raise `PITCH_QUALITY_WEIGHT`, and that
move cannot get there.

The pitch reaches exit velocity through two multiplications, not one. It is
weighted into the shared contact quality by `PITCH_QUALITY_WEIGHT`, and the
shared quality is then weighted into exit velocity by `CONTACT_CORRELATION`,
which is 0.6. So the whole term arrives at about six tenths of its size. Measured
by sweeping the weight through a standalone prototype of the same structure at
4,000 sessions per goal per session number: 0.6 gives 2.55 mph, 0.7 gives 2.97,
0.8 gives 3.39, 0.9 gives 3.82, and **1.0 gives 4.24**, which is the ceiling. A
weight of 1.0 means the pitch IS the contact quality and the hitter's own quality
draw counts for nothing, which is not a state anybody wants, and it still lands
under 4.3.

~~**So reaching 6 mph is a decision about a different constant.** Two candidates,
and one is already wanted for its own reasons:~~

- ~~**`EV_SPREAD_MPH`, today 16.** The gap scales with it directly, so 22 would put
  today's structure at roughly 4.7 mph without touching the pitch weight at all.
  Section 9 of the measurement report separately says the generated hitter is
  **30% tighter** than the hand-written session he is derived from, "which nobody
  chose", so widening this is on the table regardless of the zone gap. That makes
  it the cheaper of the two: one change, two targets.~~
- ~~**`CONTACT_CORRELATION`, today 0.6.** Raising it lifts the gap proportionally
  and also tightens how much exit velocity and launch angle agree with each
  other, which is a settled product decision with its own recorded reasoning.
  Do not move it as a side effect of chasing this number.~~

~~The third possibility, and it deserves saying so nobody re-derives it: the target
itself may be too high. The 8.78 mph gap the target is anchored to is session 1's,
and session 1 is fifteen hand-written swings chosen to read legibly, not a sample
anybody fitted a rate to. Six may simply be more than a believable generator
should produce.~~

**Struck rather than deleted, 21 August 2026.** The correction below originally
removed those twenty lines outright, which is not how this project keeps a
record, and it was inconsistent inside its own commit: section 7 of this document
used a strikethrough plus a dated note in the same change. Restored so the wrong
recommendation stays legible next to what replaced it, because the wrong one is
what a reader would otherwise reinvent.

**Dated correction and completion, 21 August 2026, from the review of this
task.** Two things above needed fixing and the second one changes the answer.

First, the caveat this section originally carried, that the sweep came from a
standalone prototype rather than the shipped generator, is **retired**. The two
were checked against each other and the prototype's numbers reproduce through the
shipped generator to within a hundredth. Quote them freely.

Second, and this is the substance: the entry went on to name widening
`EV_SPREAD_MPH` as the cheaper lever, and **widening does not get to 6 either.**
That was assumed rather than measured. It has now been measured, through the
shipped generator with one constant changed at a time, 1,800,000 swings a row:

| exit velocity spread | pitch weight | contact correlation | pooled gap |
| --- | --- | --- | --- |
| 16 (shipped) | 0.8 (shipped) | 0.6 (shipped) | **3.40 mph** |
| 21.88 | 0.8 | 0.6 | 4.61 mph |
| 21.88 | 1.0 | 0.6 | 5.77 mph |
| 28.0 | 0.8 | 0.6 | 5.74 mph |
| 21.88 | 0.8 | 0.81 | **6.20 mph** |

21.88 is not arbitrary: it is what `EV_SPREAD_MPH` has to become for a generated
session's own within-session exit velocity spread to match session 1's, which is
6.322 mph against the generator's 4.623 on the same convention. That is the
widening section 9 of the report already wants for its own reasons. **After it,
the gap is 4.61, and even taking the pitch weight to a value that cannot exist
leaves it at 5.77.** Widening a third further than the hand-written session,
to 28, still reads 5.74.

The only combination measured to clear 6 is the widening plus
`CONTACT_CORRELATION` at 0.81, and that constant is a settled product decision
about how much exit velocity and launch angle agree with each other. Moving it to
hit a zone-gap number is moving a product decision as a side effect, which this
document already says not to do.

**So the finding is the one that was written as a footnote, and it should have
been the headline: the 6 mph target is too high.** *(Decided, 21 August 2026: the
product manager adopted about 4.5 mph on this evidence. The front settled block
at the top of this document carries the amendment, and that is the authoritative
line; what follows here is the reasoning behind it.)* It is anchored
to session 1's 8.78, and session 1 is fifteen hand-written swings chosen to read
legibly, not a sample anybody fitted a rate to. Every lever that reaches 6 costs
something the slice has already said it does not want to spend. Task 9 should
either adopt a lower target, somewhere near the 4.6 that falls out of the
widening it wants anyway, or take the decision to move `CONTACT_CORRELATION`
deliberately and on its own merits rather than as a means to this end. *(The
first of those two was chosen. `CONTACT_CORRELATION` stays where it is.)*

**One piece of honest framing about "full weight", because the word flatters
it.** Everywhere in this document and in Task 5's tests, "full weight" means
`PITCH_QUALITY_WEIGHT` at 1.0 and `PITCH_HEIGHT_WEIGHT` left where it is. That
is load-bearing rather than pedantry: read as BOTH weights at 1.0 it means a
different generator, and the spread assertion in `swingGenerator.test.js` fails
about a fifth of the time under that reading. Nobody should have to guess which
was meant. At `PITCH_QUALITY_WEIGHT` of 1.0 the accident share is exactly zero:
hitter's own contact quality draw does nothing whatsoever and the shared quality
IS the pitch. Even at 0.9 the hitter's own draw carries only 19% of that term. So
the rows above at weight 1.0 are not a setting anybody would ship; they are there
to show that even an absurd setting does not reach the target.

## 7. Both empty-band guards moved slightly, in the direction the task predicted, and Task 9 owns whether that is paid back

Measured at seed 20260821, 20,000 sessions per goal per session number, before
and after Task 5:

| goal | S2 | S3 | S4 |
| --- | --- | --- | --- |
| Power & Distance, before | 13.9% | 12.1% | 11.1% |
| Power & Distance, after | 14.5% | 11.8% | 10.8% |
| Line Drives & Contact, before | 2.8% | 3.5% | 3.5% |
| Line Drives & Contact, after | 3.0% | 3.8% | 4.0% |

**Power is a wash and Contact is a small real cost.** Power gains six tenths of a
point on session 2 and gives back three tenths on each of the other two, ~~which is
noise at this sample size rather than a direction.~~

**Corrected 21 August 2026, same day, by review, and the correction is small but
it is the kind this document exists to catch.** Power's session 2 rise is not
noise, it is a direction: across eight seeds at 20,000 sessions a cell it is
+0.32 with all eight positive, against -0.12 at session 3 with mixed signs and
-0.31 at session 4 with all eight negative. So "Power is a wash" survives as a
NET statement, which is how it should be read, but the reason given for it was
wrong. Contact's rise was confirmed the same way, +0.31 / +0.42 / +0.47 with all
eight seeds positive on all three, which is what the paragraph below already
says and now has behind it. Contact rises on all three,
by two, three and five tenths, and the rise is a mechanism rather than sampling:
improving the contact quality on a good pitch pushes launch angle up through that
goal's 18 degree ceiling, which is the same interaction the empty-band re-roll
was written for every goal to catch. It is caught, and the residual is what the
re-roll does not reach.

**Recorded rather than tuned away**, because Contact's ceiling is one of the
numbers Task 9 sets and pulling on it here would be tuning against one target in
a task whose whole point was structure. The number to hold it against is the one
this slice inherited, roughly 2.8 / 3.1 / 3.6 across eight independent seeds.
Nothing here is near a level a visitor would notice; what would be worth noticing
is the same shift happening again in Task 6 and Task 7 and nobody adding them up.

## 8. Launch angle is not monotone in pitch height, and it inverts against session 1. Task 6 needs to read this before it goes looking for pop-ups

Task 5 gives a high pitch a higher launch angle **at equal distance from the
heart of the zone**, and that claim is exactly true and has its own test. Across
the population it is not what ships, because a second effect runs the other way
and wins at the edges.

Measured through the shipped generator, 1,800,000 generated swings across five
goals and three session numbers, against the fifteen hand-written swings of
session 1 on the same bands:

| band | generated launch angle | n | session 1 | n |
| --- | --- | --- | --- | --- |
| below the zone | 13.04 | 250,251 | 11.33 | 3 |
| low third | 17.56 | 452,594 | 15.00 | 1 |
| middle third | 21.13 | 457,154 | 17.83 | 6 |
| high third | 20.69 | 451,876 | 20.33 | 3 |
| above the zone | 19.20 | 188,125 | 21.50 | 2 |

**Session 1 rises across all five bands. The generator rises to the middle and
then falls.** A ball chased above the strike zone comes out about two degrees
FLATTER than a strike down the middle, where the hand-written session this demo
is calibrated against says it should be the steepest thing on the chart.

The generator's own comment cites session 1's data as the authority for the
height effect, so this is an inversion against its stated source, not merely an
imperfection.

**It is structural, not a tuning slip, and Task 9 cannot fix it by moving a
weight.** Two effects reach launch angle from the pitch. The symmetric distance
penalty arrives through the shared contact quality at `CONTACT_CORRELATION`
times `PITCH_QUALITY_WEIGHT`, which is 0.48. The directional height term arrives
through the independent half at `INDEPENDENT_SHARE` times
`PITCH_HEIGHT_WEIGHT`, which is 0.32. A pitch above the zone is both high and
far out, so it collects a large positive from the second and a larger negative
from the first. Making the top of the zone beat the middle needs a height weight
near 1.14, which does not exist, and still near 1.0 even if the quality weight
were dropped to 0.7.

**Recorded, deliberately not fixed.** Fixing it means a structure where the two
terms do not both flow into launch angle at fixed relative strength, which is a
larger change than Task 5's lane and would want its own reasoning.

**Why Task 6 in particular.** Task 6's whole job is producing pop-ups, and a
pop-up is what happens when a hitter gets under a high pitch. Today the
generator's highest pitches produce among its FLATTEST swings, so raising the
launch angle clamp will produce pop-ups drawn from everywhere except the pitches
that should cause them, and the coach will be handed a pop-up count with no
relationship to the pitch location it sits beside. Whoever takes Task 6 should
decide whether that matters for what the coach says, before tuning a clamp.
