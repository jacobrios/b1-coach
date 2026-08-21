// Measures whether the synthetic swing generator produces honest sessions, by
// replaying it tens of thousands of times and counting what actually comes
// out, rather than trusting a single run or a claim in a document.
//
// WHY THIS FILE EXISTS: the changes in Slice 6 ("honest ball flight") are
// claims about *distributions*, not about single values — "the Power target
// band renders empty 13% of the time instead of 56%" is not something one
// generated session can prove one way or the other, and it is not something
// this project's unit test suite is built to settle either (see
// docs/queued-slices.md and the verification norms in CLAUDE.md: the suite
// tests the deterministic seams, never a distribution). This script is that
// evidence. Its output is what gets pasted into the decision record, and it
// is meant to be rerun by anyone who doubts the numbers there, rather than
// taken on faith.
//
// HAND-RUN, NOT PART OF THE SUITE. This file is named measure-*.mjs, not
// *.test.js or *.spec.js, which is what this project's default vitest
// collection (no vitest.config, so vitest's own default include glob) keys
// on. It will never run inside `npm test` and never gate a commit. Run it
// yourself, on demand:
//
//   node scripts/measure-swing-generation.mjs
//   node scripts/measure-swing-generation.mjs --seed 12345
//
// It replays 20,000 sessions per session-number/goal combination and prints a
// plain-text report. It takes a few seconds.
//
// EVERY NUMBER IN THAT REPORT IS REPRODUCIBLE, AND IT DID NOT USE TO BE.
// Until Slice 11 this script drew from Math.random, so nothing it printed
// could be rerun to the same answer. The Power goal's empty-band figure read
// 56.6% on one run and 57.3% on the next, from untouched code, and CLAUDE.md
// carries that as a standing warning: no number this script or its sibling
// has ever printed is a fixed measurement rather than one draw. It now draws
// from a seeded generator instead, so the same command gives the same report
// on any machine on any day, and a number quoted in a decision record or a
// pull request can be checked rather than believed. That is the whole reason
// the seed was added, and it is why Slice 11's entire evidence base is
// allowed to be what this script prints.
//
// Pass --seed to see a different draw. Every finding here should survive
// changing it; one that does not is sampling noise being read as a result.
//
// EACH MEASUREMENT GETS ITS OWN RANDOM STREAM, named after the thing it
// measures rather than drawn in turn from one shared stream. That is what
// stops adding a section to this file from silently moving every number
// printed after it, which would quietly break any comparison between numbers
// taken from two versions of this script. Sections can be added, removed or
// reordered and the surviving ones still print exactly what they printed
// before.
//
// WHAT THE REPORT CONTAINS, IN THE ORDER IT PRINTS. Two halves, and they are
// about two different slices. Read the banner before quoting a number.
//
//   1. THE SLICE 11 BASELINE, nine sections, added 21 August 2026. One per
//      defect Slice 11 sets out to fix in the generator, plus a last section
//      of the numbers that are working today and must survive the rewrite.
//      These describe the generator as it stands in the working tree. They
//      never use the words "before" and "after", because this file already
//      spends that pair of words on something else.
//
//   2. THE SLICE 6 COMPARISON, which is where that pair of words is spent:
//      the generator before honest ball flight landed in August 2026, against
//      the generator today. Everything below its banner, including the two
//      correlation sections that close the report, belongs to it.
//
// WHAT THE SECOND HALF COMPARES. Two versions of the generator, side by side,
// using the SAME goal targets and the SAME session-1 baseline the real app
// uses:
//
//   "before" — the generator as it stood before this slice touched it.
//     Exit velocity and launch angle drawn independently of each other, no
//     extra lift toward the Power goal's target, no re-roll of a session that
//     would draw an empty target band, and the old straight-line distance
//     formula. This is a local, hand-copied reimplementation of history —
//     recovered with `git show 02a86f1:src/App.jsx`, which is the commit
//     right before this slice's Task 2 (the distance formula) landed — kept
//     here ONLY so the "before" numbers in the decision record can be
//     rerun rather than quoted. It is not live code and nothing imports it.
//
//   "after" — today's real generator, imported straight from
//     src/swingGenerator.js and src/goalTargets.js. Whatever those files do,
//     this script measures, with no reimplementation and no chance of the
//     measurement drifting from the shipped behaviour.
//
// THE BASELINE FIXTURE. Every session the app generates, at every session
// number, is built off the averages of the same fifteen hand-written
// session-1 swings — not off the previous session — because that is what
// `onNewSession` in src/App.jsx actually calls: `baselineSwings: mockSwings`
// every time, regardless of `sessionNumber`. Slice 7b extracted that array
// into src/sessionOneSwings.js, specifically so this script (and its sibling
// scripts/compare-distance-bucket-schemes.mjs) could import it instead of
// hand-copying it — this was one of two copies that existed only because
// App.jsx contains JSX and could not be loaded by plain Node. Imported below
// as `mockSwings` to keep every reference site in this file unchanged.
//
// WHAT COUNTS AS "THE TARGET BAND WAS EMPTY". A session's target band is
// empty when none of its fifteen swings satisfy that goal's launch-angle and
// exit-velocity target, per `meetsTarget` in src/goalTargets.js. Only goals
// that have a target at all can have an empty band; today that is `power`,
// `contact`, and `popup`. `allfields` and `open` have no target and are not
// measured here for that reason — there is no such thing as an empty band on
// a chart that draws no band.
//
// THE DISTANCE BUCKETS. The results screen's bar chart, and both coach
// prompts, sort every swing into one of five distance buckets rather than
// showing a raw number. Those five buckets — their edges and their labels —
// live in exactly one place, `DISTANCE_BUCKETS` in src/ballFlight.js (added
// in this slice's Task 4, specifically so nothing else, including this
// script, would carry its own copy and let it drift). This script IMPORTS
// that constant and the `distanceBucketCounts` function that sorts swings
// into it; it does not hand-copy the edges. For every goal and session this
// reports what fraction of swings landed in each bucket, for both the old
// generator and today's, so the decision record can show plainly that the
// old formula left the two shortest buckets close to empty no matter how
// weakly a ball was struck.

// TWO EXTRA SECTIONS AT THE END, ADDED 14 AUGUST 2026. The before/after tables
// answer "what did this slice do", but two of the comments in
// src/swingGenerator.js make a narrower claim: what the exit-velocity/launch-
// angle correlation did BY ITSELF, with the empty-band re-roll switched off.
// That intermediate state never shipped, so nothing above can show it. The
// last two sections produce it: how often Line Drives & Contact drew an empty
// target band in each of the three states, and whether a session got wider or
// tighter. Both were quoted as measured fact in comments before anything here
// could reproduce them, which is the same defect this slice exists to remove.
//
// A LOADER WRINKLE, EXPLAINED SO NOBODY "FIXES" IT AWAY. src/swingGenerator.js
// imports its neighbours as `./ballFlight` and `./goalTargets`, with no file
// extension. That is fine under Vite and under vitest (both resolve it), but
// plain `node` refuses it: ERR_MODULE_NOT_FOUND. Editing swingGenerator.js's
// import lines to add extensions was out of scope for this script and would
// have touched shipped source for a script's convenience. Instead, this file
// registers a tiny, inline module hook — a `data:` URL, not a second file —
// that retries a failed extensionless relative import with `.js` appended,
// then imports the real generator through it. Nothing about the generator's
// behaviour is touched or reimplemented by this hook; it only helps Node find
// the file.
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const EXTENSIONLESS_RESOLVE_HOOK = `
  export async function resolve(specifier, context, nextResolve) {
    try {
      return await nextResolve(specifier, context)
    } catch (err) {
      const looksExtensionless = specifier.startsWith('.') && !/\\.[a-zA-Z0-9]+$/.test(specifier)
      if (err && err.code === 'ERR_MODULE_NOT_FOUND' && looksExtensionless) {
        return await nextResolve(specifier + '.js', context)
      }
      throw err
    }
  }
`
register('data:text/javascript,' + encodeURIComponent(EXTENSIONLESS_RESOLVE_HOOK), import.meta.url)

const { generateSwings } = await import('../src/swingGenerator.js')
const { hasTarget, meetsTarget } = await import('../src/goalTargets.js')
const { distanceBucketCounts, DISTANCE_BUCKETS } = await import('../src/ballFlight.js')
const { SESSION_ONE_SWINGS: mockSwings } = await import('../src/sessionOneSwings.js')

// Added for the Slice 11 baseline sections further down. Same discipline the
// distance buckets already get here: the strike zone, the pull/opposite-field
// cutoffs and the pop-up angle are all read from the one place the app itself
// reads them, so this script cannot end up measuring a different strike zone
// or a different pull side than the coach is told about.
const { STRIKE_ZONE, inStrikeZone, sprayBreakdown } = await import('../src/sessionStats.js')
const { GOAL_COUNT_SPECS } = await import('../src/goalCountSpecs.js')
// "1 swing", never "1 swings". This repo settled that rule in Slice 8c and put
// it in one place; a measurement script printing counts in English is the same
// problem the coach prompt had, so it uses the same helper rather than a third
// convention of its own.
const { swingCountPhrase } = await import('../src/promptText.js')

// ---------------------------------------------------------------------------
// The seed, and the named random streams every measurement below draws from.

const DEFAULT_SEED = 20260821

// A bad --seed is refused rather than shrugged off. `Number('banana') >>> 0`
// is 0, so a typo would otherwise run happily on a seed nobody chose and
// print a full page of official-looking numbers that no rerun of the command
// as typed could ever reproduce.
function parseSeed(argv) {
  const eq = argv.find((a) => a.startsWith('--seed='))
  const flagAt = argv.indexOf('--seed')
  if (!eq && flagAt < 0) return DEFAULT_SEED

  // Asking for a seed and not supplying one is a mistake, not a request for
  // the default. Both spellings of an empty seed are refused: `--seed` with
  // nothing after it used to fall through to the default, and `--seed=` used
  // to become seed 0, since Number('') is 0. Either way the command as typed
  // would not have reproduced the report it printed, which is the one thing
  // this flag exists to guarantee.
  const raw = eq ? eq.slice('--seed='.length) : argv[flagAt + 1]
  const value = Number(raw)
  if (raw === undefined || raw.trim() === '' || !Number.isInteger(value) || value < 0) {
    console.error(
      `--seed needs a whole number that is zero or more. Got: ${raw === undefined || raw.trim() === '' ? '(nothing)' : raw}`
    )
    process.exit(1)
  }
  return value
}

const SEED = parseSeed(process.argv.slice(2))

// WHICH GENERATOR THIS RUN MEASURED, printed at the top of the report.
//
// The seed says which sample was drawn. It does not say what was drawn FROM,
// and this script's whole job right now is to be run once before the generator
// is rewritten and again after. Two saved runs both headed "baseline" would be
// exactly the confusion this file has already worked hard to design out of the
// word "before".
//
// A fingerprint of the generator's own source is used rather than a git commit
// because it identifies the file that actually ran. A commit stamp says nothing
// about uncommitted edits, and a run taken mid-rewrite is precisely when
// somebody would be tempted to save the output.
const GENERATOR_SOURCE = readFileSync(new URL('../src/swingGenerator.js', import.meta.url), 'utf8')
const GENERATOR_FINGERPRINT = createHash('sha256').update(GENERATOR_SOURCE).digest('hex').slice(0, 12)

