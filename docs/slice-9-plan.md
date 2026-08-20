# Slice 9: rewrite session 1's fifteen swings

Written 19 August 2026, before any code. Branch `slice-9-session-one-rewrite`,
cut from main at 411107e.

**Test suite baseline: 506 tests across 22 files, all green**, measured on the
branch before any change. Cross-checked against the finishing number CLAUDE.md
records for Slice 8d, which is the same 506 across 22. No pre-existing failures
to carry. (Recorded here rather than in the decision log because the slice
document is what gets committed at slice start; the decision log entry is
written at slice close and will repeat the before and after numbers.)

---

## The front section

**What this is, in one line.** The fifteen hand-written swings every visitor
sees on their first screen are drawn with a ruler, and that single artifact is
also what makes one goal's target zone unreachable and another goal miss its
own stated bar.

### Settled before work started. Do not relitigate.

1. **Hold session 1's two averages exactly**, sum 1224 and sum 260, so the
   generated sessions stay bit-for-bit identical.
2. **On-target counts: Power 2, Contact 2, Pop-Ups 11.** Derived from the app's
   own 65/35 rule, not picked. See finding 2.
3. **Hit to All Fields: 3 pull, 4 oppo.** Clears its own stated bar for the
   first time. See finding 1.
4. **Scatter: correlation about 0.36**, the generator's own median.
5. **Strike zone mix unchanged at 9 in, 6 out.**

### Not in this slice, and where each belongs

- **Retuning the improvement model.** Belongs nowhere: investigated this slice
  and found correct. Output is a paragraph in the decision record so nobody
  "fixes" it. See finding 7.
- **Linking pitch location to contact quality, and flipping the backwards
  pull/oppo bias.** A queued generator-realism slice. Out because it changes
  sessions 2 to 4, invalidating the paid-for before measurement. See finding 4.
- **Making Reduce Pop-Ups failable.** Same generator slice. The goal itself
  stays exactly as it is. See finding 5.
- **Goal targets, prompts, charts, screens.** Untouched.

### How this will be verified, written before any code

Deterministic tests for every invariant, each seen failing first, including a
pinned-seed regression proving sessions 2 to 4 do not move. Then live coach
measurement: an already-paid before side, two independent after rounds, a
grader-noise floor, and every flagged claim hand-checked. About $3.48, with $5
as a reporting threshold rather than a ceiling. Detail in Tasks 1 and 7.

### The debt this slice is expected to open

Session 1 will predict contact quality from pitch location and the generated
sessions still will not, so sessions 1 and 2 differ in a way a careful reader
could notice. Accepted knowingly: better on one screen than none, and the
queued generator slice closes it.

---

## The findings this slice produced that are not fixes

All seven are measurements taken while scoping, and all seven go into the
decision record whether or not anything is ever done about them. Several were recorded
nowhere in this repository before today.

### 1. Hit to All Fields has never met its own stated bar

The goal's coaching prose asks for "at least 3 swings pull side (direction
below -15 degrees), at least 3 swings opposite field (direction above +15
degrees)." Session 1 delivers **2 and 2**. Found 19 August 2026 and recorded
nowhere in the repo until this document. This slice fixes it as a side effect
of the rewrite, but the finding is that nothing was checking it.

### 2. Session 1's on-target counts were miscalibrated against the app's own
65/35 rule, in both directions

The generator gives a session a 65 percent chance of trending better than
session 1 and a 35 percent chance of trending worse. Measured over 6,000
replays per cell, average exit velocity comes in below session 1's exactly
**35 percent** of the time, so the rule works as designed on the number it was
written for. It was never applied to the on-target counts:

| | session 1 | how often a later session looks worse |
|---|---|---|
| avg exit velocity (control) | 82 mph | 35 percent |
| Power | 3 on target | 78 / 70 / 63 percent (s2 / s3 / s4) |
| Contact | 0 on target | 0 percent |
| Pop-Ups | 9 on target | 5 / 3 / 1 percent |
| pull / oppo | 2 / 2 | 13 percent / 3 percent |

