# Slice 5 plan: tell the truth about why the coach failed

Written 13 August 2026 by a planning session, scoped with the product manager,
for execution in this session by fresh implementer subagents. Nothing in this
slice has been built yet.

Read all of it before touching code.

This file travels with the work and is never deleted. It is committed on the
slice branch and reaches GitHub only inside the pull request that carries the
finished build.

---

## What this is, in product terms

On 12 August 2026 a live audit caught the app doing two things wrong at once. A
debrief request came back 504 after roughly half a minute, and the screen told
the visitor the server had been asleep. It had not been asleep. An uptime
monitor pings it every five minutes and it had answered successfully two minutes
earlier. The same sentence is also what a visitor sees when the prepaid API
balance runs dry, a situation no amount of retrying will fix.

One message is standing in for every kind of failure, and it is a guess worded
as a fact. This slice makes each failure say what actually happened, and puts a
deliberate ceiling on how long a stranger is held before anything is said at
all.

---

## Settled with the product manager, do not relitigate

**1. Four things the app may say, each provable.** Out of credits. Took too
long. Anthropic is having trouble. Could not reach our own server. A fifth
wording covers a proven cold start that then timed out.

**2. Vendors are named on purpose.** The copy says "Anthropic" and "Vercel"
although B1 Coach is presented as a TrackMan feature. The failure screen is where
the demo stops talking to the player and talks to the person evaluating it. The
character break was accepted explicitly on 13 August 2026: a reader must not come
away thinking a failure was a coding mistake.

**3. Cold start is a modifier, not a category.** The server can only report it
was cold if it lives long enough to answer. So the vocabulary is three reasons
plus a `cold` flag that changes the wording, not four peer reasons.

**4. No automatic retry on a timeout.** Retrying a slow system doubles the
silence. The visitor gets the honest message and a Try Again button and decides
for themselves. Retry survives for the two reasons where it can genuinely help.

**5. This slice measures latency and does not reduce it.** Streaming the coach's
text is the real fix for a blank screen, and it is the recommended next slice.

## Not in this slice

- **Streaming the debrief.** Its own slice, recommended next.
- **Rate limiting.** Stays deferred in CLAUDE.md's cost section until the
  balance moves faster than the owner's own use explains.
- **The `.env` guard test** and every other queued item. Stays on What's Next.
- **Fixing the 22 pre-existing lint errors.** Unrelated, and they predate this.

## How this gets verified

Unit tests for every classification branch, the deadline, the retry policy and
the copy table, none of which call a model. Then real failures forced against a
Vercel preview: an invalid key for Anthropic trouble, a one-second deadline for
timeout, a paused uptime monitor for cold start. Credits is the one gap and ships
verified a layer short, because the balance cannot be drained to order.

## Debt this slice is expected to open

The three reason strings get written in both `api/coach.js` and `src/`, the same
deliberate duplication `MODEL` already carries across that boundary. An Anthropic
400 that is not a credits error will be reported as Anthropic trouble when it is
more likely our own bug. And a cold start stays invisible whenever the browser
gives up before the server answers.

---

## Baseline, recorded before any code lands

- **Test suite: 171 tests across 6 files, all passing** on `main` at `48522d4`.
  Run `npm test`. This matches the finishing number recorded for the hook-tests
  work in the decision log, so nothing has drifted between slices. The pull
  request reports the before and after numbers.
- **Lint: 22 errors, all pre-existing.** `npm run lint`. Do not fix them here.
  Note this is up from the 13 recorded at Slice 4; the growth is unrelated to
  this work and is not this slice's to chase.
- No known failing tests. Anything red at slice start is new and yours.

## The numbers this slice installs

| What | Value | Why this number |
| --- | --- | --- |
| Server gives up on Anthropic | 40s | Twenty seconds of headroom under Vercel's 60, enough to absorb a cold start and still answer in words rather than be killed mid-sentence. |
| Browser gives up entirely | 50s | Ten seconds behind the server, so the server's more specific answer almost always wins the race. This is the longest a visitor waits automatically. |
| Mid-wait line appears | 25s | Debriefs measured 20 to 30 seconds on 12 August, so this fires on a meaningful share of perfectly healthy sessions. That is why its wording sets an expectation instead of claiming something is wrong; see the copy note below. |
| Retry delay | 1500ms | Unchanged from today. |

