// Tests for the synthetic swing generator.
//
// The generator used to live inside App.jsx as a closure, where nothing could
// reach it. It was moved out for this slice for the same reason goalTargets.js,
// sessionStats.js and chartSlots.js were moved out before it: the judgment
// inside it is worth proving, and proving it should not require loading a
// screen.
//
// Every test here injects its own random source instead of leaning on
// Math.random, because the three behaviours this slice added are all about what
// the generator does with a *particular* draw. A test that rolled real dice
// could not force a session where nothing lands on target, which is the exact
// case the re-roll exists for.

import { describe, it, expect } from 'vitest'
import { generateSwings } from './swingGenerator.js'
import { meetsTarget } from './goalTargets.js'
import { carryDistance } from './ballFlight.js'

// A four-swing baseline built here rather than borrowed from the app, so these
// tests keep working if the app's opening session is ever re-tuned. Only the
// two averages matter to the generator: 82 mph and 16.5 degrees.
const BASELINE = [
  { hit: { launch: { exitSpeed: 80, angle: 15 } } },
  { hit: { launch: { exitSpeed: 84, angle: 18 } } },
  { hit: { launch: { exitSpeed: 80, angle: 15 } } },
  { hit: { launch: { exitSpeed: 84, angle: 18 } } },
]

// A random source stuck at one value, which counts how often it was asked.
// A constant source makes a whole session identical, which is what lets these
// tests talk about "the" exit velocity of an attempt rather than fifteen of
// them.
function constantRandom(value) {
  let calls = 0
  return {
    random: () => { calls++; return value },
    callCount: () => calls,
  }
}

// An impossible hitter, used only to measure. Every swing off this baseline
// clears the Power target no matter what the random source says, because the
// numbers are so far outside the app's range that the clamps do the work.
//
// It exists because the first version of these tests measured against a goal
// with no target instead, which quietly cancelled itself out: delete the
// has-a-target check from the generator and the measurement re-rolled exactly
// as the thing it was measuring did, so the four guards below stayed green
// against a broken generator. A baseline that can never trigger a re-roll is
// the fix. Found by breaking the generator on purpose, not by reading it.
const ALWAYS_ON_TARGET = [{ hit: { launch: { exitSpeed: 120, angle: 45 } } }]

// How many draws one attempt at a session costs, measured rather than written
// down, so these tests do not have to know the generator's internals. Measured
// per source value because the count genuinely depends on it: a pitch outside
// the strike zone costs two extra draws, so a source stuck at 1 spends more
// than one stuck at 0. Neither the goal, the session number nor the baseline
// changes it, since the Power lift, the variance factor and the clamps all
// draw nothing.
function callsPerAttempt(value) {
  const source = constantRandom(value)
  generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: ALWAYS_ON_TARGET, random: source.random })
  return source.callCount()
}

// A source that answers `first` until one attempt's worth of draws has been
// spent, then answers `second`. This is how a test forces attempt one to miss
// everything and attempt two to land on target.
function twoAttemptRandom(first, second) {
  const boundary = callsPerAttempt(first)
  let calls = 0
  return () => (calls++ < boundary ? first : second)
}

describe('the shape of a generated session', () => {
  it('returns fifteen swings', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: constantRandom(0.5).random })
    expect(swings).toHaveLength(15)
  })

  it('gives every swing a pitch location, a launch and a landing', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: constantRandom(0.5).random })
    for (const swing of swings) {
      expect(Number.isFinite(swing.plateLocHeight)).toBe(true)
      expect(Number.isFinite(swing.plateLocSide)).toBe(true)
      expect(Number.isFinite(swing.hit.launch.exitSpeed)).toBe(true)
      expect(Number.isFinite(swing.hit.launch.angle)).toBe(true)
      expect(Number.isFinite(swing.hit.launch.direction)).toBe(true)
      expect(Number.isFinite(swing.hit.landing.distance)).toBe(true)
    }
  })

  it('takes its distance from the carry formula rather than inventing one', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: constantRandom(0.5).random })
    for (const swing of swings) {
      expect(swing.hit.landing.distance).toBe(carryDistance(swing.hit.launch))
    }
  })

  it('keeps exit velocity and launch angle inside the range the app can draw', () => {
    // Both directions, against a baseline already sitting on the boundary, so
    // the clamps are the only thing keeping the numbers on the chart.
    const ceiling = [{ hit: { launch: { exitSpeed: 97, angle: 35 } } }]
    const high = generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: ceiling, random: constantRandom(1).random })
    expect(Math.max(...high.map((s) => s.hit.launch.exitSpeed))).toBeLessThanOrEqual(97)
    expect(Math.max(...high.map((s) => s.hit.launch.angle))).toBeLessThanOrEqual(35)

    const floor = [{ hit: { launch: { exitSpeed: 65, angle: -5 } } }]
    const low = generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: floor, random: constantRandom(0).random })
    expect(Math.min(...low.map((s) => s.hit.launch.exitSpeed))).toBeGreaterThanOrEqual(65)
    expect(Math.min(...low.map((s) => s.hit.launch.angle))).toBeGreaterThanOrEqual(-5)
  })
})

