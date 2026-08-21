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
// ANNOTATION, 21 AUGUST 2026, SLICE 11 TASK 5. Only the "before" row of either
// section is frozen. Every other row is built from the generator in the working
// tree, so both sections drift forward as the generator changes and neither is
// a preserved picture of August 2026 any more. That was harmless while nothing
// touched the generator and stopped being harmless the moment something did:
// the second section's own header used to promise that the correlation was the
// only thing separating its two rows, which Task 5 made false. Both banners now
// say so where a reader of the OUTPUT will see it, which is the half that
// matters, since almost nobody reading a number off this report is reading this
// file. Nothing about the measurements themselves changed.
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

const { generateSwings, EXIT_VELOCITY_LIMITS, LAUNCH_ANGLE_LIMITS } = await import('../src/swingGenerator.js')
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

// The four limits the generator holds every swing between.
//
// IMPORTED SINCE 21 AUGUST 2026, AND HAND-COPIED BEFORE THAT, which is the
// whole of what changed here. This block used to carry its own copy of the four
// numbers, because the generator wrote them as bare literals inside two
// Math.max/Math.min lines and exported nothing, and the comment here said at
// length which half of a drift that copy could catch: a limit that moved
// OUTWARD stopped the run, a limit that moved INWARD was missed silently and
// left this report describing a wall no swing could reach.
//
// Task 6 replaced both clamps with soft compression and had to export the
// limits so the generator's own tests could read them, which retired the excuse
// for the copy. They are imported now, so the asymmetry above is simply gone:
// there is no second copy left to be stale in either direction.
//
// WHAT THE CHECK BELOW NOW PROVES IS A DIFFERENT AND BETTER THING. It used to
// ask whether this file's copy still matched the generator. It now asks whether
// the generator kept its own promise, across every swing this run generated,
// which is the property the whole app leans on: a chart axis, a coach count
// line and a distance bucket all assume no swing can leave this range.
//
// ONE THING WAS LOST WITH THE COPY AND HAS SINCE BEEN CLOSED, recorded because
// the reasoning generalises. A copy is also a tripwire: it goes off when the
// generator moves, which is how anyone knows to come and look, and an import
// simply follows the generator wherever it goes. The exposure that created was
// in section 5, which printed unconditional prose saying these limits are
// approached rather than parked on, and would have gone on printing it after a
// future task restored hard clamps. It is conditional now, off the same measured
// count the sentences beside it use, so the claim cannot outlive the thing it
// describes. What is worth carrying: an imported constant removes a copy's
// staleness and takes the copy's alarm with it, so any PROSE written around an
// import has to be derived from a measurement rather than typed.
const GENERATOR_CLAMPS = {
  exitVelocity: EXIT_VELOCITY_LIMITS,
  launchAngle: LAUNCH_ANGLE_LIMITS,
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

// The kept-promise check the GENERATOR_CLAMPS comment describes. Since Task 6
// the limits are eased toward rather than parked on, so nothing here should
// ever come near one; a swing outside them means the compression has a hole in
// it, every chart axis and count line downstream is built on a range the
// generator does not actually honour, and the safe thing is to stop rather than
// print a page of confident nonsense.
for (const [name, counter, clamp] of [
  ['launch angle', allLaunchAngles, GENERATOR_CLAMPS.launchAngle],
  ['exit velocity', allExitVelocities, GENERATOR_CLAMPS.exitVelocity],
]) {
  if (counterMin(counter) < clamp.min || counterMax(counter) > clamp.max) {
    console.error(
      `The generator left its own declared ${name} limits (${clamp.min} to ${clamp.max}): ` +
        `it produced ${counterMin(counter)} to ${counterMax(counter)}. ` +
        'Fix that before trusting anything this script prints.'
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
    // One of session 1's six missed pitches is off on both axes at once, its
    // swing 14, a tenth high and a tenth wide. That share is the standard the
    // generated both-axes rate is judged against, rather than a flat number.
    bothAxesShare: outside.length
      ? outside.filter((w) => {
          const { heightMiss, sideMiss } = pitchMiss(w)
          return heightMiss > 0 && sideMiss > 0
        }).length / outside.length
      : NaN,
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
// The unit a visitor actually looks at. One chart is one session of fifteen
// swings, which is what turns a share into something a person can picture and
// is what the flat-row test below is built on.
const SWINGS_PER_SESSION = 15

function howOftenSeen(share) {
  const perSession = share * SWINGS_PER_SESSION
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

// ===========================================================================
// THE RULE EVERY VERDICT IN THIS FILE OBEYS, AND WHY IT IS ONE RULE.
//
// A verdict is any sentence that says a thing IS so rather than printing the
// number and stopping. Five rounds of review have found the same defect five
// times in five different sections, and it has one shape every time: a verdict
// decided by a presence test (is it non-zero), a strict comparison (is A bigger
// than B), or a monotonicity test (did it rise every step), with no floor under
// it saying how much bigger or how much of a rise is enough to mean anything.
// Sampling noise clears all three. So does a defect that has been reduced by
// ninety per cent but not removed.
//
// The rule, in two halves:
//
//   1. EVERY VERDICT NEEDS A MAGNITUDE FLOOR OR A RELATIVE THRESHOLD. Not the
//      ones somebody reported: every one. If a verdict cannot be given an
//      honest floor, the verdict is deleted and the number is printed instead.
//
//   2. EVERY THRESHOLD THAT CAN BE CROSSED FROM BOTH SIDES GETS BOTH SIDES
//      TESTED AND BOTH SIDES DISCLOSED. A one-sided test on a two-sided
//      quantity is how a thrower missing by HALF session 1's distance was told
//      he was close to the shape session 1 sets.
//
// What follows is the machinery, in one place, so a future section cannot
// invent a sixth way of getting this wrong.

// Is a run of values actually going somewhere? Both halves of the rule in one
// function: a direction is only reported when the whole move clears a floor,
// and the "on every step" wording is a separate fact reported separately.
//
// Section 8's only conclusion used to be bare monotonicity. On a generator
// where the defect it measures was FIXED, with the rate flat at about 69%,
// six of sixteen seeds printed a directional verdict and they disagreed with
// each other: three said the demo gets worse, three said it gets better.
// A change of -0.001 renders as "-0.00", which reads as a direction on a number
// that has none. Rounded to the places it will be printed at first.
const noNegativeZero = (x, places) => (Math.abs(x) < 0.5 / 10 ** places ? 0 : x)

function trendVerdict(values, floor) {
  const change = values[values.length - 1] - values[0]
  const everyStepUp = values.every((v, i) => i === 0 || v > values[i - 1])
  const everyStepDown = values.every((v, i) => i === 0 || v < values[i - 1])
  if (change >= floor) return { direction: 'up', everyStep: everyStepUp, change }
  if (change <= -floor) return { direction: 'down', everyStep: everyStepDown, change }
  return { direction: 'flat', everyStep: false, change }
}

// Is one count meaningfully bigger than another, as a RATIO rather than a
// difference? The right test wherever the two quantities can both be tiny, so
// an absolute floor would either never fire or always fire depending on the
// scale the generator happens to run at.
const MATERIAL_RATIO = 1.2
function ratioVerdict(a, b, ratio = MATERIAL_RATIO) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'incomparable'
  if (b <= 0) return a > 0 ? 'above' : 'level'
  if (a / b >= ratio) return 'above'
  if (b / a >= ratio) return 'below'
  return 'level'
}

// ONE FACTOR FOR EVERY COMPARISON THIS REPORT MAKES AGAINST SESSION 1, in both
// directions. Session 1 is the hitter this app already claims to have, so
// "close to the shape session 1 sets" is the standard several verdicts here are
// judged against. Inside this factor either way is the same shape; outside it
// in EITHER direction is a finding, and both findings are printed.
//
// It replaces three separate one-sided tests. The miss-distance one accepted
// anything below 1.25 times session 1's average as close to its shape, which
// included half of it. The both-axes one gave the defect an all-clear at
// anything under 99% while ninety per cent of it survived.
// A RANGE WITH NO WIDTH HAS NO ENDS TO NAME. With every cell on the same rate,
// the sort still returns a first and a last, and this printed "Power & Distance
// is the worst, 100.0% on session 2, where no other goal in the table passes
// 100.0%, and also the best, 100.0% on session 2." Half a point of spread is
// the least this report will call a difference between two rates it prints to
// one decimal.
const A_REAL_SPREAD = 0.005

// How much more a distribution's edge has to hold than the value just inside it
// before this report calls it a pile-up rather than an ordinary tail.
const A_PILE_UP_RATIO = MATERIAL_RATIO

// A SECOND, ABSOLUTE TEST BESIDE THE RELATIVE ONE, because a relative test
// cannot see the thing this section exists to find once the clamps are gone.
//
// The assumption that was invisible while hard clamps existed: a clamp piles
// EVERYTHING on one value, so the top value always beats the value below it and
// comparing the two works. Soft compression spreads the pile across the top few
// integers, so the last value need not beat its neighbour while still holding a
// third of the cell. Measured on a curve saturating at 28.4 degrees, Power's
// session 4 put 34.58% of its swings on one exact launch angle against 30.46%
// on the one below, and this report said no chart it can draw carries a flat
// row of dots.
//
// HOW THE THRESHOLD IS ARRIVED AT, and it is a derivation rather than a pick,
// with TWO judgments in it rather than one. The unit is a chart, which is one
// session of SWINGS_PER_SESSION swings, and that part is not a judgment at all.
// Then:
//
//   The ANCHOR. howOftenSeen's middle band runs from roughly 0.67 to 1.5 swings
//   a session, and taking one swing a session as the point where a value stops
//   being occasional is a choice INSIDE that band rather than a constant
//   inherited from it.
//
//   The HALF. One swing on every other chart a visitor opens, rather than every
//   chart, is where this report will call a single value a flat row on its own
//   merits.
//
// An earlier draft of this comment presented only the half as a judgment and
// called the anchor inherited. It is not, and the difference is not academic:
// take the TOP of the same band, 1.5 a session, and the line lands at 5.0%,
// above the 4.2% precedent below, and the precedent check fails.
//
// CHECKED AGAINST THIS PROJECT'S OWN RECORDED PRECEDENT, which is what makes it
// more than an opinion. CLAUDE.md records 4.2% of Power session-4 swings
// sitting on exactly 35.0 degrees as a first-screen credibility defect worth
// its own slice. That is above the line below, so the precedent fires. The
// precedent is a check on the derivation, not its source, and since the anchor
// was free enough to have failed that check, the check is doing real work
// rather than confirming a foregone conclusion.
const A_FLAT_ROW_PER_SESSION = 0.5
const A_FLAT_ROW_SHARE = A_FLAT_ROW_PER_SESSION / SWINGS_PER_SESSION

// One value in one cell, judged both ways. `why` says which test fired, because
// "more swings than on the value below it" and "a fifth of the chart on one
// value" are different findings and a reader deserves to know which one they
// are being shown.
function flatRowVerdict(share, insideShare) {
  const relative = ratioVerdict(share, insideShare, A_PILE_UP_RATIO)
  const stacksRelative = relative === 'above'
  const bigOnItsOwn = share >= A_FLAT_ROW_SHARE
  return {
    relative,
    stacksRelative,
    bigOnItsOwn,
    flatRow: stacksRelative || bigOnItsOwn,
    why: stacksRelative && bigOnItsOwn ? 'both' : stacksRelative ? 'relative' : bigOnItsOwn ? 'absolute' : 'neither',
  }
}

// A FLOOR THAT KNOWS HOW BIG THE SAMPLE IS, because a hand-picked one does not.
// The first attempt at fixing section 8 gave its trend the half a point this
// file uses elsewhere for rates, and the verdict STILL flipped with the seed at
// five of sixteen seeds. The arithmetic says why: on a rate near 69% measured
// over 20,000 sessions, two independent readings of the SAME rate differ by
// about half a point from sampling alone, so half a point is roughly one
// standard error and gets crossed constantly.
//
// This returns the floor the sample itself justifies: three standard errors of
// the difference between two independent readings of one rate. A product floor
// still applies on top of it, and whichever is larger wins, so a change can be
// too small to be real OR too small to be worth reporting and either one is
// enough to withhold the verdict.
const NOISE_SIGMAS = 3
const rateNoiseFloor = (rate, n) =>
  n > 0 && rate > 0 && rate < 1 ? NOISE_SIGMAS * Math.sqrt((2 * rate * (1 - rate)) / n) : 0
const floorForRate = (rate, n, productFloor) => Math.max(productFloor, rateNoiseFloor(rate, n))

// The threshold below which a gap is nothing rather than something. A tenth of
// a mile an hour is under the rounding the app shows anywhere, so a gap that
// small cannot reach a visitor even in principle. It is a judgment, and it is
// on the threshold list this report prints before the Slice 6 tables.
const A_REAL_GAP_MPH = 0.1

// When a column counts as one the generator fills reliably: a gap on fewer than
// one session in twenty. Top level so the threshold list can print it.
const FILLS_RELIABLY_BELOW = 0.05

const SESSION_ONE_SHAPE_WITHIN = 1.25
const againstSessionOne = (measured, sessionOne) =>
  ratioVerdict(measured, sessionOne, SESSION_ONE_SHAPE_WITHIN)

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
// The SIGNED per-goal gaps, not only the widest absolute one. Two goals with
// strong links running opposite ways cancel in the pooled row, and the sentence
// below used to say the pooled rows were "not hiding a goal where the link
// exists" while printing a widest per-goal gap of 14.50 mph on the line above.
const perGoalEvGaps = []
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
    perGoalEvGaps.push({ cell: c, gap: c.inZone.ev / c.inZone.n - c.outZone.ev / c.outZone.n })
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
  // THE REASSURANCE IS ITSELF A VERDICT AND NEEDED THE SAME FLOOR AS THE GAP.
  // Unreported, found by auditing the file rather than by review. Pointed at a
  // generator whose link was wired with the sign keyed off the goal, so the
  // goals cancelled, this printed "the largest gap either way was 14.50 mph, so
  // the pooled rows are not hiding a goal where the link exists" on one line.
  const lowestGap = perGoalEvGaps.slice().sort((a, b) => a.gap - b.gap)[0]
  const highestGap = perGoalEvGaps.slice().sort((a, b) => b.gap - a.gap)[0]
  const labelOf = (entry) =>
    `${SLICE11_GOALS.find((g) => g.id === entry.cell.goalId).label} session ${entry.cell.sessionNum}`
  say(
    `Each row above pools all five goals, ${(REPLAYS_PER_CELL * SLICE11_GOALS.length).toLocaleString()} sessions. Taken one goal at a time, ` +
      `across ${cellsWithBothGroups} of the ${SLICE11_CELLS.length} goal-and-session combinations, the largest gap either way was ` +
      `${widestEvGap.toFixed(2)} mph and ${widestLaGap.toFixed(2)} degrees.`
  )
  // THE QUESTION IS AGREEMENT, NOT SIZE, and the first attempt at this floor got
  // that wrong in the other direction: it flagged a generator whose every goal
  // carried a consistent +9.6 to +9.8 mph link, which is the target state, as
  // hiding something. What the pooled row can hide is a goal whose link points
  // somewhere else, so each per-goal gap is put through the same three-way test
  // the pooled gap gets, and they either all land in the same place or they do
  // not. No new threshold: the floor is the one the verdict below already uses.
  const gapVerdict = (gap) => (Math.abs(gap) < A_REAL_GAP_MPH ? 'none' : gap > 0 ? 'positive' : 'negative')
  const perGoalVerdicts = new Set(perGoalEvGaps.map((e) => gapVerdict(e.gap)))
  if (perGoalVerdicts.size === 1) {
    say(
      `Every one of them lands on the same side of the ${A_REAL_GAP_MPH} mph this report treats as a real ` +
        'gap, so the pooled rows are not hiding a goal whose link points somewhere else.'
    )
  } else {
    say(
      'THE POOLED ROWS ARE HIDING SOMETHING: the goals do not agree with each other. The ' +
        `extremes run from ${signed(lowestGap.gap)} mph on ${labelOf(lowestGap)} to ` +
        `${signed(highestGap.gap)} mph on ${labelOf(highestGap)}` +
        (gapVerdict(lowestGap.gap) === 'negative' && gapVerdict(highestGap.gap) === 'positive'
          ? ', a link running in OPPOSITE directions on different goals. They cancel when pooled, so the pooled verdict below is about the cancellation rather than about the hitter.'
          : ', so read the pooled verdict below as an average over goals that differ rather than as one number true of each.')
    )
  }
}
console.log('')
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
// BOTH ENDS OF THE PITCH, from the same cap. Only the floor was checked before,
// which left a generator that sails balls over the backstop entirely unremarked
// while one that bounces them is called out. Same one-sided shape as everything
// else this round fixed.
const PLAN_MISS_CAP_FEET = 0.8
const BOUNCES_BELOW_FEET = round2(STRIKE_ZONE.heightMin - PLAN_MISS_CAP_FEET)
const SAILS_ABOVE_FEET = round2(STRIKE_ZONE.heightMax + PLAN_MISS_CAP_FEET)
// "Every single missed pitch" is a claim about all of them, so it needs a share
// this close to one before the report will say it in those words. It is NOT the
// test for whether the both-axes defect is fixed; that one is relative to
// session 1's own share, via SESSION_ONE_SHAPE_WITHIN, because a share of 90%
// is not "every single one" and is not a fix either.
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
const closestSessionOneMiss = SESSION_ONE.misses[0]
const generatedMissMean = counterMean(allMisses)
const sessionOneMissMean = average(SESSION_ONE.misses)
const bothAxesShare = axes.bothAxes / missTotal
const lowestPitch = counterMin(allHeights)
const highestPitch = counterMax(allHeights)

// BOTH DIRECTIONS, FROM ONE FACTOR. This used to test the wild side only, so a
// thrower missing by 0.15 feet against session 1's 0.28, roughly half, was told
// "That is close to the shape session 1 sets". Being far too accurate is as
// much a defect as being wild, and the plan's near-miss work could produce it.
const missDistance = againstSessionOne(generatedMissMean, sessionOneMissMean)
say(
  'Two things to read off that. The first is how far out a typical miss is: ' +
    `${generatedMissMean.toFixed(2)} feet on average against session 1's ${sessionOneMissMean.toFixed(2)}, and ` +
    `${pct(counterShare(allMisses, (v) => v > worstSessionOneMiss))} of them further out than session 1's worst ` +
    `miss of ${worstSessionOneMiss.toFixed(2)}. ` +
    (missDistance === 'above'
      ? 'The generated thrower misses by a good deal more than the session this demo is calibrated against.'
      : missDistance === 'below'
        ? 'The generated thrower misses by a good deal LESS than the session this demo is calibrated against, which is its own kind of wrong: a pitcher this accurate gives the hitter nothing to lay off.'
        : 'That is close to the shape session 1 sets.')
)

// "NEAR MISSES DO HAPPEN" WAS A CONCLUSION WITH NO TEST BEHIND IT. It printed
// off whatever the closest miss happened to be, so it said the same thing at
// 0.05 feet and at 0.45. Session 1's own closest miss is the calibration point
// this section already uses everywhere else, so it is the one used here.
const closestMiss = counterMin(allMisses)
say(
  closestMiss <= closestSessionOneMiss
    ? `The closest miss anywhere is ${closestMiss.toFixed(2)} feet, at or inside session 1's own closest of ` +
      `${closestSessionOneMiss.toFixed(2)}, so near misses do happen.`
    : `There are no near misses at all: the closest miss anywhere is ${closestMiss.toFixed(2)} feet, further out ` +
      `than session 1's own closest of ${closestSessionOneMiss.toFixed(2)}, so every ball out of the zone is ` +
      'plainly out of it.'
)

// BOTH ENDS OF THE PITCH, not just the floor. The floor was checked and the
// ceiling was not, which is the same one-sided shape as the miss distance
// above. The plan caps a miss at PLAN_MISS_CAP_FEET either way, so the highest
// pitch it would accept is the zone ceiling plus that cap.
if (lowestPitch < BOUNCES_BELOW_FEET) {
  say(
    `The worst do not: the lowest pitch thrown is ${lowestPitch.toFixed(2)} feet off the ground, below ` +
      `session 1's own lowest of ${Math.min(...SESSION_ONE.pitchHeights).toFixed(2)}, and below the ` +
      `${BOUNCES_BELOW_FEET.toFixed(2)} feet this report treats as bouncing in front of the plate (the zone ` +
      `floor of ${STRIKE_ZONE.heightMin} less the ${PLAN_MISS_CAP_FEET.toFixed(2)} foot miss this slice's plan allows).`
  )
}
if (highestPitch > SAILS_ABOVE_FEET) {
  say(
    `And at the other end: the highest pitch thrown is ${highestPitch.toFixed(2)} feet off the ground, above ` +
      `session 1's own highest of ${Math.max(...SESSION_ONE.pitchHeights).toFixed(2)} and above the ` +
      `${SAILS_ABOVE_FEET.toFixed(2)} feet the same cap allows at the top (the zone ceiling of ` +
      `${STRIKE_ZONE.heightMax} plus ${PLAN_MISS_CAP_FEET.toFixed(2)}). That is a ball nobody swings at.`
  )
}
console.log('')

// THREE OUTCOMES, AND THE MIDDLE ONE IS THE DEFECT THIS SECTION EXISTS FOR.
// The old test gated only the "every single one" wording, so anything under 99%
// took the success branch and the word "just" attached to whatever landed
// there: 90% of missed pitches off on both axes was reported as "just 90.0% ...
// A pitch that misses low while staying plausible sideways is what a real
// thrower produces". Session 1's own share, one miss in six, is the standard.
const sessionOneBothAxesShare = SESSION_ONE.bothAxesShare
const bothAxesVerdict = againstSessionOne(bothAxesShare, sessionOneBothAxesShare)
if (bothAxesShare > BOTH_AXES_IS_EVERY) {
  say(
    'The second is that every single missed pitch is off on both axes at once: there is no ' +
      'such thing here as a pitch that is simply low, because a low pitch is always wide as ' +
      'well. No real thrower misses that way.'
  )
} else if (bothAxesVerdict === 'above') {
  say(
    `The second is that ${pct(bothAxesShare)} of missed pitches are off on both height and side at ` +
      `once, against ${pct(sessionOneBothAxesShare)} of session 1's own six. ${pct(1 - bothAxesShare)} are off on one axis ` +
      'only, so the defect is reduced rather than removed: a pitch that misses low while ' +
      'staying plausible sideways is still the exception rather than the rule.'
  )
} else {
  say(
    `The second is that ${pct(1 - bothAxesShare)} of missed pitches are off on ONE axis only, with ` +
      `${pct(bothAxesShare)} off on both height and side at once, against ${pct(sessionOneBothAxesShare)} of session 1's ` +
      'own six. A pitch that misses low while staying plausible sideways is what a real ' +
      'thrower produces, and that is now what this one mostly does.'
  )
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
// A LEAN NEEDS A SIZE, NOT JUST A DIRECTION, and the two sides being equal is
// its own answer rather than a tie broken by whichever comparison was written
// first. A fixture that put every ball up the middle read 0.00 against 0.00 and
// was told it pulled more than it went the other way, which is the right way
// round for a high school hitter. Half a swing of fifteen is the smallest gap
// that shows up as a whole ball on a real session more often than not.
const A_REAL_LEAN_SWINGS = 0.5

// A DIRECTION NEEDS A SIZE, the same way the lean below it already does. This
// was bare monotonicity, so at seed 5 on a generator where spray had been taken
// off the variance factor entirely it read 6.46 rising to 6.46 and concluded
// "The spread also narrows toward the middle every session ... Something is
// tightening spray session by session, which no hitter does on his own." The
// floor is the one the sibling claim in this very section already uses.
const middleTrend = trendVerdict(middleBySession, A_REAL_LEAN_SWINGS)
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
// The mechanism used to be named here, "because spray direction is multiplied
// by the same shrinking variance factor that tightens everything else". That is
// a fact about today's generator source rather than anything this run counts,
// and this slice rewrites that source. What the run can say is which way it
// moves, by how much, and whether it moved on every step.
const middleCounts = middleBySession.map((m) => m.toFixed(2)).join(', ')
if (middleTrend.direction === 'up') {
  say(
    `The spread also narrows toward the middle${middleTrend.everyStep ? ' on every session' : ' across the three sessions, though not on every step'}: ` +
      `${middleCounts} swings up the middle, a move of ${middleTrend.change.toFixed(2)} of a swing. Something is ` +
      'tightening spray session by session, which no hitter does on his own.'
  )
} else if (middleTrend.direction === 'down') {
  say(
    `The spread widens away from the middle${middleTrend.everyStep ? ' on every session' : ' across the three sessions'}: ` +
      `${middleCounts} swings up the middle, a move of ${noNegativeZero(middleTrend.change, 2).toFixed(2)} of a swing.`
  )
} else {
  say(
    `It does not move toward or away from the middle session by session: ${middleCounts} swings up the ` +
      `middle across sessions 2, 3 and 4, a move of ${noNegativeZero(middleTrend.change, 2).toFixed(2)} of a swing across the three, ` +
      `under the ${A_REAL_LEAN_SWINGS} of a swing this report treats as a real move.`
  )
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
// How many pop-ups the run has to produce before this section is willing to
// split them by goal or by pitch height. A percentage off a hundred-odd events
// is noise wearing a decimal point.
const POP_UP_SAMPLE_FLOOR = 1000

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
} else if (!wouldBeMet(totalPopUps / swingsTotal)) {
  // PRESENT IS NOT THE SAME AS REACHABLE, and `totalPopUps === 0` was the only
  // test. A mis-hit mode tuned too low produced 119 pop-ups in 4,500,000
  // swings, every one of the fifteen cells read 0.00 per session, and this
  // section declared the defect fixed: "Pop-ups happen, so the goal now names a
  // failure the hitter can actually commit: 0.00 per session ... a count the
  // coach can coach against rather than a permanent zero." Section 5 has had
  // the right test for this question for two rounds; it is the same one.
  const perSession = totalPopUps / (REPLAYS_PER_CELL * SLICE11_GOALS.length * SESSIONS.length)
  say(
    `Pop-ups exist but no visitor meets one. ${totalPopUps.toLocaleString()} of them across ` +
      `${swingsTotal.toLocaleString()} swings is ${howOftenSeen(totalPopUps / swingsTotal)}, which rounds to ` +
      `${perSession.toFixed(2)} per session on every one of the ${SLICE11_CELLS.length} goal-and-session combinations ` +
      'in the table above.'
  )
  say(
    `A visitor would have to sit through more than ${MEETS_IT_ONCE_IN} sessions to see one, and the app ` +
      'only offers four, so the count the coach is handed is zero on effectively every ' +
      'session and the goal still names a failure its own hitter does not commit. The ' +
      'mechanism is present and mis-tuned, which is a different fix from an absent one but ' +
      'is not a fix yet.'
  )
} else {
  const perSession = totalPopUps / (REPLAYS_PER_CELL * SLICE11_GOALS.length * SESSIONS.length)
  const highShare = totalPopUpsHigh / totalPopUps
  say(
    'Pop-ups happen, so the goal now names a failure the hitter can actually commit: ' +
      `${perSession.toFixed(2)} per session averaged across every goal, ${howOftenSeen(totalPopUps / swingsTotal)}, and a count the ` +
      'coach can coach against rather than a permanent zero.'
  )

  // A SHARE NEEDS ENOUGH EVENTS UNDER IT TO BE A SHARE. Off 119 pop-ups this
  // reported "the five hold 13.4% to 24.4% of them each", a spread that is
  // entirely the shuffling of a few dozen events between goals. Both the
  // concentration sentence and the high-pitch sentence below are held back
  // until there is a sample worth quoting.
  if (totalPopUps < POP_UP_SAMPLE_FLOOR) {
    say(
      `There are only ${swingCountPhrase(totalPopUps)} with a pop-up in the whole run, which is under the ` +
        `${POP_UP_SAMPLE_FLOOR.toLocaleString()} this report wants before it splits them by goal or by pitch height. Those two ` +
        'breakdowns are skipped rather than quoted off a handful of events.'
    )
  } else {
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
      say(
        `They come mostly on ${topGoal.goal.label}, which takes ${pct(topGoal.share)} of every pop-up generated ` +
          `against the ${pct(evenShare)} an even split would give it.`
      )
    } else {
      // THE FAILED THRESHOLD IS NOT A FINDING. This used to assert a positive
      // conclusion out of a negative test: on a fixture where Power produced
      // four times as many pop-ups as any other goal and held 34.4% of them,
      // missing the concentration threshold by a tenth of a point, it printed
      // "this is a whole-generator behaviour rather than something one goal
      // does". The band is wide, not a knife edge, so the number is printed
      // and left to speak.
      say(
        `Spread across the goals, the five hold ${pct(bottomGoal.share)} to ${pct(topGoal.share)} of them each, against the ` +
          `${pct(evenShare)} an even split would give. The widest of those, ${topGoal.goal.label}, is under the ` +
          `${POP_UPS_CONCENTRATED_AT} times an even share this report needs before it says they come mostly from one goal, ` +
          'so no such claim is made here either way.'
      )
    }

    // The share of high pitches, the null this is read against, is measured in
    // section 2 above. BOTH SIDES OF THE FACTOR ARE TESTED: a link that runs
    // backwards, with pop-ups AVOIDING high pitches, is the same sign error
    // section 1 exists to catch on the exit velocity side, and it used to fall
    // into the "constants are wrong" branch where it reads as a mis-tuning
    // rather than as a reversal.
    const highPitchShare = counterShare(allHeights, (v) => v >= STRIKE_ZONE.heightMax)
    const highPitchLink = ratioVerdict(highShare, highPitchShare, POP_UP_LIFT_FACTOR)
    const facts =
      `${pct(highShare)} of them are on pitches at or above the top of the zone, against ` +
      `${pct(highPitchShare)} of pitches being that high in the first place. `
    if (highPitchLink === 'incomparable' || highPitchShare === 0) {
      say(
        `${pct(highShare)} of them are on pitches at or above the top of the zone, but no pitch anywhere ` +
          'was thrown that high, so there is nothing to read that against.'
      )
    } else if (highPitchLink === 'above') {
      say(
        `${facts}That is ${(highShare / highPitchShare).toFixed(1)} times what chance alone would give, which is the ` +
          'mechanism this was bought for: a hitter getting under a high pitch.'
      )
    } else if (highPitchLink === 'below') {
      say(
        `${facts}THE LINK RUNS BACKWARDS: pop-ups are ${(highPitchShare / highShare).toFixed(1)} times LESS likely on a high ` +
          'pitch than chance alone would give, so whatever produces them is avoiding the ' +
          'high pitch rather than coming off it. That is a sign error rather than a ' +
          'mis-tuning.'
      )
    } else {
      say(
        `${facts}That is ${(highShare / highPitchShare).toFixed(1)} times what chance alone would give, inside the ` +
          `${POP_UP_LIFT_FACTOR} times this report treats as a real link, so pop-ups are not coming off high ` +
          'pitches and the constants are wrong.'
      )
    }
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
    // Bare monotonicity again, unreported but the same class as sections 3 and
    // 8: three shares climbing by a thousandth of a point would have earned
    // "lifted toward that value session by session". Floored on the same
    // half-a-point A_REAL_SPREAD the rest of this file uses for rates.
    const climbFloor = floorForRate(
      average(bySession.map((b) => b.share)),
      REPLAYS_PER_CELL * 15,
      A_REAL_SPREAD
    )
    const climbTrend = trendVerdict(bySession.map((b) => b.share), climbFloor)
    const climbs = climbTrend.direction === 'up' && climbTrend.everyStep
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

// THREE GROUPS, NOT TWO, BECAUSE A STRICT COMPARISON IS NOT A VERDICT. An edge
// holding 5.00% against 4.99% just inside it was called a pile-up. The test is
// now a ratio, which is the right shape here because both quantities can be
// tiny or large depending on the scale the generator runs at, and it has a
// third answer for an edge that is level with the value beside it. Unreported,
// found by auditing every verdict in the file rather than by a review finding
// the next one.
//
// There is no group for an edge holding nothing: an edge is by definition a
// value the generator reached, so it can never hold nothing.
// THE POOLED HALF GETS THE ABSOLUTE PARTNER TOO, one scope up from the per-cell
// half. It had the relative test only, so on a curve saturating at 28.4 degrees
// it printed "NOT ONE of the 4 edges carries a pile-up ... that is the result
// this section exists to check for" while 11.62% of every swing generated sat
// on one launch angle, with the paragraph immediately beneath it finding 15 of
// 15 cells carrying a flat row.
//
// The absolute test transfers cleanly because the pooled distribution is a
// mixture of charts, so a pooled share still converts to swings on a chart:
// 11.62% is 1.7 swings on a typical chart drawn from that mixture. What a
// pooled share cannot say is how those are spread ACROSS charts, which is
// exactly what the per-cell paragraph beneath answers, and the prose now points
// at it rather than leaving the two scopes to be reconciled by the reader.
const edgeFlatRow = (e) => flatRowVerdict(e.share, e.insideShare)
const pileUpEdges = edges.filter((e) => edgeFlatRow(e).flatRow).sort((a, b) => b.share - a.share)
const quietEdges = edges.filter((e) => !edgeFlatRow(e).flatRow)
const levelEdges = quietEdges.filter((e) => edgeFlatRow(e).relative === 'level').sort((a, b) => b.share - a.share)
const thinningEdges = quietEdges.filter((e) => edgeFlatRow(e).relative === 'below').sort((a, b) => b.share - a.share)

console.log('')
console.log('  Pooled across every goal and session number:')
if (pileUpEdges.length === 0) {
  say(
    `NOT ONE of the ${edges.length} edges carries a pile-up. ` +
      (levelEdges.length === 0
        ? 'On every one of them materially fewer swings sit on the last value than on the value just inside it, which is what an ordinary tail does,'
        : `${thinningEdges.length} of them ${thinningEdges.length === 1 ? 'thins' : 'thin'} out into the last value and ${levelEdges.length} ${levelEdges.length === 1 ? 'sits' : 'sit'} level with the value beside it, neither of which is a stack,`) +
      ` and none of them holds as much as ${pct(A_FLAT_ROW_SHARE)} of every swing on its own. That is ` +
      'the result this section exists to check for, not a missing table. It is a ' +
      'statement about the pooled heap, though. How a pile is spread across the ' +
      'individual charts is the paragraph below, and the two scopes can disagree.'
  )
} else {
  for (const e of pileUpEdges) {
    const relativeHalf = edgeFlatRow(e).stacksRelative
      ? `${shareCell(e.share, e.onIt)} of every swing on that one value against ${shareCell(e.insideShare, e.insideOnIt)} just inside it, so something is parking there whatever would have gone ${e.beyond} it`
      : `${shareCell(e.share, e.onIt)} of every swing on that one value, which is ${(e.share * SWINGS_PER_SESSION).toFixed(1)} on a typical chart. It does not beat the ${shareCell(e.insideShare, e.insideOnIt)} just inside it, so this is a pile spread across the top few values rather than parked against one`
    say(
      `The ${e.name} reached, ${e.where}, carries a pile-up: ${relativeHalf}. A visitor would see ` +
        `one ${howOftenSeen(e.share)}.`
    )
  }
  if (thinningEdges.length > 0) {
    const shares = thinningEdges.map((e) => shareCell(e.share, e.onIt))
    say(
      `${thinningEdges.length === 1 ? 'One edge is an ordinary tail' : `${thinningEdges.length} edges are ordinary tails`}: ` +
        `${thinningEdges.map((e) => e.name).join(', ')}, holding ${shares[shares.length - 1]} to ${shares[0]} ` +
        'of swings, materially fewer in each case than the value just inside.'
    )
  }
  if (levelEdges.length > 0) {
    say(
      `${levelEdges.length === 1 ? 'One edge is level' : `${levelEdges.length} edges are level`} with the value beside ` +
        `it: ${levelEdges.map((e) => e.name).join(', ')}, holding within ${A_PILE_UP_RATIO} times the value just ` +
        'inside either way, which is neither a pile-up nor a tail thinning out.'
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
    return flatRowVerdict(
      counterShare(counter, (v) => v === at),
      counterShare(counter, (v) => v === at + step)
    ).flatRow
  })
const pilingCells = SLICE11_CELLS.filter(cellPilesUpAnywhere)
// Which of the two tests each piling cell fired, so the sentence below can say
// what kind of finding this is rather than lumping them together.
const cellFlatRowReasons = new Set(
  pilingCells.flatMap((c) =>
    [
      [c.laCounter, -1],
      [c.laCounter, +1],
      [c.evCounter, -1],
      [c.evCounter, +1],
    ]
      .map(([counter, step]) => {
        const at = step < 0 ? counterMax(counter) : counterMin(counter)
        return flatRowVerdict(
          counterShare(counter, (v) => v === at),
          counterShare(counter, (v) => v === at + step)
        )
      })
      .filter((v) => v.flatRow)
      .map((v) => v.why)
  )
)
// A lowercase clause, because it is joined onto the sentence above it after a
// comma rather than starting one.
const flatRowReasonPhrase = () => {
  const relative = cellFlatRowReasons.has('relative') || cellFlatRowReasons.has('both')
  const absolute = cellFlatRowReasons.has('absolute') || cellFlatRowReasons.has('both')
  const onItsOwn =
    `holding at least ${pct(A_FLAT_ROW_SHARE)} of the cell's swings on one value, which is ` +
    `${A_FLAT_ROW_PER_SESSION} of a swing on every chart`
  if (relative && absolute) {
    return `some holding more swings than the value just inside them and some ${onItsOwn}`
  }
  if (relative) return 'each holding more swings than the value just inside it'
  return `none of them beating the value just inside it, but each ${onItsOwn}`
}
console.log('')
console.log('  Taken one cell at a time, which is what a visitor actually looks at:')
if (pilingCells.length === 0) {
  say(
    `none of the ${SLICE11_CELLS.length} goal-and-session combinations piles up on any of its own four edges. No ` +
      'edge value holds more than the value just inside it, and none holds as much as ' +
      `${pct(A_FLAT_ROW_SHARE)} of its cell on its own, which is ${A_FLAT_ROW_PER_SESSION} of a swing on every chart. So no chart this ` +
      'generator can draw carries a flat row of dots along an edge.'
  )
} else {
  const pilingGoals = [...new Set(pilingCells.map((c) => SLICE11_GOALS.find((g) => g.id === c.goalId).label))]
  say(
    `${pilingCells.length} of the ${SLICE11_CELLS.length} goal-and-session combinations pile up on at least one of ` +
      `their own four edges, across ${pilingGoals.length === 1 ? 'one goal' : `${pilingGoals.length} goals`}: ${pilingGoals.join(', ')}, ` +
      `${flatRowReasonPhrase()}. Each of those is a chart a visitor can be shown with a flat ` +
      'row of dots along one edge of it.'
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
console.log(`  The generator also DECLARES four limits: a launch angle of ${GENERATOR_CLAMPS.launchAngle.min} to`)
console.log(`  ${GENERATOR_CLAMPS.launchAngle.max} degrees and an exit velocity of ${GENERATOR_CLAMPS.exitVelocity.min} to ${GENERATOR_CLAMPS.exitVelocity.max} mph, imported from the`)
console.log('  generator rather than copied here.')
// THE SENTENCE BELOW IS CONDITIONAL, AND IT USED TO BE UNCONDITIONAL. It said
// "since Task 6 they are approached rather than parked on" whatever the run had
// actually measured, which is a claim about the generator printed without
// consulting it. Restore hard clamps in a future task and it would have gone on
// saying so, in silence: tested rather than reasoned about, by restoring them in
// an isolated copy and re-running this script. Nothing else in the report caught
// it either. The pile-up table beneath does not, because it catches a clamp that
// BINDS and today's limits sit so far outside this hitter that a clamp there
// barely binds; both headline sentences still reported clean, and the only thing
// that moved was the "4 of them hold nothing" count below becoming "1 of them
// holds", which is legible only to a reader who already knew to expect 4.
//
// So it is printed off `deadLimits` now, and the condition is ALL FOUR of them
// rather than at least one, which is not the obvious version and is the one that
// works. Measured, by restoring hard clamps here and re-running: three of the
// four limits start holding swings and the fourth, the launch angle ceiling of
// 50, still holds nothing, because a hard clamp there binds at the top of the
// pop-up band instead. So `deadLimits.length > 0` stays true and the false
// sentence goes on printing. The claim is about all four limits, so it is
// printed only when all four are dead. The disclosure that named this exposure
// is deleted rather than reworded.
//
// Calibrate it honestly, though: restoring hard clamps at TODAY'S values would
// be nearly harmless, because they hold almost nothing. The clamp this slice
// removed was at 35 degrees, sitting on top of the distribution, and that one
// lights the table up loudly. This is about a committed claim staying checkable,
// not about a live hazard.
if (deadLimits.length === declaredLimits.length) {
  console.log('  Since Task 6 they are approached rather than parked on, so a limit holding')
  console.log('  nothing is the intended result and not a sign that this report is describing')
  console.log('  the wrong generator.')
}
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
// THE THREE-WAY VERDICT IS CARRIED THROUGH RATHER THAN COLLAPSED BACK TO TWO.
// This was `ratioVerdict(...) === 'above'`, a boolean, so 'level' (a ratio
// anywhere from 1.00 to A_PILE_UP_RATIO) fell through and printed the 'below'
// prose. Under soft compression that put "Fewer swings on the last value than
// on the one below it" directly under "34.58% of swings sit exactly on 28,
// against 30.46% on 27", and contradicted the pooled half of this same section
// eleven lines earlier, which had handled 'level' correctly.
const worstCellFlatRow = flatRowVerdict(worstCeilingCell.share, worstCeilingInside)
console.log('')
console.log(
  `  It shows up most on ${worstCeilingLabel} session ${worstCeilingCell.c.sessionNum}: ` +
    `${shareCell(worstCeilingCell.share, Math.round(worstCeilingCell.share * counterTotal(worstCeilingCell.c.laCounter)))} of swings sit`
)
console.log(`  exactly on ${laCeiling}, against ${pct2(worstCeilingInside)} on ${laCeiling - 1}.`)
// Two findings, said apart. "More than the value below it" and "a large share
// of the chart on one value" are different things and either one is a flat row.
const relativeClause =
  worstCellFlatRow.relative === 'above'
    ? 'More swings on the last value than on the one below it'
    : worstCellFlatRow.relative === 'below'
      ? 'Fewer swings on the last value than on the one below it'
      : `Within ${A_PILE_UP_RATIO} times the value below it either way, so neither clearly more nor clearly fewer`
if (worstCellFlatRow.flatRow) {
  const because =
    worstCellFlatRow.why === 'relative'
      ? `${relativeClause}, in that cell: that is the flat row of dots`
      : worstCellFlatRow.why === 'both'
        ? `${relativeClause}, and that one value holds ${shareCell(worstCeilingCell.share, 1)} of the cell on its own, which is ${(worstCeilingCell.share * SWINGS_PER_SESSION).toFixed(1)} swings on every chart: that is the flat row of dots`
        : `${relativeClause}. But that one value still holds ${shareCell(worstCeilingCell.share, 1)} of the cell on its own, which is ${(worstCeilingCell.share * SWINGS_PER_SESSION).toFixed(1)} swings on every chart, so it is a flat row of dots whatever its neighbour does`
  say(`${because}, on a chart every visitor who picks that goal can see.`)
} else {
  say(
    `${relativeClause}, in that cell, and that value holds ${shareCell(worstCeilingCell.share, 1)} of the cell, ` +
      `under the ${pct(A_FLAT_ROW_SHARE)} this report treats as a row on its own. No flat row there, ` +
      'whatever the pooled edge table above says.'
  )
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
console.log('')

// THIS SECTION USED TO PRINT THE TABLE AND SAY NOTHING AT ALL, which made it
// the one defect of the eight with no verdict anywhere in the report. On a
// fixture where 71.2% of generated sessions beat session 1's frozen top ball
// it printed these six columns and stopped.
//
// THE UNIT IS A VISITOR, NOT A SESSION, and that is what makes the threshold a
// derivation rather than a pick. The app offers a visitor exactly the sessions
// in SESSIONS, so the question the share answers is how likely one visitor is
// to be shown at least one session claiming the hitter got faster. That is one
// minus the chance every one of their sessions stays inside the frozen number.
// The boundary is a half, because a majority of visitors seeing it or not
// seeing it is the split a person can act on; the low end reuses the same one
// in twenty this report already calls reliable elsewhere.
// PER GOAL, NOT POOLED, because a visitor holds one goal for all three
// sessions and never sees the pooled mixture at all. The pooled figure of
// 51.8% carried a verdict, "More visitors than not are therefore shown", that
// was false for three of the five goals a visitor can actually pick: 48.3% on
// Open Session, 48.7% on Reduce Pop-Ups and 49.0% on Hit to All Fields against
// 53.4% on Contact and 59.0% on Power. It also dropped the condition the
// measurement sentence above it correctly carries, since a visitor who opens
// one session rather than all three sits far lower.
//
// THE UNIT IS A VISITOR, AND THAT IS WHAT MAKES THE THRESHOLD A DERIVATION
// RATHER THAN A PICK. The app offers a visitor exactly the sessions in
// SESSIONS, all on the one goal they chose, so the question the share answers
// is how likely that visitor is to be shown at least one session claiming the
// hitter got faster: one minus the chance every one of their sessions stays
// inside the frozen number. The boundary is a half, because a majority of
// visitors seeing it or not is the split a person can act on; the low end
// reuses the same one in twenty this report already calls reliable elsewhere.
const A_MAJORITY_OF_VISITORS = 0.5
const visitorSeesFasterOn = (goalId) =>
  1 -
  SESSIONS.reduce(
    (chance, sessionNum) =>
      chance * (1 - counterShare(cell(sessionNum, goalId).topEvCounter, (v) => v > SESSION_ONE.topEv)),
    1
  )
const visitorByGoal = SLICE11_GOALS.map((goal) => ({ goal, rate: visitorSeesFasterOn(goal.id) })).sort(
  (a, b) => b.rate - a.rate
)
const visitorHigh = visitorByGoal[0]
const visitorLow = visitorByGoal[visitorByGoal.length - 1]
const goalsOverHalf = visitorByGoal.filter((g) => g.rate >= A_MAJORITY_OF_VISITORS)
// A range with no width is not a range, the same guard section 9 already
// carries for its any-column rates.
const visitorRangePhrase =
  visitorHigh.rate - visitorLow.rate < A_REAL_SPREAD
    ? `${pct(visitorHigh.rate)} of the time, within half a point of that on every one of the ${SLICE11_GOALS.length} goals`
    : `between ${pct(visitorLow.rate)} of the time on ${visitorLow.goal.label} and ${pct(visitorHigh.rate)} on ${visitorHigh.goal.label}`
say(
  `A visitor holds one goal for all three sessions, so the number that matters is per goal ` +
    `rather than pooled. Clicking through all ${SESSIONS.length} generated sessions on one goal, a visitor ` +
    `is shown at least one that beats ${SESSION_ONE.topEv} mph ${visitorRangePhrase}.`
)
if (goalsOverHalf.length === SLICE11_GOALS.length) {
  say(
    `On every one of the ${SLICE11_GOALS.length} goals a visitor can pick, more of them than not are shown a ` +
      'session claiming this hitter got faster than the fifteen swings the whole demo is ' +
      'built off, which is a number session 1 freezes on purpose.'
  )
} else if (goalsOverHalf.length > 0) {
  say(
    `On ${goalsOverHalf.length} of the ${SLICE11_GOALS.length} goals, more visitors than not are shown a session claiming this ` +
      `hitter got faster than the number session 1 freezes: ${goalsOverHalf.map((g) => g.goal.label).join(', ')}. ` +
      `On the other ${SLICE11_GOALS.length - goalsOverHalf.length} it is a large minority rather than a majority. Read the range, not one ` +
      'figure: pooling the five gives a number no visitor is ever exposed to.'
  )
} else if (visitorHigh.rate < FILLS_RELIABLY_BELOW) {
  say(
    `Even on the worst goal that is under the ${pct(FILLS_RELIABLY_BELOW)} this report treats as reliable ground, so ` +
      'a session claiming he got faster is something a visitor essentially never meets.'
  )
} else {
  say(
    `On no goal does that reach the ${pct(A_MAJORITY_OF_VISITORS)} that would make it more visitors than not, and on ` +
      `none is it under the ${pct(FILLS_RELIABLY_BELOW)} that would make it essentially never, so it happens to a ` +
      'minority of visitors on every goal and this report draws no stronger conclusion.'
  )
}

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
  // Was a hardcoded 0.1, which is A_REAL_GAP_MPH written out a second time.
  // Same quantity, same units, same meaning: a difference in mean exit velocity
  // too small for anyone to care about.
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
  // A strict comparison again: the re-rolled group sitting a thousandth of a
  // mile an hour above the plain group would have earned "having a target band
  // is not what lifts the number". Floored on the same tenth of a mile an hour
  // section 1 uses, which is the same quantity in the same units.
  if (lowestReRolled - highestPlain >= A_REAL_GAP_MPH) {
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
//
// THE TREND HALF THEN NEEDED A FLOOR, WHICH IS THE WORSE OF THE TWO FAULTS AND
// THE LAST ONE FOUND. It was bare monotonicity, so it was decided by sampling
// noise and FLIPPED WITH THE SEED: on a generator where spray had been taken
// off the shrinking variance factor, which is the fix this section exists to
// measure, the rate sat flat at about 69% and six of sixteen seeds printed a
// directional verdict, three saying the demo gets worse and three saying it
// gets better. The defect this slice fixes would have been reported as still
// present about a third of the time. This file's own header says a finding that
// does not survive a seed change is sampling noise being read as a result.
const barBySession = SESSIONS.map((s) => cell(s, 'allfields').allFieldsBarRate)
const barTrendFloor = floorForRate(average(barBySession), REPLAYS_PER_CELL, A_REAL_SPREAD)
const barTrend = trendVerdict(barBySession, barTrendFloor)
const barRates = barBySession.map((r) => pct(r)).join(', ')
if (barTrend.direction === 'down') {
  say(
    'A visitor who picks this goal and clicks through the sessions watches the demo get ' +
      `worse at the very thing the goal asks for, ${pct(barBySession[0])} down to ` +
      `${pct(barBySession[barBySession.length - 1])}${barTrend.everyStep ? ', falling on every session' : ''}.`
  )
} else if (barTrend.direction === 'up') {
  say(
    'A visitor who picks this goal and clicks through the sessions watches the demo get ' +
      `better at the thing the goal asks for, ${pct(barBySession[0])} up to ` +
      `${pct(barBySession[barBySession.length - 1])}${barTrend.everyStep ? ', rising on every session' : ''}.`
  )
} else {
  say(
    `Across sessions 2 to 4 that rate runs ${barRates}, a move of ` +
      `${pct(noNegativeZero(barTrend.change, 3))} across the three, under the ${pct(barTrendFloor)} this report treats as a ` +
      'real move. A visitor clicking through sees no trend either way.'
  )
}
console.log('')
if (Math.max(...barBySession) < BAR_RARELY_MET) {
  say(
    `Read that beside the level, though. The bar is met on under ${pct(BAR_RARELY_MET)} of sessions at every ` +
      'session number, so it is one this generator essentially never clears, whichever way ' +
      'the rate is moving. A goal that asks for something its own data almost never delivers ' +
      'is a worse result than a falling rate, not a better one.'
  )
} else if (Math.min(...barBySession) > BAR_USUALLY_MET) {
  say(
    `And the level is high: over ${pct(BAR_USUALLY_MET)} at every session number, so a visitor who picks ` +
      'this goal is shown a session that meets it almost every time.'
  )
} else {
  // Neither threshold fires, so the level is stated plainly rather than left to
  // the table. Without this a flat middling rate got a trend verdict and no
  // level verdict, which is the shape that made the seed flip so easy to miss.
  say(
    `The level sits between ${pct(Math.min(...barBySession))} and ${pct(Math.max(...barBySession))} at every session number: ` +
      `above the ${pct(BAR_RARELY_MET)} this report calls essentially never met and below the ` +
      `${pct(BAR_USUALLY_MET)} it calls met almost every time.`
  )
}

// --- 9. The regression guards ----------------------------------------------

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
// A GOAL ONLY RUNS OUT OF A COLUMN IT ACTUALLY RUNS OUT OF. `worstColumnOf` had
// no floor under it: with all five columns empty on 0.0% of sessions it still
// returned a column and the report announced which kind of ball every goal runs
// out of. The floor is the one this section already uses for the same question
// four paragraphs down, `FILLS_RELIABLY_BELOW`: a column empty on under one
// session in twenty is a column the generator fills.
// Two tests, not one, and WHICH ONE FAILED IS CARRIED OUT rather than folded
// into an "or". The column has to be materially empty at all, and it has to be
// materially the worst: a goal failing two columns equally does not run out of
// one kind of ball, and picking whichever sorted first would manufacture the
// two-group, opposite-ends story out of a tie.
//
// The reason matters because the first draft of this reported both as one
// sentence, "nothing is empty on as much as 5.0% of sessions, or nothing is 1.2
// times worse than the next column along", printed over a table with three
// columns empty on 100.0% of sessions. The first half was flatly false there;
// it was the tie that stopped the grouping.
const worstColumnOf = (cells) => {
  const means = DISTANCE_BUCKETS.map((_, i) => average(cells.map((c) => c.bucketEmptyRates[i])))
  const ranked = means.map((mean, column) => ({ mean, column })).sort((a, b) => b.mean - a.mean)
  const [worst, runnerUp] = ranked
  if (worst.mean < FILLS_RELIABLY_BELOW) return { column: null, reason: 'nothing-empty', worst }
  if (ratioVerdict(worst.mean, runnerUp.mean, A_PILE_UP_RATIO) !== 'above') {
    return { column: null, reason: 'tied', worst, runnerUp }
  }
  return { column: worst.column, reason: 'fails', worst }
}
const goalWorstColumn = SLICE11_GOALS.map((goal) => ({
  goal,
  cells: SLICE11_CELLS.filter((c) => c.goalId === goal.id),
})).map((g) => ({ ...g, ...worstColumnOf(g.cells) }))
const goalsWithNoFailingColumn = goalWorstColumn.filter((g) => g.column === null)
const goalsNothingEmpty = goalsWithNoFailingColumn.filter((g) => g.reason === 'nothing-empty')
const goalsTied = goalsWithNoFailingColumn.filter((g) => g.reason === 'tied')
// One phrase per reason, so a sentence never offers a reader two explanations
// and leave them to guess which one is true of the run in front of them.
const whyNoColumn = (goals) =>
  goals === goalsNothingEmpty || goals.every((g) => g.reason === 'nothing-empty')
    ? `nothing on ${goals.length === 1 ? 'it' : 'them'} is empty on as much as ${pct(FILLS_RELIABLY_BELOW)} of sessions`
    : goals.every((g) => g.reason === 'tied')
      ? `no single column is ${A_PILE_UP_RATIO} times worse than the next one along, so naming one kind of ball would be picking a winner out of a tie`
      : `some have nothing empty on as much as ${pct(FILLS_RELIABLY_BELOW)} of sessions and the rest have no column ${A_PILE_UP_RATIO} times worse than the next`
const columnGroups = [...new Set(goalWorstColumn.filter((g) => g.column !== null).map((g) => g.column))]
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

// A returned value nobody reads is the sort of thing a later session mistakes
// for a working signal, so the goals that came out of the grouping with no
// failing column are reported rather than dropped.
const reportUnassigned = () => {
  if (goalsWithNoFailingColumn.length === 0) return
  console.log('')
  say(
    `${goalsWithNoFailingColumn.length === SLICE11_GOALS.length ? 'Every goal' : goalsWithNoFailingColumn.map((g) => g.goal.label).join(', ')} ` +
      `${goalsWithNoFailingColumn.length === 1 ? 'has' : 'have'} no column to run out of: ` +
      `${whyNoColumn(goalsWithNoFailingColumn)}.`
  )
}

if (columnGroups.length === 0) {
  say(
    `No goal runs out of any column: ${whyNoColumn(goalsWithNoFailingColumn)}. So there is no ` +
      'failure here to have a direction, and the two tables above are the whole answer.'
  )
} else if (columnGroups.length === 1) {
  const only = columnGroups[0]
  const range = rangeOf(groupCells(only), only.column)
  // "The same one everywhere" is only true when the one group holds every goal.
  // A fixture where four of five goals were tied and the fifth was not printed
  // "it is the same one everywhere. Power & Distance runs out of ...".
  const everywhere = only.goals.length === SLICE11_GOALS.length
  say(
    (everywhere
      ? 'One failure, not two, and it is the same one everywhere. '
      : `One failure, on ${swingCountPhrase(only.goals.length).replace(' swing', ' goal')} of the ${SLICE11_GOALS.length}. `) +
      `${startSentence(groupNames(only))} ${groupVerb(only, 'runs', 'run')} out of ` +
      `${everywhere ? 'the same kind of ball' : 'one kind of ball'}: the "${bucketHeaders[only.column]}" ` +
      `column, empty on ${pct(range.lo)} to ${pct(range.hi)} of sessions. There is no ` +
      'opposite-ends story to tell here.'
  )
  reportUnassigned()
} else {
  const columnsHit = columnGroups.map((g) => g.column)
  const atOppositeEnds =
    columnsHit.includes(0) && columnsHit.includes(DISTANCE_BUCKETS.length - 1)
  // "None of them is visible in a pooled number" was a claim about this run
  // that nothing checked, and it printed above a pooled any-column figure of
  // 100.0%. What is always true, and is a fact about the arithmetic rather than
  // about the data, is that a count of empty columns treats every column alike.
  say(
    `${columnGroups.length} different failures, ` +
      (atOppositeEnds ? 'at opposite ends of the chart' : 'in different places on the chart') +
      '. A count of how many columns came up empty treats every column the same way, so it ' +
      'cannot tell these apart whatever it reads.'
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

  reportUnassigned()

  // The comparison runs between the two groups that most goals fall into, and
  // only when there are exactly two. With three or more there is no "own end
  // against the other end" to measure, and the ranges above already say it.
  if (columnGroups.length === 2) {
    const [a, b] = columnGroups
    const aRange = { own: rangeOf(groupCells(a), a.column), other: rangeOf(groupCells(a), b.column) }
    const bRange = { own: rangeOf(groupCells(b), b.column), other: rangeOf(groupCells(b), a.column) }
    console.log('')
    // "NEITHER SET IS FREE OF THE OTHER'S PROBLEM" IS ITSELF A CLAIM, and on a
    // fixture where each set never once left the other's column empty it was
    // printed straight over two rates of 0.0%. The lead clause is now picked
    // from the same two cross-rates the sentence goes on to quote.
    const aFree = aRange.other.hi < FILLS_RELIABLY_BELOW
    const bFree = bRange.other.hi < FILLS_RELIABLY_BELOW
    const lead =
      aFree && bFree
        ? 'Each set is clean at the other end, which is worth saying because it usually is not:'
        : aFree || bFree
          ? 'One set is clean at the other end and one is not:'
          : "Neither set is free of the other's problem, and it would be wrong to say otherwise:"
    say(
      `${lead} ` +
        `${groupNames(a)} ${groupVerb(a, 'leaves', 'leave')} "${bucketHeaders[b.column]}" empty on ` +
        `${pct(aRange.other.lo)} to ${pct(aRange.other.hi)} of sessions${aFree && bFree ? '' : ' too'}, and ${groupNames(b)} ` +
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
    // THE ZERO DENOMINATOR WAS GUARDED AND THE RATIO ITSELF WAS NOT, so a cell
    // with both columns empty on 100% of sessions printed "1.0 times worse at
    // its own end", which is a phrase that means the opposite of what it says.
    // Same family as the "0.0 times" and "Infinity times" already fixed.
    const timesWorse = (own, other) => {
      if (!(own > 0) && !(other > 0)) return 'no worse at its own end, since neither column ever comes up empty'
      if (!(other > 0)) return 'worse at its own end by any margin you like, the other column never coming up empty at all'
      if (!(own > 0)) return 'not worse at its own end at all: that column never comes up empty while the other one does'
      const verdict = ratioVerdict(own, other, A_PILE_UP_RATIO)
      if (verdict === 'above') return `${(own / other).toFixed(1)} times worse at its own end`
      if (verdict === 'below') return `${(other / own).toFixed(1)} times worse at the OTHER end, which is the wrong way round for a set defined by this column`
      return 'no worse at its own end than at the other, the two being within ' + `${A_PILE_UP_RATIO} times of each other`
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
// "NO GOAL IS CLEAN" WAS TYPED, and it could contradict the paragraph four
// lines above it: a run where some cells fill reliably would print "for those
// this is ground the generator holds" and then this. Counted now, against the
// same floor that paragraph uses.
say(
  `at least one empty column on between ${pct(Math.min(...anyEmptyRates))} and ${pct(Math.max(...anyEmptyRates))} of sessions. ` +
    (cellsFillingReliably.length === 0
      ? `Not one of the ${SLICE11_CELLS.length} combinations is clean, so this is not one goal misbehaving.`
      : cellsFillingReliably.length === SLICE11_CELLS.length
        ? `Every one of the ${SLICE11_CELLS.length} combinations is under the ${pct(FILLS_RELIABLY_BELOW)} this report calls reliable, so none of them is misbehaving.`
        : `${cellsFillingReliably.length} of the ${SLICE11_CELLS.length} combinations are under the ${pct(FILLS_RELIABLY_BELOW)} this report calls reliable and ${SLICE11_CELLS.length - cellsFillingReliably.length} are not, so this is neither clean nor one goal misbehaving.`)
)
console.log('')
const bestAny = SLICE11_CELLS.slice().sort((a, b) => a.anyEmptyColumnRate - b.anyEmptyColumnRate)[0]
const bestAnyLabel = SLICE11_GOALS.find((g) => g.id === bestAny.goalId).label
const anyEmptyFloor = floorForRate(average(anyEmptyRates), REPLAYS_PER_CELL, A_REAL_SPREAD)
if (Math.max(...anyEmptyRates) - Math.min(...anyEmptyRates) < anyEmptyFloor) {
  console.log(`  That range has no width to it: every one of the ${SLICE11_CELLS.length} combinations sits within`)
  console.log(`  ${pct(anyEmptyFloor)} of ${pct(average(anyEmptyRates))}, so there is no worst goal and no best one to`)
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
// A run where no goal has a failing column has no column for the guard to name,
// which is the state this slice is working toward and used to crash here. The
// guard is still stated, because it is a decision that outlives any one run;
// what it cannot do is name a column off an empty grouping.
if (columnGroups.length > 0) {
  const biggest = columnGroups[0]
  say(
    'That is the whole reason this is reported per column. The guard Slice 11 agreed to ' +
      `hold, decided from numbers like these: the "${bucketHeaders[biggest.column]}" column on ` +
      `${groupNames(biggest)} must not get materially emptier than it already is, and a ` +
      'pooled figure cannot answer that question at all.'
  )
} else {
  // NOT "the guard being passed". A run where every column is empty on every
  // session also produces no group, and calling that a pass would be the
  // largest all-clear this report could print. What is true is that the guard
  // has no column to aim at, and why.
  say(
    'That is the whole reason this is reported per column. The guard Slice 11 agreed to ' +
      'hold is that the column a set of goals runs out of must not get materially emptier ' +
      `than it already is. It has nothing to aim at on this run, because ${whyNoColumn(goalsWithNoFailingColumn)}. ` +
      'Read that against the two tables above rather than as an all-clear: a generator ' +
      'that fills every column and one that empties them all equally both land here.'
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
  [2, 'No real thrower misses on both axes at once; a pitch that misses low while staying plausible sideways is what a real thrower produces; and a share in between means the defect is reduced rather than removed. All three branches, because the rewrite is meant to move which one prints.'],
  [2, 'Missing by a good deal MORE than session 1 is wild, and missing by a good deal LESS is its own kind of wrong, because a pitcher that accurate gives the hitter nothing to lay off. Both halves.'],
  [2, 'A pitch low enough to bounce in front of the plate, or high enough to sail over it, is a defect rather than a hard pitch to hit. Both ends.'],
  [2, 'How far out a missed pitch was is reported as the worse of its two axes rather than as a diagonal, on the grounds that this is how a person watching would describe it. It is also what reproduces session 1\'s own six misses exactly.'],
  [3, 'A pull lean is the right way round for a high school hitter, an opposite-field lean is backwards, and an even split is not the target either. All three branches of one opinion about baseball.'],
  [3, 'Spray narrowing toward the middle session by session is something no hitter does on his own, so it is a defect; widening is not called one, and a move under the floor is called neither. All three branches.'],
  [4, 'A pop-up is supposed to come off a high pitch, so pop-ups arriving no more often on high pitches than chance would give means the constants are wrong, and pop-ups AVOIDING high pitches means a sign error rather than a mis-tuning. Both halves of the same opinion about what a pop-up is.'],
  [4, 'Pop-ups a visitor would never meet are not a fixed defect, they are a mis-tuned mechanism. That the goal wants a failure the hitter can actually commit is what this slice decided, not something this run measured.'],
  [5, `The flat-row threshold of ${pct(A_FLAT_ROW_SHARE)} rests on two judgments, not one: the anchor, one swing a session, which is a choice inside howOftenSeen's 0.67-to-1.5 band rather than a constant inherited from it, and the half. Both are free. Taking the top of the same band puts the line at 5.0%, above this project's recorded 4.2% first-screen defect, and the precedent check would then fail.`],
  [5, 'Where an edge holds a pile-up, this report says something is parking there whatever would have gone past it. That is a clamp mechanism inferred from a shape, and it is the wrong story for a mis-hit mode that spikes at one isolated value, where nothing would have gone past it at all. The counts are measured; the mechanism behind them is not.'],
  [6, 'Session 1\'s best ball is frozen, so a generated session that beats it is claiming the hitter got faster. That is what this demo decided session 1 is for, not something this run measured; the run only counts how often it is beaten.'],
  [7, 'Every generated session is built off session 1 rather than off the session before it, so the step is the same step every time rather than a run of improvement. That is a fact about what onNewSession in src/App.jsx passes, read from the app rather than from this run.'],
  [7, 'The lift on the re-rolled goals is the re-roll discarding weak sessions. Which goals are lifted and which have an empty band often enough to be re-rolled are both measured here; that a re-roll happens at all, and that it keeps the second attempt whatever it holds, is a fact about src/swingGenerator.js.'],
  [8, 'The bar this section measures, at least 3 swings pull side and at least 3 opposite field, is a sentence hand-copied out of the Hit to All Fields coaching instructions in src/coachApi.js. Reword it there to ask for four and this section goes on measuring three, silently.'],
  [9, 'The eight sections above are the eight things Slice 11 sets out to change, and this one is the ground it must not lose. That is the slice\'s intent. It is not a property of this run, and it stays true whether or not the run still shows a defect.'],
  [9, 'The guard named at the end of the distance-chart tables is a decision taken from numbers like these when they were first read, not a result this run produces. Which column and which goals it names ARE read from this run.'],
  [8, 'A goal getting worse at what it asks for is a defect and getting better is not, and a rate that moves less than the floor is called neither. All three branches.'],
  [9, 'A generated hitter tighter than session 1 is described as something nobody chose. That is an opinion about what this demo is for.'],
  [9, 'Session 1 is the shape the generated sessions are measured against. True by construction while session 1 stays frozen, which Slice 11 does not change.'],
]

// Every value here is read from the constant the branch itself reads, never
// retyped. A threshold printed from a second copy of itself is not a
// disclosure, it is a second thing to keep in step.
const THRESHOLDS_THAT_PICK_A_SENTENCE = [
  [1, `a gap smaller than ${A_REAL_GAP_MPH} mph is no gap at all. The same floor decides the pooled verdict AND whether the five goals agree with it, so the reassurance that the pooled rows hide nothing is tested rather than asserted`],
  [2, `a pitch below ${BOUNCES_BELOW_FEET.toFixed(2)} feet has bounced: the zone floor of ${STRIKE_ZONE.heightMin} less the ${PLAN_MISS_CAP_FEET.toFixed(2)} foot miss this slice's plan allows, so a generator sitting exactly on the plan's floor stays quiet`],
  [2, `a pitch above ${SAILS_ABOVE_FEET.toFixed(2)} feet has sailed: the same cap applied at the zone ceiling of ${STRIKE_ZONE.heightMax}, so both ends of the pitch are checked rather than only the floor`],
  [2, `a near miss is one at or inside session 1's own closest miss of ${SESSION_ONE.misses[0].toFixed(2)} feet`],
  [2, `"every single missed pitch" needs ${pct(BOTH_AXES_IS_EVERY)} of them, which is the WORDING test and not the fix test; whether the both-axes defect is fixed is judged against session 1's own share below`],
  [2, `the generated misses are the same shape as session 1's within ${SESSION_ONE_SHAPE_WITHIN} times its average either way, and outside that in EITHER direction is a finding`],
  [2, `the both-axes share is the same shape as session 1's own ${pct(SESSION_ONE.bothAxesShare)} within the same ${SESSION_ONE_SHAPE_WITHIN} times either way`],
  [3, `a lean either way needs ${A_REAL_LEAN_SWINGS} of the fifteen swings between the two sides`],
  [3, `spray narrowing or widening needs ${A_REAL_LEAN_SWINGS} of a swing of movement across sessions 2 to 4, the same floor as the lean; without it, bare monotonicity called a move of 0.00 swings a narrowing`],
  [4, `pop-ups come "mostly" from one goal when it holds ${POP_UPS_CONCENTRATED_AT} times an even share of them`],
  [4, `the high-pitch link is real at ${POP_UP_LIFT_FACTOR} times the rate chance alone would give, and BACKWARDS at the same factor the other way`],
  [4, `pop-ups are split by goal and by pitch height only above ${POP_UP_SAMPLE_FLOOR.toLocaleString()} of them; below that the breakdowns are skipped rather than quoted off a handful of events`],
  [5, `a value nobody meets is one a visitor would see less than once in ${MEETS_IT_ONCE_IN} sessions`],
  [5, `a single value is a flat row on its own merits at ${pct(A_FLAT_ROW_SHARE)} of a cell, which is ${A_FLAT_ROW_PER_SESSION} of a swing on every chart of ${SWINGS_PER_SESSION}. Derived from the chart rather than picked, with TWO judgments inside it named on the list above, and checked against this project's own recorded 4.2% first-screen defect, which is above the line and therefore fires. It exists because the relative test cannot see a pile spread across the top few values by soft compression`],
  [5, `an edge is a pile-up when it holds ${A_PILE_UP_RATIO} times the value just inside it, a tail when the value inside holds ${A_PILE_UP_RATIO} times the edge, and level in between; a bare "more than" called 5.00% against 4.99% a pile-up`],
  [5, `the Power lift is "session by session" only when its share climbs on every step AND climbs by ${pct(A_REAL_SPREAD)} across the three`],
  [6, `a session beating session 1's frozen top ball is reported against the visitor rather than the session: ${pct(A_MAJORITY_OF_VISITORS)} of visitors makes it more of them than not, and under ${pct(FILLS_RELIABLY_BELOW)} makes it something they essentially never meet`],
  [7, `the empty-band re-roll "bites" above an empty-band rate of ${pct(RE_ROLL_BITES_ABOVE)}`],
  [7, `the re-rolled goals count as lifted above the rest by ${A_REAL_GAP_MPH} mph, the same floor section 1 uses for the same quantity`],
  [8, `the bar is "essentially never met" below ${pct(BAR_RARELY_MET)} and "met almost every time" above ${pct(BAR_USUALLY_MET)}, and stated plainly in between`],
  [8, `the bar's rate has a direction only when it moves ${pct(barTrendFloor)} across sessions 2 to 4, which is whichever is larger of ${pct(A_REAL_SPREAD)} and ${NOISE_SIGMAS} standard errors at this sample size; a flat ${pct(A_REAL_SPREAD)} floor was not enough and the verdict still flipped with the seed`],
  [9, `a column fills reliably when it is empty on under ${pct(FILLS_RELIABLY_BELOW)} of sessions, and a goal only "runs out of" a column that clears the same floor`],
  [9, `the generated spread counts as the same as session 1's within ${pct(SPREAD_COUNTS_AS_SAME_WITHIN)} of it, in either direction`],
  [9, `a range of rates has ends worth naming once they differ by ${pct(anyEmptyFloor)}, again the larger of ${pct(A_REAL_SPREAD)} and ${NOISE_SIGMAS} standard errors at this sample size`],
]

// Numbers this script cannot import and therefore holds its own copy of. Each
// is checked where it can be checked and disclosed where it cannot.
const HAND_COPIES_FROM_THE_APP = [
  `the five goal labels, from GOALS in src/App.jsx, which a plain Node script cannot import because that file contains JSX. Renaming a goal on screen does not rename it here`,
  `NO LONGER A COPY, as of 21 August 2026: the generator's four declared limits, ${GENERATOR_CLAMPS.launchAngle.min} to ${GENERATOR_CLAMPS.launchAngle.max} degrees and ${GENERATOR_CLAMPS.exitVelocity.min} to ${GENERATOR_CLAMPS.exitVelocity.max} mph, are imported from src/swingGenerator.js. They were bare literals there until Task 6 exported them, and the copy that stood here caught a limit moving outward and missed one moving inward. The line is kept rather than deleted so that nobody re-copies them on the strength of an old note`,
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
console.log('  not decide whether the opinion inside is right.')
console.log('')
console.log('  THE RULE FOR WHAT BELONGS ON THIS LIST, written out so the next person')
console.log('  does not have to infer it from the entries. A sentence belongs here if it')
console.log('  states something this script did not count. NOT "does it contain a number')
console.log('  somebody typed": the worst offenders this report has printed carried no')
console.log('  number at all. And where a judgment has more than one branch, EVERY branch')
console.log('  is listed, not only the one that prints today, because the branch that')
console.log('  prints today is exactly the one the rewrite is meant to change.')
console.log('')
printList(JUDGMENTS_NOT_MEASUREMENTS)
console.log('')
console.log('  SECOND, the thresholds. Each of these numbers decides which sentence gets')
console.log('  printed. Move one and this report reaches a different conclusion from the')
console.log('  same data, with every figure in every table still correct.')
console.log('')
console.log('  THE RULE THEY ALL OBEY, which took five rounds of review to arrive at and')
console.log('  is worth stating rather than leaving in the code. Every verdict in this')
console.log('  report, meaning every sentence that says a thing IS so rather than')
console.log('  printing the number and stopping, has a magnitude floor or a relative')
console.log('  threshold under it. A presence test, a strict comparison, or a')
console.log('  monotonicity test is not a verdict, because sampling noise clears all')
console.log('  three and so does a defect that has been reduced by nine tenths and not')
console.log('  removed. And any threshold that can be crossed from either side has both')
console.log('  sides tested and both sides listed here. Where a verdict could not be')
console.log('  given an honest floor it was deleted and the number printed instead.')
console.log('')
console.log('  One thing that rule turned out to need, which is worth knowing before')
console.log('  quoting any floor below. A hand-picked floor means nothing without the')
console.log('  sample size behind it: half a point sounds strict, and on a rate near 69%')
console.log(`  measured over ${REPLAYS_PER_CELL.toLocaleString()} sessions it is about one standard error, so a verdict`)
console.log('  floored at half a point still flipped with the seed on a rate that was not')
console.log('  moving at all. Where a verdict compares two readings of one rate, the floor')
console.log(`  is now the LARGER of the product floor and ${NOISE_SIGMAS} standard errors at this sample`)
console.log('  size, so a change has to be both real and worth reporting.')
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
console.log('')
console.log('THE BOTTOM TWO ROWS ARE NO LONGER THE SLICE 6 GENERATOR. They come')
console.log('from whatever is in the working tree, so since Slice 11 they carry its')
console.log('changes too, and the last row is not "correlation + re-roll" on its own')
console.log('any more. Only the top row is frozen. Read this table as three states of')
console.log("today's generator, not as a Slice 6 before-and-after preserved in amber.")
console.log('='.repeat(78))
console.log('  ' + 'state'.padEnd(46) + SESSIONS.map((s) => `S${s}`.padStart(8)).join(''))
const EMPTY_BAND_ROWS = [
  ['pre-slice generator (independent draws)', contactEmptyRateBefore],
  ['correlation only, re-roll switched off', contactEmptyRateCorrelationOnly],
  ['as this app ships, re-roll included', contactEmptyRateShipped],
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
console.log('Session 2, re-roll switched off on the "after" row.')
console.log('')
console.log('THE "AFTER" ROW IS TODAY\'S GENERATOR, NOT SLICE 6\'S. That sentence used')
console.log('to say the correlation was the only thing that differed between the two')
console.log('rows, and Slice 11 made it untrue: the after row reads from the working')
console.log('tree, so it now carries the pitch link as well. What the two rows still')
console.log('answer together is the question this section was written for, whether the')
console.log('spread has quietly moved, and the answer is what to read off it.')
console.log('='.repeat(78))
const SPREAD_BEFORE_RANDOM = streamFor('spread-pre-slice6|session-2')
const SPREAD_AFTER_RANDOM = streamFor('spread-correlated|session-2')
for (const [label, gen] of [
  ['before (independent draws)', () => oldGenerateSwings(2, mockSwings, SPREAD_BEFORE_RANDOM)],
  [
    'after (today, no re-roll)',
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
