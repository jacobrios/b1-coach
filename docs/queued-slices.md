# Queued slices: agreed scope for Slice 6 and Slice 7

Written 14 August 2026. This is **agreed scope**, not a slice plan. A slice plan
travels on its own branch and reaches GitHub only inside the pull request that
carries the finished build; this file lives on main so that any session can read
what was already decided without re-deriving it.

Both slices below were agreed in conversation on 12 August 2026 and existed
nowhere in this repository until today. That gap is the reason this file exists.
See the decision log entry for 14 August 2026 for the process finding itself.

**Do not re-litigate what is marked settled here.** The product manager settled
these deliberately, and several were settled *against* the recommendation that
was put to him. Where that happened it is noted, because a future session that
reads only the recommendation will otherwise reopen a closed question.

---

## Where these came from

A read-only multi-agent audit of the whole app ran on 12 August 2026. Six
auditors swept one dimension each, an adversarial verifier tried to refute every
finding, and 22 of 47 findings survived. A live browser pass followed on the
deployed site, which both confirmed several findings and killed two others.

The audit's own report was written to a session scratch folder and is gone. What
survived is what is written here and in CLAUDE.md, which is precisely the failure
this file is meant to stop happening twice.

## Letter-to-number mapping

The slices were first agreed as letters, then renumbered to match this repo's
existing sequence. Anyone who finds a reference to the letters should read it as:

    Slice A  ->  Slice 5   Reliability. SHIPPED 14 August 2026 as PR #17.
    Slice B  ->  Slice 6   Credibility polish. Queued, scope below.
    Slice C  ->  Slice 7   Coach fidelity. Queued, scope below.
                           RENUMBERED: see the annotation immediately below.

**Annotation, later on 14 August 2026: "Slice 7" no longer means this.** A
separate, unrelated slice, the coach's length budget and the type-size bump,
was cut on branch `slice-7-coach-brevity` and took the number 7 as the next
one in the repo's own sequence, before Slice C below had been built. That
slice shipped the same day; see the decision log entry for 14 August 2026.
Slice C, coach fidelity, was never built under the number 7 and its scope
below is unchanged, but it no longer has a number of its own. The natural
next slice is session 1's rewrite (extracting the fifteen hand-written swings
so the new eval bench can grade the first debrief a visitor sees, per
CLAUDE.md's What's Next list), which is not this slice either, so guessing
"Slice 8" here would just be a second wrong number. Whoever schedules coach
fidelity gets to pick its number. Read every "Slice 7" below as "coach
fidelity, unscheduled."

**Slice 5 delivered half of what Slice A was scoped to cover, and that is worth
knowing.** Slice A had two halves: find out why a debrief timed out, and stop the
app blaming a sleeping server for every failure. The second half shipped in full.
The first did not: CLAUDE.md still records the cause of the 12 August 504 as not
known, with a concurrency effect unruled-out. This was not an oversight to
correct later. The visitor-facing problem was solved another way, by capping the
wait at 50 seconds and saying honestly what happened, so the root cause became a
question rather than a defect. Recorded here so nobody reads "Slice A is done" as
"the latency question is answered."

---

# Slice 6: credibility polish

**What it is, in one line:** fix the things an informed visitor would notice and
quietly judge, none of which break the app.

**Why it is next:** these are the findings that survived both the adversarial
verifier and a live browser pass. Every one of them is visible without opening
the code, and most are cheap.

**A warning about size.** This is eight defects plus one feel decision (item 9,
which is a question for the product manager rather than something to fix). It may
be too large for one slice.
The product manager's own rule is to prefer the largest slice that can still be
verified honestly, and all of these are verifiable in a single browser pass,
which is the argument for keeping them together. If it needs splitting, the
natural seam is item 1 and item 2 (the data model) against everything else
(surface polish). Say so before starting rather than discovering it halfway.

### 1. Hit distances are physically impossible

**Verified live on the deployed site, 12 August 2026, and re-verified in code on
14 August 2026.**

The formula is at `src/App.jsx:723`:

    const dist = Math.round(ev * 4.0 + la * 1.8)

Launch angle barely matters, so a ball hit almost flat is credited with most of
the distance of one hit perfectly. Two real examples from the live app:

- 70 mph at 4 degrees, recorded as **287 feet**. In real baseball that is a
  ground ball, somewhere near 130 feet.
- 91 mph at 28 degrees, recorded as **414 feet**. Real carry is nearer 320.
  414 feet needs roughly 105 mph.

This is not confined to a table nobody opens. The coach reads the distances and
quotes them in its opening sentence. Live quote from the deployed app:

> ten of your fifteen swings carried 340 feet or more

on a session averaging 82 mph.

**Why it matters more here than it would anywhere else.** The entire product is
an interpretation layer over a ball-flight *measurement* company's data. A
baseball-literate reviewer opens the Raw Data table and knows within seconds that
the numbers came from nowhere. A reviewer who does not know baseball will never
notice, which is exactly why this survived four months.

