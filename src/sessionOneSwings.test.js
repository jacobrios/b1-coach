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

// How many distinct values appear among the consecutive gaps of a sorted
// numeric array. A dead-straight ramp (2, 4, 6, 8...) has exactly one
// distinct gap; a hand-picked-to-look-random-but-isn't sequence can still
// alternate between only two step sizes. Real, noisy data does neither.
function distinctConsecutiveGaps(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const gaps = new Set()
  for (let i = 1; i < sorted.length; i++) gaps.add(sorted[i] - sorted[i - 1])
  return gaps.size
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

describe('neither exit velocity nor launch angle steps in an arithmetic progression', () => {
  // A sorted list of fifteen values whose consecutive gaps take only one or
  // two distinct sizes reads as a ramp, not a hitter's spread. The two
  // halves below disagree today, and that disagreement is the reason this
  // slice's plan calls test 3 out specially: launch angle fails naturally
  // (today's fifteen angles step by exactly 2 for eleven consecutive
  // values, so the sorted gaps are {2, 1}, two distinct sizes). Exit
  // velocity happens to PASS today (sorted gaps are {1, 2, 3}, three
  // distinct sizes) purely because the hand-picked exit speeds are not
  // quite as evenly spaced as the angles are, not because anyone verified
  // the exit-velocity spread is realistic. A test that passes by accident
  // is not evidence, so this half was proven with a deliberate mutation
  // before being trusted here; see task-1-report.md.
  it('launch angle has more than two distinct consecutive gaps', () => {
    const launchAngles = SESSION_ONE_SWINGS.map((w) => w.hit.launch.angle)
    expect(distinctConsecutiveGaps(launchAngles)).toBeGreaterThan(2)
  })

  it('exit velocity has more than two distinct consecutive gaps', () => {
    const exitVelocities = SESSION_ONE_SWINGS.map((w) => w.hit.launch.exitSpeed)
    expect(distinctConsecutiveGaps(exitVelocities)).toBeGreaterThan(2)
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
  { plateLocHeight: 3.23, plateLocSide: -0.04, hit: { launch: { exitSpeed: 81, angle: 22, direction: -12 }, landing: { distance: 239 } } },
  { plateLocHeight: 2.5, plateLocSide: 0.26, hit: { launch: { exitSpeed: 86, angle: 21, direction: -10 }, landing: { distance: 266 } } },
  { plateLocHeight: 2.68, plateLocSide: -0.66, hit: { launch: { exitSpeed: 79, angle: 20, direction: 27 }, landing: { distance: 216 } } },
  { plateLocHeight: 1.55, plateLocSide: -0.46, hit: { launch: { exitSpeed: 76, angle: 11, direction: 23 }, landing: { distance: 155 } } },
  { plateLocHeight: 1.57, plateLocSide: -0.63, hit: { launch: { exitSpeed: 87, angle: 30, direction: -9 }, landing: { distance: 302 } } },
  { plateLocHeight: 2.11, plateLocSide: 0.33, hit: { launch: { exitSpeed: 86, angle: 16, direction: 14 }, landing: { distance: 236 } } },
  { plateLocHeight: 1.65, plateLocSide: 0.22, hit: { launch: { exitSpeed: 87, angle: 19, direction: -12 }, landing: { distance: 260 } } },
  { plateLocHeight: 1.35, plateLocSide: -0.83, hit: { launch: { exitSpeed: 88, angle: 29, direction: -25 }, landing: { distance: 316 } } },
  { plateLocHeight: 1.15, plateLocSide: 0.88, hit: { launch: { exitSpeed: 78, angle: 13, direction: 11 }, landing: { distance: 175 } } },
  { plateLocHeight: 3.49, plateLocSide: 0.09, hit: { launch: { exitSpeed: 82, angle: 23, direction: 26 }, landing: { distance: 251 } } },
  { plateLocHeight: 2.15, plateLocSide: 0.32, hit: { launch: { exitSpeed: 87, angle: 26, direction: -8 }, landing: { distance: 303 } } },
  { plateLocHeight: 3.82, plateLocSide: 0.89, hit: { launch: { exitSpeed: 81, angle: 23, direction: 17 }, landing: { distance: 244 } } },
  { plateLocHeight: 0.93, plateLocSide: 0.84, hit: { launch: { exitSpeed: 83, angle: 11, direction: 24 }, landing: { distance: 189 } } },
  { plateLocHeight: 2.33, plateLocSide: -0.47, hit: { launch: { exitSpeed: 84, angle: 29, direction: 17 }, landing: { distance: 287 } } },
  { plateLocHeight: 1.21, plateLocSide: -0.84, hit: { launch: { exitSpeed: 83, angle: 16, direction: 13 }, landing: { distance: 218 } } },
]

const EXPECTED_SESSION_3 = [
  { plateLocHeight: 2.71, plateLocSide: -0.02, hit: { launch: { exitSpeed: 85, angle: 29, direction: 30 }, landing: { distance: 294 } } },
  { plateLocHeight: 2.05, plateLocSide: -0.23, hit: { launch: { exitSpeed: 73, angle: 20, direction: 17 }, landing: { distance: 177 } } },
  { plateLocHeight: 0.65, plateLocSide: 0.89, hit: { launch: { exitSpeed: 74, angle: 22, direction: 8 }, landing: { distance: 192 } } },
  { plateLocHeight: 2.17, plateLocSide: 0.55, hit: { launch: { exitSpeed: 80, angle: 17, direction: 16 }, landing: { distance: 206 } } },
  { plateLocHeight: 1.97, plateLocSide: -0.24, hit: { launch: { exitSpeed: 80, angle: 20, direction: 6 }, landing: { distance: 222 } } },
  { plateLocHeight: 2.89, plateLocSide: -0.26, hit: { launch: { exitSpeed: 77, angle: 20, direction: -15 }, landing: { distance: 203 } } },
  { plateLocHeight: 2.46, plateLocSide: -0.17, hit: { launch: { exitSpeed: 76, angle: 8, direction: 8 }, landing: { distance: 140 } } },
  { plateLocHeight: 3.24, plateLocSide: 0.04, hit: { launch: { exitSpeed: 88, angle: 28, direction: -1 }, landing: { distance: 323 } } },
  { plateLocHeight: 3.12, plateLocSide: -0.41, hit: { launch: { exitSpeed: 89, angle: 24, direction: -20 }, landing: { distance: 305 } } },
  { plateLocHeight: 3.97, plateLocSide: -0.82, hit: { launch: { exitSpeed: 81, angle: 27, direction: 3 }, landing: { distance: 265 } } },
  { plateLocHeight: 3.92, plateLocSide: 1.06, hit: { launch: { exitSpeed: 79, angle: 19, direction: 21 }, landing: { distance: 211 } } },
  { plateLocHeight: 2.2, plateLocSide: 0.61, hit: { launch: { exitSpeed: 81, angle: 20, direction: 28 }, landing: { distance: 228 } } },
  { plateLocHeight: 1.54, plateLocSide: -0.58, hit: { launch: { exitSpeed: 81, angle: 27, direction: -20 }, landing: { distance: 265 } } },
  { plateLocHeight: 2.91, plateLocSide: -0.5, hit: { launch: { exitSpeed: 86, angle: 30, direction: 29 }, landing: { distance: 295 } } },
  { plateLocHeight: 2.64, plateLocSide: 0.3, hit: { launch: { exitSpeed: 75, angle: 10, direction: -11 }, landing: { distance: 145 } } },
]

const EXPECTED_SESSION_4 = [
  { plateLocHeight: 2.35, plateLocSide: -0.24, hit: { launch: { exitSpeed: 79, angle: 22, direction: 1 }, landing: { distance: 226 } } },
  { plateLocHeight: 2.6, plateLocSide: 0.21, hit: { launch: { exitSpeed: 72, angle: 18, direction: -12 }, landing: { distance: 163 } } },
  { plateLocHeight: 1.28, plateLocSide: -0.95, hit: { launch: { exitSpeed: 73, angle: 12, direction: -19 }, landing: { distance: 144 } } },
  { plateLocHeight: 2.91, plateLocSide: 0.09, hit: { launch: { exitSpeed: 78, angle: 9, direction: -5 }, landing: { distance: 154 } } },
  { plateLocHeight: 4, plateLocSide: 0.85, hit: { launch: { exitSpeed: 80, angle: 20, direction: 13 }, landing: { distance: 222 } } },
  { plateLocHeight: 2.84, plateLocSide: 0.09, hit: { launch: { exitSpeed: 69, angle: 9, direction: -12 }, landing: { distance: 112 } } },
  { plateLocHeight: 3.17, plateLocSide: 0.05, hit: { launch: { exitSpeed: 76, angle: 25, direction: -7 }, landing: { distance: 219 } } },
  { plateLocHeight: 3.22, plateLocSide: 0.61, hit: { launch: { exitSpeed: 80, angle: 24, direction: -12 }, landing: { distance: 242 } } },
  { plateLocHeight: 3, plateLocSide: 0.07, hit: { launch: { exitSpeed: 80, angle: 28, direction: -9 }, landing: { distance: 263 } } },
  { plateLocHeight: 3.75, plateLocSide: 1, hit: { launch: { exitSpeed: 80, angle: 24, direction: 33 }, landing: { distance: 242 } } },
  { plateLocHeight: 0.81, plateLocSide: 1.05, hit: { launch: { exitSpeed: 80, angle: 31, direction: -8 }, landing: { distance: 247 } } },
  { plateLocHeight: 3.42, plateLocSide: -0.02, hit: { launch: { exitSpeed: 83, angle: 25, direction: -19 }, landing: { distance: 269 } } },
  { plateLocHeight: 1.26, plateLocSide: 0.96, hit: { launch: { exitSpeed: 77, angle: 22, direction: 18 }, landing: { distance: 212 } } },
  { plateLocHeight: 2.34, plateLocSide: -0.08, hit: { launch: { exitSpeed: 73, angle: 20, direction: 28 }, landing: { distance: 177 } } },
  { plateLocHeight: 1.7, plateLocSide: -0.53, hit: { launch: { exitSpeed: 81, angle: 22, direction: -26 }, landing: { distance: 239 } } },
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
