// What the debrief prompt hands the coach, as a data shape the grader can
// compare a claim against, so it can tell a count the coach was handed apart
// from one the coach worked out for itself.
//
// Slice 8b's own postscript named the mechanism this module exists to check:
// pre-counting a threshold sharply cuts the miscount rate on it, but a coach
// handed a correct count directly was still seen contradicting it in the very
// next sentence (Hit to All Fields, 18 August 2026 QA pass). "Was this claim
// handed or derived" is the question that distinguishes the two failure
// modes, and until now nothing in the grading pipeline could ask it.
//
// Two eras, because the before side of Slice 8c's own comparison grades
// debriefs the Slice 8b prompt generated, before the fly-ball threshold moved
// from 20 to 18 and before the strike-zone count lines existed at all.
// Classifying an old debrief with today's handed set would call a
// zone-derived claim "handed" when nothing handed it, and grade an "above 20"
// claim against a fact sheet with no 20 row. Era 'slice8b' describes the
// prompt as it stood then; era 'current' reads today's numbers straight out
// of GOAL_COUNT_SPECS so this module and the prompt cannot drift apart the
// way three separate copies of a threshold always eventually do in this
// project.

import { GOAL_COUNT_SPECS, goalCountValues } from '../src/goalCountSpecs.js'
import { SPRAY_CUTOFFS, STRIKE_ZONE } from '../src/sessionStats.js'
import { goalExtraThresholds } from './factSheet.js'

// Every era hands the coach these five numbers, regardless of goal.
const BASE_STAT_NAMES = ['avgExitVelocity', 'avgLaunchAngle', 'inZoneCount', 'totalSwings', 'topExitVelocity']

// The four zone-breakdown counts, handed starting in the current era's
// strike-zone count lines (Slice 8c). They go to every goal, since the zone
// breakdown is unconditional on which goal is active.
const ZONE_STAT_NAMES = ['outsideZoneCount', 'highPitchCount', 'lowPitchCount', 'widePitchCount']

// The three spray counts, handed starting in the current era's spray count
// lines (Slice 10). Like the zone lines above, they go to every goal, so a
// direction claim on Power is now a handed claim rather than a derived one.
// Getting this wrong is not only mis-attribution: claimVerdict's
// sibling-bucket rescue reads these thresholds to tell an ambiguous
// above/atLeast phrasing apart from a wrong count, and a swing sitting
// exactly on a cutoff is reachable, so a missing entry can only push a
// rescuable TRUE to FALSE.
const SPRAY_STAT_NAMES = ['pullSideCount', 'upTheMiddleCount', 'oppoFieldCount']

// Read from SPRAY_CUTOFFS rather than typed, for the same reason the goal
// shapes below read from GOAL_COUNT_SPECS: this module describing a cutoff
// the prompt no longer uses is the exact drift it exists to prevent.
const SPRAY_THRESHOLDS = [
  { metric: 'direction', threshold: SPRAY_CUTOFFS.pull, comparison: 'below' },
  { metric: 'direction', threshold: SPRAY_CUTOFFS.oppo, comparison: 'above' },
]

// The pitch-height thresholds the current era's zone lines name. Pitch side
// (wide) has no single-sided threshold in the prompt prose, only the
// widePitchCount stat, so it is not listed here.
//
// Read from STRIKE_ZONE since 21 August 2026, for exactly the reason
// SPRAY_CUTOFFS is read above and GOAL_COUNT_SPECS below: two numbers typed
// out here were a copy of the zone the prompt actually describes, and this
// module's whole job is to say which numbers the coach was handed. A copy
// that drifted would make it claim the coach was handed a threshold nobody
// ever sent. It was the cheapest of the strike zone's remaining copies to
// close, because this file already imported the module the bounds live in.
const ZONE_HEIGHT_THRESHOLDS = [
  { metric: 'pitchHeight', threshold: STRIKE_ZONE.heightMax, comparison: 'above' },
  { metric: 'pitchHeight', threshold: STRIKE_ZONE.heightMin, comparison: 'below' },
]