**Direction of the fix:** give launch angle real weight. Near-zero carry below
about 10 degrees, peaking around 28. The fifteen-swing opening session at
`src/App.jsx:649` onward is hand-written using the same relationship and must be
re-checked afterwards, or the fixed session every visitor sees will contradict
the generated ones.

*(The real-world distance figures above are from general baseball knowledge, not
a physics model. The direction is certain; the exact feet are approximate.)*

### 2. The distance buckets depend on item 1

`src/DebriefScreen.jsx:547-553` starts its buckets at 160-220 feet. The shortest
ball the current formula can produce is 251 feet, so that column can never fill
and the next one almost never does. The first debrief renders as 0, 0, 1, 4, 10:
two empty columns and one enormous bar. This chart is a default for the Power
goal (the debrief prompt names it at `src/coachApi.js:84`; checking
`FALLBACK_CHART_KEYS` in `src/chartSlots.js` instead would wrongly suggest
otherwise, since those are only the stand-ins used when the model names nothing
usable), so a first-click visitor lands on it.

The same empty ranges are handed to the coach, which can then congratulate the
player for having nothing under 220 feet.

**The bucket edges are written out in three places and all three must move
together.** This was found by review on 14 August 2026 after the first draft of
this document named only one:

    src/DebriefScreen.jsx:547-553   the chart itself
    src/coachApi.js:382             the debrief prompt
    src/coachApi.js:407             the chat prompt, easy to miss

CLAUDE.md's known-debt section already records the buckets as living in three
places. Fixing two of three would leave the chat prompt describing ranges the
chart no longer uses, which is the exact drift this project keeps having to
clean up.

**Do this after item 1**, since fixing the formula moves all the data, then set
the buckets from the range the data actually occupies.

### 3. The browser tab shows the build tool's logo

`public/favicon.svg` is Vite's own scaffolding mark, a purple bolt, untouched
since the first commit. `index.html:5` points at it. The app already draws its
own radar mark in `TrackManLogo` at `src/App.jsx:366`; exporting that under the
same filename changes nothing else.

**The product manager downgraded this from the severity it was reported at, and
his reasoning should be recorded rather than re-argued.** It was put to him as
the single most embarrassing item found. He disagreed: the URL is visibly a
Vercel address, he does not claim to work for TrackMan, and a non-engineer just
sees a generic bolt. It stays in the slice only because it is a ten-minute job,
not because it is urgent.

One clarification worth keeping, because it caused a crossed wire the first time:
**this item is not about TrackMan branding or copyright.** It is about shipping
the *build tool's* logo, which reads as generated-from-a-template-and-never
-finished. The TrackMan branding question is separate and nobody has raised it as
a problem.

### 4. Scaffolding files still in the repo

Five files from day one, none of them reachable by any visitor path, all of them
visible to a reviewer who opens the source folder, which is precisely the
impression this project cannot afford:

    src/App.css              build-tool template styles, imported by nothing
                             (verified 14 August 2026: no reference in src/)
    src/assets/react.svg     starter logo
    src/assets/vite.svg      starter logo
    src/assets/hero.png      unused
    public/icons.svg         a social-media icon sprite that ships to the live
                             site and is served at /icons.svg

Keep `src/index.css`, which is the real stylesheet. Build once after deleting to
confirm nothing broke.

### 5. The project's own code-quality check fails

An engineer gut-checking this repo runs install, then test, then lint. Tests come
back perfect. Lint dumps a wall of red, which reads as nobody having run it
recently.

**The audit reported 13 errors on 12 August. It is 22 as of 14 August.** The nine
new ones all come from `.claude/hooks/run-tests-unless-docs.test.js`, which was
added on 13 August by PR #15 and is a Node test file being linted as though it
ran in a browser. Slice 5 is not the cause; a first draft of this document said
it was, and review disproved it on 14 August. Re-run the check rather than
trusting any number written here.

Most are the checker aimed at files it was never meant to lint. `eslint.config.js`
ignores only `dist`, and applies browser globals to everything:

Counted per file on 14 August 2026:

    .claude/hooks/run-tests-unless-docs.test.js   9   Node test file
    design/trackman-b1-coach/project/ios-frame.jsx 8  design mockup, not app code
    api/coach.js                                  1   server-side, uses process
    vite.config.js                                1   server-side, uses process
    src/App.jsx                                   2   genuine, see below
    src/LiveSessionScreen.jsx                     1   genuine, see below

Three are genuine and worth judging on their own merits:

    src/App.jsx:4              'sendChatMessage' imported and never used
    src/App.jsx:675            Math.random() called during render (nickname pick)
    src/LiveSessionScreen.jsx:296  setState called synchronously in an effect

The first is a leftover and takes seconds. The other two are real React
complaints in shipped code; neither has produced a visible bug, so treat them as
findings to assess, not as automatic fixes.

### 6. A reviewer who clones the repo cannot run it

