// Tests for the one table of thresholds each goal's prompt prose names.
//
// The numbers below are written as literals rather than read back from the
// module, for the same reason coachApi.test.js pins the prompt numbers as
// literals: asserting the table against itself would pass no matter what the
// numbers became, and these are the thresholds the coach's counts and the
// grader's fact sheet both hang off.

import { describe, it, expect } from 'vitest'
import { GOAL_COUNT_SPECS, countSpecThresholds, goalCountValues } from './goalCountSpecs.js'
import { GOAL_TARGETS } from './goalTargets.js'
import { GOAL_COUNT_SPECS as REEXPORTED } from './coachApi.js'

describe('GOAL_COUNT_SPECS', () => {
  it('power names its target band and exit velocity, read from the shared targets', () => {
    expect(GOAL_COUNT_SPECS.power.launchAngle).toEqual({ min: 25, max: 35 })
    expect(GOAL_COUNT_SPECS.power.exitVelocity).toBe(88)
    // Read from goalTargets.js, not re-typed: if the shared target moves,
    // this table must move with it.
    expect(GOAL_COUNT_SPECS.power.launchAngle.min).toBe(GOAL_TARGETS.power.launchAngle.min)
    expect(GOAL_COUNT_SPECS.power.exitVelocity).toBe(GOAL_TARGETS.power.exitVelocity)
  })

  it('contact carries its band, its exit velocity, and the fly-ball line its prose names', () => {
    expect(GOAL_COUNT_SPECS.contact.launchAngle).toEqual({ min: 8, max: 18 })
    expect(GOAL_COUNT_SPECS.contact.exitVelocity).toBe(85)
    expect(GOAL_COUNT_SPECS.contact.flyBallAngle).toBe(18)
    expect(GOAL_COUNT_SPECS.contact.launchAngle.max).toBe(GOAL_TARGETS.contact.launchAngle.max)
  })

  it('allfields carries the two direction cutoffs and the hard-contact line', () => {
    expect(GOAL_COUNT_SPECS.allfields.pullDirection).toBe(-15)
    expect(GOAL_COUNT_SPECS.allfields.oppoDirection).toBe(15)
    expect(GOAL_COUNT_SPECS.allfields.hardContactExitVelocity).toBe(82)
  })

  it('popup carries its band and the pop-up and grounder lines', () => {
    expect(GOAL_COUNT_SPECS.popup.launchAngle).toEqual({ min: 10, max: 25 })
    expect(GOAL_COUNT_SPECS.popup.popUpAngle).toBe(35)
    expect(GOAL_COUNT_SPECS.popup.grounderAngle).toBe(5)
  })

  it('open has no entry: absence, not a row of zeroes, matching goalTargets', () => {
    expect(GOAL_COUNT_SPECS.open).toBeUndefined()
  })

  it('is re-exported unchanged from coachApi.js, where the plan says to find it', () => {
    expect(REEXPORTED).toBe(GOAL_COUNT_SPECS)
  })
})

describe('countSpecThresholds', () => {
  // The flattened {metric: [values]} shape the grader's fact sheet consumes.
  it('flattens power to its band edges and exit velocity', () => {
    expect(countSpecThresholds('power')).toEqual({
      launchAngle: [25, 35],
      exitVelocity: [88],
    })
  })

  it('flattens contact to band edges plus the fly-ball line, deduped', () => {
    // 18 is named twice (band edge and fly-ball cutoff) and appears once.
    expect(countSpecThresholds('contact')).toEqual({
      launchAngle: [8, 18],
      exitVelocity: [85],
    })
  })

  it('leaves no angle uncounted between the line-drive band and the fly-ball line', () => {
    // The band ends at 18 inclusive and fly balls start strictly above 18,
    // so every angle is one or the other and 18 itself is a line drive.
    expect(GOAL_COUNT_SPECS.contact.flyBallAngle).toBe(GOAL_COUNT_SPECS.contact.launchAngle.max)
  })

  it('flattens allfields to both direction cutoffs and the hard-contact line', () => {
    expect(countSpecThresholds('allfields')).toEqual({
      direction: [-15, 15],
      exitVelocity: [82],
    })
  })

  it('flattens popup to its band edges plus the pop-up and grounder lines', () => {
    expect(countSpecThresholds('popup')).toEqual({
      launchAngle: [10, 25, 35, 5],
    })
  })

  it('returns an empty object for open and for a goal it does not know', () => {
    expect(countSpecThresholds('open')).toEqual({})
    expect(countSpecThresholds('dashboard')).toEqual({})
    expect(countSpecThresholds(undefined)).toEqual({})
  })
})

describe('goalCountValues', () => {
  // Three swings chosen so each predicate has both members and non-members:
  // EV 91/74/85, LA 27/9/18, direction -20/18/-15.
  const swings = [
    { exitSpeed: 91, angle: 27, direction: -20 },
    { exitSpeed: 74, angle: 9, direction: 18 },
    { exitSpeed: 85, angle: 18, direction: -15 },
  ].map((launch) => ({ hit: { launch } }))

  it('computes power: strictly under 15 degrees, and the two-metric power zone', () => {
    expect(goalCountValues('power', swings)).toEqual({
      underFifteen: { count: 1, swings: [2] },   // only 9
      powerZone: { count: 1, swings: [1] },      // 91 mph at 27 degrees
    })
  })

  it('computes contact: inclusive 8-18 band, 85+ hard contact, fly balls strictly above the cutoff', () => {
    expect(goalCountValues('contact', swings)).toEqual({
      contactTargetBand: { count: 2, swings: [2, 3] },  // 9 and 18; 18 is inclusive
      contactHardHit: { count: 2, swings: [1, 3] },     // 91 and exactly 85
      contactFlyBall: { count: 1, swings: [1] },        // only 27 is strictly above
    })
  })

  it('computes allfields: strict direction cutoffs and 82+ hard contact', () => {
    expect(goalCountValues('allfields', swings)).toEqual({
      pullSide: { count: 1, swings: [1] },              // -20; -15 exactly is excluded
      oppoField: { count: 1, swings: [2] },             // 18; +15 exactly would be excluded
      allfieldsHardContact: { count: 2, swings: [1, 3] },
    })
  })

  it('computes popup: strict pop-up and grounder cutoffs, inclusive 10-25 band', () => {
    expect(goalCountValues('popup', swings)).toEqual({
      popUp: { count: 0, swings: [] },
      weakGrounder: { count: 0, swings: [] },
      popupTargetBand: { count: 1, swings: [3] },       // only 18
    })
  })

  it('hands open and unknown goals nothing', () => {
    expect(goalCountValues('open', swings)).toEqual({})
    expect(goalCountValues('dashboard', swings)).toEqual({})
  })
})
