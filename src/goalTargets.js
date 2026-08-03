// What each coaching goal actually asks of a swing.
//
// This is the single place those numbers live. Before Slice 4 they were written
// out in five: the coach's debrief prompt, the coach's chat prompt, the launch
// angle chart's band, the pitch location chart's outcome colouring, and the goal
// cards on the home screen. They had already drifted apart, so the app promised
// the player one thing and coloured their swings against another.
//
// It lives in its own file, beside chartSlots.js and sessionStats.js, so it can
// be tested without loading the results screen, which drags in Recharts and
// needs a DOM.
//
// A goal with no target is an absence, not a row of zeroes. Three of the six
// goals have no launch angle target, and telling "aim for nothing" apart from
// "aim at zero" is what stops Open Session silently borrowing Power's band.

export const GOAL_TARGETS = {
  power: { launchAngle: { min: 25, max: 35 }, exitVelocity: 88 },
  contact: { launchAngle: { min: 8, max: 18 }, exitVelocity: 85 },
  // No exit velocity requirement. Keeping the ball out of the pop-up window is
  // the whole ask, so a softly hit ball at 15 degrees still counts.
  popup: { launchAngle: { min: 10, max: 25 }, exitVelocity: null },
  // allfields, open and dashboard are deliberately absent rather than empty.
  // Hit to All Fields is judged on spray direction and Open Session is free
  // practice, so neither has a launch angle target to show.
}

// The target for a goal, or null when the goal has none. Also null for a goal
// id that does not exist, so a bad id shows no target rather than a guessed one.
export function goalTarget(goalId) {
  return GOAL_TARGETS[goalId] ?? null
}

// Whether this goal has anything to aim at. Charts ask this before drawing a
// target band or colouring a swing as a hit or a miss.
export function hasTarget(goalId) {
  return goalTarget(goalId) !== null
}

// Whether one swing met its goal. Both charts judge swings through this, so the
// launch angle chart and the pitch location chart can no longer disagree about
// what counts as a good swing on the same session.
export function meetsTarget(goalId, { exitSpeed, angle }) {
  const target = goalTarget(goalId)
  if (!target) return false
  if (angle < target.launchAngle.min || angle > target.launchAngle.max) return false
  if (target.exitVelocity != null && exitSpeed < target.exitVelocity) return false
  return true
}

// The launch angle range as the goal cards write it. The en dash is correct
// typography in a numeric range and is deliberate.
export function launchAngleRangeLabel(goalId) {
  const target = goalTarget(goalId)
  return target ? `${target.launchAngle.min}–${target.launchAngle.max}°` : null
}
