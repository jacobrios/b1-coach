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
  EXIT_VELOCITY_LIMITS,
  LAUNCH_ANGLE_LIMITS,
  POP_UP_BAND,
  EV_SESSION_STEP,
  assertSoftZoneFits,
} from './swingGenerator.js'
import { meetsTarget } from './goalTargets.js'
import { carryDistance } from './ballFlight.js'
import { inStrikeZone, STRIKE_ZONE } from './sessionStats.js'
// The one place the number that makes a swing a pop-up is written down: the
// coaching prose the Reduce Pop-Ups goal hands the coach. The generator does
// not import it, deliberately, because its pop-up band is its own product
// decision rather than the goal's; this test is what holds the two together,
// so a band that stopped producing swings the coach would call pop-ups fails
// here instead of quietly handing the goal a zero again.
import { GOAL_COUNT_SPECS } from './goalCountSpecs.js'

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

// A baseline whose session cannot trigger the empty-band re-roll, for whichever
// source value is about to be measured.
//
// It exists because the first version of these tests measured against a goal
// with no target instead, which quietly cancelled itself out: delete the
// has-a-target check from the generator and the measurement re-rolled exactly
// as the thing it was measuring did, so the four guards below stayed green
// against a broken generator. A session that lands on a real target is the fix.
// Found by breaking the generator on purpose, not by reading it.
//
// IT USED TO BE ONE TYPED BASELINE FOR EVERY VALUE, an impossible hitter at 120
// mph and 45 degrees, and it leaned on something Task 6 removed. The launch
// angle clamp stopped at 35 and the Power band's ceiling is 35 too, so every
// swing that would have sailed off the top of the chart was parked exactly on
// the top of Power's own target and counted as a swing that met the goal. With
// the wall gone that swing comes out around 47 degrees and meets nothing.
//
// No single typed baseline can replace it, and the reason is arithmetic rather
// than tuning: at a source stuck at 0 a swing lands about 17 degrees below its
// session average and at 0.64 about 8 above it, which is 25 degrees of range to
// fit inside a 10 degree band. So the baseline is searched for instead of
// typed, against Reduce Pop-Ups, whose band is the widest in the app and which
// asks nothing of exit velocity. Task 9 retunes every constant in this file,
// which would have made a typed pair of fixtures stale within the week; this
// re-derives itself, and still fails loudly when nothing works at all.
const MEASURING_GOAL = 'popup'
function unRerolledBaselineFor(value) {
  for (let angle = -40; angle <= 80; angle += 1) {
    const baselineSwings = [{ hit: { launch: { exitSpeed: 85, angle } } }]
    const swings = generateSwings({ sessionNum: 2, goalId: MEASURING_GOAL, baselineSwings, random: constantRandom(value).random })
    // Every swing of a session drawn from a constant source is identical, so a
    // returned session that is on target could not have been preceded by an
    // empty first attempt: the first attempt WAS this session. That is what
    // makes checking the returned swings enough to know no re-roll happened.
    if (swings.every((w) => meetsTarget(MEASURING_GOAL, w.hit.launch))) return baselineSwings
  }
  throw new Error(
    `No baseline angle lands a session on the ${MEASURING_GOAL} target at a source stuck at ${value}, ` +
      'so there is no way to measure one attempt without the empty-band re-roll firing inside the measurement.',
  )
}

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
// factor and the limits all draw nothing, and Task 6's three mis-hit draws are
// spent on every swing whether or not it turns out to be one.
function callsPerAttempt(value) {
  const baselineSwings = unRerolledBaselineFor(value)
  const source = constantRandom(value)
  const swings = generateSwings({ sessionNum: 2, goalId: MEASURING_GOAL, baselineSwings, random: source.random })

  // The comment above is a lesson; this is what enforces it. The search picks a
  // baseline that was on target a moment ago, and this re-checks the session
  // actually measured, so a helper that quietly starts measuring two attempts
  // (which would make the four no-target guards below pass against anything)
  // fails loudly here instead.
  for (const swing of swings) {
    expect(
      meetsTarget(MEASURING_GOAL, swing.hit.launch),
      'callsPerAttempt is no longer measuring a single attempt: its baseline stopped clearing the target, so the re-roll now fires inside the measurement itself',
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
    // the limits are the only thing keeping the numbers on the chart.
    //
    // THE LIMITS ARE READ FROM THE GENERATOR, NOT TYPED HERE, for the reason
    // PITCH_MISS_MAX_FEET is already read that way: a test carrying its own
    // copy of a wall cannot drift away from the wall it is guarding, it can
    // only agree with a number that has stopped being true. Task 6 moved the
    // top of the launch angle range from 35 to 50 to make room for a pop-up,
    // and this test asserted 35 until it did.
    //
    // A THIRD CASE THE OLD VERSION HAD NO WAY TO REACH: a mis-hit does not
    // come from the same arithmetic as an ordinary swing, so the two extreme
    // sessions above say nothing about it. The forced pop-up below is a swing
    // off a session already at the bottom of the exit velocity range, where
    // the drop a pop-up takes would push it under the floor.
    const ceiling = [{ hit: { launch: { exitSpeed: 200, angle: 200 } } }]
    const high = generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: ceiling, random: constantRandom(1).random })
    expect(Math.max(...high.map((s) => s.hit.launch.exitSpeed))).toBeLessThanOrEqual(EXIT_VELOCITY_LIMITS.max)
    expect(Math.max(...high.map((s) => s.hit.launch.angle))).toBeLessThanOrEqual(LAUNCH_ANGLE_LIMITS.max)

    const floor = [{ hit: { launch: { exitSpeed: -200, angle: -200 } } }]
    const low = generateSwings({ sessionNum: 2, goalId: 'open', baselineSwings: floor, random: constantRandom(0).random })
    expect(Math.min(...low.map((s) => s.hit.launch.exitSpeed))).toBeGreaterThanOrEqual(EXIT_VELOCITY_LIMITS.min)
    expect(Math.min(...low.map((s) => s.hit.launch.angle))).toBeGreaterThanOrEqual(LAUNCH_ANGLE_LIMITS.min)

    const poppedOffAWeakSession = generateSwings({
      sessionNum: 2,
      goalId: null,
      baselineSwings: [{ hit: { launch: { exitSpeed: 66, angle: 5 } } }],
      random: sequence(...NEUTRAL_HEADER, ...HIGH_ABOVE_ZONE, ...NEUTRAL_SWING, ...FORCED_POP_UP),
    })[0]
    expect(poppedOffAWeakSession.hit.launch.exitSpeed).toBeGreaterThanOrEqual(EXIT_VELOCITY_LIMITS.min)
    expect(poppedOffAWeakSession.hit.launch.angle).toBeLessThanOrEqual(LAUNCH_ANGLE_LIMITS.max)

    // And nothing anywhere in a long ordinary run, which is the case a
    // hand-picked extreme cannot speak for.
    for (const swing of SWEEP) {
      expect(swing.hit.launch.exitSpeed).toBeGreaterThanOrEqual(EXIT_VELOCITY_LIMITS.min)
      expect(swing.hit.launch.exitSpeed).toBeLessThanOrEqual(EXIT_VELOCITY_LIMITS.max)
      expect(swing.hit.launch.angle).toBeGreaterThanOrEqual(LAUNCH_ANGLE_LIMITS.min)
      expect(swing.hit.launch.angle).toBeLessThanOrEqual(LAUNCH_ANGLE_LIMITS.max)
    }
  })

  it('gives two different answers to two swings that both bust a limit', () => {
    // THE DEFECT THIS IS THE TEST FOR IS NOT WHERE THE WALL SAT, IT IS THAT
    // THERE WAS A WALL. Math.min(35, x) hands back 35 for every swing that
    // would have gone past it, so a session's worth of overshoots all land on
    // one value and the chart draws a flat row of dots along its top edge.
    // Both baselines below overshoot; the question is only whether they come
    // out as two numbers or as one.
    //
    // Held against each other rather than against hand-computed values,
    // because what matters is that the ceiling still carries information about
    // how hard the swing was, not what the two particular answers are. Task 9
    // retunes every constant in this file and would have made a pinned pair
    // stale.
    const topOf = (exitSpeed, angle) =>
      generateSwings({
        sessionNum: 2,
        goalId: 'open',
        baselineSwings: [{ hit: { launch: { exitSpeed, angle } } }],
        random: constantRandom(0.5).random,
      })[0].hit.launch

    // THESE TWO BASELINES MOVED IN TASK 7, AND THE FIRST ATTEMPT AT MOVING THEM
    // BROKE THE TEST WITHOUT TURNING IT RED. That story is the reason for the
    // paragraph, because it is the only guard this codebase has against a
    // restored wall.
    //
    // They were 90/40 and 95/60, chosen against an exit velocity ceiling of 97.
    // At a ceiling of 94 both sit past where the curve has flattened under half
    // a mph, so both drew 94 and the test failed for a fixture reason rather
    // than a generator one. They were then moved to 85/38 and 87/42, and that
    // was WRONG in a way a green run could not show: 85/38 produces a raw 92.97
    // mph and 46.72 degrees, which busts NEITHER limit, so this describe's own
    // title was false of its first fixture. Worse, a hard clamp separates those
    // two as happily as the curve does, so the test passed against the exact
    // mutation it exists to catch. Measured, not reasoned about: with
    // withinLimits replaced by Math.max(min, Math.min(max, value)), 85/38 draws
    // 93/47 and 87/42 draws 94/50, which are different, and the test was green
    // against a wall.
    //
    // THE WINDOW THAT ACTUALLY DISCRIMINATES is a raw value above the limit but
    // below the point where the curve flattens onto it: above 94 and below
    // 96.38 mph, above 50 and below 56.51 degrees. Inside it a wall says "the
    // limit" and the curve says something under the limit. So one fixture sits
    // inside that window and the other beyond it:
    //
    //   topOf(87, 42) is raw 94.97 mph and 50.72 degrees. Both bust a limit.
    //     The curve draws 93 and 48; a wall would draw 94 and 50.
    //   topOf(89, 48) is raw 96.97 mph and 56.72 degrees. Both bust a limit,
    //     by enough that the curve has flattened. It draws 94 and 50, which is
    //     what a wall would draw too.
    //
    // Under a wall the two fixtures collapse onto each other, 94/50 against
    // 94/50, and every assertion below fails. That was executed rather than
    // predicted.
    //
    // AND THIS GUARD IS ASYMMETRIC, which nobody should find out by accident.
    // Restoring a wall on exit velocity alone turns three tests red across the
    // suite: this one, the good-quality pin further down this file, and the
    // seeded session snapshot. Restoring a wall on launch angle alone turns
    // exactly ONE red in all 643, and it is the first assertion below. The
    // snapshot does not even move. So the launch angle half of this project's
    // only protection against a returning wall rests on a single line. That is
    // not a reason to widen it today, and it is a reason to think twice before
    // deleting or weakening that one assertion.
    const hard = topOf(87, 42)
    const harder = topOf(89, 48)

    expect(harder.exitSpeed).not.toBe(hard.exitSpeed)
    expect(harder.angle).not.toBe(hard.angle)
    // Said the other way round, which is the form a wall cannot satisfy: the
    // further overshoot reaches the limit and the nearer one stops short of it.
    // A wall hands both of them the limit. Read from the limits rather than
    // typed, so moving a ceiling cannot leave this checking a stale number.
    expect(harder.exitSpeed).toBe(EXIT_VELOCITY_LIMITS.max)
    expect(harder.angle).toBe(LAUNCH_ANGLE_LIMITS.max)
    expect(hard.exitSpeed).toBeLessThan(EXIT_VELOCITY_LIMITS.max)
    expect(hard.angle).toBeLessThan(LAUNCH_ANGLE_LIMITS.max)

    // AND IT IS NOT A PROMISE THAT HOLDS TO INFINITY, which the comment beside
    // the limits now says as well. The drawn number is a whole one, so far
    // enough out the curve flattens under half a unit and two overshoots do
    // draw the same. Pinned here rather than left as prose: this is where that
    // starts, nine and a half degrees above the highest angle the generator has
    // ever been measured producing.
    expect(topOf(90, 200).angle).toBe(LAUNCH_ANGLE_LIMITS.max)
    expect(topOf(90, 1000).angle).toBe(LAUNCH_ANGLE_LIMITS.max)
  })

  it('refuses a soft zone too wide for its own range, rather than inverting', () => {
    // THE FAILURE THIS GUARDS IS WORSE THAN THE WALL IT REPLACED, which is why
    // it throws at module load instead of being a sentence in a comment. Past
    // half the range the two branches of the compression overlap, and the value
    // where they meet becomes a cliff the curve falls off: at a 20 mph zone on a
    // 65 to 97 range, a raw 77.00 draws 78.41 and a raw 77.01 draws 77.01, so a
    // swing struck a hundredth harder comes out nearly a mph and a half softer,
    // on every chart, with nothing anywhere saying so. Task 9 is handed `soft`
    // by name as a constant to tune, so this is a live way to get it wrong.
    //
    // Seen red on purpose, not merely written: dropping the upper half of the
    // condition in swingGenerator.js turns this test red with
    // "expected function to throw an error". Both directions are covered,
    // because a guard that refuses everything would pass a one-sided test.
    expect(() => assertSoftZoneFits('exit velocity', { min: 65, max: 97, soft: 20 })).toThrow(/inverts/)
    expect(() => assertSoftZoneFits('launch angle', { min: -5, max: 50, soft: 30 })).toThrow(/inverts/)
    expect(() => assertSoftZoneFits('exit velocity', { min: 65, max: 97, soft: 0 })).toThrow(/inverts/)

    // Exactly half the range is the widest that still works, and the shipped
    // pair are far inside it. Read from the constants rather than typed, so a
    // retune moves this test with it.
    expect(() => assertSoftZoneFits('exit velocity', { min: 65, max: 97, soft: 16 })).not.toThrow()
    expect(() => assertSoftZoneFits('exit velocity', EXIT_VELOCITY_LIMITS)).not.toThrow()
    expect(() => assertSoftZoneFits('launch angle', LAUNCH_ANGLE_LIMITS)).not.toThrow()
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
  // exit velocity 82 + (0.3 + 0.5*1.2) = 82.9, launch angle
  // 16.5 + (0.5 + 0.5*2) = 18.
  //
  // THE EXIT VELOCITY AVERAGE FELL FROM 84.5 TO 82.9 IN TASK 7, and the launch
  // angle one did not move, which is the session step's whole point rather
  // than an inconsistency: a hitter can change his launch angle inside one
  // practice and cannot change his bat speed.
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
    // 18 + 0.508038 * 22 = 29.18, so the angle draws 29.
    //
    // THE EXIT VELOCITY REACHES 93 BY A DIFFERENT ROUTE AFTER TASK 7, AND THE
    // COINCIDENCE IS WORTH SAYING OUT LOUD. It was 84.5 + 0.502981 * 16 =
    // 92.55, an ordinary swing well inside the range. It is now
    // 82.9 + 0.502981 * 21.88 = 93.91, which is past the soft ceiling's knee at
    // 91, so the compression eases it back to 92.86 and it draws 93 again. The
    // assertion did not move and neither did its meaning, but the arithmetic
    // behind it did, and a comment showing the old sum against the new answer
    // would be the sort of thing this file exists to stop.
    expect(swings[0].hit.launch.exitSpeed).toBe(93)
    expect(swings[0].hit.launch.angle).toBe(29)
  })

  it('drops both numbers together when the quality draw was poor', () => {
    const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random: scripted(0) })
    // The same arithmetic with the quality draw at the other end: the shared
    // term loses 0.6 of the spread, so 0.838302 becomes 0.238302.
    // 82.9 + 0.6 * 0.238302 * 21.88 = 86.03, and 18 + 0.148038 * 22 = 21.26.
    // Nothing here is near a limit, so this pair is the plain arithmetic with
    // no compression in it, unlike the good-quality pair above.
    expect(swings[0].hit.launch.exitSpeed).toBe(86)
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
// BASELINE that is 82.9 mph and 18 degrees, both computed by hand above.
// (The exit velocity half of that read 84.5 until Task 7 shrank the session
// step and nobody moved it. It is the same drift the describe above this one
// carries a whole paragraph about, one screen away, which is how easily this
// kind of comment survives the change it describes.)
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
// Above the zone entirely: the coin misses, the squared miss draw at 1 gives
// the full 0.80 feet, 0.5 picks the high branch out of low/high/wide, and the
// last draw puts it over the middle of the plate. Height 3.5 + 0.80 = 4.30 ft,
// which is the highest pitch this file can throw.
const HIGH_ABOVE_ZONE = [0.99, 1, 0.5, 0.5]
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
    // 82.9 + 0.215674 * 21.88 = 87.62, and 18 + 0.187337 * 22 = 22.12.
    //
    // BOTH HALVES OF THAT SUM MOVED IN TASK 7 AND THE ANSWER DID NOT, which is
    // the second time in this file the same coincidence has come up; the other
    // is the 93 pinned further up, which has its own note. It read
    // `84.5 + 0.215674 * 16 = 87.95` before, and 87.95 and 87.62 both round to
    // 88. Nothing here is near a limit, so unlike that other case there is no
    // compression in this one: the session average simply fell by 1.6 and the
    // scale widened by enough to give it back.
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
    //   0.195% on exit velocity and 0.103% on launch angle. Those two are
    //   Sheppard's correction rather than measurements, so they can be checked
    //   without running anything: sqrt(4.61880**2 + 1/12) / 4.61880 is 1.00195
    //   and sqrt(6.35085**2 + 1/12) / 6.35085 is 1.00103. The clamps pull the
    //   remainder back the other way. (This paragraph first said 0.10 and 0.05,
    //   out by about a factor of two, in the comment written to correct exactly
    //   that. The conclusions did not move; the unexplained remainder simply
    //   sat in the wrong term.)
    //
    //   Launch angle carries the rest, about 0.88%, from the two pitch terms
    //   being correlated at +0.058 rather than at 0, which is explained where
    //   it happens in swingGenerator.js. Exit velocity has no second term and
    //   so has no second effect, which is why it lands within a fifth of a
    //   percent of its constant and launch angle does not.
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
    // POP-UPS ARE LEFT OUT OF THIS MEASUREMENT ON PURPOSE, ADDED 21 AUGUST 2026
    // FOR TASK 6, and the reason is what the assertion is about rather than
    // convenience. A pop-up does not come out of the blending arithmetic at
    // all: the hitter got under the ball, so the angle is drawn from its own
    // band and the exit velocity from the session average, neither of which the
    // scale constants govern or claim to. Left in, 2.64% of swings landing 25
    // degrees off the session mean take the launch angle ratio to 1.199 and
    // exit velocity to 1.048, which would say nothing about whether the pitch
    // was blended in or added on top.
    //
    // The cost of drawing the line at the pop-up band is that an ORDINARY swing
    // that reaches 38 degrees is trimmed too. That is a real, small bias
    // downward, and it is under a tenth of a percent of swings on this goal.
    //
    // THE NUMBERS IN THE PARAGRAPHS ABOVE MOVED WITH THIS CHANGE and are
    // re-measured here rather than left stale. Trimmed, at the committed seed:
    // exit velocity 0.99884 and launch angle 1.01345, against 1.00098 and
    // 1.00931 before Task 6. Both moves are the removal of the two walls
    // showing up. Launch angle rose because a wall at 35 degrees used to squash
    // its upper tail into one value, and exit velocity fell because the soft
    // zone now eases swings in from 94 mph where the old wall only touched the
    // 0.03% that reached 97. (That last figure read "the top 1.4% of swings"
    // until 21 August 2026, when review asked where it came from and the answer
    // was nowhere. Counted properly, by tallying which branch of the
    // compression each swing took across 900,000 of them: 0.50% at the top end,
    // one swing in 200, and 0.85% at either end together. The direction of the
    // argument is unchanged and the size of it is smaller than was claimed.)
    //
    // The band still holds on all 60 seeds, which was re-swept rather than
    // assumed: exit velocity 0.99241 to 1.00710 and launch angle 1.00733 to
    // 1.02164. It holds with LESS ROOM than it did, though, and a future reader
    // should know that before moving anything: the worst seed now sits about
    // three thousandths inside a bound where it used to sit eight. The bounds
    // are deliberately not widened to restore that headroom, because nothing
    // needs them widened today and a band moved to fit a measurement stops
    // being evidence.
    //
    // ── TASK 7, 21 AUGUST 2026: EXIT VELOCITY NOW HAS ITS OWN BAND AND IT
    // SITS ENTIRELY BELOW 1. LAUNCH ANGLE IS UNTOUCHED. ─────────────────────
    //
    // The paragraph above says a band moved to fit a measurement stops being
    // evidence, and that rule is why this note explains a mechanism rather
    // than just quoting a new pair of numbers. Task 7 did two things to exit
    // velocity at once: widened the scale constant from 16 to 21.88, and
    // brought the ceiling down from 97 to 94. Those push the same way. A wider
    // draw off a session average near 83 reaches the knee at 91 far more
    // often, and the knee is three mph lower than it was, so the compression
    // is now shaving an honest amount off the top of every session rather than
    // touching one swing in two hundred. The realised spread comes out about
    // two and a half percent UNDER the scale constant instead of a fifth of a
    // percent over it.
    //
    // Re-swept over the same 60 seeds at the same 4,000 sessions rather than
    // guessed: exit velocity 0.96543 to 0.97956, and launch angle 1.00733 to
    // 1.02164, which is the identical range recorded above because nothing in
    // Task 7 touched the launch angle scale or its limits. The committed seed
    // reads 0.97227 and 1.01345.
    //
    // WHAT THIS COSTS AND WHAT IT DOES NOT. The failure this test exists for
    // is an implementation that ADDS the pitch term on top instead of blending
    // it in, which widens the distribution; that is caught harder than before,
    // not softer, because the whole band now sits below 1 and a widening has
    // further to travel to reach the ceiling of it. What is genuinely lost is
    // that the exit velocity half no longer reads as "the scale constant is
    // the scale", since the compression is now a visible part of the answer.
    // Read it as a band on the realised spread rather than as a statement
    // about the arithmetic alone.
    //
    // AND IT IS NOW COUPLED TO BOTH EXIT_VELOCITY_LIMITS AND EV_SPREAD_MPH,
    // where the old band was coupled to neither, so name both when Task 9 moves
    // one. The spread coupling is not theoretical: putting EV_SPREAD_MPH back
    // to 16 gives 0.99699 and turns this red, while 19 and 24 both pass, so the
    // band admits a window around the shipped value rather than any value. If
    // either constant moves, this band has to be re-swept the way it was here,
    // not widened until the new number fits: a bound stretched to admit a
    // measurement proves nothing about the next one.
    const random = mulberry32(20260821)
    let evSquares = 0
    let laSquares = 0
    let degreesOfFreedom = 0
    for (let i = 0; i < 4000; i++) {
      const swings = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: BASELINE, random })
        .filter((w) => w.hit.launch.angle < POP_UP_BAND.min)
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
    // Exit velocity: 0.955 to 0.99, from a 60-seed sweep that ran 0.96543 to
    // 0.97956. Launch angle: 0.99 to 1.025, untouched by Task 7.
    expect(evRatio).toBeGreaterThan(0.955)
    expect(evRatio).toBeLessThan(0.99)
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
  //
  // ONE RESIDUAL, RECORDED RATHER THAN CHASED. Even widened, 1 of 300 alternative
  // seeds still exceeds this row. That cannot flake here, because the sweep it
  // reads runs off one committed seed and is deterministic, so it is a statement
  // about how much headroom the number has rather than about this test's
  // reliability. Widening it further would start letting a real retune through,
  // which is the thing it exists to catch, so it stays where it is.
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

