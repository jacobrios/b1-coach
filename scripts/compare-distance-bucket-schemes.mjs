// Compares the shipped distance-chart bucket edges against the two schemes
// that were considered and rejected, by replaying the real swing generator
// thousands of times and counting how often each scheme leaves a bar chart
// with an empty column.
//
// WHY THIS FILE EXISTS. The header comment on DISTANCE_BUCKETS in
// src/ballFlight.js states, as fact, how many empty columns each of three
// candidate bucket schemes produced on average, and quotes the shape each
// scheme gives the hand-written first session. Those numbers were first
// produced in a throwaway script that lived outside this repository, so
// nothing here could reproduce them — a comment citing an unreproducible
// number as measured fact is exactly the kind of claim this slice
// ("honest ball flight") exists to remove. This script replaces that
// throwaway: it is the thing that actually produces the numbers the comment
// quotes, and it is meant to be rerun by anyone who doubts them rather than
// taken on faith.
//
// HAND-RUN, NOT PART OF THE SUITE. This file is named compare-*.mjs, not
// *.test.js or *.spec.js, which is what this project's default vitest
// collection (no vitest.config, so vitest's own default include glob) keys
// on. It will never run inside `npm test` and never gate a commit. Run it
// yourself, on demand:
//
//   node scripts/compare-distance-bucket-schemes.mjs
//
// It takes no arguments, replays 2,500 sessions per scheme/goal/session
// cell (three schemes, three goals with a target, three sessions — 22,500
// replays per scheme, 67,500 total), and prints a plain-text report. It
// takes a few seconds.
//
// WHAT "EMPTY COLUMN" MEANS. The results screen draws one bar per distance
// bucket. A column is empty when none of a session's fifteen swings landed
// in that bucket — the same failure this slice's Task 4 first found on the
// pre-slice chart (two columns that could never fill no matter how weak the
// contact) and then, at the edges Task 4 itself chose, found again in a
// different place (a strong Power session leaving the two SHORT columns
// empty instead). Fewer empty columns, averaged over many replayed sessions,
// is a chart more likely to look like a real distribution and less likely to
// look broken on any given click.
//
// THE THREE SCHEMES. All three carve the same range into five buckets; only
// where the four inside edges sit differs.
//
//   SHIPPED       imported from DISTANCE_BUCKETS in src/ballFlight.js, not
//                 hand-copied here, so this script can never quietly compare
//                 against a scheme that isn't actually live.
//   REJECTED — Task 4's draft (150/200/250/300): the edges Task 4 originally
//                 chose, sitting directly on the raw carry-distance
//                 percentiles. Fixed the pre-slice chart's dead columns but
//                 pushed the same problem to the other end on a strong
//                 session (Power session 4: 0, 0, 0, 12, 3).
//   REJECTED — scheme B (200/250/280/310): a second candidate shown to the
//                 product manager alongside the shipped scheme and Task 4's
//                 draft on 14 August 2026, and not chosen.
//
// THE BASELINE FIXTURE. Every session the generator produces, at every
// session number, is built off the averages of the same fifteen hand-written
// session-1 swings — not off the previous session — because that is what
// `onNewSession` in src/App.jsx actually calls: `baselineSwings: mockSwings`
// every time, regardless of `sessionNumber`. Slice 7b extracted that array
// into src/sessionOneSwings.js, the same module
// scripts/measure-swing-generation.mjs now imports, so this file no longer
// carries its own hand-copied duplicate of either the swings or the fifteen
// distances derived from them.
//
// WHICH GOALS AND SESSIONS. Sessions 2, 3 and 4 — every session the
// generator actually produces; session 1 is the fixed hand-written one,
// measured separately below. Goals power, contact and popup — the three
// with a target, the same TARGET_GOALS scripts/measure-swing-generation.mjs
// already measures by. `allfields` and `open` are left out on purpose, for
// the same reason that script leaves them out of its per-goal figures: nothing
// about the distance chart specifically depends on whether a goal has a
// launch-angle/exit-velocity target, but keeping the goal set identical to
// the sibling script means a reader comparing the two never has to wonder
// whether a difference in the numbers is a real difference or just a
// different set of goals being averaged.

