// Tests for the deterministic fact sheet the accuracy grader hands to the
// model. No model calls here: every value asserted below is computed by
// plain arithmetic over a small fixture, so a broken threshold count or a
// wrong stat shows up as a red test rather than a wrong grading verdict
// later. See scripts/factSheet.js for what each function is for.

import { describe, it, expect } from 'vitest'
import {
  swingRow,
  candidateThresholds,
  thresholdCounts,
  buildSessionFactSheet,
  buildFactSheet,
  goalExtraThresholds,
} from './factSheet.js'

// Five swings, hand-picked so every threshold case (strictly above, strictly
// below, exactly equal) has at least one member. Session 1's real fifteen
// swings would work too, but a 5-row fixture keeps the arithmetic checkable
// by eye.
const swings = [
  { plateLocHeight: 2.0, plateLocSide: 0.0, hit: { launch: { exitSpeed: 80, angle: 10, direction: 5 }, landing: { distance: 150 } } },
  { plateLocHeight: 2.5, plateLocSide: 0.1, hit: { launch: { exitSpeed: 90, angle: 20, direction: -5 }, landing: { distance: 300 } } },
  { plateLocHeight: 1.0, plateLocSide: -0.5, hit: { launch: { exitSpeed: 70, angle: 5, direction: 20 }, landing: { distance: 100 } } },
  { plateLocHeight: 2.2, plateLocSide: 0.2, hit: { launch: { exitSpeed: 95, angle: 30, direction: 0 }, landing: { distance: 350 } } },
  { plateLocHeight: 3.0, plateLocSide: 0.3, hit: { launch: { exitSpeed: 85, angle: 15, direction: -20 }, landing: { distance: 220 } } },
]

describe('swingRow', () => {
  it('extracts the six fields the grader needs, 1-indexed', () => {
    expect(swingRow(swings[0], 0)).toEqual({
      n: 1,
      exitVelocity: 80,
      launchAngle: 10,
      direction: 5,
      distance: 150,
      pitchHeight: 2.0,
      pitchSide: 0.0,
    })
    expect(swingRow(swings[4], 4).n).toBe(5)
  })
})

describe('candidateThresholds', () => {
  it('includes every observed value, rounded and deduped', () => {
    const rows = swings.map(swingRow)
    const thresholds = candidateThresholds(rows, 'launchAngle', [])
    // Observed launch angles: 10, 20, 5, 30, 15 — all already integers.
    for (const v of [5, 10, 15, 20, 30]) expect(thresholds).toContain(v)
  })

  it('adds the base "plausibly cited" thresholds even when the session never produced them', () => {
    const rows = swings.map(swingRow)
    // Direction values in the fixture are 5, -5, 20, 0, -20 — neither -15
    // nor 15 appears. Both are still in the module's base extras (the
    // pull/oppo cutoffs the allfields goal context quotes), so a coach
    // citing either must still be checkable.
    const thresholds = candidateThresholds(rows, 'direction', [])
    expect(thresholds).toContain(-15)
    expect(thresholds).toContain(15)
    expect(thresholds).not.toContain(-5.5) // sanity: no fabricated values
  })

  it('adds caller-supplied extras (goal-specific numbers) on top of the base set', () => {
    const rows = swings.map(swingRow)
    const thresholds = candidateThresholds(rows, 'exitVelocity', [77])
    expect(thresholds).toContain(77)
  })

  it('returns a sorted, deduplicated array', () => {
    const rows = swings.map(swingRow)
    const thresholds = candidateThresholds(rows, 'launchAngle', [10, 10, 20])
    const sorted = [...thresholds].sort((a, b) => a - b)
    expect(thresholds).toEqual(sorted)
    expect(new Set(thresholds).size).toBe(thresholds.length)
  })
})

