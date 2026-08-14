// How far a synthetic swing's ball carries, in feet.
//
// The formula this replaces, round(ev * 4.0 + la * 1.8), barely used launch
// angle at all. A ground ball at 70 mph and 4 degrees was recorded carrying 287
// feet, almost as far as a real line drive, and the coach then quoted that
// distance back to the player as if it meant something. The old formula's floor
// was 251 feet, so the app's two shortest distance buckets could never fill no
// matter how weakly a ball was hit.
//
// This one splits carry into two ideas that multiply together: how hard the
// ball was hit (potential), and how much of that potential a given launch
// angle actually turns into carry (shape). A ball hit at the ideal angle,
// around 28 degrees, keeps all of its potential. A ground ball keeps very
// little of it, and a ball hit too high loses some too, the way a real
// warning-track flyball does. The exact constants are a starting point tuned
// against the app's own 65-97 mph / -5-35 degree range, not a physics model,
// and may move if the rendered chart argues for it; see the decision record
// for this slice if they do.
//
// It lives in its own file, beside goalTargets.js, sessionStats.js and
// chartSlots.js, so it can be tested without loading the results screen, which
// drags in Recharts and needs a DOM. Nothing calls it yet; wiring it into the
// swing generator is a separate task.

// Carry in feet for one swing. Takes the same { exitSpeed, angle } shape
// meetsTarget in goalTargets.js already takes, so callers pass a swing's
// launch data straight through without reshaping it.
export function carryDistance({ exitSpeed, angle } = {}) {
  // A swing with a missing or non-finite number is a swing we know nothing
  // about, not a swing that carried zero feet for a reason. Returning 0 here
  // is the same call meetsTarget makes: reject explicitly rather than let a
  // NaN silently propagate into whatever reads this. computeStats had exactly
  // that bug before Slice 4 fixed it; this function does not reintroduce it.
  if (!Number.isFinite(exitSpeed) || !Number.isFinite(angle)) return 0

  // How hard the ball was hit. Exit velocities at or below 45 mph produce no
  // carry at all rather than a negative number.
  const potential = Math.max(0, (exitSpeed - 45) * 7.5)

  // How much of that potential the launch angle turns into carry. Below 28
  // degrees carry falls off toward nothing as the angle drops, which is the
  // whole point of this file: a ground ball should not be credited with a
  // line drive's distance. Above 28 degrees the ball is hit too high and loses
  // carry more gently, floored at 55% so an extreme popup still reads as a
  // real (short) fly ball rather than a ball that vanished.
  const shape =
    angle <= 28
      ? 0.3 + 0.7 * ((angle + 5) / 33) ** 0.9
      : Math.max(0.55, 1 - (angle - 28) * 0.02)

  return Math.round(potential * shape)
}
