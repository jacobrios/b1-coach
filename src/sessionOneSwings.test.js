// Pins every one of session 1's fifteen hand-written distances to what the
// honest carry formula actually produces for that swing's own exit speed and
// angle. Added in Slice 7b, closing the "pin the fifteen hand-written
// session-1 distances" item on CLAUDE.md's What's Next list: before this,
// nothing checked those distances at all, and a reviewer changing one from
// 170 to a physically impossible 999 left every existing test green.

import { describe, it, expect } from 'vitest'
import { SESSION_ONE_SWINGS } from './sessionOneSwings.js'
import { carryDistance } from './ballFlight.js'

describe('session 1 has exactly fifteen swings', () => {
  it('is fifteen long', () => {
    expect(SESSION_ONE_SWINGS).toHaveLength(15)
  })
})

describe('every stored distance equals carryDistance of its own swing', () => {
  it.each(SESSION_ONE_SWINGS.map((swing, index) => [index, swing]))(
    'swing %i (exit speed and angle determine the stored distance)',
    (_index, swing) => {
      const { exitSpeed, angle } = swing.hit.launch
      expect(swing.hit.landing.distance).toBe(carryDistance({ exitSpeed, angle }))
    },
  )
})

// ---------------------------------------------------------------------------
// Slice 9 (session 1 rewrite): invariant tests written and confirmed red or
// green against TODAY'S swings, before a single value in this file's data
// changes. Three of the eight invariants named in the slice 9 plan fail
// naturally against today's data: the on-target counts, the correlation
// band, and the launch-angle half of the no-progression check. The other
// five (plus the exit-velocity half of the progression check) pass today,
// which makes each one worthless as written until it has been seen to fail
// on a deliberate, fully-reverted mutation; every mutation performed and its
// observed failure output are recorded in
// .superpowers/sdd/slice-9-plan/task-1-report.md rather than restated here,
// so this file cannot silently drift out of step with what was actually run.
// ---------------------------------------------------------------------------

import { meetsTarget } from './goalTargets.js'
import { GOAL_COUNT_SPECS } from './goalCountSpecs.js'
import { inStrikeZone } from './sessionStats.js'
import { generateSwings } from './swingGenerator.js'

// Pearson correlation coefficient between two equal-length numeric arrays.
// Kept local to this file: nothing in src/ needs it outside this one test,
// and a shared module would exist purely to hold one caller's math.
function pearsonCorrelation(xs, ys) {
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY)
    varianceX += (xs[i] - meanX) ** 2
    varianceY += (ys[i] - meanY) ** 2
  }
  return covariance / Math.sqrt(varianceX * varianceY)
}

// The share of a sorted array's consecutive gaps taken by its single most
// common gap value. A dead-straight ramp's share is 100%: every gap is the
// same size. Real, noisy data spreads its gaps across several sizes, so no
// one size dominates.
//
// This replaced a first version, distinctConsecutiveGaps, that counted how
// many DIFFERENT gap sizes appeared rather than how they were distributed.
// That is a weak proxy and was caught in review of this task's fix round 1
// (19 August 2026): a near-perfect ramp of twelve identical gaps plus two
// single-point perturbations, a stray 1 and a stray 3 alongside a dominant
// 2, produces three distinct gap values and would have PASSED the old rule
// outright, despite still reading overwhelmingly as a straight line. See
// the mutation proof in task-1-report.md, which constructs exactly that
// sequence and confirms this rule catches it where the old one would not
// have. distinctConsecutiveGaps is gone; nothing else in this file used it.
function maxGapShare(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const gapCounts = new Map()
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1]
    gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1)
  }
  const totalGaps = sorted.length - 1
  const mostCommonGapCount = Math.max(...gapCounts.values())
  return mostCommonGapCount / totalGaps
}

