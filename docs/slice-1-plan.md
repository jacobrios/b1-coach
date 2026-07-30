# Slice 1 plan: visitor-facing resilience

Written 30 July 2026 by a planning session, for execution in a fresh session.
Nothing in this slice has been built yet.

Read all of it before touching code.

This file is temporary. Delete it as part of the Slice 1 pull request; its
durable content now lives in `CLAUDE.md`, and its decisions belong in
`docs/product-decisions-log.md` once the slice lands.

---

## What this project is

A proof-of-concept AI coaching layer over TrackMan B1 baseball hitting data.
React 19 + Vite, no database, one serverless function at `api/coach.js` that
proxies Anthropic. Deployed at https://b1-coach.vercel.app.

The audience is hiring engineers and recruiters. That shapes every decision
below: the product's job is to work on a cold click from a stranger.

---

## THE TRAP: read this before you plan any verification

`api/coach.js` is never exercised in local development.

`vite.config.js:14-26` proxies `/api/coach` straight to `api.anthropic.com` with
`anthropic-dangerous-direct-browser-access: true`. So `npm run dev` bypasses the
serverless function entirely and talks to Anthropic directly.

Consequences:

- `npm run dev` CANNOT verify any change to `api/coach.js`. Claims about that
  file must be verified against a deployed URL.
- This is why a cold-start failure hid for eleven weeks. It worked locally every
  single time, because local never touched the thing that was broken.
- Slice 1 was scoped deliberately to avoid `api/coach.js` entirely, so that
  everything in it CAN be honestly verified locally. Do not pull server-side
  work into this slice. That is Slice 2.

Local dev uses `VITE_ANTHROPIC_API_KEY`; production uses `ANTHROPIC_API_KEY`.
Two different variables for the same purpose.

There is no test suite in this repo. No `test` script, no test files. Do not
imply anything was covered by automated tests. If tests are added, they must be
shown failing first.

---

## The four changes

### 1. Retry once in `callApi`

`src/coachApi.js:71-98`. Single choke point: both `generateDebrief` (:100) and
`sendChatMessage` (:135) route through it. One change covers both paths.

On failure, wait briefly and try once more before throwing. This is the code-side
fix for the cold-start problem: the serverless function sleeps when idle, the
first request wakes it and fails, the second succeeds. Observed behavior supports
this; every retry in testing has succeeded.

Do not retry more than once, and do not retry on a response that arrived and was
merely unparseable. The target is a dead server, not a bad answer.

### 2. Two honest states, replacing one silent failure

Today `src/App.jsx:762` is a bare `.catch(() => { setScreen('debrief') })`. It
swallows the error and advances the visitor to the results screen with no
debrief data, so they see placeholder filler that looks like a finished product
saying nothing. That is the single worst thing a recruiter could encounter.

The chat path already handles this correctly at
`src/DebriefScreen.jsx:181-184`, posting a real message. Copy that intent, do not
invent a new pattern.

Two states, because the common case after change 1 is waiting, not failing:

**While waking up** (shown during the retry, on the loading screen):

> Waking up the coach. This demo runs on a server that sleeps when idle, so the
> first request after a quiet spell takes a few extra seconds.

**Only if the retry also fails**, with a "Try again" control rather than a dead
end:

> The coach didn't wake up in time. This demo sleeps when idle and sometimes
> needs a second try.

Copy decisions already settled with the product manager, do not relitigate:

- Do NOT name Vercel. Naming a vendor in an error reads as blame-shifting and
  gives a non-technical reader nothing. "A server that sleeps when idle"
  conveys a cold start to any engineer without the finger-point.
- The purpose of this copy is to prevent a visitor concluding the builder is
  incompetent. It should read as a known infrastructure behavior, calmly
  explained.

The "Try again" control is slightly beyond copying the chat pattern (chat has no
button). It was proposed and approved, because an error with no action is a dead
end.

Screen states live in `App.jsx`; the loading screen renders at `App.jsx:853`.
Showing the waking state during a retry requires `callApi` to signal that a
retry is in flight. Keep that plumbing as small as possible.

