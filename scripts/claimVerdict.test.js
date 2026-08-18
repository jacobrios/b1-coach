// Tests for the verdict half of the rebuilt coach-accuracy grader.
//
// Slice 8, Task 3. The point of this module is that no model issues a verdict
// any more: the grading model extracts a claim into a structured shape and
// this code rules on it against the deterministic fact sheet. So these tests
// are the instrument's real validation, and they cost nothing to run.
//
// Every case below is drawn from a failure the 17 August 2026 validation run
// actually produced (docs/eval-fixtures/slice8-grader-validation/), not
// invented. That run is what established the old grader could not be trusted.

import { describe, it, expect } from 'vitest'
import { verdictForClaim } from './claimVerdict.js'

// A small hand-built fact sheet in the exact shape buildFactSheet returns.
// Hand-built rather than generated so a reader can check the expectations by
// eye, and so a change to the generator cannot silently move these goalposts.
const FACT_SHEET = {
  viewingSessionNumber: 4,
  sessions: [
    {
      sessionNumber: 4,
      swings: [
        { n: 1, exitVelocity: 88, launchAngle: 18, direction: -20, distance: 300 },
        { n: 2, exitVelocity: 90, launchAngle: 30, direction: 5, distance: 324 },
        { n: 3, exitVelocity: 84, launchAngle: 22, direction: 20, distance: 280 },
        { n: 4, exitVelocity: 92, launchAngle: 24, direction: 0, distance: 325 },
        { n: 5, exitVelocity: 92, launchAngle: 31, direction: -18, distance: 331 },
        { n: 6, exitVelocity: 88, launchAngle: 28, direction: 16, distance: 323 },
      ],
      stats: {
        avgExitVelocity: 89,
        avgLaunchAngle: 25.5,
        inZoneCount: 4,
        totalSwings: 6,
        topExitVelocity: 92,
      },
      thresholds: {
        launchAngle: [
          { threshold: 20, above: { count: 4, swings: [2, 3, 4, 5] }, below: { count: 1, swings: [1] }, equal: { count: 0, swings: [] }, atLeast: { count: 5 }, atMost: { count: 2 } },
        ],
        exitVelocity: [
          { threshold: 88, above: { count: 3, swings: [2, 4, 5] }, below: { count: 1, swings: [3] }, equal: { count: 2, swings: [1, 6] }, atLeast: { count: 5 }, atMost: { count: 3 } },
        ],
        direction: [
          { threshold: 15, above: { count: 2, swings: [3, 6] }, below: { count: 3, swings: [1, 2, 5] }, equal: { count: 0, swings: [] }, atLeast: { count: 2 }, atMost: { count: 4 } },
        ],
        distance: [
          { threshold: 305, above: { count: 4, swings: [2, 4, 5, 6] }, below: { count: 2, swings: [1, 3] }, equal: { count: 0, swings: [] }, atLeast: { count: 4 }, atMost: { count: 2 } },
        ],
      },
    },
  ],
}

describe('threshold count claims', () => {
  it('is TRUE when the stated count matches the row', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // The exact error class the fixture pinned: "above 20 degrees" was wrong in
  // every debrief that attempted it. Six claimed against a real four.
  it('is FALSE when the stated count does not match the row', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 6 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.actual).toContain('4')
  })

  // The old grader read the same 305-foot row as above=4, above=3 and above=0
  // across different records. A table lookup cannot do that.
  it('reads the same row the same way every time', () => {
    const claim = { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 305, comparison: 'above', statedCount: 4 }
    const a = verdictForClaim(claim, FACT_SHEET)
    const b = verdictForClaim(claim, FACT_SHEET)
    expect(a.verdict).toBe('TRUE')
    expect(b.verdict).toBe(a.verdict)
    expect(b.actual).toBe(a.actual)
  })

  it('distinguishes strict "above" from inclusive "at least"', () => {
    const above = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 88, comparison: 'above', statedCount: 5 },
      FACT_SHEET,
    )
    const atLeast = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 88, comparison: 'atLeast', statedCount: 5 },
      FACT_SHEET,
    )
    expect(above.verdict).toBe('FALSE')
    expect(atLeast.verdict).toBe('TRUE')
  })

  it('checks the named swing list as well as the count', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 4, statedSwings: [2, 3, 4, 6] },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  it('is UNVERIFIABLE when the threshold is not a precomputed row', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 19, comparison: 'below', statedCount: 6 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })
})

describe('per-swing value claims', () => {
  it('is TRUE when the swing carries the stated value', () => {
    const result = verdictForClaim(
      { kind: 'swingValue', sessionNumber: 4, swingNumber: 5, metric: 'launchAngle', statedValue: 31 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is FALSE when the swing carries a different value', () => {
    const result = verdictForClaim(
      { kind: 'swingValue', sessionNumber: 4, swingNumber: 5, metric: 'launchAngle', statedValue: 28 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  // An impossible reference is a wrong claim, not an unanswerable one.
  it('is FALSE for a swing number the session does not have', () => {
    const result = verdictForClaim(
      { kind: 'swingValue', sessionNumber: 4, swingNumber: 15, metric: 'launchAngle', statedValue: 31 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })
})

describe('subset claims', () => {
  // Fixture error #4: of swings 3, 8 and 12, "two of those came in under 84
  // mph" when only one was. The subset was derived mid-sentence by the coach.
  it('intersects the named swings with the threshold row', () => {
    const result = verdictForClaim(
      { kind: 'subset', sessionNumber: 4, metric: 'exitVelocity', threshold: 88, comparison: 'below', ofSwings: [1, 3, 5], statedCount: 2 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.actual).toContain('1')
  })

  it('is TRUE when the intersection size matches', () => {
    const result = verdictForClaim(
      { kind: 'subset', sessionNumber: 4, metric: 'exitVelocity', threshold: 88, comparison: 'above', ofSwings: [2, 4, 6], statedCount: 2 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })
})

describe('session stat claims', () => {
  it('is TRUE when the stat matches', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'inZoneCount', statedValue: 4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is FALSE when the stat does not match', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'inZoneCount', statedValue: 6 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  it('is UNVERIFIABLE for a stat the fact sheet does not carry', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'outOfZoneCount', statedValue: 2 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })
})

describe('claims the verdict code cannot rule on', () => {
  // This is the honest half of the design. Anything the code does not
  // understand becomes UNVERIFIABLE by construction, never FALSE by default,
  // which is the exact confusion that produced Fault 2 in the failed run.
  it('is UNVERIFIABLE for an unknown claim kind', () => {
    const result = verdictForClaim(
      { kind: 'vibes', sessionNumber: 4, quote: 'you looked confident up there' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  it('is UNVERIFIABLE for a session the coach was never shown', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 9, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  it('is UNVERIFIABLE when a required field is missing rather than guessing', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', comparison: 'above', statedCount: 4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })
})