describe('on-target counts, via the same functions the goal cards and prompts use', () => {
  // Fails naturally against today's data. Today's fifteen swings sit almost
  // exactly on a straight line (see CLAUDE.md's "known open item" on session
  // 1), which is why every one of these five counts lands on the wrong
  // side: today reads 3 / 0 / 9 / 2 / 2 against the 2 / 2 / 11 / 3 / 4 the
  // rewrite is asked to produce. This is the test the rewrite exists to turn
  // green.
  it('has 2 swings on target for Power', () => {
    const onTarget = SESSION_ONE_SWINGS.filter((w) => meetsTarget('power', w.hit.launch)).length
    expect(onTarget).toBe(2)
  })

  it('has 2 swings on target for Line Drives & Contact', () => {
    const onTarget = SESSION_ONE_SWINGS.filter((w) => meetsTarget('contact', w.hit.launch)).length
    expect(onTarget).toBe(2)
  })

  it('has 11 swings on target for Reduce Pop-Ups', () => {
    const onTarget = SESSION_ONE_SWINGS.filter((w) => meetsTarget('popup', w.hit.launch)).length
    expect(onTarget).toBe(11)
  })

  it('has 3 swings pulled, past GOAL_COUNT_SPECS.allfields.pullDirection', () => {
    const pulled = SESSION_ONE_SWINGS.filter(
      (w) => w.hit.launch.direction < GOAL_COUNT_SPECS.allfields.pullDirection,
    ).length
    expect(pulled).toBe(3)
  })

  it('has 4 swings opposite field, past GOAL_COUNT_SPECS.allfields.oppoDirection', () => {
    const oppo = SESSION_ONE_SWINGS.filter(
      (w) => w.hit.launch.direction > GOAL_COUNT_SPECS.allfields.oppoDirection,
    ).length
    expect(oppo).toBe(4)
  })
})

describe('exit velocity and launch angle read as a hitter, not a ruler', () => {
  // Fails naturally against today's data. Today's fifteen swings correlate
  // at about 0.975: sort by exit velocity and the launch angles climb in
  // near-lockstep. A real hitter's contact quality varies swing to swing, so
  // the swing generator itself only couples the two at 0.6 (see
  // CONTACT_CORRELATION in swingGenerator.js, and its own comment on why an
  // uncorrelated 0 was rejected too). The band below asks the rewritten
  // session to read as noisy as a real hitter without demanding it be as
  // loosely coupled as two fully independent draws.
  it('correlates between 0.20 and 0.55', () => {
    const exitVelocities = SESSION_ONE_SWINGS.map((w) => w.hit.launch.exitSpeed)
    const launchAngles = SESSION_ONE_SWINGS.map((w) => w.hit.launch.angle)
    const r = pearsonCorrelation(exitVelocities, launchAngles)
    expect(r).toBeGreaterThanOrEqual(0.2)
    expect(r).toBeLessThanOrEqual(0.55)
  })
})

describe('neither exit velocity nor launch angle reads as a ramp', () => {
  // A sorted list of fifteen values where one gap size dominates the other
  // fourteen consecutive gaps reads as a ramp, not a hitter's spread. The
  // threshold is a share, not a count: no single gap size may account for
  // more than 60% of the fourteen gaps. (This rule replaced a first version
  // that counted DISTINCT gap sizes instead of their distribution and was
  // caught as a weak proxy in review; see maxGapShare's own comment above
  // for the near-ramp sequence that exposed it and the mutation proof in
  // task-1-report.md that confirms this version catches it.)
  //
  // The two halves below disagree today, which is why this slice's plan
  // calls test 3 out specially. Launch angle fails naturally: the gap of 2
  // accounts for 10 of today's fourteen gaps, 71%, well past the 60% line.
  // Exit velocity happens to PASS today, at 8 of 14 gaps of size 1 (57%),
  // purely because the hand-picked exit speeds are not quite as evenly
  // spaced as the angles are, not because anyone verified the
  // exit-velocity spread is realistic. A test that passes by accident is
  // not evidence, so this half was proven with a deliberate mutation before
  // being trusted here: a constructed near-ramp sequence (twelve gaps of 2,
  // one gap of 1, one gap of 3) that the OLD distinct-count rule would have
  // passed outright, confirmed red under this rule. See task-1-report.md.
  //
  // A second, complementary check (for example, requiring the gaps
  // themselves not be monotonically ordered) was considered and not added.
  // With only fourteen gaps across fifteen swings, a rule that also
  // penalizes clustering risks flagging a legitimately plausible hitter who
  // happened to bunch a few similar-quality swings together. The
  // share-based rule already targets the exact failure mode this fix
  // responds to, one gap size dominating, and it is backed by a mutation
  // proof built specifically to defeat the rule it replaced. A second rule
  // was judged to add complexity without closing a gap known to matter for
  // fifteen real data points; revisit only if a future sequence is found
  // that defeats this rule specifically.
  it('launch angle: no single gap size accounts for more than 60% of the fourteen gaps', () => {
    const launchAngles = SESSION_ONE_SWINGS.map((w) => w.hit.launch.angle)
    expect(maxGapShare(launchAngles)).toBeLessThanOrEqual(0.6)
  })

  it('exit velocity: no single gap size accounts for more than 60% of the fourteen gaps', () => {
    const exitVelocities = SESSION_ONE_SWINGS.map((w) => w.hit.launch.exitSpeed)
    expect(maxGapShare(exitVelocities)).toBeLessThanOrEqual(0.6)
  })
})

