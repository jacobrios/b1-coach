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

import { goalTarget } from '../src/goalTargets.js'
import { topExitVelocity, pitchZoneBreakdown, STRIKE_ZONE } from '../src/sessionStats.js'
import { DISTANCE_BUCKETS } from '../src/ballFlight.js'
import { countSpecThresholds, goalCountValues } from '../src/goalCountSpecs.js'

export const METRICS = ['exitVelocity', 'launchAngle', 'direction', 'distance', 'pitchHeight', 'pitchSide']

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

// Pitch location is tracked in feet to a tenth (the strike zone bounds
// themselves are 1.5/3.5/-0.7/0.7), so rounding it to the nearest whole
// number the way exit velocity or launch angle round would collapse the
// zone bounds themselves into different numbers. Every other metric keeps
// the whole-number rounding a coach's own language uses ("19.7 mph" is
// never cited as such).
const DECIMAL_METRICS = new Set(['pitchHeight', 'pitchSide'])
const roundForMetric = (metricKey, v) => (
  DECIMAL_METRICS.has(metricKey) ? Math.round(v * 10) / 10 : Math.round(v)
)

// Every threshold worth precomputing for one metric in one session: the
// session's own values (rounded, since a coach doesn't cite "19.7 mph") plus
// the base and caller-supplied extras, deduplicated and sorted.
export function candidateThresholds(rows, metricKey, extra = []) {
  const values = new Set()
  for (const row of rows) {
    const v = row[metricKey]
    if (Number.isFinite(v)) values.add(roundForMetric(metricKey, v))
  }
  for (const e of [...(BASE_EXTRA_THRESHOLDS[metricKey] ?? []), ...extra]) {
    if (Number.isFinite(e)) values.add(roundForMetric(metricKey, e))
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

// The whole-session numbers the debrief prompt hands the coach directly,
// computed by the same functions the prompt itself renders from
// (goalCountValues, pitchZoneBreakdown), so a claim repeating one of these
// is checked against the identical number the coach actually saw. Which
// counts exist depends on the goal, exactly as it does in the prompt: the
// pre-8c version emitted Power's two counts for every goal, and grading a
// correct contact count against a Power stat is what produced Slice 8b's
// false positives.
function sessionStatsExtras(swings, goalId) {
  const top3 = [...swings]
    .map((sw) => sw.hit.launch.exitSpeed)
    .sort((a, b) => b - a)
    .slice(0, 3)
  const stats = { topExitVelocity: topExitVelocity(swings), top3ExitVelocities: top3 }
  for (const [key, v] of Object.entries(goalCountValues(goalId, swings))) {
    stats[`${key}Count`] = v.count
    stats[`${key}Swings`] = v.swings
  }
  const zone = pitchZoneBreakdown(swings)
  stats.outsideZoneCount = zone.outside.count
  stats.outsideZoneSwings = zone.outside.swings
  stats.highPitchCount = zone.high.count
  stats.highPitchSwings = zone.high.swings
  stats.lowPitchCount = zone.low.count
  stats.lowPitchSwings = zone.low.swings
  stats.widePitchCount = zone.wide.count
  stats.widePitchSwings = zone.wide.swings
  return stats
}

// One session's worth of fact sheet: the per-swing table, the whole-session
// numbers the prompt already handed the coach, and the threshold tables for
// every tracked metric.
export function buildSessionFactSheet(session, { extraThresholds = {}, goalId } = {}) {
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
      ...sessionStatsExtras(session.swings, goalId),
    },
    thresholds,
  }
}

// The full fact sheet a debrief was graded against: every session up to and
// including the one being debriefed, exactly the set buildDebriefUserMessage
// filters to (`sessions.filter(s => s.sessionNumber <= viewingSessionNumber)`
// in src/coachApi.js), so a claim about an earlier session is checkable and a
// claim about a session the coach was never shown is not silently answered.
export function buildFactSheet({ sessions, viewingSessionNumber, extraThresholds, goalId } = {}) {
  const filtered = sessions
    .filter((s) => s.sessionNumber <= viewingSessionNumber)
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
  return {
    viewingSessionNumber,
    sessions: filtered.map((s) => buildSessionFactSheet(s, { extraThresholds, goalId })),
  }
}

// Goal-specific thresholds worth adding on top of the base set: the goal's
// own launch-angle band and exit-velocity minimum, every threshold the
// goal's prompt prose names (read from GOAL_COUNT_SPECS via
// countSpecThresholds rather than re-typed here, so the grader and the
// prompt cannot disagree about what was counted), and the strike-zone bounds
// for the two new pitch-location metrics, since the zone count lines go to
// every goal regardless of which one is active. Returns the same
// {metric: [values]} shape buildFactSheet's extraThresholds takes.
//
// The prompt has been per-goal since Slice 8b, and grading a correct claim
// against leaked Power stats is what produced Slice 8b's false positives
// (see the 18 August 2026 correction). This function used to also merge in
// Power's own launch-angle band and exit-velocity minimum for every goal;
// that merge is gone as of Slice 8c, because nothing in the current prompt
// hands a non-Power goal Power's numbers.
export function goalExtraThresholds(goalId) {
  const target = goalTarget(goalId)
  const launchAngle = []
  const exitVelocity = []
  if (target?.launchAngle) launchAngle.push(target.launchAngle.min, target.launchAngle.max)
  if (Number.isFinite(target?.exitVelocity)) exitVelocity.push(target.exitVelocity)
  const merged = {
    launchAngle,
    exitVelocity,
    pitchHeight: [STRIKE_ZONE.heightMin, STRIKE_ZONE.heightMax],
    pitchSide: [STRIKE_ZONE.sideMin, STRIKE_ZONE.sideMax],
  }
  for (const [metric, values] of Object.entries(countSpecThresholds(goalId))) {
    merged[metric] = [...(merged[metric] ?? []), ...values]
  }
  return merged
}