`README.md` has "What it does", "Tech stack", "Status" and "Documentation", and
no install line, no run line, and no mention that local development needs a
differently-named API key than production does. That fact currently lives only in
CLAUDE.md, which is not where a stranger looks.

Add a short "Running it locally" section and a `.env.example` carrying both
names: `VITE_ANTHROPIC_API_KEY` for local development, `ANTHROPIC_API_KEY` for
production. `.gitignore` already carries the `!.env.example` negation that lets
that file be committed; do not remove it.

**Already fixed, do not re-report:** the audit flagged the README for advertising
Tailwind. It now reads "Tailwind is installed but used only minimally," which is
accurate. Verified 14 August 2026.

### 7. The README lists goals that are not the goals on screen

`README.md:13` names Power, Line Drives, Contact, Reduce Pop-Ups, Hit to All
Fields, and Open Session. The app shows six cards, but they are a different six:
Line Drives and Contact are a single card, and the sixth is Full Dashboard, which
the README does not mention.

Full Dashboard is deliberately out of scope and says so honestly when tapped.
That honesty is worth showing rather than hiding. A two-line rewrite.

### 8. The Reduce Pop-Ups goal card points the wrong way

The tag reads `LA < 0° ↓ · Drive more` (`src/App.jsx:54`), for a goal whose real
target is 10 to 25 degrees. Read literally it points backwards, since a pop-up is
a *high* launch angle, not a low one.

`launchAngleRangeLabel('popup')` in `src/goalTargets.js` already returns `10–25°`
if a numeric range turns out to be what is wanted.

**This needs the wording decided before any code changes.** It has been open
since Slice 4 for exactly that reason. Ask the product manager; do not pick copy.

### 9. A judgment call, not a defect: the Power goal often shows nothing on target

**Measured 12 August 2026 by replaying the app's own generator 20,000 times
against the Power target in `src/goalTargets.js` (launch angle 25-35 AND exit
velocity 88 or better):**

    session 2 showing ZERO on-target swings:        55.4%
    ...of the sessions that IMPROVED:               34.3%

**Read this carefully, because it was misread once already.** This is **not** the
deliberate 65/35 improve-or-decline design, and that design is **settled and
stays**. It was tuned on purpose because an unbroken improvement arc made the
player look superhuman by session four.

The separate thing is that the Power band sits at 25 to 35 degrees while the
simulated hitter averages 17 to 19, so a swing has to be an outlier on launch
angle *and* on exit velocity in the same moment. Exit velocity and launch angle
are drawn independently at `src/App.jsx:720-721`. That is why a third of sessions
that genuinely *improved* still show nothing highlighted.

The risk is not that the player failed. It is that the chart's orange target band
renders completely empty, which reads as a broken chart rather than as coaching.
Power is the first card on the grid and the likeliest first click.

**Bring the product manager options rather than a fix.** This is a feel decision.

---

# Slice 7: coach fidelity

**No longer Slice 7. See the annotation under "Letter-to-number mapping"
above, added 14 August 2026: a different, unrelated slice shipped as Slice 7
the same day and this scope is unscheduled and unnumbered until someone picks
it up.** The heading and every reference below are kept as originally
written, per this project's append-only convention.

**Scheduled 17 August 2026 as Slice 8.** At the close of Slice 7b the product
manager agreed this as the next slice. The scope below stands as written; what
Slice 7b added is evidence and instruments. Evidence: two browser passes on the
first screen produced two false coach statements, so this is now reproducible
rather than anecdotal. Instruments: a committed 96-debrief fixture with 8 known
errors (`docs/eval-fixtures/slice7-debriefs/`), a claim-accuracy grader
(`scripts/grade-coach-accuracy.mjs`) that is BUILT BUT NOT VALIDATED, and an
eval bench that now reaches session 1. Validating the grader against the fixture
is the first task, because until that runs its verdicts should not be trusted.

**What it is, in one line:** stop the coach from being able to contradict the
screen it is sitting next to.

**Read this before planning anything.** Items 1 and 2 were found by reading code,
and a live walkthrough on 12 August 2026 **failed to reproduce either one**. The
mechanisms are real; the visible symptom did not appear. Treat them as unproven,
decide whether each is worth fixing before fixing it, and do not describe them as
confirmed defects in a pull request.

**How this slice has to be verified.** These are claims about model behavior, and
the test suite cannot settle them: it deliberately never calls the model. Per
CLAUDE.md, that needs named hand-run scripts scoring behavior as a rate over N
runs, kept provably outside the test runner's collection. A single clean
walkthrough is not evidence, in either direction. Plan that verification before
writing code, and record baseline and after numbers in the decision log.

### 1. The coach never receives the tips it just gave. UNPROVEN.

The two next-session tips are stored as the literal placeholder string
`__tips__` at `src/App.jsx:794`, rendered from a separate field at
`src/DebriefScreen.jsx:245`, and stripped out of prior sessions' history at
`src/coachApi.js:417`.

