// The one table of thresholds each goal's prompt prose names.
//
// Added in Slice 8b. The coach reliably repeats a count the prompt hands it
// and miscounts anything it derives itself, so every threshold a goal's
// prose names has to be pre-counted in the data block. That only works if
// the sentence naming a threshold and the count that will feed it read the
// same number: before this table, the direction cutoffs, the 82 mph
// hard-contact line, and the fly-ball, pop-up and grounder angles lived only
// inside goalContext's prose strings in src/coachApi.js, where no count
// could reach them. Now the prose interpolates them from here, the grader's
// fact sheet (scripts/factSheet.js) imports them from here, and the two
// cannot drift.
//
// Numbers that already have a shared home in goalTargets.js are read from
// there, never re-typed; only the prose-only numbers are defined in this
// file. A goal whose prose names no thresholds (open) is an absence, not an
// empty row, matching goalTargets' own convention.
//
// This lives in its own module rather than inside coachApi.js for the same
// mechanical reason sessionOneSwings.js does: the grader's fact sheet is
// imported by a plain Node script whose static imports resolve before any
// loader hook registers, so everything the fact sheet reaches must use full
// `.js` import extensions, and coachApi.js's own imports do not. coachApi.js
// re-exports the table, so app code and the bench still find it there.

import { goalTarget } from './goalTargets.js'

const POWER = goalTarget('power')
const CONTACT = goalTarget('contact')
const POPUP = goalTarget('popup')

export const GOAL_COUNT_SPECS = {
  power: {
    launchAngle: { min: POWER.launchAngle.min, max: POWER.launchAngle.max },
    exitVelocity: POWER.exitVelocity,
  },
  contact: {
    launchAngle: { min: CONTACT.launchAngle.min, max: CONTACT.launchAngle.max },
    exitVelocity: CONTACT.exitVelocity,
    // "Angles above 20 degrees are fly balls, not line drives." The exact
    // threshold every real "above 20 degrees" claim in the 96-debrief
    // fixture got wrong.
    flyBallAngle: 20,
  },
  allfields: {
    // "at least 3 swings pull side (direction below -15 degrees), at least 3
    // swings opposite field (direction above +15 degrees)". The same cutoffs
    // the spray chart's Pull/Center/Oppo legend draws.
    pullDirection: -15,
    oppoDirection: 15,
    // "Exit velocity 82+ mph indicates hard contact that challenges
    // fielders." Deliberately NOT the 85 or 88 other goals use; the three
    // disagreeing hard-contact numbers are their own queued item.
    hardContactExitVelocity: 82,
  },
  popup: {
    launchAngle: { min: POPUP.launchAngle.min, max: POPUP.launchAngle.max },
    // "eliminate pop-ups (launch angles above 35 degrees) while avoiding
    // weak grounders (launch angles below 5 degrees)".
    popUpAngle: 35,
    grounderAngle: 5,
  },
}

// The table flattened to the {metric: [values]} shape the grader's fact
// sheet takes as extraThresholds, so every threshold above gets a count row
// and a claim at any of them can be ruled on. Kept beside the table so the
// two representations cannot drift apart.
export function countSpecThresholds(goalId) {
  const spec = GOAL_COUNT_SPECS[goalId]
  if (!spec) return {}
  const out = {}
  const add = (metric, value) => {
    if (!Number.isFinite(value)) return
    if (!out[metric]) out[metric] = []
    out[metric].push(value)
  }
  if (spec.launchAngle) {
    add('launchAngle', spec.launchAngle.min)
    add('launchAngle', spec.launchAngle.max)
  }
  add('exitVelocity', spec.exitVelocity)
  add('launchAngle', spec.flyBallAngle)
  add('launchAngle', spec.popUpAngle)
  add('launchAngle', spec.grounderAngle)
  add('direction', spec.pullDirection)
  add('direction', spec.oppoDirection)
  add('exitVelocity', spec.hardContactExitVelocity)
  return out
}