// ── Getting under a high one ─────────────────────────────────────────────────
//
// The Reduce Pop-Ups goal calls a pop-up a launch angle above the number in
// GOAL_COUNT_SPECS, and until Task 6 the generator could not produce one: the
// launch angle was clamped at exactly that number, so across 4,500,000
// generated swings the count handed to the coach was zero on every session and
// the goal named a failure its own hitter never committed.
//
// A pop-up is a DIFFERENT CONTACT OUTCOME rather than an extreme line drive,
// which is why it is drawn from its own band instead of being reached by
// widening the ordinary spread. Two measurements are behind that. Removing the
// clamp on its own produces nothing usable: swings above the pop-up angle then
// appear on the Power goal alone, 0.04 per session at session 2 rising to 0.38
// at session 4, never above 40 degrees, and stay at zero on the goal that
// needs them. And widening the launch angle spread far enough to reach a
// pop-up makes every generated session visibly wilder than the hand-written
// first session this demo is calibrated against, which is a cure worse than
// the disease.
//
// So it is caused rather than stumbled into: a small per-swing chance, weighted
// by how high the pitch was, that the hitter got under the ball. That ties the
// coach's pop-up coaching to something a visitor can see on the pitch location
// chart beside it.

// The three draws a swing spends on the mis-hit, in the order the generator
// asks for them: whether the hitter got under it, where in the pop-up band the
// ball went, and how much exit velocity it lost. 0.1 is under the chance the
// highest pitch this file throws carries and over nothing else in these tests.
const FORCED_POP_UP = [0.1, 0.5, 0.5]

