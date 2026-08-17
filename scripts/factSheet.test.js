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
    const sheet = buildSessionFactSheet(session)
    // Angles 10, 20, 5, 30, 15 -> strictly under 15 is swings 1 (10) and 3 (5).
    // Swing 5 sits at exactly 15 and must NOT count, matching the prompt's
    // own "not including 15" wording in coachApi.js.
    expect(sheet.stats.underFifteenCount).toBe(2)
    expect(sheet.stats.underFifteenSwings).toEqual([1, 3])
  })

  it('computes powerZoneCount using the real goal target (LA 25-35, EV >= 88)', () => {
    const sheet = buildSessionFactSheet(session)
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
    for (const metric of ['exitVelocity', 'launchAngle', 'direction', 'distance']) {
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