### 3. Validate the chart key against the six real ones

The model picks which two charts render, by name, as plain strings in its JSON
response (`charts` array, see the prompt at `coachApi.js:29-45`).

`src/DebriefScreen.jsx:917` already normalizes: `normalizeChart` wraps a string
into `{type: c}`. What it does not do is check that string against the six charts
that actually exist. Anything invented becomes a valid-looking object and then
fails silently twice: label falls back to 'Chart' at :1144, body falls back to
"Chart renders here" at :1195.

The six real keys: `scatter_ev_la`, `trend_ev`, `bar_distance`,
`spray_direction`, `zone_breakdown`, `pitch_location`.

Add the allowlist check. This is the second half of a habit the codebase already
started: normalize model output before it drives control flow.

Note for a future slice, do not fix here: the same trust problem exists for the
chat path's single `chart` key.

### 4. (DONE, do not repeat) Live URL in the README

Moved out of this slice and already landed in the CLAUDE.md documentation pull
request on 30 July 2026, so that one docs change touched `README.md` rather than
a docs change and a code change both touching it. The README now carries the
live URL and a cold-start warning. Nothing to do here.

---

## In-lane cleanups (do these, they describe what this slice changes)

- `src/DebriefScreen.jsx:868` describes `charts` as "array of { type, data }
  objects ... rendered as placeholders". Both halves are now wrong.
- `src/DebriefScreen.jsx:1133` comment still calls the charts "placeholders".

## Flag, do NOT fix (out of lane)

- `src/App.jsx:692-694` states variance figures that contradict the formula on
  the line directly below. Real, unrelated to this slice.
- `.claude/settings.local.json` is tracked. Raised with the product manager on
  30 July, left deliberately, still unanswered.
- "Whole site shows up blank" is an unreproduced third symptom, distinct from
  the silent-placeholder cold start. Do not fold it into the cold-start
  explanation without evidence.

---

## Verification required before claiming this works

Your own reading of the code is not evidence. This slice changes what appears on
screen, so it owes rendered proof.

1. Run the app and load it in a real browser. Look at the screen.
2. Force the failure path and SEE both new states, do not infer them. Blocking
   the API call or pointing it at a dead endpoint is the straightforward way.
3. Confirm the retry actually fires and that a recovered call renders a normal
   debrief.
4. Confirm a bogus chart key falls back to something real rather than an empty
   box.
5. State plainly what could not be verified. `api/coach.js` is untouched by this
   slice, so nothing here depends on the deployed URL.

## Decision-log entries owed on completion

`docs/product-decisions-log.md`, in product language:

- Em-dashes in coach voice are deliberately accepted. Both system prompts still
  say "Never use em-dashes" and the model ignores it. The rule governs the
  product manager's own writing, not B1's character voice. A stripping fix was
  considered and rejected: it adds a place the rewrite can be wrong, for no
  product gain. Do not "fix" the ignored rule later.
- Cold-start handling is two-layered: a free external pinger every 5 minutes
  prevents most occurrences, the retry and copy above catch the rest.
- Why the slice stops where it does: everything in it is verifiable by running
  the app locally. Server-side work is not, and was split into Slice 2 so that
  "verified" means the same thing for every claim in one PR.

---

## Slice 2, for context only. Do not build it here.

Server and config, verifiable only against a deployed preview URL:

- Pin model and token cap inside `api/coach.js` so the browser cannot choose
  them. Currently `req.body` is forwarded to Anthropic wholesale, so a caller
  picks the model and length. Confirmed live on 30 July: an unauthenticated POST
  reached Anthropic on the project's key and was rejected only for a missing
  `model` field.
- Reject request shapes the app never sends.
- Pin the function timeout in a `vercel.json`. It currently exists only in the
  Vercel dashboard, invisible to the repo and lost if the project is recreated.

Spend exposure is capped at roughly $35 with auto-reload off, so the realistic
worst case is a drained balance and a dead demo, not a runaway bill.
