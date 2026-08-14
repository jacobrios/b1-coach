// Tests for the honest carry distance formula.
//
// The formula it replaces, round(ev * 4.0 + la * 1.8), barely used launch angle
// at all: a ground ball at 4 degrees was recorded carrying 287 feet, almost as
// far as a real line drive. This file exists to prove the replacement actually
// shrinks distance at a low angle instead of merely appearing to.

import { describe, it, expect } from 'vitest'
import { carryDistance } from './ballFlight.js'

describe('the reference points the shape is built from', () => {
  // These numbers come straight from the slice plan. They pin the curve so a
  // future change to the constants shows up here rather than silently drifting
  // the chart everyone is looking at.
  it.each([
    [70, 4, 97],
    [75, 6, 126],
    [82, 12, 190],
    [85, 20, 254],
    [88, 26, 310],
    [88, 28, 323],
    [91, 28, 345],
    [97, 28, 390],
    [65, -5, 45],
    [97, 35, 335],
  ])('%s mph at %s degrees carries %s feet', (exitSpeed, angle, feet) => {
    expect(carryDistance({ exitSpeed, angle })).toBe(feet)
  })
})

describe('a low launch angle loses real distance', () => {
  // The whole point of the change. The threshold is two-thirds rather than a
  // half because the curve was measured before this test was written: at 88
  // mph, 8 degrees carries 194 feet against 323 at 28, a ratio of 0.60. Asserting
  // "less than half" would fail against the curve the plan specifies.
  it('a ball below 10 degrees carries no more than two-thirds of the same ball at 28', () => {
    const low = carryDistance({ exitSpeed: 88, angle: 8 })
    const ideal = carryDistance({ exitSpeed: 88, angle: 28 })
    expect(low).toBeLessThanOrEqual(ideal * (2 / 3))
  })
})

describe('carry rises with exit velocity', () => {
  it('is monotonic in exit velocity at a fixed angle', () => {
    const speeds = [65, 70, 75, 80, 85, 90, 95, 97]
    const carries = speeds.map((exitSpeed) => carryDistance({ exitSpeed, angle: 20 }))
    for (let i = 1; i < carries.length; i++) {
      expect(carries[i]).toBeGreaterThanOrEqual(carries[i - 1])
    }
  })
})

describe('carry peaks near the ideal launch angle', () => {
  it('28 degrees beats both 15 and 35 at a fixed exit velocity', () => {
    const low = carryDistance({ exitSpeed: 90, angle: 15 })
    const ideal = carryDistance({ exitSpeed: 90, angle: 28 })
    const high = carryDistance({ exitSpeed: 90, angle: 35 })
    expect(ideal).toBeGreaterThan(low)
    expect(ideal).toBeGreaterThan(high)
  })
})

describe('the extremes of the app\'s own range stay sane', () => {
  // The app only ever generates 65-97 mph and -5 to 35 degrees. Nothing this
  // function is fed inside that range should come out negative or absurd.
  it.each([
    [65, -5],
    [65, 35],
    [97, -5],
    [97, 35],
    [65, 4],
    [97, 28],
  ])('%s mph at %s degrees is between 0 and 400 feet', (exitSpeed, angle) => {
    const feet = carryDistance({ exitSpeed, angle })
    expect(feet).toBeGreaterThanOrEqual(0)
    expect(feet).toBeLessThanOrEqual(400)
  })
})

describe('numbers that are missing or not finite', () => {
  // computeStats had a NaN bug of exactly this shape, fixed in Slice 4. This
  // function must not reintroduce it in a new file.
  it.each([
    ['nothing at all', {}],
    ['NaN for both', { exitSpeed: NaN, angle: NaN }],
    ['no angle', { exitSpeed: 90 }],
    ['no exit speed', { angle: 20 }],
    ['a null angle', { exitSpeed: 90, angle: null }],
    ['a null exit speed', { exitSpeed: null, angle: 20 }],
    ['undefined exit speed', { exitSpeed: undefined, angle: 20 }],
    ['Infinity for exit speed', { exitSpeed: Infinity, angle: 20 }],
  ])('returns 0 rather than NaN when it carries %s', (_label, swing) => {
    expect(carryDistance(swing)).toBe(0)
  })

  it('survives being handed no swing at all', () => {
    expect(() => carryDistance()).not.toThrow()
    expect(carryDistance()).toBe(0)
  })
})
