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
  const raw = eq ? eq.slice('--seed='.length) : flagAt >= 0 ? argv[flagAt + 1] : null
  if (raw === null || raw === undefined) return DEFAULT_SEED
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    console.error(`--seed needs a whole number that is zero or more. Got: ${raw === undefined ? '(nothing)' : raw}`)
    process.exit(1)
  }
  return value
}

const SEED = parseSeed(process.argv.slice(2))

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
const SLICE11_GOALS = [
  { id: 'power', label: 'Power & Distance' },
  { id: 'contact', label: 'Line Drives & Contact' },
  { id: 'allfields', label: 'Hit to All Fields' },
  { id: 'popup', label: 'Reduce Pop-Ups' },
  { id: 'open', label: 'Open Session' },
]

const POP_UP_ANGLE = GOAL_COUNT_SPECS.popup.popUpAngle
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
      if (count === 0) emptyColumns += 1
    })
    emptyColumnTotal += emptyColumns
    if (emptyColumns > 0) sessionsWithAnEmptyColumn += 1

    if (hasTarget(goalId) && !swings.some((w) => meetsTarget(goalId, w.hit.launch))) emptyBand += 1
  }

  const swingsSeen = REPLAYS_PER_CELL * 15
  return {
    sessionNum,
    goalId,
    sessions: REPLAYS_PER_CELL,
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
    bucketShares: bucketTotals.map((n) => n / swingsSeen),
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

function signed(x) {
  return `${x >= 0 ? '+' : ''}${x.toFixed(2)}`
}

console.log('='.repeat(78))
console.log('SWING GENERATOR MEASUREMENT, SLICE 11 BASELINE')
console.log(`Seed ${SEED}. Rerun the same command and every number below comes back the same.`)
console.log(`${REPLAYS_PER_CELL.toLocaleString()} replayed practice sessions per goal, per session number.`)
console.log('This half of the report is today\'s generator, one section per defect')
console.log('Slice 11 sets out to fix, plus the numbers the slice must not break.')
console.log('The Slice 6 before-and-after tables follow it, under their own banner.')
console.log('='.repeat(78))

// --- 1. The zone gap -------------------------------------------------------

banner('1. DOES THE PITCH PREDICT THE CONTACT?')
console.log('A hitter swinging at a pitch outside the strike zone should not hit it as')
console.log('well as one down the middle. The number to watch is the gap: how much')
console.log('better a swing at a strike comes out than a swing at a ball.')
console.log('')
console.log('  ' + 'session'.padEnd(26) + 'exit velocity gap'.padStart(20) + 'launch angle gap'.padStart(20))
let widestGap = 0
for (const sessionNum of SESSIONS) {
  const cells = cellsForSession(sessionNum)
  const zoneEv = cells.reduce((s, c) => s + c.inZone.ev, 0) / cells.reduce((s, c) => s + c.inZone.n, 0)
  const ballEv = cells.reduce((s, c) => s + c.outZone.ev, 0) / cells.reduce((s, c) => s + c.outZone.n, 0)
  const zoneLa = cells.reduce((s, c) => s + c.inZone.la, 0) / cells.reduce((s, c) => s + c.inZone.n, 0)
  const ballLa = cells.reduce((s, c) => s + c.outZone.la, 0) / cells.reduce((s, c) => s + c.outZone.n, 0)
  console.log(
    '  ' + sessionRowLabel(sessionNum) +
      `${signed(zoneEv - ballEv)} mph`.padStart(20) +
      `${signed(zoneLa - ballLa)} deg`.padStart(20)
  )
  for (const c of cells) {
    const gap = c.inZone.ev / c.inZone.n - c.outZone.ev / c.outZone.n
    widestGap = Math.max(widestGap, Math.abs(gap))
  }
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    `${signed(SESSION_ONE.zoneGapEv)} mph`.padStart(20) +
    `${signed(SESSION_ONE.zoneGapLa)} deg`.padStart(20)
)
console.log('')
console.log(`  Across all ${SLICE11_CELLS.length} goal-and-session combinations measured, the largest exit`)
console.log(`  velocity gap either way was ${widestGap.toFixed(2)} mph, so the pooled rows above are not`)
console.log('  hiding a goal where the link exists.')
console.log('')
console.log('  The pitch and the swing are drawn independently of each other, so there is')
console.log('  no link to find. Since Slice 8c the coach is handed which pitches were')
console.log('  outside the zone and reasons about them out loud, which means that on every')
console.log('  generated session that reasoning is a coincidence.')

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
console.log('  Two things to read off that. A missed pitch is never a near miss: the')
console.log('  closest one is a tenth of a foot outside only because the zone edge is')
console.log('  where it is, and a low miss can be a ball that bounces. And every single')
console.log('  missed pitch is off on both axes at once, which no real thrower does.')

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
    '  ' + sessionRowLabel(sessionNum) +
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
console.log('  The generated hitter goes the other way more often than he pulls, which is')
console.log('  backwards for a high school hitter, and the spread narrows toward the middle')
console.log('  every session because spray direction is multiplied by the same shrinking')
console.log('  variance factor that tightens everything else.')

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
const allLaunchAngles = mergeCounters(SLICE11_CELLS.map((c) => c.laCounter))
console.log('')
console.log(`  Pop-ups seen in all ${swingsTotal.toLocaleString()} generated swings: ${totalPopUps.toLocaleString()}.`)
console.log(
  totalPopUps === 0
    ? '  None, so there is no share on high pitches to report.'
    : `  On pitches at or above the top of the zone: ${pct(totalPopUpsHigh / totalPopUps)}.`
)
console.log(`  The highest launch angle the generator produced at all: ${counterMax(allLaunchAngles)} degrees.`)
console.log('')
console.log(`  The goal names a failure that cannot happen. The highest launch angle this`)
console.log(`  generator will produce is ${counterMax(allLaunchAngles)} degrees and a pop-up needs more than ${POP_UP_ANGLE},`)
console.log('  so the coach is handed a count of zero pop-ups on every session forever,')
console.log('  and says so.')

// --- 5. Ceiling pile-ups ---------------------------------------------------

banner('5. SWINGS STACKED AGAINST A CEILING')
const allExitVelocities = mergeCounters(SLICE11_CELLS.map((c) => c.evCounter))
const laCeiling = counterMax(allLaunchAngles)
const laFloor = counterMin(allLaunchAngles)
const evCeiling = counterMax(allExitVelocities)
const evFloor = counterMin(allExitVelocities)
console.log('  A clamp does not throw a swing away, it parks it exactly on the limit. Every')
console.log('  swing that would have gone past the ceiling is drawn at the ceiling instead,')
console.log('  as a flat row of dots pinned to the top edge of a chart a visitor reads.')
console.log('')
console.log(`  Share of swings sitting exactly on the highest launch angle the generator`)
console.log(`  produced, ${laCeiling} degrees:`)
console.log('')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(10)).join('') + 'S2 to S4'.padStart(12))
for (const goal of SLICE11_GOALS) {
  const merged = mergeCounters(SESSIONS.map((s) => cell(s, goal.id).laCounter))
  console.log(
    '  ' + goal.label.padEnd(26) +
      SESSIONS.map((s) => pct2(counterShare(cell(s, goal.id).laCounter, (v) => v === laCeiling)).padStart(10)).join('') +
      pct2(counterShare(merged, (v) => v === laCeiling)).padStart(12)
  )
}
console.log('  ' + 'every goal pooled'.padEnd(26) + ''.padStart(30) +
  pct2(counterShare(allLaunchAngles, (v) => v === laCeiling)).padStart(12))