// The threshold and range lines a goal's own prose hands, independent of
// era: the launch angle, exit velocity and direction cutoffs the current
// prompt states. Built from GOAL_COUNT_SPECS so a change there cannot leave
// this module behind. The contact fly-ball line is era-dependent and is
// added separately in handedClaimSpecs, since it is the one number that
// actually changed between eras.
function goalHandedShape(goalId) {
  const spec = GOAL_COUNT_SPECS[goalId]
  const thresholds = []
  const ranges = []
  if (!spec) return { thresholds, ranges }

  switch (goalId) {
    case 'power':
      // Power's own 25-to-35-and-88+ window is a two-metric count, handed as
      // the powerZoneCount stat rather than a single-metric range or
      // threshold, so it carries no range entry here.
      thresholds.push({ metric: 'launchAngle', threshold: 15, comparison: 'below' })
      break
    case 'contact':
      thresholds.push({ metric: 'exitVelocity', threshold: spec.exitVelocity, comparison: 'atLeast' })
      ranges.push({ metric: 'launchAngle', min: spec.launchAngle.min, max: spec.launchAngle.max })
      break
    case 'allfields':
      thresholds.push({ metric: 'direction', threshold: spec.pullDirection, comparison: 'below' })
      thresholds.push({ metric: 'direction', threshold: spec.oppoDirection, comparison: 'above' })
      thresholds.push({ metric: 'exitVelocity', threshold: spec.hardContactExitVelocity, comparison: 'atLeast' })
      break
    case 'popup':
      thresholds.push({ metric: 'launchAngle', threshold: spec.popUpAngle, comparison: 'above' })
      thresholds.push({ metric: 'launchAngle', threshold: spec.grounderAngle, comparison: 'below' })
      ranges.push({ metric: 'launchAngle', min: spec.launchAngle.min, max: spec.launchAngle.max })
      break
    default:
      break
  }
  return { thresholds, ranges }
}

// The contact fly-ball threshold the two eras disagree about. Slice 8c
// (approved 18 August 2026) moved it from 20 to 18 so one number governs the
// goal; see the dated comment on GOAL_COUNT_SPECS.contact.flyBallAngle in
// src/goalCountSpecs.js for the reasoning. Era 'slice8b' hardcodes the old
// number so a debrief the old prompt actually produced keeps a matching row;
// era 'current' reads today's number rather than repeating it.
function flyBallThreshold(era) {
  return era === 'slice8b' ? 20 : GOAL_COUNT_SPECS.contact.flyBallAngle
}

// The full description of what the debrief prompt hands a coach on this
// goal, in this era: every threshold and range named in prose, the
// whole-session stat names, and whether the zone count lines are in play.
// goalId 'open' (and any id GOAL_COUNT_SPECS does not carry) is not an
// error: it simply adds no goal-specific thresholds, ranges or stat names,
// since Open Session's prose names none.
export function handedClaimSpecs(goalId, era = 'current') {
  if (era !== 'current' && era !== 'slice8b') {
    throw new Error(`handedClaimSpecs: unknown era "${era}"`)
  }

  const { thresholds, ranges } = goalHandedShape(goalId)
  const statNames = [...BASE_STAT_NAMES]

  if (goalId === 'contact') {
    thresholds.push({ metric: 'launchAngle', threshold: flyBallThreshold(era), comparison: 'above' })
  }

  for (const key of Object.keys(goalCountValues(goalId, []))) {
    statNames.push(`${key}Count`)
  }

  const zoneLines = era === 'current'
  if (zoneLines) {
    thresholds.push(...ZONE_HEIGHT_THRESHOLDS)
    statNames.push(...ZONE_STAT_NAMES)
  }

  // Slice 10's spray count lines, on the same era gate: they go to every goal
  // in the current prompt and existed in no form in the slice8b one. Hit to
  // All Fields already pushed the same two cutoffs from its own goal lines
  // above, in both eras, so the two sets overlap on that one goal and are
  // deduplicated below rather than described twice.
  const sprayLines = era === 'current'
  if (sprayLines) {
    thresholds.push(...SPRAY_THRESHOLDS)
    statNames.push(...SPRAY_STAT_NAMES)
  }

  const seen = new Set()
  const uniqueThresholds = thresholds.filter((t) => {
    const key = `${t.metric}:${t.threshold}:${t.comparison}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { thresholds: uniqueThresholds, ranges, statNames: [...new Set(statNames)], zoneLines, sprayLines }
}

// goalExtraThresholds, widened for a specific era: the slice8b prompt named
// "above 20 degrees" on contact, a threshold the current era's own table no
// longer carries (it moved to 18), so grading an old debrief's "above 20"
// claim still needs a row to be graded against. Every other goal and every
// current-era call is unchanged from goalExtraThresholds itself.
export function eraExtraThresholds(goalId, era = 'current') {
  const merged = goalExtraThresholds(goalId)
  if (era === 'slice8b' && goalId === 'contact') {
    merged.launchAngle = [...(merged.launchAngle ?? []), 20]
  }
  return merged
}
