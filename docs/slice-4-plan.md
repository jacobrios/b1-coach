# Slice 4 plan: what the goals promise, and which charts the coach can pick

Written 31 July 2026 by a planning session, scoped with the product manager,
for execution in a fresh session. Nothing in this slice has been built yet.

Read all of it before touching code.

This file travels with the work and is never deleted. It is committed on the
slice branch and reaches GitHub only inside the pull request that carries the
finished build.

---

## What this is, in product terms

The app tells a visitor what they are aiming for, then colours their swings
against it. Right now it tells them different things in different places, and on
two of the six goals it shows them a target they never picked.

Confirmed by running the app on 31 July 2026, not by reading code: pick **Open
Session**, whose card says "Free practice, no target metrics," and the launch
angle chart draws an orange target box at 25 to 35 degrees with a line at 88 mph
and colours the swings that land inside it. That is the Power goal's target,
borrowed silently because Open Session has no definition of its own.

The colouring mechanic itself is fine and was carefully checked when it was
built. Nothing about it changes. What changes is which numbers it points at.

## Baseline, recorded before any code lands

- **Test suite: 82 tests across 4 files, all passing** on `main` at `4436dc5`.
  Run `npm test`. The pull request reports the before and after numbers.
- **Lint: 13 errors, all pre-existing.** `npm run lint`. Do not fix them here;
  they are unrelated and predate this work.
- No known failing tests. Anything red at slice start is new and yours.

---

## Settled with the product manager, do not relitigate

**1. One definition per goal, and these are the numbers.** The principle chosen
was "keep the coach's numbers," because they are already used in most places and
the coaching language written against them has been reviewed and liked.

| Goal | Launch angle | Exit velocity |
| --- | --- | --- |
| power | 25 to 35 | 88 and above |
| contact | 8 to 18 | 85 and above |
| popup | 10 to 25 | none |
| allfields | none, see item 3 | none |
| open | none, see item 3 | none |
| dashboard | none | none |

**2. The goal cards change to match, not the other way round.** In
`src/App.jsx`, the `GOALS` array: power's tag reads `Launch Angle 20–35°` and
becomes 25 to 35; contact's reads `LA 10–15° · Hard Hit %` and becomes 8 to 18.
Keep the existing typography, including the en dash in the range, which is
correct in a numeric range and is not covered by the project's dash rule.

**3. Hit to All Fields and Open Session get no target zone at all.** No
highlighted band on the launch angle chart, no orange or grey outcome colouring
on the pitch location chart. Not a different band: none. Decided because those
goals genuinely have no launch angle target. All Fields is about spray direction
and Open Session is explicitly free practice, so an honest blank beats a borrowed
promise. Today an Open Session visitor sees every pitch drawn as a grey "you
missed it" dot, which reads as the app being broken.

**4. Popup's numbers are an extension of the same principle, not a separate
decision.** The product manager was asked about power and contact. Popup has the
same disagreement, so the same rule was applied: the coach's prompt targets 10 to
25 degrees, so that wins over the pitch location chart's 5 to 35 and the band's
exit velocity floor of 88, which the prompt never mentions. **Flag this
explicitly in the pull request** as an extension rather than an instruction, so
it can be reversed in one line.

**5. One slice, all of it.** Everything below is in scope, including the two bugs
no visitor can reach today.

**6. Vitest is the test framework and the tests live beside the code they test**,
except under `api/`, which `.vercelignore` already excludes from deployment. Do
not add a test file to `api/` without checking that exclusion still holds.

---

## The work

Precise locations, from a survey done 31 July 2026. Verify each before editing;
line numbers drift.

### A. One definition per goal

The goal definitions currently exist in four places, and the goal cards make a
fifth.

| Where | File | Roughly |
| --- | --- | --- |
| Coach prompt, debrief | `src/coachApi.js` | 131-135 |
| Coach prompt, chat, a verbatim duplicate | `src/coachApi.js` | 165-169 |
| `PitchLocation` outcome colouring | `src/DebriefScreen.jsx` | 703-717 |
| `ScatterEVLA` reference band | `src/DebriefScreen.jsx` | 364-365, applied 376-380, 407-409, 414-415 |
| The goal cards | `src/App.jsx` | `GOALS`, near the top |

