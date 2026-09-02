# B1 Coach

An AI coaching layer for TrackMan B1 baseball hitting data. Proof of concept.

**Live demo: https://b1-coach.vercel.app**

*Built independently for demonstration. Not affiliated with TrackMan.*

Collecting hitting data and interpreting it are two different jobs. B1 Coach is the interpretation layer. It takes per-session hitting metrics and delivers them the way a coach would after batting practice: a few observations grounded in the actual numbers, two concrete tips, and a chat coach the player can ask follow-up questions.

The coaching is generated live, so a debrief takes a few seconds to come back, and occasionally longer if the server has been idle.

## What it does

Pick a goal, take a session of fifteen swings, get a debrief.

Six goals: **Power & Distance**, **Line Drives & Contact**, **Hit to All Fields**, **Reduce Pop-Ups**, **Open Session** and **Full Dashboard**. The first five shape every piece of coaching output around what that goal asks of a swing. Full Dashboard is deliberately out of scope for the proof of concept and says so when you tap it.

- A live session screen animates swings in as they land
- The debrief is written by Claude from the session's exit velocity, launch angle, pitch location, spray direction and distance
- Claude also picks which two of six charts to show, based on the goal and what the session actually did
- The chat coach answers follow-ups with the full session in context
- Up to four sessions per goal, with earlier sessions passed forward so the coaching has continuity

## The data is synthetic

There is no live TrackMan feed. The mock data is structured to match the real B1 API, so integration would be a swap rather than a rebuild. That covers the shape. The values were a separate piece of work.

The generator is built around one hitter, written down deliberately: **Bill, a sixteen-year-old varsity junior with good bat-to-ball skills, real but not elite bat speed, who chases too much.** Session 1 is a fixed set of fifteen swings, averaging 81.6 mph with a best of 92. Every later session is generated from those numbers.

- **About 65% of pitches are strikes.** That is Bill's chase rate, not the pitcher's accuracy, since every row in this app is a ball he swung at.
- **Where the pitch was thrown predicts how well it was struck**, by about 4.6 mph between a swing at a strike and a swing at a ball.
- **Pop-ups exist and have a cause.** Roughly one every couple of sessions, four in five of them on pitches at or above the top of the zone.
- **A pitch outside the zone misses on one axis, not both.** Low, high or wide, rather than wild in two directions at once. Never both, which is tidier than a real arm.
- **Nothing piles up on a limit.** Values compress toward the edges of what is possible rather than stopping dead on them, so no chart draws a flat row of dots along its own ceiling.

**What it is not is validated against real baseball.** The pop-up rate was chosen because it reads plausibly, not derived from a published figure. And the relationship between pitch height and launch angle, while real, bends the wrong way at the very top of the zone: a ball chased above the letters comes out about two degrees flatter than one down the middle, where it should be steeper. That is written up rather than hidden. This is deliberately modelled synthetic data with the reasoning recorded, not a simulation anyone should trust as a model of hitting.

## Keeping an AI coach honest

A language model writing about numbers will confidently get them wrong. Five things push back:

- **The app counts, the model writes.** Every threshold the coaching prose names is pre-counted and handed over, because a model asked to count swings itself will miscount. Measured across 52 debriefs before and after, that error went from 8 occurrences to none.
- **The app writes the per-swing numbers.** The coach leaves a placeholder where a swing's exit velocity, angle or distance goes, and the app fills in the real figure, so a number it hands over cannot come out wrong.
- **The app picks which swing to praise.** The coach was caught building its advice around the second-best swing with every number in the sentence correct, so the app now names the best one for the goal.
- **The model's chart choices are validated.** Claude names which charts to render. An invented or duplicated name is rejected and replaced with a real chart on real data, so a bad pick cannot reach the screen.
- **Failure messages say what actually failed.** A drained API balance, a timeout, trouble at the API end and an unreachable server are four different messages, because one vague apology is a guess presented as a fact.

Some of it was a deliberate trade. Making the coach shorter cost about 28% of the real numbers it used to quote. Kept anyway, because short and focused is what gets read, and a player who wants more can just ask the chat coach. The reasoning is in the decisions log.

## Running it locally

```bash
npm install
npm run dev
```

`npm test` runs the suite. `npm run build` produces the static bundle.

**One trap worth knowing.** Local development never runs the serverless function. Vite proxies `/api/coach` straight to the Anthropic API, so the browser talks to Anthropic directly and `api/coach.js` does not execute. Changes to that file cannot be verified locally and need a deployed preview.

That is also why the API key has two names:

| Environment | Variable | Read by |
| --- | --- | --- |
| Local | `VITE_ANTHROPIC_API_KEY` | the Vite dev proxy |
| Production | `ANTHROPIC_API_KEY` | the Vercel serverless function |

Copy `.env.example` to `.env.local` for local work. In production the key stays server side and the browser never sees it.

## Tech stack

React, Vite, Recharts, react-markdown, Anthropic API (Claude Sonnet), Vercel serverless functions.

Styling is mostly inline styles. Tailwind is installed but used only minimally.

## What this repo does and does not show

The product work is the part I stand behind, and it was there from day one: the design, the prompt engineering, the audience thinking, and a decision log recording the reasoning behind every call, starting with session one and never dropped.

What was not there is engineering discipline. I built this fast and by feel across ten sessions in April and May 2026, learning what AI-assisted building was as I went. No tests, no pull requests, no code review. A reviewer can confirm that in about thirty seconds, so it is worth saying plainly.

At the end of July I came back to a finished app and spent the next month adding what was missing: safety nets first, then an audit that found real defects, then evaluation harnesses that measured whether the coaching was factually right rather than merely fluent. One slice was rejected by its own QA gate, and the record says so.

I am not an engineer and this is not an engineering showcase. What it shows is that I could tell something was missing and go get it.

## Documentation

- [Proof of Concept](docs/proof-of-concept.md): the product thesis, the verdict, and ten things I learned about making an AI coach trustworthy enough to put in front of a player
- [Product Decisions Log](docs/product-decisions-log.md): every decision and its reasoning, newest first