A visitor who picks Power and clicks through all four sessions watches the
target band get emptier roughly 7 times out of 10. That is the opposite of what
the demo is for, and it was invisible because nobody had ever measured a count
against the split.

### 3. There is no control group, and the premise that there was one is false

This slice was scoped believing that holding session 1's averages would leave
five of the eval bench's six cells on identical data. It does not.
`buildDebriefUserMessage` in `src/coachApi.js` prints **every prior session's
individual swings in full** into the prompt, so a session-4 debrief carries
session 1's fifteen swings verbatim plus session 1's goal count lines.

Proven, not reasoned about: changing two session-1 swings while holding both
sums at 1224 and 260 leaves generated sessions 2, 3 and 4 bit-for-bit identical
and still changes the session-4 prompt on two lines, one of them a goal count
line. Every one of the six bench cells changes. The verification design in this
document is built around having no control group, which is why it buys a
grader-noise floor and a second independent after round instead.

### 4. The generator has no link at all between pitch location and contact
quality, and session 1 does

Session 1's in-zone swings average **85.1 mph** against **76.3 mph** out of
zone, an 8.8 mph gap. Whoever hand-wrote those fifteen swings put the weak
contact on the bad pitches deliberately. The generator's gap, measured across
4,000 sessions, is **0.0 mph**, because `inZonePitch` is drawn from its own
`random()` with no connection to the swing's outcome.

This matters beyond realism. Since Slice 8c the coach is handed which swings
were on pitches outside the zone and it reasons about them out loud. On
sessions 2 to 4 any conclusion it draws linking pitch location to contact
quality is a coincidence. Preserving session 1's gap is a requirement of this
slice; fixing the generator is the queued follow-up.

### 5. Reduce Pop-Ups names a failure that cannot occur

The goal defines a pop-up as a launch angle above 35 degrees
(`GOAL_COUNT_SPECS.popup.popUpAngle`). The generator clamps launch angle at
exactly 35 (`Math.min(35, ...)` in `src/swingGenerator.js`). Measured across
**360,000 generated swings, the number of pop-ups was 0**, and the highest
launch angle the app can produce is 35.

So the coach is handed "swings that were pop-ups (above 35 degrees): 0 swings"
on every session of every goal, forever. It is a fact that can never read
anything else. The goal is not wrong; the hitter is incapable of the thing the
goal is named after. Decided 19 August 2026 to leave the goal exactly as it is
and to queue the generator change instead. Explicitly rejected: adding an exit
velocity requirement to Pop-Ups, because 10 to 25 degrees at 85+ mph overlaps
Line Drives & Contact's 8 to 18 at 85+ across most of Contact's band, producing
two goals that are one goal with two names.

Coupling for whoever picks that up: raising the launch angle ceiling pushes
balls into a part of `carryDistance` that has never been exercised, since its
shape term floors at 55 percent above 28 degrees. A 60 degree pop-up would
currently be credited with a respectable fly-ball distance. Re-check, do not
assume.

### 6. The four-session improvement arc does not exist, and that is correct

Every session is generated from session 1, never from the session before it
(`baselineSwings: mockSwings` at `src/App.jsx:1002`), so sessions 2, 3 and 4
are three independent draws around the same centre rather than a rising line.
Measured across 20,000 replays, mean average exit velocity reads **82.94 at
session 2, 82.99 at session 3, 82.98 at session 4**. Flat.

This was investigated as a suspected defect and is not one. Four rounds of
batting practice is about a week, and a real hitter does not gain measurable
exit velocity in a week. What does change in a week is swing shape, and swing
shape is the one thing that genuinely ramps here, climbing 17 to 20 to 23 to 24
degrees across the four sessions on the Power goal. The model already says the
true thing: the coachable number improves, the physical one does not.

The product manager's two stated goals for it both hold. "They will not always
improve": session 3 comes in below session 2 **43 percent** of the time.
"Ideally session 4 is a little better than session 1": true **73 to 81 percent**
of the time depending on goal.

