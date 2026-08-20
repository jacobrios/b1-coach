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

import { goalTarget, meetsTarget } from './goalTargets.js'
import { SPRAY_CUTOFFS, sprayBreakdown } from './sessionStats.js'

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
    // "Angles above 18 degrees are fly balls, not line drives." Was 20 until
    // Slice 8c (approved 18 August 2026): the band ends at 18, so the old 20
    // left 18-to-20 counted by neither number, and swing 10 of session 1
    // sits at exactly 20. One number now governs the goal: the band's own
    // ceiling, read here so it can never drift from goalTargets.js.
    flyBallAngle: CONTACT.launchAngle.max,
  },
  allfields: {
    // "at least 3 swings pull side (direction below -15 degrees), at least 3
    // swings opposite field (direction above +15 degrees)". The same cutoffs
    // the spray chart's Pull/Center/Oppo legend draws, and since Slice 10 read
    // from the one place that says so (SPRAY_CUTOFFS in sessionStats.js)
    // rather than typed again here. This goal's prose was already right about
    // where pull starts; what was wrong was the rest of the app not agreeing.
    pullDirection: SPRAY_CUTOFFS.pull,
    oppoDirection: SPRAY_CUTOFFS.oppo,
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
    if (!out[metric].includes(value)) out[metric].push(value)
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

// Every count line the debrief prompt states, computed once. The prompt
// renders these into English in src/coachApi.js and the grader's fact sheet
// (scripts/factSheet.js) flattens them into per-goal stats, so the count the
// coach was handed and the count a claim is graded against are the same
// number by construction, not by parallel arithmetic kept in step by tests.
// Keys are stable: the fact sheet derives stat names from them, and power's
// two keys keep their pre-8c stat names on purpose.
export function goalCountValues(goalId, swings) {
  const spec = GOAL_COUNT_SPECS[goalId]
  if (!spec) return {}
  const select = (pred) => {
    const hit = swings
      .map((sw, i) => ({ n: i + 1, launch: sw.hit.launch }))
      .filter(({ launch }) => pred(launch))
    return { count: hit.length, swings: hit.map((s) => s.n) }
  }
  switch (goalId) {
    case 'power':
      return {
        // Strictly below 15, matching the prompt's own "not including 15".
        // 15 is a prompt literal, not a goal target; the fact sheet's base
        // extras carry the same number.
        underFifteen: select((l) => l.angle < 15),
        powerZone: select((l) => meetsTarget('power', l)),
      }
    case 'contact':
      return {
        contactTargetBand: select((l) => l.angle >= spec.launchAngle.min && l.angle <= spec.launchAngle.max),
        contactHardHit: select((l) => l.exitSpeed >= spec.exitVelocity),
        contactFlyBall: select((l) => l.angle > spec.flyBallAngle),
      }
    case 'allfields': {
      // Delegated to the shared breakdown rather than filtered again here, as
      // of Slice 10. This goal's two counts and the universal spray count
      // lines every goal now gets are the same arithmetic run once, so the
      // coach cannot be handed two answers about which swings it pulled.
      const spray = sprayBreakdown(swings)
      return {
        pullSide: spray.pull,
        oppoField: spray.oppo,
        allfieldsHardContact: select((l) => l.exitSpeed >= spec.hardContactExitVelocity),
      }
    }
    case 'popup':
      return {
        popUp: select((l) => l.angle > spec.popUpAngle),
        weakGrounder: select((l) => l.angle < spec.grounderAngle),
        popupTargetBand: select((l) => l.angle >= spec.launchAngle.min && l.angle <= spec.launchAngle.max),
      }
    default:
      return {}
  }
}
