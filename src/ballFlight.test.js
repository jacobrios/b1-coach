// Tests for the honest carry distance formula.
//
// The formula it replaces, round(ev * 4.0 + la * 1.8), barely used launch angle
// at all: a ground ball at 4 degrees was recorded carrying 287 feet, almost as
// far as a real line drive. This file exists to prove the replacement actually
// shrinks distance at a low angle instead of merely appearing to.

import { describe, it, expect } from 'vitest'
import { carryDistance, DISTANCE_BUCKETS, distanceBucketCounts, distanceDistributionLine } from './ballFlight.js'
import { generateSwings } from './swingGenerator.js'

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

// Tests for the distance buckets the chart and both coach prompts now read
// from one place instead of three. Task 4 of the slice plan: the chart's
// buckets were tuned to the old, dishonest carry formula (160-220ft was its
// shortest column) and both prompts described the same stale ranges, so a
// short honest ball had nowhere to land and the coach could praise a session
// for having "nothing under 220 feet."

// One swing with only the field distanceBucketCounts actually reads. The real
// app's swings carry launch, direction and pitch location too, but the bucket
// logic only ever looks at hit.landing.distance.
const swingAt = (distance) => ({ hit: { landing: { distance } } })

describe('the labels a visitor and the coach both see', () => {
  // Hardcoded against the slice plan's own wording, not against DISTANCE_BUCKETS
  // itself — asserting the constant equals itself would prove nothing about
  // whether the right ranges were chosen.
  it('are exactly the five the plan specified, in order', () => {
    expect(DISTANCE_BUCKETS.map((b) => b.label)).toEqual([
      'Under 150', '150-200', '200-250', '250-300', '300+',
    ])
  })
})

describe('boundary swings under the half-open convention', () => {
  // dist >= min && dist < max, the same rule the strike zone and every goal
  // target already use. A ball at exactly one of these three edges belongs to
  // the bucket that starts there, not the one that ends there.
  it.each([
    [149.9, 'Under 150'],
    [150, '150-200'],
    [199.9, '150-200'],
    [200, '200-250'],
    [249.9, '200-250'],
    [250, '250-300'],
    [299.9, '250-300'],
    [300, '300+'],
  ])('%s feet lands in %s', (distance, label) => {
    const counts = distanceBucketCounts([swingAt(distance)])
    const withOne = counts.filter((b) => b.count === 1)
    expect(withOne).toHaveLength(1)
    expect(withOne[0].label).toBe(label)
  })
})

describe('nothing falls through the bottom or off the top', () => {
  // The old chart's lowest bucket started at 160, so a 74-foot grounder — the
  // shortest ball the honest carry formula produces — vanished from the chart
  // with no column to land in. -Infinity and Infinity on the two outer edges
  // are what rule that out structurally rather than by a number that happens
  // to be low enough today.
  it.each([
    [0, 'Under 150'],
    [1, 'Under 150'],
    [74, 'Under 150'],
    [383, '300+'],
    [1000, '300+'],
  ])('%s feet still lands somewhere, in %s', (distance, label) => {
    const counts = distanceBucketCounts([swingAt(distance)])
    expect(counts.reduce((sum, b) => sum + b.count, 0)).toBe(1)
    expect(counts.find((b) => b.count === 1).label).toBe(label)
  })
})

describe('the exact fifteen distances the app opens on', () => {
  // src/App.jsx's mockSwings, the hand-written session 1 every visitor sees
  // first. Before this task the chart rendered 0, 0, 1, 4, 10 against these
  // same distances: two columns permanently empty, one enormous bar.
  const mockDistances = [170, 122, 310, 126, 345, 224, 150, 277, 185, 241, 279, 97, 290, 201, 346]
  const swings = mockDistances.map(swingAt)

  it('gives every column real fill: 3, 3, 3, 3, 3', () => {
    expect(distanceBucketCounts(swings).map((b) => b.count)).toEqual([3, 3, 3, 3, 3])
  })

  it('writes the same five numbers into the sentence the coach reads', () => {
    expect(distanceDistributionLine(swings)).toBe(
      'Under 150ft: 3 swings, 150-200ft: 3 swings, 200-250ft: 3 swings, 250-300ft: 3 swings, 300+ft: 3 swings',
    )
  })
})

describe('every swing the real generator can produce lands in exactly one bucket', () => {
  // Driven from generateSwings itself, not from hand-picked distances, across
  // every session number and every goal (including null/open, which has no
  // target and therefore no lift or clamp behaviour the others have). If a
  // future change to the carry formula or the buckets ever left a gap, the sum
  // below would drop under 15 for that session and this test would catch it
  // without anyone having to guess which distance escaped.
  const BASELINE = [
    { hit: { launch: { exitSpeed: 80, angle: 15 } } },
    { hit: { launch: { exitSpeed: 84, angle: 18 } } },
  ]
  const goalIds = [null, 'power', 'contact', 'popup', 'allfields', 'open']
  const sessionNums = [2, 3, 4]

  it.each(goalIds)('goal %s: every generated distance is counted exactly once, every session', (goalId) => {
    for (const sessionNum of sessionNums) {
      const swings = generateSwings({ sessionNum, goalId, baselineSwings: BASELINE })
      const counts = distanceBucketCounts(swings)
      const total = counts.reduce((sum, b) => sum + b.count, 0)
      expect(total).toBe(swings.length)
    }
  })
})
