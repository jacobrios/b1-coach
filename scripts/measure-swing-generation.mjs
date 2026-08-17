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
//
// It takes no arguments, replays 20,000 sessions per session-number/goal
// combination, and prints a plain-text report. It takes a few seconds.
//
// WHAT IT COMPARES. Two versions of the generator, side by side, using the
// SAME goal targets and the SAME session-1 baseline the real app uses:
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
const { distanceBucketCounts } = await import('../src/ballFlight.js')
const { SESSION_ONE_SWINGS: mockSwings } = await import('../src/sessionOneSwings.js')

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
  const distances = []
  const evs = []
  const las = []
  const emptyCounts = Object.fromEntries(TARGET_GOALS.map((g) => [g.id, 0]))

  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = oldGenerateSwings(sessionNum, mockSwings, Math.random)
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
  const distances = []
  const evs = []
  const las = []
  let emptyCount = 0

  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId,
      baselineSwings: mockSwings,
      random: Math.random,
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

console.log('='.repeat(78))
console.log('SWING GENERATOR MEASUREMENT')
console.log(`${REPLAYS_PER_CELL.toLocaleString()} replayed practice sessions per row below.`)
console.log('"before" is the generator as it stood before this slice.')
console.log('"after" is the generator as it stands right now in src/swingGenerator.js.')
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
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId: 'open',
      baselineSwings: mockSwings,
      random: Math.random,
    })
    if (!swings.some((w) => meetsTarget('contact', w.hit.launch))) empty++
  }
  return empty / REPLAYS_PER_CELL
}

function contactEmptyRateBefore(sessionNum) {
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = oldGenerateSwings(sessionNum, mockSwings, Math.random)
    if (!swings.some((w) => meetsTarget('contact', w.hit.launch))) empty++
  }
  return empty / REPLAYS_PER_CELL
}

function contactEmptyRateShipped(sessionNum) {
  let empty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({
      sessionNum,
      goalId: 'contact',
      baselineSwings: mockSwings,
      random: Math.random,
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
for (const [label, gen] of [
  ['before (independent draws)', () => oldGenerateSwings(2, mockSwings, Math.random)],
  [
    'after (correlated, no re-roll)',
    () => generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: mockSwings, random: Math.random }),
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