// A draw that is under the chance a pitch at the top of the zone carries and
// over the chance a pitch at the bottom carries, which is none at all. The
// SAME number is fed to both pitches below, so the only thing separating the
// two swings is where the ball was thrown.
const MIS_HIT_DRAW_A_HIGH_PITCH_MEETS = [0.03, 0.5, 0.5]

// The same swing off the same pitch with the mis-hit coin the other side of
// the line: 0.99 is over the chance any pitch this file throws can carry, so
// the hitter squares it up instead of getting under it. Everything else about
// the two draws is identical, which is what makes the pair a comparison.
const NO_POP_UP = [0.99, 0.5, 0.5]

describe('a pop-up comes off getting under a high pitch', () => {
  const firstSwingWith = (misHitDraws) =>
    generateSwings({
      sessionNum: 2,
      goalId: null,
      baselineSwings: BASELINE,
      random: sequence(...NEUTRAL_HEADER, ...HIGH_ABOVE_ZONE, ...NEUTRAL_SWING, ...misHitDraws),
    })
  const session = firstSwingWith(FORCED_POP_UP)
  const popped = session[0]
  const ordinary = session.slice(1)
  const squaredUp = firstSwingWith(NO_POP_UP)[0]

  it('put the pitch where this test says it did', () => {
    // Without this the two tests below could be satisfied by a sequence that
    // quietly threw the pitch somewhere else, which is what would happen if
    // the pitch draws ever changed order again.
    expect(popped.plateLocHeight).toBe(STRIKE_ZONE.heightMax + PITCH_MISS_MAX_FEET)
    expect(inStrikeZone(popped)).toBe(false)
    // The fourteen swings behind it are ordinary ones off a pitch down the
    // middle, which is what makes them the comparison for the exit velocity
    // assertion below.
    expect(ordinary.every((w) => w.hit.launch.angle < GOAL_COUNT_SPECS.popup.popUpAngle)).toBe(true)
  })

  it('sends the ball up into the pop-up band', () => {
    // Above the angle the goal's own coaching prose calls a pop-up, read from
    // that goal's table rather than typed here, so the generator cannot start
    // producing swings the coach would not call pop-ups.
    expect(popped.hit.launch.angle).toBeGreaterThan(GOAL_COUNT_SPECS.popup.popUpAngle)
    expect(popped.hit.launch.angle).toBeGreaterThanOrEqual(POP_UP_BAND.min)
    expect(popped.hit.launch.angle).toBeLessThanOrEqual(POP_UP_BAND.max)
  })

  it('and takes the sting out of it, coming off the bat under the session average', () => {
    // The session's own average, not a fixed number: a pop-up is soft
    // relative to the hitter having it, whatever kind of day he is having.
    // Measured against the fourteen ordinary swings beside it rather than
    // against all fifteen, because a pop-up dragging the average down and
    // then being compared to it would be an easier test than it looks.
    //
    // THIS ASSERTION ON ITS OWN CANNOT FAIL, AND SAYING SO IS THE POINT.
    // Proven by mutation on 21 August 2026 rather than reasoned about: with
    // the pop-up's exit velocity drop set to zero, so a popped ball comes off
    // the bat at exactly the session average, this line still passed. The
    // fourteen swings it is measured against are off a pitch down the middle
    // and come out five mph ABOVE the session average because of it, so they
    // are a soft comparison rather than a fair one. It is kept because it is
    // the claim a reader wants to see; the assertion below is the one that
    // holds the drop in place.
    const sessionAverage = ordinary.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / ordinary.length
    expect(popped.hit.launch.exitSpeed).toBeLessThan(sessionAverage)

    // The fair comparison: the same swing, off the same pitch, with the same
    // fourteen draws, that the hitter squared up instead. Under the same
    // mutation this one goes red, which is what makes the pair worth having.
    expect(popped.hit.launch.exitSpeed).toBeLessThan(squaredUp.hit.launch.exitSpeed)
    expect(squaredUp.hit.launch.angle).toBeLessThan(GOAL_COUNT_SPECS.popup.popUpAngle)
  })
})

