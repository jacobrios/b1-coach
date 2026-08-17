# Slice 7b: the coach says a little more, and the chat gets easier to read

Written 17 August 2026. Branch `slice-7b-coach-clarity`.

Slice 7 cut the coach's output and grew the type. The product manager's QA pass
on it produced this slice: one section came out too short to look finished, the
chat type is still a notch small, and the screen where he caught the coach
stating something false is the one screen the eval bench cannot reach.

---

## Settled before work started. Do not relitigate.

- **The "What This Means" floor is three sentences, 35 to 40 words, no sentence
  over 18 words, and the third sentence must add something the first two did
  not.** A ceiling raise would not help; the coach writes ~20 words against a
  30-word ceiling, so it is not pressing against anything.
- **The exact prompt wording was approved by the product manager on 17 August
  2026** before any code ran, including the decision to fix the base prompt's
  contradictory "1-2 sentences" in the same change, because a ceiling raise with
  that contradiction left in place may simply not take.
- **The chat panel goes to 17px, not 18.** Bigger type in a fixed-width column
  grows on two axes at once: 16 to 18 makes the opening tips block ~30% taller,
  16 to 17 makes it ~15% taller. Holding the block steady at 18px would mean
  trimming tips from 50 words to ~37, and tips are where citation quality lives.
  This project already spent 8 percentage points of that in Slice 7.
- **`coachingSummary` (45 words) and the tip budget (50 words) are untouched.**
- **The bench feeds on the real session 1 everywhere, not the stand-in.** Decided
  17 August 2026. Sessions 2 to 4 are generated *from* session 1, so a fake
  starting point meant all three of Slice 7's measured cells were sessions no
  visitor ever sees. Consequence accepted knowingly: Slice 7's recorded bench
  figures (8.5 to 6.13 grounded, 62-word median) stop being comparable, and this
  slice's own before-run becomes the reference instead.
- **The fifteen session-1 distances get a test that recomputes them.** Decided
  17 August 2026, to close the What's Next item where a reviewer changed 170 feet
  to 999 feet and all 337 tests stayed green.

## Not in this slice

- **Chart panel height.** Stays 340px. The product manager is happy with the
  charts and does not want to open an endless loop there. Belongs to a future
  chart design pass, if one is ever scheduled.
- **Summary box sizing, content-sized or dynamic layout.** Too much complexity
  for what it buys. Belongs with the chart design pass above.
- **The tip budget.** Belongs to a future revisit of the Slice 7 citation trade,
  and only with bench evidence.
- **Everything in Slice 6b** (browser tab icon, scaffolding files, the lint wall,
  the README, the Pop-Ups card). Belongs to Slice 6b, still scoped in
  `docs/queued-slices.md`.
- **The coach fidelity slice** beyond the measurement this slice builds. Its four
  items belong to that slice, unnumbered, scoped in `docs/queued-slices.md`.
- **Session 1's straight-line swings.** Sorted by exit velocity, its launch
  angles climb in near-lockstep. This slice extracts those swings and does not
  rewrite them. Belongs to the session-1 rewrite, which this extraction unblocks.
- **The negative space in the summary box on a large window.** Named by the
  product manager as fine and pre-existing. The complaint being fixed is that
  one section reads as a stub, not that the box is unfilled.

## How this will be verified, written before any code

The bench is the evidence for anything about the coach's behaviour. The test
suite must still never call the model, and the bench and grader must stay
outside the test runner's collection, proven by file count rather than asserted.

1. **Baseline confirmed before any code: 337 passing across 12 files.** Done
   17 August 2026, cross-checked against Slice 7's finishing number.
2. **The extraction changes no recorded measurement.** Both scripts under
   `scripts/` are run before and after and their output diffed. Identical output
   is the pass condition; any difference stops the slice and goes to the product
   manager.
3. **The distance pin is seen failing first**, by mutating one of the fifteen
   distances, before it is trusted.
4. **The grader is validated against the committed fixture before it is used
   for anything.** Recall against the 8 known-wrong debriefs is the hard test.
   Flags outside those 8 are adjudicated by hand, not counted as false
   positives, because the fixture's other 88 are "no verified error found," not
   "proven clean." Hit rate and flag rate both reported to the product manager.
5. **The grader's arithmetic half gets unit tests.** The fact sheet it computes
   is deterministic, so it is testable without the model, and it is the half the
   verdicts rest on.
6. **Before and after bench runs on the same four cells**, 12 runs on session 1
   and 8 on each of the other three. Reported: whether `whatThisMeans` lands in
   35 to 40 words, whether grounded citations hold rather than fall, whether the
   box still fits against its 106-word capacity, and the claim-error rate before
   versus after.
