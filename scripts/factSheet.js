// The deterministic fact sheet handed to the coach-accuracy grader model.
//
// Built for scripts/grade-coach-accuracy.mjs, per Slice 7b Task 4. The
// regrade report (docs/eval-fixtures/slice7-debriefs/regrade-report.md)
// found one mechanism behind every verified coach error: the coach reliably
// repeats a count the prompt hands it, and is unreliable at a count it has
// to derive itself (a threshold not given in the prompt, or a subset
// defined mid-sentence by "of those"). The grader is built to remove that
// same derivation step from the GRADING side too, not just describe it: this
// module precomputes, in plain JS, every count the grading model could need,
// so the model's job is reading a table rather than counting a session.
//
// What gets precomputed, and why:
//   - A per-swing table (exit velocity, launch angle, direction, distance,
//     pitch height, pitch side), 1-indexed to match "swing 4" in the coach's
//     own prose.
//   - Threshold counts (above / below / equal / atLeast / atMost, each with
//     the qualifying swing numbers) for every launch-angle, exit-velocity,
//     direction and distance value that plausibly gets cited: every value
//     actually present in the session (a coach citing a real per-swing
//     number as a cutoff is common), plus a small fixed set of "always
//     worth having" numbers below. Sessions here are 15 swings, so the
//     swing lists stay short regardless of how many thresholds are computed.
//
// BASE_EXTRA_THRESHOLDS encodes the two error classes the report named by
// name: launch angle 15 is spelled out verbatim in the debrief prompt
// ("Swings with launch angle strictly below 15 degrees"), and 20 is the
// exact threshold every "above 20 degrees" claim in the 96-debrief fixture
// got wrong. 0/25/30/35 and the exit-velocity/direction/distance sets round
// out the range with the other numbers a coach plausibly reaches for
// (goal-target edges, the pull/oppo cutoffs, the distance-bucket edges).
// Caller-supplied extras (see grade-coach-accuracy.mjs) add the specific
// goal's own target numbers on top, since those differ per debrief.

import { goalTarget, meetsTarget } from '../src/goalTargets.js'
import { topExitVelocity } from '../src/sessionStats.js'
import { DISTANCE_BUCKETS } from '../src/ballFlight.js'
import { countSpecThresholds } from '../src/goalCountSpecs.js'

export const METRICS = ['exitVelocity', 'launchAngle', 'direction', 'distance']

const BASE_EXTRA_THRESHOLDS = {
  launchAngle: [0, 15, 20, 25, 30, 35],
  exitVelocity: [80, 85, 88, 90],
  direction: [-15, 15],
  distance: DISTANCE_BUCKETS.filter((b) => Number.isFinite(b.min)).map((b) => b.min),
}

// One swing, reshaped into the flat fields the grader cites by name. 1-indexed
// on purpose: the coach prompt numbers swings from 1 ("Swing 4: ..."), and a
// 0-indexed fact sheet would force every consumer to remember to add one.
export function swingRow(swing, index) {
  return {
    n: index + 1,
    exitVelocity: swing.hit.launch.exitSpeed,
    launchAngle: swing.hit.launch.angle,
    direction: swing.hit.launch.direction,
    distance: swing.hit.landing.distance,
    pitchHeight: swing.plateLocHeight,
    pitchSide: swing.plateLocSide,
  }
}

// Every threshold worth precomputing for one metric in one session: the
// session's own values (rounded, since a coach doesn't cite "19.7 mph") plus
// the base and caller-supplied extras, deduplicated and sorted.
export function candidateThresholds(rows, metricKey, extra = []) {
  const values = new Set()
  for (const row of rows) {
    const v = row[metricKey]
    if (Number.isFinite(v)) values.add(Math.round(v))
  }
  for (const e of [...(BASE_EXTRA_THRESHOLDS[metricKey] ?? []), ...extra]) {
    if (Number.isFinite(e)) values.add(Math.round(e))
  }
  return [...values].sort((a, b) => a - b)
}

// The five comparisons a coach's language plausibly maps to ("above",
// "under", "at least", "at most", an exact value), computed once per
// threshold so the model never has to derive any of them.
//
// "above", "below" and "equal" carry both the count and the qualifying swing
// numbers, because every verified error in the regrade report used exactly
// that strict above/under language, and the swing list is what lets the
// model check a named-swings claim ("swings 2, 4, 5, 6, 7, and 8") by set
// comparison instead of a recount. "atLeast" and "atMost" carry only a
// count: they are the largest single source of the fact sheet's size (each
// one mostly repeats the above/below list it is one swing away from), and no
// example in the report's error classes used inclusive language. A claim
// phrased "at least" or "at most" is still checkable against the count; it
// just cannot be checked swing-by-swing the way above/below can.
export function thresholdCounts(rows, metricKey, thresholds) {
  return thresholds.map((threshold) => {
    const above = []
    const below = []
    const equal = []
    let atLeastCount = 0
    let atMostCount = 0
    for (const row of rows) {
      const v = row[metricKey]
      if (!Number.isFinite(v)) continue
      if (v > threshold) above.push(row.n)
      if (v < threshold) below.push(row.n)
      if (v === threshold) equal.push(row.n)
      if (v >= threshold) atLeastCount++
      if (v <= threshold) atMostCount++
    }
    const pack = (swings) => ({ count: swings.length, swings })
    return {
      threshold,
      above: pack(above),
      below: pack(below),
      equal: pack(equal),
      atLeast: { count: atLeastCount },
      atMost: { count: atMostCount },
    }
  })
}