describe('how high the pitch was decides how likely that is', () => {
  const offPitch = (pitchDraws) =>
    generateSwings({
      sessionNum: 2,
      goalId: null,
      baselineSwings: BASELINE,
      random: sequence(...NEUTRAL_HEADER, ...pitchDraws, ...NEUTRAL_SWING, ...MIS_HIT_DRAW_A_HIGH_PITCH_MEETS),
    })[0]

  const high = offPitch(HIGH_IN_ZONE)
  const low = offPitch(LOW_IN_ZONE)

  it('put the two pitches where this test says it did', () => {
    expect(high.plateLocHeight).toBe(3.3)
    expect(low.plateLocHeight).toBe(1.7)
    expect(inStrikeZone(high)).toBe(true)
    expect(inStrikeZone(low)).toBe(true)
  })

  it('pops the high one up and leaves the low one alone, on the identical draw', () => {
    // The whole mechanism, as one comparison. Both swings spend the same
    // eleven draws in the same order; the only difference between them is two
    // feet of pitch height, and it is the difference between a pop-up and an
    // ordinary swing.
    expect(high.hit.launch.angle).toBeGreaterThan(GOAL_COUNT_SPECS.popup.popUpAngle)
    expect(low.hit.launch.angle).toBeLessThan(GOAL_COUNT_SPECS.popup.popUpAngle)
  })
})