console.log('')
console.log('  Only Power reaches it, because Power is the one goal whose hitter is lifted')
console.log('  toward the ceiling session by session. On Power session 4 one swing in')
console.log('  twenty-five is drawn on the top line of the chart.')
console.log('')
console.log('  What a wall looks like, next to the three limits that are not being reached.')
console.log('  A limit that binds carries more swings than the value just inside it, because')
console.log('  it is holding everything that would have gone past. A limit nothing reaches')
console.log('  carries fewer, like any other value out in the tail.')
console.log('')
console.log('  ' + 'limit'.padEnd(34) + 'on the limit'.padStart(16) + 'one step inside'.padStart(18))
const limitRows = [
  [`highest launch angle seen, ${laCeiling} deg`, allLaunchAngles, laCeiling, laCeiling - 1],
  [`lowest launch angle seen, ${laFloor} deg`, allLaunchAngles, laFloor, laFloor + 1],
  [`highest exit velocity seen, ${evCeiling} mph`, allExitVelocities, evCeiling, evCeiling - 1],
  [`lowest exit velocity seen, ${evFloor} mph`, allExitVelocities, evFloor, evFloor + 1],
]
for (const [label, counter, edge, inside] of limitRows) {
  console.log(
    '  ' + label.padEnd(34) +
      pct2(counterShare(counter, (v) => v === edge)).padStart(16) +
      pct2(counterShare(counter, (v) => v === inside)).padStart(18)
  )
}
const powerS4Angles = cell(4, 'power').laCounter
console.log('')
console.log(
  `  On Power session 4, where that ceiling really bites: ${pct2(counterShare(powerS4Angles, (v) => v === laCeiling))} of swings sit` +
    ` exactly on ${laCeiling},`
)
console.log(`  against ${pct2(counterShare(powerS4Angles, (v) => v === laCeiling - 1))} on ${laCeiling - 1}. That is the flat row of dots, on a chart every`)
console.log('  visitor who picks that goal can see.')
console.log('')
console.log('  So one wall is being hit and three are not. The generator limits launch')
console.log('  angle and exit velocity at both ends; only the launch angle ceiling is close')
console.log('  enough to this hitter to catch anything, and it catches enough to see.')

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
    '  ' + sessionRowLabel(sessionNum) +
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
console.log('  Read the goal column, not just the pooled row. The three goals with a target')
console.log('  band come out higher because a session that would draw an empty band is')
console.log('  re-rolled, and the sessions thrown away are the weak ones. Open Session,')
console.log('  which is never re-rolled, is the step the dice actually produce.')