**The seam where a fix has to land is `src/coachApi.js:429`**, added here after
review on 14 August 2026 pointed out that the three lines above describe the
problem but none of them is where it can be corrected. That line flattens the
current session's conversation into the chat prompt, and it is the point at which
the model is handed the bare string `__tips__` instead of the tips. The coach
does receive `coachingSummary` (`src/coachApi.js:408`), so the session context is
there; only the tips text is missing.

The tips sit at the top of the chat panel looking exactly like something the
coach said. When a visitor asks the most natural possible follow-up, the coach
has never been told what they were.

**Did not reproduce.** Asked "How do I work on that first one?" on a live Power
debrief, the coach answered correctly and on-topic, inferring from the session
numbers. One run proves nothing either way.

### 2. The coach is told to flag "below 15 degrees" for every goal. UNPROVEN.

`src/coachApi.js:379` hand-writes 15 rather than reading the selected goal's own
target from `src/goalTargets.js`:

    Swings with launch angle strictly below 15 degrees ...

That 15 was written for Power and never revisited. On Line Drives & Contact,
which targets 8 to 18 degrees, a swing at 12 degrees is exactly what was asked
for, is drawn as on-target, and is simultaneously handed to the coach inside a
list of problems. On Reduce Pop-Ups, the goal is about hitting the ball too
*high* and the coach is handed a count of balls hit low.

**Did not reproduce.** On a live Contact debrief the coach correctly used the
8-to-18 window and framed the problem as swings going too high.

### 3. Hit to All Fields is the one goal the coach must count by hand

`src/coachApi.js:37` states the rule (at least 3 swings pull side below -15
degrees, at least 3 opposite field above +15) but `src/coachApi.js:376-382`
pre-counts everything *else* and leaves this one uncounted, handing the model a
run-on list of fifteen direction values to tally itself.

A wrong count here becomes the headline sentence of the debrief, with a chart
beside it showing the true answer in dots. The decision log records that
pre-counting was introduced in the first place *because* the model was
miscounting. This goal was left out.

Related and worth deciding at the same time: the goal card at `src/App.jsx:43`
promises "Pull% · Center% · Opposite field%", percentages the app never
calculates anywhere.

### 4. Two model fields can blank the whole screen

If the model returns the tips as a single string instead of a list, or the
summary as anything other than text, the app throws while drawing and the visitor
gets a white page with no hint that retrying would help. The gate is at
`src/App.jsx:790` and the draw at `src/DebriefScreen.jsx:245`; the summary is at
`src/DebriefScreen.jsx:1139`.

Chart keys are already guarded exactly this way in `src/chartSlots.js`, so the
pattern exists and simply was not applied to these two.

**Scope this narrowly.** The audit explicitly declined a general validation layer
over everything the coach returns as work with no visitor-facing payoff on a
proof of concept. Do these two fields only.

**Do not connect this to the old unreproduced "whole site shows up blank"
report** without evidence. CLAUDE.md warns against folding those together and
that warning stands.

---

# How this maps onto the list already in CLAUDE.md

Added 14 August 2026 after review pointed out that this document sits beside an
existing "Queued, not parked" list in CLAUDE.md and never said how the two
relate. **This file is not the whole backlog.** A session that reads it as the
authoritative list of what is left would silently drop five items.

Already covered here, and duplicated rather than moved:

- **The Reduce Pop-Ups goal card** is CLAUDE.md's parked item 2 and Slice 6 item
  8. Same thing, still needs the same copy decision from the product manager.
- **Consolidating rules that exist in several copies** is ruled out below as a
  standalone job, but Slice 6 item 2 does half of it anyway, because fixing the
  distance buckets means touching all three copies. The strike-zone bounds, the
  other half, stay untouched and the existing trigger still stands.
- **Retuning how much the demo improves session over session** is *related to but
  not the same as* Slice 6 item 9. The queued item is about `varianceFactor` and
  the size of the improvement arc. Item 9 is about the Power target band sitting
  above where the hitter lives. Both are feel decisions and both are worth
  deciding in the same sitting, but fixing one does not fix the other.

**Not in either slice, still open, and nobody has scheduled them:**

- Decide whether the 88 mph "hard hit" highlight should be per goal.
- Tie the "40 seconds" wording in `src/failureCopy.js` to `UPSTREAM_DEADLINE_MS`
  in `api/coach.js`, so changing the constant cannot silently make the copy lie.
- Decide what the app should say when the browser's own 50 second backstop fires
  before the server answers. Needs a copy decision first.
- Test the `.env` guard in `protect-paths.mjs`, or record a reason for having no
  test. This is the last unrecorded safety-net drift line.
- A committed reviewer config, so a code review is not a per-session choice.

# Ruled out, with reasons

Recorded so nobody re-proposes them. Each was considered and declined by the
product manager on 12 or 14 August 2026.

**Labelling the orange target band on the results chart.** Declined. Nothing on
the results screen currently states what the band means, and the audit proposed
labelling it. The product manager's reasoning: it needs a design pass rather than
a one-line change, and an experienced coach picks up the meaning without help.