The product manager discussed 45 seconds. The build uses 40 for the server and
50 for the browser, because a single 45 would leave the browser and the server
racing each other and the browser winning sometimes, which would throw away the
specific reason for a generic one. The visitor-facing copy says 40 seconds to
match what the code does.

## The vocabulary

Three reasons, one flag. Every one of them is a fact somebody reported, never an
inference.

| Reason | Means | Who can see it |
| --- | --- | --- |
| `credits` | Anthropic reports the balance is dry | Server only |
| `timeout` | Nobody answered inside the deadline | Server, or browser as a backstop |
| `trouble` | Anthropic refused or errored | Server only |
| `unreachable` | Our own function could not be reached at all | Browser only |
| `cold` (flag) | This invocation started on a fresh instance | Server only |

`unreachable` exists because of a trap worth naming. When the browser cannot
reach our function, it knows nothing whatsoever about Anthropic, so blaming
Anthropic there would be a brand new lie of exactly the kind this slice removes.

## The approved copy, verbatim

Do not reword these. They were written and approved on 13 August 2026.

| Situation | Copy | Try Again button |
| --- | --- | --- |
| `credits` | The coach runs on prepaid Anthropic API credits, and they've run dry. That's a funding problem on my end, not a bug. They'll be topped back up. | No |
| `timeout` | The coach took too long on this one. Anthropic's API didn't answer within 40 seconds, so the demo stopped waiting rather than leave you hanging. | Yes |
| `timeout` with `cold` | The coach's server was asleep and took too long waking up. This demo runs on Vercel, where the server naps when nobody is using it. | Yes |
| `trouble` | Anthropic's API is having trouble right now, and that's what the coach thinks with. Nothing is broken in the demo itself. Give it a minute. | Yes |
| `unreachable` | Couldn't reach the coach's server at all. That's either Vercel, where this demo is hosted, or your own connection. | Yes |
| Mid-wait, 25s | Still working. The coach can take up to 40 seconds on a full session. | n/a |
| While retrying | That didn't go through. Trying once more. | n/a |

The credits row is the only one with no button, and that is the whole point of
it: a button there would promise something that cannot work.

**The mid-wait line changed after approval, and here is why.** It was approved as
"Still working. This one's taking longer than usual." Reviewing the plan against
the measurements caught the problem: debriefs run 20 to 30 seconds, so a line at
25 seconds fires on a large share of completely normal sessions, and telling
those visitors the wait is unusual would be untrue. The replacement sets an
expectation against the real deadline instead, which is true whenever it fires.
Raised with the product manager at spec review on 13 August 2026.

---

# Tasks

Each task is a fresh implementer with an independent reviewer. Work in place on
this branch. Do not create a worktree.

Every task that adds behavior writes its test first and shows it failing before
the implementation exists. A test written over code that already works is
worthless until the thing it covers has been broken on purpose and seen to go
red.

---

## Task 1: Correct the two things in CLAUDE.md that are currently false

This is first on purpose. `CLAUDE.md` loads at the start of every session,
including the sessions executing the rest of this slice, so a wrong fact in it
works against the very slice that disproved it.

**1a. The shelf decision is reversed.** The "Parked at Slice 4 close, 3 August
2026" block says this project waits until the other project's MVP ships. The
owner reversed that on 13 August 2026 and is working these slices now.

Append a dated postscript immediately after that block. Do not rewrite the block
and do not edit a word inside it; records here are append-only. The postscript
says the shelf decision was reversed on 13 August 2026, that the four parked
questions are live again rather than parked, and that the block above is kept
because it is what was true at the time.

**1b. The latency numbers are stale.** The deployment section records a debrief
at 11 to 14 seconds and a chat reply at 6 to 11, measured 30 July 2026. The 12
August 2026 audit measured debriefs at 20 to 30 seconds plus one outright
timeout.

