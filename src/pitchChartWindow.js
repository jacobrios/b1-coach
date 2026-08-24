// The window the Pitch Location vs Outcome chart draws, and what to do with a
// pitch that lands outside it.
//
// Extracted from DebriefScreen.jsx for the reason scrollFade.js and
// chartSlots.js were extracted before it: this project has no rendering tests
// by design, so a decision that lives inside a chart component cannot be
// checked by anything. Pulling the geometry out means the numbers can be held
// to their sources by the suite, and only the drawing itself is left to the
// eye.
//
// THE DEFECT THIS FIXES. Both axes used to stretch to fit whatever the session
// happened to hold. So the drawn strike zone changed shape from one session to
// the next: mostly it looked roughly square, and then one session in three
// arrived with a pitch well off the plate and the same zone rendered visibly
// narrow. Measured across 60,000 generated sessions on 24 August 2026, the
// horizontal axis spanned 2.03 feet in a typical session, 1.70 at its
// narrowest and 3.29 at its widest. A strike zone that changes shape while the
// player clicks through four sessions is the app looking like it does not know
// the sport, which is the same class of first-screen credibility defect as the
// impossible hit distances Slice 6 removed.
//
// Both windows are fixed now, so the zone is drawn at exactly the same shape on
// every session, on every goal.

import { STRIKE_ZONE } from './sessionStats'
import { PITCH_MISS_MAX_FEET } from './swingGenerator'
import { meetsTarget } from './goalTargets'

// Breathing room between the furthest pitch the generator can throw and the
// edge of the chart, so a real pitch never sits on the frame.
export const PITCH_WINDOW_PAD_FEET = 0.1

// Both readings are rounded to the hundredth of a foot, because 3.5 + 0.8 + 0.1
// is 4.3999999999999995 in floating point and an axis label reading 4.4 should
// be backed by the number 4.4. The generator rounds its own pitches to the
// hundredth for the same reason, so nothing is lost by matching it.
const toHundredth = (feet) => Math.round(feet * 100) / 100

export const PITCH_CHART_WINDOW = {
  // A DECISION, not a derivation, and deliberately NARROWER than the widest
  // pitch this app can produce (1.5 feet: the edge of the zone plus the
  // furthest a pitch may miss it by). Chosen by the product manager on rendered
  // mockups, and the reasoning is about shape rather than coverage. A real
  // strike zone is 17 inches wide and about 24 tall, so it is taller than it is
  // wide. This panel is wider than it is tall and has to carry a four-foot
  // vertical range, so the drawn zone comes out wider than tall whatever we do:
  // 1.63 times wider at a window of plus or minus 1.0 feet, 1.36 times at 1.2.
  // Neither is faithful. 1.2 is the closer of the two and is what shipped.
  //
  // Widening this to cover the full 1.5 would undo the point of the change and
  // would also make the chevron below dead code. Do not "fix" it that way.
  side: { min: -1.2, max: 1.2 },

  // DERIVED, and the opposite decision to the one above: nothing may ever fall
  // off the top or the bottom, because a pitch clipped vertically is a swing
  // the visitor simply cannot see. The generator's true pitch height range is
  // the zone's own top and bottom plus the furthest a pitch may miss by, which
  // is 0.70 to 4.30 feet; measured over 900,000 generated pitches on 24 August
  // 2026, those exact two numbers are what it reaches. The pad puts the frame
  // clear of both.
  height: {
    min: toHundredth(STRIKE_ZONE.heightMin - PITCH_MISS_MAX_FEET - PITCH_WINDOW_PAD_FEET),
    max: toHundredth(STRIKE_ZONE.heightMax + PITCH_MISS_MAX_FEET + PITCH_WINDOW_PAD_FEET),
  },
}

// Whether a pitch got away past the side of the window, and which way.
// 'left', 'right', or null for a pitch the chart can draw where it belongs.
//
// Exactly on the edge counts as inside. That is the honest answer rather than a
// convenience: the chart really can show a pitch at 1.20 feet, at its own edge,
// so calling it "off the chart" would be the false statement. It is a case that
// genuinely occurs, not a floating-point curiosity, because the generator
// rounds every pitch to the hundredth of a foot: measured on 24 August 2026, a
// pitch lands on exactly 1.20 feet about once in a thousand, which is about one
// session in seventy.
export function sideBeyondWindow(side) {
  if (side < PITCH_CHART_WINDOW.side.min) return 'left'
  if (side > PITCH_CHART_WINDOW.side.max) return 'right'
  return null
}

