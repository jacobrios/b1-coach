// What the bench grades: the debrief a visitor reads, not the one the coach wrote.
//
// Since Slice 15 the coach does not type its per-swing numbers. It writes a
// placeholder such as {{s1.sw5.ev}} and the app puts the real digit there
// (fillDebriefNumbers in src/numberSlots.js, called from generateDebrief in
// src/coachApi.js). The bench used to grade the coach's raw reply, which
// would hand the grader placeholders it cannot rule on and flatter any round
// run after Slice 15. This module is the one place the bench does what the app
// does, so graded text is what a visitor would have seen.
//
// It also keeps the raw reply. Counting how often the coach actually used a
// placeholder (adoption) needs the text before filling, and that count has to
// come from the same live calls as the grading, not a second paid run.
//
// Its own module, not inline in bench-coach-brevity.mjs, because that script
// runs main() at import time and cannot be imported by a test without spending
// money. Same reasoning as coachFailureRecord.js.
import { fillDebriefNumbers } from '../src/numberSlots.js'
import { CoachCallError } from './coachFailureRecord.js'

// The five text fields in the shape the bench's grade() calls `fields`: the
// first two tips are read out of nextSessionTips as tip1 and tip2. Taken from
// the raw reply on purpose, so a tip the fill dropped cannot shift tip2 into
// tip1's place here.
function textFields(parsed) {
  const tips = Array.isArray(parsed?.nextSessionTips) ? parsed.nextSessionTips : []
  return {
    coachingSummary: parsed?.coachingSummary,
    whatThisMeans: parsed?.whatThisMeans,
    tipsIntro: parsed?.tipsIntro,
    tip1: tips[0],
    tip2: tips[1],
  }
}

// `sessions` must already be limited to the viewed session, exactly as the app
// limits them before filling; the bench's buildSessions({ upTo: cell.session })
// does that, and its session objects already carry the sessionNumber and swings
// the slot reader uses, so no adapter sits between them.
//
// A fill that throws (a required prose field emptied because it named a swing
// that does not exist) is left to throw here. fillOrFail below is what the bench
// calls, so the throw carries the reply with it.
export function fillForGrading(parsed, sessions) {
  return {
    filled: fillDebriefNumbers(parsed, sessions),
    rawFields: textFields(parsed),
  }
}

// fillForGrading for the bench's main loop. A fill that throws arrives at the
// bench's catch as a plain Error, and buildFailureRecord keeps evidence only
// for a CoachCallError, so the reply that could not be used would be lost on
// a paid call. This re-throws it as one, carrying the parsed reply as text
// (the original text is gone by now, parsing happened in callCoach) and the
// call's output token count when the caller has it. No stopReason: the call
// itself ended normally.
export function fillOrFail(parsed, sessions, { outputTokens = null } = {}) {
  try {
    return fillForGrading(parsed, sessions)
  } catch (err) {
    throw new CoachCallError(err.message, { rawText: JSON.stringify(parsed), outputTokens })
  }
}
