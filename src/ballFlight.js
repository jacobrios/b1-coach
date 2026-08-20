import { swingCountPhrase } from './promptText.js'

// How far a synthetic swing's ball carries, in feet, and the five buckets
// that carry distance is grouped into for display.
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
// The raw distribution these edges sit against, from
// scripts/measure-swing-generation.mjs, 20,000 replays per cell across
// sessions 2-4 and every goal that has a target, run against the carry
// formula above:
//
//   shortest ball   74-108ft    10th pct   155-200ft    25th pct  185-229ft
//   middle (50th)  224-259ft    75th pct   262-289ft    90th pct  294-311ft
//   longest ball   375-383ft (what that sample happened to throw up; the true
//     ceiling is 390ft, which is arithmetic rather than an observation: the
//     hardest ball this generator can produce is 97mph at 28 degrees, which is
//     the top of the exit velocity clamp meeting the peak of the shape curve
//     below, and that carries 390 feet exactly. Note 28 is NOT the launch angle
//     clamp, which is 35: a ball hit higher than 28 degrees carries less, so the
//     maximum sits at the peak rather than at the ceiling. The top bucket is
//     open-ended, so nothing here turns on the difference)
//
// A first draft placed the edges straight on those percentiles —
// 150/200/250/300 — and shipped in this slice's Task 4. It fixed the
// original bug (two columns that could never fill under the old, dishonest
// formula) but on a strong session it just pushed the same lopsided shape to
// the other end of the range: a Power session 4 rendered as 0, 0, 0, 12, 3,
// three empty columns and one enormous bar.
//
// The edges below are the product manager's choice from a rendered
// comparison of three candidate schemes shown side by side on 14 August
// 2026, not a further percentile calculation. Measured over 2,500 sessions
// per cell, average empty columns per chart across every goal and session
// that has a target:
//
//   150/200/250/300 (Task 4's draft)   0.99 overall, 1.38 on Power session 4
//   200/250/280/310 (scheme B)         0.70 overall, 0.61 on Power session 4
//   175/225/265/305 (shipped)          0.70 overall, 0.97 on Power session 4
//
// (One run. The second decimal wanders by a hundredth or two on a rerun,
// which is sampling noise, not disagreement; the ordering below does not
// move.)
//
// Read that table honestly: on this measure the shipped edges did not win.
// Scheme B ties them overall and beats them clearly on Power session 4, which
// is the very case that surfaced the problem. The shipped edges were chosen on
// how the three rendered, not on this number, and the paragraph above says so.
//
// The hand-written session 1 (src/sessionOneSwings.js) rendered 3, 3, 3, 3, 3
// under the draft edges, 6, 3, 2, 1, 3 under scheme B, and 5, 3, 1, 3, 3 under
// these. The product manager preferred the uneven shape on sight: five
// identical bars reads as placeholder data, not as something real measurement
// produced.
//
// CORRECTED 20 AUGUST 2026, and read the correction before quoting those
// three shapes at anyone. Slice 9 rewrote session 1's fifteen swings, so all
// three numbers above describe swings that no longer exist. Re-measured the
// same day against the rewritten session, by rerunning the script named
// below: 2, 3, 6, 2, 2 under the draft edges, 5, 6, 2, 0, 2 under scheme B,
// and 4, 4, 3, 2, 2 under these.
//
// The DECISION is untouched and is not being relitigated here. It was made
// across every goal and every session that has a target, on the empty-column
// table above, and session 1 was one illustration of it rather than its
// basis. What is worth noticing is that the illustration now argues the same
// way for a different reason: scheme B leaves the fourth column of the first
// screen a visitor ever sees completely empty (that 0), which the shipped
// edges do not.
//
// Two stale pointers fixed in the same pass: the session lived in
// src/App.jsx's `mockSwings` until Slice 7b moved it to
// src/sessionOneSwings.js, and this comment had gone on naming the old home
// for three slices.
//
// Rerun this yourself with `node scripts/compare-distance-bucket-schemes.mjs`
// rather than trusting the numbers above. That script is what actually
// produces them, replaying the real generator against the shipped edges and
// the two rejected candidates (Task 4's draft above, and a third, "scheme B"
// at 200/250/280/310, shown alongside these two and not chosen).
//
// "Under 175" catches the shortest real balls: the pre-Task-4 chart's floor
// of 160 let a 74-foot grounder fall through with no bucket to land in at
// all. "305+" catches the longest without adding a sixth column the chart is
// not laid out for.
export const DISTANCE_BUCKETS = [
  { label: 'Under 175', min: -Infinity, max: 175 },
  { label: '175-225', min: 175, max: 225 },
  { label: '225-265', min: 225, max: 265 },
  { label: '265-305', min: 265, max: 305 },
  { label: '305+', min: 305, max: Infinity },
]