// A LOADER WRINKLE, EXPLAINED SO NOBODY "FIXES" IT AWAY. src/swingGenerator.js
// imports its neighbours as `./ballFlight` and `./goalTargets`, with no file
// extension. That is fine under Vite and under vitest (both resolve it), but
// plain `node` refuses it: ERR_MODULE_NOT_FOUND. This is the identical
// wrinkle scripts/measure-swing-generation.mjs hits and solves the same way:
// a tiny inline module hook — a `data:` URL, not a second file — that retries
// a failed extensionless relative import with `.js` appended, then imports
// the real generator through it. Nothing about the generator's behaviour is
// touched or reimplemented by this hook; it only helps Node find the file.
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
const { DISTANCE_BUCKETS, distanceBucketCounts } = await import('../src/ballFlight.js')
const { SESSION_ONE_SWINGS: mockSwings } = await import('../src/sessionOneSwings.js')

const REPLAYS_PER_CELL = 2500
const SESSIONS = [2, 3, 4]
const TARGET_GOALS = [
  { id: 'power', label: 'Power & Distance' },
  { id: 'contact', label: 'Line Drives & Contact' },
  { id: 'popup', label: 'Reduce Pop-Ups' },
]

// The fifteen distances of the hand-written first session, in the order a
// visitor's first debrief shows them. Derived from the imported mockSwings
// above rather than written out separately, so this file cannot hold its own
// stale copy of a number that already lives in src/sessionOneSwings.js.
const SESSION_ONE_DISTANCES = mockSwings.map((swing) => swing.hit.landing.distance)

// ---------------------------------------------------------------------------
// The three schemes.
//
// SHIPPED is read from the real constant, not hand-copied, so this script
// can never drift from what the app actually renders. The two rejected
// schemes are written out here because nothing in the shipped app defines
// them any more — they were candidates, not code.

const SHIPPED = { name: 'shipped (175/225/265/305)', buckets: DISTANCE_BUCKETS }

const TASK_4_DRAFT_REJECTED = {
  name: 'REJECTED — Task 4 draft (150/200/250/300)',
  buckets: [
    { label: 'Under 150', min: -Infinity, max: 150 },
    { label: '150-200', min: 150, max: 200 },
    { label: '200-250', min: 200, max: 250 },
    { label: '250-300', min: 250, max: 300 },
    { label: '300+', min: 300, max: Infinity },
  ],
}

const SCHEME_B_REJECTED = {
  name: 'REJECTED — scheme B (200/250/280/310)',
  buckets: [
    { label: 'Under 200', min: -Infinity, max: 200 },
    { label: '200-250', min: 200, max: 250 },
    { label: '250-280', min: 250, max: 280 },
    { label: '280-310', min: 280, max: 310 },
    { label: '310+', min: 310, max: Infinity },
  ],
}

const SCHEMES = [TASK_4_DRAFT_REJECTED, SCHEME_B_REJECTED, SHIPPED]

// Sorts a plain array of distances into a scheme's buckets, using the exact
// half-open rule distanceBucketCounts uses in src/ballFlight.js
// (dist >= min && dist < max). For SHIPPED this is cross-checked against
// distanceBucketCounts itself below, so this local copy is never the only
// thing standing between this script and the real bucketing rule.
function bucketCounts(distances, buckets) {
  return buckets.map(({ label, min, max }) => ({
    label,
    count: distances.filter((d) => d >= min && d < max).length,
  }))
}

function emptyColumnCount(counts) {
  return counts.filter((b) => b.count === 0).length
}