**Mobile and small-screen support.** Declined, and the intent is explicit: this
demo is meant to be viewed on a desktop or an iPad. A phone-width viewport (375
px) was checked on 12 August 2026 and the layout does break badly there. **iPad
width (768 px) was checked on the same day and renders correctly**, so the stated
target is a supported claim rather than a hope.

**Consolidating the strike-zone bounds and distance buckets.** Declined, and the
existing trigger stands: only worth doing if a third drift appears. The audit
found no drift.

**Rate limiting or authentication.** Declined. The audit found no new evidence
against the reasoning recorded on 30 July, and confirmed by reading the server
code that a caller cannot choose the model, the response length, or send an
oversized request. The existing trigger stands: only if the prepaid balance
starts moving faster than the owner's own use explains.

**A general validation layer over model output.** Declined. Two specific fields
are worth coercing (Slice 7, item 4); building general-purpose checking around
the rest has no visitor-facing payoff here.

**Streaming the debrief.** Declined 14 August 2026 and already struck through in
CLAUDE.md. Reopen only if measured latency climbs back toward 30 seconds.

**Treating the chat chart swap as a defect.** Downgraded 14 August 2026 and
already annotated in CLAUDE.md. Pulling a chart up from chat is intended
behavior, and a player can ask for the earlier chart back. What may still be
worth something is discoverability: nothing on screen tells a visitor they can
ask. That is a much smaller item and is not part of either slice.

*Verified in code 14 August 2026, since this came up as an objection: only the
second chart slot is ever overwritten. `onChartSignal` in `src/App.jsx` writes
`[charts[0], chartKey]`, so the first chart is never touched and naming the
original chart in chat restores it. One edge worth knowing: if the coach names
the chart already occupying the first slot, the duplicate guard in
`resolveChartSlots` fills the second slot with a fallback instead, so the visitor
gets a different chart than the one they asked for.*

---

# Postscript, 14 August 2026: Slice 6 was split, and the first half shipped

Append-only, per this project's convention. Nothing above is edited; this records
what happened when the scope above was actually built.

**The size warning was right and the named seam was the right one.** Slice 6 ran
as items 1, 2 and 9 (the data model). Items 3 to 8 became Slice 6b and are
unchanged from the scope above, except that two of their open questions are now
settled: the Reduce Pop-Ups tag becomes `LA 10–25° · Level it out`, and the
README's goal list must also pick up a rename made in Slice 6, from
"Power & Home Runs" to "Power & Distance".

**Three things landed that this document never named**, all three discovered by
building rather than by planning:

1. **The spray chart is a fourth place the distance change lands.** It sized
   every dot against a 300-foot centre and clamped everything under 177 feet to
   the same radius. Left alone it would have collapsed every session into the
   infield with the short balls stacked on top of each other, and its two ring
   labels said 300ft and 400ft+ when almost nothing now reaches 300. Item 2 of
   the scope above names three places the distance ranges live; this was a
   fourth, and it was the only one that was visually obvious rather than
   numerically obvious.
2. **Making distances honest made the coach's prompt untrue.** It described the
   Power target as "the conditions for home run distance contact", defensible
   when that swing was recorded at 399 feet and false at 323. Fixed in this slice
   rather than deferred to Slice 7, because this slice created it.
3. **Fixing the prompt was not enough, because the goal was named after the
   claim.** A live debrief showed the coach saying "you have the power to hit the
   ball out of the park" about 310-foot swings, reconstructing the idea from the
   goal's own label. The product manager renamed it to "Power & Distance". Worth
   keeping as a general lesson: removing a claim from a prompt does not remove it
   from the model's reach if the surrounding product still asserts it.

**One number in the scope above is wrong and the correction matters more than
the number.** Item 9's analysis is sound, but a figure produced while planning
this slice claimed Line Drives & Contact already rendered an empty target band 16
to 19 percent of the time. It does not; it is 9 percent at session 2 and 11 by
session 4. The 16 to 19 was
measured with the fix already switched on. The direction is the opposite of what
was assumed: correlating exit velocity with launch angle makes Contact *worse*,
because it pushes hard-hit balls through that goal's 18 degree ceiling. Writing
the re-roll generically rather than for Power alone is therefore load-bearing
rather than a free bonus, and without it this slice would have shipped a
regression on the second goal a visitor is likely to click.

**Item 9's decision, for the record.** The product manager chose correlated
contact quality plus a Power-only launch angle lift plus a single re-roll, over
a widened target band and over a guaranteed floor. Empty Power bands went from
56% to 14% at session 2 and 63% to 11% at session 4.

Full reasoning is in `docs/product-decisions-log.md` for 14 August 2026, and the
slice's own document is `docs/slice-6-plan.md`, which travelled on the branch.

---

# Slice 8b: count every threshold the prompt names