// ── Task 7: the session step, the spray, and the variance factor ────────────
//
// The three describes below share one shape, so it is written down once here.
// Each drives a whole session from a fixed, non-neutral sequence: three header
// draws, then the same ten-draw swing pattern repeated for all fifteen swings.
// That makes every swing of the session identical, which is what lets these
// tests talk about "the" exit velocity of a session rather than fifteen of
// them, exactly as `constantRandom` does further up. What it adds over
// `constantRandom` is that the three header draws can be set independently of
// the swing draws, which is the whole subject of the first describe: the
// improve-or-decline coin and the size of the step are header draws, and no
// constant source can hold one at an extreme and the other in the middle.
//
// TEN DRAWS PER SWING, and they are spelled out rather than counted, because a
// sequence that fell out of step with the generator would still return numbers
// and would still produce a session, just not the one the test says it did.
// In the order the generator asks for them: three for a pitch inside the zone
// (the in-zone coin, the height, the side), then the shared quality draw, the
// exit velocity noise, the launch angle noise, the spray direction, and last
// the three mis-hit draws Task 6 spends on every swing whether or not it turns
// out to be one.
function sessionDrivenBy(header, swing) {
  let calls = 0
  return () => {
    const i = calls++
    return i < header.length ? header[i] : swing[(i - header.length) % swing.length]
  }
}

