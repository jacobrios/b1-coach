# Slice 12: find out whether the uptime monitor is still doing anything

Written 25 August 2026. Branch `slice-12-cold-start-prevention`.

---

## Settled before work started, do not relitigate

The owner upgraded Vercel to Pro for a different project, and Pro includes cold
start prevention. This slice was framed as "find out", not "remove the
workaround". The findings settled six things, each with the owner:

- **The Better Stack monitor stays, unchanged.** It is not redundant backup; it
  is what keeps this app qualified for the Pro feature. See finding 3.
- **The function region stays `iad1`.** See finding 6.
- **The 40 and 50 second deadlines, and the approved "40 seconds" copy, are
  untouched.** Pro raises the platform ceiling; `vercel.json` pins 60 and wins.
- **`TIMEOUT_COLD_MESSAGE` and the README's cold-start sentence both stay.**
  Sleeping has not become impossible, and Pro may be temporary.
- **One code change was approved:** the `x-coach-cold` header moves onto the free
  liveness path, so the question is answerable without spending money.
- **A team-level spend limit is being set**, because this project's recorded cost
  posture ("a runaway bill is impossible") never covered Vercel.

## Not in this slice, and where each belongs

- **The README rewrite**, including its cold-start paragraph: the queued README
  audit item, which already owns it and is scoped wider than one line.
- **The stale Tailwind sentence in CLAUDE.md**: same README audit item, which
  already names that sentence specifically as its own one-line job.
- **Running the pinger-off experiment**: designed and written into
  `docs/pre-deploy-checklist.md`, deliberately not run. See finding 5.
- **Any change to the timeout stagger**: only if Vercel's function limit ever
  moves under this app, which it has not.

## How this is verified, written before any code was touched

- Three new unit tests on the liveness header, each seen failing first with
  `expected undefined to be 'true'`, then passing.
- The full suite before and after, with both counts reported in the PR.
- A free `curl` against production after merge, showing the header present and
  reporting warm. This is the end-to-end proof and it lands after merge.
  **Say why honestly: local development cannot run `api/coach.js` at all, but a
  Vercel preview can, and CLAUDE.md's own trap section names the preview as the
  normal way to verify a change to this file.** Using it means toggling
  Deployment Protection off and back on for a few minutes. That was judged
  disproportionate for a one line header on the liveness path, with the POST path
  untouched and the same header already proven there. It is a choice, not a
  constraint, and the residual risk is that the header is unit-tested and
  unobserved until the first curl after merge.
- The platform settings confirmed by dashboard screenshot rather than by
  assumption, which is what caught that all three were already enabled.

## The debt this slice opens

- **The new header has no automatic consumer.** It is a manual probe. Nothing
  alerts on it and nothing graphs it. That is deliberate for a proof of concept,
  but a future reader should not mistake "measurable" for "monitored".
- **Scale-to-one's effect on this app remains unmeasured**, and now permanently
  so for the Hobby-versus-Pro comparison, because the plan changed before anyone
  thought to measure. Only a pinger-on versus pinger-off comparison is still
  available, and this slice deliberately declined to run it.
- **`instanceWarm` describes an instance, not a request.** Under Fluid compute
  several invocations share one instance, and Vercel may hold more than one
  instance. At this traffic level the probe is a good proxy; on a busy app it
  would not be.

---

# The findings, in the order they were established

## Finding 1: how this app is actually deployed

One serverless function, `api/coach.js`, pinned at 60 seconds by `vercel.json`.
It answers GET and HEAD with a bare 200 before reading the body or calling
Anthropic, which is the Slice 2 change made on 30 July 2026 so that a monitor
treating any non-200 as an outage would work as an uptime check. The owner's
recollection of that was correct and is confirmed in the code.

Confirmed from the dashboard on 25 August 2026, by screenshot:

- Team **Jacob's projects**, on **Pro**, and b1-coach is inside it.
- **Cold Start Prevention: Enabled.**
- **Fluid Compute: Enabled.**
- Function region `iad1`, Node 24.x, Standard CPU at 1 vCPU and 2 GB.
- Deployment Protection: Standard. Skew Protection: Enabled, 12 hours.

**Checking which team owned the project was not a formality.** Pro is per team,
not per account. Had b1-coach been sitting in a personal Hobby scope while the
upgrade applied to a different team, every conclusion in this document would
have been wrong, and nothing in the repository would have said so.

## Finding 2: the pinger's effect was never measured and cannot now be reconstructed

This is the honest answer to the question the slice was called to settle, and it
is worse than CLAUDE.md's own account of it.

