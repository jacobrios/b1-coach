# CLAUDE.md: b1-coach

Project-specific rules and context. The standing rules in the user-level
CLAUDE.md apply here and are not restated. This file covers only what is true of
b1-coach specifically.

Written 30 July 2026, after the project already existed. b1-coach predates the
practice of writing this file first, so treat anything here as describing the
code as found, not as a design that was planned up front.

---

## What this is, and who it is for

An AI coaching layer over TrackMan B1 baseball hitting data. Collecting hitting
data and interpreting it are two different jobs; this is the interpretation
layer. *(Reworded 25 August 2026 in Slice 14. The old wording assessed what
TrackMan does well, which is a claim about another company's product sitting in
a public repo. See the confidentiality note on the What's Next list.)* It
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

**Clarified 25 August 2026, in Slice 13, because a session reading the rule cold
read it more broadly than it was meant.** This rule bans the *claim*, not the
*disclosure*. Naming the gap plainly and saying what was done about it later is
allowed, and is what `README.md` now does under "What this repo does and does not
show": built by feel with no tests or review in April and May, decision log kept
throughout, discipline retrofitted onto a finished app in July and August. The
test for any future wording is whether the sentence claims engineering
competence, which is forbidden, or reports a judgment call, which is the thing
this project is allowed to show. The product manager approved that framing on
25 August 2026, and its own closing line is what keeps it on the right side:
"I am not an engineer and this is not an engineering showcase."

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
  surfaces at the edit rather than at the pull request. It runs the suite from
  the project root, resolved by `project-root.mjs`, and never from wherever the
  session's shell happens to be standing; see the decision log entry for 12
  August 2026 for what that is guarding against and what it is not.
- **The hook itself has tests**, in `.claude/hooks/run-tests-unless-docs.test.js`.
  Vitest collects them from the dot-directory without any config change, checked
  12 August 2026. They inject a fake child process, so the suite never runs a
  suite inside itself; what they check is the working directory the hook hands
  over.
- **The `.env` guard has tests too**, added 14 August 2026 in
  `.claude/hooks/protect-paths.test.js`. Adapted from the template's TypeScript
  version, translated to JavaScript because this project has no TypeScript, with
  every Prisma migration case dropped exactly as the hook itself drops that half.
  It spawns the real hook as a child process and asserts on exit code and stderr,
  because "exit 2 plus an explanation" is the guard's actual contract with the
  harness; testing the regexes directly would pass while the contract was broken.
  Both directions matter and both were seen failing first: blanking the protected
  pattern turned 8 tests red, and emptying the allowlist turned the 4
  `.env.example` tests red.
- **Two limits of that guard, found by review on 14 August 2026 and recorded so
  nobody reads "tested" as "airtight."** First, it only runs on `Edit`, `Write`
  and `MultiEdit` (the matcher in `.claude/settings.json`), so an agent writing
  to `.env` through a shell command is not stopped by it at any point. That is
  the larger gap of the two and it is on the What's Next list. Second, a
  *directory* named `.env` is not protected: the pattern needs a `.` or the end
  of the string after `.env` and finds a `/` instead, so `.env/config.json` gets
  through. That one is inherited from the template, matters only if secrets ever
  move into a `.env/` folder, and is recorded rather than fixed.

The template's per-edit / end-of-task split was deliberately not adopted here.
It exists to keep an 801-test suite off every single edit; this one is 171 tests
in about a second, so the split would buy nothing and cost a second moving part.
*(Re-checked 14 August 2026 against a changed template: the suite is now 240
tests in about a third of a second, so the reasoning holds more strongly than
when it was written, and the decision was re-recorded rather than revisited.)*
*(Later the same day, at the close of Slice 6: 326 tests in about nine tenths of
a second. The decision still holds, and it is now the third time it has been
re-checked rather than revisited.)* ~~If a future session finds the suite slow
enough that a full run on every edit is painful, that is the trigger to adopt
the template's split, not a reason to weaken the hook.~~

**That "painful" line was an adjective standing in for a threshold, and nothing
could ever actually trigger on it. Fixed 14 August 2026, at the start of Slice
7.** The trigger is now a number: 10 seconds of wall clock, measured from the
moment an edit finishes to the moment the hook returns control. The reasoning:
below roughly 10 seconds, an edit-time full-suite run is a safety net people
forget is even running. Past that point the same run becomes a pause people
notice, and a noticed pause is what sends someone reaching for `--no-verify` or
a similar workaround, at which point the hook is only as good as the discipline
it was meant to remove. The split earns its extra moving part past that line,
not before it. Measured the same day: 326 tests, about 1.0 second of runner
time and about 1.5 seconds of wall clock including npm's own startup,
consistent with the "nine tenths of a second" recorded just above. That puts
the suite at roughly one seventh of the 10 second threshold, nowhere near the
point that would justify adopting the split.

**Do not switch this hook to `npx vitest run`.** Measured 12 August 2026
standing in `src/`: `npm test` ran all 171 tests, `npx vitest run` ran 127 and
reported green. npm climbs to the first ancestor holding a `package.json` **or a
`node_modules`**, which is usually the repo root, and runs the script from
there. Note the "or `node_modules`" half: an `npx` run inside `src/` leaves a
`src/node_modules/.vite` cache behind, and from then on `npm test` in `src/`
stops there and dies with ENOENT having run nothing. That trap is real; it was
hit while verifying this on 12 August 2026. It is also why the hook now names
its working directory outright instead of relying on npm to find the root.

A hook changed in this repo that is not specific to this repo should be copied
back to the template, or the template becomes the oldest version rather than the
best one.

**`.claude/safety-net-exceptions.json` is committed and records the eight
differences from the template that are deliberate**, written 13 August 2026 with
`~/.claude/bin/accept-safety-net-difference.mjs`. Each entry is pinned to the
template file as it stood that day, so the drift check re-asks when the template
moves. Do not silence a difference by editing that file by hand; use the script,
which refuses a difference that does not exist and a reason too short to read
later.

~~**One difference is deliberately left unrecorded and still reports every
session**: the template's `protect-paths.test.ts`. This project has no test at
all for its own `.env` guard, which is a gap rather than a decision, so silencing
it would have been a lie. It is on the What's Next list.~~

**Closed 14 August 2026, and the count above is now nine, not eight.** The gap
was filled rather than silenced: this project now has `protect-paths.test.js`,
described above. The difference is recorded because the drift check matches on
exact filename, so it would otherwise keep reporting that no test exists, which
became the untrue statement once the test landed. The recorded reason says the
test was adopted in JavaScript form and why. **The distinction is worth keeping
in mind for any future line: silencing a real gap is a lie, recording a genuine
difference is not, and the test for which one you are looking at is whether the
report would still be true after you silence it.**

## Stack

React 19.2 + Vite 8. Recharts 3.8 for all charts. react-markdown 10 for coach
message formatting. Anthropic API via a single Vercel serverless function.
No database, no auth, no backend state of any kind.

**Styling is inline style objects, not Tailwind.** Tailwind is installed and
imported in `src/index.css`, but the codebase uses it almost nowhere: roughly 3
`className` uses against roughly 198 inline `style={{...}}` objects. ~~The README
and the decisions log both advertise Tailwind, which overstates it.~~ **Corrected
25 August 2026, in Slice 13: only the decisions log does.** The README half has
been stale since 14 August 2026, when `README.md` was changed to read "Tailwind
is installed but used only minimally," which is accurate and was carried through
the Slice 13 rewrite unchanged. The decisions log half is still true, at
`docs/product-decisions-log.md:5`, but that is a dated historical entry the
append-only rule protects rather than a claim to correct. Match the
surrounding code and write inline styles. Do not introduce Tailwind classes into
a file that does not already use them, and do not "migrate" anything to Tailwind
as a side effect of other work.

## Where things live

Line counts current as of 20 August 2026, at the close of Slice 10, **re-measured
after that slice was rejected by its own browser QA gate and re-shipped**, so
these numbers are the second set, not the first. The rows that moved are
`coachApi.js`, `sessionStats.js`, `goalCountSpecs.js`, the `src/*.test.js`
aggregate, both `scripts/` aggregates, and the fixtures directory count, which
also gained a directory of its own. Some of the rows below that this slice never
touched are stale by a line or two, `ballFlight.js` and `DebriefScreen.jsx`
among them, and were left alone rather than churned out of lane; correct one on
the way past if you open the file for another reason.

**Re-measured 21 August 2026, at the close of Slice 11.** The rows that moved,
and only these were re-counted: `src/swingGenerator.js` 180 lines to **1474**,
which is the slice in one number, since the rewrite is far more comment than
code and the file now explains every constant beside itself;
`src/swingGenerator.test.js` to **1558**; `src/ballFlight.js` 228 to **312**,
comments only, no behaviour touched anywhere on the branch;
`src/coachApi.js` 643 to **667**; the `src/*.test.js` aggregate to **4762**
across twelve files; `scripts/*.mjs` to **8276** across eight, and the biggest
single mover in there is `measure-swing-generation.mjs` at 3372, which is the
slice's actual evidence base; the tested `scripts/*.js` modules to **3674**
across eight; `scripts/*.test.js` to **2319** across eight; and the
`docs/eval-fixtures/` directory count to **ten**, not nine. Everything else
below is as Slice 10 left it and was not re-counted.

    src/App.jsx             1029 lines. Screen routing, player and session state,
                             and debrief orchestration. The fifteen hand-written
                             session-1 swings moved out to src/sessionOneSwings.js
                             in Slice 7b; swing generation moved out in Slice 6.
    src/sessionOneSwings.js   77 lines. The fifteen hand-written swings of the
                             scripted first session every visitor sees, extracted
                             from App.jsx in Slice 7b so a plain Node script can
                             finally read them. See the bench section below for
                             why that mattered. Slice 9 replaced all fifteen
                             values (the straight-line problem, closed 19 August
                             2026) and rewrote the header comment to say what
                             they are now calibrated to. The two sums, 1224 of
                             exit velocity and 260 of launch angle, are the
                             invariant every generated session depends on and
                             must never be hand-edited. The file's own header
                             says why; the reasoning is in `docs/slice-9-plan.md`
                             and the decision log entry for 19-20 August 2026.
    src/DebriefScreen.jsx   1602 lines. The results screen, all six chart
                             components, the chat panel, the session summary's
                             scroll fade, and the shared axis-text style
                             constants, both added in Slice 7.
    src/LiveSessionScreen.jsx 520 lines. Animated incoming swing data.
    src/coachApi.js          643 lines. System prompts, the length budget
                             appended to the debrief prompt, the goal-context
                             block both prompts share, response parsing,
                             failure classification, the retry policy, and the
                             two calls. Slice 7 exported `DEBRIEF_SYSTEM_BASE`,
                             `lengthBudget`, `DEBRIEF_BUDGET`, `DEBRIEF_SYSTEM`,
                             `MODEL` and `MAX_TOKENS` so the bench can send the
                             real prompt rather than a copy of it. Slice 7b
                             changed two sentences inside it; see the decision
                             log entry for 17 August 2026. Slice 8b added the
                             per-goal count lines and two more approved
                             sentences; see the decision log entry for 18
                             August 2026. Slice 8c added four zone count lines
                             (which swings sat outside the strike zone, and
                             which way each was off) built from
                             `pitchZoneBreakdown`, and fixed the "1 swings"
                             grammar across every generated count line; see
                             the decision log entry for 19 August 2026. Slice 10
                             added `DIRECTION_KEY_LINE`, one exported constant
                             telling the coach which sign of the spray direction
                             means pull, interpolated immediately above the
                             individual-swings line in BOTH prompts, and stopped
                             the Power below-15 count line dangling a
                             "numbers:" clause on a zero count; see the decision
                             log entry for 20 August 2026. **That first version
                             of the direction key was rejected by the product
                             manager's browser QA pass and never shipped**: it
                             said "negative direction is pull side," which
                             disagreed with the spray chart on the same screen.
                             What shipped instead, the same day, is:
                             "- Direction key: below -15 degrees is pull side,
                             above +15 degrees is opposite field, -15 to +15 is
                             up the middle." Plus
                             `sprayCountLines`, three pre-counted spray lines
                             per session that now appear on EVERY goal in BOTH
                             prompts, all of it reading `SPRAY_CUTOFFS` from
                             `sessionStats.js`. See the second decision log
                             entry for 20 August 2026.
    src/goalCountSpecs.js    150 lines. One table, per goal, of every threshold
                             that goal's coaching prose names in words, so the
                             sentence and the count that feeds it cannot drift
                             apart. Added in Slice 8b, re-exported from
                             `coachApi.js` so the prompt-building code and any
                             future script read the same source. Slice 8c added
                             `goalCountValues`, the one computation behind every
                             count both the prompt and the grader's fact sheet
                             now read, and moved Contact's fly-ball cutoff from
                             20 to 18 degrees so it matches the goal's own band
                             ceiling instead of leaving 18-to-20 uncounted.
                             Slice 10 stopped the Hit to All Fields entry
                             writing -15 and +15 itself and made it read
                             `SPRAY_CUTOFFS` from `sessionStats.js`, so the
                             goal's own prose and the new universal spray lines
                             cannot disagree. That disagreement is exactly the
                             defect the browser QA gate rejected the slice over.
    src/ballFlight.js        228 lines. How far a struck ball carries, the five
                             distance buckets the chart and both prompts share,
                             and the spray chart's distance-to-radius scale.
                             Added in Slice 6. See the ball flight section below.
    src/pitchChartWindow.js  181 lines. The fixed window the Pitch Location vs
                             Outcome chart draws, and what happens to a pitch
                             outside it. Added 24 August 2026 by the pitch-window
                             micro-PR, on the scrollFade.js precedent: the chart's
                             axes used to grow to fit the session, so the drawn
                             strike zone changed shape from one session to the
                             next, and that decision could not be tested while it
                             lived inside JSX. Two windows, decided in OPPOSITE
                             directions, and do not "tidy" them into one rule.
                             Sideways is a flat decision, plus or minus 1.2 feet,
                             deliberately NARROWER than the widest pitch the
                             generator can throw; widening it to cover 1.5 would
                             undo the fix and make the chevron dead code.
                             Vertically it is DERIVED from `STRIKE_ZONE` and
                             `PITCH_MISS_MAX_FEET` plus a pad, because nothing may
                             ever fall off the top or the bottom. Note this module
                             reads `STRIKE_ZONE` rather than copying it, so the
                             strike-zone census recorded further down this file is
                             unchanged at four copies in shipped code.
                             *(Grew from 94 lines to 181 on 24 August 2026, in
                             the fix round on the same change, and the reason is
                             the useful part. The first version extracted the
                             ARITHMETIC and left the RULES in the chart, so six
                             one-line edits each broke the fix with the whole
                             suite green. All six were lines in
                             `DebriefScreen.jsx` as it then stood: the tooltip
                             pointed at the clamped number; the axis pointed back
                             at the true one; the chevron branch disabled; the
                             clamp dropped; `beyond` forced to null; and the
                             chevron drawn outward into the clip. THREE of those
                             lines now live in this module (the clamp, `beyond`
                             and the chevron's direction) and are covered by real
                             tests; the other three are still in the screen and
                             are covered by text tripwires. It now
                             also owns `pitchChartRows`, which builds the chart's
                             rows and is what guarantees the tooltip reads a true
                             position; `chevronPoints`, whose inwardness is a
                             correctness property rather than a style, because
                             anything drawn past the edge is clipped away; and
                             `chevronIsOnTarget`. All six edits now turn the suite
                             red. Do not move any of it back inline.)*
    src/scrollFade.js         18 lines. Whether the session summary box's bottom
                             fade should show, as a pure function of scroll
                             position. Added in Slice 7 so the decision could
                             be tested without a browser.
    src/swingGenerator.js   1474 lines. Generates a session's fifteen swings.
                             Carved out of App.jsx in Slice 6 so the re-roll
                             could be tested. Takes an injectable random source.
                             Rewritten end to end in Slice 11 on 21 August 2026,
                             which is where the jump from 180 lines comes from;
                             most of the new length is the reasoning for each
                             constant written beside it, including a sweep table
                             showing what the alternatives cost. Read the file's
                             own header before changing anything in it, and read
                             the "data is synthetic" section below, which is the
                             product-level summary of what it now does. Its
                             constants are deliberately exported so the tests and
                             the measurement script read them rather than copies.
    src/failureCopy.js        74 lines. What the app says when a call fails. See
                             the failure vocabulary section below.
    src/goalTargets.js        66 lines. What each goal asks of a swing. The single
                             source for every launch angle and exit velocity target.
    src/chartSlots.js         64 lines. Which charts can render, how a slot is
                             filled when the model names one that cannot, and
                             whether a single key from a chat reply is usable.
    src/sessionStats.js       89 lines. The numbers a session is summarized by.
                             Slice 8c added `STRIKE_ZONE`, `inStrikeZone` and
                             `pitchZoneBreakdown`, so the prompt's zone count
                             lines, the grader's fact sheet, and the existing
                             `inZoneCount` all read the same bounds and the same
                             per-swing classification. Slice 10 added
                             `SPRAY_CUTOFFS` and `sprayBreakdown` on that exact
                             precedent, and they are now the ONE definition of
                             pull, up the middle and opposite field in the app.
                             Everything chains to them: the coach's direction
                             key, the three spray count lines in both prompts,
                             the Hit to All Fields goal prose through
                             `goalCountSpecs.js`, and the grader's fact sheet.
                             The one copy deliberately left outside is the spray
                             chart's own inline -15 and +15 in
                             `DebriefScreen.jsx`, four literals across two
                             charts; it agrees today and
                             consolidating it is recorded as debt rather than
                             done, to keep the fix out of the screen file.
                             *(20 August 2026, final review: still debt, but no
                             longer unwatched. A guard in
                             `src/sessionStats.test.js` reads the screen file as
                             text and holds all four literals to
                             `SPRAY_CUTOFFS`, so a drift turns the suite red.)*
    src/promptText.js          6 lines. One rule of prompt grammar,
                             `swingCountPhrase`, so a count reads "1 swing"
                             rather than "1 swings." Added in Slice 8c; shared
                             by `coachApi.js`'s count lines and `ballFlight.js`'s
                             distance-distribution line, the two places the
                             prompt writes a count out in words. Its own module
                             because it sits on the grader's `.js`-extension
                             import path and `coachApi.js` does not.
    api/coach.js             191 lines. The serverless proxy. See the trap below.
    src/*.test.js           5136 lines across THIRTEEN files, beside what they test.
                             Slice 10 added 373 lines across coachApi.test.js,
                             sessionStats.test.js and goalCountSpecs.test.js:
                             the direction key reaching both prompts, the Power
                             count line no longer dangling a "numbers:" clause
                             on a zero count, and then, after the QA gate
                             rejected the first prompt, the three spray count
                             lines in both prompts, their exact session-1
                             values, their counts always summing to the swing
                             count, and the drift guard proving the goal prose
                             and the universal lines cannot report different
                             pull numbers.
                             Slice 9 added 310 lines to sessionOneSwings.test.js:
                             eight invariants the rewritten fifteen swings must
                             hold, including a correlation band, a rule that
                             rules out a ramp, both sums held exactly, and a
                             pinned-seed snapshot proving sessions 2 to 4 do
                             not move.
    api/coach.test.js        532 lines, testing the serverless proxy.
    .claude/hooks/*.test.js  279 lines across two files, testing the hooks. Not
                             counted in the rows above.
    scripts/*.mjs           4625 lines across seven hand-run scripts, deliberately
                             outside the test runner: the two Slice 6 measurement
                             scripts, the Slice 7 bench, the Slice 7b before/after
                             comparison script, the claim-accuracy grader
                             (`scripts/grade-coach-accuracy.mjs`), added in
                             Slice 7b and rebuilt in Slice 8 so the model only
                             extracts claims and never issues a verdict; Slice 8b
                             gave it an `--input <dir>` flag so it can grade a
                             fresh directory of bench records instead of only the
                             committed fixture. Slice 8c gave it a `--handed-era
                             slice8b|current` flag, so a claim is graded against
                             the count lines the prompt generation that produced
                             it actually shipped, and the grader's own extraction
                             prompt learned to tell a strike-zone count from a
                             goal's own launch-angle target window. Slice 8d made
                             the module importable, a guarded entrypoint so a
                             script can load its cell table and session builders
                             without triggering a CLI run, and made its saved
                             output self-describing: `--out` now writes a
                             `{ meta, results }` file naming the era, seed, model
                             and builder a run was graded under, so a committed
                             result can prove from itself which prompt
                             generation it graded; files saved before 19 August
                             2026 stay bare arrays. The same slice taught the
                             extraction prompt to structure a negated "none of
                             them broke X" sentence correctly instead of
                             flipping it to the complement. The sixth script,
                             `scripts/replay-grading.mjs`, added the same slice,
                             re-runs a saved grading file's stored claims
                             through today's verdict code at zero cost and no
                             network call, so a past grading round can be
                             re-checked for free. See below and
                             the bench section further down. (Corrected here: this
                             line undercounted at four scripts through Slice 8;
                             the fifth, `show-parse-failure-before-after.mjs`,
                             existed since Slice 7b and was missed.) The seventh,
                             `scripts/search-session-one-swings.mjs`, is Slice 9's:
                             a seeded search for fifteen replacement swings under
                             every settled constraint, so session 1's numbers are
                             reproducible rather than a set that appeared once.
                             Note where the judgment sits: the constraints came
                             from the 65/35 rule, but which candidate wins is
                             decided by `believabilityScore` in that file, which
                             weights distance-bucket shape and how many genuinely
                             weak swings a session should hold. The counts are
                             derived; the particular fifteen are taste, scored.
                             The same slice taught the grader two things it did
                             not know: which fifteen swings a saved round of
                             debriefs was actually written about (a third
                             builder, `slice9-before`, reading the frozen
                             snapshot under `docs/eval-fixtures/slice9-session-
                             one/`), and which seed it was run at, both read from
                             a `BUILDER.txt` committed beside the round and
                             refused rather than obeyed when a passed flag
                             disagrees. The bench grew a seventh cell,
                             `contact-s1`.
    scripts/*.js (tested)    1175 lines across seven small modules pulled out of
                             those hand-run scripts so their pure logic can be
                             checked without spending money: `factSheet.js`
                             (254 lines; the
                             grader's deterministic count table, made goal-aware
                             in Slice 8c so it stops handing every goal Power's
                             stats and now covers pitch location too; Slice 10
                             gave it three spray rows from `sprayBreakdown`, in
                             the same change that added the count lines, because
                             a new count with no matching row here is exactly
                             what manufactured Slice 8b's false positives. Those
                             three rows are NOT era-gated, which is right for
                             ground truth and wrong for comparability; see
                             What's Next),
                             `contentWordOverlap.js` (the bench's restatement
                             check), `coachFailureRecord.js` (what the bench
                             keeps when a call fails to parse), `claimVerdict.js`
                             (Slice 8: every verdict the grader issues, decided
                             in plain code against the fact sheet; the grading
                             model extracts claims and rules on nothing; Slice
                             8d added a negated-exceedance guard that re-rules a
                             "none of them broke/exceeded X" claim against the
                             right bucket whenever extraction still flips it to
                             the complement comparison, proven by replaying it
                             against the two Slice 8c rounds' stored claims; the
                             guard matches by proximity in the sentence, not by
                             real clause structure, so a deliberately contrived
                             compound sentence could in principle mislead it,
                             judged low-likelihood and left as recorded debt;
                             20 August 2026 fixed the named-swing check firing
                             on an EMPTY list of named swings, which had been
                             ruling correct counts false, and replayed all three
                             Slice 9 rounds offline to show it moved exactly one
                             verdict out of 1,583),
                             `inputRecords.js` (Slice 8b: reads a directory of
                             bench records for the grader's new `--input` flag;
                             20 August 2026 gave it `classifyInputFile`, which
                             identifies each file in that directory by its own
                             contents, because Slice 9 was the first slice to
                             commit grading output beside the bench records and
                             `--input` reads every `.json` it finds. Bench
                             records are graded, grading output is set aside by
                             name in the run header, and an unrecognised file is
                             refused rather than guessed at. The crash that
                             exposed this was the lucky half; a pre-19-August
                             bare-array grading file would have been merged in
                             silence and billed as coach prose),
                             `handedCounts.js` (171 lines; Slice 8c: describes, per
                             goal and per prompt era, which counts the coach was
                             actually handed, so the grader can tell a
                             contradicted handed number apart from a self-derived
                             one instead of pooling both as one error rate;
                             Slice 10 taught it that direction counts are handed
                             on every goal in the current era, without which the
                             tool would have under-counted handed claims on the
                             new round and biased the after side. It also returns
                             a `sprayLines` field that nothing reads; see What's
                             Next), and
                             `gradingOutput.js` (Slice 8d: reads a saved grading
                             file in either shape, the old bare array or the new
                             `{ meta, results }` wrapper, so the replay script
                             and any future reader can open a committed run
                             without caring which slice produced it).
                             (Dated note, 19 August 2026, whole-branch review:
                             the label `handedCounts.js` computes reached the
                             grader's printed report only after a one-line fix
                             landed the same day; before that fix the report
                             silently dropped it. The committed Slice 8c rounds
                             predate the fix, so their handed-versus-derived
                             split was derived by hand, not printed by the
                             tool. See the dated note in
                             `docs/eval-fixtures/slice8c-strike-zone-counts/README.md`.)
    scripts/*.test.js       1599 lines across seven files, testing those seven
                             modules. Not counted in the rows above.
                             *(Slice 11, 20 August 2026: an eighth file,
                             `frozenGenerator.test.js`, which is not a module
                             test at all. It rebuilds every bench cell at every
                             seed through the frozen pre-Slice-11 generator and
                             holds the result against
                             `docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json`.
                             Read its header before touching anything under
                             `docs/eval-fixtures/frozen/`; if it goes red the
                             answer is never to regenerate the digest.)*
                             Two more untested modules landed in the same task
                             and belong with the row above rather than here:
                             `sessionDigest.js`, the one definition of what a
                             digest of a session is, shared by the writer and
                             the guard so the two cannot drift; and the hand-run
                             `write-frozen-session-digest.mjs`, an eighth script
                             that produced the digest once, from live code,
                             before the snapshot existed, and refuses to
                             overwrite it.
    docs/eval-fixtures/      Committed ground truth, not code. ~~Nine~~ **TEN
                             directories, corrected 21 August 2026 at the close
                             of Slice 11.** The tenth is
                             `slice11-generator-realism/` (1.5 MB): the three
                             64-debrief rounds behind this slice, one re-grading
                             of Slice 10's shipped round as the before side and
                             two fresh after rounds at two different seeds, plus
                             `HAND-CHECK.md` adjudicating every flagged claim in
                             all three. Read its README before quoting any number
                             out of it; it says in its own first paragraph that it
                             is a non-inferiority guard rather than the evidence
                             the slice worked, and that the evidence the slice
                             worked is free, deterministic, and lives in
                             `scripts/measure-swing-generation.mjs`.
                             The ninth is `frozen/` (124 KB), added in Slice 11
                             and belonging to no single round because more than
                             one round depends on it: a snapshot of the swing
                             generator as it stood at commit 53315e5, plus a
                             record of exactly what it produced for every bench
                             cell at every seed. It is what stops the five
                             rounds listed below being silently re-graded
                             against swings their coaches never saw once the
                             generator is rewritten. *(Dated correction, 20
                             August 2026, later the same day: SIX directories,
                             not five rounds. Review found that
                             `slice7-debriefs/` had the same exposure and the
                             worst consequence, since the grading tool's own
                             validation run is forced onto that fixture. It
                             reads the snapshot now and its three cells are in
                             the digest. See the correction on its row below.)*
                             The snapshot imports
                             nothing from `src/`, carrying its own frozen copies
                             of the carry formula and the goal targets, because
                             a half-frozen snapshot drifts the first time a
                             target band moves by a degree. The eight that
                             predate it:
                               `slice7-debriefs/` (360 KB) holds the 96 real
                               debriefs from Slice 7's measurement round, 8 of
                               them known wrong by hand verification, plus the
                               scripts that rebuild the session data they were
                               written about. *(Dated correction, 20 August
                               2026: "rebuild the session data they were written
                               about" was half true. `rebuild.mjs` froze its own
                               first session and then took the generator that
                               makes sessions 2 to 4 from the live app, and all
                               three of its cells are later sessions. Slice 11's
                               Task 1b repointed it at `frozen/` and put its
                               three cells in the digest. One live import is
                               left, the carry formula, because the frozen copy
                               of it sits inside a pinned hash and reaching it
                               would mean re-pinning; that residual is measured
                               in that file's own header. This is the sixth
                               exposed directory and it was found only after the
                               other five were repaired and signed off.)*
                               `slice7b-parse-failure/` (112 KB)
                               holds the before/after records behind Slice 7b's
                               parse-failure fix, 36 calls each.
                               `slice8-grader-validation/` (1.2 MB) holds the
                               grader's failed first validation run and the
                               passing run after the Slice 8 rebuild, so "the
                               grader was fixed" is checkable against what it
                               was fixed from. `slice8b-threshold-counts/`
                               (180 KB; corrected to 216 KB, 18 August 2026, after
                               the two grading transcripts were committed) holds
                               the before/after bench and grading records behind
                               Slice 8b's count-line fix, 52 debriefs each round.
                               `slice8c-strike-zone-counts/` (700 KB) holds this
                               slice's before/after: Slice 8b's after round
                               re-graded with the fixed, goal-aware tool, plus a
                               fresh 52-debrief round against the strike-zone
                               count lines, the fly-ball fix and the "1 swings"
                               fix, with every flagged claim in both rounds
                               hand-checked genuine or false positive.
                               `slice8d-grader-fp/` (664 KB) holds this slice's
                               two fresh live re-grades of the Slice 8b and
                               Slice 8c after rounds through the fully fixed
                               tool, the zero-cost offline replay of both Slice
                               8c rounds against the fixed verdict code, and a
                               by-hand check of every claim either live round
                               flagged, genuine or false positive.
                               `slice9-session-one/` (1.5 MB) holds the three
                               64-debrief rounds behind Slice 9's rewrite of
                               session 1: one against the old fifteen swings,
                               two against the new ones at two different seeds,
                               each with a committed note saying which swings
                               and which seed it belongs to, plus a frozen
                               snapshot of the old swings so the before round
                               stays gradeable, plus `HAND-CHECK.md`
                               adjudicating all 60 flagged claims one at a time.
                               `slice10-direction-key/` (1080 KB) holds TWO
                               64-debrief rounds, at the same seed and on
                               identical swing data, one prompt generation
                               apart. `after/` measured a direction key that was
                               rejected by the product manager's browser QA pass
                               and NEVER SHIPPED; it is kept because it is the
                               only measurement of the defect, and it is the
                               right comparison partner for the round that did
                               ship. `after-spray/` is the shipped prompt. Both
                               have every flagged claim hand-checked, in
                               `HAND-CHECK.md` and `HAND-CHECK-after-spray.md`,
                               and the browser capture of what the app really
                               sent sits beside them. Read the directory's
                               README before quoting any number out of either
                               round: the grading instrument was corrected
                               between them. None is collected by vitest;
                               all eight have their own READMEs covering what is
                               and is not safe to conclude from them.

The two big files are big. Navigate them by line reference rather than reading
them whole; reading either in full costs a large share of a context window for
little return.

`chartSlots.js` and `sessionStats.js` were carved out of the two big files in
Slice 3 so their logic could be tested without loading Recharts and a DOM.
`goalTargets.js` was added in Slice 4 for the same reason and to end a drift, and
`topExitVelocity` moved into `sessionStats.js` in Slice 4 because a test needed
it. `failureCopy.js` was added in Slice 5 on the same pattern, so the debrief
screen and the chat panel read one copy table instead of each carrying its own
guess. `ballFlight.js` and `swingGenerator.js` were added in Slice 6, the second
because the generator's re-roll cannot be tested while it is a closure inside a
React component. `scrollFade.js` was added in Slice 7 for the same reason: the
show-or-hide decision needed to be a pure function so `scrollFade.test.js`
could pin its tolerance without a browser. `sessionOneSwings.js` was added in
Slice 7b for a related but distinct reason: the fifteen swings were not
untestable logic, they were unreadable data, sitting inside `App.jsx`'s JSX
where no plain Node script could import them, which is what kept the eval
bench from grading the first debrief a real visitor sees. `goalCountSpecs.js`
was added in Slice 8b so the per-goal thresholds named in the coach's prose and
the count lines that feed the coach the real answer read from one table, the
same drift-prevention `goalTargets.js` already does for the numeric targets
themselves. Do not move anything else out on the same excuse without a test or
a script that needs it.

**One thing was exported rather than extracted, deliberately.** Slice 6 changed
`GOALS` in `App.jsx` from a file-local `const` to an `export const` so a test
could assert the Power goal's label. That looks like a departure from the pattern
above and is not: every extraction listed there pulled out *logic* that several
call sites shared and that had already drifted. `GOALS` is static display content
with one consumer, so a module of its own would hold no logic and exist purely to
be imported. Reviewed and judged proportionate on 14 August 2026.

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
strike-zone bounds, the pull and opposite-field direction cutoffs, and the 88 mph
"hard hit" highlight on the stat tiles and raw data table, which applies to every
goal rather than to one. *(The distance buckets used to be on that list. Slice 6
consolidated them into `ballFlight.js`; see the next section.)*

## How far the ball goes

Added in Slice 6 on 14 August 2026. Before it, distance was
`round(ev * 4.0 + la * 1.8)`, which barely used launch angle, so a ground ball
topped at 70 mph was credited with 287 feet and nothing could be shorter than
251. The coach read those numbers out loud.

**`src/ballFlight.js` owns three things, and they are together on purpose.**

- `carryDistance({ exitSpeed, angle })` is the single source of every hit
  distance. Both the generator and the fifteen hand-written session-1 swings go
  through it. Carry, not total with roll: that is what TrackMan measures, and it
  is why a ball at 4 degrees is now under 100 feet.
- `DISTANCE_BUCKETS` is the single source of the five distance ranges, read by
  the chart in `DebriefScreen.jsx` and by **both** coach prompts in
  `coachApi.js`. Before Slice 6 those were three separate copies, and the chat
  prompt was the one that got missed.
- `sprayRadius` and `SPRAY_RINGS` map a distance to a radius on the spray chart,
  and both ring radii *and* both printed ring labels are derived from that one
  function, so a label cannot come to describe a ring it is not drawn on.

**They live in one file because they move together.** The bucket edges and the
spray scale were both fitted to the distribution `carryDistance` produces. Change
the curve and both have to be re-checked, and the comments in that file say so.

**Known limit, do not read "tested" as "airtight."** The test that stops the five
ranges drifting apart reaches both coach prompts and **not** the chart. Putting a
private bucket array back inside `BarDistance` leaves the whole suite green;
this was proven by mutation, not assumed. Left deliberately: this project has no
rendering tests by design, and the uncovered step is one line that renames a
field. The chart is held to the shared constant by its import alone.

**Two hand-run scripts, deliberately outside the test runner** (vitest has no
config here, so its default glob collects only `*.test.*`, and both were checked
against the file count). `scripts/measure-swing-generation.mjs` reports empty
target-band rates, distance percentiles and bucket fill, before and after, and is
where the numbers in the decision log came from. Its last two sections, added at
the close of Slice 6, isolate the correlation change from the re-roll and check
that a session did not get wider or tighter.
`scripts/compare-distance-bucket-schemes.mjs` records how the shipped bucket
edges compare with the two that were rejected. Note the wording: the shipped
edges do **not** win that comparison outright. One rejected scheme ties them on
the empty-column measure and beats them on the strongest Power session; the
choice between them was the product manager's, made on how the three rendered.
Neither script is fast to eyeball; both print plain-language output meant to be
read directly.

## The bench that measures how much the coach writes

Added in Slice 7 on 14 August 2026. Two earlier attempts to shorten the coach
by prompt instruction alone did not hold, because "be brief" is unmeasured:
nothing notices when it drifts back. `scripts/bench-coach-brevity.mjs` exists
to notice.

**What it grades, and why two things at once.** A prompt that only measures
length rewards vagueness: a coach can hit any word count by dropping every
real number from the swing. So the bench scores length and citation grounding
together, against the same 24 live debriefs, using the app's own real swing
data across three session shapes (`power-s2`, `contact-s4`, `open-s4`).
"Grounded" means a citation carrying a unit that matches a real value from
that session; "target" means the goal's own numbers, legitimate but not
evidence the coach looked at the swings; "unmatched" is a lead worth
eyeballing rather than an automatic fabrication call, because the coach is
known to round ("320 feet or more" against a 305-plus bucket) rather than
invent outright.

**A caveat on `grounded` that this section did not carry before 14 August
2026.** The value sets it matches against do not discriminate evenly: on the
two session-4 cells they cover only 18 of 33 plausible exit-velocity
integers, 46 of 71 launch-angle integers, and 33 of 36 pitch-location
tenths, so a match against one of those is a weak signal by itself. Distance
is the one that actually discriminates, at 51 of 311. This does not undo the
shipped comparison: `grounded` is read as a citation-DENSITY measure (8.5 to
6.13), and density is the right proxy for the question that was asked,
whether the coach stopped quoting numbers at all. What it means is that a
`grounded` count should get the same hedge `unmatched` already gets, not be
read as proof against fabrication on its own. The bench's own dry run makes
the point concretely: a canned reply, hand-written before any session
existed, scores 8 grounded and 0 unmatched on both session-4 cells.

**It imports the real prompt, not a copy, with one disclosed exception.**
`MODEL`, `MAX_TOKENS`, `DEBRIEF_SYSTEM_BASE` and `lengthBudget` are now
exported from `src/coachApi.js` for exactly this reason: a bench grading a
paraphrase of the prompt would validate nothing about what the app actually
sends. Same discipline `DISTANCE_BUCKETS` enforces for hit distance, applied
to a prompt instead of a number. The one thing it does NOT import is the goal
labels in `CELLS`: `src/App.jsx` holds the real `GOALS` array and has JSX in
it, which a plain Node script cannot load, so the bench hand-copies the two
labels it needs and says so in its own comment. That is a fourth copy of the
same data this project otherwise consolidates hard against, kept only
because there was no way to import it, and it is not hypothetical: Slice 6
renamed the Power goal, and the bench's copy has to be kept in step by hand.

**How to run it, and what it costs.** `node --env-file=.env.local
scripts/bench-coach-brevity.mjs --condition shipped --runs 8` runs 24 live
Anthropic calls and spends real money, roughly $0.43 at about 1.8 cents a
debrief as measured 14 August 2026. `--dry-run` builds every prompt and grades
a canned reply with no network calls and no spend, for checking the bench
itself. `--condition all` still exists but now duplicates work: `B` and
`shipped` build byte-identical system prompts once the budget lives inside
`DEBRIEF_SYSTEM`, so running both spends 24 extra calls measuring the same
string twice.

~~**Its session-1 blind spot.** The bench cannot grade the very first debrief a
real visitor sees. Session 1 is not generated: it is fifteen swings
hand-written inside `src/App.jsx`, and a plain Node script cannot load a file
with JSX in it. The bench's three cells use a stand-in pinned to session 1's
real averages (81.6 mph, 17.33 degrees) rather than the actual fifteen
swings. Closing that gap needs those swings extracted into their own module
first, which is the first task of the next slice.~~

**Closed in Slice 7b, 17 August 2026, and closing it is what found the
slice's real subject.** Session 1's swings now live in `src/sessionOneSwings.js`
and the bench has a fourth cell, `power-s1`, 12 runs against the other three
cells' 8 each. The first thing that cell measured was not citation quality: it
was 14 of 36 before-run calls failing to parse at all, because session 1 was
pushing the coach past its 4096-token output ceiling. See the decision log
entry for 17 August 2026 for the failure and the fix. The other three cells
(`power-s2`, `contact-s4`, `open-s4`) also switched from the pinned average to
the real session-1-derived swings underneath them, since every later session
is generated off session 1's actual numbers, not its average. The same slice
also taught the bench to keep a failing call's raw reply, stop reason, and
output token count (`coachFailureRecord.js`) instead of just a message, but
the after-fix run that would have exercised it had zero failures and the
before run predates the change, so that capture code has never been observed
firing on a real call. It rests on unit tests and a reading of the code, not
a forced failure.

**Grew to six cells in Slice 8b, 18 August 2026.** `allfields-s4` and
`popup-s4` were added, both session 4, both goals nothing had graded before:
Hit to All Fields is judged on spray direction, which no other cell exercises,
and Reduce Pop-Ups is the only goal judged on launch angle alone, with no exit
velocity ask. The bench's hand-copied goal-label comment (see above) now
carries six entries instead of four, kept in step by hand for the same
already-disclosed reason. The bench and the rebuilt grader together produced
this slice's headline finding, recorded in the decision log for 18 August
2026: the coach's targeted miscount is gone, but the same live comparison
shows no improvement in the coach's overall claim accuracy, and a distinct,
still-open error class (self-derived subsets over pitch location data) held
completely flat across both rounds. The raw records for both rounds are
committed under `docs/eval-fixtures/slice8b-threshold-counts/`.

**A paid round was lost to a missing directory, 18 August 2026, and the fix
is now in the bench itself.** The first attempt at Slice 8c's after-round
completed all 52 live calls, spent $0.96, and then crashed writing its
output because the target directory did not exist yet, so the calls' results
existed only in memory and were gone the moment the process exited. The
bench now creates its output directory before writing
(`mkdirSync(path.dirname(args.out), { recursive: true })`), verified against
the full suite and committed on its own before the round was re-run. See the
decision log entry for 19 August 2026 for the full accounting.

**Grew to seven cells in Slice 9, 19 August 2026.** `contact-s1` was added:
Line Drives & Contact on session 1, the screen the session-1 rewrite most
changes and the one cell nothing had ever measured, weighted 1.5 to match
`power-s1` because it is the other session-1 cell. At the default `--runs 8`
a round is now 64 calls (12 + 8 + 12 + 8 + 8 + 8 + 8) at roughly $1.10, and
the hand-copied goal-label comment carries seven entries. `--condition all`
is now well past the script's own planned-call cap and refuses outright,
which is correct rather than a bug: it was already a wasteful invocation
before these cells existed. **There is still no `--cell` flag**, so a single
cell cannot be measured on its own; that is on the What's Next list.

## The data is synthetic

There is no real TrackMan feed. All swing data comes from `generateSwings` in
`src/swingGenerator.js`, which moved out of `App.jsx` in Slice 6. Sessions
simulate improvement over time with a 65% chance of a session trending better
than the last. Session 1 is not generated at all: it is the fifteen hand-written
swings in `mockSwings` in `App.jsx`, and only their distances have ever been
recomputed.

*Correction, 20 August 2026.* Two halves of that last sentence are now stale.
Those fifteen swings moved to `src/sessionOneSwings.js` in Slice 7b, and Slice 9
replaced every value in all fifteen, not only their distances. The rest holds:
session 1 is still hand-written rather than generated, which is also why the
generator's empty-target-band re-roll cannot protect it and why the counts had
to be set deliberately. Every generated session is still built from session 1's
two averages, which is why those two sums are frozen.

This matters when judging output quality. If the coach says something that
contradicts the numbers, that is a real bug. If the numbers themselves look
implausible for a real hitter, that is the generator, not the coach.

**Three things the generator does that are deliberate nudges, not simulation.**
All three landed in Slice 6 and all three are the reason the Power goal stopped
showing an empty target band in 56% of session 2s, rising to 63% by session 4.
Do not read `generateSwings` as an unbiased model of a hitter.

1. **Exit velocity and launch angle share a contact-quality term** at correlation
   0.6, so a well-struck ball tends to be hard *and* well-angled together. Real
   batted balls behave this way; independent draws did not.
2. **A session on the Power goal lifts launch angle** on a ramp of `+2` at
   session 2, `+4`, then `+6`. The story is that a player who picked that goal is
   working on it. No other goal gets a lift.
3. **A session that would render an empty target band is re-rolled once**, for
   any goal that has a target. Once, never until it succeeds.

**Point 3 is generic on purpose and it is load-bearing.** Tying exit velocity to
launch angle pushes hard-hit balls up through Line Drives & Contact's 18 degree
ceiling, so point 1 *by itself* would have taken that goal from 9% empty to 17%
at session 2, and from 11% to 19% at session 4. The generic re-roll is what stops
this being a regression on the second goal a visitor is likely to click, and it
lands Contact under 4%. Anyone tempted to narrow the re-roll to Power should read
that sentence twice.

Those are ranges across sessions 2 to 4, not single figures, and the middle state
never shipped, so it has to be reconstructed on purpose. The last two sections of
`node scripts/measure-swing-generation.mjs` print all three states and say how
the re-roll is switched off without touching shipped code. Rerun it rather than
citing this file; earlier drafts of this paragraph quoted a "9.7% to 16.8%"
nobody could reproduce.

~~`varianceFactor` and the 65/35 improve-or-decline split were left alone by Slice
6 and remain a separate open question. Note that **no test can currently see
`varianceFactor`**: a reviewer changed it six-fold and all 22 generator tests
still passed, because they drive noise at a neutral value. Whoever retunes the
improvement arc is working without a safety net there.~~

**The `varianceFactor` blind spot was closed in Slice 11 on 21 August 2026**, and
the way it was closed is worth a sentence, because the obvious version of the
test does not work. The constant multiplies two readings on one line each, and
the natural argument is that proving it on one proves its reach. That argument
was run rather than reread and it is false: deleting it from the exit velocity
line leaves the first configuration green. It takes two fixtures, one that
resolves each reading, and either deletion now turns something red. What neither
covers is stated beside them: both read whole numbers, so a change to the 0.05
of roughly minus 2 to plus 8 percent is still absorbed by rounding. That band
was swept, not derived, because the derived figure first written there was
wrong.

---

## THE GENERATOR AS IT NOW STANDS, 21 August 2026, Slice 11

**Everything above this heading in this section describes the generator Slice 6
left behind, and that generator no longer exists.** The three numbered "nudges"
are all still in the file and all still true, so nothing above is struck out. But
they are now three items on a longer list, and the empty-band percentages quoted
up there belong to a hitter this slice replaced. Read the two together: above is
why the file has re-rolls and a Power lift at all, below is what it actually
does. `src/swingGenerator.js`'s own header is the fuller version, and
`node scripts/measure-swing-generation.mjs` is the thing to rerun rather than
citing either.

**Who the hitter is, written down for the first time.** Bill is a varsity high
school junior, sixteen, with good bat-to-ball skills, real but not elite bat
speed, who chases too much. Session 1's frozen 81.6 average and 92 mph best ARE
that hitter rather than a sample near him. This had never been stated anywhere
outside the coach's own voice, and two constants were being set without it. It is
a settled product decision; do not relitigate it, and do read it before touching
any number in that file, because most of them only make sense against it.

**Five things the generator does, replacing the three above.**

1. **The pitch is drawn before the swing.** Roughly 65% of pitches are strikes,
   which is Bill's chase rate rather than the thrower's accuracy, since every row
   in this app is a batted ball.
2. **A missed pitch is a near miss on ONE axis.** Low, high or wide, never off on
   both height and side at once, which is what a real thrower produces. It was
   100% off on both before this slice and is 0% now. Nothing bounces any more
   either: the lowest pitch is 0.70 feet where it used to be 0.50.
3. **Where the pitch was thrown decides part of how well it was struck**, at
   about 4.6 mph between a swing at a strike and a swing at a ball. This is the
   headline change of the slice. It was 0.00 mph across 4,500,000 swings before,
   so the coach's chase reasoning, which it has been handed since Slice 8c, was a
   coincidence on every generated session.
4. **Pop-ups exist and come from getting under a high pitch.** About ~~0.40~~
   0.43 a session, four in five of them on pitches at or above the top of the
   zone, which is 7.6 times chance. There were none at all before: the goal named a
   failure the hitter could not commit, and the coach was handed "0 swings"
   forever.
5. **The hard clamps became soft compression.** A generator that refuses to let a
   swing past a limit has to put it somewhere, and it used to put it exactly on
   the limit: ~~4.138%~~ about 4% of Power session-4 swings sat on exactly 35
   degrees, drawing a flat row of dots along the top of a chart every visitor
   sees. Values now
   compress smoothly toward the limits instead, and no cell of the fifteen piles
   up on any of its four edges.

**Both struck numbers corrected 21 August 2026, by the whole-branch review, the
same day they were written. The correction is the same in each case, and it is
the same one the decision log's own closing paragraph confesses four of.** A
number measured along one path, then written down as a property of the thing
itself.

- **The pop-up rate is 0.43 a session averaged across every goal**, which is what
  `scripts/measure-swing-generation.mjs` prints, confirmed at two seeds. 0.40 is
  the figure for the four non-Power goals with its qualifier dropped; Power runs
  0.43, 0.50 and 0.68 across sessions 2 to 4, because that goal lifts launch
  angle. Every one of those is inside the 0.3 to 0.5 band the slice aimed at, so
  nothing about the product changes. **Where the four-goal number is the one
  wanted, say "on the four non-Power goals" out loud.**
- **The 35-degree pile-up is about 4% down to about 1.4%**, and the three decimal
  places claimed a precision nobody outside this branch could check. Those
  figures came from a one-off measurement inside a task report that is not
  committed to this repository. The seeded script cannot reproduce them **by
  construction**: it measures the edges of the distribution, and 35 degrees is
  now an interior value, since the highest launch angle the generator reaches is
  47. An independent replication at the script's own default seed, over 300,000
  swings a side, got 4.08% and 1.44%. The story is right in direction and
  magnitude; only the decimals were unbacked. The underlying limitation, that the
  script sees edges and not interiors, is already recorded on the What's Next
  list and is not new here.

**Three more numbers this slice set deliberately, all of which move if you touch
the file.** The exit velocity ceiling is 94, two above Bill's own best rather
than the old 97. The swing-to-swing spread now matches session 1's, where the
generated hitter used to be about 31% tighter than the session he is derived
from, which nobody had chosen. And the session-to-session bat speed step is about
half a mile an hour, bought as a straight shift rather than by widening the
improvement dice, because the AVG EXIT VELO tile is a rounded whole number and a
visitor used to be more likely to finish below session 1's 82 than above it.

**Spray leans pull and stops narrowing.** The pull and opposite-field bias ran
the wrong way against the 65/35 rule, and direction was being multiplied by the
shrinking variance factor, so Hit to All Fields met its own stated bar less often
every session: 64% at session 2 falling to 52% at session 4. It is now a flat 72
to 73%.

**One thing to know before tuning anything here.** The app never chains sessions.
`src/App.jsx` builds sessions 2, 3 and 4 each from session 1 independently, so a
visitor's fourth session is not the end of a chain. A tuning harness that chains
them for convenience will report defects the app does not have; the Power lift in
particular compounds, putting a quarter of session 4 in the pop-up band. Finding
10 in `docs/slice-11-plan.md` has the measurement.

**What is still not true of it, recorded rather than fixed.** Launch angle is not
monotone in pitch height across the population and it inverts against session 1:
a ball chased above the zone comes out about two degrees flatter than a strike
down the middle, where session 1 says it should be the steepest thing on the
chart. It is structural rather than a tuning slip and no weight fixes it inside
this structure. Finding 8 in `docs/slice-11-plan.md` carries the arithmetic.

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
   vitest, and at the close of Slice 12 on 25 August 2026 it is **695 tests
   across 24 files**. *(Unchanged at the close of Slice 13 later the same day,
   which is the expected result rather than a missing update: that slice was
   documentation plus one template file, and Markdown cannot move the suite. A
   move would have meant something else was touched.)*

   *(Corrected 25 August 2026 in Slice 12, and the first attempt at this
   correction was itself wrong, which is why the whole chain is now written out
   and each number was produced by checking out the commit and running the
   suite rather than by reading a commit message. This line read **671 across
   24**, and the diagnosis first written here, that the Reduce Pop-Ups micro-PR
   left it stale, was FALSE and blamed the wrong pull request. What actually
   happened: 654 across 23 at the close of Slice 11; the pitch-window micro-PR
   (`e48b5ce`) took it to **689 across 24** and wrote 671 into this line, so the
   number was already wrong by 18 the day it was written; the Reduce Pop-Ups
   micro-PR (`8590fb5`) added 3, giving **692**, which is the measured baseline
   Slice 12 started from; Slice 12 added 3 more, all seen failing first, giving
   **695**. The "seventeen new ones" below was wrong by the same stroke:
   `src/pitchChartWindow.test.js` carries **35** tests, and 654 plus 35 is 689,
   which is the arithmetic that should have caught this at the time. Both
   sentences below are corrected in place rather than annotated, because a wrong
   count is not a record of anything.)*

   Before the pitch-window micro-PR it was 654 across 23. The thirty-five new
   ones are `src/pitchChartWindow.test.js`, and two of them are worth knowing about
   because they answer a question this project has usually had to leave open:
   whether a number that AGREES with its source is actually computed from it.
   They hand the module a different strike zone and a different pitch-miss
   limit and check the window moves, and both were seen failing against a first
   version that typed the right answers out. The same file also carries a
   text-scoped guard on `src/DebriefScreen.jsx`, in the pattern
   `src/sessionStats.test.js` already uses for the spray cutoffs: it reads the
   `PitchLocation` component as plain text and fails if either axis goes back
   to growing to fit the session. **It is not a rendering test and this project
   still has none**; whether the chevron actually draws was checked by eye in a
   browser and nowhere else.

   *The paragraph below was true at the close of Slice 11 and is kept as
   written.* At the close of Slice 11 on 21 August 2026 it is **654 tests
   across 23 files**, up from 573 across 22 at the close of Slice 10. The file
   count moved once, in that slice's first task; everything after it landed in
   files that already existed, mostly `src/swingGenerator.test.js`, which more
   than doubled. **What the 81 new tests do NOT do is watch a distribution.**
   Slice 11 changed how a hitter's numbers are shaped, and a shape is not
   something a seeded unit test can hold: the suite tests the deterministic
   seams, and every claim about what the generator produces is measured by
   `node scripts/measure-swing-generation.mjs`, which is seeded so the same
   command gives the same report. A green suite says the plumbing is intact and
   says nothing about whether the hitter is believable.

   *The paragraph below describes the state after that first task and is kept
   as written, because the reasoning in it is what the guard rests on. The 604
   it opens with was true on 20 August 2026.* After Slice 11's first task on 20
   August 2026 it is 604 tests
   across 23 files, up from the 599 that task first landed the same day and
   the 573 across 22 at the close of Slice 10. The 31 new tests are
   `scripts/frozenGenerator.test.js`, and they
   answer three different questions that a reader should not merge. Twenty-four
   of them rebuild one bench cell each through the frozen pre-Slice-11
   generator and hold the result against a committed digest, so six committed
   fixture directories cannot quietly start being graded against swings their
   coaches never saw; a twenty-fifth rebuilds nothing and instead checks
   that the list of cells being rebuilt has not silently shrunk. Fourteen
   of the twenty-four are every cell at each of two seeds, seven are the
   same cells at one seed for the pre-Slice-9 baseline, and three are the
   96-debrief fixture's own three cells at the one seed it runs itself at.
   Two more ask a different question, whether the snapshot FILE has moved,
   by hashing every line of code in it. The last four ask whether the guard
   itself still works: whether the rule about what may sit above the hash
   boundary still refuses every line terminator, whether the two scripts that
   load the snapshot are reading the file this test is hashing, and whether
   the digest's own claim about which seed it covers is honest. *(Those counts
   read 22, 2 and 2 until a review pass late on 20 August 2026 found a sixth
   exposed directory; see the "six, not five" correction on the
   `docs/eval-fixtures/` row further up.)*
   The first two questions are both needed, which was measured rather than
   assumed: an independent review mutated the snapshot five ways, one line
   each, and four of the five (all the clamps, and the whole
   above-28-degrees branch of the
   carry formula) changed no swing in any cell at either seed, so the data
   checks stayed green while the file had plainly moved.

   **Note what "every line of code" is load-bearing about, because the first
   version of this guard got it wrong and this paragraph described the wrong
   thing for a few hours.** The hash originally started at the snapshot's
   "recovered file begins here" marker, which left the frozen copies of
   `carryDistance` and the goal targets outside it, since those came from
   other files and sit above that marker. Review caught it by moving
   `carryDistance`'s high-angle floor from 0.55 to 0.40 and watching all 23
   tests stay green. That constant is not an idle one: it is the coupling
   this file names further up as the thing to re-check if the pop-up ceiling
   is raised, and raising the pop-up ceiling is one of the three things Slice
   11 does. The boundary is now a marked line with only prose above it, and
   the test refuses any line above it that is not blank or a single-line
   comment, so behaviour cannot be walked back out of the hash. The prose
   header stays outside on purpose, so it can be corrected without tempting
   anybody to re-pin the number. If a hash test goes red, the file is wrong;
   re-pinning turns the snapshot into a copy of whatever the generator has
   become.

   **One more round of review found the "not blank or a comment" half of that
   sentence was still cheatable, and the fix is worth knowing about because
   the reasoning generalises.** The check split the file on newlines and
   accepted any line starting with `//`. JavaScript also ends a `//` comment
   at U+2028 LINE SEPARATOR, which `split('\n')` does not, so a single
   physical line reading as a harmless note could carry a live statement
   after an invisible character: prose to the guard, code to Node. Review
   demonstrated it with a line that patched `Math.min` only when not running
   under vitest, and got a fully green suite while the frozen generator's
   exit velocity ceiling read 90 instead of 97 everywhere else, which is how
   the grading script actually loads it. **Calibrate it honestly, though:
   nobody types U+2028 by accident and no search and replace produces one.
   That was a hole in the tamper-evidence claim, not in the drift protection
   the guard does for a living.** It was worth a one-line fix because three
   committed documents assert the stronger claim, and an assertion this
   project cannot back is the exact thing the whole task exists to remove.
   The same fix stopped the check calling an indented comment "behaviour",
   which was a live false-red trap in a header that had already been edited
   three times in a day.

   **Dated annotation, 20 August 2026, later the same day: that calibration
   is true of U+2028 and does not carry over to the character the fix was
   still missing.** The check excluded U+2028 and U+2029 and not U+000D
   CARRIAGE RETURN, which JavaScript also treats as ending a `//` comment.
   Review built the identical attack with a CR in place of the U+2028 and
   measured it rather than arguing it: `npm test` reported 597 passed across
   23 files, fully green, while loading the snapshot the way the grading
   script actually loads it made 5 of the 21 digest cells rebuild to
   different swings, the first being `slice11-before` at seed 20260819 on
   `power-s2`. **The sentence that no longer holds is the sweeping one.**
   Nobody types a U+2028 by accident, but ordinary tooling produces a
   carriage return without anybody intending one: an editor set to CRLF
   endings, a checkout on Windows, a `core.autocrlf` setting, a paste that
   mixes line endings. So this class of hole is not tamper-only, and filing
   it that way was more comfortable than the facts supported.

   **The accidental-drift risk stays low all the same, and the reason is
   worth keeping rather than dropping with the claim.** A CRLF conversion of
   the whole file is caught anyway by the byte-count and hash checks below
   the boundary, so the file has to be LF-only for this guard to be green at
   all. The fix does mean a CRLF-converted file now also fails the purity
   check above the boundary, which is correct rather than a cost: it is the
   same fact arriving one check earlier, in a message that names the line.
   What the fix buys is that the set is now closed: ECMAScript defines
   exactly four LineTerminators, LF is the one the check splits the file on,
   and CR, U+2028 and U+2029 are the three the character class excludes, so
   there is no fifth character left to be found later.

   **Dated correction, 20 August 2026: the paragraph above is right that a
   CRLF file cannot be green and wrong about which check catches it.** Both
   cases were run rather than reasoned about, because that sentence was
   written from reading the pattern instead of from output. A **whole-file**
   conversion never reaches the purity check at all: the boundary line itself
   picks up a carriage return, the lookup for it fails, and the test dies on
   its first assertion instead. What fires is `the snapshot must carry exactly
   one hash boundary line: expected +0 to be 1`, alongside `the hashed region
   changed size: expected +0 to be 14093`. Neither names an offending line and
   the carriage return exclusion contributes nothing to either. The claim is
   true of a **partial or mixed-ending** file, where the boundary line
   survives: there the purity check does run and does name the lines. That is
   also the realistic accident, a few lines pasted in with Windows endings
   rather than a whole file converted, so the substantive point stands. What
   was wrong was the mechanism, which is the same defect class this passage
   has now been corrected for twice.

   **Two further guards were added the same day, both proven by reopening the
   hole they close.** The prose rule was hoisted into one named function that
   the boundary check calls, with a test that drives it directly using
   characters built from their codes, because the boundary check can only
   exercise the exclusion if the snapshot carries a terminator and the
   snapshot must never carry one. Dropping the carriage return from the class
   now fails with `CR must be refused`, where before it left the suite green.
   And the grading script's snapshot path became an exported constant that
   the test asserts equals the path it resolves independently, the same shape
   `src/sessionStats.test.js` uses to hold `src/DebriefScreen.jsx`'s cutoffs
   to `SPRAY_CUTOFFS`. Before that, the test hashed one path and the loader
   imported another with nothing tying them together: repointing the loader
   at a copy carrying a mutated carry-distance floor left the suite reporting
   597 passed while the hash guarded a file nothing read.

   Earlier counts, for the record. It was 573
   tests across 22
   files, up from 570 before that slice's final review added the guard holding
   the spray chart's own four cutoff literals to `SPRAY_CUTOFFS`, up from 535
   midway through Slice 10, before the browser QA gate
   rejected that slice's first prompt and sent it back for a second round of
   work, up from 529 at Slice 9's closing review the same day, up from
   519 at the close of Slice 9's build, up from
   506 across 22 at the close of Slice 8d, up from 489 across
   21 at the close of Slice 8c, up from 461 across
   19 at the close of Slice 8b. It covers the
   serverless proxy's method routing, validation, and size cap; `callApi`'s
   one retry and its unwrapping of a fenced model response; the chart-slot
   fallback and dedupe; the chat reply's chart key; the goal targets and the
   coach prompt built from them; the summary box's scroll-fade tolerance;
   `computeStats`; a pin that recomputes each of session 1's fifteen swings
   against its own exit speed and angle so a wrong distance turns the suite
   red; the eight invariants Slice 9 pinned on those same fifteen swings (both
   sums held exactly, the on-target counts per goal, the pull and opposite-field
   counts, a correlation band, a rule that rules out a ruler-straight ramp, the
   strike-zone mix, the in-zone contact advantage, and a pinned-seed snapshot
   proving sessions 2 to 4 do not move when session 1 is rewritten); the
   direction key reaching both prompts, sitting immediately above the swing data
   it explains, and being the same string in each (Slice 10); the three spray
   count lines reaching both prompts, their exact values on session 1, their
   counts always summing to the session's swing count, and the guard proving the
   Hit to All Fields goal prose and the universal lines cannot report different
   pull numbers (Slice 10's second round of work; that last one makes ONE of
   the two drifts impossible, prompt line against prompt line, which is not the
   drift the QA gate actually caught. The gate caught the coach's prose
   disagreeing with the spray chart, and that one is still merely true rather
   than impossible: it is now watched by a guard in `src/sessionStats.test.js`
   that reads `src/DebriefScreen.jsx` as text and holds its four hardcoded
   cutoffs to `SPRAY_CUTOFFS`); and the
   deterministic fact-sheet and word-overlap modules the
   claim-accuracy grader and the bench each lean on. It covers **no screens
   and no rendering at all**, so a green suite says nothing about what a
   visitor sees, and it still never calls the model: the length budget's four
   numbers are pinned, but whether the coach actually obeys them is the
   bench's job, not the suite's. Never imply broader coverage than that. New
   behavior gets a test shown failing first; a test written over existing
   behavior is worthless until the thing it covers has been broken on purpose
   and seen to go red. ~~**The claim-accuracy grader itself is not part of this
   suite and, as of Slice 7b, has not been validated against the fixture it
   was built for**; see the What's Next list.~~ **Validated in Slice 8, 17-18
   August 2026, the hard way: the first validation failed outright, the
   grader's judgment was rebuilt into plain code (`scripts/claimVerdict.js`,
   in the suite), and the rerun caught all 8 known-wrong debriefs for the
   right reason.** The grading model now only extracts claims; every verdict is
   computed. Both runs are committed under
   `docs/eval-fixtures/slice8-grader-validation/`.
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
4. **This app is for a desktop or an iPad, so the standing real-phone rule does
   not apply.** Owner, 20 August 2026, recorded here because it had come up
   before and was re-raised as a blocker at the start of Slice 11. Item 3's
   rendered check is a desktop check; an iPad width is worth a look when a
   layout moves; a phone pass is neither required nor a deviation to declare.
   Do not add `--host` on the strength of that rule, and do not read the 390px
   chat-panel item on What's Next as a defect.

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

## What the app says when a call fails

Added in Slice 5 on 13 August 2026. Before it, every failure produced one
sentence claiming the server had been asleep, which was a guess worded as a fact
and was often wrong.

**Four reasons, plus one flag. Each is meant to rest on something that was
actually reported rather than inferred, with one honest exception: `trouble` is
also the catch-all.** An unrecognized reason, a missing one, and an Anthropic 400
that is more likely this app's own bug all land there, which is a deliberate
choice (a blank failure screen is worse than copy that is too general) but does
mean `trouble` on screen is not proof Anthropic did anything wrong. The code says
so in its own comments.

    credits      Anthropic reports the balance is dry.      Server only.
    timeout      Nobody answered inside the deadline.       Server, or the
                                                            browser as a backstop.
    trouble      Anthropic refused or errored.              Server only.
    unreachable  Our own function could not be reached.     Browser only.
    cold (flag)  This invocation started on a fresh
                 instance.                                  Server only.

`unreachable` is its own reason and must stay that way. When the browser cannot
reach our function it knows nothing whatsoever about Anthropic, so naming
Anthropic there would be a new lie of exactly the kind this slice removed.
`cold` is a modifier rather than a fifth reason for the mirror-image reason: the
server can only report it was cold if it lived long enough to answer.

**The copy lives in `src/failureCopy.js` and nowhere else.** Both the debrief
screen (`src/App.jsx`) and the chat panel (`src/DebriefScreen.jsx`) read from
that one table. The strings were written and approved by the product manager on
13 August 2026 and are not to be reworded. They name Anthropic and Vercel on
purpose, breaking the TrackMan fiction, because the failure screen is where the
demo stops talking to a hitter and starts talking to a hiring manager who must
not mistake an unfunded balance for a coding mistake.

**`credits` and `timeout` never retry; `trouble` and `unreachable` retry once.**
`credits` is also the only reason with no Try Again button, because a button
there would promise something that cannot work. The `cold` flag is deliberately
not consulted in the retry decision at all; `isRetryable` in `src/coachApi.js`
carries the reasoning, and the Slice 5 plan's own wording is what put a hole
there in the first place. Do not restore a cold clause from that plan.

**Two deadlines, and they differ on purpose.** The server gives up on Anthropic
at 40 seconds (`UPSTREAM_DEADLINE_MS` in `api/coach.js`), leaving twenty seconds
of headroom under Vercel's 60 so it can answer in words rather than be killed
mid-sentence. The browser gives up at 50 seconds (`REQUEST_TIMEOUT_MS` in
`src/coachApi.js`), sitting ten seconds behind so the server's more specific
reason almost always wins the race. A single shared number would leave the two
racing and throw away the specific answer. The 50 seconds is a wall-clock budget
for the whole call, spent down by each attempt, so a retry cannot start a fresh
clock; before that fix a slow `trouble` could hold a visitor for roughly 90
seconds. A "still working" line appears at 25 seconds.

**Every response now carries how long Anthropic took.** `x-coach-upstream-ms`
and `x-coach-cold` are set on success, and a failure body carries
`{ error: { reason, upstreamStatus, upstreamMs, cold } }`. Note the `error`
wrapper; the fields are not at the top level. That is where any future latency
question gets answered from, rather than from a stopwatch.
*(Dated note, 25 August 2026, Slice 12: read the first sentence as being about
the POST path only. `x-coach-cold` is now also set on the GET and HEAD liveness
responses, which is what makes warmth free to check; `x-coach-upstream-ms` is
not, because a liveness ping never calls Anthropic and so has nothing to
report.)*

**What Slice 5 actually proved, and what it did not.** None of this can be
verified by `npm run dev`; see the trap above. Two of the four reasons were
forced against a real Vercel preview on 13 August 2026: `unreachable`, by
patching the browser's fetch, and `timeout`, by temporarily deploying a one
second server deadline. **The other two were not forced.** `credits` cannot be,
because a prepaid balance cannot be drained to order. `trouble` needs an invalid
key set on the deployment, which is a Vercel environment change nobody made. A
genuine cold start was not observed either, because that needs the uptime monitor
paused and the instance left to be evicted. Nor was the 25 second mid-wait line,
because every real debrief finished before it could fire. So `credits`,
`trouble`, the `cold` wording, and the mid-wait line rest on unit tests and on
reading the code, not on a forced failure. Do not read this section as four
proven paths.

## Deployment and cold starts

Vercel. The static app is served from a CDN and is always instant. The
serverless function can sleep when idle and takes several extra seconds to wake,
which reads to a visitor as a hang or a broken app. *("can sleep" was "sleeps",
changed in Slice 12 and disclosed here because it sits above the marker below
and would otherwise be an undisclosed edit to a pre-existing sentence.)*

**Rewritten 25 August 2026 in Slice 12. This section used to describe the uptime
monitor as the one thing preventing a cold start. There are now two things, and
the useful finding is that they are complementary rather than redundant.**

**One: Vercel's own cold start prevention.** The account moved to the Pro plan on
24 August 2026, for a different project. Pro keeps the current production
deployment's instance warm automatically, with nothing to configure. Confirmed
enabled on this project by dashboard screenshot on 25 August 2026, alongside
Fluid Compute, which was also already on. **It carries a condition that decides
the rest of this section: the deployment stays warm only if it was invoked in
the last 14 days.**

**Read that condition with the hedge it was written with, because everything
below rests on it and a later session will find only this file.** The source is
Vercel's own blog post "Scale to one: how Fluid solves cold starts", read on 25
August 2026, which says *"Pro and Enterprise plans: current production
deployment (warm if invoked in the last 14 days)"* and *"This works
automatically for qualifying deployments; there is nothing you need to configure
or enable."* The mechanism is confident. **The exact semantics of "invoked in
the last 14 days" are a reading of that sentence, not of a specification**, and
no Vercel document states what happens on day fifteen in so many words. If this
ever needs to be firmer than a careful reading, it needs Vercel support, not
another pass over the same page.

**Two: a free external uptime monitor** pinging `/api/coach` every five minutes
with a plain GET, which the handler answers with a bare 200 before ever reading
the body or calling Anthropic, so it wakes the function and costs nothing. HEAD
is answered the same way, since some monitors use it instead. Anything that is
not GET, HEAD, or POST still gets a 405. Slice 2 changed the GET from a 405 on
30 July 2026, because most monitors read anything outside the 200 range as the
site being down and alert on it, which made the warmer useless as an uptime
check.

**Do not cancel the monitor on the grounds that Pro now does its job.** A visitor
loading the static app does not invoke the function; that is served from a CDN.
Only a debrief, a chat reply or a ping counts as an invocation. So on a portfolio
demo that can plausibly go fourteen quiet days between job applications, **the
monitor is very likely what keeps this app qualified for the Pro feature**,
rather than a backup to it. "Very likely" rather than "is", for the reason in the
hedge above: the conclusion is only as firm as the reading of the 14 day
condition. It holds anyway on the weaker ground the owner gave it, that a free
permanent net should not be traded for a paid feature expected to last three to
six months. And the monitor does a second job Pro does not do at all: telling the
owner the site is down.

Cost is **roughly $0.006 a month, arithmetic from Vercel's published prices
rather than a figure read off a bill**: 8,640 invocations at $0.60 per million
is $0.0052, plus about $0.0003 of active CPU, plus a smaller memory term. Do not
reconcile it against the $0.06 of real usage recorded in the checklist for the
cycle's first day; that number covers both projects and every billable resource,
so it neither confirms nor contradicts this one. Nobody has isolated the
monitor's own line on an invoice, and on a bill this size nobody is going to.

**What was never measured, and cannot be settled from anything written down.**
Whether the monitor ever helped on the Hobby plan is unknown. The three latency
measurements below were each taken for some other reason and not one of them is
a before-and-after across the monitor's install date. Do not construct one out of
them; Slice 12 tried, and they do not support it.

**One source was NOT checked, and an earlier draft of this passage overstated the
case by calling the question unrecoverable without checking it.** Vercel's own
observability and runtime logs may retain a window reaching back past the 31 July
2026 monitor install or the 24 August 2026 upgrade. Nobody looked. So the honest
statement is that it cannot be settled from this repository's records, which is
weaker than "cannot be reconstructed" and is what the pre-existing What's Next
entry already said before this slice tried to strengthen it.

**How to ask whether the app is asleep, for free.** Since Slice 12 the
`x-coach-cold` header is set on the GET and HEAD liveness responses as well as on
a successful POST, so the question no longer costs an Anthropic call. **Read that
as unit-tested rather than observed**: the suite cannot reach the deployed
function at all, and at the time Slice 12's PR was opened the header had never
been seen on a real response. The five production timings that slice recorded
were necessarily taken against the deployment BEFORE the change, so they are not
evidence the header exists. The first curl against production after that merge is
what settles it, and it is the first item on the checklist below. The exact
command, the warm baseline to read it against, and the what-if-I-downgrade note
all live in `docs/pre-deploy-checklist.md`, which is this project's record of
everything that keeps the app working from outside the repository.

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

A 12 August 2026 audit measured slower numbers: debriefs taking 20 to 30
seconds, plus one debrief that returned a 504 after roughly 28 to 38 seconds and
succeeded on an automatic retry, for a total visitor wait of over a minute.
Latency roughly doubled between the two measurements. The cause is not known to
be anything in this repository: the prompt did not grow and the model did not
change between the two dates. The owner was running his own session
concurrently during the audit, so a concurrency effect has not been ruled out.

One further measurement, 13 August 2026, against a real Vercel preview during
Slice 5: a single session 1 debrief took **12.06 seconds** end to end in the
browser, one request and no retry, and a curl of the same endpoint reported
`x-coach-upstream-ms: 1141` against a 1337ms wall clock on a warm instance.

**Read that as one run, not as a refutation.** It was a single debrief, on
session 1, which is the smallest session the app can produce, on an instance that
was already warm. The 12 August audit measured 20 to 30 seconds across a larger
sample and included an outright timeout, and one fast run does not overturn it.
What it is consistent with is the concurrency explanation above, and it is
nowhere near enough to settle that. All three measurements stand together:
30 July, 12 August, 13 August. Latency here moves for reasons this repository
does not control, which is the argument for reading it off the
`x-coach-upstream-ms` header rather than from memory or from one good run.

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
- **The length budget trades citations for brevity, on purpose.** 45/30/12/50
  words for summary/what-this-means/tips-intro/tip, chosen from three measured
  options on 14 August 2026 because two earlier "just be brief" prompt
  instructions did not hold. The bench measured what it costs: grounded
  citations per debrief fell from 8.5 to about 6.1, roughly 28%, and the share
  of tips leading with a real cited number fell from 96% to 88%. Shipped
  anyway, because the audience is a high school hitter's attention span, not a
  data-completeness score. Revisit only with bench evidence, not a hunch.
  **Annotation, 17 August 2026: the 50-word tip half of this budget is not
  holding, and the bench evidence to say so is now in hand.** Mean `tip1`
  length measured 67 to 82 words, not 50, across three independent
  measurements: Slice 7b's own before run (72.4), its after run (68.4), and
  Slice 7's own committed condition-B fixture (71.0), the exact data this
  budget was chosen from. So "shipped, holds" is not accurate for the tip
  number as written; see the What's Next item below.
- **Session summary body text is 18px, not 16 or 20.** 16 was the size before
  Slice 7; 20 was tried and rejected because it closed the visual gap to the
  chat panel's own type (14px to 16px), so the two panels started reading as
  two different documents rather than one screen. 18 keeps that 2px gap and
  leaves more box capacity against the budget than 20 would have. The product
  manager is half-inclined to drop it back to 16 to match the chat exactly;
  see the What's Next list.
- **The summary box scrolls; the charts do not shrink.** Slice 7 chose to let
  a long summary scroll inside its existing box rather than making the two
  chart panels smaller to fit more text. A bottom fade now shows only when
  there is real text below the fold (`src/scrollFade.js`), which also exposed
  and made honest a truncation bug that predated the slice: at 1280x720 the
  box was already cutting text off mid-sentence, with only a near-invisible
  3px scrollbar as a clue that anything was missing.
- **The spray chart's legend says "Center" and the coach says "up the middle."
  Two different words for one thing, on purpose.** Decided by the product
  manager on 20 August 2026, in the conversation that fixed the spray defect,
  and recorded here so nobody unifies them later on the grounds that they
  disagree. They do not disagree: both resolve to the same -15 to +15 window
  today. ~~from the single `SPRAY_CUTOFFS` constant, so they cannot drift.~~
  **Corrected 20 August 2026, by the final review of this same slice: that
  clause was false the day it was written, and it was false about the exact
  guarantee whose absence got this slice rejected.** Only the prompt side reads
  `SPRAY_CUTOFFS`. `src/DebriefScreen.jsx` imports nothing from
  `sessionStats.js` and writes the two cutoffs out as its own literals four
  times, twice in `SprayDirection` around `:696` and `:700` and twice in
  `PitchLocation` around `:779` and `:781`. They agree, and nothing about the
  construction makes them agree. The remaining copy is recorded as debt in the
  `src/sessionStats.js` entry further up this file, around lines 360 to 364.
  **What changed on 20 August 2026 is that a drift now turns the suite red**: a
  guard in `src/sessionStats.test.js` reads the screen file as plain text and
  holds all four of its literals to `SPRAY_CUTOFFS`, seen failing first against
  a deliberately changed one. That is a tripwire, not a guarantee, and the
  difference matters: change the constant and the suite tells you the chart did
  not follow, rather than the chart following on its own. The rest of this
  decision stands unchanged and is sound. What differs
  is register. A chart legend needs a short word that fits under a colour swatch.
  A coach or a player never says "center" out loud; they say "up the middle,"
  and the coach's whole job here is to sound like a person at the cage. A player
  may type either word in chat and the coach understands both.

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

  **Half closed on 14 August 2026 by Slice 6: the distance buckets are now
  consolidated too**, into `DISTANCE_BUCKETS` in `src/ballFlight.js`, read by the
  chart and both coach prompts. Not because a third drift appeared, but because
  making the distances honest meant moving all three copies anyway, so leaving
  two of them behind would have been the drift rather than avoiding it. **The
  strike-zone bounds are the last unconsolidated set**, ~~still in six places~~,
  and
  the original trigger stands for them unchanged. One caveat carried forward: the
  test that holds the buckets together reaches both coach prompts and not the
  chart, so this is consolidation plus partial enforcement, not the full thing.

  **"Six places" was never checked and was an undercount, and Slice 11
  enumerated it by hand rather than by memory on 21 August 2026.** Two copies
  were closed on the way past, both under the standing "worth doing when the
  file is open anyway" trigger rather than as a tidy-up: `src/swingGenerator.js`,
  which was rewriting those exact literals and where two copies would have meant
  the generator aiming at a zone the rest of the app does not recognise, and
  `scripts/handedCounts.js`, which already imported the neighbouring constant
  from the same module and argued in its own comment for doing it.

  **The current count, and say which one you mean when you quote it: FOUR copies
  in shipped code, FIVE counting tooling, SIX sites including the definition.**
  The definition is `SPRAY_CUTOFFS`'s neighbour `STRIKE_ZONE` in
  `src/sessionStats.js`. The four shipped copies are all in
  `src/DebriefScreen.jsx` (the drawn zone rectangle, `ZoneBreakdown`'s
  predicate, the raw data table's predicate) and `src/coachApi.js` (the zone
  written into the prompt's prose). The one remaining tooling copy is in
  `scripts/bench-coach-brevity.mjs`.

  **The census deliberately EXCLUDES the two frozen snapshots**, and excluding
  them is correct rather than convenient: they are frozen copies on purpose,
  they exist precisely so they cannot follow a change in `src/`, and counting
  them as drift risk would argue for the one edit their own headers forbid. A
  future reader grepping for the bounds will find them there and should not add
  them back to the list. Two other grep hits are not copies either and were
  checked: `scripts/factSheet.js` names the bounds inside a comment while
  importing the constant, and `scripts/measure-swing-generation.mjs` holds an
  unrelated 1.5. Full census in `docs/slice-11-plan.md`, finding 3.
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

**Open at the close of Slice 5, 14 August 2026: the agreed next slice is not
written down here.** The owner reports that a separate session, titled "B1 Coach
demo reliability audit," settled on a next slice called **"credibility polish"**,
and that its contents exist only in that conversation. Nothing in this repository
records what it covers, so this file cannot say. The first job of whoever picks
up the next slice is to get that scope written down here before building
anything, because this list is what a fresh session actually reads.

This is worth naming as a process finding rather than a to-do. It is the exact
failure this section exists to prevent: work agreed in one session, carried
forward by re-pasting a prompt into the next, and therefore invisible to every
session that does not receive the paste. It is also why the Slice 5 close
recommended a next slice that had already been superseded. Decisions reached in
conversation are not recorded until they are in this file.

**Closed 14 August 2026.** The scope was recovered from the session that held it
and written to `docs/queued-slices.md`. "Credibility polish" is Slice 6, and a
second agreed slice nobody had recorded at all, coach fidelity, is Slice 7. The
block above is kept as written because it records what was true when written, and
because the process finding in it is the point. That finding now has its own
entry in the decision log for 14 August 2026.

**Correction, later the same day, 14 August 2026: "Slice 7" collided.** A
separate, unrelated slice (the coach's length budget and the type-size bump)
was cut on branch `slice-7-coach-brevity` and took the number 7 as the next one
in the repo's own sequence, before "coach fidelity" had been built. Coach
fidelity was never built under that number and keeps its scope in
`docs/queued-slices.md`, which carries its own dated annotation; it no longer
has a number of its own until it is actually scheduled. Every "Slice 7" naming
coach fidelity below and in that file describes a plan that was never built
under that name, not work that shipped.

### The next two slices, agreed 12 August 2026

Full scope for both, with the reasoning behind every decision and everything
ruled out, is in **`docs/queued-slices.md`**. Detail lives there rather than here
on purpose: this file loads at the start of every session, so it is an index.

- ~~**Slice 6, credibility polish.** Eight defects an informed visitor would
  notice and quietly judge, none of which break the app, plus one feel
  decision.~~ **Split on 14 August 2026 at the seam `docs/queued-slices.md`
  itself named, and the first half shipped.**

  **Slice 6 shipped** the data-model half: items 1 (impossible hit distances),
  2 (the distance buckets that depended on them) and 9 (the Power goal's empty
  target band). It also picked up three things the agreed scope had not named:
  the spray chart, which sized every dot against a 300-foot centre and would have
  collapsed every session into the infield; the coach's prompt calling the Power
  target "home run distance contact", which the honest curve made untrue; and the
  Power goal's own name, which was "Power & Home Runs" until a live debrief showed
  the coach reconstructing "out of the park" from the label alone.

- **Slice 6b, surface polish. The remaining six items, and the next slice.**
  Items 3 to 8 of credibility polish, still scoped in `docs/queued-slices.md`:
  the browser tab showing the build tool's logo, five scaffolding files, the lint
  wall (24 errors as counted on 14 August at the close of Slice 6, most of them
  Node files linted as browser code; the twenty-fourth is new and expected,
  `react-refresh/only-export-components` on `App.jsx`, because Slice 6
  deliberately exported `GOALS` so one label could be tested), a README a
  stranger cannot run the project from, a README goal list that
  does not match the screen, and the Reduce Pop-Ups card pointing the wrong way.
  **Two of these are now decided and need no further product input**: the
  Pop-Ups tag becomes `LA 10–25° · Level it out`, and the README's goal list must
  also pick up the Power goal's rename to "Power & Distance". Cheap, independent
  of each other, and all six are verifiable in one browser pass.

  **Annotation, 24 August 2026: this is now five items, not six.** The Reduce
  Pop-Ups card shipped on its own as a micro-PR that day, on the approved
  wording above, with the range read from `src/goalTargets.js` rather than typed
  out. The two README items also grew: they are now folded into a full README
  audit, which has its own entry at the bottom of this list, because the parts
  of that file nobody had flagged have aged further than the two lines that were
  flagged.
- **Coach fidelity. SCHEDULED AS THE NEXT SLICE, 17 August 2026, and it is Slice 8.**
  Four ways the coach can contradict the screen beside it, the largest being
  that it is never told the two tips it just gave. **Two of the four failed to
  reproduce in a live walkthrough**, so the slice starts by deciding whether
  they are worth fixing at all, and it needs model-behavior evidence rather
  than unit tests. See the correction above: **Slice 7 shipped on 14 August
  2026 as the coach's length budget and type-size bump**, an unrelated slice
  that took the number first. This item's scope is unchanged and still lives
  in `docs/queued-slices.md`; only its number is gone.
  **Scheduled 17 August 2026, at the close of Slice 7b, and given the number 8.**
  The product manager agreed it as the next slice in conversation, and this line
  exists so no future session has to be told that in a paste. What changed the
  case from theoretical to demonstrated: Slice 7b's browser passes produced two
  false statements on the first screen, in two attempts. One said four of six
  swings were under 80 mph when all six were, which is the error the product
  manager first caught by eye on 15 August. The other called a pitch "below the
  zone" that was actually wide, while quoting its correct height in the same
  sentence. Both fit the mechanism the eval fixture pinned down: the coach
  repeats numbers it is handed and gets wrong the ones it derives itself.
  Two things make this the cheapest it will ever be to do. The 96-debrief
  fixture is committed, the claim-accuracy grader exists, and the bench now
  reaches session 1, so the instrument is built and paid for; validating the
  grader is the one piece Slice 7b's pivot left undone. And the session-1
  rewrite is blocked behind it, because this project already decided that
  rewriting those swings needs the coach checked automatically rather than by
  hand. It needs live API calls, so it carries a real budget: roughly $1.50 to
  $3, to be scoped with the product manager before anything is spent.

  **Baseline measured 15 August 2026, ahead of scheduling this work:**
  re-grading 96 saved debrief transcripts for factual errors found 8, about
  one in twelve. See the Slice 7 postscript in the decision log for the
  breakdown by condition. Session 1, the screen where the product manager's
  own QA pass actually found an error, is not among the 96; the bench cannot
  reach it yet. One in twelve on measurable sessions is the number this work
  should improve against.

  **Annotation, 18 August 2026, at the close of Slice 8's build: the slice
  split at its first task, and the coach fix is now Slice 8b.** Validating the
  grader failed outright (right-reason catches 1 of 7), so Slice 8 became the
  instrument rebuild and the coach change moved to **Slice 8b**, scoped in
  full in `docs/queued-slices.md` under its own heading, reframed from four
  defects to one rule: count every threshold the prompt names. The instrument
  now passes its gate (8 of 8 right-reason, 20 of 96 flagged, about $0.63 a
  run), so Slice 8b is unblocked the moment Slice 8's PR merges. The
  "$1.50 to $3" budget above was consumed and exceeded by the validation
  itself; Slice 8b needs a fresh budget conversation before anything is spent.

  **Shipped 18 August 2026, and the result is a split, not a clean win.**
  Slice 8b pre-counted every threshold each goal's coaching instructions name
  and swapped in the two approved prompt sentences. Measured against 52 live
  debriefs before and after: the specific error that started this work, the
  coach inventing a subset count like "four of those were under 80 mph," is
  gone (8 occurrences before, 0 after). But the coach's overall accuracy did
  not improve. The same before/after check flagged 18 of 52 debriefs in both
  rounds, and the individual claim error rate ticked up slightly (5.6% to
  6.5%). A distinct error class the fix deliberately did not touch, the coach
  working out its own subset over pitch location data, sat completely flat at
  11 wrong claims in both rounds, which confirms the mechanism and names the
  next candidate. Spend: $2.38 of the $6 ceiling approved for this slice. Full
  numbers, the honest caveats on the grading tool, and the reasoning are in
  the decision log entry for 18 August 2026 and in
  `docs/eval-fixtures/slice8b-threshold-counts/README.md`.

  **Correction, 18 August 2026, from whole-branch review.** The "18 of 52
  both rounds, flat" figure above overstates how flat the result actually
  was. At least 5 of the after round's 18 flagged debriefs are the grading
  tool mismatching a coach statement it actually got right, because this
  slice's own new count lines gave the coach five kinds of number the tool's
  fact sheet has no matching stat for, a mismatch the baseline round could
  not produce because those goals never carried those count lines before
  this slice. Corrected for those, the comparison is roughly 17 flagged
  before against roughly 13 after: a modest real improvement, not a flat
  result. Detail and the five specific records are in the fixture README and
  the decision log's 18 August entry.

Slice A, Slice B and Slice C in any older note map to Slices 5, 6 and the
formerly-numbered-7 coach fidelity work above. Slice 5 shipped on 14 August
2026 but delivered only the second half of what Slice A covered;
`docs/queued-slices.md` records which half and why that was accepted.

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

   *Correction, 14 August 2026, from the owner.* The framing above is wrong and
   the entry is downgraded, not closed. Pulling up a chart from the chat is
   **intended behavior**: the coach may bring one up when it decides the player
   should see it, and the player may ask for one outright ("show me the spray
   chart"). Nor is the visitor stranded, because they can simply ask for the
   earlier chart again, or ask to go back. So "lost a chart with no way back" is
   not what happens, and this is not a defect. What may still be worth something
   is the **discoverability** question: nothing on screen tells a visitor that
   asking is possible. That is a much smaller item than the one written above,
   and it is no longer a candidate for the next slice.

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

   **Annotation, 24 August 2026: every clause of that entry is now false, and
   this one is kept only so nobody reads it as live.** The wording was decided
   on 3 August 2026, the same day this was written, and recorded on the What's
   Next list rather than here, which is how the two came to disagree. The card
   shipped as a micro-PR on 24 August 2026: it reads `LA 10–25° · Level it out`,
   and the range is read from `launchAngleRangeLabel('popup')` exactly as the
   last sentence above suggests. Nothing is open, and nobody needs to decide
   anything. See the entry at the bottom of this list, and `src/App.test.js` for
   the three tests that hold it.

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

**Postscript, 13 August 2026: the shelf decision above was reversed.** The
owner's other project reached its MVP milestone, and this project came off the
shelf that day. The four questions above are live again, not parked; work on
this slice started the same day. The block above is kept exactly as written
because it records what was true at the time it was written, not because the
shelf decision still stands.

### Queued, not parked

Everything below predates the Slice 4 close or came out of it as ordinary work.
It is queued behind the same shelf decision, but it was never put to the product
manager as a question, so it does not carry the "parked" status above.

*Annotation, 13 August 2026:* the "queued behind the same shelf decision" phrase
in the paragraph above is stale. That shelf decision was reversed on 13 August
2026, per the postscript further up, so nothing on this list is waiting on
another project any more. The original wording is left in place rather than
rewritten, per the append-only rule.

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
- ~~**Stream the debrief. Recommended next slice, added 13 August 2026.** A
  visitor watches a blank screen for 12 to 30 seconds before a word appears, and
  it is the thing they most feel about this demo. Slice 5 deliberately measured
  that wait and put honest words around its failures without reducing it; the
  real fix is showing the coach's text as it is written. Named as the next slice
  in the Slice 5 plan's own not-in-this-slice list.~~ **Declined by the owner on
  14 August 2026: the wait is fine as it is.** The recommendation had leaned on
  the 12 August audit's 20 to 30 seconds, but the only debrief measured end to
  end during Slice 5 took 12.06 seconds, and the owner judged that acceptable on
  a first click. Kept rather than deleted so nobody re-proposes it. Reopen only
  if measured latency climbs back toward 30 seconds, which is the number that
  made it look worth doing.
- **Tie the "40 seconds" wording to the deadline it describes.** Added 13 August
  2026, found while building Slice 5. The number is written out **twice** in
  `src/failureCopy.js`, once in the `timeout` message and once in
  `MID_WAIT_MESSAGE`, while the deadline itself is `UPSTREAM_DEADLINE_MS` in
  `api/coach.js`. Fix both or the job is half done. Change the constant and the
  copy silently becomes a lie, which is exactly the class of problem Slice 5
  existed to remove. Small; the awkward part is that the copy is approved wording
  and the constant lives across the browser/server boundary.
- **Decide what to say when the browser's own backstop fires, not the server's.**
  *Open, needs a copy decision from the product manager.* Added 13 August 2026.
  If the browser gives up at 50 seconds before the server answers, the app shows
  the timeout copy saying Anthropic did not answer within 40 seconds. The browser
  cannot know that: the request may never have reached Anthropic at all. It is a
  narrow case, since the server is meant to answer first by design, but it is a
  claim the app cannot prove, which is the standard Slice 5 set. Needs wording
  decided before anyone changes code.
- ~~**Test the `.env` guard, or decide it does not need one.** `protect-paths.mjs`
  blocks edits to `.env` files and has never been seen to fire. The template
  ships a test for it; this project has none, which is why that one drift line
  is still reported every session rather than recorded as deliberate. Adopting
  the template's version means translating it from TypeScript and dropping its
  database cases. Small, and it closes the last open drift line. Raised
  13 August 2026 while recording the other eight.~~ **Done 14 August 2026.** The
  guard now has 18 tests in `.claude/hooks/protect-paths.test.js`, seen failing
  in both directions first, and the drift report is clean for the first time. See
  the hooks section above. The guard has still never been observed firing in
  real use; what changed is that it is now proven to fire when it should.
- **A guard that refuses a commit on `main`.** Added 14 August 2026 after two
  commits reached main without a pull request; see the decision log entry for
  that date. Nothing mechanical stops it today, only the habit of checking the
  branch first, and that habit already failed once. Small, and it protects the
  one gate in this whole process that is not allowed to degrade.
- **Decide whether the `.env` guard should cover shell commands too.** Added 14
  August 2026, found by the review of the guard's own tests. `protect-paths.mjs`
  runs only on the file-editing tools, so it stops an agent editing `.env`
  directly and does nothing about an agent appending to it from a shell command.
  The guard is now proven to do what it does; this is about what it does not
  reach. Whether that is worth closing on a proof of concept is a judgment call:
  the realistic risk here is an accident rather than an attacker, and the key is
  spendable rather than readable either way.
- ~~**Pin the fifteen hand-written session-1 distances, or decide they do not
  need pinning.** Added 14 August 2026, found by the review of Slice 6. Session
  1 is not generated: it is fifteen swings typed out by hand in `src/App.jsx`,
  and their distances are the ones every visitor reads in their very first
  debrief. Nothing checks them. A reviewer changed one from 170 feet to a
  physically impossible 999 and all 326 tests stayed green. All fifteen are
  correct today, recomputed against the honest carry curve in Slice 6, so this
  is a missing safety net rather than a live defect. What makes it worth a
  line is that a wrong distance there is precisely the defect Slice 6 existed
  to remove, on the one screen a stranger is guaranteed to see. It got harder
  rather than easier in Slice 6, too: those fifteen swings now exist in five
  hand-maintained copies that must agree, in `src/App.jsx` and both scripts
  under `scripts/` in full, and in `src/coachApi.test.js` and
  `src/ballFlight.test.js` as the distances alone. Each copy is deliberate and
  explained where it sits, but a copy is also why the tests could not notice
  the 999. Deliberately left as a decision for the product manager rather than
  fixed on the way past.~~

  **Closed in Slice 7b, 17 August 2026.** The fifteen swings now live in
  `src/sessionOneSwings.js`, and a new test recomputes each one's stored
  distance from its own exit speed and angle via `carryDistance`, seen failing
  first against a reintroduced 999-foot mutation before being trusted. The
  five hand-maintained copies this bullet described are down to three:
  `src/App.jsx` and both scripts under `scripts/` now import the module
  instead of each carrying their own array. The two remaining copies, in
  `src/ballFlight.test.js` and `src/coachApi.test.js`, are deliberately
  unchanged, since they are expected values inside an assertion, not
  duplication left to collapse.
- **A committed reviewer config.** Slice 3 added tests and hooks but not this,
  so every code review here is still a session choosing to run one. Reviews have
  found real defects in each of the last two slices, which is the argument.
- **Consolidate the rules that still exist in several copies.** ~~The strike-zone
  boundary lives in six places and the distance buckets in three.~~ They agree
  today, rechecked 3 August 2026. The goal thresholds were the same shape of
  problem, had already drifted, and were consolidated in Slice 4, which leaves
  these two as the odd ones out. Still worth doing only if a third drift shows
  up; otherwise it is churn.

  *(Struck 21 August 2026. The distance buckets were consolidated in Slice 6,
  and the strike-zone count was an unchecked undercount. Slice 11 enumerated it
  by hand and closed two of the copies: it is now four in shipped code, five
  with tooling, six including the definition. The full census, and which sites
  they are, is in the known-debt entry above. The "only if a third drift shows
  up" trigger is unchanged and still governs the remaining four.)*
- **Rate limiting.** Deliberately deferred, see the cost section above. Only if
  the prepaid balance starts moving faster than the owner's own use explains.

*Added at the close of Slice 6, 14 August 2026:*

- ~~**Session 1's fifteen hand-written swings form an almost perfect straight
  line.**~~ Sort them by exit velocity and the launch angles climb in near-lockstep,
  so the first debrief's Launch Angle vs Exit Velocity scatter reads like a ruler
  rather than a hitter. Pre-existing, untouched by Slice 6, which deliberately
  changed only their distances. It is the same class of problem as the impossible
  distances: something a baseball-literate visitor notices on the first screen.
  Fixing it means rewriting the scripted session, which is a product decision
  about the demo's first impression, not a correctness fix. Natural companion to
  Slice 6b.

  **Annotation, 19 August 2026, from the product manager's QA pass on Slices 8c
  and 8d.** The straight line has a second consequence nobody had written down:
  it also guarantees an empty target zone on Line Drives & Contact. Every
  well-angled swing in session 1 was hit too softly and every hard-hit swing
  went too high, so not one of the fifteen meets that goal's ask of 8 to 18
  degrees at 85+ mph. The result is that the first screen of the second goal a
  visitor is likely to click carries zero on-target swings, in both the Launch
  Angle vs Exit Velocity chart and the Pitch Location chart. Nothing reads as
  broken, because the coach correctly says the angle is a tick too high, but
  there is no success anywhere on screen to look at. The generator's re-roll
  guard exists to stop exactly this and cannot reach session 1, which is
  hand-written rather than generated. So the rewrite is a first-impression
  question on two goals, not one, and the empty-band risk it removes is the
  same one the re-roll already protects sessions 2 to 4 against.

  **Both halves closed 19 August 2026, in Slice 9.** All fifteen swings were
  replaced. The exit-velocity-to-launch-angle relationship went from 0.975, a
  ruler, to 0.36, which is the generator's own median, and the first debrief's
  scatter now reads as a cloud in a real browser, not a diagonal. Line Drives &
  Contact's target band, which the annotation above says carried zero on-target
  swings, now carries two. Power's carries two, down from three on purpose:
  three was above what a later session typically produces, so a visitor
  clicking through all four sessions came in with fewer on-target swings than
  their first screen roughly seven times in ten. (Fewer, not none. An actually
  empty Power band is a different and rarer event, about one session in eight,
  and an earlier draft of this line said "emptied out," which overstated it by
  roughly six times.) Hit to All Fields, which had quietly never met its own stated
  ask of three pull and three opposite field, now gets three and four. One
  other visible change on that screen: the Distance Distribution chart's five
  bars move from 5, 3, 1, 3, 3 to 4, 4, 3, 2, 2, a flatter spread; review
  argued the old bimodal shape was itself a product of the ruler, and it was
  looked at in a browser before it shipped. Nothing
  downstream moved: both of session 1's averages were held to the exact same
  sums, which is pinned by a test against a snapshot of the old data. The full
  reasoning is in `docs/slice-9-plan.md` and the decision log entry for 19-20
  August 2026, and the coach was measured across 192 live debriefs before and
  after (`docs/eval-fixtures/slice9-session-one/`), coming out neither better
  nor worse overall, with one real win on the Contact first screen.
- ~~**`varianceFactor` has no test that can see it.**~~ **Closed 21 August 2026
  in Slice 11.** Now that the generator is its
  own module, a reviewer changed that constant six-fold and all 22 generator
  tests still passed, because every test drives noise at a neutral value. This
  does not matter until someone retunes the improvement arc, which is the queued
  item two above this one, and at that point it matters a lot. Worth pairing.
  *(Two fixtures now cover it, one resolving each of the two readings it
  multiplies, because the obvious single-fixture version was run rather than
  reread and proved not to catch a deletion from the exit velocity line. What is
  still blind is stated beside the tests: both read whole numbers, so a change
  to the 0.05 inside roughly minus 2 to plus 8 percent is absorbed by rounding.
  That band was swept, not derived.)*
- ~~**The coach is long-winded, and the type is too small, and these are one
  problem.**~~ **Shipped 14 August 2026 as Slice 7.** A concrete word budget
  (45/30/12/50) plus the eval bench this item asked for, both described above;
  type grew from 16px to 18px in the summary and 14px to 16px in the chat. The
  cost: grounded citations per debrief fell from 8.5 to about 6.1, and tips
  leading with a real number fell from 96% to 88%. See the decision log entry
  for 14 August 2026 for the full trade.
- ~~**The two font bumps are not equally risky.**~~ **Followed exactly in
  Slice 7.** The chat panel's 14px to 16px bump shipped with no incident; the
  summary panel's 16px to 18px bump was sized against the bench's worst
  measured box (72 words), not a typical one, and a fade now covers the case
  where a window is short enough to overflow anyway. See the deliberate
  decisions above.
- ~~**Session 1's rewrite needs the coach checked, and that check should not be
  done by hand.** The owner intends to fix the straight-line swings (see the item
  above) and named the real risk: he did significant prompt engineering against
  that data set and does not want a whack-a-mole hunt through sessions afterwards.
  He has explicitly handed that verification over rather than doing it himself.
  Do it with the same eval bench as the brevity work, grading whether the coach's
  claims still match the data over many runs, which is the argument for building
  the bench first and rewriting session 1 second.~~ **Half done 14 August 2026.**
  The eval bench this item asked for now exists (`scripts/bench-coach-brevity.mjs`),
  built in Slice 7. ~~What is still open is the session 1 rewrite itself and
  grading it through the bench once it exists as real data: both are blocked on
  extracting the fifteen hand-written swings into their own module first,
  which is the first task of the next slice.~~ See the bench's session-1 blind
  spot, described above.

  **Fully closed 19-20 August 2026, in Slice 9, and this is the item that slice
  most directly answers.** The rewrite happened, and the verification the owner
  explicitly handed over was done the way he asked: not by eye, but by 192 live
  debriefs across three rounds, before and after, with every flagged claim
  adjudicated by hand. There was no whack-a-mole hunt afterwards. The result was
  a null one, neither better nor worse, with one real improvement on the Line
  Drives & Contact first screen and zero parse failures across all three rounds.
  See the decision log entry for 19-20 August 2026 and
  `docs/eval-fixtures/slice9-session-one/`.
- **The distance-bucket drift test does not reach the chart.** Recorded in the
  known-debt section above with its reasoning. Only worth revisiting if this
  project ever grows rendering tests, which it deliberately has not.

*Added at the close of Slice 7, 14 August 2026:*

- ~~**Extract session 1's fifteen hand-written swings into their own module.**
  Needed so the bench can grade the first debrief a real visitor sees, rather
  than the pinned-average stand-in it uses today. First task of the next
  slice; the session-1 rewrite itself and the coach-fidelity check it needs
  both wait on this.~~ **Done in Slice 7b, 17 August 2026.** See
  `src/sessionOneSwings.js` above and the bench section's closed blind-spot
  note. Extracting it did not just enable measurement, it surfaced a live
  parse-failure bug; see the decision log. ~~The session-1 rewrite itself is
  still open.~~ **Done 19 August 2026 in Slice 9**; see the closed item above
  and the decision log entry for 19-20 August 2026.
- **The coach rounds numbers loosely.** The bench's own transcripts show it
  saying "320 feet or more" against a session whose real bucket was "305
  plus." Not invention, the number is in the right neighborhood, but not
  exact either. Worth a look if the citation-accuracy trade this slice made
  ever gets revisited. **A distinct, harder error class was found by QA on
  15 August 2026**: outright miscounts, not rounding, at roughly one in
  twelve measurable debriefs. See the coach fidelity item above for the
  baseline.
- **Widened 14 August 2026: nothing pins any prompt prose at all, not just
  the two sentences first named here.** The suite pins the budget's four
  numbers (45/30/12/50) and pins `DEBRIEF_SYSTEM` to equal
  `DEBRIEF_SYSTEM_BASE` plus a blank line plus `DEBRIEF_BUDGET`, but every
  word of `DEBRIEF_SYSTEM_BASE`, every word of the budget's surrounding
  wording ("count words, not sentences," "a vague tip that fits the budget
  is a failure"), and the anti-fabrication guard sentence ("Only reference
  specific numbers that appear in the session data") can all be rewritten
  with the suite staying green. Rewriting any of them would silently undo
  the reasoning that made the budget or the guard work, not just shorten the
  text. **A related limit on the test that does exist:** the drift test
  pinning `DEBRIEF_SYSTEM` to base-plus-budget is close to a tautology,
  because that concatenation IS how the constant is defined in
  `src/coachApi.js`. It bites for exactly one kind of drift, someone
  appending to or inlining something into the shipped constant instead of
  building it from the two pieces, and it cannot bite for anything else. A
  future reader should not mistake it for broader prompt coverage than that.
- **Confirm the shipped-prompt drift test actually bites.** It has only ever
  been seen failing for absence (the constant not existing yet), never for
  drift (the constant existing but having changed). Worth one deliberate
  mutation to prove a future edit to the prompt would turn it red.
- ~~**The dev server cannot be reached from a phone.** Vite binds to localhost
  only; neither `vite.config.js` nor `.claude/launch.json` passes `--host`.
  Separate from the layout question below: even a real phone on the same
  network could not currently load this app at all, so the standing
  real-phone-before-QA rule cannot be honoured for this project as
  configured.~~ **Closed as declined, 20 August 2026**, at the start of Slice
  11, where it had been written into the plan as a task needing approval. The
  owner: this app is consumed on a desktop or an iPad and does not need to work
  on a phone at all. So there is nothing to fix and nothing to declare. See the
  fourth verification norm above, which is where the rule now lives rather than
  being re-decided each time it surfaces.
- **At 390px wide, the chat panel's send button is entirely off-canvas, with
  no horizontal scroll to reach it.** Found during this slice's browser pass,
  pre-existing and not something this slice introduced. Worse than
  "cramped": the button and part of the text input sit past the visible
  right edge with no way to bring them into view. Matches CLAUDE.md's
  standing note that this app has no mobile layout, but this is the first
  time the specific failure was measured rather than assumed.
  *(Annotation, 20 August 2026: downgraded, not closed. 390px is a phone
  width, and this app is not asked to work on a phone. The measurement stands
  and is worth keeping, because it is the sharpest evidence of where the
  layout gives out, but it is no longer a defect to fix. The width worth
  checking is an iPad's, and nobody has measured that.)*
- **Three small cosmetic issues on the new summary-box fade**, none blocking:
  its gradient interpolates between two slightly different background
  colours rather than one colour fading to transparent; it sits on top of
  the scrollbar thumb rather than behind it; and its bottom corner radius
  assumes a panel corner radius it may not actually reach.
- **The product manager may want the summary body back at 16px, matching the
  chat panel exactly**, rather than the shipped 18px. A two-number change
  with no other consequence; 16px holds more words than 18px, so nothing
  about the budget would need to move.
- **Two chart-text changes shipped without the product manager's prior
  sign-off and he has not yet looked at them.** The Distance Distribution
  chart's bar-count labels moved from 10px to 11px, and the "In Strike Zone" /
  "Outside Zone" labels changed font family from Barlow to Barlow Condensed.
  Both were found mid-task while consolidating the chart label styles,
  disclosed after the fact, and verified in a browser, but neither was
  approved before it shipped. See the decision log entry for 14 August 2026.

*Added at the close of Slice 7b, 17 August 2026:*

- **The word "trend" means two different things in this app's prompts, and
  that ambiguity already cost one wrong instruction.** One meaning is a
  session being better or worse than a *prior* session, which is meaningless
  on session 1. The other is a session's own swings trending better or worse
  from swing 1 to swing 15 *within* one session, which is legitimate
  first-session coaching content and is exactly what the Exit Velocity Trend
  chart already shows. The single-session instruction this slice shipped and
  then deleted forbade both, because it never distinguished them. Nothing
  broke as a result this time, an isolation experiment showed the instruction
  was not doing anything anyway, but a future prompt change could easily lean
  on the wrong meaning without anyone noticing. Any future prompt wording
  about trends should say plainly which kind it means. Cheap to keep in mind,
  costs nothing to action now; recorded so the next prompt edit does not
  repeat the mistake.
- ~~**The "What This Means" floor, deferred, not dropped.**~~ **Dropped
  18 August 2026, from the product manager's QA pass on PR #26.** He reviewed
  three live debriefs and judged the boxes comfortably filled, with no dead
  space that reads as blank or broken, so the floor work is off this list for
  good rather than deferred again. The approved wording stays on file in
  `docs/slice-7b-plan.md`, under "Settled before work started," if it is ever
  wanted later.
- **The chat panel's 17px bump, still deferred, not dropped.** Scoped and
  worded before Slice 7b pivoted to the session-1 parse-failure bug instead.
  The approved wording is kept on file in `docs/slice-7b-plan.md`, under
  "Settled before work started." Whoever picks this up next should ship from
  that wording rather than re-deriving it.
- ~~**Validate the claim-accuracy grader against the committed fixture.**~~
  **Done in Slice 8, 17-18 August 2026, and the validation failed before it
  passed**: the original grader caught the known errors for the right reason
  once in seven, its judgment was rebuilt into code, and the rerun caught 8 of
  8 right-reason at a 20-of-96 flag rate. See the Slice 8 entries in the
  decision log and `docs/eval-fixtures/slice8-grader-validation/`. The
  original bullet follows as written:
- **Validate the claim-accuracy grader against the committed fixture.**
  `scripts/grade-coach-accuracy.mjs` and `scripts/factSheet.js` are built, and
  the fact sheet has unit tests, but the grader itself was never run in its
  validation mode against the 8 known-wrong debriefs in
  `docs/eval-fixtures/slice7-debriefs/` before the slice changed direction.
  Until that runs, the grader's verdicts should not be trusted for anything.
  Note what `--validate` itself does and does not produce: it deliberately
  never names the 8 known-wrong records and reports only what it flagged, so
  it does not compute a recall number on its own. Comparing that output
  against the 8 by name is a separate, blind, manual step done once by
  whoever runs it, so the resulting score is an honest test rather than a
  number the grader was fitted to produce. See the methodological note at the
  top of `scripts/grade-coach-accuracy.mjs` for why that split is deliberate.
- ~~**The coach's "four of those" miscount is still live on the first screen,
  and is now reproducible on demand.**~~ **Fixed 18 August 2026 in Slice 8b.**
  Pre-counting every threshold the goal's own prose names, plus one new rule
  telling the coach never to count or tally swings itself, took this exact
  error class from 8 occurrences to 0 across 52 measured debriefs. See the
  decision log entry for 18 August 2026. The coach's overall accuracy did not
  otherwise improve; see the two new items below for what is still open.
- **Whether the session-1 parse failure has always been happening to real
  visitors is unknown, and may not be answerable in hindsight.** Session 1 was
  not measurable by any tool before this slice's own extraction work, so there
  is no earlier data to check it against. Recorded rather than guessed at.
- **Both `scripts/measure-swing-generation.mjs` and
  `scripts/compare-distance-bucket-schemes.mjs` are unseeded, and no number
  either has ever printed is a fixed measurement rather than one draw.**
  Confirmed by running the same untouched code twice in a row: the Power
  goal's empty-band figure read 56.6% on one run and 57.3% on the next. This
  is the mechanism behind the Slice 6 entry above quoting a "9.7% to 16.8%"
  nobody could reproduce: nothing printed by either script has ever been
  reproducible, and any number quoted from them going forward should be read
  as one sample from a moving target, not a fixed fact, unless a seed is
  added.
- ~~**A stale comment in `scripts/bench-coach-brevity.mjs`, around lines 41 to
  42, claims `npm test` "reported 11 files and 326 tests before this file
  existed and must report 11 and 326 after."** Both numbers have been stale
  since Slice 7; the suite is now 392 tests across 16 files. The file-count
  proof technique the comment describes is still sound. Only the two numbers
  inside it need updating.~~ **Fixed by whole-branch review, 17 August 2026.**
  Numbers corrected to 16 files and 392 tests and the claim dated, so it reads
  as a measurement from a day rather than a permanent count.
- **The shipped tip budget is not being obeyed, and never was.** The 50-word
  ceiling on `tip1` reads 67 to 82 words in every measurement taken of it:
  Slice 7b's own before run (mean 72.4), its after run (mean 68.4), and
  Slice 7's own committed condition-B fixture (mean 71.0), which is the exact
  data the 45/30/12/50 budget was chosen from. Pre-existing, not introduced by
  this slice, and not something the length-budget prompt text can be edited to
  fix without product sign-off (see the deliberate-decisions annotation
  above). Needs a decision: raise the number to match what the coach actually
  writes, or decide the prompt wording needs to change to hold it down, which
  is the one prompt change this review is not authorized to make on its own.

*Added at the close of Slice 8b, 18 August 2026:*

- **The coach still self-derives over pitch location data, and that is the
  natural next target.** Slice 8b pre-counted every threshold named in a
  goal's own coaching prose and fixed the exact miscount class it targeted.
  The same before/after measurement shows a distinct error class, the coach
  working out its own subset of swings against pitch location numbers (for
  example which named swings landed outside the strike zone), held completely
  flat at 11 wrong claims in both the before and after rounds. That is the
  same mechanism this slice just proved works: pre-count it, and the coach
  should stop getting it wrong the same way "four of those were under 80 mph"
  stopped. Not started; needs its own scoping pass to find where pitch
  location gets described in prose without a matching count, the same way
  `docs/queued-slices.md` did for launch angle and exit velocity.

  **Annotation, 18 August 2026, from the product manager's QA pass on PR
  #26.** "The coach should stop getting it wrong" is too strong a promise for
  what pre-counting delivers. The same QA pass caught a case on Hit to All
  Fields where the coach was handed a correct count directly and still
  contradicted it in the very next sentence. Pre-counting sharply cuts the
  miscount rate; it is not a guarantee. See the two new What's Next items
  below for the specifics.

  **Annotation, 19 August 2026, from Slice 8c.** The simple version of this
  is fixed: the coach is now handed which swings sat outside the strike zone
  and which way each was off, and the live before/after comparison (hand-
  checked, not the raw grader count) shows genuine pitch-location errors
  falling from 6 to 3 across 52 debriefs each round. What is left is
  narrower than "the coach invents pitch-location groupings" broadly. In
  every one of the 3 remaining cases the coach already held the right
  whole-session total and still misstated the count when intersecting it
  with a different named group it had established earlier in the same tip,
  for example "four of those [under-15-degree swings] were on pitches below
  1.5 feet" when the true overlap between that named group and the
  low-pitch group is 3, not 4. The zone count lines this slice added are
  totals, not per-swing intersections, so an intersection between two
  handed groups is still something the coach derives for itself. That is
  the next scoping question for whoever picks this up, not a claim that
  this slice's fix did nothing. Full numbers and the hand-check are in
  `docs/eval-fixtures/slice8c-strike-zone-counts/README.md` and the decision
  log entry for 19 August 2026.
- **The claim-accuracy grader's false-positive rate has never been measured.**
  The grader was validated in Slice 8 for recall, whether it catches known
  coach errors, and it does. It has never been checked the other way: how
  often it flags a debrief that was actually correct. Slice 8b's after-round
  grading turned up at least one clear case by hand, a debrief saying "nothing
  cleared 265 feet" that the grader flagged against a fact-sheet row that
  actually agrees with the sentence. This does not undo any comparison the
  grader has been used for so far, since both sides of a before/after
  comparison get graded by the same tool the same way, but a single flagged
  claim should not be read as proof of a coach error without a by-hand check,
  and nothing currently measures how often that check would be needed.

  **Correction, 18 August 2026, from whole-branch review.** The "both sides
  of a before/after comparison get graded by the same tool the same way"
  sentence above is the exact overstatement whole-branch review flagged for
  Slice 8b specifically. The tool was unchanged between the two rounds, but
  the fact sheet it grades against was not kept in step with Slice 8b's own
  prompt change, which is what the next item below describes. At least 5 of
  the after round's 18 flagged debriefs are that mechanism rather than a
  coach error; see the fixture README and the 18 August decision-log entry
  for the corrected comparison.

  **Annotation, 19 August 2026, from Slice 8c.** Still not a formally
  measured false-positive rate, and that item is not closed by this slice.
  But this slice's own by-hand check of every flagged claim in both of its
  rounds found the tool's false-positive rate is not small: 2 of 15
  before-round flags and 10 of 21 after-round flags were the grader calling
  a true statement false, on two named mechanisms. One of them, a "none of
  them exceeded X" claim graded as a value mismatch instead of the
  complement it is, is the identical bug this bullet already named for
  "nothing cleared 265 feet," and it recurred 8 times across both rounds of
  this slice alone (5 times on "nothing got out past 265 feet," 3 times on
  "none of them broke 80 mph" and its paired launch-angle claim). That
  recurrence is why this item's priority is going up, not down: a bug this
  slice keeps tripping over by accident is a stronger argument for measuring
  it on purpose than the single case that first named it. See
  `docs/eval-fixtures/slice8c-strike-zone-counts/README.md` for every
  flagged claim in both rounds, judged genuine or false positive by hand.

  **Measured, 19 August 2026, in Slice 8d.** Two fresh live grading rounds,
  hand-checked claim by claim after the complement-bug guard and the
  matching extraction-prompt wording landed: 2 of 18 flagged claims (11%)
  were false positives in one round, 8 of 19 (42%) in the other. At the
  debrief level, the false-positive-only count on the same two rounds Slice
  8c graded moved from 2 of 15 and 10 of 21 down to 0 of 11 and 6 of 16. The
  complement bug named above is effectively closed at the source: it fired
  zero times in either fresh round, because the extraction prompt now
  structures that sentence shape correctly on its own, with the
  deterministic guard proven as a backstop by a separate zero-cost replay
  rather than by these live rounds. **Still not closed, and still worth
  watching**: every remaining false positive in both rounds traces to two
  mechanisms this slice deliberately left unfixed, a named subset of swings
  checked against a whole-session total, and a restated threshold read as an
  exact value, plus one newly seen variant where the extractor
  misclassified which stat a sentence was even about. 42% false positives in
  a round is not a small number, so a raw flag from this tool still needs
  the same by-hand look this slice gave both rounds before it is reported as
  a coach error. Full accounting, including which quotes triggered which
  mechanism, in `docs/eval-fixtures/slice8d-grader-fp/README.md`.

  **Measured again, 20 August 2026, in Slice 9, on three fresh rounds: 12.5%,
  34.5% and 40% of flagged claims were the tool being wrong.** Consistent with
  the 11% to 42% band above, so the band is holding, and the rule stands
  unchanged: a raw flag is a lead, not a finding. One thing Slice 9 adds that
  the earlier measurements could not see, and it matters for any before-and-
  after comparison run with this tool: **the false-positive rate was not even
  across the rounds, and it was worse on the after side specifically**, because
  the most common mechanism fires on sentences the coach only began writing
  after the change being measured. An unchecked flag count comparing the before
  round against the first after round would have reported the coach getting
  roughly 80% worse (16 flags against 29) when the hand-check says it did not
  change at all. Note that the second after round flagged 15, below the before
  round, which is the same point from the other direction.

  **Corrected 20 August 2026, by whole-branch review, and the correction
  matters more than the sentence it replaces.** This entry originally said the
  two mechanisms Slice 8d named and left unfixed "are still the ones doing
  it." Counted against HAND-CHECK.md's own mechanism table, they are not, and
  they are not even the majority: a named subset checked against a
  whole-session total accounts for 3 of the 18 false positives and a restated
  threshold read as an exact value for 7, which is 10, leaving **8 from five
  mechanisms nobody had seen before**: a value matched against the wrong swing
  when an ordinal phrase is read as a swing index (3), an illustrative list
  read as exhaustive (2), the named-swing check firing on an empty list (1), a
  hedged quantifier turned into a count of zero (1), and an exclusion word
  ("five *other* swings") dropped in extraction (1). The fixture README's own
  wording was more careful and did not carry this error. The practical
  difference: reading the tool as having two known holes invites the
  assumption that its failures are understood and bounded, when in fact more
  than half of this wave's mechanisms were new, and one of them turned out to
  be an outright logic bug (see the next entry). Every flagged claim in all
  three rounds is adjudicated in
  `docs/eval-fixtures/slice9-session-one/HAND-CHECK.md`.

  **Measured again, 20 August 2026, in Slice 10, on one fresh round, and this
  one is ABOVE the band: 13 of 21 flagged claims, 61.9%, were the tool being
  wrong.** The recorded band was 11% to 42% across five previous rounds, so the
  band as written no longer holds and the honest read is that this rate is
  unbounded rather than settled. Two of the mechanisms behind it had never been
  seen before, which is another wave in a row producing new ones. The
  rule does not change, it only gets firmer: a raw flag is a lead, not a
  finding, and nothing from `grading.json` reaches a report without a by-hand
  read. Every flagged claim is adjudicated in
  `docs/eval-fixtures/slice10-direction-key/HAND-CHECK.md`.

  **A second round the same day, after the QA gate sent the slice back, came in
  at 43.5%: 10 of 23 flagged claims were the tool being wrong.** A shade above
  the older 11 to 42 band and well below 61.9, which reads as one wide spread
  rather than a trend in either direction. It changes nothing about the rule. Two things are worth carrying: no NEW tool mechanism appeared
  in this round, the first time that has been true, but two mechanisms recurred
  on the *identical sentence in the identical cell* one round apart, which says
  the known ones are stable and fixable rather than random. Adjudicated in
  `docs/eval-fixtures/slice10-direction-key/HAND-CHECK-after-spray.md`.
- **The grading tool's fact sheet was never updated for the five new counts
  Slice 8b added, and that is what caused the false positives above.** Found
  by whole-branch review, 18 August 2026. `scripts/factSheet.js`'s
  `sessionStatsExtras` still produces the old Power-only stats (a count of
  swings under 15 degrees, and a count in Power's own zone) for every goal
  regardless of whether that goal's coaching prose still mentions them, and
  it produces no matching stat at all for any of the five new counts Slice 8b
  added to Contact, Hit to All Fields and Reduce Pop-Ups. When the coach
  correctly repeats one of those five new counts, the grading tool checks it
  against the nearest old stat instead of the right one and calls a true
  statement false. This is the direct mechanism behind at least three of the
  five false positives named in the Slice 8b correction above. Not fixed in
  this wave; fixing it means giving the fact sheet one matching stat per
  count line the prompt can now hand the coach, preferring the inclusive
  bucket when the coach's phrasing is inclusive, and re-grading both rounds
  (roughly $0.58) to get a clean comparison.

  **Closed 19 August 2026, in Slice 8c.** `scripts/factSheet.js` is now
  goal-aware: `sessionStatsExtras` reads `goalCountValues` for the goal
  actually being graded, so a goal gets its own counts and no others, and
  the Power leak this item described is gone. The fact sheet also grew
  `pitchHeight` and `pitchSide` rows, seeded from the same `STRIKE_ZONE`
  bounds the prompt now uses, so pitch-location threshold claims became
  rulable for the first time. Both rounds in
  `docs/eval-fixtures/slice8c-strike-zone-counts/` were graded with the
  fixed tool.

*Added from the Slice 8b browser QA pass, 18 August 2026:*

- ~~**Count the strike-zone thresholds too, naming which swings were on
  pitches outside the zone.**~~ **Shipped 19 August 2026 in Slice 8c.** The
  coach is now handed four unconditional lines naming which swings sat
  outside the strike zone and which way each was off (high, low, wide), built
  from `pitchZoneBreakdown` in `src/sessionStats.js`. A live browser pass on
  a real session-1 Power debrief confirmed the four lines reach the actual
  request the app sends, and the coach repeated its handed zone counts
  correctly on screen. The measured result is a real reduction, not a full
  fix: hand-checked genuine pitch-location errors fell from 6 to 3 across 52
  debriefs each round, and the 3 that remain are all one narrower failure,
  the coach intersecting a handed zone total with a different named group of
  swings on its own. See the annotation on the item above and
  `docs/eval-fixtures/slice8c-strike-zone-counts/README.md` for the full
  numbers.
- ~~**Align the fly-ball wording from 20 degrees to 18.**~~ **Shipped 19
  August 2026 in Slice 8c.** The coach's instructions now say "angles above
  18 degrees are fly balls, not line drives," matching Line Drives & Contact's
  own 8-to-18 band ceiling in `src/goalTargets.js`, so one number governs the
  goal and the 18-to-20 gap swing 10 of session 1 used to fall into is
  closed.
- ~~**Fix the "1 swings" grammar in the generated count lines.**~~ **Shipped
  19 August 2026 in Slice 8c.** Every generated count line, the four goal
  count lines and the distance-distribution line alike, now reads "1 swing"
  for a count of exactly one, via a shared `swingCountPhrase` helper in the
  new `src/promptText.js`.

*Added 19 August 2026, from the conversation that closed Slice 8b:*

- ~~**Measure how often the coach contradicts a count it was handed**, as
  opposed to one it worked out for itself.~~ **Measured 19 August 2026 in
  Slice 8c.** Pooled across both of this slice's 52-debrief rounds (104
  debriefs graded), the coach contradicted a number it had been handed
  directly on 4 of them, roughly 1 in 26. That is worse (more frequent) than
  the one-in-fifty trigger the product manager set in advance for building
  the fill-in-the-numbers approach below, so that decision is now live and
  waiting on him, not still parked. One honest caveat: the sample is small
  and lopsided, not diverse. 3 of the 4 flagged debriefs are the identical
  pattern, reciting two adjacent prior-session averages in the wrong order
  ("down from 83 and 84" when it was the other way around); the fourth is a
  distinct off-by-one on a target-zone count. Four events is not enough to
  trust a rate to one significant figure, and this measurement does not
  claim to. Full numbers in
  `docs/eval-fixtures/slice8c-strike-zone-counts/README.md`.
- **Decided not to have the app write the coach's numbers itself, for now,
  and the trigger for revisiting has now fired.** The one approach that
  would make a contradicted count impossible is to let the coach write the
  sentence and have the app fill in the figure. It was deliberately parked
  on 19 August 2026, because it makes the coach's prose more rigid exactly
  where it sounds most human, and one wrong sentence was not enough evidence
  to spend that. The trigger agreed in advance was piece 5's measured rate:
  roughly one debrief in fifty means build it, closer to one in several
  hundred means leave it alone. That measurement is in now (see the item
  above): roughly one in 26, past the one-in-fifty line, with the sample-size
  caveat stated there. **This is now an open product decision for the
  product manager, not a closed one**, and this document does not decide it
  on its own. The rule and the full reasoning are recorded with Slice 8c in
  `docs/queued-slices.md`.

*Added at the close of Slice 8c, 19 August 2026:*

- **A committed grading run carries no record of its own era, seed, or
  flags.** `scripts/grade-coach-accuracy.mjs`'s output JSON has no field
  naming which `--handed-era` it was run with, which `--seed`, or which other
  flags were set, so a committed grading transcript found later cannot prove
  from itself which prompt generation it graded against. This slice worked
  around it by naming the era in the file path and the README instead, which
  is legible today but is not something a future script could check
  automatically. Found while building this slice's before/after comparison;
  cheap to add, no live spend required.
  **(Dated addition, 19 August 2026, whole-branch review.)** The same
  missing-era-record gap has a concrete edge already: `scripts/factSheet.js`'s
  `sessionStatsExtras` computes `contactFlyBallCount` from today's
  `GOAL_COUNT_SPECS` regardless of `--handed-era`, so grading a `slice8b`-era
  record against it silently uses the current 18-degree cutoff instead of the
  20-degree cutoff the coach was actually handed then. This did not produce
  any false result in this slice's committed rounds, but it is the shape of
  bug this item exists to catch, and it is one more argument for recording
  the era on the run itself rather than only in the file path.

  **Closed, 19 August 2026, in Slice 8d.** A saved grading run now names
  itself: `--out` writes `{ meta, results }`, where `meta` carries the era,
  seed, model and builder a run was graded under, so a committed result can
  prove from itself which prompt generation it graded rather than relying on
  its file path. Files written before this slice stay bare arrays; the new
  `scripts/gradingOutput.js` module and the replay script both read either
  shape, so nothing older had to be rewritten to close this.
- ~~**The power-goal "below 15 degrees" count line prints a dangling
  "numbers:" when the count is zero.** Found by the browser-pass payload
  capture on a real session-2 request, which happened to have zero swings
  under 15 degrees. The line renders as "Swings with launch angle strictly
  below 15 degrees (not including 15): 0 swings, numbers:" with nothing
  after the colon. Cosmetic and invisible to a visitor since it lives inside
  the prompt the coach reads, not the screen, but it is a coach-prompt
  change and needs the same approval any other prompt wording change gets
  before it ships.~~ **Fixed 20 August 2026 in Slice 10**, with the product
  manager's approval, using the same conditional `zoneCountLines` already
  used four lines below it. **One** test was seen red first, the zero case.
  The second test, which pins the common case unchanged, was green from the
  start and never could have been anything else: the old line appended its
  numbers clause unconditionally, and for a non-empty list that produces
  byte-identical text, so the test does not touch the buggy path at all. It
  is a shape guard against a future edit, not red-first evidence, and this
  project's own bar was met once here rather than twice. Note what the live
  evidence does and does not cover: no session in the browser run produced a
  zero count, so the branch was exercised through the shipped module in the
  browser rather than by a live request; see
  `docs/eval-fixtures/slice10-direction-key/browser-payload-capture.md`.

*Added at the close of Slice 9, 20 August 2026:*

- ~~**The coach is never told which sign means pull, on five of the six goals.**
  Each swing's spray direction reaches the coach as a raw signed number
  (`src/coachApi.js:532`) and only the Hit to All Fields goal context
  (`src/coachApi.js:57`) says which way is which. So on Power, Contact,
  Pop-Ups, Open Session and the rest, the coach guesses, and on the very first
  Power debrief rendered during this slice's browser gate it called an
  opposite-field ball a pull-side ball. Pre-existing and not caused by Slice 9.
  It is the same error class the whole Slice 8 series worked on, a number the
  coach has to interpret without being told how, and it is probably the
  cheapest remaining accuracy fix in the app. **It is a prompt wording change,
  so it needs the product manager's approval on the exact sentence before it
  ships.** Strongest candidate of everything on this list.~~ **Shipped 20
  August 2026 in Slice 10**, on approved wording, as one exported constant
  interpolated into both prompts immediately above the swing data it explains.
  **It ships with no accuracy claim attached, deliberately.** The error class
  appears in 0 of 112 measured non-All-Fields debriefs, so no bench round at
  this scale could detect its effect; the one round bought landed inside a
  pre-registered null band and is reported as the null it was predicted to be.
  Read it as insurance, not as an improvement. See
  `docs/eval-fixtures/slice10-direction-key/README.md`.

  **Amended later the same day, and the amendment is the important half.** The
  wording above never shipped. It said "negative direction is pull side," and
  the product manager's browser QA pass caught the coach naming six pull-side
  swings on session 1 while the spray chart beside it coloured three. What
  shipped is the wording that names the cutoffs, plus three pre-counted spray
  lines per session on every goal, all reading one constant. The "no accuracy
  claim" framing above still stands and the second round did not change it, but
  the defect the second round was bought to check IS measurably fixed. See the
  second decision log entry for 20 August 2026.
- ~~**A generator-realism slice, carrying three things measured in Slice 9 and
  deliberately not fixed there.**~~ **SHIPPED 21 August 2026 as Slice 11, and it
  grew from three items to eight.** All three below are closed: the zone gap
  went from 0.00 mph to about 4.6, spray now leans pull and stops narrowing
  every session, and pop-ups exist at about ~~0.40~~ 0.43 a session with four in
  five of
  them off high pitches. The coupling this entry warned about was checked rather
  than assumed and did not bite: `carryDistance`'s shape term floors above 28
  degrees, but the highest angle the generator actually produces is 47 and the
  carry values at 47, 48, 49 and 50 are still distinct, so `src/ballFlight.js`
  needed no behaviour change and has none anywhere on the branch. The five items
  that were added alongside them, all measured defects rather than scope creep:
  out-of-zone pitches were off on both axes at once 100% of the time; the exit
  velocity ceiling described a near-elite hitter; the generated hitter was 31%
  tighter than the session he is derived from; the session-to-session step was
  dishonest; and the hard clamps parked ~~4.138%~~ about 4% of Power session-4
  swings on
  exactly 35 degrees. See the decision log entry for 21 August 2026, the "data
  is synthetic" section above, and `docs/slice-11-plan.md`. The original entry
  follows as written. *(Both struck numbers corrected 21 August 2026 by the
  whole-branch review; the full correction, and why the decimals were unbacked,
  is in the "data is synthetic" section above.)*

  All three change sessions 2 to 4, which is
  why they were kept out of a slice whose whole measurement depended on those
  sessions not moving. **Before touching `src/swingGenerator.js`, read the
  fixture-marker item added at the close of Slice 10 below: repairing four
  committed directories' markers is this slice's first task, not an
  afterthought.** (a) *Pitch location does not predict contact quality at
  all.* Session 1 has an 8.8 mph gap between swings on strikes and swings on
  balls, put there by hand; the generator's gap, across 4,000 sessions, is
  0.0 mph, because the pitch and the outcome are drawn independently. Since
  Slice 8c the coach is handed which pitches were outside the zone and reasons
  about them out loud, so on every generated session that reasoning is a
  coincidence. (b) *The pull and opposite-field bias runs the wrong way against
  the 65/35 rule*, the same miscalibration Slice 9 fixed inside session 1. (c)
  *Reduce Pop-Ups names a failure that cannot happen*: the goal calls a pop-up
  anything above 35 degrees and the generator clamps launch angle at exactly
  35, so across 360,000 generated swings the pop-up count was zero and the
  coach is handed "0 swings" forever. Coupling to re-check, not assume, if the
  clamp is raised: `carryDistance`'s shape term floors above 28 degrees, so a
  60 degree pop-up would currently be credited with a respectable fly-ball
  distance. Explicitly rejected while scoping: giving Pop-Ups an exit velocity
  requirement, because that makes it and Line Drives & Contact one goal with
  two names.
- **The coach over-generalises about a group of swings it has named, and the
  product manager decided to accept that rather than hide it.** It habitually
  calls the three low pitches "all flat and weak." That was true of the old
  session 1 by coincidence and is false of the new one, and it accounts for six
  of the 28 genuine coach errors across Slice 9's two after rounds. Recorded
  rather than fixed on purpose: re-tuning the swings to make the sentence true
  again would restore the uniformity Slice 9 existed to remove. If anything
  about the coach's accuracy is worth a follow-up, it is this one sentence
  shape, not the aggregate rate.
- **Two test files hold their own copies of session 1's distances and cannot
  notice when session 1 changes.** `src/ballFlight.test.js:184` and
  `src/coachApi.test.js:831` each carry a hardcoded array rather than importing
  `src/sessionOneSwings.js`, so both stayed green with stale data after Slice 9
  swapped all fifteen swings. They were updated by hand and are correct today.
  The point is that nothing would have said so. Small; the awkward part is that
  they are expected values inside assertions, which is exactly the shape this
  project has previously and correctly declined to collapse.
- **The eval bench cannot run one cell.** There is no `--cell` flag, so
  measuring a single screen costs a full seven-cell round, roughly $1.10. This
  turned a planned $0.15 measurement in Slice 9 into a $1.11 one. Worth adding
  the next time a live round is being bought anyway; not worth a slice of its
  own.
- ~~**`CONTACT_CORRELATION` does not hold a correlation.**~~ **Closed 21 August
  2026 in Slice 11**, and the number moved while it was being written down. The
  constant reads `0.6`, is applied to both readings, and so produced 0.36; the
  shipped figure is now 0.23, because the pop-up pairs a high launch angle with
  a soft exit velocity and pulls against the blend. Both numbers, and the fact
  that the pop-up rather than the constant is what changed, are recorded beside
  the constant in `src/swingGenerator.js`. **Whether the 0.23 was worth spending
  a constant on was asked and answered no**: session 1's own 0.361 sits at the
  65th percentile of the generated per-session distribution, whose interquartile
  width is 0.49, so on a fifteen-dot scatter the move is invisible. The reasoning
  is finding 9 in `docs/slice-11-plan.md`, and the statistic to use if anyone
  revisits it is where session 1 sits in that distribution, not the gap between
  two medians.
- ~~**`scripts/search-session-one-swings.mjs` hand-copies the generator's own
  exit-velocity and launch-angle clamps**~~ **Resolved 21 August 2026 in Slice
  11, deliberately as a frozen copy rather than as an import.** That script's job
  is to reproduce one historical search, the Slice 9 search that chose the
  fifteen swings that shipped, and pointed at today's generator it would search a
  different space and could not reproduce that result. Both values are now named
  `FROZEN_EV_CLAMP` and `FROZEN_LA_CLAMP`, so the warning travels in the
  identifier rather than in a comment nobody opens, and the header says plainly
  that the generator has no hard clamps at all any more. Do not make either track
  the live generator.
- **Every prior session's individual swings are printed into the coach's
  prompt in full**, so a session-4 debrief carries session 1's fifteen swings
  verbatim. Not a defect and nothing is asked here; it is recorded because it
  means there is no such thing as a bench cell unaffected by a change to
  session 1, which is a fact any future measurement design has to start from.
  Slice 9 was scoped believing the opposite and had to buy a second seed
  instead of a control group.

*Added 20 August 2026, from the whole-branch review that closed Slice 9. All
three are the grading tool rather than the coach, and all three were found
inside `docs/eval-fixtures/slice9-session-one/HAND-CHECK.md`, which is a
finding in itself: that document is a per-claim adjudication nobody will
reread, so anything it discovers has to reach this list to survive.*

- ~~**The named-swing check fires on an empty list of named swings** (M4 in the
  hand-check's table). A claim carrying the CORRECT count and naming no swings
  at all was ruled FALSE, "the count matches but the named swings do not",
  because the guard tested `Array.isArray(statedSwings)` and an empty array is
  still an array.~~ **Fixed 20 August 2026, and measured rather than
  asserted.** `scripts/claimVerdict.js` now requires `statedSwings.length > 0`,
  with a test seen failing against the old code first. Because this changed the
  instrument after the measurement, all three committed rounds were re-run
  through the fixed verdict code offline with `scripts/replay-grading.mjs`, at
  zero cost and with no re-extraction: **1,583 claims replayed, exactly 1
  verdict changed**, the after-b claim "Nine of your fifteen swings came out
  above 18 degrees" going FALSE to TRUE. Round totals move only there (after-b
  raw flags 15 to 14, flagged debriefs 14 to 13); the before and after-a rounds
  are byte-identical under the new code. No hand-checked conclusion moves at
  all, because the hand-check had already adjudicated that one claim a false
  positive. Kept here rather than deleted so nobody re-proposes it, and so the
  next person to change a verdict rule sees that replaying the committed rounds
  is the expected way to do it.
- **The extractor assigns a claim to the wrong statistic entirely** (M5, and
  the single largest source of false positives in this wave at 7 of 18). It
  graded "sub-175-foot balls" against the count of swings under 15 degrees,
  "12 of 15 strikes" against a pitch-side value, "11 strikes" against the
  high-pitch count, and an average against the top exit velocity. Unlike M4
  this is not a logic bug with a one-word fix: the mis-assignment happens in
  the extraction model's output, and the same sentence was extracted correctly
  in other runs of the same round, so it is non-determinism rather than a
  stable rule and the fix is extraction-prompt wording plus, most likely, a
  deterministic sanity check that a claim's units match the statistic it was
  filed under. Deliberately not attempted on 20 August 2026: validating any
  extraction-prompt change needs a fresh live grading round to measure, which
  is real spend, and doing it blind is how an instrument gets fitted to the
  answer it is supposed to test. **This one is not neutral for before/after
  work and should be fixed before the tool is used for another comparison**:
  four of the seven fire on a sentence shape the coach only began writing after
  the change being measured ("cut your sub-175ft balls from 4 down to 1"), so
  the tool over-flags the after side specifically.
- **Five of the seven false-positive mechanisms in this wave had never been
  seen before**, which is the number worth carrying forward rather than any
  individual mechanism. Each new measurement round has turned up new ways for
  the tool to be wrong, so the honest reading is that its failure modes are not
  yet enumerated, and "a raw flag is a lead, not a finding" is a standing rule
  rather than a caveat that will expire once a known list is worked through.
  The remaining four beyond M1 and M5, one case each or thereabouts, are an
  ordinal phrase read as a swing index, an illustrative list read as
  exhaustive, a hedged quantifier ("most") turned into a count of zero, and an
  exclusion word ("five *other* swings") dropped in extraction. All four are
  adjudicated case by case in the hand-check.

*Added 20 August 2026, from the fix wave that closed the `looksLikeBenchRecord`
predicate bug (`scripts/inputRecords.js`). Both are about the grading tool's
own self-checks, not the coach.*

- **Nothing runs the grading tool's free dry run automatically, and no test
  asserts it exits 0.** `--dry-run` exists precisely so a slice can prove the
  instrument still works before any money is spent, but that gate was itself
  silently dead for this entire slice: it refused every `--input` directory
  holding even one failed bench record, and nothing noticed until a human ran
  the command by hand at final review. The same shape of bug will recur the
  next time a slice hands the tool a new kind of file to read, because the one
  check meant to catch it was not wired into anything automatic. Cheap fix:
  one test, or one hook, that shells out to `--dry-run` and asserts a zero
  exit code.
- **Four of the grading tool's guardrail self-checks still count ANY exception
  as a pass.** The four `try { ... } catch (err) { guardOk++; console.log(...)
  }` blocks in `scripts/grade-coach-accuracy.mjs` around lines 1245 to 1272
  (the "Builder-selection guardrails" printed in every dry run) log the
  caught message but never check it says what it is supposed to say, so a
  guardrail that throws for the wrong reason, or a caller-side bug that throws
  before the guardrail is even reached, still prints "ok." This is the
  identical defect this same fix wave just corrected one seat over in
  `looksLikeBenchRecord`, and the three marker-provenance guards just below
  those four in the same file were already tightened this way on 20 August
  2026 (see that block's own comment for what a bare catch let through). Left
  alone here because these four only exercise argument validation against
  paths that do not exist, which is lower-stakes than the marker guards, but
  the fix is the same shape: assert on the message, not just that something
  was thrown.

*Added at the close of Slice 10, 20 August 2026:*

- **The coach now says which way "pull" is on the field, and the app has never
  recorded whether the hitter is right or left handed.** Found in the product
  manager's own merge-gate QA pass, in a reply that was otherwise perfect: it
  described the pull-side swings as going "hard left of center" and the
  opposite-field ones as "right of center." That is correct for a right-handed
  hitter and wrong for a left-handed one, and nothing in the data says which
  Bill is. It is not a contradiction of the screen: the spray chart already
  draws pull to the left, so the app has always quietly assumed a right-handed
  hitter, and the coach is agreeing with it. What changed is that the
  assumption is now stated out loud in prose a visitor reads, where before it
  was only implied by a chart's geometry. Small, and it is the same shape as
  every other item in the Slice 8 series: a fact the coach infers because
  nothing hands it one. Two ways to close it, and they are a product choice
  rather than an engineering one: add handedness to the player and hand it to
  the coach, or tell the coach not to name a field. Do not close it by
  changing the chart. **Recorded rather than fixed on the way past**, because
  it surfaced at the merge gate and it is a prompt-wording change, which
  needs the product manager's approval on the exact sentence.

- **Four committed fixture directories will start rebuilding the wrong swing
  data the moment `src/swingGenerator.js` changes, and repairing their markers
  is Slice 11's first task, before the generator is touched.** *(Dated
  correction, 20 August 2026: five, not four. Slice 10's second round,
  `slice10-direction-key/after-spray/`, has the identical exposure and its own
  marker says so.)* The `current`
  builder reads the generator out of the working tree, not only session 1, so
  `slice9-session-one/before/`, `slice9-session-one/after-a/`,
  `slice9-session-one/after-b/`, `slice10-direction-key/after/` and
  `slice10-direction-key/after-spray/` would each
  re-grade against a complete, entirely plausible fact sheet for sessions 2 to 4
  that no coach ever saw, with nothing appearing broken. Slice 9's three markers
  say nothing about it, because they were written believing session 1 was the
  only moving part. Fix them as dated annotations rather than rewrites, and give
  the Slice 10 round a frozen generator snapshot at the same time. The full
  statement of the trap is in
  `docs/eval-fixtures/slice10-direction-key/after/BUILDER.txt`.

  **Closed 20 August 2026, in Slice 11's first task, before the generator was
  touched.** All five markers repaired as dated annotations, with the old
  `builder = current` line left struck through above the new one on the four
  that changed. The generator itself is now snapshotted at
  `docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs`, and a builder
  names a pair (which fifteen session-1 swings, which generator) instead of
  just a baseline. What makes this stick rather than rely on somebody
  remembering: a record of exactly what the old generator produced, for every
  cell at every seed, was written from the live code and committed on its own
  first, and `npm test` now rebuilds all of it and fails if a single swing
  moves. The trap is not closed by a comment; it is closed by a test that
  cannot be green and wrong at the same time.

  **Corrected again later the same day, and this correction is the useful one:
  it was six directories, not five, and the sixth was the one that mattered
  most.** Six review passes over the repair above all counted five. The missing
  one is `docs/eval-fixtures/slice7-debriefs`, the 96 saved debriefs this
  project uses to check that its grading tool can actually spot a coach error.
  The tool is pointed at that fixture automatically every time that check runs,
  so a generator rewrite would have re-checked the tool against a set of swings
  no coach in the fixture ever saw, and then reported that the tool was fine.
  It hid because that directory had already frozen its own first session and its
  own list of cases, so it read to everyone as a directory that had solved this
  problem; it had solved half of it, and took the part that builds sessions 2 to
  4 from the live app. Closed the same day as Task 1b: it reads the frozen copy
  now, its swings are in the same record as everything else, and two more tests
  hold it there. **One residual, which Task 4 will meet**: that fixture still
  asks the live app how far a ball carried, because the frozen copy of that
  formula cannot be reached without weakening a different guard. It is watched
  rather than prevented, and exactly what the watch does and does not catch is
  measured in that file's own header. If Slice 11 ends up touching
  `src/ballFlight.js`, freeze the carry formula; never adjust the record.

  **Corrected later the same day, and the corrected version is the one Task 4
  needs.** Two things above are wrong in the reassuring direction. "Cannot be
  reached without weakening a different guard" was a decision, not a
  constraint: what the pinning rule blocks is reaching into the frozen file
  itself, and a separate frozen copy of the carry formula beside it would need
  no such weakening. It was declined because this project consolidates hard
  against a second copy of a live formula and the fixture is covered today, and
  that is a judgment Task 4 may revisit. And "watched rather than prevented"
  undersells the watch: measured both ways, the only carry changes the record
  cannot see are ones this fixture never exercises, because its first session is
  built at a fixed seed and none of its forty-five balls is hit steeply enough
  to reach the uncovered part of the formula.

- **A carry-formula cover that comes from the data, not from the wiring, and
  nothing would announce it going away.** Added 20 August 2026, from the item
  above. The 96-debrief fixture's protection against a change to how far a ball
  carries holds only because its stand-in first session is built at a fixed seed
  and happens to contain no steeply hit ball. ~~Change how that stand-in session
  is built, its seed, or its limits, and the cover quietly stops applying with
  every test still green.~~ Nothing guards that today. The fix, if it is ever
  wanted, is a frozen copy of the carry formula for that fixture to read, which
  turns an accident into a guarantee. Small, and only worth doing if
  `src/ballFlight.js` is being opened anyway.

  **Struck sentence corrected 21 August 2026, by review, and the correction
  matters because that sentence was the whole warning.** It was false, and
  false about its own named mechanism: changing that stand-in's seed turns
  four tests red, loudly, because the record pins all forty-five of its balls
  individually. Raising its angle limit does stay green, but only because no
  ball reaches the limit, which means the cover did not change either. The
  sentence had confused what CREATES the cover (a fixed seed, and a record
  that pins every ball) with what creates the gap (no ball hit steeply). What
  is true:

  the cover is complete for the shallow half of the carry formula and absent
  for the steep half, because none of the fixture's forty-five stand-in balls
  exceeds 28 degrees. That absence is a property of the data rather than a
  stated requirement, so a future slice that legitimately re-pins the record
  could change which half is covered without any test saying so.
- ~~**Pre-count pull, centre and opposite field on every goal. A candidate slice,
  now with live evidence behind it, and it is a product expansion rather than a
  fix.**~~ **Shipped the same day, 20 August 2026, in the second half of Slice
  10, because the browser QA gate turned it from an expansion into part of the
  fix.** The rejected prompt left the coach with a definition of pull that the
  spray chart did not share, and the only way to make the two agree was to hand
  it the counts from the chart's own constant. So the decline recorded below was
  correct on the evidence it had and was overtaken within hours by evidence it
  did not have. Everything it warned about was paid: the fact sheet got matching
  rows in the same change, and the slice bought its own eval round. **The
  predicted product cost landed too**: the coach now writes about spray in 24 of
  64 debriefs, up from 9, which is a much larger surface for a future spray
  error, and the grading tool sees very little of it. The original entry stands
  unedited below, because the reasoning that declined it is the part worth
  keeping. Slice 10 gave the coach the direction key in words; this would give it
  the counts. It was deliberately declined then, on a measurement: across Slice
  9's 128 committed debriefs the coach says anything about where balls went in
  10 of 16 Hit to All Fields debriefs and in **0 of the other 112**, so counting
  spray on the other five goals creates new behaviour on screens where spray is
  not what the player asked about, competing for a word budget the coach already
  overruns. **What changed the case is one live reply.** Asked directly which
  swings went to the pull side, the coach stated the convention correctly,
  unprompted, and got every sign right, then contradicted its own grouping three
  times in one answer: swing 15 under pull side and again up the middle, swing
  10 under pull side and again opposite field, and 13 degrees called opposite
  field while 11 degrees was called up the middle. The approved sentence gives
  no countable boundary, by design; the plan predicted the improvisation but not
  that the same swing would land in two buckets. **The cost is not one prompt
  line.** It must extend `scripts/factSheet.js` in the same slice, because an
  uncounted new stat is exactly what manufactured Slice 8b's false positives,
  and it must buy its own eval round. Read the live reply as a lead: it is one
  answer to a question written to force spray grouping, on a topic the coach
  raises by itself in 0 of 112 measured debriefs. Evidence in
  `docs/eval-fixtures/slice10-direction-key/browser-payload-capture.md`.
- **Two more grading-tool failure mechanisms, and one of them is free to fix.**
  (a) **A handed distribution bucket re-derived with an inclusive upper bound.**
  `DISTANCE_BUCKETS` is half-open, so a 305-foot ball belongs to `305+`; the
  tool recomputes `265-305` inclusively, sweeps that ball back in, and turns a
  correctly repeated handed 5 into a "should be 6". **Deterministic, in the
  verdict code rather than in extraction**, so it is cheap to fix and can be
  validated by replaying the committed rounds offline at zero cost, the route
  Slice 9 used for its M4 fix. Strongest candidate of the tool items. (b) **The
  denominator of an "N out of fifteen" phrase absorbed as the numeric
  threshold**: "Four swings hit the target zone out of fifteen" became a
  threshold test at 15 degrees. That one sits in extraction and cannot be
  validated without a fresh live round. Both are adjudicated case by case in
  `docs/eval-fixtures/slice10-direction-key/HAND-CHECK.md`.
- **The M5 non-neutrality warning now has a named cell.** M5 accounted for 7 of
  Slice 10's 13 false positives, and **four of those seven are the same sentence
  in the same cell**: Power session 2's "you cut your under-175-foot swings from
  4 down to 1", a correctly repeated pair of handed distance-bucket numbers
  graded against a launch-angle count. Any comparison including the `power-s2`
  cell carries roughly four spurious flags from that one sentence shape, so a
  raw flag-count delta between two rounds is not usable without a hand-check of
  at least the M5 candidates. This sharpens, and does not replace, the standing
  M5 entry above saying the tool should be fixed before it is used for another
  before/after comparison.
- **Six scoping findings from Slice 10 live in `docs/slice-10-plan.md`, under
  "The findings this slice produced that are not fixes", and are not restated
  here.** Two of them are Slice 11 material and are the reason to read that
  section before scoping it. **Finding 1**: on Power session 4, 1,886 of 45,000
  generated swings (4.2 percent) sit at exactly 35.0 degrees because the
  generator clamps launch angle there, drawing a flat row of dots pinned to the
  top edge of a chart every visitor sees. That is the same class of first-screen
  credibility defect as the impossible distances Slice 6 removed, and it was
  recorded nowhere before now. **Finding 2**: Hit to All Fields meets its own
  stated bar of at least 3 pull and 3 opposite field only 64 percent of the time
  at session 2, 59 percent at session 3 and 52 percent at session 4, because
  spray direction is multiplied by the shrinking variance factor, so a visitor
  who picks that goal and clicks through watches the demo get worse at its own
  goal. The other four cover a free stopping point at 50 degrees in
  `carryDistance`, session 1 having zero pop-ups, the builder trap Slice 9's
  markers do not anticipate, and why the before-baseline was free.

  **Findings 1 and 2 both closed 21 August 2026 in Slice 11, and both were
  confirmed on screen rather than only in a table.** The flat row at 35 degrees
  is gone: ~~4.138 percent~~ about 4 percent of Power session-4 swings sat on
  exactly that value and
  it is now ~~1.385 percent~~ about 1.4 percent spread across a smooth tail
  *(both corrected 21 August 2026 by the whole-branch review, which found the
  three decimal places came from an uncommitted task report and could not be
  rerun from the seeded script; see the "data is synthetic" section)*,
  and the browser pass found
  Power session 4 a clean cloud topping out at 33 with nothing on the edge. Hit
  to All Fields meets its own bar at a flat 72 to 73 percent at every session. The
  builder trap is closed too, by the frozen snapshot and its digest. The 50
  degree stopping point in `carryDistance` was checked and needed nothing.

*Added 20 August 2026, later the same day, from the second round of Slice 10
work, the one that happened after the browser QA gate rejected the slice. All of
these came out of the round that measured the prompt that actually shipped.*

- **The coach can take a count it was handed and attach it to the wrong side of
  its own threshold, and pre-counting cannot fix that.** The prompt said "Swings
  with exit velocity 85 mph or higher: 6 swings." The coach wrote "Six of your
  swings came in under 85 mph." The number is copied correctly and the sentence
  is inverted around it; the true answer is 9. Every coach error of this family
  this project has recorded before was a miscount or a transposition, which
  handing over the number fixes. This one is not, which makes it a real limit on
  the strategy the app has used since Slice 8b. **This is not a new proposal.**
  It is fresh, independent evidence for the open decision already on this list,
  the one about letting the coach write the sentence and having the app fill in
  the figure, whose trigger CLAUDE.md already records as fired and which is
  waiting on the product manager. Nine of the shipped round's 13 genuine errors
  rest on a handed number, against zero of eight in the round before it, so the
  pattern is worth weighing when that decision is taken. Detail in
  `docs/eval-fixtures/slice10-direction-key/HAND-CHECK-after-spray.md`, claim 13.
- **Two grading-tool coverage gaps, both about claims that never get ruled on at
  all, rather than claims ruled wrongly.** These matter more now than they would
  have last week, because the shipped prompt makes the coach write both sentence
  shapes far more often. (a) **A spray count can be extracted as a `threshold`
  claim carrying no comparison, and then falls out as UNVERIFIABLE.** Seen on
  `power-s2/run8`: "You put five swings to the pull side in Session 2" was
  extracted with `comparison: undefined`, reasoned as `unknown comparison`, and
  never ruled. It was wrong, the handed count being 6. (b) **The prior-session
  half of a cross-session comparison is never extracted.** On `open-s4/run5` the
  coach wrote "five swings go opposite field this round, up from three in
  Session 1 and four in Session 3." The tool extracted the first half only and
  correctly ruled it TRUE. The error is in "three in Session 1," where the truth
  is 4, and that half produced no claim at all.

  **One correction to the record while these are being written down.** ~~Both
  hand-check documents say~~ **Corrected 20 August 2026, by final review: only
  ONE hand-check document says it, twice.** `HAND-CHECK-after-spray.md` says at
  its lines 159 and 725 that the tool "has no spray statistic", and both places
  now carry a dated annotation saying otherwise. `HAND-CHECK.md` does not
  contain the word "spray" at all. The claim itself is still the thing to
  ignore, and a future session should not act on it:
  `scripts/factSheet.js:164-170` carries all three spray counts and their swing
  numbers per session, added in the same change as the prompt lines, and one
  spray sentence in this round was ruled TRUE off those rows. The ground truth
  is there. What is missing sits in extraction and in the verdict path, which is
  what the two gaps above describe.
- **The fact sheet's three spray rows are not era-gated, so totals from this
  tool are no longer directly comparable to older committed rounds.**
  `sessionStatsExtras` adds `pullSideCount`, `upTheMiddleCount` and
  `oppoFieldCount` unconditionally, regardless of `--handed-era`. That is right
  for ground truth, since where a ball went does not depend on which prompt
  generation the coach read. It is wrong for comparability: a pre-Slice-10 round
  re-graded today gets rows the coach was never handed, so its claim totals and
  its handed-versus-derived split shift for reasons that have nothing to do with
  the coach. This is the same shape as the residual era leak already recorded
  against `contactFlyBallCount`, and it is one more argument for the same fix.
- **`scripts/handedCounts.js` returns a `sprayLines` field that nothing reads.**
  Added in Slice 10 alongside the era rule that direction counts are handed on
  every goal, which the grader does use. The field itself has no consumer
  anywhere in the repo, unlike its neighbour `zoneLines`, which at least has
  tests asserting on it. Either wire it up or drop it; a returned value nobody
  reads is the sort of thing a later session mistakes for a working signal.
  Tiny, and only worth doing next time that file is open.

*Added 20 August 2026, from the final review that closed Slice 10:*

- **Hit to All Fields gets its pull and oppo counts handed to it twice.** That
  goal's own two count lines and the universal spray count lines every goal now
  receives say the same thing in near-identical words. The numbers cannot
  disagree, since both run the one `sprayBreakdown` and a test pins them equal,
  so this is not a correctness bug. It is prompt bloat on the goal whose coach
  overruns its word budget most often, and it was disclosed only inside a test
  comment until now. **The option:** drop that goal's own two lines and let the
  universal ones serve it, which removes two lines from the prompt and changes
  no number. It is a coach-prompt change, so it needs the product manager's
  approval on what the prompt ends up saying, same as every other one. Small,
  and worth pairing with whatever prompt slice comes next rather than doing
  alone.
- **The spray chart's four cutoff literals are watched, not consolidated.** The
  guard added at the close of Slice 10 reads `src/DebriefScreen.jsx` as text and
  fails the suite if any of its four hardcoded -15 and +15 stop matching
  `SPRAY_CUTOFFS`. That is a tripwire. The chart still does not read the
  constant, and this project has deliberately declined to touch the screen file
  for a prompt fix twice now. Only worth closing if the screen file is being
  opened for another reason; the tripwire is the cheap 90% and the remaining
  10% costs a browser pass.

*Added at the close of Slice 11, 21 August 2026. The generator items sit first
because they are the ones a visitor could see; the tooling items follow.*

- **The chat coach's chased-pitch fix is "did not reproduce", not "fixed", and
  the difference is the whole entry.** Slice 11's browser gate caught the chat
  coach contradicting both the pitch chart beside it and its own debrief text
  above it, twice out of two attempts. The four approved zone count lines were
  moved into the chat prompt and it then answered three replies correctly. But
  **session 1, the only independently reproducible check, carries no pitch within
  0.05 feet of a zone edge**, and a near-boundary pitch is exactly the condition
  the gate identified as the trigger. The second check did exercise it and was
  right, on a generated session with no seed recorded, no payload captured and no
  screenshot archived, so it rests on narration. Three replies cannot carry
  "fixed" against a defect with a two-of-two base rate. What would close it: one
  seeded session that puts a pitch within a hundredth of a foot of an edge,
  captured.
- **The chat prompt's two approved lines are guarded against being removed or
  reworded and NOT against being MOVED, and one line closes it.** Found in Slice
  11's Task 3 review, proven rather than argued: a reviewer relocated the two
  lines into the per-session block, where they would repeat once per session
  instead of appearing once at the top, and got a fully green suite. The drift
  test at `src/coachApi.test.js:1408-1450` cannot catch it, because it uses
  `toContain` plus a first-match regex, and `text.match(...)[0]` takes the first
  hit wherever it sits. **The fix is one line: assert the chat setting line
  occurs exactly once, and before the first "Session 1:".** It matters more than
  its size because this is the chat prompt, which is where the last two browser
  QA gates both caught a real defect. Recorded here on 21 August 2026 by the
  whole-branch review, because it had reached no committed document at all: it
  lived only in the slice's own gitignored controller ledger, which does not
  survive the slice.
- **The coach can be handed every count it needs and still get the arithmetic
  BETWEEN two counts wrong, and this is fresh evidence for a decision already
  waiting on the product manager.** Asked to total chases across two sessions, it
  gave both per-session breakdowns correctly and then reported their sum as 5
  where 2 plus 2 is 4. No count line spans sessions, so a sum over two handed
  counts is still something the coach derives. Pre-counting fixes miscounts and
  does not do arithmetic. This is not a new proposal: it is evidence for the open
  "let the app write the figure and the coach write the sentence" decision whose
  trigger this file already records as fired. Slice 10 produced the other half of
  the same evidence, a handed count attached to the wrong side of its own
  threshold.
- **Launch angle is not monotone in pitch height, and it inverts against session
  1.** A ball chased above the zone comes out about two degrees flatter than a
  strike down the middle, where the hand-written session the whole demo is
  calibrated to says it should be the steepest thing on the chart. Structural
  rather than a tuning slip: two effects reach launch angle from the pitch at
  fixed relative strength, and making the top of the zone beat the middle needs a
  weight near 1.14, which cannot exist. Fixing it means a different structure and
  would want its own reasoning. Recorded rather than fixed, in
  `docs/slice-11-plan.md` finding 8, and the pop-up mechanism was built to create
  the high-pitch pop-up outright rather than lean on this tendency, which is why
  nothing visible follows from it today.
- **The "nothing stacked above 0.5 percent" guard is measured pooled, and a
  visitor looks at one chart.** Per cell the share of swings on the 94 mph
  ceiling runs 0.22 to 0.87 percent and six of the fifteen goal-and-session cells
  are over the line, worst on Power session 2. Five were already over before this
  slice at 0.56 to 0.68, so it widened an existing breach rather than breaking a
  held guard, and no visible defect follows: 0.87 percent is 0.13 of a swing on a
  fifteen-dot chart, against 4.00 percent one step inside. **What is wrong is the
  guard, not the generator**, and repairing it is a product choice between
  restating it per cell at a level this generator can hold, near 1 percent, or
  leaving it pooled and saying so in the target. Whoever tunes next should know
  that the pooled number will keep understating Power session 2.
- **The mis-hit pop-up rate is chosen, not derived.** No real TrackMan pop-up
  rate was consulted for the ~~0.40~~ 0.43 a session this slice shipped
  *(corrected 21 August 2026; 0.40 was the four-non-Power-goals figure with its
  qualifier dropped, see the "data is synthetic" section)*. It reads
  plausibly and it was tuned against the goal's own coaching prose rather than
  against the sport. Only worth revisiting if a real number ever turns up.
- **Every count-line test in `src/coachApi.test.js` uses a single-session
  fixture**, so a multi-session corruption of any of them, zone, spray or goal
  counts alike, passes the suite. Measured rather than assumed: computing the
  chat zone lines from the first session for every session block, and emitting
  them only on the session 1 block, each leave 96 of 96 passing. Pre-existing and
  uniform across the file. Cheap to close and worth doing next time that file is
  open for another reason.
- **Two grading-tool bugs from this slice's hand-check are deterministic, sit in
  the verdict path, and are therefore free to validate by offline replay.** The
  larger: a signed pitch-side coordinate is ruled against a coach quoting an
  unsigned distance off the plate, five occurrences in one round, every one of
  them on a correct sentence. The other: an "N out of fifteen" denominator is
  absorbed as a fabricated fifteen-element list of named swings, which walks
  straight through the guard Slice 9 added for the empty-list case. Both are the
  cheapest instrument fixes available and neither costs a live call. Detail in
  `docs/eval-fixtures/slice11-generator-realism/HAND-CHECK.md`.
- **The tool's false-positive rate set a new record at 64.0 percent, and five of
  the mechanisms behind it had never been seen before.** The series now reads 11,
  42, 12.5, 34.5, 40, 61.9, 43.5, 36.8, 30.0, 64.0 percent. **Four of the five
  new mechanisms are about pitch location**, which is exactly what this slice
  made the coach write about more, so the tool's blind spots moved with the
  product. The standing rule is unchanged and only firmer: a raw flag is a lead,
  not a finding, and a raw flag-count delta between two rounds is not usable
  without a hand-check. Five genuine coach errors also went UNFLAGGED and were
  found in passing, three of them sharing a shape the tool cannot see, a correct
  fact and a wrong pitch-location characterisation in one sentence.
- **Seven committed record directories carry no `BUILDER.txt` at all**, including
  the Slice 8b, 8c and 8d rounds, which have the same multi-session exposure this
  slice spent its first two tasks repairing elsewhere. Nobody has checked whether
  those rounds are stranded. Small each, and the honest first step is to find out
  rather than to write markers.
- **`docs/eval-fixtures/slice7-debriefs/diag-12-14.mjs` has been broken since
  Slice 7b**, pointing at a scratch directory that no longer exists. Either fix
  the path or delete the file; a script that cannot run is worse than no script,
  because it reads as available.
- **Four pre-existing lint errors**, three unused parameters in
  `scripts/claimVerdict.js` and an undefined `Buffer` in
  `scripts/frozenGenerator.test.js`. Confirmed pre-existing by stash and left out
  of lane. They ride along with the lint-wall item already queued in Slice 6b.
- **`rebuild.mjs`'s own binding to the frozen snapshot has never been
  demonstrated to bite.** The experiment that proved a builder reaching for the
  wrong generator turns the suite red covered one loading route; the three
  `slice7-debriefs` cells reach the snapshot through their own separate binding
  and stayed green throughout it. That binding is covered by the data digest, so
  this is a gap in the proof rather than a known hole, but anybody citing that
  experiment must say which route they mean. Cheap, and worth doing next time
  anything opens that directory.
- **The measurement script counts the EDGES of a distribution and not its
  middle.** Proven by fixture: 18 percent of all swings piled on one interior
  launch angle and the report correctly stayed quiet, because its claim is scoped
  to edges. So an interior pile-up at a knee rather than a saturation point would
  go unreported. It has also never rendered a chart. Both limits are printed in
  the script's own closing section; this line exists so nobody has to run it to
  find out.

*Added 24 August 2026, from the pitch-window micro-PR. All three are small and
none is blocking.*

- **The pitch chart's chevron has no legend entry.** About one session in three
  now draws at least one open chevron at the side of the Pitch Location chart,
  meaning a pitch landed outside the window the chart draws. Hovering it gives
  the true coordinate, so nothing is hidden, but a reader who does not hover has
  to infer what the mark means, and on Hit to All Fields it sits beside a legend
  showing three other shapes. Deliberately not solved on the way past, because
  the chevron appears on every goal while that legend only exists on one, so a
  fourth legend row is not the obvious answer and the right fix is a design
  question rather than a code one.
- **A pitch landing on exactly the edge of the window is drawn as a normal mark
  half-clipped by the frame.** Pinning the horizontal axis also clips that chart
  to its plot area, so a dot centred on exactly 1.20 feet loses its outer half.
  This is a true statement about a pitch that really is at the edge, rather than
  a mark moved there, and it is rare: measured over 900,000 generated pitches,
  about one pitch in a thousand, which is about one session in seventy. Recorded
  rather than fixed because every alternative is worse: nudging the mark inward
  would be the false-position problem the chevron exists to avoid.

  **Corrected 24 August 2026, by the review of this same change, and the
  correction is a factor of five rather than a quibble.** The entry above framed
  a continuous phenomenon as a discrete one. The clip rect is the plot area
  exactly, so it cuts ANY mark whose centre sits within its own radius of the
  edge, not only one centred on it. The marks are 5px circles and 10px squares
  rotated 45 degrees, whose half-diagonal is a little over 7px. Re-measured over
  900,000 pitches at the two plot widths this chart actually renders at in a
  browser, 243px and 273px: **0.50% of swings and 7.2% of sessions** carry at
  least one visibly cut mark, which is about one session in fourteen rather than
  one in seventy. The two widths give the same answer because pitch positions are
  rounded to the hundredth of a foot, so the band either takes a whole hundredth
  or it does not. The severity tapers off, since a mark one hundredth inside the
  edge loses a sliver rather than half of itself, so this stays cosmetic and the
  decision not to fix it is unchanged. What was wrong was the size of it.
- **Reading a Recharts chart's geometry straight after a synthetic viewport
  resize gives stale numbers, and it wasted time here.** Measuring the marks
  immediately after resizing the browser showed them apparently sitting outside
  their own plot area, which looked like a real defect and was not: the chart had
  not finished re-laying out. It reproduces on `main` and on charts this change
  never touched, and everything is correct after a few seconds or on any fresh
  load. Recorded so the next person to check a chart this way waits before
  believing the numbers, and screenshots rather than only measuring.

*Added 24 August 2026, from the micro-PR that fixed the Reduce Pop-Ups goal
card. The card itself is done and came off the Slice 6b list; these two are what
that pass surfaced.*

- ~~**The Reduce Pop-Ups goal card points the wrong way.**~~ **Done 24 August
  2026.** The card read `LA < 0° ↓ · Drive more`, which described the opposite
  of the goal it labelled, on the goal-picker screen a visitor sees second. It
  now reads `LA 10–25° · Level it out`, the wording approved on 3 August 2026,
  with the range read from `src/goalTargets.js` the way the Power and Contact
  cards already read theirs. Kept here struck through rather than deleted
  because the Slice 6b entry further up still lists it as one of its six items;
  that entry is now five.

- ~~**The README needs a full audit and rewrite, not a line fix. Strongest
  documentation candidate on this list.**~~ **SHIPPED 25 August 2026 as Slice
  13**, and it took the whole-rewrite scope this entry argued for rather than the
  two flagged lines. The goal list, the missing install and run lines, the
  differently-named API keys and the stale description of the coach and the
  hitter are all closed, and `.env.example` now exists. Five further defects this
  entry had not named were found and fixed: no unaffiliated-with-TrackMan
  disclaimer, a cold-start warning pointing at the page load rather than at the
  coaching response, nothing about what the app says when a call fails, nothing
  about the model's chart choices being validated, and Line Drives and Contact
  listed as two goals. The CLAUDE.md Tailwind sentence this entry ends by naming
  is corrected too. **The product decision inside it, which was the real work:**
  the README tells the whole arc, product discipline throughout and engineering
  discipline retrofitted late, rather than staying quiet about it. See the
  decision log entry for 25 August 2026 and `docs/slice-13-plan.md`. The original
  entry follows as written. It is the first thing a stranger
  reads, it is the front door of a portfolio piece, and it has not been touched
  since 30 July 2026, which is before six slices of work. Two of its problems
  are already scoped as Slice 6b items 6 and 7 in `docs/queued-slices.md` (no
  install line, no run line, no mention that local development needs a
  differently-named API key than production; and a goal list naming Power, Line
  Drives, Contact as separate goals when the screen shows "Power & Distance" and
  a single "Line Drives & Contact" card, while omitting Full Dashboard
  entirely). **Those two are the smallest part of it.** What has actually gone
  stale is the description of the product: the README describes the coach and
  the data in terms that predate the whole Slice 8 accuracy series, the Slice 9
  rewrite of the fifteen session-1 swings, and the Slice 11 rewrite of the
  generator, so a reader is told about a coach and a hitter this app no longer
  has. It also carries a cold-start warning paragraph whose future depends on
  the Vercel Pro item below. The honest scope is a fresh read of the repo and a
  rewrite from what is now true, not a patch to the lines that are known wrong,
  because the lines nobody has flagged are the ones that have quietly aged.

  **One correction to make before starting, because two of this project's own
  documents disagree.** CLAUDE.md's own Stack section, around line 234, says
  "The README and the decisions log both advertise Tailwind, which overstates
  it." The README half of that is stale and has been since 14 August 2026:
  `README.md:24` reads "Tailwind is installed but used only minimally," which is
  accurate, and both `docs/queued-slices.md` (item 6) and
  `docs/product-decisions-log.md:1374` record that overclaim as already fixed
  and verified on that date. The decisions log half is still true, at
  `docs/product-decisions-log.md:5`, but that is a dated historical entry the
  append-only rule protects, not a claim to correct. So the Tailwind work here
  is one sentence in CLAUDE.md, and it is not a README job at all. Found on
  24 August 2026 while scoping this entry.

*Added at the close of Slice 13, 25 August 2026:*

- ~~**`docs/proof-of-concept.md` has aged the same way the README had, and nothing
  has been done about it.**~~ **SHIPPED 25 August 2026 as Slice 14**, and it took
  a larger reframe than this entry proposed. Rather than refreshing the stale
  parts, the document moved to the job the README cannot do: the README says what
  the app is, this says whether the bet paid off. Its centre is now nine lessons
  for anyone building a virtual coach, each carrying its own incident and number
  from this project. **What review caught before it shipped is the part worth
  remembering:** the draft used the one-in-twelve error rate as a before-and-after
  when it is only a never-re-run baseline, which is the exact flattering-direction
  mistake the document's own seventh lesson warns about. See the decision log
  entry for 25 August 2026 and `docs/slice-14-plan.md`. The original entry follows
  as written. It is the second document a curious reader opens, it
  is linked from the README's own Documentation section, and it was last touched
  before the whole Slice 8 accuracy series, the Slice 9 rewrite of session 1 and
  the Slice 11 rewrite of the generator. Two things in it are now visibly stale:
  it says hallucination risk is managed by pre-computing "key swing counts and
  summaries", which is true but describes an early version of a mechanism that
  four later slices measured, corrected and measured again; and its "what comes
  next" section predates everything those slices found. Deliberately left out of
  Slice 13, which was scoped to the README. Its own slice, and a smaller one than
  the README turned out to be, because the product thesis in it has not changed.
- **Nothing checks the README's claims, and five of them are generator numbers
  that a future tuning slice would move silently.** The chase rate, the mph gap
  between a swing at a strike and a swing at a ball, the pop-up rate, the
  one-axis miss and the no-pile-up claim were all verified against a fresh seeded
  run of `scripts/measure-swing-generation.mjs` on 25 August 2026. They are prose
  in a Markdown file, so no test can see them. **The cheap version of a guard, if
  this is ever wanted, is not a test but a line on this list**: anyone reopening
  `src/swingGenerator.js` re-reads the README's synthetic-data section. Recorded
  rather than built, because guarding prose costs more than it returns on a proof
  of concept, and because the same drift is what put the README six slices behind
  in the first place.
- **`.env.example` is a third place the two API key names are written**, beside
  `vite.config.js` and `api/coach.js`. It carries no values, so a drift there is
  cosmetic rather than dangerous, and it is the file the README now tells a
  stranger to copy. Recorded so nobody is surprised to find a third copy.

*Added 26 August 2026, from the repo cleanup micro-PR:*

- **The lint wall is closed at 3 errors, and the 3 are deliberate.** It was 30.
  Twenty-seven were the linter's configuration being wrong rather than the code:
  13 were Node files (`api/`, `scripts/`, `.claude/hooks/`, `vite.config.js`)
  linted as browser code, so every `process` and `Buffer` read as undefined; 8
  were in `design/`, which holds the original HTML mockups and is not part of the
  app at all; 3 were an intentionally uniform handler signature in
  `scripts/claimVerdict.js`, now marked with a leading underscore rather than
  broken up to please a tool; and 3 were genuinely dead imports, removed. **Do
  not chase the remaining 3.** One is the deliberate `GOALS` export from
  `src/App.jsx`, already reviewed and judged proportionate on 14 August 2026. The
  other two are real findings, not noise, and are recorded as such in the next
  entry.
- **Two React findings, deliberately not fixed, and they are findings rather
  than lint noise.** `src/App.jsx:659` calls `Math.random()` during render to
  pick the player's nickname, and `src/LiveSessionScreen.jsx:296` calls
  `setState` synchronously inside an effect. Neither has ever produced a visible
  bug. Both are shipped behaviour, so changing either is a behaviour change and
  had no business riding along in a cleanup. Worth assessing on their own merits
  if anyone opens those files; not worth a slice.
- **`design/` stays, and the screenshot in it is fine.** The directory holds the
  original HTML mockups (3.4 MB, 14 files) and
  `trackman_original dashboard.png`. The product manager confirmed on 26 August
  2026 that he pulled that screenshot from TrackMan's public site. Recorded so
  the confidentiality pass of the same week does not get re-run against it.
- ~~**The Vite favicon stays, decided again on 26 August 2026** and for a better
  reason than the first time. The product manager: a generic build-tool bolt
  makes it obvious this is a personal project, and he would not want a real
  company mark there. Note for anyone reading the older entry in
  `docs/queued-slices.md`: that item never proposed using TrackMan's logo, it
  proposed the radar mark the app already draws in its own header. The decision
  is the same either way. **This item is now closed, not deferred.**~~

  **Reversed by the product manager later the same day, 26 August 2026, and the
  reversal is recorded rather than the entry rewritten, because a decision that
  lasted a few hours is itself worth seeing.** The favicon is now the app's own
  radar mark. The reasoning that closed it was not contradicted: the concern was
  never to put a real company's mark in the tab, and this mark is original to
  this project. What changed is the weighing of the other half, that a build
  tool's default logo reads as generated-from-a-template-and-never-finished on
  the first thing a stranger sees. Nobody needs to re-argue either side.

  **Two things the swap settled that were not part of the decision.** The mark
  in the tab is simplified: three arcs at 16x16 put the innermost one inside the
  centre dot's own stroke, so it is dropped and the two survivors are spread and
  brightened. And the favicon carries a dark plate in the app's own background
  colour, so it renders the same on a light and a dark browser tab strip rather
  than depending on which chrome the visitor runs. Both are written out in
  `public/favicon.svg`'s own comment.

*Added at the close of Slice 14, 25 August 2026:*

- **The generator's launch-angle bend was DECLINED, 25 August 2026, and this is
  the record of that decision rather than a proposal.** A ball chased above the
  top of the zone comes out about two degrees flatter than a strike down the
  middle, where session 1 says it should be steeper. The product manager's
  reasoning: Slice 11 already delivered the large improvements to the generator,
  this is two degrees in the two bands holding the fewest swings, and nothing a
  visitor sees is wrong because of it, so it is chasing diminishing returns. **Do
  not re-propose it.** The full arithmetic, including why no weight can fix it
  inside the current structure, is finding 8 in `docs/slice-11-plan.md`. It is
  disclosed in both `README.md` and `docs/proof-of-concept.md`, which is the
  answer this project chose instead of the fix.
- **The coach is instructed to write at an eighth-grade reading level and nobody
  has ever measured whether it does.** Found by the Slice 14 review. The
  instruction is real, at `src/coachApi.js:92` and `:172`. Nothing in the repo
  checks the output against it, which is awkward next to this project's own
  finding that prompt instructions alone do not hold, proven twice on brevity.
  `docs/proof-of-concept.md` now states it as an instruction rather than a
  result, which is honest and also makes the gap public. Cheap to close if
  wanted: a readability score over the committed debrief fixtures costs no live
  spend, since 96 real debriefs are already sitting in
  `docs/eval-fixtures/slice7-debriefs/`.
- **Two documents now make checkable claims that nothing tests.** Same class of
  debt as the README's, doubled. The same answer applies: recorded rather than
  guarded, because guarding prose costs more than it returns here. The practical
  version stays a line on this list rather than a test: anyone reopening
  `src/swingGenerator.js` or `src/coachApi.js` re-reads what these two documents
  claim about it.

- ~~**Find out whether the uptime pinger is still doing anything, once Vercel Pro
  lands. The job is to find out, not to remove it.**~~ **CLOSED 25 August 2026 in
  Slice 12, and the answer is that the pinger stays.** Everything the entry asked
  for was checked in the order it asked: Pro's cold start prevention was already
  enabled and needed no setting switched on, and b1-coach was confirmed to sit on
  the Pro team rather than a personal Hobby scope, which was the check that could
  have invalidated the rest. The finding that decided it: Pro keeps a deployment
  warm only if it was invoked in the last 14 days, and the pinger is what makes a
  fourteen day gap impossible, so it is what qualifies this app for the feature
  rather than a redundant backup. This entry's own suspicion was right in one
  respect and it is worth carrying: **the pinger's effect was never measured and
  cannot now be reconstructed.** Costs $0.006 a month, measured. The region
  question the product manager raised alongside it was answered no: this app has
  no database, so the reason to move a function closer does not apply. Full
  reasoning in `docs/slice-12-plan.md`, external state in the new
  `docs/pre-deploy-checklist.md`. The original entry follows as written. The
  Two decisions inside this slice belong to the still-open README audit item above
  and are recorded here so its pointer lands somewhere: **`README.md:7`'s
  cold-start warning paragraph stays**, and so does `TIMEOUT_COLD_MESSAGE` in
  `src/failureCopy.js`. Sleeping has not become impossible, and if Pro is
  temporary then "no longer happens" has an expiry date, so deleting either would
  mean rebuilding it. The
  product manager is
  upgrading to Vercel Pro for a different project, and Pro includes cold start
  prevention. This app currently leans on a free external pinging service, set
  up on Better Stack on 31 July 2026, hitting `/api/coach` every five minutes to
  keep the serverless function awake. His own framing, which is the sharper one:
  it is entirely possible the pinger never did much, because Vercel functions
  may not sleep the way some other hosts do.

  **The pinger's effect was never measured, and that is the fact this whole
  item turns on.** Checked against the deployment and latency sections above on
  24 August 2026, and they bear it out. What this repo holds is a cold-start
  failure that survived eleven weeks in production, and three latency
  measurements taken on three different days for three different reasons: 30
  July (11 to 14 seconds a debrief), the 12 August audit (20 to 30 seconds, plus
  one outright timeout), and a single 13 August run (12.06 seconds, on a warm
  instance, explicitly recorded as one run rather than a refutation). None of
  them is a before-and-after on the monitor. Only the 30 July reading predates
  its install date, so it is the only possible "before", and pairing it against
  either later reading fails to show the pinger helping: against 12 August the
  numbers move the wrong way, with an unexcluded concurrency confound recorded
  beside them, and against 13 August they are roughly flat, on a single warm
  instance. So "the pinger does
  nothing" and "the pinger is the only reason this works" are both live
  positions today, and neither can be settled from what is written down.

  **His order of work, which is deliberate and should be preserved.** First,
  read how this app is actually deployed and what the cold start was in
  practice. Second, establish what Pro's cold start prevention does for THIS
  app, and whether it is automatic or a setting somebody has to switch on.
  Third, get evidence it is working. Only then unwind the pinger. **Do not
  cancel the pinger first and find out afterwards.** He also wants two things
  answered up front rather than at the end: what evidence would show it working,
  stated as a before and after rather than as a claim; and whether moving from
  Hobby to Pro changes anything else about this app.

  **Three consequences his framing does not name, all verified in the files on
  24 August 2026.** (a) The README's cold-start warning paragraph
  (`README.md:7`, "The demo runs on a server that sleeps when idle, so the first
  load after a quiet spell can take a few extra seconds") becomes false the
  moment this works, and it is the second line a stranger reads. Pair this with
  the README item above rather than doing it twice. (b) CLAUDE.md's own
  Deployment and cold starts section describes the cold start as the thing the
  monitor exists to prevent, so that section needs rewriting, not annotating
  away. (c) **The two staggered timeouts want re-deciding on purpose rather than
  inheriting.** The server gives up on Anthropic at 40 seconds
  (`UPSTREAM_DEADLINE_MS`, `api/coach.js:34`) and the browser at 50
  (`REQUEST_TIMEOUT_MS`, `src/coachApi.js:198`), staggered so the server's more
  specific failure reason wins the race, under a function limit pinned at 60 in
  `vercel.json`. If Pro moves that limit, the stagger should be re-decided
  deliberately. Note what makes that more than a constant change: the 40 seconds
  is written out twice in approved user-facing copy in `src/failureCopy.js`, in
  the `timeout` message and in `MID_WAIT_MESSAGE`, and that copy is not to be
  reworded without the product manager. There is a third string in the same
  file, `TIMEOUT_COLD_MESSAGE`, which tells a visitor the server was asleep; if
  cold starts stop happening, that line is telling them something that no longer
  occurs.

  **This is a deploy-time obligation, so whatever slice does it appends to the
  running pre-deploy checklist in the same pull request.** Changing a hosting
  plan, switching on a platform setting, and cancelling an external monitor are
  all things done outside this repository, and the only session that reliably
  knows about them is the one that created them. **This project has no such
  checklist file today**, checked on 24 August 2026, so the first slice to
  create a deploy-time obligation creates the list as well rather than going
  looking for one. That is not a reason to skip it: every step of this item
  except reading the code happens outside the repo, which makes it the exact
  case the rule was written for.

Done and deliberately kept here for a while, so nobody re-proposes them: the
uptime monitor was set up on Better Stack on 31 July 2026 against both the app
and `/api/coach`; the safety-net fixes went back to
`~/.claude/templates/project-safety-nets/` the same day. Two more came off this
list in Slice 5 on 13 August 2026, both shipped: saying so honestly when the API
balance is drained instead of blaming the server, and showing an explanation
mid-wait on a timer rather than only after a failure, which now fires at 25
seconds. See the failure vocabulary section above for what replaced them.

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
