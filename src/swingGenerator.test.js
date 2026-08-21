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
import { generateSwings, IN_ZONE_RATE, PITCH_MISS_MAX_FEET } from './swingGenerator.js'
import { meetsTarget } from './goalTargets.js'
import { carryDistance } from './ballFlight.js'
import { inStrikeZone, STRIKE_ZONE } from './sessionStats.js'

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
// the strike zone costs one or two extra draws depending on which way it got
// away, so a source stuck at 1 spends more than one stuck at 0. (Before Slice
// 11 that clause read "two extra draws" flat. It happens to still be two at a
// source stuck at 1, which is the only value that reaches the out-of-zone
// branch here, but a miss low or high now costs one rather than two and the
// old wording would have been quietly wrong.) Neither the goal, the session
// number nor the baseline changes it, since the Power lift, the variance
// factor and the clamps all draw nothing.
function callsPerAttempt(value) {
  const source = constantRandom(value)
  const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: ALWAYS_ON_TARGET, random: source.random })

  // The comment above is a lesson; this is what enforces it. The measurement
  // only holds while every swing off that baseline really does clear the Power
  // target, and today that is partly luck: the launch angle clamp stops at 35
  // and Power's band happens to end at 35 too, so the measuring swing sits
  // exactly on the boundary. Narrow the band or drop the clamp and this helper
  // would silently start measuring two attempts again, which would make the
  // four no-target guards below pass against anything. It fails loudly here
  // instead.
  for (const swing of swings) {
    expect(
      meetsTarget('power', swing.hit.launch),
      'callsPerAttempt is no longer measuring a single attempt: its baseline stopped clearing the Power target, so the re-roll now fires inside the measurement itself',
    ).toBe(true)
  }

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
    // for them: in-zone coin, plate height, plate side, shared quality, exit
    // velocity noise, launch angle noise, direction.
    //
    // The pitch moved to the FRONT of that list in Slice 11, because a pitch
    // drawn after the swing cannot influence it, so the quality draw this test
    // moves is now the fourth of the seven rather than the first. Everything
    // else here is unchanged, and so are both expected numbers below: a
    // neutral 0.5 in-zone coin keeps the pitch inside the zone, which costs the
    // same two draws the old in-zone branch did.
    const swingDraws = [0.5, 0.5, 0.5, q, 0.5, 0.5, 0.5]
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

// ── The pitch the swing was thrown ───────────────────────────────────────────
//
// Everything below is about where the ball was thrown, which until Slice 11 was
// the least believable thing this file produced. Two separate complaints, both
// measured across 4,500,000 generated swings by
// `node scripts/measure-swing-generation.mjs` before anything was changed, that
// figure being the 20,000 sessions per goal per session number the script
// samples and prints for itself:
//
//   1. Every single missed pitch was off on BOTH axes at once, 100% of them.
//      There was no such thing here as a pitch that was simply low, because a
//      low pitch was always wide as well. No real thrower misses that way.
//   2. A missed pitch was 0.47 feet outside the zone on average and could be
//      thrown as low as 0.50 feet off the ground, which is a ball bouncing in
//      front of the plate. Session 1, the hand-written session this demo is
//      calibrated against, misses by 0.28 feet on average and its worst miss
//      is 0.70.
//
// These tests sweep a long seeded run rather than pinning one scripted draw,
// because both complaints are about the SHAPE of a population: "one axis at a
// time" and "how far out a typical miss is" are not statements a single pitch
// can prove or disprove.

// A small, self-contained PRNG so the sweeps below see a realistic spread of
// pitches instead of one corner of one, and see the same spread on every run.
// Copied rather than shared for the same reason the hand-run scripts under
// scripts/ copy it and say so: nine lines of arithmetic with no behaviour to
// keep in step, where a shared module would exist purely to hold one caller's
// math. src/sessionOneSwings.test.js carries the same nine lines.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Every swing from 400 practice sessions off one seeded stream: 6,000 pitches,
// of which roughly a third should be balls. Open Session, so the empty-band
// re-roll never fires and the stream is not spent re-rolling.
const SWEEP = (() => {
  const random = mulberry32(20260821)
  const swings = []
  for (let i = 0; i < 400; i++) {
    swings.push(...generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random }))
  }
  return swings
})()
const SWEEP_BALLS = SWEEP.filter((w) => !inStrikeZone(w))

// Which side of the zone a pitch missed on. A pitch can in principle be off on
// both, which is exactly what the second test below exists to rule out, so
// these are three independent questions rather than one three-way choice.
const isLow = (w) => w.plateLocHeight < STRIKE_ZONE.heightMin
const isHigh = (w) => w.plateLocHeight > STRIKE_ZONE.heightMax
const isWide = (w) => w.plateLocSide < STRIKE_ZONE.sideMin || w.plateLocSide > STRIKE_ZONE.sideMax

