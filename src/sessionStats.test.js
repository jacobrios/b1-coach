// Tests for the four numbers a session is summarized by.
//
// These reach the player twice: along the bottom of the results screen, and
// inside the prompt the coach answers from. A wrong number here is a coach
// confidently narrating something that did not happen.

import { describe, it, expect } from 'vitest'
import { computeStats } from './sessionStats.js'

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

// ── Pinned, not endorsed ────────────────────────────────────────────────────
// Recorded rather than approved. Found while scoping the test suite and left for
// a follow-up slice, so this change adds a safety net without also changing
// behavior. It is not reachable today: a session always generates fifteen swings.

it('currently returns NaN for an empty session (recorded, not endorsed)', () => {
  // Dividing by a total of zero. These NaNs would flow into the coach prompt as
  // the literal text "NaN mph" and onto the results screen.
  const stats = computeStats([])
  expect(stats.avgExitVelocity).toBeNaN()
  expect(stats.avgLaunchAngle).toBeNaN()
  expect(stats.inZoneCount).toBe(0)
  expect(stats.totalSwings).toBe(0)
})