// The same small, fast, well-behaved generator scripts/grade-coach-accuracy.mjs
// already uses to rebuild a graded session. Copied rather than imported for
// the reason that file's own copy exists: these are hand-run scripts that must
// keep working on their own, and this is nine lines of arithmetic with no
// behaviour to keep in step.
function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One independent stream per named measurement, derived from the seed and the
// name together. Two measurements with different names get unrelated draws
// from the same seed, and a measurement keeps its own draws no matter what
// else is added to this file. The mixing is a plain FNV-1a hash of the name
// folded into the seed; nothing here needs to be cryptographic, only stable.
function streamFor(name) {
  let h = (0x811c9dc5 ^ SEED) >>> 0
  for (let i = 0; i < name.length; i++) {
    h = (h ^ name.charCodeAt(i)) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return mulberry32(h)
}

const REPLAYS_PER_CELL = 20000
const SESSIONS = [2, 3, 4]
const TARGET_GOALS = [
  { id: 'power', label: 'Power & Distance' },
  { id: 'contact', label: 'Line Drives & Contact' },
  { id: 'popup', label: 'Reduce Pop-Ups' },
]

// ---------------------------------------------------------------------------
// HISTORICAL REFERENCE ONLY — the generator as it stood before this slice.
// Recovered from `git show 02a86f1:src/App.jsx` (the commit immediately
// before this slice's Task 2 changed the distance formula, and well before
// Task 3 added the correlation between exit velocity and launch angle, the
// Power lift, and the empty-band re-roll). Kept here, commented as history,
// only so the "before" numbers this script prints can be rerun by anyone —
// not cited from a document — rather than reimplemented from memory. This is
// not live code, nothing else in the app imports it, and it must never be
// "fixed" to match the current generator: the whole point is that it does
// NOT match it.
//
// Old behaviour, in full:
//   - Exit velocity and launch angle are drawn completely independently.
//   - No goal is passed in at all, so nothing about a player's chosen goal
//     (in particular Power) changes the session average.
//   - Nothing re-rolls a session whose target band comes up empty.
//   - Distance is a straight line, not a shape: round(ev * 4.0 + la * 1.8).
function oldGenerateOneSession(sessionNum, prevEV, prevLA, random) {
  const improving = random() < 0.65
  const sessionEV = prevEV + (improving ? (1 + random() * 3) : -(1 + random() * 2))
  const sessionLA = prevLA + (improving ? (0.5 + random() * 2) : -(0.5 + random() * 1.5))
  const varianceFactor = Math.max(0.85, 1 - (sessionNum - 2) * 0.05)

  return Array.from({ length: 15 }, () => {
    const ev = Math.round(Math.max(65, Math.min(97, sessionEV + (random() - 0.5) * 16 * varianceFactor)))
    const la = Math.round(Math.max(-5, Math.min(35, sessionLA + (random() - 0.5) * 22 * varianceFactor)))
    const dist = Math.round(ev * 4.0 + la * 1.8) // the old, honest-distance-free formula
    return { hit: { launch: { exitSpeed: ev, angle: la, direction: 0 }, landing: { distance: dist } } }
  })
}

function oldGenerateSwings(sessionNum, baselineSwings, random) {
  const prevEV = baselineSwings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / baselineSwings.length
  const prevLA = baselineSwings.reduce((s, w) => s + w.hit.launch.angle, 0) / baselineSwings.length
  return oldGenerateOneSession(sessionNum, prevEV, prevLA, random)
}

// ---------------------------------------------------------------------------
// Small stats helpers.

function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return NaN
  const idx = (p / 100) * (sortedAscending.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAscending[lo]
  return sortedAscending[lo] + (sortedAscending[hi] - sortedAscending[lo]) * (idx - lo)
}

function average(nums) {
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function formatDistribution(distances) {
  const sorted = [...distances].sort((a, b) => a - b)
  return {
    min: sorted[0],
    p10: Math.round(percentile(sorted, 10)),
    p25: Math.round(percentile(sorted, 25)),
    p50: Math.round(percentile(sorted, 50)),
    p75: Math.round(percentile(sorted, 75)),
    p90: Math.round(percentile(sorted, 90)),
    max: sorted[sorted.length - 1],
  }
}

// What fraction of swings landed in each of the app's five distance buckets.
// Reuses distanceBucketCounts from src/ballFlight.js — the same function the
// results screen and both coach prompts call — rather than re-filtering the
// distances by hand, so this can never disagree with the app about where a
// bucket's edge falls. It takes swings shaped { hit: { landing: { distance
// } } }, so a plain array of numbers is wrapped just enough to match that
// shape and nothing more.
function bucketPercentages(distances) {
  const fakeSwings = distances.map((d) => ({ hit: { landing: { distance: d } } }))
  return distanceBucketCounts(fakeSwings).map(({ label, count }) => ({
    label,
    share: count / distances.length,
  }))
}

// ---------------------------------------------------------------------------
// Measurement.
//
// "before" ignores the goal entirely when generating (that is the historical
// behaviour being measured), so one batch of replays per session number is
// generated once and then judged against each goal's target in turn — this
// is faster and it is also the honest way to represent the old code, which
// truly produced the same distribution no matter which goal a player picked.
//
// "after" is goal-aware (the Power lift, and the goal-specific re-roll), so
// it is measured separately for each goal.

function measureBefore(sessionNum) {
  const random = streamFor(`slice6-old-generator|session-${sessionNum}`)
  const distances = []
  const evs = []
  const las = []
  const emptyCounts = Object.fromEntries(TARGET_GOALS.map((g) => [g.id, 0]))

  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = oldGenerateSwings(sessionNum, mockSwings, random)
    for (const w of swings) {
      distances.push(w.hit.landing.distance)
      evs.push(w.hit.launch.exitSpeed)
      las.push(w.hit.launch.angle)
    }
    for (const goal of TARGET_GOALS) {
      if (!swings.some((w) => meetsTarget(goal.id, w.hit.launch))) {
        emptyCounts[goal.id]++
      }
    }
  }

  return {
    distances,
    avgEV: average(evs),
    avgLA: average(las),
    emptyRates: Object.fromEntries(
      TARGET_GOALS.map((g) => [g.id, emptyCounts[g.id] / REPLAYS_PER_CELL])
    ),
  }
}

function measureAfterForGoal(sessionNum, goalId) {
  const random = streamFor(`slice6-today|session-${sessionNum}|${goalId}`)
  const distances = []
  const evs = []
  const las = []
  let emptyCount = 0

  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId,
      baselineSwings: mockSwings,
      random,
    })
    for (const w of swings) {
      distances.push(w.hit.landing.distance)
      evs.push(w.hit.launch.exitSpeed)
      las.push(w.hit.launch.angle)
    }
    if (hasTarget(goalId) && !swings.some((w) => meetsTarget(goalId, w.hit.launch))) {
      emptyCount++
    }
  }

  return {
    distances,
    avgEV: average(evs),
    avgLA: average(las),
    emptyRate: emptyCount / REPLAYS_PER_CELL,
  }
}

// ---------------------------------------------------------------------------
// Report.

function pct(x) {
  return `${(x * 100).toFixed(1)}%`
}

// A second decimal, for the shares that are meant to be compared with each
// other rather than read on their own: a pile-up against a ceiling is a
// fraction of a percent, and rounding it to one decimal turns three different
// answers into "0.0%".
function pct2(x) {
  return `${(x * 100).toFixed(2)}%`
}

function printDistributionLine(label, dist) {
  console.log(
    `      ${label.padEnd(22)} shortest ${String(dist.min).padStart(4)} ft` +
      `  |  10th pct ${String(dist.p10).padStart(4)} ft` +
      `  |  25th pct ${String(dist.p25).padStart(4)} ft` +
      `  |  middle (50th) ${String(dist.p50).padStart(4)} ft` +
      `  |  75th pct ${String(dist.p75).padStart(4)} ft` +
      `  |  90th pct ${String(dist.p90).padStart(4)} ft` +
      `  |  longest ${String(dist.max).padStart(4)} ft`
  )
}

function printBucketLine(buckets) {
  console.log(
    '        Where the balls landed: ' +
      buckets.map(({ label, share }) => `${label}ft ${pct(share)}`).join('  |  ')
  )
}

// ===========================================================================
// THE SLICE 11 BASELINE: TODAY'S GENERATOR, MEASURED ITEM BY ITEM
//
// Slice 11 rewrites the generator because the data it produces lies about the
// hitter and about the pitcher in eight measured ways. Everything from here to
// the "SLICE 6 COMPARISON" banner is one section per item, each printing what
// the generator in the working tree does TODAY, so that when the same command
// is run again after the rewrite there is something honest to sit the new
// numbers against.
//
// A WORD ABOUT THE WORD "BEFORE", WHICH IS WHY IT IS NOT USED HERE. This file
// already had a before-and-after pair in it, and it means Slice 6: "before" is
// a hand-copied reimplementation of the generator as it stood in August 2026
// before honest ball flight landed, kept so that slice's claims stay
// rerunnable. Slice 11's own "before" is today's generator, which that older
// pair calls "after". Two different meanings for one word in one report is how
// a number ends up quoted against the wrong thing months later, so these
// sections say "today" and never "before", and the older pair says Slice 6 in
// its own banner.
//
// One measurement pass produces all nine sections. Every session-number and
// goal combination is replayed once, and everything each section needs is
// counted off that same set of sessions, so the numbers in different sections
// describe the same practice rather than nine independent samples that would
// each disagree with the others by a little.
//
// The goal labels below are hand-copied from GOALS in src/App.jsx, which a
// plain Node script cannot import because it contains JSX. This is the same
// disclosed copy scripts/bench-coach-brevity.mjs carries for the same reason,
// and TARGET_GOALS above already carries three of the five. Renaming a goal on
// screen does not rename it here; that has to be done by hand.
// SENTENCES IN THIS REPORT THAT DO NOT RE-DERIVE THEMSELVES.
//
// Most of the nine sections interpolate their numbers from the measurement, so
// they re-state themselves correctly on any run. The sentences listed below do
// not. They were written about what this generator does today, and each one
// INVERTS once Slice 11's rewrite lands. Whoever runs the after-round owes
// every one of them a read against the table beneath it.
//
// THE CRITERION IS NOT "CONTAINS A HAND-TYPED NUMBER", and getting that wrong
// is what let this list be incomplete for two rounds. An earlier version said
// exactly that, and it therefore missed sentences like "Only Power reaches it
// in any quantity" and "the coach is handed a count of zero pop-ups on every
// session forever", which carry no number and were just as false under a
// changed generator. The criterion is: any sentence stating an INTERPRETATION
// that would be different if the generator behaved differently.
//
// It lives here as data rather than as prose because the report has to print
// it. This script is written for a reader who never opens the file, so a
// disclosure that exists only in a source comment is not a disclosure. One
// definition, printed once, so the two cannot drift.
const SENTENCES_THAT_DO_NOT_RE_DERIVE = [
  [1, 'Since Slice 8c the coach is handed which pitches were outside the zone and reasons about them out loud. True of the app, not of the generator, and it is what makes section 1 matter.'],
  [2, 'No real thrower misses on both axes at once. A judgment about baseball rather than about this data, printed only while the data shows it.'],
  [3, 'An opposite-field lean is backwards for a high school hitter. Same kind of judgment, same conditional printing.'],
  [9, 'Session 1 is the shape the generated sessions are measured against. True by construction while session 1 stays frozen, which Slice 11 does not change.'],
]

const SLICE11_GOALS = [
  { id: 'power', label: 'Power & Distance' },
  { id: 'contact', label: 'Line Drives & Contact' },
  { id: 'allfields', label: 'Hit to All Fields' },
  { id: 'popup', label: 'Reduce Pop-Ups' },
  { id: 'open', label: 'Open Session' },
]

const POP_UP_ANGLE = GOAL_COUNT_SPECS.popup.popUpAngle

// The four walls the generator squeezes every swing between. HAND-COPIED from
// the two Math.max/Math.min lines in src/swingGenerator.js, which write them as
// bare literals and export nothing, so there is no honest way to import them.
// The same disclosed-copy situation as the goal labels above.
//
// A copy of a shipped number is exactly what this project consolidates against
// everywhere else, so it does not sit here unwatched: the check below refuses
// to print a report if a swing ever came out beyond one of these, which is what
// a stale copy would look like.
//
// WHICH HALF IT CATCHES, corrected 21 August 2026 after this comment stated it
// backwards and the wrong version was repeated into a task report. Measured
// both ways, not reasoned about:
//
//   A wall that moved further OUT than this copy IS caught. The generator
//   produces a value beyond the copy, the check sees it, and the run stops
//   with a message naming both ranges.
//
//   A wall that moved INWARD is MISSED. Every value the generator produces is
//   still inside this copy, so nothing looks wrong, and the report goes on to
//   describe a wall at a position no swing can now reach.
//
// So Slice 11's Task 6, which replaces both clamps with soft compression, has
// to update this by hand. That instruction was always right; only the reason
// printed beside it was inverted.
const GENERATOR_CLAMPS = {
  exitVelocity: { min: 65, max: 97 },
  launchAngle: { min: -5, max: 35 },
}
const SESSION_ONE_AVG_EV = average(mockSwings.map((w) => w.hit.launch.exitSpeed))

function round2(x) {
  return Math.round(x * 100) / 100
}

