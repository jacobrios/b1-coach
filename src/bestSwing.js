// Which swing the coach should hold up as the example to copy.
//
// WHY THIS EXISTS. The product manager's merge-gate QA pass on Slice 15 found
// the session 1 Power debrief building its whole first tip around swing 13
// (89 mph, 25 degrees, 311 feet) when swing 5 (92, 27, 346) beat it on all
// three and sat in the same target band. Every number printed about swing 13
// was correct, so nothing in this project could catch it: it is not a miscount,
// it is the coach choosing the wrong swing to praise. His words for why it
// matters: not technically wrong, but enough to put doubt in somebody with
// expertise reading it, and a coach should look at the best swing.
//
// So the app chooses, the same way it already pre-counts every threshold the
// coach's prose names. Slice 8b's lesson applies unchanged: handing the coach a
// fact is only half of it, and the rule telling it to use the fact is the half
// that makes the behaviour hold.

import { meetsTarget } from './goalTargets.js'

// PER GOAL, NOT ONE GLOBAL RULE, and the difference is a product decision the
// product manager took on 27 August 2026 rather than an implementation detail.
// A single "hardest hit" rule was proposed and rejected for two of the three:
//
//   Power & Distance is named for distance. Exit velocity and carry usually
//   agree but can diverge, and nominating the shorter ball on a distance goal
//   is the same quiet wrongness the QA pass just caught.
//
//   Reduce Pop-Ups asks for nothing but launch angle. goalTargets.js says so in
//   its own comment: "a softly hit ball at 15 degrees still counts." Exit
//   velocity is a TIEBREAK here to pick among swings that already met the goal,
//   never a requirement, which is why it does not contradict the goal.
//
// This is the third per-goal table in this project, after GOAL_TARGETS and
// GOAL_COUNT_SPECS, and it is a table for the same reason they are: the last
// time one goal's criterion was applied to every goal it produced the false
// positives Slice 8b had to unpick.
//
// The three goals with no target (allfields, open, dashboard) are absent rather
// than present-and-empty, matching goalTargets' own absence-not-zeroes
// convention. Hit to All Fields is judged on the spread of a whole session, so
// no single swing is its example.
export const BEST_SWING_METRICS = {
  power: { rank: (sw) => sw.hit.landing.distance, phrase: 'the longest ball' },
  contact: { rank: (sw) => sw.hit.launch.exitSpeed, phrase: 'the hardest hit' },
  popup: { rank: (sw) => sw.hit.launch.exitSpeed, phrase: 'the hardest hit' },
}

// The swing to hold up, or null when there is no honest answer.
//
// Null in three cases, and each is deliberate. A goal with nothing to aim at
// has no best swing. A goal this table does not cover has none either. And a
// session where NOTHING met the target gets no line at all rather than the
// nearest miss: the app must never name a swing that missed the goal as the one
// to copy, which would be a worse version of the defect this fixes.
//
// The filter is meetsTarget, the same function that colours the on-target dots
// on the launch angle chart and the pitch location chart, so the swing the
// coach praises can never be one the chart beside it draws as a miss.
export function bestSwing(goalId, swings) {
  const metric = Object.prototype.hasOwnProperty.call(BEST_SWING_METRICS, goalId)
    ? BEST_SWING_METRICS[goalId]
    : null
  // No hasTarget check here, deliberately. This table only holds the three goals
  // that have a target, so hasTarget could never be the condition that rejects,
  // and a branch that cannot fail reads as protection while providing none. The
  // table IS the check, and a test pins its keys to exactly those three goals.
  if (!metric || !Array.isArray(swings)) return null

  let best = null
  for (const [i, swing] of swings.entries()) {
    if (!meetsTarget(goalId, swing?.hit?.launch ?? {})) continue
    const score = metric.rank(swing)
    if (!Number.isFinite(score)) continue
    // Strictly greater, so a tie leaves the earlier swing in place. Ties are
    // real on whole-number readings, and a best swing that changed between two
    // runs of the same session would be its own credibility problem.
    if (best === null || score > best.score) best = { number: i + 1, score }
  }

  return best === null ? null : { number: best.number, phrase: metric.phrase }
}
