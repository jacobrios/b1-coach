# CLAUDE.md: b1-coach

Project-specific rules and context. The standing rules in the user-level
CLAUDE.md apply here and are not restated. This file covers only what is true of
b1-coach specifically.

Written 30 July 2026, after the project already existed. b1-coach predates the
practice of writing this file first, so treat anything here as describing the
code as found, not as a design that was planned up front.

---

## What this is, and who it is for

An AI coaching layer over TrackMan B1 baseball hitting data. TrackMan already
does collection and visualization well; this is the interpretation layer. It
takes per-session hitting metrics and delivers them the way a coach would after
batting practice: a few specific observations grounded in the real numbers, two
concrete tips, and a conversational coach the player can ask follow-ups.

**Mode: proof of concept, publicly deployed as a portfolio piece.** This is not
production software and should not be built as though it were. It is not a
throwaway either. It lives at https://b1-coach.vercel.app, and a stranger's
first click is the entire downside risk of the project, so reliability on that
first click matters more here than it normally would this early.

The audience is people deciding whether to hire the author, across a wide range.
Principal-level product roles where he would build prototypes and MVPs himself,
with an engineer gut-checking the work. Product leadership roles, up to VP, where
the job is to lead engineers credibly rather than to write code. Some readers
will be engineers, some product leaders, some neither.

The author is a product manager, is not trying to become an engineer, and cannot
defend this code line by line. What he can defend is the process he runs, which
is the same process he would run with a team of people. That is the
differentiator, and it is what separates this work from the undisciplined output
of a weekend of prompting.

**Be careful about claiming that differentiator for this particular repo.**
b1-coach was the author's first experiment in AI-assisted coding, and its
history shows exactly that. Every commit before 30 July 2026 went straight to
main. There were no pull requests until that date, no code review, no tests, and
no project brief until this file was written, roughly three months after the app
was finished. A reviewer can confirm all of that in about thirty seconds. So
never present this repo as an example of engineering process, in its README, in
a pull request, or anywhere else.

What b1-coach does demonstrate is product judgment, and that part is real and
substantial: the design work, the prompt engineering, the use case and audience
thinking, and the reasoning recorded across all ten build sessions in
`docs/product-decisions-log.md`. That log is the artifact to point at here.

The process standard described below applies from 30 July 2026 forward, not
backward. The author's engineering process is demonstrated in later projects,
beginning with interplanetary-groups. Where that gap comes up, state it plainly
rather than smoothing it over. Being straightforward about what an early project
does and does not show is itself the honesty this file asks for everywhere else.

The deciding question for any change: **does this demonstrate sound judgment,
honestly reported, and could an engineer gut-check it in five minutes?**

This rules in:

- Reasoning recorded where a future reader will find it, in the decision log and
  in pull request descriptions. Those are deliverables here, not paperwork
  wrapped around the real work.
- Technical debt named in product language the moment it is created, including
  when it is deliberately accepted. Tradeoffs in speed, latency, and complexity
  are surfaced as decisions for the product manager, never absorbed silently. He
  cannot read the diff, so the report is the only place his judgment can be
  applied.
- A clear line between what was verified and what was assumed.
- Simple, consistent code that matches the patterns already in the file it lives
  in.
- Careful handling of what a reviewer checks first: secrets, failure states, and
  anything a stranger hits on a cold click.
- Refactoring, tests, and QA tooling when there is a product reason for them: a
  better experience for the user, faster or safer future changes, less QA
  burden, lower cost. These are not indulgences on a proof of concept, they are
  how it stays workable. Propose them as their own slice, with the reason
  stated, rather than folding them into unrelated work.

This rules out:

- The same work with no stated product reason. "It would be cleaner" is not a
  reason. Sophistication the author cannot explain is a liability in an
  interview, not an asset.
- Doing any of it silently inside an unrelated change. A refactor worth doing is
  worth proposing, so the product manager can decide whether it is worth the time
  now or belongs on the debt list.
- Scale, multi-user support, and real persistence. None of it matters here.

The failure mode to avoid, in the author's words, is AI slop. Concretely in this
repo that means: code with no recorded reason for existing, patterns that
contradict each other from file to file, dead code left behind, documentation
claiming more than was checked, and half-built features nobody ever decided to
stop building. Each one is visible to a reviewer, and each is prevented by
process rather than by talent.

## Plugins in play