**Shipped 18 August 2026.** Result: the targeted miscount ("four of those were
under 80 mph") went from 8 occurrences to 0 across 52 measured debriefs, but
the coach's overall claim accuracy held flat (18 of 52 debriefs flagged both
before and after), and a self-derived error class over pitch location data,
deliberately left uncounted, held flat too, at 11 wrong claims each round.
Full numbers in the decision log entry for 18 August 2026 and in
`docs/eval-fixtures/slice8b-threshold-counts/README.md`.

**Correction, 18 August 2026, from whole-branch review.** The "held flat"
figure above is corrected in the decision log's 18 August entry: at least 5
of the 18 after-round flags are grading-tool false positives this slice's
own new count lines created, and the corrected comparison is roughly 17
flagged before this fix against roughly 13 after, a modest real improvement
rather than flat. The pitch-location figure (11 to 11) is unaffected, since
this slice made no change there.

**Added 17 August 2026, at the point Slice 8 split.** Coach fidelity was
scheduled as Slice 8 on 17 August. Its first task, validating the claim-accuracy
grader, failed outright: the grader flagged 72 of 93 debriefs and caught the
fixture's known errors for the right reason once in seven. The product manager
split the work at that seam rather than build a coach fix that could not be
measured. Slice 8 is the instrument (`docs/slice-8-plan.md`). **Slice 8b is the
coach fix, scoped here so it survives the end of a chat window**, which is the
failure this whole file exists to stop.

**Blocked on Slice 8.** Do not start this until the rebuilt grader has passed
its gate. That is the entire reason the split happened.

*Annotation, 18 August 2026: the gate passed.* The rebuilt grader caught all 8
known-wrong debriefs for the right reason at a 20-of-96 flag rate; both runs
are committed under `docs/eval-fixtures/slice8-grader-validation/`. This slice
is unblocked once Slice 8's PR merges. Budget note: a full accuracy run now
costs about $0.63, so this slice's before-and-after measurement is cheaper than
originally scoped, but the bench rounds are unchanged and still need their own
figure put to the product manager first.

## What it is, in one line

Every threshold the coach's prompt names in prose gets counted for the coach in
the data block, so it stops deriving counts it gets wrong.

## The finding this rests on, which is worth reading before planning

The 96-debrief fixture established that the coach reliably repeats a count it is
handed and is unreliable at any count it derives itself. Reading the prompt maps
that onto something exact: **the prompt names thresholds in prose that it never
pre-counts, and those are precisely the counts that come out wrong.**

- "Below 15 degrees" is pre-counted in the data block. Never wrong once in 96.
- "Angles above 20 degrees are fly balls" is stated in the Contact goal context
  and never counted. Every debrief that attempted it got it wrong.
- The same shape sits unexploded in two more goals that nothing has ever
  measured.

So queued items 2 and 3 of the original coach-fidelity scope are not two
defects. They are two symptoms of one rule.

## The change

`buildDebriefUserMessage` in `src/coachApi.js` hands every goal two count lines
written for Power: `Swings with launch angle strictly below 15 degrees`, and
`Swings in power zone`, the latter reading `POWER` directly whatever goal is
selected. Both are replaced by counts derived from the selected goal, covering
every threshold that goal's `goalContext` names:

| Goal | Thresholds to count |
|---|---|
| Power | LA 25-35, EV 88+ (what the existing line already does correctly) |
| Line Drives & Contact | LA 8-18, EV 85+, **above 20 degrees** |
| Hit to All Fields | direction below -15, direction above +15, EV 82+ |
| Reduce Pop-Ups | above 35, below 5, LA 10-25 |
| Open Session | names none, gets none |

Every number read from `src/goalTargets.js` where one exists. No threshold
written out fresh in that file.

## The prose half, approved in principle 17 August 2026, wording still to come

Counting cannot reach every error, and this is the part that must not be
dropped when the mechanical half looks done. **"Four of those swings were under
80 mph" when all six were is a derived subset, not a named threshold.** No
pre-counting reaches it, because the coach invents the subset as it writes. The
only lever is the prompt's own tips instruction, whose worked example is:

> "You only hit to the opposite field on swings 9, 12, and 14, and two of those
> were your weakest swings at 83 and 86 mph."

That is the exact shape of fixture error #4, sitting in the prompt as the
pattern to imitate. The product manager approved changing it and adding one
sentence forbidding self-derived counts, **subject to approving the exact
wording before it lands.** Touching this instruction is not licence to retune
the 50-word tip budget, which is its own open question.

## How it has to be verified

- Two new bench cells, `allfields-s4` and `popup-s4`. Those two goals have never
  been measured by anything, which is exactly why their thresholds could sit
  uncounted this long. Shipping the fix without them measures four goals and
  guesses at the two it most affects.
- Baseline round and after round, scored as **accuracy per attempt at a named
  threshold**, not as an overall debrief error rate. The prediction is specific
  and therefore testable at this sample size; a 1-in-12 global rate is not.
- Live API spend, to be scoped with the product manager before anything runs.

## Still not in scope, and where each belongs

- **The coach never receiving the tips it just gave** (original item 1). A
  chat-prompt problem; belongs with a chat-context slice.