// Where the chart plots a pitch, as opposed to where the pitch actually was.
// They differ only for a pitch outside the window, which is pulled back to the
// edge it left by so that it has somewhere to be drawn.
//
// This is the number the axis reads. The true coordinate stays on the swing and
// is what the tooltip shows, and that split is the whole reason the chevron is
// honest: the mark sits at the edge because it has to sit somewhere, it is
// drawn as a chevron rather than a dot so nobody reads it as a position, and
// the real figure is one hover away. A clamped DOT would have been a false
// statement about position on a chart whose entire subject is position.
export function plottedSide(side) {
  return Math.min(Math.max(side, PITCH_CHART_WINDOW.side.min), PITCH_CHART_WINDOW.side.max)
}

// ── The rows the chart plots, and the marks it draws them as ──────────────
//
// Everything below this line was moved out of DebriefScreen.jsx on 24 August
// 2026, in the fix round on this same change, and the reason is worth stating
// because the first version of this module got it wrong. That version extracted
// the ARITHMETIC and left the RULES in the chart, so six one-line edits each
// broke the fix while the whole suite stayed green. All six were lines in
// DebriefScreen.jsx as it then stood, and they are worth naming rather than
// summarising, because a later reader will want to check them: the tooltip
// pointed at the clamped number instead of the true one; the axis pointed back
// at the true number instead of the clamped one; the chevron branch disabled;
// the clamp dropped from plotX; `beyond` forced to null; and the chevron drawn
// outward into the clip. Three of those six lines now live in THIS file (the
// clamp, `beyond`, and the chevron's direction), which is exactly why they are
// covered by real tests below rather than by a text tripwire. The other three
// are still in the screen and are covered by tripwires. A test that cannot see
// any of them is guarding the easy half.


// One row per swing, in the shape the chart reads.
//
// The naming carries the guarantee: `x` is the pitch's REAL position and keeps
// the honest name, `plotX` is the derived one the axis reads. Anything that
// wants to tell a visitor where a pitch was uses `x`; only the axis uses
// `plotX`. That is what stops a tooltip reporting 1.20 feet for a pitch that
// was at 1.32, which is the exact false statement this whole change exists to
// prevent.
export function pitchChartRows(swings, goalId) {
  return swings.map((sw, i) => {
    const { exitSpeed, angle, direction } = sw.hit.launch
    return {
      x: sw.plateLocSide,
      plotX: plottedSide(sw.plateLocSide),
      beyond: sideBeyondWindow(sw.plateLocSide),
      y: sw.plateLocHeight,
      exitSpeed,
      angle,
      direction,
      outcome: meetsTarget(goalId, sw.hit.launch),
      swing: i + 1,
    }
  })
}

// How far in from the edge the chevron's arms sit, and how tall it is, in
// pixels. Exported so the test measures the shipped numbers rather than a copy.
export const CHEVRON_REACH_PX = 7
export const CHEVRON_RISE_PX = 6

// The chevron's three points: tip on the window edge, both arms INWARD.
//
// The inward part is not a style choice and must not be "tidied" into a
// symmetrical arrow. Pinning the horizontal axis makes Recharts clip this whole
// layer to the plot area exactly, so anything drawn past the edge is cut off.
// An outward-pointing chevron would be eaten by that clip and the visitor would
// lose the swing entirely, which is worse than the false position the chevron
// exists to avoid.
export function chevronPoints({ cx, cy, beyond }) {
  const inward = beyond === 'left' ? 1 : -1
  const arm = cx + inward * CHEVRON_REACH_PX
  return `${arm},${cy - CHEVRON_RISE_PX} ${cx},${cy} ${arm},${cy + CHEVRON_RISE_PX}`
}

// Whether a chevron should be painted in the on-target colour.
//
// Added 24 August 2026, and it corrects a real defect in the first version of
// this change rather than polishing it. The chevron overrides whatever styling
// a mark would otherwise have had, and the first version described that as
// costing only the spray colouring on Hit to All Fields. It also overrode the
// ON-TARGET colouring on the three goals that have a target, so a swing that
// met its goal could be drawn as a plain neutral arrow on a chart headed "Pitch
// Location vs Outcome". Measured over 54,000 sessions on those three goals:
// 23.6% of chevrons are swings that met the goal, and 7.36% of sessions, about
// one in fourteen, showed a win that way. Withholding a success from the player
// is the opposite of what this screen is for.
//
// Hit to All Fields stays neutral, deliberately. That goal has no target, so
// there is no success to report, and its marks are coloured by where the ball
// went instead. A chevron painted in a spray colour would carry two different
// directions at once: the arrow points where the PITCH went outside, while the
// colour would mean where the BALL was hit. One mark cannot say both.
export function chevronIsOnTarget({ goalId, outcome }) {
  if (goalId === 'allfields') return false
  return outcome === true
}