Superpowers (user scope) is active. Where it owns a process this project also
touches (test-driven development, verification before completion, requesting
code review, writing and executing plans, finishing a branch), follow the
plugin's version. Do not silently reconcile two sets of process rules.

## Which `.claude/` files are shared

Settled 31 July 2026, matching the convention in the safety-nets template and in
the owner's other projects.

- **`.claude/settings.json` is committed and shared.** It carries the hooks, which
  are part of how this project is built and should apply to anyone working on it.
- **`.claude/settings.local.json` is machine-specific and untracked.** The
  `.local` suffix means exactly that by convention. It was untracked in PR #3 on
  30 July 2026 and `.gitignore` covers it by name. It holds a permissions
  allowlist and nothing sensitive, which is why the history was left as it is
  rather than rewritten.

The `.gitignore` rule is deliberately narrow: a broad `.claude/` entry would also
swallow the shared `settings.json` and the hooks. Do not widen it.

## Hooks in play

Added in Slice 3, adapted from `~/.claude/templates/project-safety-nets/`. Both
are wired in `.claude/settings.json`, which is committed.

- **Before every edit**, `protect-paths.mjs` blocks any `.env` file and allows
  `.env.example`. The template's Prisma migration protection was dropped: this
  project has no database.
- **After every edit that is not Markdown**, `run-tests-unless-docs.mjs` runs
  `npm test` and hands a failure back as hook feedback, so a broken suite
  surfaces at the edit rather than at the pull request.

A hook changed in this repo that is not specific to this repo should be copied
back to the template, or the template becomes the oldest version rather than the
best one.

## Stack

React 19.2 + Vite 8. Recharts 3.8 for all charts. react-markdown 10 for coach
message formatting. Anthropic API via a single Vercel serverless function.
No database, no auth, no backend state of any kind.

**Styling is inline style objects, not Tailwind.** Tailwind is installed and
imported in `src/index.css`, but the codebase uses it almost nowhere: roughly 3
`className` uses against roughly 198 inline `style={{...}}` objects. The README
and the decisions log both advertise Tailwind, which overstates it. Match the
surrounding code and write inline styles. Do not introduce Tailwind classes into
a file that does not already use them, and do not "migrate" anything to Tailwind
as a side effect of other work.

## Where things live

    src/App.jsx             1011 lines. Screen routing, player and session state,
                             synthetic swing data generation, debrief orchestration.
    src/DebriefScreen.jsx   1433 lines. The results screen, all six chart
                             components, and the chat panel.
    src/LiveSessionScreen.jsx 517 lines. Animated incoming swing data.
    src/coachApi.js          263 lines. System prompts, the goal-context block both
                             prompts share, response parsing, and the two calls.
    src/chartSlots.js         61 lines. Which charts can render, how a slot is
                             filled when the model names one that cannot, and
                             whether a single key from a chat reply is usable.
    src/goalTargets.js        56 lines. What each goal asks of a swing. The single
                             source for every launch angle and exit velocity target.
    src/sessionStats.js       31 lines. The numbers a session is summarized by.
    api/coach.js              95 lines. The serverless proxy. See the trap below.
    *.test.js                583 lines across five files, beside what they test.

The two big files are big. Navigate them by line reference rather than reading
them whole; reading either in full costs a large share of a context window for
little return.

`chartSlots.js` and `sessionStats.js` were carved out of the two big files in
Slice 3 so their logic could be tested without loading Recharts and a DOM.
`goalTargets.js` was added in Slice 4 for the same reason and to end a drift, and
`topExitVelocity` moved into `sessionStats.js` in Slice 4 because a test needed
it. Do not move anything else out on the same excuse without a test that needs it.

**`goalTargets.js` is the single source for what a goal asks of a swing.** Every
launch angle and exit velocity target reads from it: the goal cards in `App.jsx`,
both coach prompts in `coachApi.js`, the band in `ScatterEVLA`, the outcome
colouring in `PitchLocation`, and the swing-card highlighting in `SwingTicker` on
the live session screen. Before Slice 4 those were **six** separate copies and
they had already drifted apart. Do not write a goal threshold anywhere else.
The sixth was found by review, after the first version of this section claimed
five: `LiveSessionScreen.jsx` held its own `LA_ZONE_MIN`/`LA_ZONE_MAX` of 25 and
35, under a comment calling it "the chosen goal" while ignoring the goal
entirely. If a future session goes looking for stragglers, grep for bare
`const` numbers as well as comparisons; that is what the first sweep missed.
A goal with no target is represented by absence, not by zeroes, because telling
"aim for nothing" apart from "aim at zero" is what stops Open Session borrowing
Power's band again. Numbers that are *not* goal targets stay where they are: the
strike-zone bounds, the distance buckets, the pull and opposite-field direction
cutoffs, and the 88 mph "hard hit" highlight on the stat tiles and raw data table,
which applies to every goal rather than to one.

