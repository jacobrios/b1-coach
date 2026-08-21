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
import {
  generateSwings,
  IN_ZONE_RATE,
  PITCH_MISS_MAX_FEET,
  PITCH_SCALING,
  normalisedPitch,
  EV_SPREAD_MPH,
  LA_SPREAD_DEGREES,
} from './swingGenerator.js'
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
  //
  // BOTH EXPECTED PAIRS MOVED IN SLICE 11 AND BOTH NOW SIT ABOVE THOSE TWO
  // AVERAGES, which reads as a contradiction of the second test's name until
  // you see why. The scripted pitch below is 0.5 for the in-zone coin, the
  // height and the side, which is a pitch dead in the middle of the strike
  // zone: the single best pitch this file can throw. Since Task 5 that pitch
  // is itself a large positive contribution to contact quality, and it is the
  // same contribution in both tests, so it cannot be what separates them.
  // What separates them is still only the quality draw, which is what these
  // two are named for and what the third test below states outright.
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

  it('lifts both numbers together when the quality draw was good', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(1) })
    // Hand-computed from the formula, not read off a run. The pitch is dead
    // centre, so its distance from the heart of the zone is 0 and its quality
    // term is +(1.007 / 0.432) * sqrt(1/12) = +0.672907; its signed height
    // term is (0 + 0.045) / 0.822 * sqrt(1/12) = +0.015803.
    //   quality  = 0.8 * 0.672907 + 0.6 * 0.5           = +0.838302
    //   evOffset = 0.6 * 0.838302 + 0.8 * 0             = +0.502981
    //   laOffset = 0.502981 + 0.8 * 0.4 * 0.015803      = +0.508038
    // 84.5 + 0.502981 * 16 = 92.55, and 18 + 0.508038 * 22 = 29.18.
    expect(swings[0].hit.launch.exitSpeed).toBe(93)
    expect(swings[0].hit.launch.angle).toBe(29)
  })

  it('drops both numbers together when the quality draw was poor', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(0) })
    // The same arithmetic with the quality draw at the other end: the shared
    // term loses 0.6 of the spread, so 0.838302 becomes 0.238302.
    // 84.5 + 0.6 * 0.238302 * 16 = 86.79, and 18 + 0.148036 * 22 = 21.26.
    expect(swings[0].hit.launch.exitSpeed).toBe(87)
    expect(swings[0].hit.launch.angle).toBe(21)
  })

  it('separates those two by the quality draw alone, on one identical pitch', () => {
    // The claim the two tests above rest on, said once rather than inferred
    // from four numbers. Both pitches are the same pitch, so whatever the
    // pitch contributes it contributes equally, and every gap left is the
    // draw's.
    const good = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(1) })[0]
    const poor = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(0) })[0]
    expect(good.plateLocHeight).toBe(poor.plateLocHeight)
    expect(good.plateLocSide).toBe(poor.plateLocSide)
    expect(good.hit.launch.exitSpeed).toBeGreaterThan(poor.hit.launch.exitSpeed)
    expect(good.hit.launch.angle).toBeGreaterThan(poor.hit.launch.angle)
  })
})