Correct it by addition, not replacement: keep the 30 July measurement and its
date, add the 12 August measurement and its date, and say plainly that latency
roughly doubled between them and that the cause is not known to be anything in
this repository. The prompt did not grow and the model did not change. Note that
the owner was running his own session concurrently during the audit, so a
concurrency effect has not been ruled out.

Both edits are Markdown, so the test hook will not run. Run `npm test` yourself
and confirm 171 still pass before handing off.

---

## Task 2: The server classifies its own failures and stops waiting at 40 seconds

**File:** `api/coach.js`. **Tests:** `api/coach.test.js`.

Read the whole existing file first. It has a deliberate shape: it rebuilds the
payload from scratch, it refuses anything oddly shaped with one uninformative
400, and it explains why in comments. None of that changes.

**Cold detection.** A module-scope `let instanceWarm = false`. Every invocation,
including the GET and HEAD liveness pings, reads it into a local `wasCold` and
then sets it true. The pings must set it, because an instance woken by the
uptime monitor genuinely is awake by the time a visitor's POST lands, and
reporting that POST as cold would be false.

**The deadline.** Wrap the upstream `fetch` in an `AbortController` firing at
40000ms. Clear the timer in a `finally` so a fast response does not leave a
handle behind. Record the elapsed milliseconds around the call.

**Classification.** In this order:

1. The abort fired, so `timeout`.
2. `response.ok`, so success. Not a failure at all.
3. Status 400 and the response body matches `/credit balance is too low/i`, so
   `credits`. Match against the serialized body, because Anthropic nests the
   message inside an error object and this must not depend on that shape holding.
4. Any other non-ok status, so `trouble`.
5. The fetch threw for any other reason, so `trouble`.

Case 4 knowingly includes an Anthropic 400 that is not about credits, which is
more likely our own malformed request than Anthropic having trouble. Accepted
rather than solved: this app sends one fixed shape and the envelope carries the
real status anyway, so the log stays truthful even where the copy generalizes.
Put that reasoning in a comment.

**The failure envelope.** On any classified failure, respond with a real error
status so the browser's existing `!response.ok` branch still fires, and a body of
`{ error: { reason, upstreamStatus, upstreamMs, cold } }`. Use 504 for `timeout`
and 502 for `credits` and `trouble`. `upstreamStatus` is null when there was no
response.

**Leave the existing 400 alone.** The caller-shape refusal keeps its current
`{ error: 'Invalid request' }` string body and its deliberately uninformative
wording. It is not a visitor-facing reason; it means a caller sent something this
app never sends. Changing it would break existing tests for no product gain. Say
so in a comment so a later reader does not "fix" the inconsistency.

**Success responses carry measurement.** Add `x-coach-upstream-ms` and
`x-coach-cold` headers. Do not touch the success body. It must stay byte for byte
what `callApi` already parses, and a test should assert that.

**Tests to write first, each seen failing:** cold flag true on first invocation
and false after; a liveness GET marking the instance warm; the abort producing
`timeout` with a 504; a credits body producing `credits` with a 502; a 529
producing `trouble`; a thrown fetch producing `trouble`; the success body
unchanged; both headers present on success; the existing 400 path still
returning its old string shape.

---

## Task 3: The browser reads the reason, adds its own backstop, and stops retrying blindly

**File:** `src/coachApi.js`. **Tests:** `src/coachApi.test.js`.

Read `callApi` and the comment above it first. The comment explaining the single
retry is about to become wrong, and rewriting it is part of this task.

**A carried reason.** Failures stop being bare `Error`s. Introduce a small
`CoachError` carrying `reason` and `cold`. Everything this file throws to a
caller is one of these, so no caller has to guess again.

**The browser's own deadline.** An `AbortController` at 50000ms per attempt.

**Classification, browser side.** The server's answer always wins when there is
one:

1. The fetch threw an abort, so `timeout`.
2. The fetch threw anything else, so `unreachable`. The network failed or the
   function could not be reached, and we know nothing about Anthropic.