// The spread of one number around its own average, dividing by n rather than
// by n-1. That choice matters and is not arbitrary: session 1's spread of 6.11
// mph, which this slice is aiming the generator at, is a population figure, and
// mixing the two conventions on a fifteen-swing session moves a number by about
// three and a half percent, which is enough to make a target look met when it
// is not. The older Slice 6 section at the bottom of this report uses n-1 and
// says so, so both are here and both are labelled.
function populationSd(xs) {
  const m = average(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}

// How far outside the strike zone a pitch was, in feet, per axis and overall.
// "Overall" is the larger of the two axes rather than a diagonal, which is the
// measure that reproduces session 1's own six misses exactly: its swing 14 is
// a tenth of a foot high AND a tenth wide, and reads as a one-tenth miss the
// way a person watching would describe it, not as 0.14.
function pitchMiss(w) {
  const heightMiss = Math.max(0, STRIKE_ZONE.heightMin - w.plateLocHeight, w.plateLocHeight - STRIKE_ZONE.heightMax)
  const sideMiss = Math.max(0, STRIKE_ZONE.sideMin - w.plateLocSide, w.plateLocSide - STRIKE_ZONE.sideMax)
  return { heightMiss: round2(heightMiss), sideMiss: round2(sideMiss), miss: round2(Math.max(heightMiss, sideMiss)) }
}

// Counting helpers. Millions of swings go through this pass, so anything
// measured per swing is tallied into a small map of value-to-count rather than
// pushed onto an array of four million numbers. The percentiles come out of
// the tally the same way they would out of the array.
function bump(counter, key, by = 1) {
  counter.set(key, (counter.get(key) ?? 0) + by)
}

function counterTotal(counter) {
  let total = 0
  for (const n of counter.values()) total += n
  return total
}

function counterMean(counter) {
  let sum = 0
  let total = 0
  for (const [value, n] of counter) {
    sum += value * n
    total += n
  }
  return total ? sum / total : NaN
}

function counterPercentile(counter, p) {
  const total = counterTotal(counter)
  if (total === 0) return NaN
  const keys = [...counter.keys()].sort((a, b) => a - b)
  const valueAt = (rank) => {
    let seen = 0
    for (const k of keys) {
      seen += counter.get(k)
      if (rank < seen) return k
    }
    return keys[keys.length - 1]
  }
  const idx = (p / 100) * (total - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return valueAt(lo)
  const a = valueAt(lo)
  const b = valueAt(hi)
  return a + (b - a) * (idx - lo)
}

function counterShare(counter, predicate) {
  const total = counterTotal(counter)
  if (total === 0) return NaN
  let hit = 0
  for (const [value, n] of counter) if (predicate(value)) hit += n
  return hit / total
}

function counterMin(counter) {
  return Math.min(...counter.keys())
}

function counterMax(counter) {
  return Math.max(...counter.keys())
}

function mergeCounters(counters) {
  const out = new Map()
  for (const c of counters) for (const [value, n] of c) bump(out, value, n)
  return out
}

// ---------------------------------------------------------------------------
// One replayed cell: one session number, one goal, REPLAYS_PER_CELL sessions,
// everything the nine sections need counted in a single pass.

function measureSlice11Cell(sessionNum, goalId) {
  const random = streamFor(`slice11-baseline|session-${sessionNum}|${goalId}`)

  const inZone = { n: 0, ev: 0, la: 0 }
  const outZone = { n: 0, ev: 0, la: 0 }
  const missCounter = new Map()
  const heightMissCounter = new Map()
  const sideMissCounter = new Map()
  const missAxes = { low: 0, high: 0, wide: 0, bothAxes: 0 }
  const pitchHeightCounter = new Map()
  const pitchSideCounter = new Map()
  const evCounter = new Map()
  const laCounter = new Map()
  const topEvCounter = new Map()
  const sessionAvgEvCounter = new Map()
  const bucketTotals = DISTANCE_BUCKETS.map(() => 0)
  // Counted per column rather than only as "this session had an empty column
  // somewhere", because two goals turn out to fail at opposite ends of the
  // chart and a single pooled rate hides that completely.
  const bucketEmptySessions = DISTANCE_BUCKETS.map(() => 0)
  const spray = { pull: 0, middle: 0, oppo: 0 }

  let popUps = 0
  let popUpsOnHighPitch = 0
  let allFieldsBarMet = 0
  let emptyBand = 0
  let emptyColumnTotal = 0
  let sessionsWithAnEmptyColumn = 0
  let withinEvSquares = 0
  let withinLaSquares = 0

  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({ sessionNum, goalId, baselineSwings: mockSwings, random })

    const evs = []
    const las = []
    for (const w of swings) {
      const { exitSpeed: ev, angle: la } = w.hit.launch
      evs.push(ev)
      las.push(la)
      bump(evCounter, ev)
      bump(laCounter, la)
      bump(pitchHeightCounter, w.plateLocHeight)
      bump(pitchSideCounter, w.plateLocSide)

      const side = inStrikeZone(w) ? inZone : outZone
      side.n += 1
      side.ev += ev
      side.la += la

      if (!inStrikeZone(w)) {
        const { heightMiss, sideMiss, miss } = pitchMiss(w)
        bump(missCounter, miss)
        if (heightMiss > 0) bump(heightMissCounter, heightMiss)
        if (sideMiss > 0) bump(sideMissCounter, sideMiss)
        if (w.plateLocHeight < STRIKE_ZONE.heightMin) missAxes.low += 1
        if (w.plateLocHeight > STRIKE_ZONE.heightMax) missAxes.high += 1
        if (sideMiss > 0) missAxes.wide += 1
        if (heightMiss > 0 && sideMiss > 0) missAxes.bothAxes += 1
      }

      if (la > POP_UP_ANGLE) {
        popUps += 1
        if (w.plateLocHeight >= STRIKE_ZONE.heightMax) popUpsOnHighPitch += 1
      }
    }

    const meanEv = average(evs)
    const meanLa = average(las)
    withinEvSquares += evs.reduce((s, x) => s + (x - meanEv) ** 2, 0)
    withinLaSquares += las.reduce((s, x) => s + (x - meanLa) ** 2, 0)
    bump(sessionAvgEvCounter, Math.round(meanEv * 10) / 10)
    bump(topEvCounter, Math.max(...evs))

    const sessionSpray = sprayBreakdown(swings)
    spray.pull += sessionSpray.pull.count
    spray.middle += sessionSpray.middle.count
    spray.oppo += sessionSpray.oppo.count
    if (sessionSpray.pull.count >= 3 && sessionSpray.oppo.count >= 3) allFieldsBarMet += 1

    const buckets = distanceBucketCounts(swings)
    let emptyColumns = 0
    buckets.forEach(({ count }, idx) => {
      bucketTotals[idx] += count
      if (count === 0) {
        emptyColumns += 1
        bucketEmptySessions[idx] += 1
      }
    })
    emptyColumnTotal += emptyColumns
    if (emptyColumns > 0) sessionsWithAnEmptyColumn += 1

    if (hasTarget(goalId) && !swings.some((w) => meetsTarget(goalId, w.hit.launch))) emptyBand += 1
  }

  const swingsSeen = REPLAYS_PER_CELL * 15
  return {
    sessionNum,
    goalId,
    swingsSeen,
    inZone,
    outZone,
    missCounter,
    heightMissCounter,
    sideMissCounter,
    missAxes,
    pitchHeightCounter,
    pitchSideCounter,
    evCounter,
    laCounter,
    topEvCounter,
    sessionAvgEvCounter,
    // Two different things, and the difference is the point. The first is how
    // full a column is on a typical session, out of fifteen swings. The second
    // is how often that column renders with nothing in it at all, which is what
    // a visitor actually sees as a gap in the chart.
    bucketFillPerSession: bucketTotals.map((n) => (n / swingsSeen) * 15),
    bucketEmptyRates: bucketEmptySessions.map((n) => n / REPLAYS_PER_CELL),
    spray: {
      pull: spray.pull / REPLAYS_PER_CELL,
      middle: spray.middle / REPLAYS_PER_CELL,
      oppo: spray.oppo / REPLAYS_PER_CELL,
    },
    popUpsPerSession: popUps / REPLAYS_PER_CELL,
    popUps,
    popUpsOnHighPitch,
    allFieldsBarRate: allFieldsBarMet / REPLAYS_PER_CELL,
    emptyBandRate: hasTarget(goalId) ? emptyBand / REPLAYS_PER_CELL : null,
    emptyColumnsPerSession: emptyColumnTotal / REPLAYS_PER_CELL,
    anyEmptyColumnRate: sessionsWithAnEmptyColumn / REPLAYS_PER_CELL,
    evSpreadPopulation: Math.sqrt(withinEvSquares / (REPLAYS_PER_CELL * 15)),
    laSpreadPopulation: Math.sqrt(withinLaSquares / (REPLAYS_PER_CELL * 15)),
    evSpreadSample: Math.sqrt(withinEvSquares / (REPLAYS_PER_CELL * 14)),
    laSpreadSample: Math.sqrt(withinLaSquares / (REPLAYS_PER_CELL * 14)),
  }
}

const SLICE11_CELLS = []
for (const sessionNum of SESSIONS) {
  for (const goal of SLICE11_GOALS) {
    SLICE11_CELLS.push(measureSlice11Cell(sessionNum, goal.id))
  }
}

const cell = (sessionNum, goalId) =>
  SLICE11_CELLS.find((c) => c.sessionNum === sessionNum && c.goalId === goalId)
const cellsForSession = (sessionNum) => SLICE11_CELLS.filter((c) => c.sessionNum === sessionNum)

// Every launch angle and every exit velocity the generator produced, pooled.
// Built here rather than where they are first printed so the stale-copy check
// below can run before a single line of the report is written.
const allLaunchAngles = mergeCounters(SLICE11_CELLS.map((c) => c.laCounter))
const allExitVelocities = mergeCounters(SLICE11_CELLS.map((c) => c.evCounter))

// The stale-copy check the GENERATOR_CLAMPS comment promises. If a swing came
// out beyond a wall this script believes exists, the wall has moved, section 5
// is about to describe walls that are not there, and the safe thing is to stop
// rather than print a page of confident nonsense.
for (const [name, counter, clamp] of [
  ['launch angle', allLaunchAngles, GENERATOR_CLAMPS.launchAngle],
  ['exit velocity', allExitVelocities, GENERATOR_CLAMPS.exitVelocity],
]) {
  if (counterMin(counter) < clamp.min || counterMax(counter) > clamp.max) {
    console.error(
      `This script's copy of the ${name} limits (${clamp.min} to ${clamp.max}) is out of date: ` +
        `the generator produced ${counterMin(counter)} to ${counterMax(counter)}. ` +
        'Update GENERATOR_CLAMPS in this file before trusting anything it prints.'
    )
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Session 1, the fifteen hand-written swings every visitor sees first, measured
// the same way. It is the target shape for most of what follows: the generator
// derives every later session from it, so where the two disagree, session 1 is
// the hitter this app already claims to have.

const SESSION_ONE = (() => {
  const evs = mockSwings.map((w) => w.hit.launch.exitSpeed)
  const las = mockSwings.map((w) => w.hit.launch.angle)
  const inside = mockSwings.filter(inStrikeZone)
  const outside = mockSwings.filter((w) => !inStrikeZone(w))
  const spray = sprayBreakdown(mockSwings)
  return {
    avgEv: average(evs),
    topEv: Math.max(...evs),
    evSpread: populationSd(evs),
    laSpread: populationSd(las),
    inZoneShare: inside.length / mockSwings.length,
    zoneGapEv: average(inside.map((w) => w.hit.launch.exitSpeed)) - average(outside.map((w) => w.hit.launch.exitSpeed)),
    zoneGapLa: average(inside.map((w) => w.hit.launch.angle)) - average(outside.map((w) => w.hit.launch.angle)),
    misses: outside.map((w) => pitchMiss(w).miss).sort((a, b) => a - b),
    pitchHeights: mockSwings.map((w) => w.plateLocHeight),
    spray,
    popUps: las.filter((la) => la > POP_UP_ANGLE).length,
    allFieldsBarMet: spray.pull.count >= 3 && spray.oppo.count >= 3,
    buckets: distanceBucketCounts(mockSwings),
  }
})()

// ---------------------------------------------------------------------------
// The nine sections.

function banner(title) {
  console.log('')
  console.log('='.repeat(78))
  console.log(title)
  console.log('='.repeat(78))
}

function sessionRowLabel(sessionNum) {
  return `session ${sessionNum}`.padEnd(26)
}

// For a row that pools all five goals rather than describing one. The banner
// says 20,000 sessions per goal per session number, so a row labelled only
// "session 2" invites a reader to think 20,000 when the row is built on
// 100,000. Sections that pool say so on every row.
function pooledRowLabel(sessionNum) {
  return `session ${sessionNum}, all goals`.padEnd(26)
}

function signed(x) {
  return `${x >= 0 ? '+' : ''}${x.toFixed(2)}`
}

// A share that rounds to 0.00% next to a count that is not zero reads as a
// contradiction, so a nonzero count that small says so in words instead.
//
// EVERY share in section 5 goes through this, in the prose as well as in the
// table, INCLUDING the "one step inside" value. Two earlier drafts got that
// wrong in turn: the first applied it to the table only, so a paragraph
// rendered the same quantity as "0.00%" two lines under the table's "<0.01%";
// the second missed the inside value in both places, and printed "FEWER sit on
// it than on the value just inside it (0.00%)" where that inside value held
// 164 swings.
const shareCell = (share, count) => (count > 0 && share < 0.00005 ? '<0.01%' : pct2(share))

// How often a visitor would actually meet a swing at some value. A share is
// hard to feel; "about one swing in every twelve sessions" is not. Fifteen
// swings to a session.
//
// The bands exist because a bare `1 / (share * 15)` breaks at both ends. Above
// roughly 13% it rounds to "every 0 sessions", which it printed three times in
// one report; just under that it prints "every 1 sessions", which this repo
// already decided it does not say. The plural rule mirrors swingCountPhrase in
// src/promptText.js rather than inventing a third convention.
const sessionCountPhrase = (count) => `${count.toLocaleString()} session${count === 1 ? '' : 's'}`

function howOftenSeen(share) {
  const perSession = share * 15
  if (perSession <= 0) return 'never'
  if (perSession >= 1.5) return `about ${perSession.toFixed(1)} swings on every session`
  if (perSession >= 0.67) return 'about one swing on every session'
  return `about one swing in every ${sessionCountPhrase(Math.round(1 / perSession))}`
}

// The one threshold behind every "would anybody ever see this" judgment,
// written down as a number rather than left to an adjective. A value a visitor
// would meet less often than once in a hundred sessions is one nobody meets.
//
// THIS EXISTS BECAUSE THE ADJECTIVES WENT FALSE WHILE THE FACTS STAYED TRUE.
// The paragraphs in section 5 are generated from the counts, which keeps the
// numbers honest, but an earlier draft picked its adjectives from a wall's
// POSITION in a sorted list rather than from any measurement. Run against a
// generator whose walls sat elsewhere, it called a wall carrying 0.35% of every
// swing "far too rare to see on a chart", and told the reader that a wall
// carrying FEWER swings than the value inside it was proof that walls carry
// more. Both sentences were generated, and both were wrong. A generated
// sentence is only as honest as the test behind its adjective.
const MEETS_IT_ONCE_IN = 100
const appearsOnceIn = (share) => (share > 0 ? 1 / (share * 15) : Infinity)
const wouldBeMet = (share) => appearsOnceIn(share) <= MEETS_IT_ONCE_IN

console.log('='.repeat(78))
console.log('SWING GENERATOR MEASUREMENT: THE GENERATOR IN THE WORKING TREE')
console.log('')
console.log(`Generator: src/swingGenerator.js as it stands in the working tree right now,`)
console.log(`           fingerprint ${GENERATOR_FINGERPRINT}, ${GENERATOR_SOURCE.length.toLocaleString()} bytes.`)
console.log(`Seed:      ${SEED}. Rerun the same command and every number comes back the same.`)
console.log(`Sample:    ${REPLAYS_PER_CELL.toLocaleString()} replayed practice sessions per goal, per session number.`)
console.log('')
console.log('Comparing two saved runs. To see what a change to the generator did, hold')
console.log('the seed and compare two different fingerprints: the fingerprint is what')
console.log('names each side. To see how far a number wanders on sampling alone, hold')
console.log('the fingerprint and change the seed. Quote both stamps with any number')
console.log('taken from here, so a reader knows which of the two they are looking at.')
console.log('')
console.log('This half of the report is one section per defect Slice 11 sets out to fix,')
console.log('plus the numbers the slice must not break. The Slice 6 before-and-after')
console.log('tables follow it, under their own banner.')
console.log('='.repeat(78))

// --- 1. The zone gap -------------------------------------------------------

banner('1. DOES THE PITCH PREDICT THE CONTACT?')
console.log('A hitter swinging at a pitch outside the strike zone should not hit it as')
console.log('well as one down the middle. The number to watch is the gap: how much')
console.log('better a swing at a strike comes out than a swing at a ball.')
console.log('')
console.log('  ' + 'session'.padEnd(26) + 'exit velocity gap'.padStart(20) + 'launch angle gap'.padStart(20))
let widestEvGap = 0
let widestLaGap = 0
for (const sessionNum of SESSIONS) {
  const cells = cellsForSession(sessionNum)
  const zoneEv = cells.reduce((s, c) => s + c.inZone.ev, 0) / cells.reduce((s, c) => s + c.inZone.n, 0)
  const ballEv = cells.reduce((s, c) => s + c.outZone.ev, 0) / cells.reduce((s, c) => s + c.outZone.n, 0)
  const zoneLa = cells.reduce((s, c) => s + c.inZone.la, 0) / cells.reduce((s, c) => s + c.inZone.n, 0)
  const ballLa = cells.reduce((s, c) => s + c.outZone.la, 0) / cells.reduce((s, c) => s + c.outZone.n, 0)
  console.log(
    '  ' + pooledRowLabel(sessionNum) +
      `${signed(zoneEv - ballEv)} mph`.padStart(20) +
      `${signed(zoneLa - ballLa)} deg`.padStart(20)
  )
  for (const c of cells) {
    widestEvGap = Math.max(widestEvGap, Math.abs(c.inZone.ev / c.inZone.n - c.outZone.ev / c.outZone.n))
    widestLaGap = Math.max(widestLaGap, Math.abs(c.inZone.la / c.inZone.n - c.outZone.la / c.outZone.n))
  }
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    `${signed(SESSION_ONE.zoneGapEv)} mph`.padStart(20) +
    `${signed(SESSION_ONE.zoneGapLa)} deg`.padStart(20)
)
console.log('')
console.log(`  Each row above pools all five goals, ${(REPLAYS_PER_CELL * SLICE11_GOALS.length).toLocaleString()} sessions. Taken one goal at a`)
console.log(`  time, across all ${SLICE11_CELLS.length} goal-and-session combinations, the largest gap either way`)
console.log(`  was ${widestEvGap.toFixed(2)} mph and ${widestLaGap.toFixed(2)} degrees, so the pooled rows are not hiding a goal`)
console.log('  where the link exists.')
console.log('')
// The threshold below which a gap is nothing rather than something. A tenth of
// a mile an hour is under the rounding the app shows anywhere, so a gap that
// small cannot reach a visitor even in principle.
const A_REAL_GAP_MPH = 0.1
const pooledGap = SLICE11_CELLS.reduce((sum, c) => sum + c.inZone.ev, 0) / SLICE11_CELLS.reduce((sum, c) => sum + c.inZone.n, 0) -
  SLICE11_CELLS.reduce((sum, c) => sum + c.outZone.ev, 0) / SLICE11_CELLS.reduce((sum, c) => sum + c.outZone.n, 0)
if (Math.abs(pooledGap) < A_REAL_GAP_MPH) {
  console.log('  There is no link here at all. The pitch and the swing are drawn without')
  console.log('  reference to each other, so a swing at a ball off the plate comes out just')
  console.log('  as well struck as a swing down the middle.')
} else {
  console.log(`  The pitch does predict the contact, by ${signed(pooledGap)} mph. A swing at a strike`)
  console.log('  comes out better struck than a swing at a ball, which is how a real hitter')
  console.log('  behaves.')
}
console.log('')
console.log('  This matters beyond realism. Since Slice 8c the coach is handed which pitches')
console.log('  were outside the zone and reasons about them out loud, so whatever this gap')
console.log('  is, that reasoning is either grounded in it or is a coincidence.')

// --- 2. Miss geometry ------------------------------------------------------

banner('2. WHEN THE PITCH MISSES, HOW BADLY DOES IT MISS?')
const allMisses = mergeCounters(SLICE11_CELLS.map((c) => c.missCounter))
const allHeights = mergeCounters(SLICE11_CELLS.map((c) => c.pitchHeightCounter))
const allSides = mergeCounters(SLICE11_CELLS.map((c) => c.pitchSideCounter))
const allHeightMisses = mergeCounters(SLICE11_CELLS.map((c) => c.heightMissCounter))
const allSideMisses = mergeCounters(SLICE11_CELLS.map((c) => c.sideMissCounter))
const missTotal = counterTotal(allMisses)
const swingsTotal = SLICE11_CELLS.reduce((s, c) => s + c.swingsSeen, 0)
const axes = SLICE11_CELLS.reduce(
  (s, c) => ({
    low: s.low + c.missAxes.low,
    high: s.high + c.missAxes.high,
    wide: s.wide + c.missAxes.wide,
    bothAxes: s.bothAxes + c.missAxes.bothAxes,
  }),
  { low: 0, high: 0, wide: 0, bothAxes: 0 }
)
console.log(`  Pitches inside the strike zone: ${pct(1 - missTotal / swingsTotal)} of every swing generated.`)
console.log(`  Session 1's own answer: ${pct(SESSION_ONE.inZoneShare)}.`)
console.log('')
console.log('  How far outside the zone a missed pitch was, in feet (the worse of its two')
console.log('  axes, which is how a person watching would describe it):')
console.log(
  `    closest ${counterMin(allMisses).toFixed(2)}  |  10th pct ${counterPercentile(allMisses, 10).toFixed(2)}` +
    `  |  25th pct ${counterPercentile(allMisses, 25).toFixed(2)}  |  middle ${counterPercentile(allMisses, 50).toFixed(2)}` +
    `  |  75th pct ${counterPercentile(allMisses, 75).toFixed(2)}  |  90th pct ${counterPercentile(allMisses, 90).toFixed(2)}` +
    `  |  worst ${counterMax(allMisses).toFixed(2)}`
)
console.log(`    average ${counterMean(allMisses).toFixed(2)} feet`)
console.log('')
console.log('  Session 1\'s own six missed pitches, the shape this is aiming at:')
console.log(`    ${SESSION_ONE.misses.map((m) => m.toFixed(2)).join(', ')}   (average ${average(SESSION_ONE.misses).toFixed(2)} feet)`)
console.log('')
console.log('  Highest and lowest a pitch was thrown, in feet off the ground:')
console.log(
  `    generated: ${counterMin(allHeights).toFixed(2)} to ${counterMax(allHeights).toFixed(2)}` +
    `   |   session 1: ${Math.min(...SESSION_ONE.pitchHeights).toFixed(2)} to ${Math.max(...SESSION_ONE.pitchHeights).toFixed(2)}` +
    `   |   the zone is ${STRIKE_ZONE.heightMin} to ${STRIKE_ZONE.heightMax}`
)
console.log(
  `    sideways: ${counterMin(allSides).toFixed(2)} to ${counterMax(allSides).toFixed(2)}` +
    `   |   the zone is ${STRIKE_ZONE.sideMin} to ${STRIKE_ZONE.sideMax}`
)
console.log('')
console.log('  Which way a missed pitch was off, as a share of missed pitches:')
console.log(
  `    low ${pct(axes.low / missTotal)}  |  high ${pct(axes.high / missTotal)}  |  wide ${pct(axes.wide / missTotal)}` +
    `  |  off on BOTH height and side at once ${pct(axes.bothAxes / missTotal)}`
)
console.log(
  `    height misses average ${counterMean(allHeightMisses).toFixed(2)} feet, side misses average ${counterMean(allSideMisses).toFixed(2)} feet`
)
console.log('')
const worstSessionOneMiss = SESSION_ONE.misses[SESSION_ONE.misses.length - 1]
const generatedMissMean = counterMean(allMisses)
const sessionOneMissMean = average(SESSION_ONE.misses)
const bothAxesShare = axes.bothAxes / missTotal
const lowestPitch = counterMin(allHeights)
// A pitch below this has hit the ground before it reaches the plate. Set just
// under the floor Slice 11's own plan calls acceptable, a miss topping out at
// 0.80 feet outside a zone starting at 1.5, which puts the lowest allowable
// pitch at 0.70. Session 1's own lowest is 0.80. So this fires on today's 0.50
// and stays quiet on anything the plan would accept, rather than calling
// session-1-like pitches bounces.
const BOUNCES_BELOW_FEET = 0.7
const missesAreWild = generatedMissMean > sessionOneMissMean * 1.25

console.log('  Two things to read off that. The first is how far out a typical miss is:')
console.log(
  `  ${generatedMissMean.toFixed(2)} feet on average against session 1's ${sessionOneMissMean.toFixed(2)}, and ` +
    `${pct(counterShare(allMisses, (v) => v > worstSessionOneMiss))} of them further out`
)
console.log(
  `  than session 1's worst miss of ${worstSessionOneMiss.toFixed(2)}. ` +
    (missesAreWild ? 'The generated thrower misses by a good' : 'That is close to the shape')
)
console.log(missesAreWild ? '  deal more than the session this demo is calibrated against.' : '  session 1 sets.')
console.log(`  The closest miss anywhere is ${counterMin(allMisses).toFixed(2)} feet, so near misses do happen.`)
if (lowestPitch < BOUNCES_BELOW_FEET) {
  console.log(`  The worst do not: the lowest pitch thrown is ${lowestPitch.toFixed(2)} feet off the ground,`)
  console.log(`  below session 1's own lowest of ${Math.min(...SESSION_ONE.pitchHeights).toFixed(2)}, and low enough to bounce in front of`)
  console.log('  the plate.')
}
console.log('')
if (bothAxesShare > 0.99) {
  console.log('  The second is that every single missed pitch is off on both axes at once:')
  console.log('  there is no such thing here as a pitch that is simply low, because a low')
  console.log('  pitch is always wide as well. No real thrower misses that way.')
} else {
  console.log(`  The second is that ${pct(1 - bothAxesShare)} of missed pitches are off on ONE axis only,`)
  console.log(`  with just ${pct(bothAxesShare)} off on both height and side at once. A pitch that misses`)
  console.log('  low while staying plausible sideways is what a real thrower produces.')
}

// --- 3. Spray --------------------------------------------------------------

banner('3. WHERE THE BALLS WENT: PULL, UP THE MIDDLE, OPPOSITE FIELD')
console.log(`  Counted with sprayBreakdown from src/sessionStats.js, so these are the same`)
console.log(`  three groups the coach is handed and the same cutoffs the spray chart draws.`)
console.log('  Average number of the fifteen swings in each group.')
console.log('')
console.log('  ' + 'session'.padEnd(26) + 'pull'.padStart(12) + 'up the middle'.padStart(16) + 'opposite'.padStart(12))
for (const sessionNum of SESSIONS) {
  const cells = cellsForSession(sessionNum)
  const mean = (key) => average(cells.map((c) => c.spray[key]))
  console.log(
    '  ' + pooledRowLabel(sessionNum) +
      mean('pull').toFixed(2).padStart(12) +
      mean('middle').toFixed(2).padStart(16) +
      mean('oppo').toFixed(2).padStart(12)
  )
}
console.log(
  '  ' + 'sessions 2 to 4 mean'.padEnd(26) +
    average(SLICE11_CELLS.map((c) => c.spray.pull)).toFixed(2).padStart(12) +
    average(SLICE11_CELLS.map((c) => c.spray.middle)).toFixed(2).padStart(16) +
    average(SLICE11_CELLS.map((c) => c.spray.oppo)).toFixed(2).padStart(12)
)
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    String(SESSION_ONE.spray.pull.count).padStart(12) +
    String(SESSION_ONE.spray.middle.count).padStart(16) +
    String(SESSION_ONE.spray.oppo.count).padStart(12)
)
console.log('')
const meanPull = average(SLICE11_CELLS.map((c) => c.spray.pull))
const meanOppo = average(SLICE11_CELLS.map((c) => c.spray.oppo))
const middleBySession = SESSIONS.map((n) => average(cellsForSession(n).map((c) => c.spray.middle)))
const narrowsEverySession = middleBySession.every((m, i) => i === 0 || m > middleBySession[i - 1])
if (meanOppo > meanPull) {
  console.log(`  The generated hitter goes the other way more often than he pulls, ${meanOppo.toFixed(2)} swings`)
  console.log(`  against ${meanPull.toFixed(2)}, which is backwards for a high school hitter.`)
} else {
  console.log(`  The generated hitter pulls more than he goes the other way, ${meanPull.toFixed(2)} swings`)
  console.log(`  against ${meanOppo.toFixed(2)}, which is the right way round for a high school hitter.`)
}
if (narrowsEverySession) {
  console.log(`  The spread also narrows toward the middle every session, ${middleBySession[0].toFixed(2)} swings up the`)
  console.log(`  middle rising to ${middleBySession[middleBySession.length - 1].toFixed(2)}, because spray direction is multiplied by the same`)
  console.log('  shrinking variance factor that tightens everything else.')
} else {
  console.log(`  It does not narrow session by session: ${middleBySession.map((m) => m.toFixed(2)).join(', ')} swings up the middle`)
  console.log('  across sessions 2, 3 and 4, so spray is no longer riding the shrinking')
  console.log('  variance factor.')
}

// --- 4. Pop-ups ------------------------------------------------------------

banner('4. POP-UPS')
console.log(`  A pop-up is a launch angle above ${POP_UP_ANGLE} degrees, which is the number the`)
console.log('  Reduce Pop-Ups goal names in its own coaching prose (GOAL_COUNT_SPECS).')
console.log('  Average pop-ups per fifteen-swing session:')
console.log('')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(10)).join(''))
for (const goal of SLICE11_GOALS) {
  console.log(
    '  ' + goal.label.padEnd(26) +
      SESSIONS.map((s) => cell(s, goal.id).popUpsPerSession.toFixed(2).padStart(10)).join('')
  )
}
console.log('  ' + 'session 1 (hand-written)'.padEnd(26) + String(SESSION_ONE.popUps).padStart(10))
const totalPopUps = SLICE11_CELLS.reduce((s, c) => s + c.popUps, 0)
const totalPopUpsHigh = SLICE11_CELLS.reduce((s, c) => s + c.popUpsOnHighPitch, 0)
console.log('')
console.log(`  Pop-ups seen in all ${swingsTotal.toLocaleString()} generated swings: ${totalPopUps.toLocaleString()}.`)
console.log(
  totalPopUps === 0
    ? '  None, so there is no share on high pitches to report.'
    : `  On pitches at or above the top of the zone: ${pct(totalPopUpsHigh / totalPopUps)}.`
)
console.log(`  The highest launch angle the generator produced at all: ${counterMax(allLaunchAngles)} degrees.`)
console.log('')
if (totalPopUps === 0) {
  console.log('  The goal names a failure that cannot happen. The highest launch angle this')
  console.log(`  generator will produce is ${counterMax(allLaunchAngles)} degrees and a pop-up needs more than ${POP_UP_ANGLE},`)
  console.log('  so the coach is handed a count of zero pop-ups on every session forever,')
  console.log('  and says so.')
} else {
  const popUpGoals = SLICE11_GOALS
    .map((goal) => ({ goal, rate: average(SESSIONS.map((s) => cell(s, goal.id).popUpsPerSession)) }))
    .filter((g) => g.rate > 0)
    .sort((a, b) => b.rate - a.rate)
  const perSession = totalPopUps / (REPLAYS_PER_CELL * SLICE11_GOALS.length * SESSIONS.length)
  const highShare = totalPopUpsHigh / totalPopUps
  console.log('  Pop-ups happen, so the goal now names a failure the hitter can actually')
  console.log(`  commit: ${perSession.toFixed(2)} per session averaged across every goal, and a count the coach`)
  console.log('  can coach against rather than a permanent zero.')
  console.log(`  They come mostly on ${popUpGoals[0].goal.label}, at ${popUpGoals[0].rate.toFixed(2)} per session.`)
  if (highShare > 0.5) {
    console.log(`  ${pct(highShare)} of them are on pitches at or above the top of the zone, which is the`)
    console.log('  mechanism this was bought for: a hitter getting under a high pitch.')
  } else {
    console.log(`  Only ${pct(highShare)} of them are on pitches at or above the top of the zone, which`)
    console.log('  is NOT the mechanism this was bought for, so the constants are wrong.')
  }
}

