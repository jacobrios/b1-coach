# Slice 2 plan: the server side of the cold start, and what a stranger can spend

Written 30 July 2026 by a planning session, for execution in a fresh session.
Nothing in this slice has been built yet.

Read all of it before touching code.

This file is temporary. Delete it as part of the Slice 2 pull request; its
decisions belong in `docs/product-decisions-log.md` once the slice lands, and
the durable facts belong in `CLAUDE.md`.

---

## What this project is

A proof-of-concept AI coaching layer over TrackMan B1 baseball hitting data.
React 19 + Vite, no database, one serverless function at `api/coach.js` that
proxies Anthropic. Deployed at https://b1-coach.vercel.app.

The audience is hiring engineers and recruiters. The product's job is to work on
a cold click from a stranger.

Slice 1 landed on 30 July 2026 (`ba568b9`). It handled cold starts on the client
side: one automatic retry, an explanation while the retry runs, a failure screen
with a Try again control, and validation of the chart keys the model returns.

---

## THE TRAP, and why it governs this entire slice

`api/coach.js` is never exercised in local development.

`vite.config.js:14-26` proxies `/api/coach` straight to `api.anthropic.com` with
`anthropic-dangerous-direct-browser-access: true`. So `npm run dev` bypasses the
serverless function entirely and talks to Anthropic directly.

**Slice 1 was scoped to avoid `api/coach.js` so everything in it could be
verified locally. Slice 2 is the opposite: every change in it lives in code that
local development never runs.**

Consequences you must plan around, not discover:

- `npm run dev` cannot verify a single thing in this slice. Not one claim.
- Every verification happens against the Vercel preview URL that the pull
  request generates. Confirmed on 30 July 2026 that Vercel builds a preview for
  every commit on a PR in this repo, so the URL will exist.
- Open the PR early, before you believe you are finished, so the preview exists
  to test against. Push, wait for the preview, verify, fix, push again.
- A cold-start failure survived eleven weeks in production precisely because
  local testing never touched the failing piece and always worked. That is the
  failure mode this slice is most exposed to.

Environment variables differ by environment for the same reason:

- Local dev reads `VITE_ANTHROPIC_API_KEY` (used by the Vite proxy config).
- Production and preview read `ANTHROPIC_API_KEY` (used by the function).

There is no test suite in this repo. No `test` script, no test files. Do not
imply anything was covered by automated tests. If tests are added, they must be
shown failing first.

---

## Settled: the timeout value (this answers change 4)

The dashboard currently reads **300 seconds**, confirmed by the product manager
on 30 July 2026. That number was not chosen deliberately. It was raised during
the original build as a defensive reaction to a "blank loading page" symptom that
this project's notes record as never reproduced, so there is no evidence it fixed
anything.

**Set it to 60 seconds, not 300.** Decided with the product manager on 30 July
2026.

The reasoning, so it does not have to be re-derived: this function does one
thing, forward a single request to Anthropic and return the answer. The only
thing that can make it slow is Anthropic being slow, and a call that has not
returned in 60 seconds is not going to return anything useful. A timeout is not a
safety margin, it is a decision about when to give up, so longer is not safer, it
is only slower to fail.

What 300 costs is concrete: five minutes to fail, plus the retry, plus another
five, is roughly ten minutes before Slice 1's "coach didn't wake up" screen can
appear. No visitor waits that long, which makes that whole slice unreachable in
the hang case.

**This is gated on measurement.** Measure the slowest real request during this
slice (the same trip that measures request size for the input cap, see change 3).
If a session 4 debrief lands in the expected 15-25 second range, 60 is right. If
something legitimate runs closer to 40 seconds, do not ship 60: report the
measured number and a proposed timeout to the product manager before opening the
pull request. A timeout that kills real requests is worse than one that is too
long.

Note that once `vercel.json` exists it takes precedence over the dashboard, which
becomes decorative. The product manager is deliberately leaving the dashboard set
to 300 rather than clearing it, since the file wins either way. **Record in
`CLAUDE.md` that the repo is now the source of truth for this value and that the
dashboard still displays a superseded 300**, so a future reader who finds the two
numbers disagreeing knows which one is live. State the final number in the pull
request.

**In the chat message announcing the pull request, tell the product manager to
set the dashboard Max Duration to the same confirmed number, after the merge and
not before.** Changing it before the merge would apply an unmeasured value
straight to the live site. Changing it after costs nothing and covers the one
case that matters: if `vercel.json` ever goes missing, because the project was
recreated or the repo forked, the dashboard becomes live again and should fall
back to the right number rather than to a 300 nobody chose.

---

## The four changes

### 1. Answer a plain GET with 200 instead of 405