7. **Wording overlap between `whatThisMeans` and `coachingSummary` is measured
   deterministically** on every debrief, before and after, because a floor
   invites padding by restatement.
8. **A browser pass on anything that changes the screen**, not a code reading.

**The honest limit on point 6, stated before the numbers exist.** At roughly one
error in twelve, 36 debriefs per condition means expecting about three errors
each. That can catch a gross regression, roughly a doubling. It cannot resolve a
subtle rise, and if the after-number lands close the correct report is "this did
not move enough to call," not a verdict.

## Debt this slice is expected to open

- **The grader is validated for recall and only softly for precision**, for the
  reason in point 4. Anyone reading its output later needs that caveat.
- **The claim-accuracy comparison will be underpowered**, per the limit above.
- **A third hand-run script** joins the two under `scripts/`, each with its own
  spend profile and none reachable by the test suite.
- **The chat panel at 17px narrows the summary-to-chat type gap to 1px**, where
  Slice 7 deliberately preserved 2px. Flagged to the product manager; the browser
  pass is what settles whether it reads worse.
- **`rebuild.mjs` in the committed fixture now deliberately disagrees with the
  live bench** about what session 1 is. Correct, documented in the fixture README,
  and a trap for any future session that tries to reconcile them.

---

# Task-by-task detail

Each task ends with a fresh implementer and an independent read-only reviewer,
per the project's standing process. The coordinator writes no code itself.

## Task 1: extract session 1's fifteen swings into their own module

**Why.** They live in `mockSwings` inside `src/App.jsx`, which contains JSX, so
no plain Node script can load them. That is the single reason the eval bench
cannot grade the first debrief every visitor sees. It is also why the fifteen
distances exist in five hand-maintained copies that must agree.

**What to do.**

1. Create `src/sessionOneSwings.js` exporting the fifteen swings verbatim,
   values byte-identical to what is in `App.jsx` today. Add a header comment
   saying what they are (the scripted first session every visitor sees, not
   generated), that their distances come from `carryDistance`, and that the
   straight-line correlation between exit velocity and launch angle is a known
   open item belonging to the session-1 rewrite.
2. `src/App.jsx` imports it and drops its literal array. Keep the local name so
   the three existing reference sites do not churn.
3. `scripts/measure-swing-generation.mjs` and
   `scripts/compare-distance-bucket-schemes.mjs` import the module and drop
   their full copies. These are two of the five copies and they existed only
   because `App.jsx` could not be imported.
4. **Leave the two test copies alone.** `src/ballFlight.test.js` and
   `src/coachApi.test.js` hold the fifteen distances as literal arrays. Those
   are expected values in an assertion, so importing the module there would
   delete the independent check rather than collapse a duplicate. Five copies
   becomes three, and the remaining two are load-bearing.
5. Add the distance pin: a test that imports the module and asserts each swing's
   stored distance equals `carryDistance` of its own exit speed and angle. This
   is what makes a 999 turn the suite red.

**Verification.** Run both `scripts/` files before the change, save their
output, run them after, and diff. Identical is the pass condition. Mutate one
distance in the module and see the new pin go red, then revert. Report the suite
count.

## Task 2: point the bench at the real session 1 and give it a session-1 cell

**Why.** The bench's `standInSessionOne` was a workaround for exactly the
problem Task 1 removes. Because the app rebuilds every later session off session
1, the stand-in meant all three measured cells were built on a starting point
the app never shows.

**What to do.**

1. Replace `standInSessionOne` with an import of `src/sessionOneSwings.js`.
   Delete the stand-in and its two pinned average constants; the comment block
   explaining the workaround is replaced by one saying the gap is closed and
   naming the date.
2. Add a `power-s1` cell: the Power goal, session 1, twelve runs. Power because
   it is the goal most visitors pick. Session 1 debriefs are different in kind
   from the others, since there is no prior session to compare against, which is
   part of why it earns its own cell.
3. Run allocation becomes 12 on `power-s1` and 8 on each of `power-s2`,
   `contact-s4` and `open-s4`: 36 calls per condition. Session 1 earns the extra
   because it is where the error was found and where every visitor lands.
4. Add the deterministic overlap measure from verification point 7: content-word
   overlap between `whatThisMeans` and `coachingSummary`, reported per debrief
   and as a distribution. No model needed.
5. Make sure the bench keeps saving its raw records to disk the way Slice 7's
   run did, since those records are what the grader reads afterwards and what
   became this project's fixture.

**Verification.** `--dry-run` exercises all four cells with no spend. Confirm
the goal-label copy still matches `GOALS` in `App.jsx` by hand, since that is
the one thing the bench copies rather than imports.

