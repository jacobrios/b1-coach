// The fifteen swings of session 1, the scripted practice session every
// visitor sees on their very first debrief. Not generated: unlike every
// other session in this app, these are hand-written, not produced by
// generateSwings in src/swingGenerator.js. Every later session is built off
// these fifteen swings' averages as its baseline, regardless of session
// number (see onNewSession in src/App.jsx).
//
// Extracted out of App.jsx in Slice 7b. Before this, the array lived inside
// the App() component, which contains JSX, so no plain Node script could
// import it — that is the whole reason scripts/measure-swing-generation.mjs
// and scripts/compare-distance-bucket-schemes.mjs each carried their own
// hand-copied duplicate, and it is also the reason the eval bench
// (scripts/bench-coach-brevity.mjs) could not grade the first debrief a real
// visitor sees. This module is what makes both of those importable instead
// of copied. The values below are byte-identical to the array this replaces.
//
// The `distance` field on each swing is carryDistance({ exitSpeed, angle })
// from src/ballFlight.js, not an independent number — it was recomputed
// against the honest carry formula in Slice 6. src/sessionOneSwings.test.js
// pins that relationship so a wrong distance here turns the suite red
// instead of sitting silent on the one screen every visitor is guaranteed to
// open on.
//
// Known open item, pre-existing and untouched by this extraction: sorted by
// exit velocity, the fifteen launch angles climb in near-lockstep, an almost
// perfect straight line rather than the scatter a real hitter would produce.
// That belongs to the session-1 rewrite named in CLAUDE.md's What's Next
// list, not to this extraction, which only moved the array and did not
// change a single value in it.
//
// CLOSED 19 August 2026, in Slice 9. The straight line is gone: fifteen new
// swings replace the old ones below, found by a seeded search
// (scripts/search-session-one-swings.mjs) rather than hand-picked, and
// checked against every invariant this file's own test pins, including a
// correlation band and a gap-distribution rule that specifically rules out a
// ramp. The full reasoning, what was rejected and why, and the rendered
// verification live in docs/slice-9-plan.md, not here.
//
// What the fifteen swings are now calibrated to, and why the two sums below
// must never be hand-edited. Session 1 is not just fifteen numbers a visitor
// reads once: it is the seed every later session grows from. generateSwings
// in src/swingGenerator.js reads exactly two floats off this baseline, the
// mean exit velocity and the mean launch angle (see prevEV/prevLA), and
// nothing else about these fifteen swings. That is why the search held the
// sum of exit velocities at exactly 1224 and the sum of launch angles at
// exactly 260 as hard constraints rather than incidental outcomes: those two
// sums are the averages a visitor's session 2, 3 and 4 are built from. A
// future edit that nudges one swing's exit velocity by even a single mph to
// "smooth out" a number changes the sum, which silently changes the baseline
// every generated session in the app regenerates from, on every visit, for a
// reason nobody watching the screen could see. If a value here ever needs to
// change, change another value in the same field to hold its sum, and rerun
// src/sessionOneSwings.test.js's "both session averages are held exactly"
// block before trusting the result.
//
// Two more copies of these fifteen distances remain on purpose, in
// src/ballFlight.test.js and src/coachApi.test.js. Those are literal
// expected values inside an assertion, independent checks that these swings
// still sort into the right distance buckets and still feed the right
// numbers into the coach prompt, not further duplication to collapse away.
export const SESSION_ONE_SWINGS = [
  { plateLocHeight: 2.8, plateLocSide:  0.2, hit: { launch: { exitSpeed: 86, angle: 22, direction:  13 }, landing: { distance: 272 } } },
  { plateLocHeight: 1.2, plateLocSide: -0.3, hit: { launch: { exitSpeed: 72, angle:  8, direction:  11 }, landing: { distance: 122 } } },
  { plateLocHeight: 3.1, plateLocSide: -0.5, hit: { launch: { exitSpeed: 76, angle: 19, direction: -24 }, landing: { distance: 192 } } },
  { plateLocHeight: 2.3, plateLocSide:  0.9, hit: { launch: { exitSpeed: 75, angle: 13, direction:  -9 }, landing: { distance: 159 } } },
  { plateLocHeight: 2.6, plateLocSide:  0.4, hit: { launch: { exitSpeed: 92, angle: 27, direction:  29 }, landing: { distance: 346 } } },
  { plateLocHeight: 3.8, plateLocSide:  0.1, hit: { launch: { exitSpeed: 81, angle: 24, direction:  -9 }, landing: { distance: 249 } } },
  { plateLocHeight: 2.1, plateLocSide: -0.6, hit: { launch: { exitSpeed: 89, angle: 15, direction: -22 }, landing: { distance: 246 } } },
  { plateLocHeight: 2.9, plateLocSide:  0.3, hit: { launch: { exitSpeed: 87, angle: 20, direction:  24 }, landing: { distance: 266 } } },
  { plateLocHeight: 1.4, plateLocSide:  0.5, hit: { launch: { exitSpeed: 74, angle: 24, direction:  21 }, landing: { distance: 201 } } },
  { plateLocHeight: 3.3, plateLocSide: -0.4, hit: { launch: { exitSpeed: 78, angle: 22, direction:  -6 }, landing: { distance: 219 } } },
  { plateLocHeight: 2.7, plateLocSide:  0.6, hit: { launch: { exitSpeed: 87, angle: 14, direction:  -5 }, landing: { distance: 229 } } },
  { plateLocHeight: 0.8, plateLocSide: -0.2, hit: { launch: { exitSpeed: 78, angle:  2, direction:  17 }, landing: { distance: 117 } } },
  { plateLocHeight: 2.4, plateLocSide: -0.3, hit: { launch: { exitSpeed: 89, angle: 25, direction:   7 }, landing: { distance: 311 } } },
  { plateLocHeight: 3.6, plateLocSide:  0.8, hit: { launch: { exitSpeed: 78, angle: 19, direction:   8 }, landing: { distance: 204 } } },
  { plateLocHeight: 2.5, plateLocSide:  0.1, hit: { launch: { exitSpeed: 82, angle:  6, direction: -20 }, landing: { distance: 156 } } },
]