// Sanity check: the local bucketCounts() above must agree with the real,
// shipped distanceBucketCounts() for the shipped scheme, on the one fixture
// every visitor actually sees. If this ever throws, the local copy has
// drifted from the production rule and nothing below can be trusted.
{
  const viaLocal = bucketCounts(SESSION_ONE_DISTANCES, SHIPPED.buckets).map((b) => b.count)
  const viaShipped = distanceBucketCounts(
    SESSION_ONE_DISTANCES.map((distance) => ({ hit: { landing: { distance } } })),
  ).map((b) => b.count)
  if (JSON.stringify(viaLocal) !== JSON.stringify(viaShipped)) {
    throw new Error(
      `bucketCounts() disagrees with the real distanceBucketCounts(): local ${JSON.stringify(viaLocal)} vs shipped ${JSON.stringify(viaShipped)}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Measurement: average empty columns per chart, per scheme, per goal, per
// session, replaying the real generator REPLAYS_PER_CELL times per cell.

function measureCell(goalId, sessionNum, buckets) {
  let totalEmpty = 0
  for (let i = 0; i < REPLAYS_PER_CELL; i++) {
    const swings = generateSwings({ sessionNum, goalId, baselineSwings: mockSwings, random: Math.random })
    const distances = swings.map((sw) => sw.hit.landing.distance)
    totalEmpty += emptyColumnCount(bucketCounts(distances, buckets))
  }
  return totalEmpty / REPLAYS_PER_CELL
}

// ---------------------------------------------------------------------------
// Report.

console.log('='.repeat(78))
console.log('DISTANCE BUCKET SCHEME COMPARISON')
console.log(`${REPLAYS_PER_CELL.toLocaleString()} replayed practice sessions per goal/session cell below.`)
console.log('Lower is better: fewer bars on the chart come up completely empty.')
console.log('='.repeat(78))

// Two header rows rather than one abbreviated row: `power` and `popup` both
// start with "po", so a single-row abbreviated header (this script's first
// draft) printed the same "poS2/poS3/poS4" label over two different goals'
// columns. scripts/measure-swing-generation.mjs never abbreviates a goal
// name; this keeps that convention by spelling the full name out, just once
// per group of three session columns instead of once per line, so the table
// stays compact enough to compare all three schemes side by side.
const GROUP_WIDTH = 7 * SESSIONS.length
// +1 so a label as long as the group itself ("Line Drives & Contact" is
// exactly 21 characters, the same as three 7-wide session columns) still
// gets a visible gap before the next goal's name, rather than running
// straight into it.
console.log(' '.repeat(38) + TARGET_GOALS.map((g) => g.label.padEnd(GROUP_WIDTH + 1)).join(''))

const header = ['scheme'.padEnd(38)]
  .concat(TARGET_GOALS.flatMap(() => SESSIONS.map((s) => `S${s}`.padStart(7))))
  .concat(['  OVERALL'])
console.log(header.join(''))

for (const scheme of SCHEMES) {
  const cellValues = []
  let overallTotal = 0
  let overallCells = 0
  for (const goal of TARGET_GOALS) {
    for (const sessionNum of SESSIONS) {
      const avgEmpty = measureCell(goal.id, sessionNum, scheme.buckets)
      cellValues.push(avgEmpty.toFixed(2).padStart(7))
      overallTotal += avgEmpty
      overallCells += 1
    }
  }
  const overall = (overallTotal / overallCells).toFixed(2)
  console.log(scheme.name.padEnd(38) + cellValues.join('') + '    ' + overall)
}

console.log('')
console.log('Power & Distance, session 4 specifically (the strongest single session')
console.log('the app produces, and the case that first surfaced this problem):')
for (const scheme of SCHEMES) {
  const avgEmpty = measureCell('power', 4, scheme.buckets)
  console.log(`  ${scheme.name.padEnd(38)} ${avgEmpty.toFixed(2)} empty columns on average`)
}

console.log('')
console.log('The hand-written first session every visitor opens on — same fifteen')
console.log('distances under all three schemes:')
for (const scheme of SCHEMES) {
  const counts = bucketCounts(SESSION_ONE_DISTANCES, scheme.buckets).map((b) => b.count)
  console.log(`  ${scheme.name.padEnd(38)} ${counts.join(', ')}`)
}

console.log('')
console.log('='.repeat(78))
console.log('End of report.')