// --- 5. Ceiling pile-ups ---------------------------------------------------

banner('5. SWINGS STACKED AGAINST A CEILING')
const laCeiling = counterMax(allLaunchAngles)
console.log('  A generator that refuses to let a swing past a limit has to put it somewhere,')
console.log('  and the usual somewhere is exactly on the limit. That shows up on screen as a')
console.log('  flat row of dots along the edge of a chart. This section asks whether this')
console.log('  generator does that, where, and how much of it a visitor would see.')
console.log('')
console.log(`  Share of swings sitting exactly on the highest launch angle the generator`)
console.log(`  produced, ${laCeiling} degrees:`)
console.log('')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(10)).join('') + 'S2 to S4'.padStart(12))
for (const goal of SLICE11_GOALS) {
  const merged = mergeCounters(SESSIONS.map((s) => cell(s, goal.id).laCounter))
  const cellShare = (c) => {
    const share = counterShare(c.laCounter, (v) => v === laCeiling)
    return shareCell(share, Math.round(share * counterTotal(c.laCounter)))
  }
  const mergedShare = counterShare(merged, (v) => v === laCeiling)
  console.log(
    '  ' + goal.label.padEnd(26) +
      SESSIONS.map((s) => cellShare(cell(s, goal.id)).padStart(10)).join('') +
      shareCell(mergedShare, Math.round(mergedShare * counterTotal(merged))).padStart(12)
  )
}
const pooledCeilingShare = counterShare(allLaunchAngles, (v) => v === laCeiling)
console.log('  ' + 'every goal pooled'.padEnd(26) + ''.padStart(30) +
  shareCell(pooledCeilingShare, Math.round(pooledCeilingShare * counterTotal(allLaunchAngles))).padStart(12))