`api/coach.js:2-4` currently rejects anything that is not a POST with a 405.

The cold-start prevention for this project is a free external uptime monitor
pinging `/api/coach` every five minutes with a plain GET. Waking the function
costs nothing, because the handler answers before ever calling Anthropic. But
most monitors read anything outside the 2xx range as "site down" and alert
constantly, so the thing meant to keep the demo warm currently looks like a
permanent outage and is useless as an uptime check.

Answer GET (and HEAD, which some monitors use instead) with a 200 and a bare
liveness body. Nothing meaningful in it, no status page, no version string, no
request body read, and above all **no Anthropic call**. It must stay free.

Everything that is not GET, HEAD, or POST keeps returning 405.

**POST behavior must not change in this step.**

### 2. The server decides the model and the response length

`api/coach.js:14` forwards `req.body` to Anthropic unchanged, so the caller
picks the model and `max_tokens`. Confirmed live on 30 July 2026: an
unauthenticated POST reached Anthropic on the project's key and was rejected
only for a missing `model` field. The key is not readable, but it is spendable.

Pin both server-side. The values that are running today, from
`src/coachApi.js:1-2`:

    MODEL = 'claude-sonnet-4-6'
    MAX_TOKENS = 4096

Override whatever arrives in the request rather than trusting it. A caller may
send anything; the function ignores it.

**Do NOT remove `model` and `max_tokens` from what the browser sends.** This is
the trap in this change, and it is easy to get wrong.

In local development the browser does not talk to `api/coach.js` at all; the
Vite proxy sends the request body straight to Anthropic, and Anthropic requires
`model` and `max_tokens` in the body. Strip them from the client and production
keeps working while local development breaks with a 400, which is exactly the
kind of environment-split bug this project has already been bitten by once.

So after this change the two values genuinely live in two places:

- `src/coachApi.js:1-2` is what local development sends to Anthropic directly.
- `api/coach.js` is what production actually runs, regardless of what arrives.

That is a real wart, not a clean design, and it must be made loud rather than
left implicit. Put a comment at both locations saying the other one exists and
that changing one without the other means local development tests a different
model than production ships. Record it in the decision log as accepted, with the
reason, so a future reader does not "tidy" one of them away.

### 3. Reject request shapes the app never sends

Pinning the response length caps what comes out. It does nothing about what goes
in, and input is the other half of what a request costs. Nothing currently stops
a caller sending an enormous `messages` array on the project's key.

Validate before forwarding, and reject with a 400:

- `messages` must be an array with at least one entry.
- `system` must be a string.
- Total input size must be under a cap.

**Do not invent the cap from intuition.** Measure it. The largest real request
this app sends is a session 4 debrief, which carries the system prompt plus
per-swing data for four sessions plus the accumulated chat history. Instrument
or log the actual size of that request against the preview deployment, then set
the cap with generous headroom above the real maximum. A cap that a real session
4 debrief can trip is worse than no cap, because it breaks the product for the
one visitor who went furthest.

Keep the rejection generic. Do not echo the caller's input back in the error.

### 4. Pin the function timeout in a `vercel.json`

There is no `vercel.json` in the repo. The function timeout exists only in the
Vercel dashboard, invisible to anyone reading the code and lost if the project is
ever recreated or recreated from a fork.

Create `vercel.json` with the function's max duration set to the value the
product manager confirms (see "Input needed" above).

A full debrief takes roughly 12 seconds on the smallest session, and later
sessions send more history and take longer. Nobody has tested where the ceiling
is. If the confirmed dashboard value looks tight against that, say so rather
than quietly raising it: changing the timeout is a product decision about how
long a visitor waits before the request is killed, not a config detail.

---

## In-lane cleanups (do these, they describe what this slice changes)

`CLAUDE.md` carries three statements that this slice makes wrong:

- The "Deployment and cold starts" section says the monitor's GET is one "which
  the handler rejects with 405 before ever calling Anthropic." After change 1 it
  is answered with 200.
- The same section says "The function timeout currently exists only in the
  Vercel dashboard, not in the repo. There is no `vercel.json`. Pinning it in a
  file is planned." After change 4 it is pinned.
- The "Cost exposure" section says "`api/coach.js` forwards the request body to
  Anthropic unchanged, so the caller chooses the model and response length" and
  "Pinning the model and length server-side is planned." After changes 2 and 3
  both are false.

Update all three to describe what is true after this slice, in the same plain
style as the surrounding text.

## Flag, do NOT fix (out of lane)

- `src/App.jsx:692-694` states variance figures that contradict the formula on
  the line directly below. Real, unrelated, still open.
- `.claude/settings.local.json` is tracked. Raised 30 July, left deliberately,
  still unanswered.
