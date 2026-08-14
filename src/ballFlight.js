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
// drags in Recharts and needs a DOM. carryDistance is wired into the swing
// generator (src/swingGenerator.js). Below it, the same file also holds the
// distance buckets the results screen and both coach prompts describe a
// session's ball flight in, for the same reason: one place, testable without
// a DOM, that a chart and two prompts all read instead of each writing their
// own copy.

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

// The five buckets used to describe how far balls carried: the bar chart on
// the results screen, and the distance line inside both coach prompts. All
// three used to write out their own copy of these ranges, and the chat
// prompt was the one that kept being missed when the ranges changed — this
// project's CLAUDE.md names that by name as recorded debt. There is now one
// copy: DISTANCE_BUCKETS is the only place the edges are written, and
// distanceBucketCounts below is the only place a swing gets sorted into one
// of them. The chart and both prompts call these; they do not recompute them.
//
// Edges come from scripts/measure-swing-generation.mjs, 20,000 replays per
// cell across sessions 2-4 and every goal that has a target, run against the
// carry formula above:
//
//   shortest ball   74-108ft    10th pct   155-200ft    25th pct  185-229ft
//   middle (50th)  224-259ft    75th pct   262-289ft    90th pct  294-311ft
//   longest ball   375-383ft
//
// "Under 150" catches the shortest real balls: the old chart's floor of 160
// let a 74-foot grounder fall through with no bucket to land in at all.
// "300+" catches the longest without adding a sixth column the chart is not
// laid out for.
export const DISTANCE_BUCKETS = [
  { label: 'Under 150', min: -Infinity, max: 150 },
  { label: '150-200', min: 150, max: 200 },
  { label: '200-250', min: 200, max: 250 },
  { label: '250-300', min: 250, max: 300 },
  { label: '300+', min: 300, max: Infinity },
]

// Sort a session's swings into the five buckets above. Membership is
// half-open, dist >= min && dist < max, the same convention the rest of the
// app already uses for a strike zone or a goal target: a ball at exactly 200
// feet belongs to 200-250, not 150-200. The lowest bucket's min of -Infinity
// and the top bucket's max of Infinity mean a swing can never land in zero
// buckets or in more than one, whatever distance the generator produces.
export function distanceBucketCounts(swings) {
  return DISTANCE_BUCKETS.map(({ label, min, max }) => ({
    label,
    count: swings.filter((sw) => {
      const dist = sw.hit.landing.distance
      return dist >= min && dist < max
    }).length,
  }))
}

// The one line of English both coach prompts use to describe the same
// distribution the chart draws. Written once so the debrief prompt and the
// chat prompt cannot describe different ranges to the model: before this they
// were two copies of the same filter logic that had to be kept in step by
// hand, and the chat prompt was the one nobody remembered to update.
export function distanceDistributionLine(swings) {
  return distanceBucketCounts(swings)
    .map(({ label, count }) => `${label}ft: ${count} swings`)
    .join(', ')
}