console.log('')
// Derived, because the hand-written version of this paragraph went false in
// four of five mutated generator states, including the one Task 6 is written
// to produce. Note WHY the earlier disclosure list could not have caught it:
// its lead clause, "Only Power reaches it in any quantity", carries no number
// at all, and the list's criterion was hand-typed NUMBERS. An interpretive
// sentence with no number in it is just as capable of being false.
const ceilingByGoal = SLICE11_GOALS.map((goal) => {
  const merged = mergeCounters(SESSIONS.map((s) => cell(s, goal.id).laCounter))
  const share = counterShare(merged, (v) => v === laCeiling)
  return { goal, share, onIt: Math.round(share * counterTotal(merged)) }
}).sort((a, b) => b.share - a.share)
const ceilingMet = ceilingByGoal.filter((g) => g.share > 0 && appearsOnceIn(g.share) <= MEETS_IT_ONCE_IN)
const ceilingRare = ceilingByGoal.filter((g) => g.share > 0 && appearsOnceIn(g.share) > MEETS_IT_ONCE_IN)
const ceilingNever = ceilingByGoal.filter((g) => g.share === 0)

if (ceilingMet.length === 0) {
  console.log(`  No goal reaches ${laCeiling} degrees often enough for a visitor to meet one.`)
} else {
  console.log(
    `  ${ceilingMet.length === 1 ? 'One goal reaches' : `${ceilingMet.length} goals reach`} it often enough for a visitor to meet: ` +
      ceilingMet.map((g) => `${g.goal.label} at ${shareCell(g.share, g.onIt)}`).join(', ') + '.'
  )
  // The mechanism sentence is printed only when the data still points at the
  // goal it describes, and only while that goal's share really does climb
  // session by session, which is the claim the sentence makes.
  const top = ceilingMet[0]
  if (top.goal.id === 'power') {
    const bySession = SESSIONS.map((s) => counterShare(cell(s, 'power').laCounter, (v) => v === laCeiling))
    const climbs = bySession.every((share, i) => i === 0 || share > bySession[i - 1])
    console.log(
      `  Power is the one goal whose hitter is lifted toward the ceiling${climbs ? ' session by' : ','}`
    )
    console.log(climbs ? '  session, which is why it is the goal that meets it.' : '  which is why it is the goal that meets it.')
  }
}
if (ceilingRare.length === 1) {
  const only = ceilingRare[0]
  console.log(
    `  ${only.goal.label} touches it and no more, at ${shareCell(only.share, only.onIt)} of its swings, ` +
      `${howOftenSeen(only.share)}.`
  )
} else if (ceilingRare.length > 1) {
  const lowest = ceilingRare[ceilingRare.length - 1]
  const highest = ceilingRare[0]
  console.log(
    `  ${ceilingRare.length} goals touch it and no more: ${shareCell(lowest.share, lowest.onIt)} to ` +
      `${shareCell(highest.share, highest.onIt)} of swings, which nobody meets.`
  )
}
if (ceilingNever.length > 0) {
  console.log(
    `  ${ceilingNever.length === 1 ? 'One goal never reaches' : `${ceilingNever.length} goals never reach`} it at all: ` +
      ceilingNever.map((g) => g.goal.label).join(', ') + '.'
  )
}
console.log('')
console.log('  The generator has four of these walls, not one. Every swing is squeezed')
console.log(`  into a launch angle of ${GENERATOR_CLAMPS.launchAngle.min} to ${GENERATOR_CLAMPS.launchAngle.max} degrees and an exit velocity of ${GENERATOR_CLAMPS.exitVelocity.min} to`)
console.log(`  ${GENERATOR_CLAMPS.exitVelocity.max} mph. Here is how many swings each of the four is actually holding.`)
console.log('')
console.log(
  '  ' + 'the wall'.padEnd(34) + 'swings on it'.padStart(16) + 'share'.padStart(10) + 'one step inside'.padStart(18)
)

// Built as data first and described afterwards, so the sentences under the
// table are generated from the same counts the table prints and cannot come to
// disagree with it. An earlier draft of this section asserted in prose that
// three of these four walls were untouched; the table beneath it showed the
// exit velocity ceiling holding fourteen swings.
const walls = [
  ['launch angle ceiling', 'degrees', allLaunchAngles, GENERATOR_CLAMPS.launchAngle.max, -1],
  ['launch angle floor', 'degrees', allLaunchAngles, GENERATOR_CLAMPS.launchAngle.min, +1],
  ['exit velocity ceiling', 'mph', allExitVelocities, GENERATOR_CLAMPS.exitVelocity.max, -1],
  ['exit velocity floor', 'mph', allExitVelocities, GENERATOR_CLAMPS.exitVelocity.min, +1],
].map(([name, unit, counter, wall, step]) => ({
  name,
  unit,
  where: `${wall} ${unit === 'degrees' ? 'deg' : unit}`,
  // A floor holds back what would have gone BELOW it and a ceiling what would
  // have gone ABOVE it. Carried per wall because the prose beneath used to be
  // written in the ceiling's voice and was then applied to floors as well,
  // producing "the exit velocity floor of 78 mph is holding swings back:
  // everything that would have gone past 78 mph is parked on it instead."
  beyond: step < 0 ? 'above' : 'below',
  onIt: Math.round(counterShare(counter, (v) => v === wall) * counterTotal(counter)),
  share: counterShare(counter, (v) => v === wall),
  insideOnIt: Math.round(counterShare(counter, (v) => v === wall + step) * counterTotal(counter)),
  insideShare: counterShare(counter, (v) => v === wall + step),
  nearest: step < 0 ? counterMax(counter) : counterMin(counter),
}))