// A swing inside the zone, dead centre, with the three mis-hit draws set so
// this swing is never a pop-up. `contact` is where the swing's own three draws
// sit and `dir` is the spray draw; both are parameters because the describes
// below want different things from them.
//
// WHY THE CONTACT DRAWS ARE A PARAMETER RATHER THAN A CONSTANT, and it was
// found by running rather than by reading. Driven at the top, 19.8 mph above
// its session average, the swing lands inside the soft exit velocity ceiling,
// and the compression there squeezes a 2.7 mph difference between two sessions
// down to nothing at all: both drew 94. A test of the session step measured at
// the top of the range would have been measuring the ceiling instead. So the
// step and the spray are driven from the middle, where nothing is compressed,
// and only the variance factor is driven at the top, because that one needs a
// swing far enough from its session average for a five-hundredth of it to be a
// whole degree.
const SWING_AT = (contact, dir) => [
  0.5, 0.5, 0.5,             // in-zone coin, height 2.5 ft, side 0.0 ft
  contact, contact, contact, // quality, exit velocity noise, launch angle noise
  dir,                       // spray direction
  0.99, 0.5, 0.5,            // got under it (no), pop-up angle, pop-up drop
]

describe('a session step in exit velocity is small enough to be one round of batting practice', () => {
  // WHY THIS IS A TEST AND NOT A COMMENT: a hitter can change his launch angle
  // inside one practice and cannot change his bat speed. The launch angle step
  // keeps its arc for that reason and this one does not, and nothing but this
  // test stops a future tuning pass reading the two as the same knob.
  const sessionOffHeader = (header) =>
    generateSwings({
      sessionNum: 2,
      goalId: null,
      baselineSwings: BASELINE,
      random: sessionDrivenBy(header, SWING_AT(0.5, 0.5)),
    })[0].hit.launch.exitSpeed

  // The improve-or-decline coin, then the size of the step, then the launch
  // angle step held in the middle so only exit velocity moves between these.
  const best = sessionOffHeader([0.5, 1, 0.5])
  const worst = sessionOffHeader([0.99, 1, 0.5])

  it('moves the session average by no more than the step this file declares', () => {
    // Both sessions spend identical swing draws, so every swing's own offset
    // is the same number in both and cancels: what is left between them is the
    // header's step and nothing else. The one slack is rounding to a whole
    // mph, which can move a difference by at most 1 either way, so the bound
    // is the declared span rounded up.
    const declaredSpan = EV_SESSION_STEP.improveMax + EV_SESSION_STEP.declineMax
    expect(best - worst).toBeLessThanOrEqual(Math.ceil(declaredSpan))
  })

  it('still moves it, so the bound above is not satisfied by a generator that stopped stepping at all', () => {
    expect(best - worst).toBeGreaterThanOrEqual(2)
  })

  it('declares a best case no larger than one round of batting practice can deliver', () => {
    // The product decision, written as a number rather than left to the
    // arithmetic above. 1.5 mph is two rounds of ordinary measurement noise on
    // a fifteen-swing average, not a hitter who got stronger between rounds.
    // A tuning pass that pushed this back toward the old +4 turns this red
    // even though the assertion above would still hold, because that one reads
    // its bound from the same constant.
    expect(EV_SESSION_STEP.improveMax).toBeLessThanOrEqual(1.5)
    expect(EV_SESSION_STEP.declineMax).toBeLessThanOrEqual(1.5)
  })
})