3. Not ok, and the body parses with an `error.reason`, so use the server's reason
   and its `cold` flag verbatim. This is the common and most specific case.
4. Not ok with no usable envelope, so the function never got to speak. Status 504
   or an `x-vercel-error` header means `timeout`; anything else is `unreachable`.
5. Ok, but no text content or the reply will not parse, so `trouble`. The model
   answered with something unusable. Keep the existing parse logic exactly as it
   is; only what gets thrown changes.

**Retry policy.** Retry once, after the existing 1500ms, only when **all** of
these hold: the attempt never produced a successful HTTP response, and the reason
is `unreachable` or `trouble`, or the `cold` flag is set.

The first condition is not decoration and the reason to keep it is a wait the
plan nearly shipped. Branch 5 above, a reply that arrived fine and then would not
parse, is classified `trouble`, and `trouble` retries. But that attempt already
spent its full 25 or 30 seconds succeeding, so retrying it would put a second
full wait on top and quietly break this slice's own ceiling. Only failures that
happened before a good response arrived are cheap enough to repeat.

`timeout` never retries even when `cold` is also set. When the two disagree,
timeout wins, because the visitor has already waited the whole budget and the
point of the ceiling is that it holds.

Rewrite the comment above the retry to say this, and to stop claiming the retry
is about a sleeping server.

**The resulting ceiling, which a test should pin.** A timeout is the only failure
that can consume the full 50 seconds, and it never retries. Every retryable
failure fails fast, because it either could not reach the server or the server
answered quickly with an error. So the longest a visitor is held without being
told anything stays at roughly 50 seconds rather than doubling to 100.

**Correction, 13 August 2026, from the whole-branch review.** Two sentences
above are wrong and were built as written before this was caught. Recorded here
rather than edited away, because what the plan said is why the code said it.

- **"or the `cold` flag is set" was a defect in this plan.** It let `credits`
  retry whenever the instance was cold, which is the ordinary state of a
  stranger's first click, contradicting this same document in two other places
  and auto-retrying the one failure the copy table deliberately gives no button.
  Work through what `cold` could change and it changes nothing: with `credits`
  or `timeout` it must not retry, and with `unreachable` or `trouble` it already
  retries without being asked. The clause is removed; the reasoning is written
  into `isRetryable` so nobody restores it from this plan.
- **The ceiling paragraph rested on an assumption, not on the code.** "The
  server answered quickly with an error" is not something the code enforced: a
  degraded Anthropic returning 529 at 35 seconds is a `trouble`, and the retry
  used to start a fresh 50 second clock, making the real ceiling roughly 90. The
  50 seconds is now a wall-clock budget for the whole `callApi` call, spent down
  by each attempt, with a retry skipped when too little is left for one to
  finish. The promise now holds by construction.

**The `onRetry` callback** now receives `{ reason, cold }` so the loading screen
can say something true while the second attempt runs.

**Tests to write first, each seen failing:** each of the five classification
branches; retry firing for `trouble`, for `unreachable`, and for `cold`; retry
not firing for `timeout`, for `credits`, or for a parse failure that followed a
successful response; the abort producing `timeout`; the existing markdown-fence
and parse tests still passing untouched.

---

## Task 4: The debrief screen says the right thing, and speaks up at 25 seconds

**Files:** a new `src/failureCopy.js`, its new `src/failureCopy.test.js`, and
`src/App.jsx`.

**The new module** holds the approved copy table and nothing else: given a reason
and a cold flag, it returns the message and whether a Try Again button belongs
there. It exists as its own file for the same reason `chartSlots.js` and
`goalTargets.js` do, so it can be tested without loading a DOM. Copy the strings
from this plan exactly.

An unrecognized reason must fall back to the `trouble` copy rather than render
nothing, and a test must prove it. A blank failure screen is the worst outcome
available here.

**In `App.jsx`:**

- A 25 second timer during the loading screen sets a `slow` flag showing the
  mid-wait line. Clear it on success, on failure, and on unmount.
- The `wakingUp` state and its hardcoded sleeping-server sentence come out. The
  loading screen's retry line now comes from the `onRetry` payload and says the
  neutral true thing while a second attempt runs.