// The whole-session numbers the debrief prompt hands the coach directly
// (buildDebriefUserMessage in src/coachApi.js), computed the same way here so
// a claim repeating one of these can be checked against the identical
// definition the coach actually saw, not a re-derivation of it.
function sessionStatsExtras(swings) {
  const top = topExitVelocity(swings)
  const top3 = [...swings]
    .map((sw) => sw.hit.launch.exitSpeed)
    .sort((a, b) => b - a)
    .slice(0, 3)

  // Strictly below 15, matching the prompt's own "not including 15" wording.
  const underFifteen = swings
    .map((sw, i) => ({ n: i + 1, angle: sw.hit.launch.angle }))
    .filter((s) => s.angle < 15)

  const powerZone = swings
    .map((sw, i) => ({ n: i + 1, meets: meetsTarget('power', sw.hit.launch) }))
    .filter((s) => s.meets)

  return {
    topExitVelocity: top,
    top3ExitVelocities: top3,
    underFifteenCount: underFifteen.length,
    underFifteenSwings: underFifteen.map((s) => s.n),
    powerZoneCount: powerZone.length,
    powerZoneSwings: powerZone.map((s) => s.n),
  }
}

// One session's worth of fact sheet: the per-swing table, the whole-session
// numbers the prompt already handed the coach, and the threshold tables for
// every tracked metric.
export function buildSessionFactSheet(session, { extraThresholds = {} } = {}) {
  const rows = session.swings.map((sw, i) => swingRow(sw, i))
  const thresholds = {}
  for (const metricKey of METRICS) {
    const extra = extraThresholds[metricKey] ?? []
    const values = candidateThresholds(rows, metricKey, extra)
    thresholds[metricKey] = thresholdCounts(rows, metricKey, values)
  }
  return {
    sessionNumber: session.sessionNumber,
    swings: rows,
    stats: {
      avgExitVelocity: session.stats.avgExitVelocity,
      avgLaunchAngle: session.stats.avgLaunchAngle,
      inZoneCount: session.stats.inZoneCount,
      totalSwings: session.stats.totalSwings,
      ...sessionStatsExtras(session.swings),
    },
    thresholds,
  }
}

// The full fact sheet a debrief was graded against: every session up to and
// including the one being debriefed, exactly the set buildDebriefUserMessage
// filters to (`sessions.filter(s => s.sessionNumber <= viewingSessionNumber)`
// in src/coachApi.js), so a claim about an earlier session is checkable and a
// claim about a session the coach was never shown is not silently answered.
export function buildFactSheet({ sessions, viewingSessionNumber, extraThresholds } = {}) {
  const filtered = sessions
    .filter((s) => s.sessionNumber <= viewingSessionNumber)
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
  return {
    viewingSessionNumber,
    sessions: filtered.map((s) => buildSessionFactSheet(s, { extraThresholds })),
  }
}

// Goal-specific thresholds worth adding on top of the base set: the goal's
// own launch-angle band and exit-velocity minimum, plus the power goal's
// numbers, because the debrief prompt reports a power-zone count for every
// goal regardless of which one is active (see the POWER constant and comment
// in src/coachApi.js). Returns the same {metric: [values]} shape
// buildFactSheet's extraThresholds takes.
//
// Slice 8b added the second half: every threshold the goal's prompt prose
// names, read from GOAL_COUNT_SPECS via countSpecThresholds rather than
// re-typed here, so the grader and the prompt cannot disagree about what was
// counted. That brings in contact's fly-ball 20, allfields' direction
// cutoffs and 82 mph hard-contact line, and popup's 35 and 5. The Power
// merging above it stays as-is for grading the baseline round; Task 7
// revisits it once the prompt no longer shows Power's zone to every goal.
// Duplicates across the two halves are fine: candidateThresholds dedupes.
export function goalExtraThresholds(goalId) {
  const target = goalTarget(goalId)
  const power = goalTarget('power')
  const launchAngle = []
  const exitVelocity = []
  for (const t of [target, power]) {
    if (!t) continue
    if (t.launchAngle) {
      launchAngle.push(t.launchAngle.min, t.launchAngle.max)
    }
    if (Number.isFinite(t.exitVelocity)) exitVelocity.push(t.exitVelocity)
  }
  const merged = { launchAngle, exitVelocity }
  for (const [metric, values] of Object.entries(countSpecThresholds(goalId))) {
    merged[metric] = [...(merged[metric] ?? []), ...values]
  }
  return merged
}