describe('thresholdCounts', () => {
  it('computes above/below/equal with swing lists, atLeast/atMost as counts only', () => {
    const rows = swings.map(swingRow)
    const [row10] = thresholdCounts(rows, 'launchAngle', [10])

    // Launch angles: 10, 20, 5, 30, 15 (swing numbers 1..5).
    expect(row10.threshold).toBe(10)
    expect(row10.above).toEqual({ count: 3, swings: [2, 4, 5] }) // 20, 30, 15
    expect(row10.below).toEqual({ count: 1, swings: [3] }) // 5
    expect(row10.equal).toEqual({ count: 1, swings: [1] }) // 10
    // atLeast/atMost deliberately carry no swing list: every verified coach
    // error in the regrade report used strict "above"/"under" language, and
    // the inclusive rows are the largest single source of the fact sheet's
    // size (they mostly duplicate above/below's own lists). A claim using
    // inclusive language ("at least") is still checkable by its count.
    expect(row10.atLeast).toEqual({ count: 4 })
    expect(row10.atMost).toEqual({ count: 2 })
  })

  it('produces one row per requested threshold, in the order given', () => {
    const rows = swings.map(swingRow)
    const result = thresholdCounts(rows, 'exitVelocity', [70, 90])
    expect(result.map((r) => r.threshold)).toEqual([70, 90])
  })

  it('an out-of-range threshold has an empty above or below set, not a missing one', () => {
    const rows = swings.map(swingRow)
    const [tooHigh] = thresholdCounts(rows, 'exitVelocity', [1000])
    expect(tooHigh.above).toEqual({ count: 0, swings: [] })
    expect(tooHigh.below.count).toBe(5)
  })
})

describe('buildSessionFactSheet', () => {
  const session = {
    sessionNumber: 2,
    swings,
    stats: { avgExitVelocity: 84, avgLaunchAngle: 16, inZoneCount: 4, totalSwings: 5 },
  }

  it('carries the session number and per-swing table through', () => {
    const sheet = buildSessionFactSheet(session)
    expect(sheet.sessionNumber).toBe(2)
    expect(sheet.swings).toHaveLength(5)
    expect(sheet.swings[3]).toEqual({ n: 4, exitVelocity: 95, launchAngle: 30, direction: 0, distance: 350, pitchHeight: 2.2, pitchSide: 0.2 })
  })

  it('computes underFifteenCount exactly like the coach prompt does (strictly below 15)', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'power' })
    // Angles 10, 20, 5, 30, 15 -> strictly under 15 is swings 1 (10) and 3 (5).
    // Swing 5 sits at exactly 15 and must NOT count, matching the prompt's
    // own "not including 15" wording in coachApi.js.
    expect(sheet.stats.underFifteenCount).toBe(2)
    expect(sheet.stats.underFifteenSwings).toEqual([1, 3])
  })

  it('computes powerZoneCount using the real goal target (LA 25-35, EV >= 88)', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'power' })
    // Only swing 4 (EV 95, LA 30) meets both.
    expect(sheet.stats.powerZoneCount).toBe(1)
    expect(sheet.stats.powerZoneSwings).toEqual([4])
  })

  it('computes topExitVelocity and the top-3 list the prompt also sends', () => {
    const sheet = buildSessionFactSheet(session)
    expect(sheet.stats.topExitVelocity).toBe(95)
    expect(sheet.stats.top3ExitVelocities).toEqual([95, 90, 85])
  })

  it('passes the session stats fields through unchanged', () => {
    const sheet = buildSessionFactSheet(session)
    expect(sheet.stats.avgExitVelocity).toBe(84)
    expect(sheet.stats.avgLaunchAngle).toBe(16)
    expect(sheet.stats.inZoneCount).toBe(4)
    expect(sheet.stats.totalSwings).toBe(5)
  })

  it('builds a threshold table for every tracked metric', () => {
    const sheet = buildSessionFactSheet(session)
    for (const metric of ['exitVelocity', 'launchAngle', 'direction', 'distance', 'pitchHeight', 'pitchSide']) {
      expect(Array.isArray(sheet.thresholds[metric])).toBe(true)
      expect(sheet.thresholds[metric].length).toBeGreaterThan(0)
    }
  })

  it('merges caller-supplied extra thresholds into the goal-specific metric', () => {
    const sheet = buildSessionFactSheet(session, { extraThresholds: { exitVelocity: [77] } })
    const thresholdValues = sheet.thresholds.exitVelocity.map((r) => r.threshold)
    expect(thresholdValues).toContain(77)
  })
})