describe('where the ball is sprayed does not depend on which session it is', () => {
  const directionsAt = (sessionNum, dir) =>
    generateSwings({
      sessionNum,
      goalId: null,
      baselineSwings: BASELINE,
      random: sessionDrivenBy([0.5, 0.5, 0.5], SWING_AT(0.5, dir)),
    }).map((w) => w.hit.launch.direction)

  it('sprays a session 4 exactly as wide as a session 2, on the identical draw', () => {
    // THE DEFECT THIS CLOSES. `dir` used to be multiplied by the variance
    // factor, which shrinks 1.00 / 0.95 / 0.90, so the hitter sprayed the ball
    // LESS every session. Nothing a hitter does narrows his own spray angle
    // three rounds running, and the visible cost was the Hit to All Fields
    // goal meeting its own stated bar of three pull and three opposite less
    // often on every session a visitor clicked through.
    //
    // Driven at the top of the direction draw, which is where the shrinking
    // showed most: the further from centre a ball was hit, the more the factor
    // took off it.
    expect(directionsAt(4, 1)).toEqual(directionsAt(2, 1))
    expect(directionsAt(3, 1)).toEqual(directionsAt(2, 1))
  })

  it('leans to the pull side rather than the opposite field', () => {
    // A right-handed high school hitter pulls more balls than he goes the
    // other way, and this generator used to do the opposite: the draw was
    // centred at +3.5 degrees, which is an opposite-field hitter. Pull is the
    // negative direction, per SPRAY_CUTOFFS in sessionStats.js.
    const middleOfTheDraw = directionsAt(2, 0.5)
    expect(middleOfTheDraw[0]).toBeLessThan(0)
  })
})