for (const w of walls) {
  console.log(
    '  ' + `${w.name}, ${w.where}`.padEnd(34) +
      w.onIt.toLocaleString().padStart(16) +
      shareCell(w.share, w.onIt).padStart(10) +
      shareCell(w.insideShare, w.insideOnIt).padStart(18)
  )
}

// Three groups, decided by measurement rather than by rank. A wall either
// holds nothing, or holds MORE than the value just inside it (which is what a
// wall does: it is catching a tail that wanted to go further), or holds fewer
// (which is just an ordinary tail that happens to stop there).
const untouchedWalls = walls.filter((w) => w.onIt === 0)
const stackingWalls = walls.filter((w) => w.onIt > 0 && w.share > w.insideShare).sort((a, b) => b.share - a.share)
const grazedWalls = walls.filter((w) => w.onIt > 0 && w.share <= w.insideShare).sort((a, b) => b.share - a.share)


if (untouchedWalls.length === walls.length) {
  // The state Slice 11 is trying to reach, so it is reported as the result it
  // is rather than as a table that failed to appear.
  console.log('')
  console.log(`  NOT ONE of the ${walls.length} is holding anything. Across ${swingsTotal.toLocaleString()} generated swings no swing`)
  console.log('  came out sitting exactly on a limit, so nothing is stacked and no chart')
  console.log('  carries a flat row of dots against an edge. The nearest this hitter came')
  console.log('  to each:')
  for (const w of untouchedWalls) {
    console.log(`    the ${w.name} of ${w.where}, closest approach ${w.nearest} ${w.unit}`)
  }
  console.log('  That is the result this section exists to check for, not a missing table.')
} else if (untouchedWalls.length > 0) {
  console.log('')
  console.log(`  ${untouchedWalls.length} of the ${walls.length} hold nothing whatsoever. Across ${swingsTotal.toLocaleString()} generated swings not one`)
  console.log('  landed on:')
  for (const w of untouchedWalls) {
    console.log(`    the ${w.name} of ${w.where}, the closest being ${w.nearest} ${w.unit}`)
  }
  console.log('  Those walls are set outside this hitter and are doing nothing at all.')
}

for (const w of grazedWalls) {
  console.log('')
  console.log(`  The ${w.name} of ${w.where} holds ${swingCountPhrase(w.onIt)}, ${shareCell(w.share, w.onIt)} of them.`)
  console.log(`  FEWER sit on it than on the value just inside it (${shareCell(w.insideShare, w.insideOnIt)}), so it is`)
  console.log('  being reached rather than stacked against: an ordinary tail that happens to')
  console.log('  stop there. Not zero, though, and this report will not round it to zero.')
  console.log(
    `  A visitor would see one ${howOftenSeen(w.share)}, ` +
      (wouldBeMet(w.share) ? 'which is often enough to meet.' : 'which is never, in practice.')
  )
}

for (const w of stackingWalls) {
  console.log('')
  console.log(`  The ${w.name} of ${w.where} is holding swings back, which is what a`)
  console.log(`  wall does. Everything that would have gone ${w.beyond} ${w.where} is parked on it`)
  console.log(`  instead, so that one value carries ${shareCell(w.share, w.onIt)} of every swing against`)
  console.log(`  ${shareCell(w.insideShare, w.insideOnIt)} on the value just inside it. More on the edge than beside it is`)
  console.log('  the signature; an ordinary tail thins out instead.')
  console.log(
    `  A visitor would see one ${howOftenSeen(w.share)}, ` +
      (wouldBeMet(w.share) ? 'which is often enough to meet.' : 'which is never, in practice.')
  )
}

// Where the top of the launch angle range bites hardest. Both the goal and the
// session number are found from the data, because "hardest" is a superlative
// and a typed superlative is a sentence waiting to go false.
//
// THIS PARAGRAPH IS NEVER SKIPPED, and that is the fix for the way it used to
// disappear. It was previously printed only when the hand-copied CLAMP was
// stacking, while the table it describes is keyed to the MEASURED maximum.
// Those two agree only while the generator uses a hard clamp, which is exactly
// what Task 6 removes: under soft compression the table showed a real pile-up
// on the measured ceiling and this paragraph, keyed to the copy, said nothing
// at all. It now reports whatever the table above it found, and reads the
// stacking question off the same measured value.
const worstCeilingCell = SLICE11_CELLS
  .map((c) => ({ c, share: counterShare(c.laCounter, (v) => v === laCeiling) }))
  .sort((a, b) => b.share - a.share)[0]
const worstCeilingLabel = SLICE11_GOALS.find((g) => g.id === worstCeilingCell.c.goalId).label
const worstCeilingInside = counterShare(worstCeilingCell.c.laCounter, (v) => v === laCeiling - 1)
const measuredCeilingStacks = counterShare(allLaunchAngles, (v) => v === laCeiling) >
  counterShare(allLaunchAngles, (v) => v === laCeiling - 1)
console.log('')
if (worstCeilingCell.share === 0) {
  console.log(`  Not one session anywhere put a swing on ${laCeiling} degrees itself, the very top`)
  console.log(`  value the generator reached, against ${pct2(counterShare(allLaunchAngles, (v) => v === laCeiling - 1))} of swings on ${laCeiling - 1}.`)
} else {
  console.log(
    `  It shows up most on ${worstCeilingLabel} session ${worstCeilingCell.c.sessionNum}: ` +
      `${shareCell(worstCeilingCell.share, Math.round(worstCeilingCell.share * counterTotal(worstCeilingCell.c.laCounter)))} of swings sit`
  )
  console.log(`  exactly on ${laCeiling}, against ${pct2(worstCeilingInside)} on ${laCeiling - 1}.`)
}
if (measuredCeilingStacks) {
  console.log('  More swings on the last value than on the one below it: that is the flat row')
  console.log('  of dots, on a chart every visitor who picks that goal can see.')
} else {
  console.log('  Fewer swings on the last value than on the one below it, so the distribution')
  console.log('  thins out into its own top end rather than piling against it. No flat row.')
}

// --- 6. Top exit velocity --------------------------------------------------

banner('6. THE HARDEST SWING OF A SESSION')
console.log(`  Session 1 has this hitter's best ball at ${SESSION_ONE.topEv} mph, and that number is`)
console.log('  frozen. A generated session that beats it is claiming he got faster.')
console.log('')
console.log(
  '  ' + 'session'.padEnd(26) + 'lowest'.padStart(9) + '10th'.padStart(9) + 'median'.padStart(9) +
    '90th'.padStart(9) + 'highest'.padStart(9) + `over ${SESSION_ONE.topEv}`.padStart(12)
)
for (const sessionNum of SESSIONS) {
  const merged = mergeCounters(cellsForSession(sessionNum).map((c) => c.topEvCounter))
  console.log(
    '  ' + pooledRowLabel(sessionNum) +
      String(counterMin(merged)).padStart(9) +
      counterPercentile(merged, 10).toFixed(0).padStart(9) +
      counterPercentile(merged, 50).toFixed(0).padStart(9) +
      counterPercentile(merged, 90).toFixed(0).padStart(9) +
      String(counterMax(merged)).padStart(9) +
      pct(counterShare(merged, (v) => v > SESSION_ONE.topEv)).padStart(12)
  )
}
const allTopEvs = mergeCounters(SLICE11_CELLS.map((c) => c.topEvCounter))
console.log(
  '  ' + 'sessions 2 to 4 pooled'.padEnd(26) +
    String(counterMin(allTopEvs)).padStart(9) +
    counterPercentile(allTopEvs, 10).toFixed(0).padStart(9) +
    counterPercentile(allTopEvs, 50).toFixed(0).padStart(9) +
    counterPercentile(allTopEvs, 90).toFixed(0).padStart(9) +
    String(counterMax(allTopEvs)).padStart(9) +
    pct(counterShare(allTopEvs, (v) => v > SESSION_ONE.topEv)).padStart(12)
)

// --- 7. The step off session 1 ---------------------------------------------

banner('7. HOW MUCH BETTER THE NEXT SESSION IS')
console.log(`  A session's average exit velocity against session 1's ${SESSION_ONE_AVG_EV.toFixed(1)} mph. Every`)
console.log('  generated session is built off session 1, not off the session before it, so')
console.log('  this is the same step every time rather than a run of improvement.')
console.log('')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(10)).join(''))
for (const goal of SLICE11_GOALS) {
  console.log(
    '  ' + goal.label.padEnd(26) +
      SESSIONS.map((s) => signed(counterMean(cell(s, goal.id).sessionAvgEvCounter) - SESSION_ONE_AVG_EV).padStart(10)).join('')
  )
}
const allSessionAvgEvs = mergeCounters(SLICE11_CELLS.map((c) => c.sessionAvgEvCounter))
console.log('  ' + 'all goals pooled'.padEnd(26) +
  SESSIONS.map((s) => signed(counterMean(mergeCounters(cellsForSession(s).map((c) => c.sessionAvgEvCounter))) - SESSION_ONE_AVG_EV).padStart(10)).join(''))
console.log('')
console.log('  The whole distribution of that step, every goal and session pooled:')
console.log(
  `    worst ${signed(counterMin(allSessionAvgEvs) - SESSION_ONE_AVG_EV)}  |  10th pct ${signed(counterPercentile(allSessionAvgEvs, 10) - SESSION_ONE_AVG_EV)}` +
    `  |  median ${signed(counterPercentile(allSessionAvgEvs, 50) - SESSION_ONE_AVG_EV)}` +
    `  |  90th pct ${signed(counterPercentile(allSessionAvgEvs, 90) - SESSION_ONE_AVG_EV)}  |  best ${signed(counterMax(allSessionAvgEvs) - SESSION_ONE_AVG_EV)}`
)
console.log(`    mean ${signed(counterMean(allSessionAvgEvs) - SESSION_ONE_AVG_EV)} mph, and ${pct(counterShare(allSessionAvgEvs, (v) => v < SESSION_ONE_AVG_EV))} of sessions came out below session 1`)
console.log('')
// Which goals are lifted, and by what, both read off the data. A goal is
// "lifted" when its step sits clearly above the goals that are never re-rolled,
// and the explanation only prints if the lifted set really is the set whose
// band comes up empty. An earlier version asserted "two goals" and "the other
// three all land near +0.93" outright, and was wrong about which goals as soon
// as an empty-band rate moved.
const stepByGoal = SLICE11_GOALS.map((goal) => ({
  goal,
  step: average(SESSIONS.map((s) => counterMean(cell(s, goal.id).sessionAvgEvCounter) - SESSION_ONE_AVG_EV)),
  emptyBand: average(SESSIONS.map((s) => cell(s, goal.id).emptyBandRate ?? 0)),
}))
// A band that comes up empty this rarely gives the re-roll almost nothing to
// fire on, so the goal behaves like one with no band at all.
const RE_ROLL_BITES_ABOVE = 0.005
const reRolled = stepByGoal.filter((g) => g.emptyBand > RE_ROLL_BITES_ABOVE).sort((a, b) => b.step - a.step)
const notReRolled = stepByGoal.filter((g) => g.emptyBand <= RE_ROLL_BITES_ABOVE).sort((a, b) => b.step - a.step)

console.log('  Read the goal column, not just the pooled row.')
if (reRolled.length > 0 && notReRolled.length > 0) {
  const lowestReRolled = reRolled[reRolled.length - 1].step
  const highestPlain = notReRolled[0].step
  const plainSteps = notReRolled.map((g) => g.step)
  const plainSpread = Math.max(...plainSteps) - Math.min(...plainSteps)
  console.log(
    `  ${reRolled.length === 1 ? 'One goal has' : `${reRolled.length} goals have`} a target band that comes up empty often enough for the` +
      ''
  )
  console.log(`  re-roll to fire: ${reRolled.map((g) => g.goal.label).join(', ')}.`)
  console.log(`  ${reRolled.length === 1 ? 'It steps' : 'They step'} ${reRolled.map((g) => signed(g.step)).join(' and ')} mph off session 1.`)
  console.log('')
  console.log(
    `  The other ${notReRolled.length} step ${plainSpread < 0.1 ? `${signed(average(plainSteps))} between them` : `${signed(Math.min(...plainSteps))} to ${signed(Math.max(...plainSteps))}`}, and that is the step the dice really`
  )
  console.log('  produce. A session that would draw an empty band is thrown away and rolled')
  console.log('  again, and the sessions thrown away are the weak ones, so the survivors')
  console.log('  average higher.')
  if (lowestReRolled > highestPlain) {
    // Which goals have a band that never comes up empty is read off the data,
    // not named here. It is Reduce Pop-Ups today and that is not guaranteed.
    const bandButNeverEmpty = notReRolled.filter((g) => cell(SESSIONS[0], g.goal.id).emptyBandRate !== null)
    console.log('  Having a target band is not what lifts the number; having an empty one')
    console.log('  sometimes is.')
    if (bandButNeverEmpty.length > 0) {
      console.log(
        `  ${bandButNeverEmpty.map((g) => g.goal.label).join(' and ')} ` +
          `${bandButNeverEmpty.length === 1 ? 'has a band' : 'have bands'} that never comes up empty,`
      )
      console.log('  and sits with the goals that have no band at all.')
    }
  }
} else {
  console.log(`  Every goal steps between ${signed(Math.min(...stepByGoal.map((g) => g.step)))} and ${signed(Math.max(...stepByGoal.map((g) => g.step)))} mph off session 1, so the`)
  console.log('  empty-band re-roll is not separating them.')
}