Recorded because the risk is a future session reading "exit velocity never
improves," calling it a bug, and fixing it into something unrealistic. It is
not a bug. Do not fix it.

### 7. `CONTACT_CORRELATION` does not hold a correlation

The constant is named `CONTACT_CORRELATION` and set to `0.6`, but it is a
loading applied to both readings, so the correlation it actually produces is
0.6 squared, or **0.36**, confirmed by measurement across generated sessions
(median 0.36, p10 0.04, p90 0.63). Anyone retuning it toward "0.5 correlation"
would get 0.25. Worth one comment line in the file; not fixed here because this
slice does not touch the generator.

---

## Task by task

### Task 1: write the invariant tests, and see each one red

New file `src/sessionOneSwings.test.js` additions, or a sibling if the existing
file is cleaner left alone. Every test below is written before the data
changes. Three of them fail naturally against today's data. Four of them pass
against today's data, which makes them worthless until broken on purpose, so
each of those four names the exact mutation used to see it red and that
mutation is performed and reported.

**Fail naturally against today's data:**

1. **On-target counts.** Power 2, Contact 2, Pop-Ups 11 via `meetsTarget`;
   3 pull and 4 oppo via the direction cutoffs in `GOAL_COUNT_SPECS.allfields`.
   Today reads 3 / 0 / 9 / 2 / 2, so this is red on five assertions.
2. **Correlation band.** Assert the exit-velocity-to-launch-angle correlation
   sits between 0.20 and 0.55. Today reads 0.975.
3. **No arithmetic progression.** Sort each of exit velocity and launch angle,
   take consecutive gaps, and fail if the distinct-gap count is 2 or fewer
   across all fifteen. Today's launch angles step by exactly 2 for eleven
   consecutive values, so this is red.

**Pass against today's data, so each must be seen red by deliberate mutation:**

4. **Both averages held exactly.** Sum of exit velocities is 1224 and sum of
   launch angles is 260. This is the invariant the entire slice rests on.
   Mutation to prove it bites: change one swing's exit velocity by 1 and
   confirm red.
5. **Every distance recomputed through `carryDistance`.** A pin already exists
   for this from Slice 7b; confirm it still covers all fifteen and see it red
   by reintroducing a wrong distance, the way Slice 7b did with 999.
6. **Strike zone count is 9 of 15.** Mutation: move one pitch inside the zone.
7. **The in-zone advantage survives.** Mean exit velocity on in-zone pitches
   minus mean on out-of-zone pitches is at least 5 mph. Today it is 8.8.
   Mutation: swap a hard in-zone swing with a soft out-of-zone one.

**Also in this task, a regression pin that is the point of the whole Option A
decision:**

8. **Sessions 2, 3 and 4 come out bit-for-bit identical.** Generate all three
   at a pinned seed through an injected random source and compare against a
   stored snapshot taken from today's code before the data changes. Mutation to
   prove it bites: shift session 1's average exit velocity by 1 mph and confirm
   red. Without this pin, the single most important promise of this slice, that
   nothing downstream moves, rests on an argument rather than a test.

### Task 2: capture the "before" for the Contact session 1 cell, before touching data

The bench has six cells and none of them is Contact on session 1, which is the
exact screen this slice most changes (0 on target today, 2 after). Measuring it
requires a before, and a before can only be captured while the old data is
still in place. **This task runs before Task 4 and cannot be reordered.**

1. Add a `contact-s1` cell to `CELLS` in `scripts/bench-coach-brevity.mjs`,
   weight matched to the existing session-1 cell so it gets a comparable number
   of runs. Note the bench's hand-copied goal-label comment already carries six
   entries and will need a seventh; that duplication is disclosed in CLAUDE.md
   and is not being fixed here.
2. Run the cell against today's session 1 at seed 20260814, output to
   `docs/eval-fixtures/slice9-session-one/contact-s1-before/`.