describe('both session averages are held exactly', () => {
  // This is the invariant the entire slice rests on: Option A, "hold the two
  // averages," settled 19 August 2026. Every later session's baseline comes
  // from session 1's own averages inside generateSwings, so if the rewrite
  // moves either sum by even one point, sessions 2 through 4 change with it,
  // even though nothing about them was touched directly. Passes today only
  // because these are today's own sums, which makes it worthless until seen
  // to fail; see task-1-report.md for the mutation (one swing's exit
  // velocity moved by 1) and the observed failure.
  it('exit velocities sum to 1224', () => {
    const sum = SESSION_ONE_SWINGS.reduce((s, w) => s + w.hit.launch.exitSpeed, 0)
    expect(sum).toBe(1224)
  })

  it('launch angles sum to 260', () => {
    const sum = SESSION_ONE_SWINGS.reduce((s, w) => s + w.hit.launch.angle, 0)
    expect(sum).toBe(260)
  })
})

describe('strike zone count stays 9 of 15', () => {
  // Pitch location is outside this slice's scope; Option A holds the two
  // swing-quality averages and says nothing about plateLocHeight or
  // plateLocSide, so the zone count should come out the same after the
  // rewrite as before it. Passes today only because 9 is today's own count,
  // which makes it worthless until seen to fail; see task-1-report.md for
  // the mutation (one out-of-zone pitch moved inside the zone bounds) and
  // the observed failure.
  it('has 9 swings inside the strike zone', () => {
    const inZone = SESSION_ONE_SWINGS.filter(inStrikeZone).length
    expect(inZone).toBe(9)
  })
})

describe('in-zone pitches are still hit harder than out-of-zone pitches', () => {
  // A real hitter squares up strikes better than pitches out of the zone.
  // Today's fifteen swings show an 8.8 mph gap; this only asks that the
  // rewrite not erase that gap, not that it hold the exact figure. Passes
  // today only because 8.8 already clears the 5 mph floor, which makes it
  // worthless until seen to fail; see task-1-report.md for the mutation (the
  // exit velocities of a hard in-zone swing and a soft out-of-zone swing
  // swapped) and the observed failure.
  it('in-zone mean exit velocity beats out-of-zone mean by at least 5 mph', () => {
    const inZone = SESSION_ONE_SWINGS.filter(inStrikeZone)
    const outOfZone = SESSION_ONE_SWINGS.filter((w) => !inStrikeZone(w))
    const mean = (swings) => swings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / swings.length
    expect(mean(inZone) - mean(outOfZone)).toBeGreaterThanOrEqual(5)
  })
})