// --- 8. Hit to All Fields against its own bar ------------------------------

// THE BAR ITSELF IS A HAND-COPY, and this is the disclosure. "At least 3
// swings pull side, at least 3 swings opposite field" is a sentence inside the
// Hit to All Fields goal context in src/coachApi.js, not a constant anywhere.
// The two CUTOFFS that decide what counts as pull or opposite are imported
// (SPRAY_CUTOFFS, through sprayBreakdown), so those cannot drift. The two
// counts of 3 are typed here. If that sentence is ever reworded to ask for
// four, this section goes on measuring the old bar and says nothing.
banner('8. HIT TO ALL FIELDS, AGAINST THE BAR THAT GOAL SETS ITSELF')
console.log('  That goal asks the player for at least 3 pull side and at least 3 opposite')
console.log('  field, in the coaching instructions the model is handed. Share of sessions')
console.log('  that actually deliver it, on the Hit to All Fields goal a visitor would')
console.log('  have picked:')
console.log('')
console.log('  ' + 'session'.padEnd(26) + 'on that goal'.padStart(20) + 'every goal pooled'.padStart(22))
for (const sessionNum of SESSIONS) {
  console.log(
    '  ' + sessionRowLabel(sessionNum) +
      pct(cell(sessionNum, 'allfields').allFieldsBarRate).padStart(20) +
      pct(average(cellsForSession(sessionNum).map((c) => c.allFieldsBarRate))).padStart(22)
  )
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    (SESSION_ONE.allFieldsBarMet ? 'yes' : 'no').padStart(20) +
    `   (${SESSION_ONE.spray.pull.count} pull, ${SESSION_ONE.spray.oppo.count} opposite)`
)
console.log('')
const barBySession = SESSIONS.map((s) => cell(s, 'allfields').allFieldsBarRate)
const barFallsEverySession = barBySession.every((r, i) => i === 0 || r < barBySession[i - 1])
if (barFallsEverySession) {
  console.log('  A visitor who picks this goal and clicks through the sessions watches the')
  console.log(`  demo get worse at the very thing the goal asks for, ${pct(barBySession[0])} down to`)
  console.log(`  ${pct(barBySession[barBySession.length - 1])}.`)
} else {
  console.log(`  Across sessions 2 to 4 that rate runs ${barBySession.map((r) => pct(r)).join(', ')}, so a visitor`)
  console.log('  clicking through does not watch the demo get worse at its own goal.')
}

// --- 9. The regression guards ----------------------------------------------

banner('9. THE NUMBERS THIS SLICE MUST NOT BREAK')
console.log('  Everything above is a defect. Everything here is working today and has to')
console.log('  still be working afterwards.')
console.log('')
console.log('  How often a goal\'s target band renders with nothing inside it:')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(10)).join(''))
for (const goal of SLICE11_GOALS) {
  const rates = SESSIONS.map((s) => cell(s, goal.id).emptyBandRate)
  if (rates[0] === null) continue
  console.log('  ' + goal.label.padEnd(26) + rates.map((r) => pct(r).padStart(10)).join(''))
}
console.log('  (Hit to All Fields and Open Session have no target, so there is no band to')
console.log('  leave empty.)')
console.log('')
console.log('  These will not match the Slice 6 tables at the foot of the report to the')
console.log('  last decimal, and should not: the two halves draw from separate random')
console.log('  streams, so the same quantity is measured twice on two independent')
console.log('  samples and lands a tenth or two apart. Both are right. That gap is what')
console.log(`  ${REPLAYS_PER_CELL.toLocaleString()} sessions buys, and it is worth knowing before anyone reads the two`)
console.log('  numbers as a disagreement.')
console.log('')
console.log('  The five-column distance chart, column by column. A pooled "how many columns')
console.log('  came up empty" number hides the thing that matters here, which is that the')
console.log('  goals fail at OPPOSITE ENDS of the chart, so both tables below are per')
console.log('  column.')
console.log('')
const bucketHeaders = DISTANCE_BUCKETS.map((b) => b.label)
const bucketHeaderRow = bucketHeaders.map((label) => label.padStart(12)).join('')
console.log('  How many of the fifteen swings land in each column on a typical session:')
console.log('  ' + 'goal'.padEnd(26) + 'session'.padStart(9) + bucketHeaderRow)
for (const goal of SLICE11_GOALS) {
  for (const sessionNum of SESSIONS) {
    console.log(
      '  ' + (sessionNum === SESSIONS[0] ? goal.label : '').padEnd(26) +
        String(sessionNum).padStart(9) +
        cell(sessionNum, goal.id).bucketFillPerSession.map((n) => n.toFixed(2).padStart(12)).join('')
    )
  }
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) + '1'.padStart(9) +
    SESSION_ONE.buckets.map((b) => b.count.toFixed(2).padStart(12)).join('')
)
console.log('')
console.log('  How often each column renders completely empty, which is what a visitor')
console.log('  sees as a gap in the chart:')
console.log('  ' + 'goal'.padEnd(26) + 'session'.padStart(9) + bucketHeaderRow + 'any column'.padStart(13))
for (const goal of SLICE11_GOALS) {
  for (const sessionNum of SESSIONS) {
    const c = cell(sessionNum, goal.id)
    console.log(
      '  ' + (sessionNum === SESSIONS[0] ? goal.label : '').padEnd(26) +
        String(sessionNum).padStart(9) +
        c.bucketEmptyRates.map((r) => pct(r).padStart(12)).join('') +
        pct(c.anyEmptyColumnRate).padStart(13)
    )
  }
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) + '1'.padStart(9) +
    SESSION_ONE.buckets.map((b) => (b.count === 0 ? 'empty' : 'filled').padStart(12)).join('') +
    'no'.padStart(13)
)
console.log('')
console.log('  Two different failures, in opposite directions, and neither is visible in a')
console.log('  pooled number.')
console.log('')
console.log(`  Power runs out of SHORT balls. Its "${bucketHeaders[0]}" column is empty on`)
console.log(
  `  ${pct(cell(2, 'power').bucketEmptyRates[0])}, ${pct(cell(3, 'power').bucketEmptyRates[0])} and ${pct(cell(4, 'power').bucketEmptyRates[0])} of sessions, and by session 4 holds just ` +
    `${cell(4, 'power').bucketFillPerSession[0].toFixed(2)} of`
)
const powerShortFill = cell(SESSIONS[SESSIONS.length - 1], 'power').bucketFillPerSession[0]
const powerShortEmpty = cell(SESSIONS[SESSIONS.length - 1], 'power').bucketEmptyRates[0]
console.log(`  fifteen swings. That is a Power hitter producing ${howOftenSeen(powerShortFill / 15)}`)
console.log(`  in that column, with the column empty on ${pct(powerShortEmpty)} of his sessions.`)
console.log('')
const otherGoalCells = SLICE11_CELLS.filter((c) => c.goalId !== 'power')
const powerCells = SLICE11_CELLS.filter((c) => c.goalId === 'power')
const rangeOf = (cells, column) => {
  const rates = cells.map((c) => c.bucketEmptyRates[column])
  return { lo: Math.min(...rates), hi: Math.max(...rates) }
}
const otherLong = rangeOf(otherGoalCells, 4)
const otherShort = rangeOf(otherGoalCells, 0)
const powerLong = rangeOf(powerCells, 4)
const powerShort = rangeOf(powerCells, 0)
console.log(`  The other four run out of LONG balls. Their "${bucketHeaders[4]}" column is empty on`)
console.log(`  ${pct(otherLong.lo)} to ${pct(otherLong.hi)} of sessions, while Power's is empty on ${pct(powerLong.lo)} to ${pct(powerLong.hi)}.`)
console.log('')
console.log('  Neither set is free of the other\'s problem, and it would be wrong to say')
console.log(`  otherwise: the four non-Power goals leave "${bucketHeaders[0]}" empty on ${pct(otherShort.lo)} to`)
console.log(`  ${pct(otherShort.hi)} of sessions too, and Power leaves "${bucketHeaders[4]}" empty on ${pct(powerLong.lo)} to ${pct(powerLong.hi)}.`)
// Compared WITHIN one session cell, not across two. An earlier version divided
// one goal's worst short-end cell by a different goal's worst long-end cell,
// which is two unrelated sessions and not a ratio of anything.
const worstAt = (cells, column) => cells.slice().sort((a, b) => b.bucketEmptyRates[column] - a.bucketEmptyRates[column])[0]
const powerWorstShort = worstAt(powerCells, 0)
const otherWorstLong = worstAt(otherGoalCells, 4)
const otherWorstLabel = SLICE11_GOALS.find((g) => g.id === otherWorstLong.goalId).label
console.log('  What differs is how much worse a session is at its OWN end than at the')
console.log('  other end, comparing the same sessions rather than two different ones:')
console.log(
  `    Power session ${powerWorstShort.sessionNum}, its worst: "${bucketHeaders[0]}" empty ${pct(powerWorstShort.bucketEmptyRates[0])}, ` +
    `"${bucketHeaders[4]}" empty ${pct(powerWorstShort.bucketEmptyRates[4])}`
)
console.log(
  `    ${otherWorstLabel} session ${otherWorstLong.sessionNum}, the worst of the four: "${bucketHeaders[4]}" empty ` +
    `${pct(otherWorstLong.bucketEmptyRates[4])}, "${bucketHeaders[0]}" empty ${pct(otherWorstLong.bucketEmptyRates[0])}`
)
console.log(
  `  That is ${(powerWorstShort.bucketEmptyRates[0] / powerWorstShort.bucketEmptyRates[4]).toFixed(1)} times worse at its own end for Power and ` +
    `${(otherWorstLong.bucketEmptyRates[4] / otherWorstLong.bucketEmptyRates[0]).toFixed(1)} times for the other.`
)
console.log('')
console.log('  Session 1, the hand-written one, fills all five. That is the shape the')
console.log('  generated sessions are being measured against, and none of them holds it')
console.log('  reliably today, so this row is a target the generator currently misses')
console.log('  rather than ground it currently holds.')
console.log('')
console.log('  Now the "any column" column, which is the pooled measure. Every goal shows')
const anyEmptyRates = SLICE11_CELLS.map((c) => c.anyEmptyColumnRate)
const worstAny = SLICE11_CELLS.slice().sort((a, b) => b.anyEmptyColumnRate - a.anyEmptyColumnRate)[0]
const worstAnyLabel = SLICE11_GOALS.find((g) => g.id === worstAny.goalId).label
const worstAnyElsewhere = SLICE11_CELLS
  .filter((c) => c.goalId !== worstAny.goalId)
  .sort((a, b) => b.anyEmptyColumnRate - a.anyEmptyColumnRate)[0]