**Put the definitions in one exported place and have every consumer read from
it.** A new module beside `src/chartSlots.js` and `src/sessionStats.js` is the
established pattern here; those exist because a test that imports
`DebriefScreen.jsx` also loads Recharts and needs a DOM. Shape it so a goal with
no target is representable as an absence rather than as zeroes, since three goals
have none and item 3 depends on telling "no target" apart from "a target of
nothing."

Note the exit velocity floor is currently hardcoded as `88` at
`src/DebriefScreen.jsx:409` and `414-415` for every goal, which is why contact's
band disagrees with contact's own prompt. That hardcoding goes.

The prompt text at `src/coachApi.js` is prose the model reads. Keep it prose,
but make the numbers in it come from the same source, or if that is too awkward,
leave the prose and add a test asserting the prose matches the shared
definitions. Say in the pull request which you chose and why.

### B. The two goals with no target

Once A is done this should mostly fall out: allfields and open have no target, so
the band does not render and the outcome colouring does not run. Check both
charts explicitly rather than assuming. `PitchLocation` currently leaves
`outcome` false for every swing on those goals, which is what produces the wall
of grey dots.

### C. The duplicate chart

`src/chartSlots.js`, `resolveChartSlots`. Two valid but identical keys both
survive, so the same chart renders twice side by side. The dedupe branch only
runs when a slot is empty.

**Pinned by a test that must flip in the same commit:**
`src/chartSlots.test.js`, `'currently renders the same chart twice if the model
names it twice (recorded, not endorsed)'`. Rewrite it to assert the second slot
becomes a different chart, and delete the "recorded, not endorsed" comment.

### D. The chat path overwriting a debrief chart

Today a chart key the model invents in a chat reply is written into session state
at `src/App.jsx` around 982-992, destroying the debrief's second chart for the
rest of the session, before `resolveChartSlots` later drops it and substitutes a
generic fallback. The visitor asked a question and silently lost one of their
charts, with no way back.

Validate the chat reply's single `chart` key against the same allowlist before it
is allowed to overwrite anything, at `src/DebriefScreen.jsx` around 178-180.
Note that a truthy but meaningless value such as the string `"null"` passes the
current guard. There is no test for this path; write one.

### E. The two response-parsing faults

`src/coachApi.js` around line 119, both on the same line:

```
text.replace(/^[\s\S]*?```json\s*/,'').replace(/\s*```[\s\S]*$/,'').trim()
```

- A reply fenced with a plain fence and no `json` tag: the first pattern matches
  nothing, then the second deletes from the opening fence to the end, leaving an
  empty string.
- A reply containing a literal fence inside a string value: the second pattern
  truncates from the leftmost fence it finds.

Both surface to the visitor as a connection error, which is wrong on the facts.
The connection worked, the model answered, and the answer was thrown away. On the
debrief path that is the full "coach unavailable" screen; on the chat path it is
"Sorry, I couldn't connect right now."

**Pinned by two tests that must flip in the same commit:**
`src/coachApi.test.js`, both marked "recorded, not endorsed".

### F. The two bugs nobody can reach today

Neither is reachable because a session always generates exactly 15 swings. They
are in scope because a test asserts each is broken, and leaving that is worse
than fixing it.

- `src/sessionStats.js`: `computeStats([])` divides by zero and returns `NaN`,
  which would reach the coach's prompt as the literal text "NaN mph". **Pinned
  by** `src/sessionStats.test.js`, "recorded, not endorsed".
- `src/App.jsx` around 936-938: `Math.max(...[])` returns `-Infinity` for an
  empty swing list, and the guard checks that swings exist rather than that there
  are any, so `-Infinity mph` renders in the Top Exit Velocity tile
  (`src/DebriefScreen.jsx` around 1238). **No test exists; write one.**

Decide what an empty session should show and say so in the pull request. A dash
or an em-space is the obvious answer; do not invent a zero, which is a claim.

### G. The variance comment

`src/App.jsx` around 683-685. The comment claims spread narrows to 87, 75 and 65
percent across sessions 2 to 4. The formula below it yields 100, 95 and 90, and
its floor never binds within the four sessions the app can reach.

**Correct the comment to describe the formula. Do not change the formula.** This
slice makes the app internally honest; retuning how much the demo improves
session over session is a product change and belongs on the What's Next list as
its own question. Add it there.

---

## Not in this slice

Each exclusion names where it belongs instead.

- **Retuning how much variance actually shrinks.** A behaviour change, not a
  correctness fix. Goes on the What's Next list in `CLAUDE.md` as its own product
  question.
- **Consolidating the strike zone boundary and the distance buckets.** Six copies
  and three copies respectively, all currently in agreement, checked 31 July
  2026. Already on the What's Next list. Doing it here would double the diff for
  no behaviour change. The goal thresholds are being consolidated only because
  they had already drifted and are what this slice is about.
- **A committed reviewer config.** On the What's Next list.
- **The waking-up timer.** On the What's Next list, and the strongest remaining
  candidate after this one.
- **Rendering tests for the chart components.** Would need a DOM environment
  added to the test runner. No evidence of a rendering regression, and the
  per-goal rendered check below covers this slice honestly. Revisit only if one
  happens.
- **The pre-existing lint errors.** Unrelated and predate all of this.

---

## How this will be verified

Written before any code.

1. **The suite goes from 82 to a larger number, all green.** Report both.
2. **Every pinned test flips, and is seen failing first.** There are four tests
   marked "recorded, not endorsed" (one in `chartSlots.test.js`, one in
   `sessionStats.test.js`, two in `coachApi.test.js`). For each: rewrite the
   assertion to the correct behaviour, run it against the unfixed code, show it
   red, then fix and show it green. That order is the point.
3. **Each new test is seen failing before its fix.** Applies to the chat path
   validation, the `-Infinity` tile, and the goal definitions.
4. **The goal definitions are asserted, not just centralised.** A test that pins
   the actual numbers, written as literals rather than read from the module under
   test, so changing a threshold fails the suite instead of quietly changing the
   test.
5. **A rendered check on every one of the five reachable goals.** Power, contact,
   popup, allfields, open. Run a session on each in a real browser and screenshot
   the debrief. This is the check that matters and it cannot be skipped or
   sampled: the whole slice is about what a visitor sees.
   - power, contact, popup: a band at the agreed numbers, and the outcome
     colouring agreeing with it.
   - allfields, open: **no band and no orange or grey outcome colouring at all.**
   - dashboard short-circuits before any debrief, so it has nothing to check.
     Confirm that is still true rather than assuming it.
6. **The chat path, exercised for real.** Ask the coach a question on a debrief
   and confirm the two debrief charts are not silently replaced.
7. **Lint stays at 13.** Any new error is yours.
8. **The full app still works end to end**, including a multi-session run,
   because the goal definitions are read on every screen.

Say plainly what could not be verified.

---

## Debt this slice is expected to open

- The strike zone boundary and the distance buckets are still written out in
  several places each. This slice consolidates the goal thresholds only, so the
  project will have one shared-definition pattern and two unconsolidated ones,
  which is a slightly confusing state to leave. Named on the What's Next list.
- Still no rendering tests. The per-goal check in step 5 is manual, so a future
  change to the charts can still break them silently.
- If the coach prompt keeps its prose numbers rather than reading from the shared
  definitions, that is a fifth copy held in step only by a test.

---

## Decision-log entries owed on completion

`docs/product-decisions-log.md`, in product language, most recent first:

- What each goal now means and why the coach's numbers won over the cards'.
- Why Hit to All Fields and Open Session show no target at all, including that
  the alternative considered was giving All Fields a direction-based target and
  why that was not done now.
- That popup's numbers were an extension of the settled principle rather than a
  separate instruction.
- What an empty session now displays, and that it is unreachable today.
- That the variance comment was corrected to match the formula rather than the
  formula changed, and that the retune is a separate open question.

And per the standing rule: **this slice is not done until the What's Next entry
for it comes off the list in `CLAUDE.md`**, and anything it surfaced goes on.
