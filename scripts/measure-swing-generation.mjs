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
// WHAT THIS REPORT DOES NOT DERIVE is declared at the foot of the output, under
// its own banner, in two lists built next to the banner that prints them. They
// are defined down there rather than here because half of what goes on the
// second list is the value of a threshold constant, and those constants are
// declared beside the section each one governs; a list that carried its own
// copies of them would be a disclosure that could go stale.
//
// The criterion for the first list, and getting it wrong is what kept the list
// incomplete for three rounds running: NOT "does the sentence contain a number
// somebody typed". Sentences like "Only Power reaches it in any quantity"
// carried no number at all and were the most wrong clauses in the report. The
// criterion is whether the sentence states something this script did not
// measure. The rule added on the fourth pass, which the earlier ones lacked:
// where a judgment has two opposite halves and the data picks which one prints,
// BOTH halves go on the list. Listing only today's half is how "an
// opposite-field lean is backwards for a high school hitter" got disclosed
// while its twin, "which is the right way round for a high school hitter", did
// not, and the twin is the half the rewrite makes print.

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

// Prose whose length is itself a measurement cannot be laid out by hand. A
// sentence naming the goals that did something runs to one label or to five
// depending on the run, so any line built from a derived list goes through
// here and is wrapped to the report's width. Tables are laid out by column and
// do not use this.
const REPORT_WIDTH = 78
function say(text, indent = '  ', hangIndent = indent) {
  const words = text.split(/\s+/).filter(Boolean)
  const out = []
  let line = ''
  for (const word of words) {
    const prefix = out.length === 0 ? indent : hangIndent
    if (line && (prefix + line + ' ' + word).length > REPORT_WIDTH) {
      out.push(prefix + line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) out.push((out.length === 0 ? indent : hangIndent) + line)
  for (const l of out) console.log(l)
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

// A number that is not a number is printed as one, rather than dressed up with
// a sign and a unit. `signed(NaN)` used to render "NaN mph" inside a tidy
// column, which reads as a measurement that went wrong somewhere rather than as
// a measurement that could not be taken at all.
function signed(x) {
  if (!Number.isFinite(x)) return 'n/a'
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

// THE HANDOVER BETWEEN THE LAST TWO BANDS IS DECIDED BY THE ROUNDING ITSELF,
// not by a second constant that has to agree with it. A fixed 0.67 cutoff left
// a narrow band of shares just under it where `Math.round(1 / perSession)` came
// back as 1 and the report said "about one swing in every 1 session". Asking
// the rounded answer whether it is still 1 closes that gap exactly, whatever
// the share.
function howOftenSeen(share) {
  const perSession = share * 15
  if (!Number.isFinite(perSession)) return 'an unknown number of times, since nothing was counted'
  if (perSession <= 0) return 'never'
  if (perSession >= 1.5) return `about ${perSession.toFixed(1)} swings on every session`
  const everyN = Math.round(1 / perSession)
  if (everyN <= 1) return 'about one swing on every session'
  return `about one swing in every ${sessionCountPhrase(everyN)}`
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
// Widest gaps are taken only over cells that HAVE both groups. A cell where
// every pitch was a strike contributes no gap at all, and folding its NaN into
// a Math.max poisons the reassurance sentence below into "the largest gap was
// NaN mph", which is worse than saying nothing.
let widestEvGap = 0
let widestLaGap = 0
let cellsWithBothGroups = 0
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
    if (c.inZone.n === 0 || c.outZone.n === 0) continue
    cellsWithBothGroups += 1
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
if (cellsWithBothGroups === 0) {
  console.log('  Not one of the goal-and-session combinations produced swings on both sides')
  console.log('  of the zone edge, so there is no per-goal gap to report either.')
} else {
  console.log(`  Each row above pools all five goals, ${(REPLAYS_PER_CELL * SLICE11_GOALS.length).toLocaleString()} sessions. Taken one goal at a`)
  console.log(`  time, across ${cellsWithBothGroups} of the ${SLICE11_CELLS.length} goal-and-session combinations, the largest gap`)
  console.log(`  either way was ${widestEvGap.toFixed(2)} mph and ${widestLaGap.toFixed(2)} degrees, so the pooled rows are not hiding`)
  console.log('  a goal where the link exists.')
}
console.log('')
// The threshold below which a gap is nothing rather than something. A tenth of
// a mile an hour is under the rounding the app shows anywhere, so a gap that
// small cannot reach a visitor even in principle. It is a judgment, and it is
// on the threshold list this report prints before the Slice 6 tables.
const A_REAL_GAP_MPH = 0.1
const strikeSwings = SLICE11_CELLS.reduce((sum, c) => sum + c.inZone.n, 0)
const ballSwings = SLICE11_CELLS.reduce((sum, c) => sum + c.outZone.n, 0)
const pooledGap = SLICE11_CELLS.reduce((sum, c) => sum + c.inZone.ev, 0) / strikeSwings -
  SLICE11_CELLS.reduce((sum, c) => sum + c.outZone.ev, 0) / ballSwings
// THREE OUTCOMES, NOT TWO, AND THE THIRD IS THE ONE THAT MATTERS MOST. A gap
// running the wrong way is what a sign error in a pitch-location coupling looks
// like, and it is the likeliest way that rewrite goes wrong. With only a
// "no link / link" pair this section read a gap of -6.05 mph back as success,
// in the first conclusion of the whole report. The fourth branch is for a gap
// that cannot be computed at all, which happens the moment every pitch lands on
// one side of the zone edge and one of the two averages divides by zero.
if (!Number.isFinite(pooledGap)) {
  console.log('  There is no gap to report, because one side of the comparison is empty.')
  console.log(`  Of the swings generated, ${strikeSwings.toLocaleString()} came at a strike and ${ballSwings.toLocaleString()} at a ball,`)
  console.log('  and a gap needs some of each. This section can say nothing either way until')
  console.log('  the generator throws both.')
} else if (Math.abs(pooledGap) < A_REAL_GAP_MPH) {
  console.log(`  There is no link here at all: ${signed(pooledGap)} mph is below the tenth of a mile an`)
  console.log('  hour this report treats as a real gap. The pitch and the swing are drawn')
  console.log('  without reference to each other, so a swing at a ball off the plate comes')
  console.log('  out just as well struck as a swing down the middle.')
} else if (pooledGap > 0) {
  console.log(`  The pitch does predict the contact, by ${signed(pooledGap)} mph. A swing at a strike`)
  console.log('  comes out better struck than a swing at a ball, which is how a real hitter')
  console.log('  behaves.')
} else {
  console.log(`  THE LINK RUNS BACKWARDS, by ${signed(pooledGap)} mph. A swing at a ball off the plate`)
  console.log('  comes out BETTER struck than a swing at a strike, which is the opposite of')
  console.log('  how a hitter behaves and would make the coach\'s reasoning about bad pitches')
  console.log('  worse than useless. A sign error in a pitch-location coupling looks exactly')
  console.log('  like this, and the size of the gap is no comfort: a large one is a large')
  console.log('  mistake.')
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
// A pitch below this has hit the ground before it reaches the plate, and that
// judgment decides whether a whole paragraph prints, so it is DERIVED from the
// two numbers it rests on rather than typed as 0.70 and explained in a comment
// nobody reading the report will ever see. Slice 11's plan caps a miss at 0.80
// feet outside the zone, and the zone floor is imported, so the lowest pitch
// the plan would accept is that floor less that cap. A generator sitting
// exactly on it stays quiet, because the comparison is strict.
//
// Session 1's own lowest pitch is 0.80 feet, above this line, so today's 0.50
// fires it and nothing session-1-shaped ever will. It is on the threshold list
// this report prints, and so is the cap it is built from.
const PLAN_MISS_CAP_FEET = 0.8
const BOUNCES_BELOW_FEET = round2(STRIKE_ZONE.heightMin - PLAN_MISS_CAP_FEET)
// How much further out than session 1 the generated misses have to run before
// this report calls the thrower wild rather than close to the shape session 1
// sets.
const MISSES_ARE_WILD_ABOVE = 1.25
// "Every single missed pitch" is a claim about all of them, so it needs a share
// this close to one before the report will say it in those words.
const BOTH_AXES_IS_EVERY = 0.99

// EVERYTHING BELOW DIVIDES BY THE NUMBER OF MISSED PITCHES, so a generator that
// never misses the zone has to be answered rather than divided by. Left
// unguarded this section printed a percentile row of NaN, "The closest miss
// anywhere is Infinity feet, so near misses do happen", and "NaN% of missed
// pitches are off on ONE axis only ... which is what a real thrower produces".
// Three reassuring sentences about a thrower who does not exist.
if (missTotal === 0) {
  console.log('  NOT ONE pitch of the ' + swingsTotal.toLocaleString() + ' generated missed the strike zone, so there is')
  console.log('  nothing here to measure the shape of. That is its own defect and a larger')
  console.log('  one than any this section was written to find: a thrower who never misses')
  console.log("  gives the hitter no bad pitches at all, and session 1 has six of them. The")
  console.log('  rest of this section is skipped rather than divided by zero.')
} else {
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
const missesAreWild = generatedMissMean > sessionOneMissMean * MISSES_ARE_WILD_ABOVE

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
  console.log(`  below session 1's own lowest of ${Math.min(...SESSION_ONE.pitchHeights).toFixed(2)}, and below the ${BOUNCES_BELOW_FEET.toFixed(2)} feet this report`)
  console.log(`  treats as bouncing in front of the plate (the zone floor of ${STRIKE_ZONE.heightMin} less the`)
  console.log(`  ${PLAN_MISS_CAP_FEET.toFixed(2)} foot miss this slice's plan allows).`)
}
console.log('')
if (bothAxesShare > BOTH_AXES_IS_EVERY) {
  console.log('  The second is that every single missed pitch is off on both axes at once:')
  console.log('  there is no such thing here as a pitch that is simply low, because a low')
  console.log('  pitch is always wide as well. No real thrower misses that way.')
} else {
  console.log(`  The second is that ${pct(1 - bothAxesShare)} of missed pitches are off on ONE axis only,`)
  console.log(`  with just ${pct(bothAxesShare)} off on both height and side at once. A pitch that misses`)
  console.log('  low while staying plausible sideways is what a real thrower produces.')
}
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
// A LEAN NEEDS A SIZE, NOT JUST A DIRECTION, and the two sides being equal is
// its own answer rather than a tie broken by whichever comparison was written
// first. A fixture that put every ball up the middle read 0.00 against 0.00 and
// was told it pulled more than it went the other way, which is the right way
// round for a high school hitter. Half a swing of fifteen is the smallest gap
// that shows up as a whole ball on a real session more often than not.
const A_REAL_LEAN_SWINGS = 0.5
if (meanPull - meanOppo >= A_REAL_LEAN_SWINGS) {
  console.log(`  The generated hitter pulls more than he goes the other way, ${meanPull.toFixed(2)} swings`)
  console.log(`  against ${meanOppo.toFixed(2)}, which is the right way round for a high school hitter.`)
} else if (meanOppo - meanPull >= A_REAL_LEAN_SWINGS) {
  console.log(`  The generated hitter goes the other way more often than he pulls, ${meanOppo.toFixed(2)} swings`)
  console.log(`  against ${meanPull.toFixed(2)}, which is backwards for a high school hitter.`)
} else {
  console.log(`  The generated hitter leans neither way: ${meanPull.toFixed(2)} swings pull against`)
  console.log(`  ${meanOppo.toFixed(2)} opposite field, inside the half a swing this report treats as a`)
  console.log('  real lean. A high school hitter should lean to the pull side, so an even')
  console.log('  split is not the target either.')
}
if (narrowsEverySession) {
  // The mechanism used to be named here, "because spray direction is multiplied
  // by the same shrinking variance factor that tightens everything else". That
  // is a fact about today's generator source rather than anything this run
  // counts, and this slice rewrites that source. What the run can say is that
  // it narrows, and by how much.
  console.log(`  The spread also narrows toward the middle every session, ${middleBySession[0].toFixed(2)} swings up the`)
  console.log(`  middle rising to ${middleBySession[middleBySession.length - 1].toFixed(2)}. Something is tightening spray session by session,`)
  console.log('  which no hitter does on his own.')
} else {
  console.log(`  It does not narrow toward the middle session by session: ${middleBySession.map((m) => m.toFixed(2)).join(', ')} swings up`)
  console.log('  the middle across sessions 2, 3 and 4.')
}

// --- 4. Pop-ups ------------------------------------------------------------

// Two thresholds this section's conclusions turn on, hoisted to the top level
// so the threshold list at the foot of the report can print them from the same
// constants the branches read. A threshold printed from a second copy of itself
// is not a disclosure.
//
// "MOSTLY" IS A CLAIM ABOUT CONCENTRATION AND NEEDS A TEST. Ranking the goals
// and naming the winner says nothing: on a fixture with pop-ups at 2.93, 2.96,
// 3.02, 3.01 and 3.01 per session, this section reported that they came "mostly
// on Hit to All Fields", a goal holding a fifth of them and winning on the third
// decimal. The test is against an even split, not against the other goals.
const POP_UPS_CONCENTRATED_AT = 2
// THE NULL FOR A HIGH-PITCH POP-UP IS THE SHARE OF HIGH PITCHES, NOT ZERO. With
// no link at all between where a pitch is and what the hitter does with it,
// pop-ups land on high pitches at exactly the rate pitches are high, which is
// around 15% here. A flat "more than half" test therefore fails a generator
// running the intended mechanism at nearly three times the null, and tells it
// its constants are wrong.
const POP_UP_LIFT_FACTOR = 2

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
  // What is observed is that it did not happen, across every swing this run
  // generated. "Cannot happen" and "forever" were claims about the code and
  // about the future, and this script only counts.
  say(
    `The goal names a failure the hitter never commits. The highest launch angle this run ` +
      `saw anywhere was ${counterMax(allLaunchAngles)} degrees and a pop-up needs more than ${POP_UP_ANGLE}, so across all ` +
      `${swingsTotal.toLocaleString()} swings generated here the count handed to the coach was zero on every ` +
      'single session.'
  )
} else {
  const perSession = totalPopUps / (REPLAYS_PER_CELL * SLICE11_GOALS.length * SESSIONS.length)
  const highShare = totalPopUpsHigh / totalPopUps
  console.log('  Pop-ups happen, so the goal now names a failure the hitter can actually')
  console.log(`  commit: ${perSession.toFixed(2)} per session averaged across every goal, and a count the coach`)
  console.log('  can coach against rather than a permanent zero.')

  const popUpShareByGoal = SLICE11_GOALS
    .map((goal) => ({
      goal,
      share: SESSIONS.reduce((s, n) => s + cell(n, goal.id).popUps, 0) / totalPopUps,
    }))
    .sort((a, b) => b.share - a.share)
  const evenShare = 1 / SLICE11_GOALS.length
  const topGoal = popUpShareByGoal[0]
  const bottomGoal = popUpShareByGoal[popUpShareByGoal.length - 1]
  if (topGoal.share >= evenShare * POP_UPS_CONCENTRATED_AT) {
    console.log(`  They come mostly on ${topGoal.goal.label}, which takes ${pct(topGoal.share)} of every pop-up`)
    console.log(`  generated against the ${pct(evenShare)} an even split would give it.`)
  } else {
    console.log(`  No one goal is where they come from: the five hold ${pct(bottomGoal.share)} to ${pct(topGoal.share)} of them`)
    console.log(`  each, against the ${pct(evenShare)} an even split would give, so this is a whole-generator`)
    console.log('  behaviour rather than something one goal does.')
  }

  // The share of high pitches, the null this is read against, is measured in
  // section 2 above.
  const highPitchShare = counterShare(allHeights, (v) => v >= STRIKE_ZONE.heightMax)
  const lift = highPitchShare > 0 ? highShare / highPitchShare : NaN
  if (!Number.isFinite(lift)) {
    console.log(`  ${pct(highShare)} of them are on pitches at or above the top of the zone, but no pitch`)
    console.log('  anywhere was thrown that high, so there is nothing to read that against.')
  } else if (lift >= POP_UP_LIFT_FACTOR) {
    console.log(`  ${pct(highShare)} of them are on pitches at or above the top of the zone, against`)
    console.log(`  ${pct(highPitchShare)} of pitches being that high in the first place. That is ${lift.toFixed(1)} times`)
    console.log('  what chance alone would give, which is the mechanism this was bought for: a')
    console.log('  hitter getting under a high pitch.')
  } else {
    console.log(`  ${pct(highShare)} of them are on pitches at or above the top of the zone, against`)
    console.log(`  ${pct(highPitchShare)} of pitches being that high anyway. That is ${lift.toFixed(1)} times what chance`)
    console.log('  alone would give, so pop-ups are not coming off high pitches and the')
    console.log('  constants are wrong.')
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
  say(
    `${ceilingMet.length === 1 ? 'One goal reaches' : `${ceilingMet.length} goals reach`} it often enough for a visitor to meet: ` +
      ceilingMet.map((g) => `${g.goal.label} at ${shareCell(g.share, g.onIt)}`).join(', ') + '.'
  )
  // "THE ONE GOAL" IS A SUPERLATIVE AND NEEDS TWO TESTS, NOT ONE. The old guard
  // checked only that Power sorted first, which is true whenever Power leads a
  // field of five. Pointed at a generator where all five goals met the ceiling,
  // this printed the list of all five and then said Power "is the goal that
  // meets it". It now prints only when Power is the ONLY goal meeting it, and
  // only while its share really does climb session by session, which is the
  // other half of what the sentence claims.
  const top = ceilingMet[0]
  if (ceilingMet.length === 1 && top.goal.id === 'power') {
    const bySession = SESSIONS.map((s) => {
      const c = cell(s, 'power').laCounter
      const share = counterShare(c, (v) => v === laCeiling)
      return { share, onIt: Math.round(share * counterTotal(c)) }
    })
    const climbs = bySession.every((s, i) => i === 0 || s.share > bySession[i - 1].share)
    if (climbs) {
      console.log('  Power is the one goal whose hitter is lifted toward that value session by')
      console.log(
        `  session, ${bySession.map((s) => shareCell(s.share, s.onIt)).join(' then ')}, which is why it is the goal that`
      )
      console.log('  meets it.')
    }
  }
}
if (ceilingRare.length === 1) {
  const only = ceilingRare[0]
  say(
    `${only.goal.label} touches it and no more, at ${shareCell(only.share, only.onIt)} of its swings, ` +
      `${howOftenSeen(only.share)}.`
  )
} else if (ceilingRare.length > 1) {
  const lowest = ceilingRare[ceilingRare.length - 1]
  const highest = ceilingRare[0]
  say(
    `${ceilingRare.length} goals touch it and no more: ${shareCell(lowest.share, lowest.onIt)} to ` +
      `${shareCell(highest.share, highest.onIt)} of swings, which nobody meets.`
  )
}
if (ceilingNever.length > 0) {
  say(
    `${ceilingNever.length === 1 ? 'One goal never reaches' : `${ceilingNever.length} goals never reach`} it at all: ` +
      ceilingNever.map((g) => g.goal.label).join(', ') + '.'
  )
}
console.log('')
// THE TABLE IS KEYED TO WHAT THE GENERATOR REACHED, NOT TO WHAT IT DECLARES,
// and those are two different questions that agree only while the generator
// clamps hard. Removing the hard clamps is one of the things this slice does.
//
// The failure this arrangement replaces: pointed at a generator whose launch
// angle is squeezed by a curve saturating at 28.4 degrees, all four DECLARED
// limits held nothing, and this section said "nothing is stacked and no chart
// carries a flat row of dots against an edge" twelve lines above its own
// measured half reporting 29.40% of Power's session-4 swings sitting on 28. The
// declared limits were the true half; the global claim built on them was not.
//
// Nothing is lost by keying the table this way. A declared limit that holds
// swings IS the highest or lowest value the generator produced, so it always
// appears here. What the table drops is a declared limit nothing reaches, and
// that is exactly what the paragraph after it reports.
console.log('  Now the four edges of the distribution: the highest and lowest launch angle')
console.log('  and exit velocity the generator actually produced. A flat row of dots is a')
console.log('  pile-up on an edge, so an edge is where one would show.')
console.log('')
console.log(
  '  ' + 'the edge reached'.padEnd(34) + 'swings on it'.padStart(16) + 'share'.padStart(10) + 'one step inside'.padStart(18)
)

const edgeOf = (name, unit, counter, step) => {
  const at = step < 0 ? counterMax(counter) : counterMin(counter)
  return {
    name,
    unit,
    where: `${at} ${unit === 'degrees' ? 'deg' : unit}`,
    // An edge at the top holds back what would have gone ABOVE it and one at
    // the bottom what would have gone BELOW it. Carried per edge because this
    // prose used to be written in the ceiling's voice and then applied to
    // floors as well, producing "the exit velocity floor of 78 mph is holding
    // swings back: everything that would have gone past 78 mph is parked on it."
    beyond: step < 0 ? 'above' : 'below',
    onIt: Math.round(counterShare(counter, (v) => v === at) * counterTotal(counter)),
    share: counterShare(counter, (v) => v === at),
    insideOnIt: Math.round(counterShare(counter, (v) => v === at + step) * counterTotal(counter)),
    insideShare: counterShare(counter, (v) => v === at + step),
  }
}
const edges = [
  edgeOf('highest launch angle', 'degrees', allLaunchAngles, -1),
  edgeOf('lowest launch angle', 'degrees', allLaunchAngles, +1),
  edgeOf('highest exit velocity', 'mph', allExitVelocities, -1),
  edgeOf('lowest exit velocity', 'mph', allExitVelocities, +1),
]

for (const e of edges) {
  console.log(
    '  ' + `${e.name}, ${e.where}`.padEnd(34) +
      e.onIt.toLocaleString().padStart(16) +
      shareCell(e.share, e.onIt).padStart(10) +
      shareCell(e.insideShare, e.insideOnIt).padStart(18)
  )
}

// Two groups, decided by measurement rather than by rank. An edge either holds
// MORE than the value just inside it, which is what something holding a tail
// back looks like, or it holds fewer, which is what an ordinary tail does.
// There is no third group here: an edge is by definition a value the generator
// reached, so it can never hold nothing.
const stackingEdges = edges.filter((e) => e.share > e.insideShare).sort((a, b) => b.share - a.share)
const thinningEdges = edges.filter((e) => e.share <= e.insideShare).sort((a, b) => b.share - a.share)

console.log('')
console.log('  Pooled across every goal and session number:')
if (stackingEdges.length === 0) {
  console.log(`  NOT ONE of the ${edges.length} edges carries a pile-up. On every one of them fewer swings`)
  console.log('  sit on the last value than on the value just inside it, which is what an')
  console.log('  ordinary tail does. That is the result this section exists to check for,')
  console.log('  not a missing table.')
} else {
  for (const e of stackingEdges) {
    say(
      `The ${e.name} reached, ${e.where}, carries a pile-up: ${shareCell(e.share, e.onIt)} of every swing ` +
        `on that one value against ${shareCell(e.insideShare, e.insideOnIt)} just inside it, so something is ` +
        `parking there whatever would have gone ${e.beyond} it. A visitor would see one ${howOftenSeen(e.share)}.`
    )
  }
  if (thinningEdges.length > 0) {
    const shares = thinningEdges.map((e) => shareCell(e.share, e.onIt))
    say(
      `The other ${thinningEdges.length === 1 ? 'edge is an ordinary tail' : `${thinningEdges.length} edges are ordinary tails`}: ` +
        `${thinningEdges.map((e) => e.name).join(', ')}, holding ${shares[shares.length - 1]} to ${shares[0]} ` +
        'of swings, fewer in each case than the value just inside.'
    )
  }
}

// A CHART IS ONE SESSION ON ONE GOAL, NOT THE POOLED HEAP, and the two answers
// can differ. This is not hypothetical: on a generator compressing launch angle
// at 28.4 degrees, the pooled edges showed no pile-up anywhere while Power's
// session 4 put 20.77% of its swings on 28 against 13.46% on 27. Pooling four
// goals whose distributions peak lower than Power's buries Power's edge under
// their bulk. So the sentence about charts is counted over cells, and the
// pooled verdict above is explicitly labelled as pooled.
const cellPilesUpAnywhere = (c) =>
  [
    [c.laCounter, -1],
    [c.laCounter, +1],
    [c.evCounter, -1],
    [c.evCounter, +1],
  ].some(([counter, step]) => {
    const at = step < 0 ? counterMax(counter) : counterMin(counter)
    return counterShare(counter, (v) => v === at) > counterShare(counter, (v) => v === at + step)
  })
const pilingCells = SLICE11_CELLS.filter(cellPilesUpAnywhere)
console.log('')
console.log('  Taken one cell at a time, which is what a visitor actually looks at:')
if (pilingCells.length === 0) {
  console.log(`  none of the ${SLICE11_CELLS.length} goal-and-session combinations piles up on any of its own four`)
  console.log('  edges, so no chart this generator can draw carries a flat row of dots along')
  console.log('  an edge.')
} else {
  const pilingGoals = [...new Set(pilingCells.map((c) => SLICE11_GOALS.find((g) => g.id === c.goalId).label))]
  say(
    `${pilingCells.length} of the ${SLICE11_CELLS.length} goal-and-session combinations pile up on at least one of ` +
      `their own four edges, across ${pilingGoals.length === 1 ? 'one goal' : `${pilingGoals.length} goals`}: ${pilingGoals.join(', ')}. ` +
      'Each of those is a chart a visitor can be shown with a flat row of dots along one edge of it.'
  )
}

// THE DECLARED LIMITS ARE A SEPARATE QUESTION, AND A NARROWER ONE. This
// paragraph is allowed to say only that a declared limit is or is not reached.
// It is not allowed to conclude anything about whether the distribution piles
// up, because the values it names are not the values the generator produced.
const declaredLimits = [
  ['launch angle ceiling', 'degrees', allLaunchAngles, GENERATOR_CLAMPS.launchAngle.max, -1],
  ['launch angle floor', 'degrees', allLaunchAngles, GENERATOR_CLAMPS.launchAngle.min, +1],
  ['exit velocity ceiling', 'mph', allExitVelocities, GENERATOR_CLAMPS.exitVelocity.max, -1],
  ['exit velocity floor', 'mph', allExitVelocities, GENERATOR_CLAMPS.exitVelocity.min, +1],
].map(([name, unit, counter, limit, step]) => ({
  name,
  unit,
  where: `${limit} ${unit === 'degrees' ? 'deg' : unit}`,
  onIt: Math.round(counterShare(counter, (v) => v === limit) * counterTotal(counter)),
  nearest: step < 0 ? counterMax(counter) : counterMin(counter),
}))
const deadLimits = declaredLimits.filter((w) => w.onIt === 0)
console.log('')
console.log(`  The generator also DECLARES four hard limits: a launch angle of ${GENERATOR_CLAMPS.launchAngle.min} to`)
console.log(`  ${GENERATOR_CLAMPS.launchAngle.max} degrees and an exit velocity of ${GENERATOR_CLAMPS.exitVelocity.min} to ${GENERATOR_CLAMPS.exitVelocity.max} mph, hand-copied into this`)
console.log('  script from the generator itself.')
if (deadLimits.length === 0) {
  console.log('  All four are reached, so all four are among the edges in the table above,')
  console.log('  and the table has already said what each of them holds.')
} else {
  say(
    `${deadLimits.length} of them ${deadLimits.length === 1 ? 'holds' : 'hold'} nothing whatsoever. ` +
      `Across ${swingsTotal.toLocaleString()} generated swings not one swing landed on:`
  )
  for (const w of deadLimits) {
    console.log(`    the ${w.name} of ${w.where}, the closest being ${w.nearest} ${w.unit}`)
  }
  say(
    `${deadLimits.length === 1 ? 'That limit is' : 'Those limits are'} set outside this hitter, so ` +
      `${deadLimits.length === 1 ? 'it is a dead constant rather than a wall: it says' : 'they are dead constants rather than walls: they say'} ` +
      'where the code stops, not where the hitter does. That is all this paragraph claims. ' +
      'Whether anything is stacked is the table above, which asks about the values the generator reached.'
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
// THE VERDICT IS READ OFF THE CELL THE SENTENCE ABOVE IT NAMES. It used to be
// read off the pooled counter across all fifteen cells while the sentence was
// about one of them, which is a different measurement and can disagree: a
// fixture compressing at 33.4 degrees printed "5.88% of swings sit exactly on
// 33, against 4.91% on 32. Fewer swings on the last value than on the one below
// it." Whether the distribution as a whole piles up is answered by the edge
// table further up, which is the right place for it.
//
// laCeiling is the largest value in the pooled counter, so some cell attains it
// and worstCeilingCell.share is never zero. There is no branch for that case
// because it cannot happen.
const worstCellStacks = worstCeilingCell.share > worstCeilingInside
console.log('')
console.log(
  `  It shows up most on ${worstCeilingLabel} session ${worstCeilingCell.c.sessionNum}: ` +
    `${shareCell(worstCeilingCell.share, Math.round(worstCeilingCell.share * counterTotal(worstCeilingCell.c.laCounter)))} of swings sit`
)
console.log(`  exactly on ${laCeiling}, against ${pct2(worstCeilingInside)} on ${laCeiling - 1}.`)
if (worstCellStacks) {
  console.log('  More swings on the last value than on the one below it, in that cell: that is')
  console.log('  the flat row of dots, on a chart every visitor who picks that goal can see.')
} else {
  console.log('  Fewer swings on the last value than on the one below it, in that cell, so it')
  console.log('  thins out into its own top end rather than piling against it. No flat row')
  console.log('  there, whatever the pooled edge table above says.')
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
      // "Never" is a word, so it is only used when the measured rate is
      // actually zero. The filter that put these goals here accepts anything
      // under RE_ROLL_BITES_ABOVE, which is not the same thing.
      const worstEmpty = Math.max(...bandButNeverEmpty.map((g) => g.emptyBand))
      say(
        `${bandButNeverEmpty.map((g) => g.goal.label).join(' and ')} ` +
          `${bandButNeverEmpty.length === 1 ? 'has a band' : 'have bands'} that ` +
          (worstEmpty === 0
            ? 'never comes up empty at all'
            : `comes up empty on only ${pct(worstEmpty)} of sessions, too rarely for the re-roll to reach`) +
          `, and ${bandButNeverEmpty.length === 1 ? 'sits' : 'sit'} with the goals that have no band at all.`
      )
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
// Where "essentially never" and "almost every time" stop being adjectives. Both
// are hoisted to the top level so the threshold list at the foot of the report
// prints them from the constants the branches actually read.
const BAR_RARELY_MET = 0.1
const BAR_USUALLY_MET = 0.9

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
// TWO CLAIMS, NOT ONE, AND THEY USED TO BE THE SAME SENTENCE: which way the
// rate moves across the sessions, and whether the bar is ever met at all. A
// generator that never met it printed "that rate runs 0.0%, 0.0%, 0.0%, so a
// visitor clicking through does not watch the demo get worse at its own goal",
// which is literally true and reads as an all-clear on the worst possible
// result. Nothing gets worse when there is nothing left to lose.
const barBySession = SESSIONS.map((s) => cell(s, 'allfields').allFieldsBarRate)
const barFallsEverySession = barBySession.every((r, i) => i === 0 || r < barBySession[i - 1])
const barRisesEverySession = barBySession.every((r, i) => i === 0 || r > barBySession[i - 1])
if (barFallsEverySession) {
  console.log('  A visitor who picks this goal and clicks through the sessions watches the')
  console.log(`  demo get worse at the very thing the goal asks for, ${pct(barBySession[0])} down to`)
  console.log(`  ${pct(barBySession[barBySession.length - 1])}.`)
} else if (barRisesEverySession) {
  console.log('  A visitor who picks this goal and clicks through the sessions watches the')
  console.log(`  demo get better at the thing the goal asks for, ${pct(barBySession[0])} up to`)
  console.log(`  ${pct(barBySession[barBySession.length - 1])}.`)
} else {
  console.log(`  Across sessions 2 to 4 that rate runs ${barBySession.map((r) => pct(r)).join(', ')}, which moves in no`)
  console.log('  one direction, so a visitor clicking through sees no trend either way.')
}
if (Math.max(...barBySession) < BAR_RARELY_MET) {
  console.log('')
  console.log(`  Read that beside the level, though. The bar is met on under ${pct(BAR_RARELY_MET)} of sessions`)
  console.log('  at every session number, so it is one this generator essentially never')
  console.log('  clears, whichever way the rate is moving. A goal that asks for something')
  console.log('  its own data almost never delivers is a worse result than a falling rate,')
  console.log('  not a better one.')
} else if (Math.min(...barBySession) > BAR_USUALLY_MET) {
  console.log('')
  console.log(`  And the level is high: over ${pct(BAR_USUALLY_MET)} at every session number, so a visitor who`)
  console.log('  picks this goal is shown a session that meets it almost every time.')
}

// --- 9. The regression guards ----------------------------------------------

// When a column counts as one the generator fills reliably: a gap on fewer than
// one session in twenty. Top level so the threshold list can print it.
const FILLS_RELIABLY_BELOW = 0.05
// How far the generated spread has to sit from session 1's before this report
// calls it tighter or looser rather than the same.
const SPREAD_COUNTS_AS_SAME_WITHIN = 0.05

banner('9. THE NUMBERS THIS SLICE MUST NOT BREAK')
// "EVERYTHING ABOVE IS A DEFECT" WAS TRUE OF THE BEFORE-RUN AND FALSE OF THE
// AFTER-RUN, which is the whole reason this report exists in two copies. What
// is true of both runs is what the sections are FOR, so that is what it says.
console.log('  The eight sections above are the eight things Slice 11 sets out to change,')
console.log('  whether or not this run shows them still broken. This last section is the')
console.log('  other kind: ground the slice has to still be standing on afterwards.')
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
console.log('  came up empty" number can hide which end of the chart a goal is failing at,')
console.log('  so both tables below are per column.')
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
// WHICH COLUMN A GOAL RUNS OUT OF IS FOUND, NOT TYPED, and so is whether there
// is more than one answer. Four sentences here used to be hardcoded English:
// "Power runs out of SHORT balls", "The other four run out of LONG balls",
// "Two different failures, in opposite directions", and "the goals fail at
// OPPOSITE ENDS of the chart". Pointed at a generator whose weakly struck balls
// come back, which is precisely what a wider spread plus a mis-hit mode is for,
// all four were false at once, and the ratio line beneath them read "0.0 times
// worse at its own end for Power and Infinity times for the other".
const worstColumnOf = (cells) => {
  const means = DISTANCE_BUCKETS.map((_, i) => average(cells.map((c) => c.bucketEmptyRates[i])))
  let worst = 0
  for (let i = 1; i < means.length; i++) if (means[i] > means[worst]) worst = i
  return worst
}
const goalWorstColumn = SLICE11_GOALS.map((goal) => ({
  goal,
  cells: SLICE11_CELLS.filter((c) => c.goalId === goal.id),
})).map((g) => ({ ...g, column: worstColumnOf(g.cells) }))
const columnGroups = [...new Set(goalWorstColumn.map((g) => g.column))]
  .map((column) => ({ column, goals: goalWorstColumn.filter((g) => g.column === column) }))
  .sort((a, b) => b.goals.length - a.goals.length)
const rangeOf = (cells, column) => {
  const rates = cells.map((c) => c.bucketEmptyRates[column])
  return { lo: Math.min(...rates), hi: Math.max(...rates) }
}
const groupCells = (group) => group.goals.flatMap((g) => g.cells)
// The subject of these sentences is built from a measurement, so the verb after
// it has to be built from the same measurement. "Every goal" takes a singular
// verb while a list of four labels takes a plural one, and a fixture where all
// five goals failed the same column printed "Every goal run out of the same
// kind of ball". Lower case throughout, with the sentence-initial capital added
// where it is needed, so the phrase can also sit mid-sentence.
const groupNames = (group) =>
  group.goals.length === SLICE11_GOALS.length ? 'every goal' : group.goals.map((g) => g.goal.label).join(', ')
const groupVerb = (group, singular, plural) =>
  (group.goals.length > 1 && group.goals.length < SLICE11_GOALS.length ? plural : singular)
const startSentence = (text) => text.charAt(0).toUpperCase() + text.slice(1)

if (columnGroups.length === 1) {
  const only = columnGroups[0]
  const range = rangeOf(groupCells(only), only.column)
  say(
    `One failure, not two, and it is the same one everywhere. ${startSentence(groupNames(only))} ` +
      `${groupVerb(only, 'runs', 'run')} out of the same kind of ball: the "${bucketHeaders[only.column]}" ` +
      `column, empty on ${pct(range.lo)} to ${pct(range.hi)} of sessions. There is no ` +
      'opposite-ends story to tell here.'
  )
} else {
  const columnsHit = columnGroups.map((g) => g.column)
  const atOppositeEnds =
    columnsHit.includes(0) && columnsHit.includes(DISTANCE_BUCKETS.length - 1)
  say(
    `${columnGroups.length} different failures, ` +
      (atOppositeEnds ? 'at opposite ends of the chart' : 'in different places on the chart') +
      ', and none of them is visible in a pooled number.'
  )
  for (const group of columnGroups) {
    const range = rangeOf(groupCells(group), group.column)
    const fillLast = average(
      group.goals.map((g) => g.cells.find((c) => c.sessionNum === SESSIONS[SESSIONS.length - 1]).bucketFillPerSession[group.column])
    )
    console.log('')
    say(
      `${startSentence(groupNames(group))} ${groupVerb(group, 'runs', 'run')} out of "${bucketHeaders[group.column]}" balls. ` +
        `That column is empty on ${pct(range.lo)} to ${pct(range.hi)} of sessions, and by session ` +
        `${SESSIONS[SESSIONS.length - 1]} holds ${fillLast.toFixed(2)} of the fifteen swings on a typical session.`
    )
  }

  // The comparison runs between the two groups that most goals fall into, and
  // only when there are exactly two. With three or more there is no "own end
  // against the other end" to measure, and the ranges above already say it.
  if (columnGroups.length === 2) {
    const [a, b] = columnGroups
    const aRange = { own: rangeOf(groupCells(a), a.column), other: rangeOf(groupCells(a), b.column) }
    const bRange = { own: rangeOf(groupCells(b), b.column), other: rangeOf(groupCells(b), a.column) }
    console.log('')
    say(
      'Neither set is free of the other\'s problem, and it would be wrong to say otherwise: ' +
        `${groupNames(a)} ${groupVerb(a, 'leaves', 'leave')} "${bucketHeaders[b.column]}" empty on ` +
        `${pct(aRange.other.lo)} to ${pct(aRange.other.hi)} of sessions too, and ${groupNames(b)} ` +
        `${groupVerb(b, 'leaves', 'leave')} "${bucketHeaders[a.column]}" empty on ` +
        `${pct(bRange.other.lo)} to ${pct(bRange.other.hi)}.`
    )

    // Compared WITHIN one session cell, not across two. An earlier version
    // divided one goal's worst cell at one end by a different goal's worst cell
    // at the other, which is two unrelated sessions and not a ratio of anything.
    // Both divisions are now guarded: a column that never comes up empty is a
    // zero denominator, and the ratio printed "Infinity times".
    const worstAt = (cells, column) =>
      cells.slice().sort((x, y) => y.bucketEmptyRates[column] - x.bucketEmptyRates[column])[0]
    const timesWorse = (own, other) => {
      if (other > 0) return `${(own / other).toFixed(1)} times worse at its own end`
      if (own > 0) return 'worse at its own end by any margin you like, the other column never coming up empty at all'
      return 'no worse at its own end, since neither column ever comes up empty'
    }
    console.log('  What differs is how much worse a session is at its OWN end than at the')
    console.log('  other end, comparing the same sessions rather than two different ones:')
    for (const [group, otherColumn] of [[a, b.column], [b, a.column]]) {
      const cellsIn = groupCells(group)
      const worst = worstAt(cellsIn, group.column)
      const label = SLICE11_GOALS.find((g) => g.id === worst.goalId).label
      say(
        `${label} session ${worst.sessionNum}, the worst of that set: "${bucketHeaders[group.column]}" empty ` +
          `${pct(worst.bucketEmptyRates[group.column])}, "${bucketHeaders[otherColumn]}" empty ` +
          `${pct(worst.bucketEmptyRates[otherColumn])}, which is ` +
          `${timesWorse(worst.bucketEmptyRates[group.column], worst.bucketEmptyRates[otherColumn])}.`,
        '    '
      )
    }
  }
}
console.log('')
// How full session 1 leaves the chart, and whether any generated cell manages
// the same, both counted. "Session 1 fills all five" and "none of them holds it
// reliably today" were both typed.
const sessionOneFilled = SESSION_ONE.buckets.filter((b) => b.count > 0).length
const cellsFillingReliably = SLICE11_CELLS.filter((c) => c.anyEmptyColumnRate < FILLS_RELIABLY_BELOW)
if (sessionOneFilled === DISTANCE_BUCKETS.length) {
  console.log(`  Session 1, the hand-written one, fills all ${DISTANCE_BUCKETS.length} columns itself. That is the shape`)
} else {
  console.log(`  Session 1, the hand-written one, fills ${sessionOneFilled} of the ${DISTANCE_BUCKETS.length} columns itself. That is the shape`)
}
console.log('  the generated sessions are being measured against.')
if (cellsFillingReliably.length === 0) {
  const best = SLICE11_CELLS.slice().sort((x, y) => x.anyEmptyColumnRate - y.anyEmptyColumnRate)[0]
  const bestLabel = SLICE11_GOALS.find((g) => g.id === best.goalId).label
  console.log(`  No generated combination comes near it: the best of the ${SLICE11_CELLS.length}, ${bestLabel}`)
  console.log(`  session ${best.sessionNum}, still leaves a column empty on ${pct(best.anyEmptyColumnRate)} of sessions. So this row is`)
  console.log('  a target the generator misses rather than ground it holds.')
} else {
  console.log(
    `  ${cellsFillingReliably.length} of the ${SLICE11_CELLS.length} goal-and-session combinations now leave a column empty on`
  )
  console.log(`  under ${pct(FILLS_RELIABLY_BELOW)} of sessions, so for those this is ground the generator holds`)
  console.log('  rather than a target it misses.')
}
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
// A RANGE WITH NO WIDTH HAS NO ENDS TO NAME. With every cell on the same rate,
// the sort still returns a first and a last, and this printed "Power & Distance
// is the worst, 100.0% on session 2, where no other goal in the table passes
// 100.0%, and also the best, 100.0% on session 2." Half a point of spread is
// the least this report will call a difference between two rates it prints to
// one decimal.
const A_REAL_SPREAD = 0.005
if (Math.max(...anyEmptyRates) - Math.min(...anyEmptyRates) < A_REAL_SPREAD) {
  console.log(`  That range has no width to it: every one of the ${SLICE11_CELLS.length} combinations sits within`)
  console.log(`  half a point of ${pct(average(anyEmptyRates))}, so there is no worst goal and no best one to`)
  console.log('  name, and nothing here separates the five.')
} else if (worstAny.goalId === bestAny.goalId) {
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
// The guard itself is a DECISION taken from these numbers when they were first
// read, not something this run measures, so it is on the judgment list below.
// Which column and which goals it names are read from the grouping above rather
// than typed, so the guard follows the data if the data moves.
{
  const biggest = columnGroups[0]
  say(
    'That is the whole reason this is reported per column. The guard Slice 11 agreed to ' +
      `hold, decided from numbers like these: the "${bucketHeaders[biggest.column]}" column on ` +
      `${groupNames(biggest)} must not get materially emptier than it already is, and a ` +
      'pooled figure cannot answer that question at all.'
  )
}
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
if (spreadGap < -SPREAD_COUNTS_AS_SAME_WITHIN) {
  console.log(`  The generated hitter is ${pct(-spreadGap)} TIGHTER than the session he is derived from,`)
  console.log('  which nobody chose.')
} else if (spreadGap > SPREAD_COUNTS_AS_SAME_WITHIN) {
  console.log(`  The generated hitter is ${pct(spreadGap)} LOOSER than the session he is derived from.`)
} else {
  console.log('  The generated hitter now spreads his swings about as widely as the session')
  console.log('  he is derived from, which is what this slice was aiming at.')
}
// "About 3.5% higher" was typed, and it is the gap between the two conventions
// on a fifteen-swing session, which does not move. Computed anyway, because a
// number in this report that nothing recomputes is a number nobody rechecks.
const evSpreadSample = average(SLICE11_CELLS.map((c) => c.evSpreadSample))
const sampleIsHigherBy = evSpreadSample / generatedEvSpread - 1
console.log('  Dividing by n-1 instead, which is what the older Slice 6 section at the')
console.log(`  foot of this report does, reads ${pct(sampleIsHigherBy)} higher:`)
console.log(
  `    sessions 2 to 4 mean ${evSpreadSample.toFixed(2)} mph / ` +
    `${average(SLICE11_CELLS.map((c) => c.laSpreadSample)).toFixed(2)} deg. Both conventions are correct; they`
)
console.log('    answer slightly different questions, and mixing them moves a target.')

// THREE LISTS, AND THE CLAIM AROUND THEM IS DELIBERATELY NARROWER THAN THE ONE
// IT REPLACES. The previous draft closed with "Every conclusion above is now
// generated from the counts printed beside it", which was the most quotable
// sentence in the report and the easiest one to disprove: six sentences across
// five sections were broken by fixtures within the hour. Each round of fixes
// had shortened the disclosure while broadening the claim, which is the wrong
// direction. A report that derives most things and lists the rest accurately is
// worth more here than one asserting completeness, so the claim is now bounded
// by what follows it rather than by a promise.
const JUDGMENTS_NOT_MEASUREMENTS = [
  [1, 'A gap running the right way is "how a real hitter behaves"; a gap running backwards is a sign error. Which one prints is measured. The baseball inside either is not.'],
  [1, 'Since Slice 8c the coach is handed which pitches were outside the zone and reasons about them out loud. That is true of the app, not of the generator, and it is what makes section 1 matter.'],
  [2, 'No real thrower misses on both axes at once; a pitch that misses low while staying plausible sideways is what a real thrower produces. Both halves, because the rewrite is meant to swap which one prints.'],
  [2, 'A pitch low enough to bounce in front of the plate is a defect rather than a hard pitch to hit.'],
  [3, 'A pull lean is the right way round for a high school hitter, an opposite-field lean is backwards, and an even split is not the target either. All three branches of one opinion about baseball.'],
  [4, 'A pop-up is supposed to come off a high pitch, so pop-ups arriving no more often on high pitches than chance would give means the constants are wrong. That is what this slice bought the mechanism FOR, not something measured here.'],
  [7, 'The lift on the re-rolled goals is the re-roll discarding weak sessions. Which goals are lifted and which have an empty band often enough to be re-rolled are both measured here; that a re-roll happens at all, and that it keeps the second attempt whatever it holds, is a fact about src/swingGenerator.js.'],
  [8, 'The bar this section measures, at least 3 swings pull side and at least 3 opposite field, is a sentence hand-copied out of the Hit to All Fields coaching instructions in src/coachApi.js. Reword it there to ask for four and this section goes on measuring three, silently.'],
  [9, 'The eight sections above are the eight things Slice 11 sets out to change, and this one is the ground it must not lose. That is the slice\'s intent. It is not a property of this run, and it stays true whether or not the run still shows a defect.'],
  [9, 'The guard named at the end of the distance-chart tables is a decision taken from numbers like these when they were first read, not a result this run produces. Which column and which goals it names ARE read from this run.'],
  [9, 'Session 1 is the shape the generated sessions are measured against. True by construction while session 1 stays frozen, which Slice 11 does not change.'],
]

// Every value here is read from the constant the branch itself reads, never
// retyped. A threshold printed from a second copy of itself is not a
// disclosure, it is a second thing to keep in step.
const THRESHOLDS_THAT_PICK_A_SENTENCE = [
  [1, `a pooled gap smaller than ${A_REAL_GAP_MPH} mph is no gap at all`],
  [2, `a pitch below ${BOUNCES_BELOW_FEET.toFixed(2)} feet has bounced: the zone floor of ${STRIKE_ZONE.heightMin} less the ${PLAN_MISS_CAP_FEET.toFixed(2)} foot miss this slice's plan allows, so a generator sitting exactly on the plan's floor stays quiet`],
  [2, `the thrower is "wild" when the average miss is over ${MISSES_ARE_WILD_ABOVE} times session 1's`],
  [2, `"every single missed pitch" needs ${pct(BOTH_AXES_IS_EVERY)} of them`],
  [3, `a lean either way needs ${A_REAL_LEAN_SWINGS} of the fifteen swings between the two sides`],
  [4, `pop-ups come "mostly" from one goal when it holds ${POP_UPS_CONCENTRATED_AT} times an even share of them`],
  [4, `the high-pitch link is real at ${POP_UP_LIFT_FACTOR} times the rate chance alone would give`],
  [5, `a value nobody meets is one a visitor would see less than once in ${MEETS_IT_ONCE_IN} sessions`],
  [7, `the empty-band re-roll "bites" above an empty-band rate of ${pct(RE_ROLL_BITES_ABOVE)}`],
  [8, `the bar is "essentially never met" below ${pct(BAR_RARELY_MET)} and "met almost every time" above ${pct(BAR_USUALLY_MET)}`],
  [9, `a column fills reliably when it is empty on under ${pct(FILLS_RELIABLY_BELOW)} of sessions`],
  [9, `the generated spread counts as the same as session 1's within ${pct(SPREAD_COUNTS_AS_SAME_WITHIN)} of it`],
  [9, `a range of rates has ends worth naming once they differ by ${pct(A_REAL_SPREAD)}`],
]

// Numbers this script cannot import and therefore holds its own copy of. Each
// is checked where it can be checked and disclosed where it cannot.
const HAND_COPIES_FROM_THE_APP = [
  `the five goal labels, from GOALS in src/App.jsx, which a plain Node script cannot import because that file contains JSX. Renaming a goal on screen does not rename it here`,
  `the generator's four declared limits, ${GENERATOR_CLAMPS.launchAngle.min} to ${GENERATOR_CLAMPS.launchAngle.max} degrees and ${GENERATOR_CLAMPS.exitVelocity.min} to ${GENERATOR_CLAMPS.exitVelocity.max} mph, written as bare literals in src/swingGenerator.js and exported nowhere. A limit that moves OUTWARD stops this run before it prints; a limit that moves INWARD is not caught, and section 5 would go on naming a value nothing reaches`,
  'the Hit to All Fields bar of 3 and 3, from a sentence in src/coachApi.js rather than a constant',
]

const printList = (rows) => {
  for (const [section, sentence] of rows) {
    say(`section ${section}: ${sentence}`, '    ', '               ')
  }
}

banner('BEFORE YOU QUOTE ANY OF THIS: WHAT THIS REPORT DID NOT MEASURE')
console.log('  Every number in the tables above is counted from this run, and so is nearly')
console.log('  every number in the prose beside them, along with which goals get named,')
console.log('  which direction each comparison runs, and every word about how often a')
console.log('  thing happens. Rerun this against a changed generator and those change')
console.log('  with it.')
console.log('')
console.log('  Three things do not, and each can leave a true sentence carrying the wrong')
console.log('  conclusion, so they are listed rather than left to be noticed.')
console.log('')
console.log('  FIRST, the judgments. Opinions about baseball, facts about this app, and')
console.log('  decisions this slice took. The data decides which of them prints; it does')
console.log('  not decide whether the opinion inside is right. Where a judgment has two')
console.log('  opposite halves, both are listed, because listing only the half that')
console.log('  prints today is how this list stayed incomplete for three rounds.')
console.log('')
printList(JUDGMENTS_NOT_MEASUREMENTS)
console.log('')
console.log('  SECOND, the thresholds. Each of these numbers decides which sentence gets')
console.log('  printed. Move one and this report reaches a different conclusion from the')
console.log('  same data, with every figure in every table still correct.')
console.log('')
printList(THRESHOLDS_THAT_PICK_A_SENTENCE)
console.log('')
console.log('  THIRD, the numbers this script copies by hand because it cannot import')
console.log('  them:')
console.log('')
for (const line of HAND_COPIES_FROM_THE_APP) say(`- ${line}`, '    ', '      ')
console.log('')
console.log('  And one limit on the whole thing. This report can only comment on what it')
console.log('  counts. It counts the EDGES of a distribution, not its middle, so a')
console.log('  pile-up on some interior value is something it would not report at all.')
console.log('  It has never rendered a chart, so every sentence here about what a visitor')
console.log('  would see is an inference from counts and not an observation. Nothing')
console.log('  above should be read as saying more than that.')

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