3. Confirm the output directory was created and the file written before
   celebrating. A paid round was lost to a missing directory on 18 August 2026;
   the bench now creates its own output directory, and this step verifies that
   fix actually holds rather than trusting it.

Expected spend: about $0.15.

### Task 3: build the candidate data

A search under the settled constraints, then hand-tuning for believability. The
search is deterministic given a seed and lives in a script under `scripts/` so
the result is reproducible rather than a set of numbers that appeared once.

Hard constraints, all from the settled list:

- Sum of exit velocities exactly 1224, sum of launch angles exactly 260.
- Power 2, Contact 2, Pop-Ups 11 on target; 3 pull, 4 oppo.
- Correlation between 0.30 and 0.42, aiming at 0.36.
- No arithmetic progression in either variable.
- Exit velocity within 65 to 97 and launch angle within -5 to 35, the same
  clamps the generator obeys, so session 1 cannot contain a swing the rest of
  the app could never produce.
- Top exit velocity stays 92, so the third tile on that screen does not move.
  Recorded as an assumption rather than something the product manager ruled on.
- 9 pitches in the strike zone, 6 outside.
- In-zone mean exit velocity at least 5 mph above out-of-zone mean.

Then hand-tuning, because raw search output is valid but not believable. The
candidates produced while scoping included a 66 mph swing and a swing at -1
degrees, which are inside the clamps and still read as noise rather than as a
hitter. The judgment to apply: no more than one or two genuinely weak swings,
duplicate values are welcome, and gaps should be uneven.

**A note on what the search cannot check.** It can hit every number above and
still produce fifteen swings that look wrong to someone who has watched batting
practice. The rendered scatter chart is the check for that, in Task 6, and it
is the reason Task 6 is a gate rather than a formality.

### Task 4: replace the data

Rewrite `src/sessionOneSwings.js` with the chosen fifteen swings. Every
`distance` field computed by calling `carryDistance` rather than typed by hand.
Update the module's own header comment: the known-open-item paragraph about the
straight line is now closed and should say so with a date, and the new
paragraph should say what the fifteen swings are calibrated to and why the two
sums must not be touched, since that is the invariant every downstream session
depends on.

Run the full suite. All eight tests from Task 1 go green. The 506 existing
tests stay green, and any that do not are investigated rather than adjusted:
two copies of session 1's distances live in `src/ballFlight.test.js` and
`src/coachApi.test.js` as literal expected values, and both will need updating,
which is expected and is not the same as a test being wrong.

### Task 5: pin the prompt the coach actually receives

Before spending anything on live calls, build the debrief user message for a
Contact session-1 debrief and read it. Confirm the count lines say what the new
data says: 2 in the target band, the fly-ball count, the zone counts, and the
distance distribution. This is free, it catches a whole class of error the
bench would otherwise spend real money discovering, and it is the same check
that found the dangling "numbers:" defect during Slice 8c's browser pass.

### Task 6: look at it in a browser, on both goals

The suite covers no screens and no rendering, so a green suite says nothing
about what a visitor sees. Load the running app and open the first debrief on
**both** Power and Line Drives & Contact, because Contact's empty target band
is half the reason this slice exists and Power is the goal whose regression
this slice fixes.

What to check: the Launch Angle vs Exit Velocity scatter no longer reads as a
diagonal line; the Contact target band has two swings in it; the Power band has
two; the spray chart shows pull and oppo swings on both sides; the Pitch
Location chart still shows six pitches outside the zone; the three stat tiles
read 82 mph, 17 degrees and 92 mph exactly as before.

This is a gate. If the scatter still looks mechanical to the eye, the data goes
back to Task 3 regardless of what the correlation number says.

### Task 7: the live measurement

The design, and what each piece is actually for. Written out because with no
control group, what each number can and cannot support is the whole question.

**The before side already exists and is paid for.**
`docs/eval-fixtures/slice8c-strike-zone-counts/after/` is 52 debriefs generated
under the current prompt era at seed 20260814, and
`docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.json` grades them
through the fully fixed tool. Plus the Contact session-1 before from Task 2.