// A small, self-contained PRNG so the regression pin below does not depend
// on Math.random and can be reproduced by anyone reading this file.
// Mulberry32: minimal and fast, not claimed to be cryptographically sound,
// which this has no need of.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EXPECTED_SESSION_2 = [
  { plateLocHeight: 3.57, plateLocSide: -0.32, hit: { launch: { exitSpeed: 89, angle: 22, direction: -24 }, landing: { distance: 292 } } },
  { plateLocHeight: 2.5, plateLocSide: 0.26, hit: { launch: { exitSpeed: 79, angle: 25, direction: 23 }, landing: { distance: 240 } } },
  { plateLocHeight: 1.62, plateLocSide: -0.44, hit: { launch: { exitSpeed: 85, angle: 12, direction: -30 }, landing: { distance: 206 } } },
  { plateLocHeight: 2.4, plateLocSide: -0.65, hit: { launch: { exitSpeed: 80, angle: 18, direction: -24 }, landing: { distance: 212 } } },
  { plateLocHeight: 4.1, plateLocSide: -0.41, hit: { launch: { exitSpeed: 72, angle: 10, direction: 9 }, landing: { distance: 130 } } },
  { plateLocHeight: 3.39, plateLocSide: -0.1, hit: { launch: { exitSpeed: 80, angle: 20, direction: -43 }, landing: { distance: 222 } } },
  { plateLocHeight: 3.37, plateLocSide: -0.75, hit: { launch: { exitSpeed: 76, angle: 21, direction: 22 }, landing: { distance: 201 } } },
  { plateLocHeight: 3.69, plateLocSide: -0.23, hit: { launch: { exitSpeed: 79, angle: 25, direction: -20 }, landing: { distance: 240 } } },
  { plateLocHeight: 4.14, plateLocSide: 0.06, hit: { launch: { exitSpeed: 69, angle: 21, direction: -19 }, landing: { distance: 156 } } },
  { plateLocHeight: 3.14, plateLocSide: -0.52, hit: { launch: { exitSpeed: 81, angle: 29, direction: 12 }, landing: { distance: 265 } } },
  { plateLocHeight: 1.37, plateLocSide: 0.18, hit: { launch: { exitSpeed: 81, angle: 24, direction: -13 }, landing: { distance: 249 } } },
  { plateLocHeight: 2.97, plateLocSide: 0.19, hit: { launch: { exitSpeed: 93, angle: 22, direction: 4 }, landing: { distance: 318 } } },
  { plateLocHeight: 1.07, plateLocSide: -0.31, hit: { launch: { exitSpeed: 69, angle: 7, direction: 35 }, landing: { distance: 105 } } },
  { plateLocHeight: 2.62, plateLocSide: -0.29, hit: { launch: { exitSpeed: 85, angle: 22, direction: 11 }, landing: { distance: 265 } } },
  { plateLocHeight: 2.49, plateLocSide: 0.16, hit: { launch: { exitSpeed: 90, angle: 21, direction: -18 }, landing: { distance: 292 } } },
]

const EXPECTED_SESSION_3 = [
  { plateLocHeight: 1.75, plateLocSide: -0.26, hit: { launch: { exitSpeed: 80, angle: 13, direction: -5 }, landing: { distance: 185 } } },
  { plateLocHeight: 1.31, plateLocSide: 0.51, hit: { launch: { exitSpeed: 84, angle: 23, direction: -8 }, landing: { distance: 264 } } },
  { plateLocHeight: 2.28, plateLocSide: 0.06, hit: { launch: { exitSpeed: 90, angle: 36, direction: 23 }, landing: { distance: 284 } } },
  { plateLocHeight: 2.51, plateLocSide: 0.25, hit: { launch: { exitSpeed: 93, angle: 33, direction: 7 }, landing: { distance: 324 } } },
  { plateLocHeight: 2.39, plateLocSide: 0.53, hit: { launch: { exitSpeed: 81, angle: 31, direction: 6 }, landing: { distance: 254 } } },
  { plateLocHeight: 1.54, plateLocSide: -0.58, hit: { launch: { exitSpeed: 84, angle: 26, direction: 26 }, landing: { distance: 281 } } },
  { plateLocHeight: 1.78, plateLocSide: -0.63, hit: { launch: { exitSpeed: 78, angle: 19, direction: 13 }, landing: { distance: 204 } } },
  { plateLocHeight: 3.75, plateLocSide: -0.04, hit: { launch: { exitSpeed: 73, angle: 43, direction: -19 }, landing: { distance: 147 } } },
  { plateLocHeight: 2.6, plateLocSide: 0.21, hit: { launch: { exitSpeed: 79, angle: 19, direction: -32 }, landing: { distance: 211 } } },
  { plateLocHeight: 2.5, plateLocSide: -0.56, hit: { launch: { exitSpeed: 77, angle: 24, direction: -26 }, landing: { distance: 222 } } },
  { plateLocHeight: 3.97, plateLocSide: 0.41, hit: { launch: { exitSpeed: 75, angle: 39, direction: -30 }, landing: { distance: 176 } } },
  { plateLocHeight: 2.84, plateLocSide: 0.24, hit: { launch: { exitSpeed: 92, angle: 19, direction: -12 }, landing: { distance: 291 } } },
  { plateLocHeight: 1.91, plateLocSide: 0.62, hit: { launch: { exitSpeed: 80, angle: 24, direction: 25 }, landing: { distance: 242 } } },
  { plateLocHeight: 3.62, plateLocSide: 0.35, hit: { launch: { exitSpeed: 83, angle: 24, direction: -0 }, landing: { distance: 263 } } },
  { plateLocHeight: 2.76, plateLocSide: 0.24, hit: { launch: { exitSpeed: 86, angle: 35, direction: -19 }, landing: { distance: 264 } } },
]