- The chat path's single `chart` key has the same unvalidated-model-output
  problem that Slice 1 fixed on the debrief path. A genuine candidate for a
  future slice, not this one.
- "Whole site shows up blank" is an unreproduced symptom, distinct from the
  silent-placeholder cold start. Do not fold it into any cold-start explanation
  without evidence.

---

## Verification required before claiming this works

Your own reading of the code is not evidence, and neither is `npm run dev`. Say
plainly, in the pull request, that local development cannot verify any of this.

Everything below runs against the Vercel preview URL from the pull request.

1. **GET returns 200.** Show the actual response, status code included. Confirm
   from the response time and from Vercel's function logs that no Anthropic call
   was made. A GET that quietly costs tokens defeats the entire purpose.
2. **HEAD returns 200.** Same check, since some monitors use HEAD.
3. **A method that is neither still returns 405.** Force it, do not assume it.
4. **The full app still works end to end.** Load the preview URL in a real
   browser, run a session, get a real debrief with charts. This is the check
   that catches a validation rule that is too strict.
5. **A POST asking for a different model gets the pinned one.** Send a request
   naming an expensive model and a huge `max_tokens`, and show that the response
   came back from the pinned model at the pinned length. This is the whole point
   of change 2 and it must be demonstrated, not asserted.
6. **A malformed POST is rejected with a 400.** Force at least three shapes:
   missing `messages`, `messages` as something other than an array, and a body
   over the size cap. Show each response.
7. **Local development still works after change 2.** Run `npm run dev` and
   complete a session. This is the specific regression that stripping `model`
   from the client would cause, and it needs a rendered check.
8. **The timeout in `vercel.json` matches the dashboard value** the product
   manager confirmed. State the value in the pull request.

State plainly what could not be verified.

## Decision-log entries owed on completion

`docs/product-decisions-log.md`, in product language:

- Rate limiting was considered and deliberately deferred. Pinning the model,
  length, and input size caps what any single request can cost, but nothing caps
  how many requests a stranger can make, because there is still no
  authentication. Accepted because exposure is a prepaid balance of roughly $35
  with auto-reload off, so the worst case is a dead demo rather than a bill, and
  the realistic risk to a portfolio piece is an accident or a curious engineer
  rather than an attacker. Revisit if the balance starts moving faster than
  expected. Decided with the product manager on 30 July 2026.
- The uptime monitor's ping is the primary cold-start defense and Slice 1's
  retry is the backstop. Answering a GET with 200 is what makes the primary
  defense actually usable, since a monitor that reads the warmer as an outage
  gets muted or removed by its owner.
- The model and length now live in two places, deliberately, because local
  development and production reach Anthropic by different routes. Record the
  reason so nobody removes one of them.
- Why the slice stops where it does: everything in it is server-side and can
  only be verified against a deployed preview. That is the same line Slice 1 was
  drawn on, from the other side.

---

## Slice 3 candidates, for context only. Do not build them here.

- **Safety nets, recommended next after this slice.** This project has no test
  suite, no hooks, and no committed reviewer config, while the owner's other
  projects have all three. Scope it small: vitest, tests on the pure logic Slice
  1 touched (the `callApi` retry, the chart-key fallback, `computeStats`), and a
  PostToolUse hook that runs them after edits. Copy from
  `~/.claude/templates/project-safety-nets/`, and drop the migration protection,
  which is Prisma-specific and pointless here. The reason is engineering-shaped
  rather than product-shaped: it changes nothing a visitor sees, but every slice
  in this repo is currently verified entirely by hand, which is what let a
  cold-start bug hide for eleven weeks. Note this pays off on client-side work,
  not on Slice 2, which is why it is sequenced after rather than before.
  **As part of this slice's CLAUDE.md cleanup, add the missing safety nets to
  the "Known debt and open questions" section**, so the gap survives in the file
  a fresh session reads first rather than only in this plan.
- **Show the waking-up explanation on a timer, not only after a failure.** Slice
  1 deliberately rejected a timer because a normal debrief takes about 12 seconds
  and a timer would have told every visitor something was wrong. Dropping the
  function timeout from 300 seconds to 60 changes that calculation: a hang now
  fails in 60 seconds rather than five minutes, so a client-side timer at roughly
  25 seconds would sit comfortably above the normal case while still explaining
  itself before the server gives up. This closes the known gap named in the Slice
  1 pull request. Surfaced on 30 July 2026 while deciding the timeout.
- Validate the chat path's `chart` key against the same allowlist Slice 1 added
  for the debrief path.
- Resolve the `src/App.jsx:692-694` variance comment, which contradicts the
  formula below it. Needs a decision about which one reflects intent.
- Rate limiting, if the balance starts draining.