## Task 3: the before-run, on today's shipped prompt

**Why.** The before number for session 1 has never existed, and it cannot be
recovered once the prompt changes.

36 calls, about $0.68. Records saved to disk for grading in Task 6. This runs
before Task 4 touches the prompt, which is the whole point of its position here.

## Task 4: build the claim-accuracy grader, and validate it before using it

**Why.** "Does the extra sentence make the coach more wrong" is the number the
product manager cares about most, and it cannot be answered by unit tests.

**What to do.**

1. `scripts/grade-coach-accuracy.mjs`. For each debrief it takes the exact
   session data that debrief was given and produces a verdict per countable
   claim, citing the data behind each verdict.
2. **The model does no arithmetic.** The script computes a deterministic fact
   sheet first: a per-swing table, and counts at every threshold the coach might
   cite. The model's job is finding claims in prose and comparing them against
   that sheet. This split is aimed directly at the regrade report's own finding
   that hand-verification was reliable and pattern-matching was not, and at the
   mechanism behind all 8 known errors: the coach is unreliable at counts it
   derives itself.
3. Unit tests for the fact sheet, per verification point 5.
4. A `--validate` mode that runs against `docs/eval-fixtures/slice7-debriefs/`
   and reports recall against the 8 known-wrong records by name, plus every flag
   raised outside those 8 for hand adjudication.
5. Prove the file sits outside the test runner's collection by file count, the
   same way the other two scripts were proven.

**Verification.** Validation runs on all 8 known-wrong plus 32 known-clean
records, 40 calls, about $0.32. The 8 are the hard test. If the cheap model
misses them, stop and report the cost of the stronger one rather than spending
it: that path takes the slice to roughly $3.70, above the approved $3.

## Task 5: the prompt change

The three edits approved on 17 August 2026, as one change:

1. In `DEBRIEF_SYSTEM_BASE`, the JSON shape hint for `whatThisMeans` changes
   from "1-2 sentences translating the numbers into real baseball terms" to
   three sentences. Without this the prompt contradicts itself and the model may
   obey either rule.
2. A new `For whatThisMeans:` section, placed beside the existing per-field
   shape sections, reading exactly:

   > Three sentences, no exceptions. No sentence longer than 18 words. The first
   > two say what the session's numbers mean for the player's swing. The third
   > has to add something the first two did not say: what is causing it, what it
   > costs the player, or what it sets up for next round. Repeating
   > coachingSummary in different words is a failure, not a success. If nothing
   > new comes to mind, go back to the swing data and find it there. Do not pad.

   "No exceptions" and "is a failure, not a success" are lifted from the tips
   instruction deliberately: that is the one rule in this prompt with a track
   record of holding. "18 words" is a number rather than an adjective because
   the prompt already says "short sentences" and the coach wrote long ones
   anyway.
3. `lengthBudget` gains an optional floor for `whatThisMeans`. When a floor is
   given the line renders as a range and says plainly that undershooting is a
   failure in the same way overshooting is. **The optional shape matters:** the
   bench's historical A/B/C conditions pass a bare ceiling and must keep
   rendering exactly as they did, or those conditions stop measuring what their
   labels claim.

**Tests.** Pin the new numbers (35 floor, 40 ceiling) alongside the existing
45/12/50. Pin that the floor sentence is present when a floor is passed and
absent when it is not. Each seen failing first.

**A limit to record rather than fix.** Nothing pins the prose of either the new
section or `DEBRIEF_SYSTEM_BASE`; that is a known, already-recorded gap and this
slice does not widen or close it.

## Task 6: the after-run, and grade both

36 calls, about $0.68, on the floor prompt. Then grade the before and after
records with the validated grader, 72 calls, about $0.58.

**Reported to the product manager:** whether `whatThisMeans` lands in 35 to 40
words, the claim-error rate before versus after with the power caveat attached,
whether grounded citations held, the box-fit figure against the 106-word
capacity, and the overlap distribution as the padding check.

## Task 7: the chat panel to 17px

One number, in `src/DebriefScreen.jsx`. Flag in the report that this narrows the
summary-to-chat type gap from the 2px Slice 7 deliberately kept to 1px, and let
the browser pass settle whether that reads worse.

## Task 8: close the slice

Decision record entry, dated 17 August 2026, 400 to 600 words. Update the
project CLAUDE.md's current-state sections: line counts, the bench section's
session-1 blind spot (now closed), the copy count in the goal-targets section,
the verification norms' test count, and the deliberate-decisions entry for the
budget. Take this slice's items off the What's Next list and add what it
surfaced. Then the PR body, near 300 words, and the QA script in the chat
message.