describe('the variance factor reaches the swings, and a test can see how far', () => {
  // THE BLIND SPOT THIS CLOSES. A reviewer once changed the 0.05 in the
  // variance factor six-fold and all 22 generator tests stayed green, because
  // every one of them drove the noise at a neutral value where the factor
  // multiplies zero and disappears. Task 7 changes that constant's REACH, by
  // taking spray direction out from under it, so this is the task that owes
  // the test.
  //
  // TWO CONFIGURATIONS, BECAUSE ONE OF THEM COVERS ONE READING ONLY. The first
  // drives the swing ABOVE its session average off the BASELINE fixture, where
  // only launch angle has room to resolve a step of 0.05: twenty mph above a
  // session average of 83 is inside the soft ceiling and comes back compressed,
  // while twenty degrees above 19 is not. The second drives it far BELOW the
  // average off a harder-hitting baseline, where exit velocity has the room and
  // both readings resolve.
  //
  // THE COMMENT HERE USED TO CLAIM THE FIRST ONE WAS ENOUGH, on the grounds
  // that "the factor multiplies both readings on one line each, so proving it
  // on the reading that can resolve it proves the constant's reach." That is an
  // argument from construction and it is false, which was settled by running
  // it rather than by rereading it. Delete `* varianceFactor` from the exit
  // velocity line in swingGenerator.js and the first configuration stays GREEN,
  // with only the re-capturable session snapshot going red; delete it from the
  // launch angle line and six tests go red. So the blind spot was closed for
  // the constant's value and for its reach into launch angle, and left open for
  // its reach into exit velocity. The second configuration is what closes it,
  // and it catches either deletion on its own.
  //
  // WHAT NEITHER OF THEM COVERS, stated rather than implied. Both read whole
  // numbers, so a change to the 0.05 small enough to be absorbed by rounding
  // passes. SWEPT RATHER THAN DERIVED, because the derived figure first written
  // here was wrong: all three tests stay green only from about 0.049 to 0.054,
  // and at 0.047, 0.048 and every value from 0.055 to 0.070 one of them goes
  // red. So the blind band is roughly minus 2 to plus 8 percent of the shipped
  // constant, not the "0.055 to 0.07, ten to forty percent" that stood here
  // first. These tests are TIGHTER than that comment claimed, which is the safe
  // direction to be wrong in and still worth correcting, because a future
  // reader deciding whether a retune is covered would have believed it.
  //
  // The six-fold change these tests were written for is far outside that band.
  // A fine retune of the constant by Task 9 is inside it, would not be seen
  // here, and is not meant to be.
  const anglesAt = (sessionNum) =>
    generateSwings({
      sessionNum,
      goalId: null,
      baselineSwings: BASELINE,
      random: sessionDrivenBy([0.5, 0.5, 1], SWING_AT(1, 0.5)),
    }).map((w) => w.hit.launch.angle)

  const [s2] = anglesAt(2)
  const [s3] = anglesAt(3)
  const [s4] = anglesAt(4)

  it('drops the swing back toward its session average by a fixed step per session', () => {
    // Every swing of these three sessions spends identical draws, so the
    // session average is the same number in all three and the only thing that
    // differs is the factor. The factor is linear in the session number, so
    // the two steps have to be equal, and they have to be non-zero or the
    // factor is not reaching the swing at all.
    expect(s2 - s3).toBe(s3 - s4)
    expect(s2 - s3).toBeGreaterThan(0)
  })

  it('holds the exact three angles a six-fold change to that constant would move', () => {
    // The magnitude, pinned. A session 2 swing sits 19 degrees above its
    // session average here, so 0.05 of it is a whole degree and each session
    // number draws one lower.
    //
    // WHAT A SIX-FOLD CHANGE ACTUALLY DOES, run rather than predicted, and the
    // first version of this comment got it wrong in a way worth keeping. Take
    // the 0.05 to 0.30, which is the change a reviewer made without a single
    // test noticing, and the factor does NOT read 1.00 / 0.70 / 0.40: the 0.85
    // floor beside it binds on both later sessions, so it reads 1.00 / 0.85 /
    // 0.85 and these three angles come back 38, 35, 35. Both assertions in this
    // describe go red on that, and the one above goes red for the more
    // interesting reason: the floor makes the two steps 3 and 0 rather than
    // equal, so a factor that has stopped being linear in the session number
    // fails on its shape before anyone reads its size.
    //
    // These three will move when Task 9 retunes the scale constants, the same
    // way the fully written-out pair further up this file will. That is the
    // cost of pinning a magnitude, and it is paid on purpose: a test that only
    // asserted the structure above stays green through exactly the change this
    // one exists to catch.
    expect([s2, s3, s4]).toEqual([38, 37, 36])
  })

  it('carries the factor into exit velocity too, which the configuration above cannot see', () => {
    // THE SECOND CONFIGURATION, and the one that closes the half the first
    // leaves open. The pitch is the worst this file throws, 0.80 feet outside
    // the far edge, and all three of the swing's own draws are at the bottom,
    // so the swing lands about twenty mph BELOW its session average instead of
    // above it. The baseline is 90 mph rather than BASELINE's 82 for one
    // reason: twenty below a session average of 90.9 is 70, which clears the
    // soft floor's knee at 68, where twenty below 82.9 would not.
    //
    // Both readings resolve here, and each one catches its own deletion.
    // Executed, not predicted: dropping `* varianceFactor` from the exit
    // velocity line gives 70 / 70 / 70, and dropping it from the launch angle
    // line gives 12 / 12 / 12. Either turns this red.
    //
    // The steps run upward rather than downward because the offset is negative:
    // shrinking a swing's distance from its session average moves a weak swing
    // UP toward it. That is the same fact as the describe above, seen from the
    // other side, and it is worth having both because a sign error in the
    // factor would show in only one of them.
    const WORST_PITCH = [0.99, 1, 0.9, 0.5, 0.9] // wide by the maximum, ordinary height
    const readingsAt = (sessionNum) =>
      generateSwings({
        sessionNum,
        goalId: null,
        baselineSwings: [{ hit: { launch: { exitSpeed: 90, angle: 30 } } }],
        random: sessionDrivenBy([0.5, 0.5, 0.5], [...WORST_PITCH, 0, 0, 0, 0.5, 0.99, 0.5, 0.5]),
      })[0].hit.launch

    const [s2, s3, s4] = [2, 3, 4].map(readingsAt)
    expect([s2.exitSpeed, s3.exitSpeed, s4.exitSpeed]).toEqual([70, 71, 72])
    expect([s2.angle, s3.angle, s4.angle]).toEqual([12, 13, 14])
  })
})