console.log(`  at least one empty column on between ${pct(Math.min(...anyEmptyRates))} and ${pct(Math.max(...anyEmptyRates))} of sessions, so`)
console.log('  no goal is clean and this is not one goal misbehaving.')
console.log('')
const bestAny = SLICE11_CELLS.slice().sort((a, b) => a.anyEmptyColumnRate - b.anyEmptyColumnRate)[0]
const bestAnyLabel = SLICE11_GOALS.find((g) => g.id === bestAny.goalId).label
if (worstAny.goalId === bestAny.goalId) {
  console.log('  But BOTH ends of that range belong to one goal, and it is the same goal.')
  console.log(`  ${worstAnyLabel} is the worst, ${pct(worstAny.anyEmptyColumnRate)} on session ${worstAny.sessionNum}, where no other goal in`)
  console.log(`  the table passes ${pct(worstAnyElsewhere.anyEmptyColumnRate)}, and also the best, ${pct(bestAny.anyEmptyColumnRate)} on session ${bestAny.sessionNum}.`)
  console.log('  So the range is widest on one goal rather than spread across five, and a')
  console.log('  reader should not come away thinking the five are comparably bad on the')
  console.log('  pooled measure: this goal is both worse overall and worse at a different')
  console.log('  end of the chart.')
} else {
  console.log(`  The worst is ${worstAnyLabel} at ${pct(worstAny.anyEmptyColumnRate)} on session ${worstAny.sessionNum}, where no other goal in`)
  console.log(`  the table passes ${pct(worstAnyElsewhere.anyEmptyColumnRate)}. The best is ${bestAnyLabel} at ${pct(bestAny.anyEmptyColumnRate)} on session ${bestAny.sessionNum}.`)
  console.log('  The two ends belong to different goals, so the pooled measure is spread')
  console.log('  across the goals rather than driven by one of them.')
}
console.log('')
console.log('  That is the whole reason this is reported per column: the guard Slice 11')
console.log(`  has to hold is that the "${bucketHeaders[4]}" column on the four non-Power goals does not`)
console.log('  get materially emptier than it already is, and a pooled figure cannot')
console.log('  answer that question at all.')
console.log('')
console.log('  How far one swing sits from its own session average. Dividing by n, which')
console.log('  is the convention session 1\'s own numbers below are calculated on.')
console.log('  ' + 'session'.padEnd(26) + 'exit velocity'.padStart(16) + 'launch angle'.padStart(16) + 'session avg EV'.padStart(18))
for (const sessionNum of SESSIONS) {
  const cells = cellsForSession(sessionNum)
  console.log(
    '  ' + pooledRowLabel(sessionNum) +
      `${average(cells.map((c) => c.evSpreadPopulation)).toFixed(2)} mph`.padStart(16) +
      `${average(cells.map((c) => c.laSpreadPopulation)).toFixed(2)} deg`.padStart(16) +
      `${counterMean(mergeCounters(cells.map((c) => c.sessionAvgEvCounter))).toFixed(2)} mph`.padStart(18)
  )
}
console.log(
  '  ' + 'sessions 2 to 4 mean'.padEnd(26) +
    `${average(SLICE11_CELLS.map((c) => c.evSpreadPopulation)).toFixed(2)} mph`.padStart(16) +
    `${average(SLICE11_CELLS.map((c) => c.laSpreadPopulation)).toFixed(2)} deg`.padStart(16) +
    `${counterMean(allSessionAvgEvs).toFixed(2)} mph`.padStart(18)
)
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    `${SESSION_ONE.evSpread.toFixed(2)} mph`.padStart(16) +
    `${SESSION_ONE.laSpread.toFixed(2)} deg`.padStart(16) +
    `${SESSION_ONE.avgEv.toFixed(2)} mph`.padStart(18)
)
console.log('')
const generatedEvSpread = average(SLICE11_CELLS.map((c) => c.evSpreadPopulation))
const spreadGap = (generatedEvSpread - SESSION_ONE.evSpread) / SESSION_ONE.evSpread
if (spreadGap < -0.05) {
  console.log(`  The generated hitter is ${pct(-spreadGap)} TIGHTER than the session he is derived from,`)
  console.log('  which nobody chose.')
} else if (spreadGap > 0.05) {
  console.log(`  The generated hitter is ${pct(spreadGap)} LOOSER than the session he is derived from.`)
} else {
  console.log('  The generated hitter now spreads his swings about as widely as the session')
  console.log('  he is derived from, which is what this slice was aiming at.')
}
console.log('  Dividing by n-1 instead, which is what the older Slice 6 section at the')
console.log('  foot of this report does, reads about 3.5% higher:')
console.log(
  `    sessions 2 to 4 mean ${average(SLICE11_CELLS.map((c) => c.evSpreadSample)).toFixed(2)} mph / ` +
    `${average(SLICE11_CELLS.map((c) => c.laSpreadSample)).toFixed(2)} deg. Both conventions are correct; they`
)
console.log('    answer slightly different questions, and mixing them moves a target.')

banner('BEFORE YOU QUOTE ANY OF THIS: WHAT IS JUDGMENT RATHER THAN MEASUREMENT')
console.log('  Every conclusion above is now generated from the counts printed beside it,')
console.log('  including which goals are named, which direction a comparison runs, and')
console.log('  whether a thing happens often enough for anybody to see. Rerun this command')
console.log('  against a changed generator and the prose changes with it. That was not true')
console.log('  of three earlier drafts, each of which printed at least one sentence its own')
console.log('  table disproved, so it is worth stating plainly rather than assuming.')
console.log('')
console.log('  Four sentences are still hand-written, and they are hand-written because')
console.log('  they are JUDGMENTS rather than measurements. Each is printed only when the')
console.log('  data it comments on holds, so none of them can contradict a table. What a')
console.log('  reader should know is that these are opinions about baseball and about this')
console.log('  app, not things this script measured:')
console.log('')
for (const [section, sentence] of SENTENCES_THAT_DO_NOT_RE_DERIVE) {
  const words = sentence.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 68) {
      lines.push(line.trim())
      line = word
    } else {
      line = `${line} ${word}`
    }
  }
  lines.push(line.trim())
  console.log(`    section ${section}: ${lines[0]}`)
  for (const extra of lines.slice(1)) console.log(`               ${extra}`)
}
console.log('')
console.log('  The test that puts a sentence on this list is not "does it contain a number')
console.log('  somebody typed". Two rounds of review were spent finding out that this is')
console.log('  the wrong question: the worst offenders carried no number at all. The test')
console.log('  is whether the sentence states something this script did not measure.')

console.log('')
console.log('='.repeat(78))
console.log('THE SLICE 6 COMPARISON, WHICH IS A DIFFERENT BEFORE AND AFTER')
console.log(`${REPLAYS_PER_CELL.toLocaleString()} replayed practice sessions per row below. Same seed, ${SEED}.`)
console.log('')
console.log('Everything from here down compares the generator BEFORE Slice 6 ("honest')
console.log('ball flight", 14 August 2026) with the generator as it stands right now in')
console.log('src/swingGenerator.js. That pair of words, before and after, means Slice 6')
console.log('here and nothing else. Slice 11\'s own starting point is the nine sections')
console.log('above, which never use the word.')
console.log('='.repeat(78))

for (const sessionNum of SESSIONS) {
  console.log('')
  console.log(`SESSION ${sessionNum}`)
  console.log('-'.repeat(78))

  const before = measureBefore(sessionNum)
  const beforeDist = formatDistribution(before.distances)

  console.log('  BEFORE (old generator, ignores the player\'s goal entirely):')
  for (const goal of TARGET_GOALS) {
    console.log(
      `    ${goal.label.padEnd(24)} target band was empty ${pct(before.emptyRates[goal.id]).padStart(6)} of sessions`
    )
  }
  console.log(
    `    Average exit velocity ${before.avgEV.toFixed(1)} mph, average launch angle ${before.avgLA.toFixed(1)} degrees` +
      ` (same for every goal — the old generator did not read the goal at all)`
  )
  console.log('    How far the ball carried, across every swing generated above:')
  printDistributionLine('all goals (identical)', beforeDist)
  printBucketLine(bucketPercentages(before.distances))

  console.log('')
  console.log('  AFTER (current generator, in src/swingGenerator.js):')
  for (const goal of TARGET_GOALS) {
    const after = measureAfterForGoal(sessionNum, goal.id)
    const afterDist = formatDistribution(after.distances)
    console.log(
      `    ${goal.label.padEnd(24)} target band was empty ${pct(after.emptyRate).padStart(6)} of sessions` +
        `  (avg EV ${after.avgEV.toFixed(1)} mph, avg LA ${after.avgLA.toFixed(1)} deg)`
    )
    printDistributionLine(goal.label, afterDist)
    printBucketLine(bucketPercentages(after.distances))
  }
}

// ---------------------------------------------------------------------------
// THE CORRELATION CHANGE ON ITS OWN.
//
// Two claims written into src/swingGenerator.js's own comments are about what
// the shared contact-quality term did BY ITSELF, before the re-roll caught
// anything. Neither can be read off the before/after tables above, because
// every "after" number there already has the re-roll in it. This section is
// what produces them, so the comments quoting them are reproducible rather
// than remembered.
//
// The load-bearing one is Line Drives & Contact. Tying exit velocity to launch
// angle helps the Power goal and HURTS Contact, because a harder-struck ball
// is more likely to sail through Contact's 18 degree ceiling. That is the
// whole reason the re-roll was written for every goal rather than for Power
// alone, and this is the measurement that reason rests on.
//
// HOW THE RE-ROLL IS SWITCHED OFF WITHOUT TOUCHING SHIPPED CODE. generateSwings
// only re-rolls when the chosen goal HAS a target (hasTarget in
// src/goalTargets.js), and it only lifts launch angle when the goal is `power`.
// So asking it for an Open Session gives correlated swings with no re-roll and
// no lift — exactly the intermediate state — and those swings are then judged
// against Contact's target here by hand. Contact never gets a lift anyway, so
// the only thing this removes is the re-roll. Nothing in src/ is modified,
// reimplemented, or reached around to get the number.

function contactEmptyRateCorrelationOnly(sessionNum) {
  const random = streamFor(`correlation-only|session-${sessionNum}`)
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId: 'open',
      baselineSwings: mockSwings,
      random,
    })
    if (!swings.some((w) => meetsTarget('contact', w.hit.launch))) empty++
  }
  return empty / REPLAYS_PER_CELL
}

function contactEmptyRateBefore(sessionNum) {
  const random = streamFor(`correlation-pre-slice6|session-${sessionNum}`)
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = oldGenerateSwings(sessionNum, mockSwings, random)
    if (!swings.some((w) => meetsTarget('contact', w.hit.launch))) empty++
  }
  return empty / REPLAYS_PER_CELL
}

function contactEmptyRateShipped(sessionNum) {
  const random = streamFor(`correlation-shipped|session-${sessionNum}`)
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId: 'contact',
      baselineSwings: mockSwings,
      random,
    })
    if (!swings.some((w) => meetsTarget('contact', w.hit.launch))) empty++
  }
  return empty / REPLAYS_PER_CELL
}

console.log('')
console.log('='.repeat(78))
console.log('WHAT THE CORRELATION CHANGE DID ON ITS OWN, WITH NO RE-ROLL')
console.log('Line Drives & Contact: how often a session drew a completely empty')
console.log('target band. The middle row is the state that never shipped.')
console.log('='.repeat(78))
console.log('  ' + 'state'.padEnd(46) + SESSIONS.map((s) => `S${s}`.padStart(8)).join(''))
const EMPTY_BAND_ROWS = [
  ['pre-slice generator (independent draws)', contactEmptyRateBefore],
  ['correlation only, re-roll switched off', contactEmptyRateCorrelationOnly],
  ['as this app ships (correlation + re-roll)', contactEmptyRateShipped],
]
for (const [label, measure] of EMPTY_BAND_ROWS) {
  console.log('  ' + label.padEnd(46) + SESSIONS.map((s) => pct(measure(s)).padStart(8)).join(''))
}

// ---------------------------------------------------------------------------
// AND WHAT IT DID NOT DO: WIDEN OR TIGHTEN A SESSION.
//
// The independent share in src/swingGenerator.js (0.8, alongside the 0.6
// correlation) exists so the charts do not quietly tighten just because the
// two numbers now agree with each other: 0.6 squared plus 0.8 squared is 1.
// This checks that arithmetic against the real generator.
//
// TWO DIFFERENT SPREADS, AND THEY ARE EASY TO CONFUSE. "Within a session" is
// how far a typical swing sits from its OWN session's average, which is the
// thing the independent share is meant to preserve. "Pooled" throws every
// swing from every replayed session into one pile and measures against the
// grand average, so it also picks up how much the session averages themselves
// move around. The pooled figure is the larger of the two, and quoting it as
// though it were the within-session one is exactly the mix-up this block was
// added to settle. Both are sample standard deviations (n-1).

function spreads(gen) {
  let withinEV = 0
  let withinLA = 0
  let sessions = 0
  const allEV = []
  const allLA = []
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = gen()
    const evs = swings.map((w) => w.hit.launch.exitSpeed)
    const las = swings.map((w) => w.hit.launch.angle)
    const meanEV = average(evs)
    const meanLA = average(las)
    withinEV += evs.reduce((s, x) => s + (x - meanEV) ** 2, 0)
    withinLA += las.reduce((s, x) => s + (x - meanLA) ** 2, 0)
    sessions += 1
    allEV.push(...evs)
    allLA.push(...las)
  }
  const pooledSd = (xs) => {
    const m = average(xs)
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
  }
  return {
    withinEV: Math.sqrt(withinEV / (sessions * 14)),
    withinLA: Math.sqrt(withinLA / (sessions * 14)),
    pooledEV: pooledSd(allEV),
    pooledLA: pooledSd(allLA),
  }
}

console.log('')
console.log('='.repeat(78))
console.log('HOW SPREAD OUT A SESSION IS, BEFORE AND AFTER THE CORRELATION CHANGE')
console.log('Session 2, re-roll switched off on the "after" row so the correlation')
console.log('is the only thing that differs between them.')
console.log('='.repeat(78))
const SPREAD_BEFORE_RANDOM = streamFor('spread-pre-slice6|session-2')
const SPREAD_AFTER_RANDOM = streamFor('spread-correlated|session-2')
for (const [label, gen] of [
  ['before (independent draws)', () => oldGenerateSwings(2, mockSwings, SPREAD_BEFORE_RANDOM)],
  [
    'after (correlated, no re-roll)',
    () => generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: mockSwings, random: SPREAD_AFTER_RANDOM }),
  ],
]) {
  const s = spreads(gen)
  console.log(
    `  ${label.padEnd(32)} within a session ${s.withinEV.toFixed(2)} mph / ${s.withinLA.toFixed(2)} deg` +
      `   |   pooled across sessions ${s.pooledEV.toFixed(2)} mph / ${s.pooledLA.toFixed(2)} deg`
  )
}

console.log('')
console.log('='.repeat(78))
console.log('End of report.')