describe('the Power goal lifts launch angle on a ramp', () => {
  // A source stuck at 0.5, so the only thing separating these numbers is the
  // lift.
  //
  // THIS BLOCK'S ARITHMETIC CHANGED IN SLICE 11 AND THE CLAIM DID NOT, which
  // is worth a paragraph because the old comment here said something that has
  // stopped being true. It read "the variance factor cannot show up because
  // the noise term is zero", and at a source stuck at 0.5 that used to hold:
  // every draw sat dead on the session average and nothing was left for the
  // variance factor to scale. Since Task 5 a source stuck at 0.5 throws a
  // pitch straight down the middle of the strike zone, which is the best
  // pitch this file can throw and a real positive contribution to contact
  // quality, so the offset is no longer zero and the variance factor does show
  // up in it.
  //
  // So the ramp is asserted as a DIFFERENCE against the same session on a goal
  // that gets no lift, rather than as an absolute angle. Everything the pitch
  // contributes is identical on both sides and cancels exactly, which leaves
  // the lift and nothing else, and it stays that way through Task 6 and Task 9
  // however they move the swing arithmetic underneath it.
  const neutral = () => constantRandom(0.5).random
  const angleFor = (sessionNum, goalId) =>
    generateSwings({ sessionNum, goalId, baselineSwings: BASELINE, random: neutral() })[0].hit.launch.angle

  it.each([
    [2, 2],
    [3, 4],
    [4, 6],
  ])('session %s adds its share of the ramp', (sessionNum, lift) => {
    expect(angleFor(sessionNum, 'power') - angleFor(sessionNum, null)).toBe(lift)
  })

  it.each(['contact', 'popup', 'allfields', 'open', null, 'not-a-goal'])('leaves %s alone', (goalId) => {
    // Held to a hand-computed absolute as well as to each other, so this pair
    // of tests cannot both drift somewhere new together and stay green.
    // Session 4, variance factor 0.9, pitch dead centre so its quality term is
    // +(1.007 / 0.432) * sqrt(1/12) = +0.672907 and its height term is
    // +0.015803, every one of the swing's own three draws neutral:
    //   quality  = 0.8 * 0.672907                        = +0.538326
    //   laOffset = 0.6 * 0.538326 + 0.8 * 0.4 * 0.015803 = +0.328052
    // 18 + 0.328052 * 22 * 0.9 = 24.50.
    expect(angleFor(4, goalId)).toBe(24)
  })
})