describe('goalExtraThresholds', () => {
  // Slice 8b: every threshold a goal's prompt prose names must produce a
  // fact-sheet row, or the grader cannot rule on a claim at it. The
  // prose-only numbers (fly-ball 20, direction -15/+15, hard-contact 82,
  // pop-up 35, grounder 5) come from GOAL_COUNT_SPECS in
  // src/goalCountSpecs.js, the same table the prose itself interpolates, so
  // the grader and the prompt cannot disagree about what was counted.

  it('contact gains the above-18-degrees fly-ball line its prose names', () => {
    expect(goalExtraThresholds('contact').launchAngle).toContain(18)
  })

  it('allfields gains both direction cutoffs, a metric it never carried before', () => {
    const extras = goalExtraThresholds('allfields')
    expect(extras.direction).toContain(-15)
    expect(extras.direction).toContain(15)
  })

  it('allfields gains its own 82 mph hard-contact line, not just Power\'s 88', () => {
    expect(goalExtraThresholds('allfields').exitVelocity).toContain(82)
  })

  it('popup gains its above-35 and below-5 lines', () => {
    const extras = goalExtraThresholds('popup')
    expect(extras.launchAngle).toContain(35)
    expect(extras.launchAngle).toContain(5)
  })

  // Slice 8c: the prompt has been per-goal since Slice 8b, and grading a
  // correct claim against leaked Power stats is what produced Slice 8b's
  // false positives (see the 18 August 2026 correction). A goal other than
  // Power must NOT pick up Power's own launch-angle band or exit-velocity
  // minimum any more.
  it('does not merge Power\'s targets into other goals any more', () => {
    // Power's own band is launch angle 25-35, exit velocity 88. Popup's own
    // prose legitimately reaches both 25 (its target band's own max) and 35
    // (its own "pop-ups above 35 degrees" line), so those two are checked
    // only for the goals that do not own them for a different reason.
    for (const goalId of ['contact', 'allfields', 'open']) {
      const extras = goalExtraThresholds(goalId)
      expect(extras.launchAngle ?? []).not.toContain(25)
      expect(extras.launchAngle ?? []).not.toContain(35)
    }
    for (const goalId of ['contact', 'allfields', 'popup', 'open']) {
      expect(goalExtraThresholds(goalId).exitVelocity ?? []).not.toContain(88)
    }
  })

  it('seeds pitchHeight and pitchSide with the strike-zone bounds for every goal', () => {
    const extras = goalExtraThresholds('open')
    expect(extras.pitchHeight).toEqual([1.5, 3.5])
    expect(extras.pitchSide).toEqual([-0.7, 0.7])
  })

  it('a goal with no specs and no target gets only its own target and the zone bounds', () => {
    const extras = goalExtraThresholds('open')
    expect(extras.launchAngle).toEqual([])
    expect(extras.exitVelocity).toEqual([])
    expect(extras.direction).toBeUndefined()
  })
})

