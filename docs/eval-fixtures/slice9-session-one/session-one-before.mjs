// The fifteen session-1 swings AS THEY STOOD BEFORE SLICE 9 REWROTE THEM.
// Recovered with `git show 8b07ab0:src/sessionOneSwings.js`, not retyped, and
// deliberately frozen from the moment it was committed.
//
// WHY THIS FILE EXISTS
// The 64 debriefs in ./before/shipped-64.json were written by the coach on
// 19 August 2026 against these fifteen swings, at commit 8b07ab0, before the
// rewrite. Everything the coach said in that round (every swing number,
// every exit velocity, every launch angle, every distance, every count) is a
// statement about the numbers below and about the sessions 2 to 4 generated
// off their two averages. Slice 9 then replaced all fifteen in
// src/sessionOneSwings.js, so the working tree no longer holds what that
// round was written about.
//
// Grading the before round against src/sessionOneSwings.js as it stands
// today does not fail, and that is exactly the danger: it produces a
// complete, plausible-looking fact sheet for the wrong fifteen swings, and
// every verdict computed from it is garbage that reads like a result. The
// before/after comparison this slice exists to make would be worthless and
// nothing on screen would say so.
//
// DO NOT "UPDATE" THIS FILE. Not to match src/sessionOneSwings.js, not to
// fix a value that looks wrong, not to keep it in step with anything. It is
// a record of what was, in the same spirit as
// docs/eval-fixtures/slice7-debriefs/rebuild.mjs, which freezes the previous
// generation's stand-in session 1 for the identical reason one generation
// earlier. If session 1 is ever rewritten again, that rewrite writes its own
// new snapshot beside its own new records; it does not touch this one.
//
// The export is named SESSION_ONE_SWINGS_BEFORE rather than
// SESSION_ONE_SWINGS on purpose, so an import of this file can never be
// mistaken at a glance for an import of the live module. The fifteen values
// themselves are byte-identical to the recovered file.
//
// Read by scripts/grade-coach-accuracy.mjs's "slice9-before" session
// builder, which is the only supported way to grade the before round.
export const SESSION_ONE_SWINGS_BEFORE = [
  { plateLocHeight: 2.8, plateLocSide:  0.2, hit: { launch: { exitSpeed: 78, angle: 12, direction:   2 }, landing: { distance: 170 } } },
  { plateLocHeight: 1.2, plateLocSide: -0.3, hit: { launch: { exitSpeed: 72, angle:  8, direction: -18 }, landing: { distance: 122 } } },
  { plateLocHeight: 3.1, plateLocSide: -0.5, hit: { launch: { exitSpeed: 88, angle: 26, direction:   1 }, landing: { distance: 310 } } },
  { plateLocHeight: 2.3, plateLocSide:  0.9, hit: { launch: { exitSpeed: 75, angle:  6, direction: -10 }, landing: { distance: 126 } } },
  { plateLocHeight: 2.6, plateLocSide:  0.4, hit: { launch: { exitSpeed: 91, angle: 28, direction:   3 }, landing: { distance: 345 } } },
  { plateLocHeight: 3.8, plateLocSide:  0.1, hit: { launch: { exitSpeed: 82, angle: 18, direction: -15 }, landing: { distance: 224 } } },
  { plateLocHeight: 2.1, plateLocSide: -0.6, hit: { launch: { exitSpeed: 76, angle: 10, direction:   6 }, landing: { distance: 150 } } },
  { plateLocHeight: 2.9, plateLocSide:  0.3, hit: { launch: { exitSpeed: 85, angle: 24, direction:  -1 }, landing: { distance: 277 } } },
  { plateLocHeight: 1.4, plateLocSide:  0.5, hit: { launch: { exitSpeed: 79, angle: 14, direction:  22 }, landing: { distance: 185 } } },
  { plateLocHeight: 3.3, plateLocSide: -0.4, hit: { launch: { exitSpeed: 83, angle: 20, direction:   5 }, landing: { distance: 241 } } },
  { plateLocHeight: 2.7, plateLocSide:  0.6, hit: { launch: { exitSpeed: 87, angle: 22, direction:  -3 }, landing: { distance: 279 } } },
  { plateLocHeight: 0.8, plateLocSide: -0.2, hit: { launch: { exitSpeed: 70, angle:  4, direction:  12 }, landing: { distance:  97 } } },
  { plateLocHeight: 2.4, plateLocSide: -0.3, hit: { launch: { exitSpeed: 86, angle: 25, direction: -24 }, landing: { distance: 290 } } },
  { plateLocHeight: 3.6, plateLocSide:  0.8, hit: { launch: { exitSpeed: 80, angle: 16, direction:  18 }, landing: { distance: 201 } } },
  { plateLocHeight: 2.5, plateLocSide:  0.1, hit: { launch: { exitSpeed: 92, angle: 27, direction:   1 }, landing: { distance: 346 } } },
]