describe('exit velocity and launch angle come off the same swing', () => {
  // The point of the shared contact-quality term. These two tests feed a source
  // where the *independent* halves are dead neutral (0.5) and only the shared
  // term moves. Under the old independent draws, neutral noise meant the two
  // numbers sat exactly on the session average and could not move at all, so
  // both of these fail against the old generator rather than merely passing
  // against the new one.
  //
  // Session averages for this baseline and this header, both computed by hand:
  // exit velocity 82 + (1 + 0.5*3) = 84.5, launch angle 16.5 + (0.5 + 0.5*2) = 18.
  const HEADER = [0.5, 0.5, 0.5]
  const scripted = (q) => {
    // Three header draws, then seven per swing in the order the generator asks
    // for them: shared quality, exit velocity noise, launch angle noise,
    // direction, in-zone coin, plate height, plate side.
    const swingDraws = [q, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    let calls = 0
    return () => {
      const i = calls++
      return i < HEADER.length ? HEADER[i] : swingDraws[(i - HEADER.length) % swingDraws.length]
    }
  }

  it('lifts both numbers together when the contact was good', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(1) })
    // 0.6 * 0.5 of the spread: 84.5 + 4.8 and 18 + 6.6.
    expect(swings[0].hit.launch.exitSpeed).toBe(89)
    expect(swings[0].hit.launch.angle).toBe(25)
  })

  it('drops both numbers together when the contact was poor', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(0) })
    // The mirror image: 84.5 - 4.8 and 18 - 6.6.
    expect(swings[0].hit.launch.exitSpeed).toBe(80)
    expect(swings[0].hit.launch.angle).toBe(11)
  })
})

describe('the Power goal lifts launch angle on a ramp', () => {
  // A neutral source, so the only thing separating these numbers is the lift.
  // The session average launch angle is 18 for every session here; the variance
  // factor cannot show up because the noise term is zero.
  const neutral = () => constantRandom(0.5).random

  it.each([
    [2, 20],
    [3, 22],
    [4, 24],
  ])('session %s adds its share of the ramp', (sessionNum, expected) => {
    const swings = generateSwings({ sessionNum, goalId: 'power', baselineSwings: BASELINE, random: neutral() })
    expect(swings[0].hit.launch.angle).toBe(expected)
  })

  it.each(['contact', 'popup', 'allfields', 'open', null, 'not-a-goal'])('leaves %s alone', (goalId) => {
    const swings = generateSwings({ sessionNum: 4, goalId, baselineSwings: BASELINE, random: neutral() })
    expect(swings[0].hit.launch.angle).toBe(18)
  })
})

describe('a session that would render an empty target band is re-rolled', () => {
  // A source stuck at 0 produces a session of 72 mph at 4 degrees, which meets
  // no goal in the app. A source stuck at 1 produces 90 mph at 32 degrees,
  // which meets Power.
  it('generates a second session when nothing in the first met the goal', () => {
    const swings = generateSwings({
      sessionNum: 2,
      goalId: 'power',
      baselineSwings: BASELINE,
      random: twoAttemptRandom(0, 1),
    })
    for (const swing of swings) {
      expect(meetsTarget('power', swing.hit.launch)).toBe(true)
    }
  })

  it('keeps the first session when something in it already met the goal', () => {
    const source = constantRandom(1)
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: source.random })
    expect(source.callCount()).toBe(callsPerAttempt(1))
    expect(meetsTarget('power', swings[0].hit.launch)).toBe(true)
  })

  it.each(['allfields', 'open', null, 'not-a-goal'])('never re-rolls %s, which has nothing to aim at', (goalId) => {
    const source = constantRandom(0)
    generateSwings({ sessionNum: 2, goalId, baselineSwings: BASELINE, random: source.random })
    expect(source.callCount()).toBe(callsPerAttempt(0))
  })

  it('re-rolls once and once only, even when the second session is empty too', () => {
    // Both attempts miss everything here. The generator has to hand back the
    // second one anyway: an unbounded retry would promise the player a better
    // hitter than the simulation actually is.
    const source = constantRandom(0)
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: source.random })
    expect(source.callCount()).toBe(callsPerAttempt(0) * 2)
    expect(swings.every((s) => !meetsTarget('power', s.hit.launch))).toBe(true)
  })
})