- **The two model fields that can blank the screen** (original item 4). Crash
  safety, not accuracy; belongs beside Slice 5's failure vocabulary.
- **The three disagreeing "hard contact" numbers**, 88 on the stat tiles, 85 on
  Contact, 82 on Hit to All Fields. Already its own queued item. This slice
  reads what each goal already says and changes none of them.

---

# Slice 8c: finish the counting rule, and fix the tool measuring it

Written 18 August 2026, from the product manager's own browser QA pass on
PR #26 across Line Drives & Contact, Reduce Pop-Ups, and Hit to All Fields.
Full findings are in the postscript on the Slice 8b entry in
`docs/product-decisions-log.md`; this heading is where the follow-on work
gets scoped so it survives the end of a chat window, the same discipline
Slice 8b itself was written under.

**Blocked on nothing.** Slice 8b is merged. This can start whenever the
product manager wants it scheduled.

**Shipped 19 August 2026.** All five pieces landed: the zone count lines,
the fly-ball 18 fix, the "1 swings" grammar fix, the grading tool's
goal-aware fact sheet fix, and the handed-versus-derived measurement. The
result is a split, not a clean win: the raw grader flags looked worse (15 of
52 debriefs before, 21 of 52 after), but hand-checking every flag found the
grading tool itself responsible for most of the apparent decline, and
corrected for that, genuine coach errors actually fell (13 to 11 overall,
6 to 3 on the pitch-location claims this slice targeted). What is left of
the pitch-location gap is narrower than before: the coach now holds the
right whole-session total and only gets it wrong when intersecting that
total with a different named group of swings, an intersection between two
handed counts rather than a number invented from nothing. Piece 5's number
is recorded separately below, since it reopens a decision this document
already scoped. Full numbers, the hand-check, and every caveat are in the
decision log entry for 19 August 2026 and in
`docs/eval-fixtures/slice8c-strike-zone-counts/README.md`.

**Correction, 19 August 2026, from Slice 8d.** The "13 to 11" figure above
is off by one. Slice 8d replayed this slice's stored grading data through a
fixed grading tool and found the after round's "none of them cracked 88
mph" claim was itself a grading-tool false positive, not a genuine coach
error; the corrected comparison is 13 to 10. The pitch-location figure, 6
to 3, is unaffected. See the decision log's Slice 8d entry and
`docs/eval-fixtures/slice8d-grader-fp/README.md`.

## What it is, in one line

Finish applying Slice 8b's own rule, count every threshold the prompt names,
to the one dimension it deliberately skipped, clean up one grammar bug the
rule's own count lines introduced, close a small wording gap the rule made
loud, and fix the measuring tool so the next comparison is trustworthy.

*Amended 19 August 2026:* a fifth piece was added, measuring how often the
coach contradicts a count it was handed rather than one it worked out for
itself. It costs nothing extra to run and it is what decides a larger
question this project has deliberately parked; both are below.

## The five pieces

1. **Align the fly-ball wording from 20 degrees to 18.** Line Drives &
   Contact's target band is 8 to 18 degrees, the single source in
   `src/goalTargets.js`. The coach's own instructions still say "angles above
   20 degrees are fly balls, not line drives," which leaves 18 to 20 degrees
   counted by neither number. Approved 18 August 2026. Deliberately not done
   in Slice 8b, because that slice's measurement rounds were run against the
   20-degree wording and changing it after the fact would leave the committed
   evidence describing a prompt that no longer ships.
2. **Count the strike-zone thresholds, so the coach stops inventing
   pitch-location groupings.** The prompt already hands the coach the
   strike-zone bounds and a total count of pitches in the zone, but never
   which specific swings were outside it, so the coach works that out for
   itself and gets it wrong at a measured 11-in-11 rate, unchanged by Slice
   8b. This is the same mechanism Slice 8b fixed for launch angle and exit
   velocity, applied to the one dimension that slice deliberately left
   uncounted. Reproduced twice independently: once by the coordinator on a
   Power debrief, once by the product manager on a Reduce Pop-Ups debrief,
   both times naming the same swing (4) as wrongly grouped.
3. **Fix the "1 swings" grammar.** Slice 8b's generated count lines read
   "1 swings" whenever a count is exactly one, seen on the Reduce Pop-Ups
   weak-grounder line. Invisible to a visitor, cheap to fix alongside the
   other two prompt changes above.
4. **Re-measure with the existing bench and grader, once the grader's own
   Power-stat leak is fixed first.** `scripts/factSheet.js`'s
   `sessionStatsExtras` still emits the old Power-only stats for every goal
   and has no matching stat for any of the five new count lines Slice 8b
   added to Contact, Hit to All Fields and Reduce Pop-Ups. That gap is what
   produced Slice 8b's own false-positive flags when the grader checked a
   correct new-format count against the wrong old stat. **This fix must land
   before the re-measurement runs, not be discovered mid-comparison the way
   it was in Slice 8b.** Doing it in the other order is exactly what forced
   Slice 8b's after-the-fact correction pass; this slice should not repeat
   that mistake. Once the fact sheet has one matching stat per count line the
   prompt can now hand the coach, re-run the bench's six cells before and
   after this slice's three prompt changes for a clean comparison.

