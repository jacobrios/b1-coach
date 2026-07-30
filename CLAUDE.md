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

    src/App.jsx              952 lines. Screen routing, player and session state,
                             synthetic swing data generation, debrief orchestration.
    src/DebriefScreen.jsx   1408 lines. The results screen, all six chart
                             components, and the chat panel.
    src/LiveSessionScreen.jsx 517 lines. Animated incoming swing data.
    src/coachApi.js          181 lines. System prompts, the single API call
                             function, and the two calls built on it.
    api/coach.js              22 lines. The serverless proxy. See the trap below.

The two big files are big. Navigate them by line reference rather than reading
them whole; reading either in full costs a large share of a context window for
little return.

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

1. **There is no test suite.** No `test` script, no test or spec files. Never
   imply anything was covered by automated tests. If tests are introduced, show
   them failing before the fix.
2. **Anything that changes the screen owes a rendered check.** Load the running
   app in a real browser and look at it. This project's whole value is what a
   stranger sees, so "the code looks right" is not evidence here.

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

`normalizeChart` at `src/DebriefScreen.jsx:917` wraps a string into `{type}`
before dispatch, which is the right habit, but it does not check the string
against that list. An invented key becomes a valid-looking object and then fails
silently twice, falling back to the label 'Chart' at :1144 and to the empty
"Chart renders here" box at :1195. Validating against the allowlist is planned.

`callApi` at `src/coachApi.js:71-98` is the single choke point for both calls. It
already strips markdown code fences before parsing. Anything that should apply to
every model response belongs there, once, not in both call sites.

## Deployment and cold starts

Vercel. The static app is served from a CDN and is always instant. The
serverless function sleeps when idle and takes several extra seconds to wake,
which reads to a visitor as a hang or a broken app.

The prevention is a free external uptime monitor pinging `/api/coach` every five
minutes with a plain GET, which the handler rejects with 405 before ever calling
Anthropic, so it wakes the function and costs nothing.

The function timeout currently exists only in the Vercel dashboard, not in the
repo. There is no `vercel.json`. Pinning it in a file is planned.

A full debrief takes roughly 12 seconds on the smallest session. Later sessions
send more history and take longer. Nobody has tested where the ceiling is.

## Cost exposure

Spend is capped by a prepaid Anthropic balance of roughly $35 with auto-reload
off. A runaway bill is therefore impossible. The realistic bad outcome is a
drained balance and a dead demo, with no alert, discovered by a recruiter rather
than by the owner.

`api/coach.js` forwards the request body to Anthropic unchanged, so the caller
chooses the model and response length, and there is no authentication or rate
limiting. Confirmed live on 30 July 2026: an unauthenticated POST reached
Anthropic on the project's key and was rejected only for a missing `model`
field. The key itself is not exposed; it is spendable, not readable. Pinning the
model and length server-side is planned.

---

## Deliberate decisions, do not "fix" these

- **Em-dashes in the coach's voice are accepted.** Both system prompts say
  "Never use em-dashes" and the model ignores it. The user-level ban governs the
  product manager's own writing, not B1's character voice. A stripping fix was
  considered and rejected on 30 July 2026: it adds a place the rewrite can go
  wrong for no product gain. The ignored prompt line stays as-is.
- **Sonnet, not Opus.** Switched during session 10 for latency and cost, with no
  meaningful quality loss on this structured task. Set via the `MODEL` constant
  at `src/coachApi.js:1`.

## Known debt and open questions

- `src/App.jsx:692-694` claims variance shrinks to 87% / 75% / 65% across
  sessions 2 to 4. The formula on the line below yields 100% / 95% / 90% and
  floors at 85%, so the comment is wrong for every session and variance barely
  shrinks at all. Unresolved whether the comment or the formula reflects intent.
- `.claude/settings.local.json` is tracked. Normally machine-local. Raised on
  30 July 2026, deliberately left alone, still unanswered.
- Stale comments at `src/DebriefScreen.jsx:868` and `:1133` describe `charts` as
  `{type, data}` objects rendered as placeholders. Both halves are now wrong.
- The chat path's single `chart` key has the same unvalidated-model-output
  problem as `charts`.
- A "whole site shows up blank" symptom has been reported but never reproduced.
  It is distinct from the silent-placeholder cold start. Do not fold the two
  together without evidence.
- The 2.8 MB handoff zip was removed from the tree on 30 July 2026 but remains
  in git history. A history rewrite was considered and deliberately rejected.

## Where decisions get recorded

`docs/product-decisions-log.md`, most recent first, written in product language.
A slice is not done until its entry is written. `docs/proof-of-concept.md`
carries the original product framing.