describe('per-goal and zone stats (Slice 8c)', () => {
  const session = { sessionNumber: 1, swings, stats: { avgExitVelocity: 84, avgLaunchAngle: 16, inZoneCount: 4, totalSwings: 5 } }

  it('hands every goal the zone breakdown the prompt now hands the coach', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'open' })
    expect(sheet.stats.outsideZoneCount).toBe(1)
    expect(sheet.stats.outsideZoneSwings).toEqual([3])
    expect(sheet.stats.lowPitchCount).toBe(1)
    expect(sheet.stats.lowPitchSwings).toEqual([3])
    expect(sheet.stats.highPitchCount).toBe(0)
    expect(sheet.stats.widePitchCount).toBe(0)
  })

  it('gives contact its own three counts and no Power stats', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'contact' })
    // Band 8-18 inclusive: angles 10 and 15. 85+: 90, 95, exactly 85.
    // Fly balls strictly above 18: 20 and 30.
    expect(sheet.stats.contactTargetBandCount).toBe(2)
    expect(sheet.stats.contactTargetBandSwings).toEqual([1, 5])
    expect(sheet.stats.contactHardHitCount).toBe(3)
    expect(sheet.stats.contactFlyBallCount).toBe(2)
    expect(sheet.stats.powerZoneCount).toBeUndefined()
    expect(sheet.stats.underFifteenCount).toBeUndefined()
  })

  it('keeps power stats, under their pre-8c names, for the power goal only', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'power' })
    // Strictly under 15: angles 10 and 5. Power zone: 95 mph at 30 degrees.
    expect(sheet.stats.underFifteenCount).toBe(2)
    expect(sheet.stats.underFifteenSwings).toEqual([1, 3])
    expect(sheet.stats.powerZoneCount).toBe(1)
    expect(sheet.stats.powerZoneSwings).toEqual([4])
    expect(sheet.stats.contactTargetBandCount).toBeUndefined()
  })

  it('builds pitch-location threshold rows seeded with the zone bounds', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'open', extraThresholds: goalExtraThresholds('open') })
    const row = sheet.thresholds.pitchHeight.find((r) => r.threshold === 1.5)
    // Heights 2.0, 2.5, 1.0, 2.2, 3.0: only 1.0 is below 1.5.
    expect(row.below).toEqual({ count: 1, swings: [3] })
  })
})

describe('buildFactSheet', () => {
  const makeSession = (n) => ({
    sessionNumber: n,
    swings,
    stats: { avgExitVelocity: 80 + n, avgLaunchAngle: 15, inZoneCount: 3, totalSwings: 5 },
  })

  it('keeps only sessions up to and including the viewing session, in order', () => {
    const sheet = buildFactSheet({
      sessions: [makeSession(3), makeSession(1), makeSession(2), makeSession(4)],
      viewingSessionNumber: 2,
    })
    expect(sheet.sessions.map((s) => s.sessionNumber)).toEqual([1, 2])
  })

  it('echoes the viewing session number back for the prompt builder to read', () => {
    const sheet = buildFactSheet({ sessions: [makeSession(1)], viewingSessionNumber: 1 })
    expect(sheet.viewingSessionNumber).toBe(1)
  })

  it('threads extraThresholds through to every session', () => {
    const sheet = buildFactSheet({
      sessions: [makeSession(1), makeSession(2)],
      viewingSessionNumber: 2,
      extraThresholds: { distance: [271] },
    })
    for (const s of sheet.sessions) {
      expect(s.thresholds.distance.map((r) => r.threshold)).toContain(271)
    }
  })
})

// Slice 10 Task 7. The prompt now hands every goal three spray counts, and a
// count the coach was handed with no matching fact-sheet stat is exactly what
// produced Slice 8b's false positives: the grader checks the claim against
// the nearest other row and calls a true statement false. Directions in the
// fixture are 5, -5, 20, 0, -20, so pull is swing 5, oppo is swing 3, and the
// other three are up the middle.
describe('the spray counts every goal is now handed (Slice 10)', () => {
  const session = { sessionNumber: 1, swings, stats: { avgExitVelocity: 84, avgLaunchAngle: 16, inZoneCount: 4, totalSwings: 5 } }

  it.each(['open', 'power', 'contact', 'popup', 'allfields'])(
    'carries pull, up the middle and opposite field for the %s goal',
    (goalId) => {
      const sheet = buildSessionFactSheet(session, { goalId })
      expect(sheet.stats.pullSideCount).toBe(1)
      expect(sheet.stats.pullSideSwings).toEqual([5])
      expect(sheet.stats.upTheMiddleCount).toBe(3)
      expect(sheet.stats.upTheMiddleSwings).toEqual([1, 2, 4])
      expect(sheet.stats.oppoFieldCount).toBe(1)
      expect(sheet.stats.oppoFieldSwings).toEqual([3])
    },
  )

  it('does not disagree with the allfields goal counts, which name the same two buckets', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'allfields' })
    // allfields' own pullSide/oppoField stats are the same rows, not a second
    // opinion: the grader ruling a claim against either must get one answer.
    expect(sheet.stats.pullSideCount).toBe(1)
    expect(sheet.stats.oppoFieldCount).toBe(1)
  })
})