Three latency measurements exist, taken on three different days for three
different reasons: 30 July 2026 (11 to 14 seconds a debrief), the 12 August audit
(20 to 30 seconds plus one outright timeout), and one run on 13 August (12.06
seconds, explicitly recorded at the time as one run rather than a refutation).
The monitor was installed on 31 July 2026, so only the 30 July reading is a
possible "before", and pairing it against either later reading fails to show the
pinger helping: against 12 August the numbers move the wrong way with an
unexcluded concurrency confound recorded beside them, and against 13 August they
are roughly flat on a single warm instance.

**And the comparison that would have settled it is now gone permanently.** A
Hobby-versus-Pro before-and-after required measuring before the upgrade, and the
upgrade already happened. No amount of work recovers it.

What was measured, free, on 25 August 2026: five GET requests to the production
liveness endpoint returned in 0.157, 0.158, 0.163, 0.168 and 0.283 seconds. That
is a warm baseline recorded today, and it is the number a future probe compares
against.

## Finding 3: the monitor is what qualifies this app for the Pro feature

This is the finding that decided the slice, and it inverts the framing the slice
started with.

Vercel's own account of the feature, quoted rather than paraphrased: *"Pro and
Enterprise plans: current production deployment (warm if invoked in the last 14
days)"*, and *"This works automatically for qualifying deployments; there is
nothing you need to configure or enable."*

Read the condition. The instance is kept warm **provided the deployment was
invoked within the last 14 days**. A visitor loading the static app does not
invoke the function; the app is served from a CDN. Only a debrief, a chat reply,
or a monitor ping counts as an invocation. A portfolio demo can very plausibly go
fourteen quiet days between job applications, and that is precisely the interval
after which the Pro feature stops covering it.

The monitor fires roughly 8,640 times a month. It makes a fourteen day gap
impossible.

