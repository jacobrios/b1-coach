// Rebuild the exact session data each debrief was written about.
// Copied, as of 14 August 2026, from scripts/bench-coach-brevity.mjs
// (mulberry32, standInSessionOne, buildSessions, CELLS, the
// extensionless-import hook) rather than reimplemented, because that file is
// not structured to be imported (it calls main() unconditionally at module
// scope, which would try to make a live API call or exit the process). This
// is a read-only copy for analysis, not a second implementation of the
// algorithm.
//
// That copy is now deliberately frozen and out of step with the live bench.
// Slice 7b (17 August 2026) extracted session 1's real swings out of
// src/App.jsx and pointed the live bench at them, which removed
// standInSessionOne from scripts/bench-coach-brevity.mjs, changed its
// buildSessions, and grew CELLS from three entries to four. None of that
// belongs here. See the warning directly above standInSessionOne below.
//
// DATED ADDITION, 20 August 2026, SLICE 11. THE FREEZE ABOVE WAS ONLY HALF A
// FREEZE, AND NOBODY NOTICED FOR SIX DAYS.
//
// Everything above this paragraph is about the code written IN this file:
// standInSessionOne, buildSessions and CELLS were pinned and kept out of step
// with the live bench on purpose. That was right, and it was not enough.
// buildSessions below generates sessions 2 and later by calling the swing
// generator, and until today this file imported that generator out of the
// working tree. All three cells here are session 2 or later, so every one of
// them depended on a file this directory does not own and never mentioned.
//
// Slice 11 rewrites src/swingGenerator.js. From the moment it lands, a file
// that calls itself frozen would have rebuilt sessions 2 to 4 from the new
// generator, producing a complete and entirely plausible set of swings that
// none of the 96 debriefs in this directory was written about, with nothing
// looking broken. That matters more here than anywhere else in the repo: the
// grading tool FORCES this builder whenever it runs --validate, and --validate
// against these 96 debriefs is the whole basis on which that tool's ability to
// catch a real coach error was ever established.
//
// So the generator import below now reads the committed snapshot,
// docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs, which is a copy
// of the generator as it stood at commit 53315e5 and is pinned by hash on
// every npm test. On the day this line changed the two files were the same
// code, so the change moved not one swing; it was proven a no-op by rebuilding
// all three cells before and after and diffing them. It stops being a no-op
// the moment the generator is rewritten, which is the entire point of making
// it now rather than then.
//
// TWO IMPORTS ARE DELIBERATELY LEFT ON THE WORKING TREE, and saying which and
// why is more useful than a blanket claim that this file is now sealed.
//
//   computeStats, from src/sessionStats.js. It is not part of the generator.
//     It summarises swings that have already been decided, and no summary it
//     produces enters the record of what this file made. Same rule the grading
//     tool's own builder comment block states for every other builder.
//
//     Do not read that as "cannot affect a grade", which is a different claim.
//     The averages it computes DO reach the fact sheet a debrief is graded
//     against (scripts/factSheet.js reads session.stats.avgExitVelocity and
//     three of its neighbours), so a change to how they are worked out would
//     move a verdict. What covers that is src/sessionStats.test.js and nothing
//     in this task's machinery. Confirmed 20 August 2026 by making the app
//     truncate an average instead of rounding it: exactly one test went red,
//     in that file, and every guard here stayed green, which is correct rather
//     than a gap, since averages are not part of what this file records.
//
//   carryDistance, from src/ballFlight.js. This one IS a real residual and is
//     not being smoothed over. standInSessionOne calls it to work out how far
//     each session-1 swing carried, so a change to src/ballFlight.js would
//     change this fixture's session 1. It is not repointed at the snapshot for
//     one concrete reason: the snapshot's frozen copy of carryDistance is a
//     module-private function sitting INSIDE the snapshot's hashed region, so
//     exporting it would force the pinned hash to be re-pinned, and this
//     project has already decided in writing that a re-pin for convenience is
//     how that guard erodes. What protects it instead is loud rather than
//     structural: every swing this file produces, session 1 included, is now
//     recorded in docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json
//     and re-checked on every npm test, so a change to carryDistance turns
//     three named tests red instead of passing silently. Slice 11 does not
//     currently plan to touch src/ballFlight.js. If it does, the red is the
//     signal, and the fix is a frozen carry formula, never a new digest.
//
// DATED CORRECTION, 20 August 2026, HOURS AFTER THE PARAGRAPH ABOVE WAS
// COMMITTED. "A change to carryDistance turns three named tests red" is too
// strong, and it was caught by running the mutation rather than trusting the
// sentence. What is true is narrower, and the difference matters to whoever
// picks up the generator work:
//
//   A carryDistance change that reaches this fixture's session-1 swings does
//   turn the three cells red. Measured, by moving the potential term from
//   (exitSpeed - 45) * 7.5 to * 7.6: four tests red, the three cells plus the
//   seed-honesty test, which is also a comparison against the digest.
//
//   A carryDistance change confined to the ABOVE-28-DEGREES branch is
//   invisible here. Measured, by moving that branch's floor from 0.55 to 0.40,
//   which is the exact mutation this project's review used once before: all 31
//   tests in the guard file stayed green. The reason is in the data. The
//   working-tree carryDistance is called only for session 1, and this
//   fixture's 45 session-1 swings top out at 25 degrees, so nothing reaches
//   that branch. The 11 swings above 28 degrees in the digest are all in
//   sessions 2 and later, which come from the snapshot's own frozen copy and
//   are immune.
//
// SECOND DATED CORRECTION, 20 August 2026, and it moves the conclusion rather
// than a number, so read it before acting on either paragraph above.
//
// The passage above ended by calling carryDistance "a real residual rather than
// a covered one". That does not follow from the two measurements it just made,
// and it is wrong in the safe direction, which is the direction that still
// misleads: it tells a reader this fixture is exposed when its own evidence says
// it is watched.
//
// Read the two measurements together. The only carry changes this digest cannot
// see are ones this fixture never exercises. Its session 1 is built by
// standInSessionOne at a fixed seed, so its fifteen angles are the same fifteen
// angles forever; 0 of the 45 recorded session-1 swings sit above 28 degrees,
// and the highest is 25. The above-28 branch is not uncovered because the check
// is weak. It is uncovered because it is unreachable from here.
//
// So for THIS fixture the digest covers every carry change that can move a
// recorded number. The honest residual is narrower than the paragraph above
// claimed: it is that the coverage is a property of the data rather than of the
// wiring, ~~so it would stop holding the day somebody changes standInSessionOne,
// its seed, or its clamps, and nothing would announce that the cover had
// gone.~~
// The corresponding statement for the snapshot's own frozen copy, which the
// guard test's header records, is a different and wider blind spot, because that
// one is reached by real swings.
//
// THIRD DATED CORRECTION, 21 August 2026, on the struck half-sentence above,
// and it is the same conflation CLAUDE.md's copy of this warning had to have
// corrected out of it on the same day. Both were written by the same hand in
// the same hour and neither was measured before it was written down.
//
// The struck clause is false about its own named mechanism, which is the worst
// way for a warning to be wrong, because it sends a reader to check the wrong
// thing. Measured:
//
//   Changing standInSessionOne's SEED turns FOUR tests red, loudly. Nothing
//   about that is quiet. The digest pins all forty-five of its balls one by
//   one, so anything that moves a ball moves the record.
//
//   Raising its angle clamp from 35 to 55 does stay green, and that is not a
//   gap either: no ball reaches the clamp, so the cover did not change.
//
// The clause had confused what CREATES the cover, a fixed seed plus a record
// that pins every ball, with what creates the GAP, no ball hit steeply. What is
// actually true: the cover is complete for the shallow half of the carry
// formula and absent for the steep half, because none of the forty-five
// stand-in balls exceeds 28 degrees. That absence is a property of the data
// rather than a requirement anybody wrote down, so a future slice that
// legitimately re-pins the digest could change which half is covered with no
// test saying so.
//
// A frozen carry formula would make the cover structural instead of incidental.
// That is still worth doing; it is just not urgent for the reason first given.
//
// AND THE BLOCKER WAS OVERSTATED TOO. The paragraph above says the re-pin rule
// prevents this. What that rule actually rules out is EXPORTING carryDistance
// from the snapshot, which is genuinely closed. It does not rule out a separate
// frozen copy beside it, say
// docs/eval-fixtures/frozen/ball-flight-pre-slice11.mjs, which this file could
// import with no re-pin at all.
//
// That option was not taken, and declining it is a judgment rather than a
// constraint: this project consolidates hard against a second copy of a shipped
// formula, a second copy would need its own pin and its own provenance check to
// be worth anything, and the fixture is covered today for the reason above. Task
// 4 has the option, and should take it if it touches src/ballFlight.js. Whoever
// decides should know it is a choice, which the first version of this comment
// did not say.

