# B1 Coach: pre-deploy checklist and standing external obligations

Created 25 August 2026, in Slice 12.

**What this file is for.** Some of what keeps this app working does not live in
this repository at all: a hosting plan, a platform setting, an external uptime
monitor, a spending limit. Nothing in the code will ever mention them, and the
only session that reliably knows such an obligation exists is the one that
created it. This is where those obligations are written down so they survive.

**The standing rule:** a slice that creates a deploy-time obligation appends it
here, in the same pull request that creates it.

This file is append-only in the same spirit as the decision log. Correct an entry
with a dated annotation or a strikethrough, never by rewriting it. Note it orders
its dated entries **newest last**, which is the opposite of the decision log's
newest-first; this is an operating checklist meant to be read top to bottom, not
a history meant to be skimmed from the front.

---

## The external state, as of 25 August 2026

Confirmed by dashboard screenshot on that date, not by assumption.

| Thing | State | Where it lives |
| --- | --- | --- |
| Vercel team | **Jacob's projects**, plan **Pro** ($20/month) | Vercel |
| Cold Start Prevention | **Enabled** | Vercel, project Runtime Settings |
| Fluid Compute | **Enabled** | Vercel, project Runtime Settings |
| Function region | `iad1` (Washington DC) | Vercel, and deliberately not changed |
| Function CPU | Standard, 1 vCPU, 2 GB | Vercel |
| Node version | 24.x | Vercel |
| Deployment Protection | Standard Protection | Vercel |
| Function max duration | 60 seconds | `vercel.json`, which overrides the dashboard |
| Uptime monitor | Better Stack, every 5 minutes, against the app and `/api/coach` | Better Stack, set up 31 July 2026 |
| Vercel on-demand budget | **$5**, notifications on, **Pause Projects off** | Vercel, Settings, Billing, Spend Management |
| Anthropic balance | roughly $35 prepaid, auto-reload **off** | Anthropic console |

**Two of these are load-bearing in a way that is not obvious:**

- **The uptime monitor is not just a backup for cold starts.** Vercel keeps a
  Pro production deployment warm only if it was *invoked in the last 14 days*,
  and a visitor loading the static app does not invoke the function. The
  monitor's 8,640 pings a month are what make a fourteen day gap impossible. Do
  not cancel it on the grounds that Vercel now does the same job. See Slice 12's
  finding 3. **The hedge that finding carries travels with it:** the 14 day
  condition is a careful reading of one sentence in Vercel's "Scale to one" blog
  post, read 25 August 2026, not of a specification, and no Vercel document says
  what happens on day fifteen. Firming it up needs Vercel support, not another
  read of the same page.
- **`vercel.json` pins the function at 60 seconds and beats the dashboard.** Two
  deadlines are staggered against that number on purpose (40 seconds server side
  in `api/coach.js`, 50 seconds browser side in `src/coachApi.js`), and the 40 is
  written out twice in approved user-facing copy in `src/failureCopy.js`. If the
  platform limit ever moves under this app, the stagger gets re-decided
  deliberately, and any copy change needs the product manager's approval on the
  exact wording.

---

## How to check whether the app is sleeping, for free

Added in Slice 12. Before that, the only way to ask was to spend an Anthropic
call, which is why nobody ever asked.

```bash
curl -sS -D - -o /dev/null -w '\ntotal: %{time_total}s\n' https://b1-coach.vercel.app/api/coach
```

~~**Before trusting this for the first time, note what it rests on.** The header
was added in Slice 12 and is covered by unit tests only; this project's suite
cannot reach the deployed function at all. **The first run of this command
against production after Slice 12 merged is an outstanding obligation**, not a
routine check: it is the only thing that proves the header exists on a real
response. Record the result in the dated entries at the bottom of this file when
it is done, and strike this paragraph then.~~

**Discharged 25 August 2026**, minutes after Slice 12 merged. See the dated entry
at the bottom of this file. The header is now observed on real responses, so this
command is a routine check rather than an unproven one.

Read `x-coach-cold` in the output:

- `x-coach-cold: false` means the instance that served this request was already
  awake. This is the normal, healthy answer.
- `x-coach-cold: true` means this request landed on an instance that had to start
  up. One of these right after a deployment is expected and means nothing; a new
  deployment is always cold on its first request.

The `total` figure is the cross-check. **The warm baseline, measured 25 August
2026: 0.157 to 0.283 seconds** over five requests (0.157, 0.158, 0.163, 0.168,
0.283). Compare against the whole range, not the fastest of them: the slowest is
1.8 times the fastest on a sample of five, so anything inside a few tenths of a
second is indistinguishable from warm. A cold start reads as seconds, not tenths,
which is why the range being loose does not matter for the question being asked.