So the two are complementary rather than redundant, and removing the monitor on
the grounds that Pro now does its job would have removed the thing keeping the
Pro feature applicable. *(Confident on the mechanism; the exact semantics of "in
the last 14 days" are a reading of the quoted line, not of a specification.)*

Two further reasons, both weaker than the above but pointing the same way. Pro is
expected to last three to six months, and trading a free permanent net for a paid
temporary feature is a bad trade on its own terms. And the monitor's second job,
telling the owner the site is down, is untouched by cold start prevention, which
does no alerting at all. The owner raised both; both hold.

## Finding 4: what the monitor costs now that usage is metered

Roughly **$0.006 a month**, which is arithmetic rather than assumption.

At one ping every five minutes, 8,640 invocations a month. Vercel bills Pro
invocations at $0.60 per million, so 8,640 of them cost $0.0052. The handler
returns a JSON literal and calls nothing, so its active CPU is on the order of a
millisecond per request: 8,640 milliseconds is 0.0024 hours, at $0.128 an hour in
`iad1`, or $0.00031. Provisioned memory over the same requests is a fraction of a
cent again.

Even wrong by a factor of ten, it is under six cents a month. The owner's
assumption that this was negligible was correct, and it is now checked.

**One genuine harm, which is not cost.** While the monitor runs, nothing ever
goes cold, so the owner cannot tell whether the platform is doing its job.

**The code change in this slice does NOT fix that, and an earlier draft of this
paragraph claimed it did.** The header makes the question free to *ask*; it does
nothing about the confound. With the monitor running, `x-coach-cold` reads false
forever whether or not Vercel's cold start prevention is doing anything at all.
The only thing that separates the two is pausing the monitor, which finding 5
deliberately declines to do. What the header actually buys is that the experiment
in finding 5, and the downgrade check in the checklist, cost nothing to run when
somebody wants them.

## Finding 5: what evidence would show the Pro feature working, and why it was not gathered

The clean experiment is not Hobby versus Pro, which is unavailable, but **monitor
on versus monitor off**, which is also the question that actually decides
anything: pause the Better Stack monitor, wait several hours, probe, compare
against the 0.157 second warm baseline in finding 2.

**It was deliberately not run**, and the reasoning is the point rather than the
conclusion. The experiment costs a window during which this demo has no warming
net at all, on a project whose entire recorded downside risk is a stranger's
first click. And because the recommendation is to keep the monitor either way,
the result changes no decision. Running a risky experiment to learn something
that cannot change the outcome is not rigour, it is theatre.

What was done instead: the experiment is written down in
`docs/pre-deploy-checklist.md`, ready to run, and the instrument it needs was
built so that running it later costs nothing.

## Finding 6: the function region should not change

The owner asked, having moved another project's region to Ohio and seen latency
improve. The reasoning does not carry across, and the reason it does not is the
useful part.

Moving a function closer usually pays because it removes a network round trip on
every **database** query. **This app has no database.** Its only outbound call is
to Anthropic, and almost the whole wait a visitor feels is Anthropic generating
text, not travel. The one measurement on record: `x-coach-upstream-ms: 1141`
against a 1337 millisecond wall clock, so roughly 200 milliseconds covered
everything that was not Anthropic thinking, against debriefs that run 11 to 30
seconds.

Cleveland (`cle1`) and Washington (`iad1`) are also priced identically, at $0.128
an hour of active CPU and $0.0106 a GB-hour, so there is no money in it either.

Against a gain too small to see sits a real cost: the region is a setting on the
one part of this app that local development cannot verify at all.

## Finding 7: Pro raises the function ceiling and this app does not notice

With Fluid compute, Pro allows 300 seconds by default and 800 as a maximum, where
Hobby allows 300. This project pins `maxDuration: 60` in `vercel.json`, and
Vercel's own order of precedence puts `vercel.json` above both the dashboard and
the Fluid defaults.

So the 60 stays 60 because the repository says so, and the deliberately staggered
40 second server deadline and 50 second browser deadline keep the relationship
they were designed with. No copy changes, and in particular the twice-written
"40 seconds" in `src/failureCopy.js` is untouched.

This was worth checking rather than assuming: had the pin been absent, the
function's ceiling would have moved underneath a stagger that was reasoned about
against 60.

## Finding 8: the spend posture no longer holds, and the obvious fix has a trap

This project's recorded cost posture is that a runaway bill is impossible because
the Anthropic balance is prepaid. That reasoning never extended to Vercel, and on
Pro it is actively wrong: metered usage runs against a $20 monthly credit and
bills on demand past it.

Vercel's default spend notification threshold is **$200 per billing cycle**,
which is not a number anybody here chose.

**The trap is in the obvious remedy.** Spend Management offers to pause
production for **all projects on the team** when the amount is reached. On a
portfolio piece whose whole purpose is surviving a stranger's first click, an
automatic pause is a self-inflicted outage during a job search, and paused
projects do not resume on their own when the next billing cycle starts; each one
must be resumed by hand. Recommended: a low amount with notifications, and the
pause switch left off.

Note also that the amount is set **per team, not per project**. There is no
per-project spend limit, so one number covers b1-coach and the other project
together.

---

# The tasks

## Task 1: put the warmth header on the free liveness path

**Why.** `api/coach.js` has tracked instance warmth in module scope since Slice 5
and reported it as `x-coach-cold`, but only on a successful POST, which costs an
Anthropic call. So the question "was this instance asleep?" had a price on it,
and consequently nobody ever asked it, which is finding 2 in one sentence.

**What changed.** One `res.setHeader` call in the GET and HEAD branch, plus the
comment explaining how to read the answer.

**Verification, red first.** Three tests added to the `cold instance detection`
block in `api/coach.test.js`, run before the fix and seen failing with `expected
undefined to be 'true'` and `expected undefined to be 'false'`: a fresh instance
reports cold on a liveness GET while still not calling Anthropic, a second GET
reports warm, and a HEAD carries the header while still sending no body. Suite
went 692 to 695.

**What this does not prove.** The suite cannot reach the deployed function at
all, so the end-to-end evidence is a curl against production after merge. That
obligation is written into `docs/pre-deploy-checklist.md` as well as handed over
in the PR's QA script, deliberately: in this project the QA script is a block
pasted into a chat message and does not survive the pull request, and an
obligation that lives only there is the exact failure the checklist was created
in this same commit to prevent.

**How to read the answer, precisely.** The ping itself warms the instance, so the
header reports whether the instance that served *this* request was already awake
when it arrived. That is the right question for an app with this little traffic
and the wrong one for a busy app.

## Task 2: create the pre-deploy checklist

**Why.** Changing a hosting plan, switching on a platform setting and cancelling
an external monitor all happen outside this repository, and the only session that
reliably knows an obligation exists is the one that created it. The standing rule
requires such obligations to land on the project's running pre-deploy checklist
in the same pull request. This project had no such file, so the first slice to
create an obligation creates the list.

**What it carries.** The current external state, written down for the first time;
the downgrade-to-Hobby note; the free warmth probe; and the unrun experiment from
finding 5.

## Task 3: the records

The decision log entry, and the CLAUDE.md rewrites: the "Deployment and cold
starts" section, which described the cold start as the thing the monitor exists
to prevent and is now only half true; the What's Next item that scoped this
slice; and the stale test count, which read 671 against a real 692 because the
Reduce Pop-Ups micro-PR did not update it.
