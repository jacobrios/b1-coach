// Tests for the four numbers a session is summarized by.
//
// These reach the player twice: along the bottom of the results screen, and
// inside the prompt the coach answers from. A wrong number here is a coach
// confidently narrating something that did not happen.

import { describe, it, expect } from 'vitest'
import { computeStats, topExitVelocity, inStrikeZone, pitchZoneBreakdown, STRIKE_ZONE } from './sessionStats.js'

// Minimal shape of a swing, matching what the app generates.
const swing = ({ ev = 85, la = 20, height = 2.5, side = 0 }) => ({
  plateLocHeight: height,
  plateLocSide: side,
  hit: { launch: { exitSpeed: ev, angle: la, direction: 0 }, landing: { distance: 350 } },
})

describe('the averages the coach quotes', () => {
  it('averages exit velocity across the session', () => {
    const stats = computeStats([swing({ ev: 80 }), swing({ ev: 90 })])
    expect(stats.avgExitVelocity).toBe(85)
  })

  it('averages launch angle across the session', () => {
    const stats = computeStats([swing({ la: 10 }), swing({ la: 21 })])
    expect(stats.avgLaunchAngle).toBe(16) // 15.5 rounds up
  })

  it('rounds rather than truncating, so a 84.6 average is not reported as 84', () => {
    const stats = computeStats([swing({ ev: 84 }), swing({ ev: 84 }), swing({ ev: 86 })])
    expect(stats.avgExitVelocity).toBe(85)
  })

  it('counts every swing it was given', () => {
    expect(computeStats(Array.from({ length: 15 }, () => swing({}))).totalSwings).toBe(15)
  })
})

describe('what counts as being in the strike zone', () => {
  it('counts a swing in the middle of the zone', () => {
    expect(computeStats([swing({ height: 2.5, side: 0 })]).inZoneCount).toBe(1)
  })

  it.each([
    ['at the bottom edge', 1.5, 0],
    ['at the top edge', 3.5, 0],
    ['at the inside edge', 2.5, -0.7],
    ['at the outside edge', 2.5, 0.7],
  ])('counts a swing %s, because the bounds are inclusive', (_label, height, side) => {
    expect(computeStats([swing({ height, side })]).inZoneCount).toBe(1)
  })

  it.each([
    ['below the zone', 1.49, 0],
    ['above the zone', 3.51, 0],
    ['inside off the plate', 2.5, -0.71],
    ['outside off the plate', 2.5, 0.71],
  ])('does not count a swing %s', (_label, height, side) => {
    expect(computeStats([swing({ height, side })]).inZoneCount).toBe(0)
  })

  it('counts only the swings in the zone, not all of them', () => {
    const stats = computeStats([
      swing({ height: 2.5 }), swing({ height: 2.5 }), swing({ height: 1.0 }),
    ])
    expect(stats.inZoneCount).toBe(2)
    expect(stats.totalSwings).toBe(3)
  })
})

describe('the hardest swing of the session', () => {
  it('reports the highest exit velocity', () => {
    expect(topExitVelocity([swing({ ev: 80 }), swing({ ev: 94 }), swing({ ev: 88 })])).toBe(94)
  })

  it('reports the only swing when there is one', () => {
    expect(topExitVelocity([swing({ ev: 77 })])).toBe(77)
  })
})

// ── A session with no swings ────────────────────────────────────────────────
// Fixed in Slice 4. Neither of these is reachable today, because a session always
// generates exactly fifteen swings. They were fixed anyway: a test asserting a
// known-wrong number is worse than no test, and an empty session is one guard
// away from real whenever the swing source stops being a generator.
//
// The answer in both cases is nothing rather than zero. A zero is a claim that
// the player swung and got zero. The screen already draws a dash for a missing
// number, so returning null is what puts an honest dash on the tile.

describe('an empty session', () => {
  it('has no average to report, rather than NaN', () => {
    // These used to be NaN, from dividing by a total of zero. They would have
    // reached the coach's own prompt as the literal text "NaN mph".
    const stats = computeStats([])
    expect(stats.avgExitVelocity).toBeNull()
    expect(stats.avgLaunchAngle).toBeNull()
  })

  it('still counts nothing as nothing, because those are real counts', () => {
    const stats = computeStats([])
    expect(stats.inZoneCount).toBe(0)
    expect(stats.totalSwings).toBe(0)
  })

  it('has no hardest swing to report, rather than -Infinity', () => {
    // Math.max of nothing is -Infinity, and the tile's guard checked that the
    // swing list existed rather than that it had anything in it, so the player
    // would have been shown "-Infinity mph".
    expect(topExitVelocity([])).toBeNull()
  })
})

// Bounds as literals, not read back from STRIKE_ZONE: asserting the zone
// against itself would pass no matter what the numbers became.
describe('pitchZoneBreakdown', () => {
  const swings = [
    { plateLocHeight: 2.5, plateLocSide: 0.0 },  // in zone
    { plateLocHeight: 3.6, plateLocSide: 0.2 },  // high
    { plateLocHeight: 1.2, plateLocSide: -0.3 }, // low
    { plateLocHeight: 2.8, plateLocSide: 0.9 },  // wide
    { plateLocHeight: 1.4, plateLocSide: -0.8 }, // low AND wide at once
    { plateLocHeight: 3.5, plateLocSide: -0.7 }, // exactly on both bounds: in zone
  ]

  it('classifies high, low, and wide pitches with 1-indexed swing numbers', () => {
    const zone = pitchZoneBreakdown(swings)
    expect(zone.high).toEqual({ count: 1, swings: [2] })
    expect(zone.low).toEqual({ count: 2, swings: [3, 5] })
    expect(zone.wide).toEqual({ count: 2, swings: [4, 5] })
  })

  it('counts the outside union once per swing, even when a pitch is off in two directions', () => {
    const zone = pitchZoneBreakdown(swings)
    expect(zone.outside).toEqual({ count: 4, swings: [2, 3, 4, 5] })
  })

  it('treats the bounds as inclusive, matching computeStats', () => {
    expect(inStrikeZone({ plateLocHeight: 3.5, plateLocSide: -0.7 })).toBe(true)
    expect(inStrikeZone({ plateLocHeight: 1.5, plateLocSide: 0.7 })).toBe(true)
    expect(inStrikeZone({ plateLocHeight: 3.51, plateLocSide: 0 })).toBe(false)
  })

  it('agrees with computeStats about who is in the zone', () => {
    // 4 outside, so 2 in zone: the two numbers must always sum to the total.
    expect(computeStats(swings.map((s) => ({ ...s, hit: { launch: { exitSpeed: 80, angle: 10 } } }))).inZoneCount).toBe(2)
  })
})
