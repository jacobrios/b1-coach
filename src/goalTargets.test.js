// Tests for what each coaching goal actually asks of a swing.
//
// These numbers used to be written out in five places and had already drifted:
// the launch angle chart banded contact at 8-18 while the pitch location chart
// coloured it 10-20, and both judged it against an exit velocity floor of 88
// that contact's own coaching prompt never mentioned. The goal cards promised a
// third set of numbers again.
//
// The numbers below are written as literals on purpose. Reading them from the
// module under test would let a threshold change quietly rewrite its own test,
// which is exactly the change that most deserves to fail loudly.

import { describe, it, expect } from 'vitest'
import { GOAL_TARGETS, goalTarget, hasTarget, meetsTarget, launchAngleRangeLabel } from './goalTargets.js'

describe('the numbers each goal promises', () => {
  it('power is 25 to 35 degrees at 88 mph and up', () => {
    expect(goalTarget('power')).toEqual({ launchAngle: { min: 25, max: 35 }, exitVelocity: 88 })
  })

  it('contact is 8 to 18 degrees at 85 mph and up', () => {
    expect(goalTarget('contact')).toEqual({ launchAngle: { min: 8, max: 18 }, exitVelocity: 85 })
  })

  it('popup is 10 to 25 degrees with no exit velocity requirement', () => {
    expect(goalTarget('popup')).toEqual({ launchAngle: { min: 10, max: 25 }, exitVelocity: null })
  })
})

describe('the goals that promise nothing', () => {
  // The point of this slice. Open Session's own card says "Free practice, no
  // target metrics" and it was drawing the power target anyway.
  it.each(['allfields', 'open', 'dashboard'])('%s has no target at all', (goalId) => {
    expect(goalTarget(goalId)).toBeNull()
    expect(hasTarget(goalId)).toBe(false)
  })

  it('treats an unknown or missing goal as having no target rather than guessing', () => {
    expect(goalTarget(undefined)).toBeNull()
    expect(goalTarget('not_a_goal')).toBeNull()
    expect(hasTarget(null)).toBe(false)
  })

  it('tells no target apart from a target of nothing', () => {
    // A goal with no target must be an absence. If it were an object full of
    // zeroes the charts could not tell "aim for nothing" from "aim at zero",
    // and the borrowed-band bug comes straight back.
    expect(GOAL_TARGETS.open).toBeUndefined()
    expect(GOAL_TARGETS.allfields).toBeUndefined()
  })

  it('never counts a swing as on target when the goal has no target', () => {
    expect(meetsTarget('open', { exitSpeed: 95, angle: 30 })).toBe(false)
    expect(meetsTarget('allfields', { exitSpeed: 95, angle: 30 })).toBe(false)
  })
})

describe('whether one swing met its goal', () => {
  it('counts a power swing inside the band and over the floor', () => {
    expect(meetsTarget('power', { exitSpeed: 90, angle: 30 })).toBe(true)
  })

  it.each([
    ['at the bottom of the band', 25],
    ['at the top of the band', 35],
  ])('counts a power swing %s, because the bounds are inclusive', (_label, angle) => {
    expect(meetsTarget('power', { exitSpeed: 90, angle })).toBe(true)
  })

  it.each([
    ['just under the band', 24],
    ['just over the band', 36],
  ])('rejects a power swing %s', (_label, angle) => {
    expect(meetsTarget('power', { exitSpeed: 95, angle })).toBe(false)
  })

  it('rejects a power swing in the band but under 88 mph', () => {
    expect(meetsTarget('power', { exitSpeed: 87, angle: 30 })).toBe(false)
  })

  it('counts a contact swing at 85 mph, the floor its own coaching prompt states', () => {
    // This is the drift that started the slice. The launch angle chart judged
    // contact against 88 while the coach told the player 85.
    expect(meetsTarget('contact', { exitSpeed: 85, angle: 12 })).toBe(true)
    expect(meetsTarget('contact', { exitSpeed: 86, angle: 12 })).toBe(true)
  })

  it('rejects a contact swing under 85 mph', () => {
    expect(meetsTarget('contact', { exitSpeed: 84, angle: 12 })).toBe(false)
  })

  it('rejects a contact swing at 20 degrees, which the pitch location chart used to allow', () => {
    expect(meetsTarget('contact', { exitSpeed: 90, angle: 20 })).toBe(false)
  })

  it('counts a popup swing on angle alone, however softly it was hit', () => {
    // Popup has no exit velocity requirement. A swing at 10 to 25 degrees is the
    // whole ask, so a weakly hit ball in that window still counts.
    expect(meetsTarget('popup', { exitSpeed: 66, angle: 15 })).toBe(true)
  })

  it.each([
    ['a grounder below the window', 9],
    ['a pop-up above the window', 26],
  ])('rejects %s on the popup goal', (_label, angle) => {
    expect(meetsTarget('popup', { exitSpeed: 95, angle })).toBe(false)
  })
})

describe('a swing with numbers missing', () => {
  // Every check inside meetsTarget is a rejection, and any comparison against
  // undefined or NaN is false, so a swing carrying no numbers used to fall
  // through every guard and come out as on target. Both charts and the live
  // ticker judge swings through this, so it would have drawn a bright orange
  // "you nailed it" marker for a swing that recorded nothing at all.
  it.each([
    ['nothing at all', {}],
    ['NaN for both', { exitSpeed: NaN, angle: NaN }],
    ['no launch angle', { exitSpeed: 90 }],
    ['no exit velocity', { angle: 30 }],
    ['a null angle', { exitSpeed: 90, angle: null }],
  ])('is not on target when it carries %s', (_label, swing) => {
    expect(meetsTarget('power', swing)).toBe(false)
  })

  it('is not on target on a goal that ignores exit velocity either', () => {
    // Popup has no exit velocity requirement, so a missing angle is the only
    // thing that can disqualify it, and it must.
    expect(meetsTarget('popup', { angle: NaN })).toBe(false)
    expect(meetsTarget('popup', {})).toBe(false)
  })

  it('still counts a popup swing that records no exit velocity, since it needs none', () => {
    expect(meetsTarget('popup', { angle: 15 })).toBe(true)
  })

  it('survives being handed no swing at all', () => {
    expect(() => meetsTarget('power')).not.toThrow()
    expect(meetsTarget('power')).toBe(false)
  })
})

describe('the range as the goal cards write it', () => {
  it('writes power and contact the way the cards read', () => {
    expect(launchAngleRangeLabel('power')).toBe('25–35°')
    expect(launchAngleRangeLabel('contact')).toBe('8–18°')
  })

  it('uses an en dash, which is correct typography in a numeric range', () => {
    expect(launchAngleRangeLabel('power')).toContain('–')
  })

  it('has no range to write for a goal with no target', () => {
    expect(launchAngleRangeLabel('open')).toBeNull()
  })
})