import { register } from 'node:module'

const EXTENSIONLESS_RESOLVE_HOOK = `
  export async function resolve(specifier, context, nextResolve) {
    try {
      return await nextResolve(specifier, context)
    } catch (err) {
      const looksExtensionless = specifier.startsWith('.') && !/\\.[a-zA-Z0-9]+$/.test(specifier)
      if (err && err.code === 'ERR_MODULE_NOT_FOUND' && looksExtensionless) {
        return await nextResolve(specifier + '.js', context)
      }
      throw err
    }
  }
`
register('data:text/javascript,' + encodeURIComponent(EXTENSIONLESS_RESOLVE_HOOK), import.meta.url)

// Resolved from this file's own location (docs/eval-fixtures/slice7-debriefs/)
// rather than hardcoded, so the fixture still runs after a clone or a move.
// Was an absolute path while this lived in a scratch directory.
const REPO = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '')

// The frozen generator, not the working tree. Read the dated addition in this
// file's header for what this line used to say and what it cost.
//
// WHAT HOLDS THIS LINE IN PLACE, stated as what it actually holds rather than
// as what it was first claimed to. An earlier version of this comment said the
// test "stops this line quietly reverting to src/", which was measured and
// found false: the first version of that test checked only that the snapshot's
// path appeared somewhere in this file and that the identifier below was used,
// so changing what the identifier HOLDS passed all of it, with the whole suite
// green and this fixture rebuilding from the live generator.
//
// What is true now, and each half was proven by reopening the hole it closes:
// scripts/frozenGenerator.test.js asserts the assignment line below as a whole
// line, so what this constant is set to is what is checked, and it asserts that
// the path the grading script imports this file from is the path it read. That
// second half matters because without it the test can be made to inspect this
// file while the grader loads a copy.
//
// It is still a text check on a hand-run script rather than a guarantee, and
// two things follow. The header prose above may say whatever it needs to about
// src/swingGenerator.js, because nothing keys off the file as a whole any more.
// And if this line is ever legitimately changed, the test changes with it, in
// the same commit, or the suite says so.
const FROZEN_GENERATOR_PATH = `${REPO}/docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs`
const { generateSwingsPreSlice11: generateSwings } = await import(FROZEN_GENERATOR_PATH)
const { computeStats } = await import(`${REPO}/src/sessionStats.js`)
const { carryDistance } = await import(`${REPO}/src/ballFlight.js`)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SESSION_1_AVG_EV = 81.6
const SESSION_1_AVG_LA = 17.3333