- The `coachUnavailable` screen takes the reason from the caught `CoachError`,
  renders the copy from the new module, and shows the Try Again button only when
  the module says to. Its hardcoded "didn't wake up in time" sentence comes out.
- The catch at `runDebrief` must survive an error that is not a `CoachError`,
  falling back to `trouble`. Nothing should ever reach a visitor as a blank
  screen because an unexpected error shape got through.

Anything that changes the screen owes a rendered check, and the suite does not
reach screens at all. Task 6 is where that happens; do not claim this task is
verified without it.

---

## Task 5: The chat panel stops saying it could not connect

**File:** `src/DebriefScreen.jsx`.

The catch at line 196 currently posts "Sorry, I couldn't connect right now" for
every failure, which is the same untruth as the debrief screen in a smaller
font. A drained balance says it, and so does an Anthropic outage.

Use the same `src/failureCopy.js` table, keyed on the reason from the caught
`CoachError`, and post that as the coach's message. Fall back to `trouble` for
an unrecognized or missing reason.

No Try Again button in chat. The player already has an input box and can simply
ask again, so a button would be a second way to do the same thing. The `credits`
copy still reads correctly in that position: it tells the player retrying is not
the answer without needing a button to suppress.

---

## Task 6: Force the failures for real against a Vercel preview

Nothing in `api/coach.js` can be verified by `npm run dev`. The Vite config
proxies `/api/coach` straight to Anthropic, so the function never executes
locally. This task runs against the preview URL the pull request generates.

Vercel Deployment Protection was turned off by the owner on 13 August 2026 for
this slice. It must be turned back on before the slice closes, and that reminder
belongs in the pull request message.

Run each of these and record what was actually seen, not what was expected:

1. **Anthropic trouble.** Set an invalid `ANTHROPIC_API_KEY` on the preview
   deployment. Expect a real 401 classified as `trouble`, the Anthropic copy on
   screen, and a Try Again button. Restore the key afterwards.
2. **Timeout.** Commit a temporary one second deadline to the branch, deploy,
   run a debrief, and watch it time out end to end. Confirm the copy, the button,
   and that no automatic retry happened. Restore the deadline to 40000 and
   confirm the restoration deployed.
3. **Cold start.** Pause the Better Stack monitor, leave the function idle long
   enough to be evicted, then load the app. Confirm whether `x-coach-cold`
   reports true. Resume the monitor afterwards. If the instance will not go cold
   in a reasonable wait, say that plainly rather than reporting a pass.
4. **The happy path, with numbers.** Run a full session to a debrief and read
   `x-coach-upstream-ms` from the network tab. Record the real figure. It is what
   Task 7 writes into the records.
5. **Chat.** With the invalid key still set, ask the coach a question and confirm
   the chat panel gives the Anthropic copy rather than "couldn't connect."

**Credits cannot be forced.** The balance cannot be drained to order. Say so
plainly in the pull request rather than implying five clean runs covered six
situations.

---

## Task 7: Write the records

**The decision record**, `docs/product-decisions-log.md`, most recent first, 400
to 600 words, in product language. What the slice decided along the way, not a
retelling of what happened. It must cover why cold start became a flag rather
than a category, why `unreachable` had to exist as its own reason, why vendors
are named on screen, why timeouts do not auto-retry, and the credits
verification gap.

**`CLAUDE.md`**, three edits:

- The current-state sections gain what is now true: the four failure reasons and
  where the copy lives, the two deadlines and why they differ, and the fact that
  every response now carries its upstream duration.
- The measured latency from Task 6 goes in beside the 30 July and 12 August
  figures Task 1 recorded.
- **What's Next** loses the two items this slice closes: the honest-messaging
  item for a drained balance, and the timer item Slice 1 deferred. Add anything
  this slice surfaced, and add streaming the debrief as the recommended next
  slice with the reasoning that a visitor watching a blank screen for 30 seconds
  is the thing they most feel.

**No pre-deploy checklist entry.** This slice adds no environment variable and
no migration. It creates no deploy-time obligation.