**Read the header precisely.** The ping itself warms the instance, so it reports
whether the instance serving *that* request was already awake, not whether some
other instance is warm now. At this app's traffic that is the question worth
asking. It would not be on a busy app.

---

## If the plan goes back to Hobby

**This is the whole reason Slice 12 exists.** The risk is shipping a slow first
click without knowing why, months from now, with none of this context in the
room.

Do these in order:

1. **Expect cold starts to come back.** Cold Start Prevention is Pro only. The
   uptime monitor becomes the only defence again, which is exactly why Slice 12
   kept it. **Confirm the Better Stack monitor is still running and still hitting
   `/api/coach` every five minutes** before anything else.
2. **Probe warmth** with the curl above, after a genuinely quiet spell rather
   than straight after a deploy. Compare against the 0.157 to 0.283 second
   baseline.
3. **The commercial-use question comes back.** Vercel's Hobby terms restrict
   commercial use, and a portfolio piece whose purpose is getting the owner hired
   sits in a grey area. Pro removed that ambiguity; a downgrade restores it.
4. **The spend limit disappears, and that is fine.** Spend Management is Pro
   only. On Hobby, overspending is impossible again, so the original recorded
   cost posture ("a runaway bill is impossible") becomes true once more, this
   time for Vercel as well as Anthropic.
5. **Nothing in the repository needs to change.** The 60 second pin is below
   Hobby's own ceiling, so the staggered deadlines and the approved "40 seconds"
   copy are unaffected. `TIMEOUT_COLD_MESSAGE` and the README's cold-start
   sentence were deliberately kept in Slice 12 for exactly this moment, so
   neither has to be rebuilt.

**Vercel's own downgrade mechanics, worth knowing before starting:** an account
may hold only one Hobby team, so a downgrade can require deleting or merging a
team; all members except the original owner are removed; and any connected stores
or domains must be transferred by hand first.

---

## The experiment nobody has run

Slice 12 designed this and deliberately did not run it. If the question ever
becomes live, it is ready.

**Question.** Does Vercel's cold start prevention keep this app warm on its own,
without the uptime monitor?

**Method.** Pause the Better Stack monitor. Wait several hours, ideally longer
than a working day. Run the curl probe above and read `x-coach-cold`. Restore the
monitor.

**Why it was not run.** For the duration of the window the demo has no warming
net, on a project whose entire recorded downside risk is a stranger's first
click. And the recommendation is to keep the monitor either way, so the result
changes no decision.

**What it can and cannot settle.** It can tell you whether the platform keeps one
instance warm without help. It cannot reconstruct whether the monitor ever helped
on the Hobby plan; that comparison required measuring before the upgrade and is
gone permanently.

---

## Dated entries

*Append below. Newest last.*

### 25 August 2026, Slice 12

- Vercel upgraded to **Pro** for a different project. Confirmed b1-coach sits on
  that same Pro team, which was not a formality: Pro is per team, and had the
  project been in a personal Hobby scope, every conclusion in Slice 12 would have
  been wrong with nothing in the repo to say so.
- **Cold Start Prevention and Fluid Compute were both already enabled.** Nothing
  had to be switched on.
- **The Better Stack monitor was kept**, unchanged, on the reasoning in Slice
  12's finding 3. Cost measured at roughly $0.006 a month.
- **The function region was left at `iad1`**, deliberately. This app has no
  database, so the usual reason to move a function closer does not apply here.
- **The warmth probe was run against production and works**, which was Slice 12's
  one outstanding verification. Two requests, moments after the merge deployed:
  the first returned `HTTP/2 200` with `x-coach-cold: true` in 0.299s, the second
  `x-coach-cold: false` in 0.211s. So the header reaches real responses and
  distinguishes the two states rather than merely existing.

  **One observation, recorded as a lead and not as a finding.** That cold
  response still came back in 0.299 seconds against 0.211 warm, about 90
  milliseconds apart, where this project's records describe a cold start as
  "several extra seconds". Do not read it as showing cold starts are gone. It is
  a single sample on the liveness path, which does no work at all: it loads no
  session, builds no prompt and calls nothing. A cold start on the POST path also
  pays for whatever the real handler has to do before it can answer. What would
  settle it is the `x-coach-cold` header on a real debrief, which the POST path
  has carried since Slice 5 and which nobody has collected.
- **An on-demand budget of $5 was set**, down from Vercel's default of $200,
  which was a number nobody chose. Notifications on, **Pause Production
  Deployments deliberately off**: that switch pauses every project on the team
  and each one must then be resumed by hand, so on a demo whose whole downside is
  a stranger's first click it is a self-inflicted outage. The budget counts only
  on-demand charges *after* the $20 included credit, and measured usage across
  both projects was $0.06 in the cycle's first day, so $5 is a catastrophe
  backstop rather than a working limit. **On a downgrade to Hobby this setting
  disappears**, and that is fine: overspending becomes impossible again.
