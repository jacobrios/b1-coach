// Tests for the honest carry distance formula.
//
// The formula it replaces, round(ev * 4.0 + la * 1.8), barely used launch angle
// at all: a ground ball at 4 degrees was recorded carrying 287 feet, almost as
// far as a real line drive. This file exists to prove the replacement actually
// shrinks distance at a low angle instead of merely appearing to.

import { describe, it, expect } from 'vitest'
import { carryDistance, DISTANCE_BUCKETS, distanceBucketCounts, distanceDistributionLine, sprayRadius, SPRAY_RINGS, SPRAY_PLATE_RADIUS, SPRAY_FAIR_RADIUS } from './ballFlight.js'
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
      'Under 175', '175-225', '225-265', '265-305', '305+',
    ])
  })
})

describe('boundary swings under the half-open convention', () => {
  // dist >= min && dist < max, the same rule the strike zone and every goal
  // target already use. A ball at exactly one of these three edges belongs to
  // the bucket that starts there, not the one that ends there.
  it.each([
    [174.9, 'Under 175'],
    [175, '175-225'],
    [224.9, '175-225'],
    [225, '225-265'],
    [264.9, '225-265'],
    [265, '265-305'],
    [304.9, '265-305'],
    [305, '305+'],
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
    [0, 'Under 175'],
    [1, 'Under 175'],
    [74, 'Under 175'],
    [383, '305+'],
    [1000, '305+'],
  ])('%s feet still lands somewhere, in %s', (distance, label) => {
    const counts = distanceBucketCounts([swingAt(distance)])
    expect(counts.reduce((sum, b) => sum + b.count, 0)).toBe(1)
    expect(counts.find((b) => b.count === 1).label).toBe(label)
  })
})

describe('the exact fifteen distances the app opens on', () => {
  // src/App.jsx's mockSwings, the hand-written session 1 every visitor sees
  // first. Before Task 4 the chart rendered 0, 0, 1, 4, 10 against these same
  // distances: two columns permanently empty, one enormous bar. Task 4's own
  // edges (150/200/250/300) rendered this as an even 3, 3, 3, 3, 3. Task 10
  // moved the edges to 175/225/265/305, the product manager's choice from a
  // rendered comparison (see the header comment in ballFlight.js), which
  // renders this same session as 5, 3, 1, 3, 3 — uneven, the way a real
  // measurement reads, rather than five identical bars.
  const mockDistances = [170, 122, 310, 126, 345, 224, 150, 277, 185, 241, 279, 97, 290, 201, 346]
  const swings = mockDistances.map(swingAt)

  it('gives every column real fill: 5, 3, 1, 3, 3', () => {
    expect(distanceBucketCounts(swings).map((b) => b.count)).toEqual([5, 3, 1, 3, 3])
  })

  it('writes the same five numbers into the sentence the coach reads', () => {
    expect(distanceDistributionLine(swings)).toBe(
      'Under 175ft: 5 swings, 175-225ft: 3 swings, 225-265ft: 1 swings, 265-305ft: 3 swings, 305+ft: 3 swings',
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

// ── The spray chart's distance-to-radius mapping ─────────────────────────
//
// The spray chart draws every ball as a dot whose distance from the plate is
// its carry distance. The old mapping was fitted to the old, dishonest carry
// numbers (287-451ft) and centred on 300 feet. Fed the honest numbers it
// collapsed the whole session into the infield and pinned every ball under
// about 177 feet on top of each other at the minimum radius. Confirmed in a
// browser on 14 August 2026, not reasoned about.
//
// These tests exist because the chart itself cannot be tested here: it is JSX
// that drags in a DOM, and this project has no rendering tests by design. So
// the arithmetic underneath it is pulled out and pinned instead.
describe('the spray chart distance-to-radius mapping', () => {
  // Both ends of what the generator can actually produce, measured over 20,000
  // replays per goal per session by scripts/measure-swing-generation.mjs.
  const SHORTEST_REAL_BALL = 74
  const LONGEST_REAL_BALL = 390

  it.each([SHORTEST_REAL_BALL, LONGEST_REAL_BALL])(
    'draws a %sft ball inside fair territory and off the plate',
    (dist) => {
      const r = sprayRadius(dist)
      expect(r).toBeGreaterThan(SPRAY_PLATE_RADIUS)
      expect(r).toBeLessThanOrEqual(SPRAY_FAIR_RADIUS)
    },
  )

  it('never draws a longer ball nearer the plate than a shorter one', () => {
    let previous = -Infinity
    for (let dist = 0; dist <= 500; dist += 1) {
      const r = sprayRadius(dist)
      expect(r).toBeGreaterThanOrEqual(previous)
      previous = r
    }
  })

  it('separates the two ends of the real range instead of stacking them', () => {
    // The specific failure this replaces: everything under 177ft landed on the
    // same pixel. A 74ft dribbler and a 200ft flare must be visibly different.
    expect(sprayRadius(200) - sprayRadius(SHORTEST_REAL_BALL)).toBeGreaterThan(20)
  })

  // The one that stops the printed labels drifting away from the arcs they sit
  // on, which is the same class of bug as the distance buckets drifting from
  // the data. If the scale moves, these go red and whoever moved it has to
  // decide what the rings should now say.
  it('puts each labelled ring exactly where its distance maps to', () => {
    expect(SPRAY_RINGS.map((ring) => ring.feet)).toEqual([200, 300])
    for (const ring of SPRAY_RINGS) {
      expect(ring.radius).toBe(sprayRadius(ring.feet))
      expect(ring.label).toBe(`${ring.feet} ft`)
    }
  })

  it('pins the two ring radii the chart is drawn against', () => {
    expect(SPRAY_RINGS.map((ring) => ring.radius)).toEqual([115, 152.5])
  })

  it('treats a distance it knows nothing about as no carry at all', () => {
    // Same call carryDistance itself makes: reject explicitly rather than let a
    // NaN reach the chart and drop the dot off the screen entirely.
    expect(sprayRadius(undefined)).toBe(SPRAY_PLATE_RADIUS)
    expect(sprayRadius(NaN)).toBe(SPRAY_PLATE_RADIUS)
  })
})