describe('a session that would render an empty target band is re-rolled', () => {
  // A source stuck at 0 produces a session of 72 mph at 4 degrees, which meets
  // no goal in the app. The on-target partner is 0.64.
  //
  // IT USED TO BE 1, AND WHY IT COULD NOT STAY 1 IS A FACT ABOUT SLICE 11'S
  // TASK 5 RATHER THAN A FIXTURE TWEAK. A source stuck at 1 does not only
  // put every swing draw at its top end; since Task 4 it also throws the
  // worst pitch this file can throw, 0.80 feet outside the far edge of the
  // plate, on all fifteen swings. Since Task 5 that pitch is a real
  // subtraction from contact quality, and it drags the exit velocity of a
  // session stuck at 1 from 90 mph down to 81, under Power's ask of 88. A
  // hitter who chased fifteen balls a foot and a half off the plate and still
  // met the Power target is exactly the thing this task removed, so the fixture
  // moved rather than the generator.
  //
  // 0.64 is the replacement because it sits just under IN_ZONE_RATE, so the
  // pitch lands inside the zone and the swing draws stay comfortably above
  // the middle: 91 mph at 29 degrees, which clears Power's 88 mph and sits
  // inside its 25 to 35 degree band. The first assertion in each test below is
  // what stops that going stale silently.
  const ON_TARGET_SOURCE = 0.64

  it('generates a second session when nothing in the first met the goal', () => {
    const swings = generateSwings({
      sessionNum: 2,
      goalId: 'power',
      baselineSwings: BASELINE,
      random: twoAttemptRandom(0, ON_TARGET_SOURCE),
    })
    for (const swing of swings) {
      expect(meetsTarget('power', swing.hit.launch)).toBe(true)
    }
  })

  it('keeps the first session when something in it already met the goal', () => {
    const source = constantRandom(ON_TARGET_SOURCE)
    const swings = generateSwings({ sessionNum: 2, goalId: 'power', baselineSwings: BASELINE, random: source.random })
    expect(meetsTarget('power', swings[0].hit.launch)).toBe(true)
    expect(source.callCount()).toBe(callsPerAttempt(ON_TARGET_SOURCE))
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

// ── The pitch predicts the contact ───────────────────────────────────────────
//
// Until Slice 11's Task 5 the pitch and the swing were drawn without reference
// to each other, and the measurement is flat rather than close: across
// 4,500,000 generated swings `node scripts/measure-swing-generation.mjs` put
// the exit velocity difference between swings at strikes and swings at balls
// at 0.00 mph, against session 1's own 8.78. Since Slice 8c the coach is handed
// which pitches were outside the zone and reasons about them out loud, so on
// every generated session that reasoning was a coincidence.
//
// Everything below drives the generator through a fully written-out sequence
// rather than a constant or a seed, because these are statements about ONE
// swing with everything except the pitch held still, and no seeded sweep can
// hold anything still.

// A random source spelled out draw by draw, then neutral forever. The tail
// matters: a session is fifteen swings and only the first is under the
// microscope, so the fourteen after it need a source that does not run out.
function sequence(...values) {
  let calls = 0
  return () => (calls < values.length ? values[calls++] : 0.5)
}

// The three header draws every session starts with: the improve-or-decline
// coin, then how far the exit velocity and the launch angle move. Held at
// neutral so the session this swing sits in is always the same one: off
// BASELINE that is 84.5 mph and 18 degrees, both computed by hand above.
const NEUTRAL_HEADER = [0.5, 0.5, 0.5]

// The four draws a swing spends after its pitch, in the order the generator
// asks for them: the shared quality draw, the exit velocity noise, the launch
// angle noise, and the spray direction. Neutral, so the pitch is the only
// thing left that can move a number.
const NEUTRAL_SWING = [0.5, 0.5, 0.5, 0.5]

// The pitch draws for the four pitches these tests need, each written as the
// generator consumes them. A pitch inside the zone costs three draws and one
// outside costs four or five, which is exactly why these are spelled out per
// pitch instead of being nudged from one shared array.
const DEAD_CENTRE = [0.5, 0.5, 0.5] // in-zone coin, height 2.5 ft, side 0.0 ft
const HIGH_IN_ZONE = [0.5, 0.9, 0.5] // height 1.5 + 0.9 * 2 = 3.3 ft
const LOW_IN_ZONE = [0.5, 0.1, 0.5] // height 1.5 + 0.1 * 2 = 1.7 ft
// Out of the zone: the coin misses, the squared miss draw at 1 gives the
// full 0.80 feet, 0.9 picks the wide branch, the height is an ordinary 2.5,
// and the last draw puts it 0.80 feet outside the far edge, at 1.5 feet.
const WIDE_BY_THE_MAXIMUM = [0.99, 1, 0.9, 0.5, 0.9]

const firstSwingOff = (pitchDraws) =>
  generateSwings({
    sessionNum: 2,
    goalId: null,
    baselineSwings: BASELINE,
    random: sequence(...NEUTRAL_HEADER, ...pitchDraws, ...NEUTRAL_SWING),
  })[0]

describe('a pitch down the middle is hit better than one off the plate', () => {
  const middle = firstSwingOff(DEAD_CENTRE)
  const offThePlate = firstSwingOff(WIDE_BY_THE_MAXIMUM)

  it('put the two pitches where this test says it did', () => {
    // Without this the two tests below could both be satisfied by a sequence
    // that quietly threw two pitches in the same place, which is precisely
    // what would happen if the pitch draws ever changed order again.
    expect(inStrikeZone(middle)).toBe(true)
    expect(middle.plateLocHeight).toBe(2.5)
    expect(middle.plateLocSide).toBe(0)
    expect(inStrikeZone(offThePlate)).toBe(false)
    expect(offThePlate.plateLocSide).toBe(STRIKE_ZONE.sideMax + PITCH_MISS_MAX_FEET)
  })

  it('comes out harder, with every other draw held identical', () => {
    expect(middle.hit.launch.exitSpeed).toBeGreaterThan(offThePlate.hit.launch.exitSpeed)
  })

  it('comes out better angled too, because the two share one contact quality', () => {
    // The pitch-quality term feeds the SHARED term rather than exit velocity
    // alone, which is what makes a chased pitch come out soft and flat
    // together, the way a real mis-hit does.
    expect(middle.hit.launch.angle).toBeGreaterThan(offThePlate.hit.launch.angle)
  })
})

describe('a high pitch is hit higher than a low one', () => {
  const high = firstSwingOff(HIGH_IN_ZONE)
  const low = firstSwingOff(LOW_IN_ZONE)

  it('put the two pitches where this test says it did', () => {
    expect(high.plateLocHeight).toBe(3.3)
    expect(low.plateLocHeight).toBe(1.7)
    expect(inStrikeZone(high)).toBe(true)
    expect(inStrikeZone(low)).toBe(true)
  })

  it('produces a higher launch angle off the high pitch', () => {
    expect(high.hit.launch.angle).toBeGreaterThan(low.hit.launch.angle)
  })

  it('leaves exit velocity alone, because these two miss the middle equally', () => {
    // THE WHOLE REASON THERE ARE TWO PITCH TERMS RATHER THAN ONE, stated as a
    // test. How FAR a pitch sits from the heart of the zone hurts contact
    // quality and is symmetric: 3.3 feet and 1.7 feet are the same distance
    // from the middle of the zone, so they are equally hard to square up.
    // WHICH WAY it is off moves the launch angle and is not symmetric at all.
    // Two different facts, two different terms.
    //
    // This one passes against a generator that links nothing at all, which is
    // why it was also seen red on purpose: swapping the symmetric distance
    // term for the signed height in the shared quality makes the high pitch
    // come out harder as well as higher, and turns this red.
    expect(high.hit.launch.exitSpeed).toBe(low.hit.launch.exitSpeed)
  })
})

describe('the pitch is blended into the swing, not added on top of it', () => {
  it('holds the exact pair a fully written-out sequence produces', () => {
    // Hand-computed from the formula rather than read off a run. The pitch is
    // the worst one this file throws, 0.80 feet outside the far edge at an
    // ordinary height, and every one of the swing's own three draws is at its
    // top end, so nothing here is neutral and nothing cancels.
    //   normalised: height 0, side 1.5 / 0.7 = 2.142857, distance 2.142857
    //   pitch quality = -(2.142857 - 1.007) / 0.432 * sqrt(1/12) = -0.759013
    //   pitch height  =  (0 + 0.045) / 0.822 * sqrt(1/12)        = +0.015803
    //   quality  = 0.8 * -0.759013 + 0.6 * 0.5                   = -0.307210
    //   evOffset = 0.6 * -0.307210 + 0.8 * 0.5                   = +0.215674
    //   laOffset = -0.184326 + 0.8 * (0.4 * 0.015803 + sqrt(0.84) * 0.5)
    //                                                            = +0.187337
    // 84.5 + 0.215674 * 16 = 87.95, and 18 + 0.187337 * 22 = 22.12.
    //
    // WHAT THIS PIN IS ACTUALLY FOR. The same numbers under an implementation
    // that added the pitch on top of the existing draws instead of blending
    // it in would be 90 and a different angle, because adding skips the
    // sqrt(1 - w^2) factor on the draw beside it. That is the mistake the
    // first prototype of this task made, and this is the test that catches
    // its return.
    const swing = generateSwings({
      sessionNum: 2,
      goalId: null,
      baselineSwings: BASELINE,
      random: sequence(...NEUTRAL_HEADER, ...WIDE_BY_THE_MAXIMUM, 1, 1, 1, 0.5),
    })[0]
    expect(swing.hit.launch.exitSpeed).toBe(88)
    expect(swing.hit.launch.angle).toBe(22)
  })

  it('leaves the spread governed by the scale constants, not by how many terms were added', () => {
    // The claim the sqrt(1 - w^2) weights exist for, measured rather than
    // asserted. A draw spread evenly over an interval of width 1 has a
    // standard deviation of sqrt(1/12), and every term blended into an offset
    // is standardised to exactly that, so the typical distance of a swing from
    // its own session average has to come out at the scale constant times
    // sqrt(1/12) whatever gets blended in. Session 2, where the variance
    // factor is 1 and does not muddy the arithmetic; Open Session, so the
    // empty-band re-roll never fires and throws out the sessions it dislikes.
    //
    // THIS ASSERTION WAS GREEN BY LUCK UNTIL 21 AUGUST 2026, AND THE STORY IS
    // WORTH MORE THAN THE FIX. It read `toBeCloseTo(..., 1)` against both scale
    // constants, which allows five hundredths either way, and it claimed in a
    // comment to be a 3% band when on launch angle it was 0.79%. The launch
    // angle this generator really produces is 6.4100 against the constant's
    // 6.3509, which is 0.93% high and OUTSIDE that wall. The committed seed
    // happened to draw 6.3329 at the 400 sessions this then ran, low by enough
    // to cancel the bias exactly. Review swept 40 other seeds and 27 of them
    // failed. Worse, `scripts/measure-swing-generation.mjs` prints the same
    // quantity on the same convention as 6.41, so the repository was asserting
    // one number and printing another.
    //
    // So this now asserts what the generator actually produces, as a RATIO to
    // the scale constant, which is the form that says what the test is for.
    // Measured through the shipped generator at 40,000 sessions: exit velocity
    // comes out at 1.00098 of its constant and launch angle at 1.00931. Both
    // are above 1 and neither is an accident:
    //
    //   Rounding to whole numbers adds 1/12 of variance to each reading, worth
    //   about 0.10% on exit velocity and 0.05% on launch angle. The clamps pull
    //   a little back the other way.
    //
    //   Launch angle carries the rest, about 0.88%, from the two pitch terms
    //   being correlated at +0.058 rather than at 0, which is explained where
    //   it happens in swingGenerator.js. Exit velocity has no second term and
    //   so has no second effect.
    //
    // THE BAND IS 0.99 TO 1.025 AND IS SIZED FROM MEASUREMENT, not chosen.
    // Across 60 seeds at the 4,000 sessions below, exit velocity ran 0.99542 to
    // 1.00914 and launch angle 1.00298 to 1.01707, so every seed lands inside
    // it with room. The sweep is 4,000 sessions rather than 400 for that
    // reason: at 400 the same 60 seeds ran 0.98375 to 1.03256, which is wider
    // than the effect being measured, and no honest band could have been drawn
    // around it. The upper bound is the load-bearing one, because widening is
    // the failure this test exists for: an implementation that added the pitch
    // on top rather than blending it comes out at about 1.105.
    //
    // ONE DEVIATION FROM THE BRIEF, DECLARED. Task 5's brief asked for this
    // assertion at FULL pitch weight, and it is made at the shipped weights
    // instead, because the weights are module constants and nothing injects
    // them. At full weight the deviation from the scale constant is about
    // 1.12% rather than 0.93%, so the band above would still hold; what would
    // not hold is the current one. Measured by review rather than here.
    const random = mulberry32(20260821)
    let evSquares = 0
    let laSquares = 0
    let degreesOfFreedom = 0
    for (let i = 0; i < 4000; i++) {
      const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random })
      const evs = swings.map((w) => w.hit.launch.exitSpeed)
      const las = swings.map((w) => w.hit.launch.angle)
      const meanEv = evs.reduce((a, b) => a + b, 0) / evs.length
      const meanLa = las.reduce((a, b) => a + b, 0) / las.length
      evSquares += evs.reduce((s, x) => s + (x - meanEv) ** 2, 0)
      laSquares += las.reduce((s, x) => s + (x - meanLa) ** 2, 0)
      degreesOfFreedom += swings.length - 1
    }
    const uniformSd = Math.sqrt(1 / 12)
    const evRatio = Math.sqrt(evSquares / degreesOfFreedom) / (EV_SPREAD_MPH * uniformSd)
    const laRatio = Math.sqrt(laSquares / degreesOfFreedom) / (LA_SPREAD_DEGREES * uniformSd)
    expect(evRatio).toBeGreaterThan(0.99)
    expect(evRatio).toBeLessThan(1.025)
    expect(laRatio).toBeGreaterThan(0.99)
    expect(laRatio).toBeLessThan(1.025)
  })
})

describe('the pitch terms are standardised against the pitches this file actually throws', () => {
  // A SILENT COPY OF A MEASURED NUMBER, MADE LOUD. The four constants in
  // PITCH_SCALING are what turn a pitch location into a term on the same scale
  // as the generator's own uniform draws, and they were measured against the
  // pitch distribution drawPitch produces today. Nothing about them is derived,
  // so moving IN_ZONE_RATE, either miss constant or the low/high/wide split
  // makes them stale, and a stale centre shifts every session's average exit
  // velocity for a reason nobody chose.
  //
  // Task 9 is a tuning pass over every constant in this file at once, so that
  // is not a hypothetical. This test re-measures the population through the
  // generator's own normalisation and holds the declared constants to it, which
  // turns a silent staleness into a named failure.
  const NORMALISED = SWEEP.map((w) => normalisedPitch({ height: w.plateLocHeight, side: w.plateLocSide }))
  const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const sdOf = (xs) => {
    const m = meanOf(xs)
    return Math.sqrt(meanOf(xs.map((x) => (x - m) ** 2)))
  }
  const distances = NORMALISED.map((p) => p.distanceFromHeart)
  const heights = NORMALISED.map((p) => p.height)

  // Two hundredths, and THREE of these four rows have the margin that number
  // suggests while the fourth does not. Corrected 21 August 2026 after review
  // swept 300 alternative seeds through all four: the distance mean, the
  // distance spread and the height spread failed on none of them, and the
  // height mean failed on 16, which is about two sigma of headroom rather than
  // the four to eight this comment used to claim for all four together.
  //
  // The reason is that the signed height is the widest of the four quantities
  // and the one whose declared value sits nearest zero, so the same absolute
  // tolerance buys it the least. It gets three hundredths of its own rather
  // than a quiet promise it cannot keep. That is still well inside what a real
  // retune moves: a five-point change to IN_ZONE_RATE shifts the mean distance
  // by about five hundredths.
  const TOLERANCE = 0.02
  const HEIGHT_MEAN_TOLERANCE = 0.03

  it('centres the distance term on the mean distance a pitch really sits from the heart', () => {
    expect(meanOf(distances)).toBeGreaterThan(PITCH_SCALING.distanceMean - TOLERANCE)
    expect(meanOf(distances)).toBeLessThan(PITCH_SCALING.distanceMean + TOLERANCE)
  })

  it('scales it by the spread that population really has', () => {
    expect(sdOf(distances)).toBeGreaterThan(PITCH_SCALING.distanceSd - TOLERANCE)
    expect(sdOf(distances)).toBeLessThan(PITCH_SCALING.distanceSd + TOLERANCE)
  })

  it('does the same for the signed height term', () => {
    expect(meanOf(heights)).toBeGreaterThan(PITCH_SCALING.heightMean - HEIGHT_MEAN_TOLERANCE)
    expect(meanOf(heights)).toBeLessThan(PITCH_SCALING.heightMean + HEIGHT_MEAN_TOLERANCE)
    expect(sdOf(heights)).toBeGreaterThan(PITCH_SCALING.heightSd - TOLERANCE)
    expect(sdOf(heights)).toBeLessThan(PITCH_SCALING.heightSd + TOLERANCE)
  })
})