const EXPECTED_SESSION_4 = [
  { plateLocHeight: 1.09, plateLocSide: -0.3, hit: { launch: { exitSpeed: 84, angle: 23, direction: 6 }, landing: { distance: 264 } } },
  { plateLocHeight: 3.19, plateLocSide: 0.56, hit: { launch: { exitSpeed: 83, angle: 24, direction: -4 }, landing: { distance: 263 } } },
  { plateLocHeight: 2.73, plateLocSide: 0.3, hit: { launch: { exitSpeed: 80, angle: 28, direction: -36 }, landing: { distance: 263 } } },
  { plateLocHeight: 1.1, plateLocSide: -0.65, hit: { launch: { exitSpeed: 81, angle: 17, direction: 24 }, landing: { distance: 212 } } },
  { plateLocHeight: 1.7, plateLocSide: 0.18, hit: { launch: { exitSpeed: 83, angle: 23, direction: -23 }, landing: { distance: 258 } } },
  { plateLocHeight: 1.72, plateLocSide: 0.39, hit: { launch: { exitSpeed: 92, angle: 23, direction: -39 }, landing: { distance: 319 } } },
  { plateLocHeight: 3.48, plateLocSide: 0.11, hit: { launch: { exitSpeed: 84, angle: 36, direction: -41 }, landing: { distance: 246 } } },
  { plateLocHeight: 3.07, plateLocSide: 0.01, hit: { launch: { exitSpeed: 77, angle: 34, direction: -9 }, landing: { distance: 211 } } },
  { plateLocHeight: 1.43, plateLocSide: 0.07, hit: { launch: { exitSpeed: 80, angle: 31, direction: -25 }, landing: { distance: 247 } } },
  { plateLocHeight: 1.91, plateLocSide: 0.59, hit: { launch: { exitSpeed: 88, angle: 21, direction: 33 }, landing: { distance: 279 } } },
  { plateLocHeight: 2.92, plateLocSide: 0.37, hit: { launch: { exitSpeed: 90, angle: 30, direction: -29 }, landing: { distance: 324 } } },
  { plateLocHeight: 1.44, plateLocSide: 0.69, hit: { launch: { exitSpeed: 78, angle: 22, direction: 6 }, landing: { distance: 219 } } },
  { plateLocHeight: 0.93, plateLocSide: -0.41, hit: { launch: { exitSpeed: 84, angle: 21, direction: -5 }, landing: { distance: 253 } } },
  { plateLocHeight: 3.65, plateLocSide: -0.35, hit: { launch: { exitSpeed: 75, angle: 32, direction: -39 }, landing: { distance: 207 } } },
  { plateLocHeight: 3.55, plateLocSide: 0.07, hit: { launch: { exitSpeed: 83, angle: 31, direction: -8 }, landing: { distance: 268 } } },
]
describe('sessions 2, 3 and 4 regenerate bit-for-bit identical from a seeded random', () => {
  // This is the point of the whole Option A decision, made concrete. Option
  // A holds session 1's two averages and lets the individual fifteen swings
  // change underneath them. generateSwings only ever reads baselineSwings'
  // averages (see prevEV/prevLA in swingGenerator.js), never an individual
  // swing, so if the averages truly hold, every downstream session should
  // come out byte-for-byte the same as it does today, no matter what the
  // fifteen individual swings inside session 1 look like. The snapshot below
  // was captured from TODAY'S session 1, goalId null (Open Session, so the
  // goal-driven re-roll in generateSwings never fires and the sequence stays
  // as simple as the generator allows) through mulberry32(42) threaded
  // across all three calls. See task-1-report.md for exactly how it was
  // produced.
  //
  // Passes today only because the snapshot was taken from this exact code,
  // which makes it worthless until seen to fail; see task-1-report.md for
  // the mutation (session 1's average exit velocity shifted by 1 mph, via
  // +15 on one swing so the 15-swing sum moves by exactly 15) and the
  // observed failure.
  //
  // RE-CAPTURED 21 AUGUST 2026, AND WHAT IT PROVES HAS NARROWED. Slice 11
  // moved the pitch draw to the front of each swing, so the fifteen numbers
  // now come off the shared random source in a different order and every
  // generated session at a given seed changed with it. That was the expected
  // and intended consequence of the change, not a regression: it is why the
  // pre-Slice-11 generator was snapshotted under docs/eval-fixtures/frozen/
  // before the generator was touched at all, so no committed round of coach
  // evaluations is quietly re-checked against swings its coach never saw.
  //
  // The numbers below therefore describe the NEW generator. They still pin
  // exactly what the old ones pinned, which is that nothing downstream moves
  // for a reason nobody chose, but a reader should not read a green run here
  // as evidence that sessions 2 to 4 are unchanged since Slice 9. They are
  // not, deliberately. The old values are in this file's git history at the
  // commit before this one.
  //
  // RE-CAPTURED A SECOND TIME, 21 AUGUST 2026, for Task 5, and this one moved
  // less than the note above describes. Task 5 links the pitch to how well the
  // ball was struck; it adds no draw and reorders none, so at this seed every
  // pitch location and every spray direction below is byte-identical to the
  // capture it replaces. What moved is exit velocity, launch angle and the
  // carry distance that follows from them, on the swings whose pitch was not
  // an average one. That is the change itself showing up, and it is the last
  // re-capture Slice 11 currently expects: Task 6 replaces the two clamps and
  // Task 9 retunes the constants, and both will move these numbers again.
  //
  // RE-CAPTURED A THIRD TIME, 21 AUGUST 2026, for Task 6, exactly as the note
  // above predicted. Task 6 spends three more draws on every swing, so from
  // the second swing of session 2 onward the stream is offset and every number
  // below moves. Two things in the new capture are the change itself and are
  // worth pointing at rather than scrolling past:
  //
  //   Session 3 now holds two pop-ups, 43 degrees at 76 mph and 39 degrees at
  //   78 mph, off pitches at 3.75 and 3.97 feet. Both are above the top of the
  //   strike zone, which is the mechanism: the hitter got under a high one.
  //   Before this task a launch angle above 35 was arithmetically impossible.
  //
  //   Session 3 and session 4 also carry ordinary swings at 36 degrees, which
  //   is not a pop-up band draw but a swing that used to be parked on the wall
  //   at 35 and is now allowed past it.
  //
  // THE NEGATIVE ZERO NOTE THAT USED TO SIT INSIDE SESSION 3 IS GONE, and its
  // deletion is deliberate rather than the accident that note itself records.
  // No direction in this capture is a negative zero, so a comment explaining
  // one would have pointed at nothing. What it said is still true of the
  // generator and worth keeping here in one line: Math.round of a small
  // negative number returns -0, which reaches the coach as "0" and reads as up
  // the middle on every chart, and if one lands in a future capture it has to
  // be written as -0 rather than 0 or this test fails.
  //
  // RE-CAPTURED A FOURTH TIME, 21 AUGUST 2026, for Task 7, and this one moves
  // every number for three reasons at once rather than one. The step off the
  // previous session shrank, the exit velocity spread widened from 16 to 21.88,
  // and the ceiling came down from 97 to 94, so exit velocity and the carry
  // distance that follows from it move on every swing. Spray direction moves on
  // every swing too, from its own separate change: it no longer runs through
  // the variance factor and it now leans to the pull side rather than the
  // opposite field. Pitch locations are the one thing byte-identical to the
  // capture this replaces, because Task 7 adds no draw and reorders none.
  //
  // Two things in the new capture are the change itself:
  //
  //   The hardest ball in each of the three sessions is now 93, 93 and 92 mph,
  //   against 94, 95 and 94 before. The old ceiling let a generated session
  //   beat Bill's frozen best of 92; this one approaches it.
  //
  //   THE NEGATIVE ZERO IS BACK, and it is session 3's fourteenth swing. The
  //   note above says what to do about it and this is the case it was written
  //   for: it is written as -0 below, deliberately, and writing it as 0 turns
  //   this test red. That is the only reason the note above survived a capture
  //   in which it pointed at nothing.
  it('matches the stored snapshot', () => {
    const random = mulberry32(42)
    const session2 = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: SESSION_ONE_SWINGS, random })
    const session3 = generateSwings({ sessionNum: 3, goalId: null, baselineSwings: session2, random })
    const session4 = generateSwings({ sessionNum: 4, goalId: null, baselineSwings: session3, random })
    expect(session2).toEqual(EXPECTED_SESSION_2)
    expect(session3).toEqual(EXPECTED_SESSION_3)
    expect(session4).toEqual(EXPECTED_SESSION_4)
  })
})
