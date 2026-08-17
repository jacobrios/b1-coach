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
// Two more copies of these fifteen distances remain on purpose, in
// src/ballFlight.test.js and src/coachApi.test.js. Those are literal
// expected values inside an assertion, independent checks that these swings
// still sort into the right distance buckets and still feed the right
// numbers into the coach prompt, not further duplication to collapse away.
export const SESSION_ONE_SWINGS = [
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