## The data is synthetic

There is no real TrackMan feed. All swing data is generated with `Math.random()`
in `generateSwings` at `src/App.jsx:683`. Sessions simulate improvement over time
with a 65% chance of a session trending better than the last.

This matters when judging output quality. If the coach says something that
contradicts the numbers, that is a real bug. If the numbers themselves look
implausible for a real hitter, that is the generator, not the coach.

---

## THE TRAP: local dev never runs the serverless function

`vite.config.js:14-26` proxies `/api/coach` straight to `api.anthropic.com` with
`anthropic-dangerous-direct-browser-access: true`. So in local development the
browser talks to Anthropic directly and `api/coach.js` is never executed.

**`npm run dev` cannot verify any change to `api/coach.js`.** Changes to that
file must be verified against a deployed URL, normally the Vercel preview a pull
request generates.

This is not theoretical. A cold-start failure survived eleven weeks in
production precisely because local testing never touched the failing piece and
always worked.

Environment variables differ by environment for the same reason:

- Local dev reads `VITE_ANTHROPIC_API_KEY` (used by the Vite proxy config).
- Production reads `ANTHROPIC_API_KEY` (used by the serverless function).

`.gitignore` covers `.env*` with a `!.env.example` negation. There is currently
no `.env.example` file; if one is added, that negation is what keeps it
committable. Do not remove it.

## Verification norms for this project

The user-level rules already require evidence over assertion. Two things are
specific to this repo:

1. **There is a test suite as of Slice 3, and it is narrow.** `npm test` runs
   vitest. It covers the serverless proxy's method routing, validation, and size
   cap; `callApi`'s one retry and its unwrapping of a fenced model response; the
   chart-slot fallback and dedupe; the chat reply's chart key; the goal targets
   and the coach prompt built from them; and `computeStats`. It covers **no
   screens and no rendering at all**, so a green suite says nothing about what a
   visitor sees. Never imply broader coverage than that. New behavior gets a test
   shown failing first; a test written over existing behavior is worthless until
   the thing it covers has been broken on purpose and seen to go red.
2. ~~**Some tests deliberately pin behavior that is wrong.**~~ Resolved in
   Slice 4 on 3 August 2026. All four "recorded, not endorsed" tests were flipped
   to assert the correct behavior, each seen failing against the unfixed code
   first. **There are no longer any tests pinning a known-wrong behavior**, so
   grepping for that phrase now finds nothing, and a test that looks wrong is
   now simply wrong. Kept here rather than deleted so nobody goes looking.
3. **Anything that changes the screen owes a rendered check.** Load the running
   app in a real browser and look at it. This project's whole value is what a
   stranger sees, so "the code looks right" is not evidence here, and the suite
   does not reach it.

Failure paths need to be seen failing, not reasoned about. Force the error
rather than describing what would happen.

---

## Model output drives the UI, not just the copy

The model returns JSON and parts of it select what renders. Treat every field as
a claim to be validated, never as a fact.

`generateDebrief` returns `coachingSummary`, `whatThisMeans`, `tipsIntro`,
`nextSessionTips`, and `charts`. `sendChatMessage` returns `message` and `chart`.

`charts` is an array of two plain strings naming which chart components render.
The only valid keys are:

    scatter_ev_la  trend_ev  bar_distance  spray_direction  zone_breakdown  pitch_location

`normalizeChart`, inside `resolveChartSlots` in `src/chartSlots.js`, validates the
key against `CHART_KEYS` and drops anything else, and a rejected or missing slot
is filled from `FALLBACK_CHART_KEYS` so it renders a real chart on real session
data. Landed in Slice 1 on 30 July 2026. Before that, an invented key became a
valid-looking object and failed silently twice, falling back to the label
'Chart' and to an empty "Chart renders here" box. Both fallbacks still exist in
`DebriefScreen.jsx` as a last resort, but nothing should reach them now.
Slice 4 added deduping: a key the model names *twice* used to survive twice and
draw the same chart side by side, costing the visitor one of their two charts.

