// Tests for the one table of thresholds each goal's prompt prose names.
//
// The numbers below are written as literals rather than read back from the
// module, for the same reason coachApi.test.js pins the prompt numbers as
// literals: asserting the table against itself would pass no matter what the
// numbers became, and these are the thresholds the coach's counts and the
// grader's fact sheet both hang off.

import { describe, it, expect } from 'vitest'
import { GOAL_COUNT_SPECS, countSpecThresholds } from './goalCountSpecs.js'
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
    expect(GOAL_COUNT_SPECS.contact.flyBallAngle).toBe(20)
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

  it('flattens contact to band edges plus the fly-ball line', () => {
    expect(countSpecThresholds('contact')).toEqual({
      launchAngle: [8, 18, 20],
      exitVelocity: [85],
    })
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