**Piece 1, the grader-noise floor.** Re-grade the existing before-round
debriefs once more, same tool, same seed, changing nothing. The grader
re-extracts live on every run, so two gradings of identical text will not
agree. This measures by how much. Any before-versus-after difference smaller
than this floor is not a signal, and saying so is the difference between a
measured claim and a number. About $0.32.

**Piece 2, after round A.** The same 52 cells plus `contact-s1`, at the same
seed 20260814, so the generated sessions 2 to 4 are the identical draws the
before round used and the only thing that moved is session 1. About $1.11 for
the calls plus about $0.37 to grade.

**Piece 3, after round B, at a different seed.** A second full after round on a
fresh seed. To be precise about what this measures, since it is easy to
overclaim: a different seed changes the generated sessions 2 to 4 as well as
the model's sampling, so this is not a pure coach-writing noise measure. It
answers a broader and more useful question, which is whether the rewritten
session 1 holds up against downstream sessions it has never been seen with.
About $1.11 plus about $0.37 to grade.

**Piece 4, hand-check every flagged claim in every round.** Slice 8d measured
this tool's false-positive rate at 11 percent in one round and 42 percent in
another, so a raw flag count is not a coach error count. The same discipline
Slices 8c and 8d used applies here: every flagged claim read by hand and judged
genuine or false positive, with the quotes recorded.

**Budget.** About $3.48 all in. Corrected 19 August 2026, at the execution go:
$5 is a **reporting threshold, not a ceiling**. The product manager's words
were "my ceiling isn't at $5, I just want to know when we're getting close to
$5, I'm happy to spend more if needed." So the rule for this slice is to
report as the projection approaches $5 and keep going, not to stop. Stopping a
measurement mid-round would waste what was already spent and leave the slice
unverifiable, which is the outcome the budget conversation exists to prevent.
Every dollar still gets reported in the decision record and the PR.

**What counts as "the coach did not get worse."** Three bars, and all three
have to hold:

1. **Zero parse failures**, matching the current round. This is the hard gate.
   Slice 7b found session 1 pushing the coach past its output ceiling and
   failing to parse on 14 of 36 calls, and a rewritten session 1 could
   reintroduce it. This one is not a judgment call.
2. **Hand-checked genuine errors not materially worse**, pooled across rounds,
   where "materially" means larger than the grader-noise floor from Piece 1.
3. **No new error class about session 1 specifically.** The pooled rate can
   hide the thing this slice is most likely to break, which is the coach
   describing the new fifteen swings wrongly, or comparing a later session
   against session 1 wrongly. Session-1 claims get read separately, not just
   counted in the pool.

**What this measurement cannot conclude, stated in advance.** With every cell
changed and no control group, a small movement in overall accuracy cannot be
attributed to this slice with confidence. The design buys a noise floor and a
second seed precisely so the size of "small" is measured rather than assumed,
but it does not turn this into a controlled experiment and the write-up will
not claim it does.

### Task 8: records

1. Decision record entry in `docs/product-decisions-log.md`, in product
   language: what was decided, the seven findings above, the test numbers before
   and after, and the measured spend.
2. `CLAUDE.md` current-state section updated: line counts, the closed What's
   Next items (session 1's straight line, and the Hit to All Fields shortfall),
   and the new queued items (the generator-realism slice carrying the pitch
   location link, the pull/oppo flip and the pop-up ceiling).
3. A README beside the fixtures under `docs/eval-fixtures/slice9-session-one/`
   covering what is and is not safe to conclude from them, matching the
   convention the other six fixture directories follow.
4. The pre-deploy checklist gets nothing: this slice creates no deploy-time
   obligation, no environment variable and no migration.

### Task 9: independent code review, then the pull request

Read-only reviewer, treating the implementer's report as unverified claims.
Then a pull request with the review report in it, the test numbers before and
after, and the manual QA script proposed in the chat message rather than in the
PR body.