~~The chat path's single `chart` key is still unvalidated.~~ Fixed in Slice 4 on
3 August 2026. `validChartKey` in `src/chartSlots.js` gates it before it can
overwrite anything. Note the prompt asks the model for "chart_key or null" and it
does sometimes answer with the *string* `"null"`, which passed the old truthiness
check. **A valid key still replaces the debrief's second chart, by design and
unchanged**; see the open question about that below.

`callApi` at `src/coachApi.js` is the single choke point for both calls, and
`parseCoachResponse` above it is where a model reply is turned into data. It
parses the reply as it stands first and only falls back to the outermost braces,
which is what lets a coach message quote a literal ``` without losing everything
after it. Anything that should apply to every model response belongs there, once,
not in both call sites.

## Deployment and cold starts

Vercel. The static app is served from a CDN and is always instant. The
serverless function sleeps when idle and takes several extra seconds to wake,
which reads to a visitor as a hang or a broken app.

The prevention is a free external uptime monitor pinging `/api/coach` every five
minutes with a plain GET, which the handler answers with a bare 200 before ever
reading the body or calling Anthropic, so it wakes the function and costs
nothing. HEAD is answered the same way, since some monitors use it instead.
Anything that is not GET, HEAD, or POST still gets a 405. Slice 2 changed the
GET from a 405 on 30 July 2026, because most monitors read anything outside the
200 range as the site being down and alert on it, which made the warmer useless
as an uptime check.

The function timeout is pinned in `vercel.json` at 60 seconds, and the repo is
the source of truth for that value: once `vercel.json` exists the file wins, so a
future reader who finds it disagreeing with anything else should trust the file.
The Vercel dashboard was set to 60 to match on 31 July 2026, having previously
read 300. Matching it changes nothing while `vercel.json` exists. It matters only
if that file ever goes missing, because the project was recreated or the repo
forked, at which point the dashboard becomes live again and should fall back to
the measured number rather than to a 300 nobody chose.

Measured on 30 July 2026 across four real sessions: a debrief takes 11 seconds on
the smallest session and 14 seconds on session 4, which is the largest one the
app can produce. A chat reply takes 6 to 11 seconds. That is what 60 seconds was
chosen against.

## Cost exposure

Spend is capped by a prepaid Anthropic balance of roughly $35 with auto-reload
off. A runaway bill is therefore impossible. The realistic bad outcome is a
drained balance and a dead demo, with no alert, discovered by a recruiter rather
than by the owner.

`api/coach.js` used to forward the request body to Anthropic unchanged, so the
caller chose the model and response length. Confirmed live on 30 July 2026: an
unauthenticated POST reached Anthropic on the project's key and was rejected only
for a missing `model` field. The key itself is not exposed; it is spendable, not
readable.

Slice 2 closed that on 30 July 2026. The function now rebuilds the payload from
scratch, keeping only the `system` and `messages` the caller sent and supplying
its own model and response length, so nothing a caller asks for can change what a
request costs. Requests that are not shaped like anything this app sends are
refused with a plain 400 before any spending: `messages` must be a non-empty
array, `system` must be a string, and the forwarded payload must be under 128 KB.
That cap is roughly nine times the largest request the app actually sends, a
session 4 debrief measured at 13.7 KB. There is still no authentication.

The model and the response length now live in two places on purpose,
`api/coach.js` and `src/coachApi.js:8-9`, because local development bypasses the
function and talks to Anthropic directly, which requires both fields in the body.
Both files say so. Do not tidy either one away.

Rate limiting was considered on 30 July 2026 and deliberately deferred. Once the
model, length, and input size are pinned server-side, the cost of any single
request is capped, but nothing caps how many requests a stranger can make,
because there is still no authentication. Accepted because the prepaid balance
means the worst case is a dead demo rather than a bill, and the realistic risk
to a portfolio piece is an accident or a curious engineer rather than an
attacker. The trigger for revisiting is the balance moving faster than the
owner's own use explains. Do not build rate limiting without that signal.

---

## Deliberate decisions, do not "fix" these

- **Em-dashes in the coach's voice are accepted.** Both system prompts say
  "Never use em-dashes" and the model ignores it. The user-level ban governs the
  product manager's own writing, not B1's character voice. A stripping fix was
  considered and rejected on 30 July 2026: it adds a place the rewrite can go
  wrong for no product gain. The ignored prompt line stays as-is.
- **Sonnet, not Opus.** Switched during session 10 for latency and cost, with no
  meaningful quality loss on this structured task. Set via the `MODEL` constant
  in TWO places since Slice 2: `src/coachApi.js:8` is what local development
  runs on, `api/coach.js` is what production actually sends. Change both or
  local development silently tests a different model than production ships.

## Known debt and open questions

- ~~`src/App.jsx:692-694` claims variance shrinks to 87% / 75% / 65%.~~ Half
  resolved in Slice 4 on 3 August 2026: the comment was corrected to describe the
  formula, which yields 100% / 95% / 90% with a floor that never binds. **What is
  still open is the product question the wrong comment was hiding**: variance
  barely shrinks at all across the four sessions, so the demo shows less
  session-over-session improvement than the comment's author evidently intended.
  Retuning it is on the What's Next list.
- ~~`.claude/settings.local.json` is tracked. Normally machine-local. Raised on
  30 July 2026, deliberately left alone, still unanswered.~~ Settled 31 July
  2026; see the settings convention above. This entry was already stale when
  written: the file was untracked in PR #3 on 30 July, and this bullet was left
  saying otherwise, which then got repeated in the Slice 3 pull request as an
  open question that was not open.
- ~~The chat path's single `chart` key has the same unvalidated-model-output
  problem the debrief path had before Slice 1.~~ Fixed in Slice 4 on 3 August
  2026. **A different question came out of verifying it and is open**: a chart the
  coach names *validly* still replaces the debrief's second chart. Observed live,
  not reasoned about: asking "what should I work on first next round?" on a Power
  debrief silently swapped Pitch Location for Exit Velocity Trend. The visitor
  asked a question and lost a chart, with no way back, which is the same complaint
  the invented key caused. Left alone deliberately because changing it is a
  product decision about what a chat reply is allowed to do, not a correctness
  fix. On the What's Next list.
- A "whole site shows up blank" symptom has been reported but never reproduced.
  It is distinct from the silent-placeholder cold start. Do not fold the two
  together without evidence.
- The 2.8 MB handoff zip was removed from the tree on 30 July 2026 but remains
  in git history. A history rewrite was considered and deliberately rejected.
- ~~This project has no test suite, no hooks, and no committed reviewer
  config.~~ Resolved for tests and hooks in Slice 3 on 31 July 2026; see the
  verification norms above. **There is still no committed reviewer config**, so
  every code review in this repo is a session choosing to run one.
- ~~Six known-wrong behaviors are deliberately unfixed, proposed as a correctness
  slice on 31 July 2026.~~ All six fixed in Slice 4 on 3 August 2026: the chart
  slot dedupe, `computeStats` returning `NaN`, both markdown-fence faults, the
  `-Infinity` top exit velocity, and the goal thresholds disagreeing across five
  places. Each of the four that carried a test had it flipped in the same commit,
  seen red first; the two that carried none got new tests, which meant moving
  `topExitVelocity` out of `App.jsx` so it could be reached.
- ~~The strike-zone rule, the distance buckets, and the goal thresholds are each
  written out in two or three places that must agree.~~ The goal thresholds were
  consolidated into `src/goalTargets.js` in Slice 4, because they had already
  drifted. **The strike-zone bounds and the distance buckets were deliberately
  left alone** and are still written out six times and three times respectively.
  They agree today, rechecked 3 August 2026. This leaves the project with one
  consolidated pattern and two unconsolidated ones, which is a slightly confusing
  state to read; that is a known cost of not widening the slice. Still only worth
  doing if a third drift shows up.
- Chat history inside a session grows without bound, roughly 0.9 KB per turn on
  top of a 13.7 KB session 4 debrief. The 128 KB request cap leaves room for
  well over a hundred turns, so nothing a real visitor does should reach it, but
  the growth itself has no ceiling of its own.
- Vercel Deployment Protection redirects every preview request to a Vercel login,
  so nothing in `api/coach.js` can be verified against a preview URL while it is
  on. This project's plan has no "protect production only" option, so the only
  lever is the Require Log In toggle in Project Settings, Deployment Protection.
  Slice 2 verified against the preview by turning it off for a few minutes and
  back on afterwards. Expect to do the same for any future server-side slice.

## What's next

The running list of work this project knows it wants and has not done. It is
here rather than in `docs/` on purpose: this file loads at the start of every
session, so a fresh session sees the list without the product manager having to
remember it. Added 31 July 2026, after work started slipping between sessions.

**A slice is not done until this list is updated**: the slice's own entry comes
off, and anything the slice surfaced goes on. Keep each item to a line or two in
product language, with enough to judge it cold. The section above is problems;
this section is intended work. An item can appear in both.

### Parked at Slice 4 close, 3 August 2026

The four questions Slice 4 put to the product manager. All four were **parked
deliberately**, not forgotten and not deferred for lack of time: the owner's
other project is heading for an MVP, and this one goes on the shelf until that
ships. Nothing here is blocking, and none of it should be picked up as filler
work. Each is written to be actionable cold, because the session that picks it up
will not have been the session that found it.

1. **Decide what a chat reply is allowed to do to the debrief's charts.**
   *Open, needs a product decision.* Surfaced by verifying Slice 4, not predicted
   by its plan. The debrief shows two charts. When the coach names a chart in a
   chat reply, that chart overwrites the second one for the rest of the session,
   with no way back to the original pair. Slice 4 stopped *invented* chart names
   from doing this (`validChartKey` in `src/chartSlots.js`); a **valid** name
   still does, by design and unchanged. Reproduced live, not reasoned about:
   asking "what should I work on first next round?" on a Power debrief silently
   replaced Pitch Location with Exit Velocity Trend. The visitor asked an
   ordinary coaching question and lost a chart they were reading. Options: add a
   third slot, offer a way back to the original two, or decide this is correct
   and say so on purpose. The mechanism lives at `onChartSignal` in
   `src/DebriefScreen.jsx` and the state write in `src/App.jsx`. **This ships in
   Slice 4 as a known limitation** and is named as such in that slice's PR.
   Strongest candidate of the four when work resumes, because it is the only one
   a visitor actually hits.

2. **The Reduce Pop-Ups goal card still reads `LA < 0° ↓ · Drive more`.**
   *Open, needs a copy decision, then a one-line change.* Slice 4 changed the
   Power and Contact card tags to read from the shared targets, which is what its
   plan named. Pop-Ups was left alone because its tag is not a numeric range in
   the same shape. But it does not describe the goal's actual 10-25 degree target
   either, and read literally it points the opposite way (a pop-up is a *high*
   launch angle, so "LA < 0°" is backwards). The tag is in the `GOALS` array in
   `src/App.jsx`; `launchAngleRangeLabel('popup')` in `src/goalTargets.js` already
   returns `10–25°` if a numeric range turns out to be what is wanted. Needs
   someone to decide the wording first.

3. **Hit to All Fields draws orange pull-side dots. Confirmed intended, no change
   needed.** Raised because Slice 4's own verification step said "no orange at
   all" for that goal, and the Slice 4 review flagged that a literal reader would
   trip on it. Resolved: the orange belongs to the Pull / Center / Oppo spray
   legend on `PitchLocation`, which is direction colouring and has its own visible
   key. It is **not** target or outcome colouring, and Hit to All Fields correctly
   shows no band and no hit-or-miss styling. Recorded so nobody "fixes" it later:
   the verification wording was too broad, the code is right.

4. **The neutral swing styling for goals with no target. Shipping as-is, pending
   a future design pass.** Slice 4 had to choose how to draw a swing on a goal
   with nothing to aim at. Reusing the existing dimmed "missed it" grey would have
   kept the bug in a quieter form, since a whole session dimmed reads as the app
   saying every swing was bad. So swings on Hit to All Fields and Open Session are
   drawn in plain white at full strength, one treatment for every swing
   (`NEUTRAL_SWING_FILL` / `NEUTRAL_SWING_OPACITY` in `src/DebriefScreen.jsx`).
   This was an engineering judgment call inside a correctness slice, reviewed in
   the browser and considered good enough to ship, but it has **not** had a
   deliberate design pass. Not a defect and not blocking; revisit if and when the
   visual language of the charts gets looked at properly.

### Queued, not parked

Everything below predates the Slice 4 close or came out of it as ordinary work.
It is queued behind the same shelf decision, but it was never put to the product
manager as a question, so it does not carry the "parked" status above.

- **Retune how much the demo improves session over session.** Slice 4 corrected a
  comment claiming variance narrows to 87 / 75 / 65 percent across sessions 2 to
  4; the formula actually yields 100 / 95 / 90, so a visitor clicking through
  four sessions sees less of an improvement arc than whoever wrote that comment
  intended. Changing it changes how the demo feels, which is why Slice 4 fixed
  the comment and left the formula alone. Cheap to do, needs a judgment call on
  how strong the arc should be.
- **Decide whether "hard hit" should be per goal.** The 88 mph highlight on the
  AVG EXIT VELO and TOP EXIT VELO tiles and in the Raw Data table applies to
  every goal, including the two that Slice 4 just declared have no target at all,
  and including contact, whose own card reads "Hard Hit %" while the coach tells
  the player 85. Deliberately left alone in Slice 4 as a general display
  convention rather than a goal target, which is defensible, but it leaves 88
  written in three more places with nothing tying them to `goalTargets.js`.
  Raised by the Slice 4 review.
- **Show the "waking up" explanation on a timer, not only after a failure.**
  Slice 1 rejected a timer because a normal debrief takes about twelve seconds
  and a timer would have alarmed everyone. Slice 2 dropping the server's give-up
  deadline from five minutes to sixty seconds changed that arithmetic: a timer
  at roughly 25 seconds now sits well above the normal case while still
  explaining itself before the server gives up. Closes the gap Slice 1 named in
  its own pull request. The remaining candidate a visitor would most feel.
- **Say so honestly when the API balance is drained, instead of blaming the
  server.** Every failed debrief lands on the same screen: "The coach didn't
  wake up in time. This demo sleeps when idle and sometimes needs a second try."
  When the real cause is the prepaid Anthropic balance running out, that message
  is actively wrong twice over: it invites a retry that can never work, and it
  tells a visitor the demo is flaky when it is actually just unfunded. The owner
  explicitly wants the honest version, roughly: the demo is out of API credits
  and they will be reloaded soon. Confirmed feasible on 12 August 2026:
  `api/coach.js` forwards Anthropic's status and error body to the client
  unchanged, so the client can tell a balance error apart from a timeout. The
  detail is currently lost in three places, in order: `callApi` in
  `src/coachApi.js` throws away the response body and keeps only the status
  code, which cannot distinguish out-of-credits from any other refusal, and then
  the catch in `runDebrief` in `src/App.jsx` and the chat catch in
  `src/DebriefScreen.jsx` discard even that. The same failure in chat shows
  "Sorry, I couldn't connect right now. Try again in a moment.", which mislabels
  it the same way. Verifying the failure path means forcing a real
  balance-style error, not reasoning about it. Raised 12 August 2026. This is
  already built and shipped on interplanetary-groups, where a failed model call
  is classified as out of credits or the service having trouble, never one
  blamed for the other; borrow that settled pattern rather than inventing a new
  one here.
- **A committed reviewer config.** Slice 3 added tests and hooks but not this,
  so every code review here is still a session choosing to run one. Reviews have
  found real defects in each of the last two slices, which is the argument.
- **Consolidate the rules that still exist in several copies.** The strike-zone
  boundary lives in six places and the distance buckets in three. They agree
  today, rechecked 3 August 2026. The goal thresholds were the same shape of
  problem, had already drifted, and were consolidated in Slice 4, which leaves
  these two as the odd ones out. Still worth doing only if a third drift shows
  up; otherwise it is churn.
- **Rate limiting.** Deliberately deferred, see the cost section above. Only if
  the prepaid balance starts moving faster than the owner's own use explains.

Done and deliberately kept here for a while, so nobody re-proposes them: the
uptime monitor was set up on Better Stack on 31 July 2026 against both the app
and `/api/coach`; the safety-net fixes went back to
`~/.claude/templates/project-safety-nets/` the same day.

## Where decisions get recorded

`docs/product-decisions-log.md`, most recent first, written in product language.
A slice is not done until its entry is written. `docs/proof-of-concept.md`
carries the original product framing.

**Slice plans travel with the work they describe, and are never deleted.** Write
the plan to `docs/slice-N-plan.md` and leave it untracked while planning. It gets
committed on the slice branch when that work begins, and reaches GitHub only in
the pull request that carries the finished build. Never open a pull request for a
plan on its own, and never delete a plan after the work lands: kept alongside the
result, it shows what was intended next to what actually shipped, which is worth
more than either alone. This matches the convention in the owner's other
projects. Corrected on 30 July 2026, after the Slice 1 plan was committed and
then deleted, and after a standalone plan pull request was opened for Slice 2 and
withdrawn.