// Sort a session's swings into the five buckets above. Membership is
// half-open, dist >= min && dist < max, the same convention the rest of the
// app already uses for a strike zone or a goal target: a ball at exactly 175
// feet belongs to 175-225, not Under 175. The lowest bucket's min of -Infinity
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

// ── How far from the plate the spray chart draws a ball ──────────────────
//
// The spray chart on the results screen is a fan of fair territory with the
// plate at the bottom. Every ball is a dot, its angle from the plate is the
// direction it was hit, and its distance from the plate is what these numbers
// decide. It lives here rather than in the chart file for the same reason the
// buckets above do: the chart is JSX that needs a DOM, and this can be tested
// without one. It also puts the mapping next to the carry formula it is fitted
// to, which is the point of the warning below.
//
// IMPORTANT, and the thing a future reader will otherwise miss: this scale is
// fitted to the output of carryDistance above. Change that formula and this
// must be re-checked and probably re-fitted, or the chart quietly starts
// lying again. That is not hypothetical. The scale this replaces,
//
//     Math.max(40, Math.min(200, 120 + (dist - 300) * 0.65))
//
// was correct for the old, dishonest distances (287-451ft, centred on 300).
// Fed the honest ones it collapsed the whole session into the infield and
// stacked every ball under 177 feet on the same spot at the plate. Seen in a
// browser on 14 August 2026.
//
// The range it is fitted to, from scripts/measure-swing-generation.mjs:
// shortest ball 74ft, median 224-259ft, 90th percentile 294-311ft, longest
// ball 390ft. Those map to radii of 68, about 126, about 152, and 186.

// A ball that carried nothing at all still has to be drawn somewhere, and that
// somewhere is a small ring around the plate rather than the plate itself, so
// the weakest contact is still visible as a mark.
export const SPRAY_PLATE_RADIUS = 40

// The foul lines and the edge of the fair-territory fill are drawn at 190 in
// the chart's own coordinates. Nothing may be placed beyond it.
export const SPRAY_FAIR_RADIUS = 190

// Feet-to-radius, chosen so the longest ball the generator can produce (390ft)
// lands at 186, just inside the fair boundary, and the shortest (74ft) lands
// clear of the plate ring. Everything in between spreads across the fan
// instead of piling up at either end.
const SPRAY_RADIUS_PER_FOOT = 0.375

export function sprayRadius(dist) {
  // A distance we know nothing about is not a ball that carried zero feet for
  // a reason, but it still has to render: drop it on the plate ring rather
  // than let a NaN push the dot off the chart entirely. Same call
  // carryDistance makes at the top of this file.
  if (!Number.isFinite(dist) || dist < 0) return SPRAY_PLATE_RADIUS

  // The Math.min is a safety rail, not part of the scale. Reaching it takes a
  // 400-foot ball, and the generator's hardest possible contact (97mph at 28
  // degrees) carries 390, so in normal running nothing ever touches it. It is
  // here only so that a future change to the carry formula draws a wrong dot
  // on the boundary instead of outside the ballpark.
  return Math.min(SPRAY_FAIR_RADIUS, SPRAY_PLATE_RADIUS + dist * SPRAY_RADIUS_PER_FOOT)
}

// The two labelled arcs on the chart. Radius and label are both derived from
// the scale above rather than written out by hand, so the printed distance and
// the arc it sits on cannot drift apart: that is exactly how the chart ended
// up with an outer ring labelled "400ft+" that no ball could ever reach. 200
// and 300 feet are chosen because the real distribution straddles them: the
// median ball falls between the two rings and the top tenth clears the outer
// one, so both rings carry information about the session being looked at.
export const SPRAY_RINGS = [200, 300].map((feet) => ({
  feet,
  radius: sprayRadius(feet),
  label: `${feet} ft`,
}))

// The one line of English both coach prompts use to describe the same
// distribution the chart draws. Written once so the debrief prompt and the
// chat prompt cannot describe different ranges to the model: before this they
// were two copies of the same filter logic that had to be kept in step by
// hand, and the chat prompt was the one nobody remembered to update.
export function distanceDistributionLine(swings) {
  return distanceBucketCounts(swings)
    .map(({ label, count }) => `${label}ft: ${swingCountPhrase(count)}`)
    .join(', ')
}