// DO NOT RECONCILE THIS WITH THE LIVE BENCH. All 96 committed debriefs in
// this directory were written against this stand-in, not against the real
// session-1 swings the live bench now uses. Syncing this function (or
// buildSessions/CELLS below) to match scripts/bench-coach-brevity.mjs would
// silently invalidate all 8 known-wrong findings in regrade-report.md,
// because the rebuilt session data would no longer be what those debriefs
// were actually written about.
export function standInSessionOne(random) {
  return Array.from({ length: 15 }, () => {
    const quality = random() - 0.5
    const evNoise = random() - 0.5
    const laNoise = random() - 0.5
    const ev = Math.round(Math.max(65, Math.min(97, SESSION_1_AVG_EV + (0.6 * quality + 0.8 * evNoise) * 16)))
    const la = Math.round(Math.max(-5, Math.min(35, SESSION_1_AVG_LA + (0.6 * quality + 0.8 * laNoise) * 22)))
    const dir = Math.round((random() - 0.45) * 70)
    const inZonePitch = random() < 0.7
    const plateLocHeight = inZonePitch ? 1.5 + random() * 2.0 : random() < 0.5 ? 0.5 + random() * 0.9 : 3.6 + random() * 0.5
    const plateLocSide = inZonePitch ? -0.7 + random() * 1.4 : random() < 0.5 ? -0.8 - random() * 0.3 : 0.8 + random() * 0.3
    return {
      plateLocHeight: Math.round(plateLocHeight * 100) / 100,
      plateLocSide: Math.round(plateLocSide * 100) / 100,
      hit: {
        launch: { exitSpeed: ev, angle: la, direction: dir },
        landing: { distance: carryDistance({ exitSpeed: ev, angle: la }) },
      },
    }
  })
}

export function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = standInSessionOne(random)
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

export const CELLS = [
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2, why: 'the goal most visitors pick, early session' },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4, why: 'largest session, three priors to compare against' },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4, why: 'no target, so the coach has the most latitude' },
]

export const SEED = 20260814

// Cache: cellKey -> sessions array
const cache = new Map()
export function sessionsForCell(cellKey) {
  if (cache.has(cellKey)) return cache.get(cellKey)
  const cell = CELLS.find((c) => c.key === cellKey)
  if (!cell) throw new Error(`Unknown cell ${cellKey}`)
  const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: SEED })
  cache.set(cellKey, sessions)
  return sessions
}

export function viewingSessionSwings(cellKey) {
  const cell = CELLS.find((c) => c.key === cellKey)
  const sessions = sessionsForCell(cellKey)
  return sessions.find((s) => s.sessionNumber === cell.session).swings
}