5. **Measure how often the coach contradicts a count it was handed.** Added
   19 August 2026, from the conversation that closed Slice 8b. Every rate
   this project has measured so far is about numbers the coach worked out
   for itself. Nobody has ever measured the other failure: the coach holding
   a correct count and stating a different one anyway. It is known to happen,
   because Slice 8b's QA pass caught one, and it is known to be rare, because
   all eight measured Hit to All Fields debriefs in that slice's after round
   stated their counts correctly. Beyond that there is no number. This costs
   nothing extra to measure, since the before-and-after rounds in piece 4 are
   already being run and graded; what it needs is for the grading pass to
   separate the two kinds of wrong claim rather than pooling them. Why it
   matters is in the next section.

## Why these pieces travel together

All three prompt changes (1 to 3) are small, but each invalidates a
before/after comparison run before it landed, the same way Slice 8b's own
count lines invalidated part of its own measurement. Shipping them one at a
time means paying for a bench-and-grader round after each one; shipping them
together means paying for one clean round that measures all three at once.
The grader fix (4) has to be first regardless of when the prompt changes
ship, because measuring against a broken fact sheet is what created the
problem this slice exists partly to clean up.

## The decision piece 5 exists to inform: whether the app should write the numbers itself

Recorded 19 August 2026. This is a decision **not** to build something yet,
written down so nobody re-proposes it cold and nobody mistakes the delay for
an oversight.

The problem it would solve is the one piece 5 measures. Every lever this
project has pulled at the coach so far is persuasion: the prompt asks for
good behavior and gets it at a high rate, never at exactly every time. A
count the coach already holds can still come out wrong, which is what
happened on Hit to All Fields, and no sharper wording closes that, because
wording was never what was binding.

The approach that would actually close it is to stop letting the model write
the figure at all. The coach would produce the sentence with a gap in it and
the app would fill the number in from the real data, so the model keeps the
voice, the judgment and the coaching, and the code owns every digit. For any
number handled that way a contradiction stops being unlikely and starts being
impossible.

**Deliberately not being done now, and the reasoning is a product judgment
rather than an engineering one.** It only covers figures the app knows to
anticipate, and it makes the coach's prose more rigid in exactly the places
it currently sounds most like a person. That voice is a real part of what
this demo exists to show. One wrong sentence caught by hand is not enough
evidence to spend it. The product manager delegated the call and this is the
recommendation he accepted on 19 August 2026.

**The trigger for revisiting is piece 5's number, and the rough rule agreed
in advance so the decision is not re-argued from scratch.** If the coach
contradicts a handed count at something like one debrief in fifty, fill in
the counts the app already computes and accept the loss of some voice. If it
is closer to one in several hundred, leave it alone, keep measuring it, and
spend the effort on the pitch-location gap in piece 2 instead, which is
known to be the larger source of wrong claims.

A weaker middle option was considered and rejected in the same conversation:
checking the finished debrief in code before showing it and regenerating when
a stated count disagrees with a handed one. Rejected because the matching is
brittle against ordinary English ("once", "a single swing", "just one"), it
adds a second model call to the slowest screen in the app, and this project
has already measured that this style of checking raises false alarms.

**Measured 19 August 2026, in Slice 8c itself: the trigger has fired.**
Pooled across the slice's two 52-debrief before/after rounds (104 debriefs
graded), the coach contradicted a number it had been handed directly on 4 of
them, roughly one in 26. That is on the "build it" side of the rule above,
worse than the one-in-fifty trigger, not close to the one-in-several-hundred
"leave it alone" reading. The honest caveat: three of the four are the
identical failure shape, reciting two adjacent prior-session averages in the
wrong order, so four events is thin evidence for a precise rate. **This
slice does not decide the question; it only supplies the number the decision
rule above was waiting on.** Whether to build the fill-in-the-numbers
approach is now live for the product manager, not parked. Full numbers in
the decision log entry for 19 August 2026 and in
`docs/eval-fixtures/slice8c-strike-zone-counts/README.md`.

## What this does not claim

Pre-counting the strike-zone thresholds is expected to cut the pitch-location
miscount rate sharply, the same way it cut the launch-angle and exit-velocity
miscount rate in Slice 8b. It should not be assumed to eliminate it. Slice
8b's own postscript found a case, on Hit to All Fields, where the coach
contradicted a count it had been handed directly rather than derived itself.
This slice's success measure is a lower rate, not a zero.

## Budget

Needs a fresh spend conversation before any live API calls, the same
discipline Slice 8b's budget followed. A full bench-and-grader round cost
roughly $0.63 to $0.91 to generate and $0.28 to $0.30 to grade in Slice 8b;
this slice needs at least two such rounds (before and after), plus the
factSheet fix costs nothing to run since it changes no prompt.