// --- 8. Hit to All Fields against its own bar ------------------------------

banner('8. HIT TO ALL FIELDS, AGAINST THE BAR THAT GOAL SETS ITSELF')
console.log('  That goal asks the player for at least 3 pull side and at least 3 opposite')
console.log('  field. Share of sessions that actually deliver it, on the Hit to All Fields')
console.log('  goal a visitor would have picked:')
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
console.log('  A visitor who picks this goal and clicks through the sessions watches the')
console.log('  demo get worse at the very thing the goal asks for.')

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
console.log('  Empty columns on the five-column distance chart, averaged per session, with')
console.log('  the share of sessions showing at least one in brackets:')
console.log('  ' + 'goal'.padEnd(26) + SESSIONS.map((s) => `S${s}`.padStart(16)).join(''))
for (const goal of SLICE11_GOALS) {
  console.log(
    '  ' + goal.label.padEnd(26) +
      SESSIONS.map((s) => {
        const c = cell(s, goal.id)
        return `${c.emptyColumnsPerSession.toFixed(2)} (${pct(c.anyEmptyColumnRate)})`.padStart(16)
      }).join('')
  )
}
console.log(
  '  ' + 'session 1 (hand-written)'.padEnd(26) +
    `${SESSION_ONE.buckets.filter((b) => b.count === 0).length.toFixed(2)}`.padStart(16) +
    `   bars: ${SESSION_ONE.buckets.map((b) => b.count).join(', ')}`
)
console.log('')
console.log('  How far one swing sits from its own session average. Dividing by n, which')
console.log('  is the convention session 1\'s own numbers below are calculated on.')
console.log('  ' + 'session'.padEnd(26) + 'exit velocity'.padStart(16) + 'launch angle'.padStart(16) + 'session avg EV'.padStart(18))
for (const sessionNum of SESSIONS) {
  const cells = cellsForSession(sessionNum)
  console.log(
    '  ' + sessionRowLabel(sessionNum) +
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
console.log('  The generated hitter is a tighter hitter than the session he is derived')
console.log('  from, which nobody chose. Dividing by n-1 instead, which is what the older')
console.log('  Slice 6 section at the foot of this report does, reads about 3.5% higher:')
console.log(
  `    sessions 2 to 4 mean ${average(SLICE11_CELLS.map((c) => c.evSpreadSample)).toFixed(2)} mph / ` +
    `${average(SLICE11_CELLS.map((c) => c.laSpreadSample)).toFixed(2)} deg. Both conventions are correct; they`
)
console.log('    answer slightly different questions, and mixing them moves a target.')

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