describe('a missed pitch is a near miss, not a wild one', () => {
  it('throws enough balls for the two tests below to mean anything', () => {
    // Without this, a generator that threw nothing but strikes would pass both
    // of the next two tests by having no missed pitch to judge. Roughly a
    // third of 6,000 is 2,000; the floor is set well under that so ordinary
    // sampling cannot trip it.
    expect(SWEEP_BALLS.length).toBeGreaterThan(1500)
  })

  it('never bounces one in and never sails one over the backstop', () => {
    // The zone is 1.5 to 3.5 feet high and 0.7 feet either side of the middle,
    // and this file's own declared worst miss is PITCH_MISS_MAX_FEET, so
    // nothing may land below 0.70 feet, above 4.30, or wider than 1.50. The
    // bound is read off the generator's own constant rather than typed here,
    // so a future change to the worst miss moves the test with it instead of
    // leaving a stale copy behind.
    for (const w of SWEEP_BALLS) {
      expect(w.plateLocHeight).toBeGreaterThanOrEqual(STRIKE_ZONE.heightMin - PITCH_MISS_MAX_FEET)
      expect(w.plateLocHeight).toBeLessThanOrEqual(STRIKE_ZONE.heightMax + PITCH_MISS_MAX_FEET)
      expect(w.plateLocSide).toBeGreaterThanOrEqual(STRIKE_ZONE.sideMin - PITCH_MISS_MAX_FEET)
      expect(w.plateLocSide).toBeLessThanOrEqual(STRIKE_ZONE.sideMax + PITCH_MISS_MAX_FEET)
    }
  })

  it('misses on one axis at a time, leaving the other an ordinary pitch', () => {
    // The headline defect. A pitch that got away low should still be over the
    // plate sideways, the way a real one is.
    for (const w of SWEEP_BALLS) {
      const heightOut = isLow(w) || isHigh(w)
      const sideOut = isWide(w)
      expect(
        heightOut !== sideOut,
        `pitch at height ${w.plateLocHeight}, side ${w.plateLocSide} is off on ${heightOut && sideOut ? 'both axes at once' : 'neither axis'}`,
      ).toBe(true)
    }
  })

  it('misses low, high and wide in the shares this file claims', () => {
    // Not decoration. Every one of the three assertions above is satisfied by a
    // thrower who only ever misses low, and a demo whose every ball is in the
    // dirt is no more believable than one whose every ball is off on both axes.
    const share = (pred) => SWEEP_BALLS.filter(pred).length / SWEEP_BALLS.length
    expect(share(isLow)).toBeCloseTo(0.40, 1)
    expect(share(isHigh)).toBeCloseTo(0.30, 1)
    expect(share(isWide)).toBeCloseTo(0.30, 1)
  })

  it('keeps a typical miss near session 1 rather than near the old generator', () => {
    // The product claim, stated as a number: the generated thrower misses by
    // about as much as the hand-written session this demo is calibrated
    // against (0.28 feet), not by the 0.47 the old generator produced. The
    // band is wide on purpose, because the target is a hitter who reads right,
    // not a decimal place.
    const missOf = (w) => Math.max(
      0,
      STRIKE_ZONE.heightMin - w.plateLocHeight,
      w.plateLocHeight - STRIKE_ZONE.heightMax,
      STRIKE_ZONE.sideMin - w.plateLocSide,
      w.plateLocSide - STRIKE_ZONE.sideMax,
    )
    const mean = SWEEP_BALLS.reduce((s, w) => s + missOf(w), 0) / SWEEP_BALLS.length
    expect(mean).toBeGreaterThan(0.24)
    expect(mean).toBeLessThan(0.36)
  })
})

describe('how often the thrower puts one in the zone', () => {
  it('is the rate this file declares, and the declared rate is 0.65', () => {
    // Pinned rather than merely read, because the number is a product decision
    // about how often a demo hitter is offered something hittable, and a
    // silent drift in it changes what every visitor sees.
    expect(IN_ZONE_RATE).toBe(0.65)
  })

  it('throws a strike on a draw just under the rate and a ball on one just over', () => {
    // Driven either side of the constant rather than either side of a typed
    // 0.65, so this proves the generator actually consults IN_ZONE_RATE rather
    // than carrying a second copy of the number somewhere.
    const strikes = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: constantRandom(IN_ZONE_RATE - 0.01).random })
    expect(strikes.every(inStrikeZone)).toBe(true)

    const balls = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: constantRandom(IN_ZONE_RATE + 0.01).random })
    expect(balls.every((w) => !inStrikeZone(w))).toBe(true)
  })

  it('lands on that rate across a long run', () => {
    // The two draws above prove the boundary is where the constant says it is.
    // This proves the coin is fair, which the boundary test cannot see.
    const share = SWEEP.filter(inStrikeZone).length / SWEEP.length
    expect(share).toBeGreaterThan(IN_ZONE_RATE - 0.02)
    expect(share).toBeLessThan(IN_ZONE_RATE + 0.02)
  })
})
