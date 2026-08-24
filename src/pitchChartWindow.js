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
