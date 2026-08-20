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
import { goalTarget } from '../src/goalTargets.js'
import { handedClaimSpecs } from './handedCounts.js'

// A small hand-built fact sheet in the exact shape buildFactSheet returns.
// Hand-built rather than generated so a reader can check the expectations by
// eye, and so a change to the generator cannot silently move these goalposts.
const FACT_SHEET = {
  viewingSessionNumber: 4,
  sessions: [
    {
      sessionNumber: 4,
      swings: [
        { n: 1, exitVelocity: 88, launchAngle: 18, direction: -20, distance: 300, pitchHeight: 2.4, pitchSide: -0.3 },
        { n: 2, exitVelocity: 90, launchAngle: 30, direction: 5, distance: 324 },
        { n: 3, exitVelocity: 84, launchAngle: 22, direction: 20, distance: 280, pitchHeight: 0.6, pitchSide: 0.2 },
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
          // A second row so a range claim can have BOTH edges precomputed.
          // Without it the inverted-range test passed for the wrong reason:
          // its far edge was simply missing, so the missing-row branch
          // answered first and the inverted-range guard was never exercised.
          // Proven by mutation on 18 August 2026.
          { threshold: 30, above: { count: 1, swings: [5] }, below: { count: 4, swings: [1, 3, 4, 6] }, equal: { count: 1, swings: [2] }, atLeast: { count: 2 }, atMost: { count: 5 } },
          // Slice 8c: rows at 8 and 18, contact's own band edges, derived
          // from the same six swings' launch angles (18, 30, 22, 24, 31, 28).
          // At 8, every swing is above it. At 18, swing 1 sits exactly on it
          // and the other five are above.
          { threshold: 8, above: { count: 6, swings: [1, 2, 3, 4, 5, 6] }, below: { count: 0, swings: [] }, equal: { count: 0, swings: [] }, atLeast: { count: 6 }, atMost: { count: 0 } },
          { threshold: 18, above: { count: 5, swings: [2, 3, 4, 5, 6] }, below: { count: 0, swings: [] }, equal: { count: 1, swings: [1] }, atLeast: { count: 6 }, atMost: { count: 1 } },
        ],
        exitVelocity: [
          { threshold: 88, above: { count: 3, swings: [2, 4, 5] }, below: { count: 1, swings: [3] }, equal: { count: 2, swings: [1, 6] }, atLeast: { count: 5 }, atMost: { count: 3 } },
          // Slice 8c: a hand-picked row for the sibling-bucket test. None of
          // the six swings above (88, 90, 84, 92, 92, 88) sits at exactly 82
          // mph, so this row is not derived from them; it stands in for a
          // session where one swing sits exactly at 82. above = 2, equal = 1,
          // below = 3 (2 + 1 + 3 = 6 swings). atLeast = above + equal = 3;
          // atMost = below + equal = 4.
          { threshold: 82, above: { count: 2, swings: [2, 4] }, below: { count: 3, swings: [1, 3, 6] }, equal: { count: 1, swings: [5] }, atLeast: { count: 3 }, atMost: { count: 4 } },
          // Slice 8d: copied verbatim from the real before-round
          // popup-s4/run3 committed instance ("none of them got above 75
          // mph" against named swings 1, 7, 13; actual "1 of swings 1, 7, 13
          // are above 75 exitVelocity (swings 13)"). Deliberately carries
          // only the "above" bucket, the one bucket either a plain "above"
          // comparison or the guard reads.
          { threshold: 75, above: { count: 1, swings: [13] } },
        ],
        direction: [
          { threshold: 15, above: { count: 2, swings: [3, 6] }, below: { count: 3, swings: [1, 2, 5] }, equal: { count: 0, swings: [] }, atLeast: { count: 2 }, atMost: { count: 4 } },
        ],
        distance: [
          { threshold: 305, above: { count: 4, swings: [2, 4, 5, 6] }, below: { count: 2, swings: [1, 3] }, equal: { count: 0, swings: [] }, atLeast: { count: 4 }, atMost: { count: 2 } },
          // Slice 8d: hand-picked to reproduce the real committed instance's
          // truth (open-s4, "nothing got out past 265 feet"): all 15 real
          // swings in that session landed at or under 265 feet, none above.
          // Not derived from this fixture's own 6 swings, same as the
          // hand-picked 82 mph row below.
          { threshold: 265, above: { count: 0, swings: [] }, below: { count: 15, swings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }, equal: { count: 0, swings: [] }, atLeast: { count: 15 }, atMost: { count: 15 } },
        ],
      },
    },
    // Slice 8d: a second session so the negated-exceedance guard's subset
    // tests can copy their sessionNumber (1) verbatim from the real
    // power-s1/run12 committed instances. Only the two threshold rows the
    // guard reads are precomputed; no per-swing table or stats, because
    // neither thresholdVerdict nor subsetVerdict reads them for these claims.
    {
      sessionNumber: 1,
      swings: [],
      stats: {},
      thresholds: {
        exitVelocity: [
          // Derived from the real fifteen session-1 swings in
          // src/sessionOneSwings.js (exit velocities 78, 72, 88, 75, 91, 82,
          // 76, 85, 79, 83, 87, 70, 86, 80, 92): swings strictly above 80 are
          // 3, 5, 6, 8, 10, 11, 13, 15 (8 of them); strictly below are 1, 2,
          // 4, 7, 9, 12 (6); swing 14 sits exactly at 80 (equal).
          { threshold: 80, above: { count: 8, swings: [3, 5, 6, 8, 10, 11, 13, 15] }, below: { count: 6, swings: [1, 2, 4, 7, 9, 12] }, equal: { count: 1, swings: [14] }, atLeast: { count: 9 }, atMost: { count: 7 } },
        ],
        launchAngle: [
          // Same fifteen swings' launch angles (12, 8, 26, 6, 28, 18, 10, 24,
          // 14, 20, 22, 4, 25, 16, 27): strictly above 14 are 3, 5, 6, 8, 10,
          // 11, 13, 14, 15 (9); strictly below are 1, 2, 4, 7, 12 (5); swing
          // 9 sits exactly at 14 (equal).
          { threshold: 14, above: { count: 9, swings: [3, 5, 6, 8, 10, 11, 13, 14, 15] }, below: { count: 5, swings: [1, 2, 4, 7, 12] }, equal: { count: 1, swings: [9] }, atLeast: { count: 10 }, atMost: { count: 6 } },
        ],
      },
    },
  ],
}

// Rows at the Power goal's own window edges (25 and 35), so a range claim on
// that window has both edges precomputed and the ambiguity check is the only
// thing that can produce UNVERIFIABLE.
const POWER_WINDOW_FACT_SHEET = {
  viewingSessionNumber: 4,
  sessions: [
    {
      sessionNumber: 4,
      swings: [
        { n: 1, exitVelocity: 92, launchAngle: 30 },
        { n: 2, exitVelocity: 80, launchAngle: 40 },
      ],
      stats: { totalSwings: 2 },
      thresholds: {
        launchAngle: [
          { threshold: 25, above: { count: 2, swings: [1, 2] }, below: { count: 0, swings: [] }, equal: { count: 0, swings: [] }, atLeast: { count: 2 }, atMost: { count: 0 } },
          { threshold: 35, above: { count: 1, swings: [2] }, below: { count: 1, swings: [1] }, equal: { count: 0, swings: [] }, atLeast: { count: 1 }, atMost: { count: 1 } },
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

  // Slice 9's hand-check, mechanism M4: a correct count that names no swings
  // at all was being ruled FALSE, because an empty array is still an array.
  // "Nine of your fifteen swings came out above 18 degrees" names nine as a
  // count and names no individual swing, so there is no swing list to
  // disagree with and the count is the whole claim.
  it('does not fire the named-swing check when no swings were named', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 305, comparison: 'above', statedCount: 4, statedSwings: [] },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
    expect(result.reasoning).not.toMatch(/named swings/)
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

describe('pitch location claims', () => {
  // Found by the smoke test, 17 August 2026. The coach wrote "swing 3 at a
  // pitch 0.6 feet off the ground". Pitch height was not in the metric list,
  // so the extractor was forced to label it as one of the four that were, and
  // graded 0.6 against the swing's DIRECTION of 7 degrees. A false FALSE
  // caused purely by the instrument not admitting the metric exists. The
  // per-swing table has carried these values all along.
  it('rules on a pitch height the coach cites', () => {
    const result = verdictForClaim(
      { kind: 'swingValue', sessionNumber: 4, swingNumber: 3, metric: 'pitchHeight', statedValue: 0.6 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is FALSE when the cited pitch height is wrong', () => {
    const result = verdictForClaim(
      { kind: 'swingValue', sessionNumber: 4, swingNumber: 3, metric: 'pitchHeight', statedValue: 2.4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  // No threshold rows are precomputed for pitch location, so a whole-session
  // count about it is honestly unanswerable rather than quietly wrong.
  it('is UNVERIFIABLE for a whole-session pitch-height count', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'pitchHeight', threshold: 2, comparison: 'below', statedCount: 3 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
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

describe('range claims', () => {
  // Found by the 3-record smoke test on 18 August 2026, not predicted. The
  // coach wrote "the 25-to-35-degree power window ... you only hit that window
  // twice", and the extractor flattened the range to "atLeast 25", which is a
  // different question and produced a false FALSE. Every goal in this app is
  // defined as a range, so this would have inflated the flag rate across the
  // whole run.
  it('counts swings inside an inclusive range', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 20, max: 20, statedCount: 0 },
      FACT_SHEET,
    )
    // above 20 = 4, atLeast 20 = 5, so exactly-20 membership is 5 - 4 = 1.
    expect(result.verdict).toBe('FALSE')
    expect(result.actual).toContain('1')
  })

  it('is TRUE when the stated count matches the range', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 20, max: 20, statedCount: 1 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is UNVERIFIABLE when either edge is not a precomputed row', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 20, max: 35, statedCount: 2 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  // Both edges exist as rows here on purpose, so the ONLY thing that can
  // produce UNVERIFIABLE is the inverted-range guard itself.
  it('is UNVERIFIABLE when the range is inverted rather than guessing intent', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 30, max: 20, statedCount: 1 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  // The real shape from the smoke test: a goal's own window, both edges
  // precomputed. Swings at 22, 24, 28 and 30 degrees are inside 20 to 30.
  it('counts a goal-window range across two precomputed rows', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 20, max: 30, statedCount: 4 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
    expect(result.actual).toContain('4')
  })
})

describe('subset-scoped range claims', () => {
  // The dominant false-positive class of the 18 August 2026 re-validation:
  // "Swings 4, 5, 6, and 7 ... all between 88 and 92 mph" is a claim about
  // four NAMED swings, and the grader counted the whole session (7) and
  // called a correct sentence false. Fifteen of the run's 21 range flags took
  // this shape. When a range claim carries ofSwings, the verdict comes from
  // the named swings' own values in the per-swing table, not from the
  // session-wide threshold rows.
  it('checks named swings against the range, not the whole session', () => {
    // Swings 2, 5, 6 have launch angles 30, 31, 28: all inside 28-31.
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 28, max: 31, ofSwings: [2, 5, 6], statedCount: 3 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is FALSE when a named swing falls outside the range', () => {
    // Swing 1 is 18 degrees, outside 28-31, so only 2 of the 3 qualify.
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 28, max: 31, ofSwings: [1, 2, 5], statedCount: 3 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.actual).toContain('2')
  })

  // A subset range needs no precomputed threshold rows at all: the values are
  // in the per-swing table. 88-92 mph has rows at neither edge in this
  // fixture, and must still be answerable for named swings.
  it('needs no threshold rows when the swings are named', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'exitVelocity', min: 88, max: 92, ofSwings: [2, 4, 5], statedCount: 3 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('is FALSE for a named swing the session does not have', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 28, max: 31, ofSwings: [2, 15], statedCount: 2 },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  // The goal-window ambiguity guard is about SESSION-WIDE counts, where the
  // launch-angle count and the two-metric count the coach was handed diverge.
  // Named swings make the claim concrete, so the guard must not fire.
  it('does not apply the goal-window ambiguity guard to named swings', () => {
    const power = goalTarget('power')
    const result = verdictForClaim(
      {
        kind: 'range', sessionNumber: 4, metric: 'launchAngle',
        min: power.launchAngle.min, max: power.launchAngle.max,
        ofSwings: [2, 5], statedCount: 2,
      },
      POWER_WINDOW_FACT_SHEET,
      { goalId: 'power' },
    )
    expect(result.verdict).not.toBe('UNVERIFIABLE')
  })
})

describe('two-metric goal windows are not launch-angle ranges', () => {
  // The smoke test's second false positive, 18 August 2026, and the more
  // interesting of the two. The coach wrote "the 25-to-35-degree power window
  // ... you only hit that window twice". Five swings are in 25-35 degrees, but
  // only two meet the FULL power zone (25-35 degrees AND 88+ mph), and two is
  // the number the app's own prompt hands the coach. The coach was right and
  // the grader called it false.
  //
  // A prompt instruction telling the extractor to notice this did not hold, so
  // the check lives here instead: the Power goal's window is 25-35 degrees AND
  // 88+ mph, so a bare launch-angle range on exactly those edges is ambiguous
  // by construction and cannot be ruled on.
  it('is UNVERIFIABLE when a range matches a goal window that also requires exit velocity', () => {
    const power = goalTarget('power')
    const result = verdictForClaim(
      {
        kind: 'range',
        sessionNumber: 4,
        metric: 'launchAngle',
        min: power.launchAngle.min,
        max: power.launchAngle.max,
        statedCount: 2,
      },
      POWER_WINDOW_FACT_SHEET,
      { goalId: 'power' },
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  // The same range, on a goal with no exit-velocity requirement, is a plain
  // launch-angle question and must still be answered.
  it('still rules on the same range when the goal has no exit velocity target', () => {
    const power = goalTarget('power')
    const result = verdictForClaim(
      {
        kind: 'range',
        sessionNumber: 4,
        metric: 'launchAngle',
        min: power.launchAngle.min,
        max: power.launchAngle.max,
        statedCount: 1,
      },
      POWER_WINDOW_FACT_SHEET,
      { goalId: 'popup' },
    )
    expect(result.verdict).not.toBe('UNVERIFIABLE')
  })

  // No goal given at all: the instrument cannot know, so it must not guess.
  it('rules normally when no goal is supplied', () => {
    const power = goalTarget('power')
    const result = verdictForClaim(
      {
        kind: 'range',
        sessionNumber: 4,
        metric: 'launchAngle',
        min: power.launchAngle.min,
        max: power.launchAngle.max,
        statedCount: 1,
      },
      POWER_WINDOW_FACT_SHEET,
    )
    expect(result.verdict).not.toBe('UNVERIFIABLE')
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

  // The 24-record smoke of 18 August 2026, after the extractor was blinded:
  // "4 balls hit 305 feet or more" came back as a sessionStat claim against
  // inZoneCount, and "zero balls under 175 feet" against underFifteenCount
  // (under fifteen DEGREES). No session stat measures feet, so a quote in
  // feet with a sessionStat label is a mislabeled extraction, and the honest
  // answer is that this claim was not understood, not that the coach is wrong
  // by the margin between two unrelated numbers.
  it('is UNVERIFIABLE when the quote is in feet, which no session stat measures', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'inZoneCount', statedValue: 4, quote: '4 balls hit 305 feet or more' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  it('is UNVERIFIABLE when the quote is in mph but the stat is a count of swings', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'inZoneCount', statedValue: 4, quote: 'four swings at 88 mph or better' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  it('still rules on a stat whose units match its quote', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'avgExitVelocity', statedValue: 89, quote: 'you averaged 89 mph' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // "Under fifteen degrees" is the one stat legitimately in degrees, so the
  // degree guard must not swallow it.
  it('lets a degrees quote through to the under-fifteen count', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'underFifteenCount', statedValue: 1, quote: 'one swing under 15 degrees', },
      { ...FACT_SHEET, sessions: [{ ...FACT_SHEET.sessions[0], stats: { ...FACT_SHEET.sessions[0].stats, underFifteenCount: 1 } }] },
    )
    expect(result.verdict).toBe('TRUE')
  })

  // Slice 10 fix round 1, review Important 2. The prompt now hands every goal
  // an "up the middle" count, a sentence shape the coach will write routinely
  // and that carries no unit word of its own. Without an entry here the guard
  // stays silent on it, so an extraction that lands the sentence on the
  // nearest listed name (pullSideCount) produces a confident wrong verdict.
  // That is mechanism M5 from Slice 9's hand-check, the largest single source
  // of false positives in that wave, and it would fire on the after side
  // only, because the sentence shape is new.
  it('is UNVERIFIABLE when an up-the-middle claim is quoted in mph', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'upTheMiddleCount', statedValue: 8, quote: 'eight up the middle at 88 mph' },
      { ...FACT_SHEET, sessions: [{ ...FACT_SHEET.sessions[0], stats: { ...FACT_SHEET.sessions[0].stats, upTheMiddleCount: 8 } }] },
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })

  it('still rules on an up-the-middle claim carrying no unit word at all', () => {
    const result = verdictForClaim(
      { kind: 'sessionStat', sessionNumber: 4, statName: 'upTheMiddleCount', statedValue: 8, quote: 'eight of your fifteen went up the middle' },
      { ...FACT_SHEET, sessions: [{ ...FACT_SHEET.sessions[0], stats: { ...FACT_SHEET.sessions[0].stats, upTheMiddleCount: 8 } }] },
    )
    expect(result.verdict).toBe('TRUE')
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

describe('handed versus derived (Slice 8c)', () => {
  it('marks a FALSE claim handed when the prompt handed that count', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 6 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.handed).toBe(true)
  })

  it('marks a claim at an unhanded threshold derived', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 305, comparison: 'atLeast', statedCount: 2 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.handed).toBe(false)
  })

  it('adds no handed key at all when the context carries no handed set', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 6 },
      FACT_SHEET,
    )
    expect('handed' in result).toBe(false)
  })
})

describe('the inclusive-phrasing fix (Slice 8b false positive, allfields-s4/run7)', () => {
  // "only 3 swings cleared 82 mph": the coach was handed "82 mph or higher"
  // (atLeast), extraction read "cleared" as strictly above, and the strict
  // bucket disagreed with the handed inclusive one. When the handed line
  // used the sibling comparison and the sibling bucket matches the stated
  // count, the claim is TRUE.
  it('accepts the sibling bucket when it is the count the coach was handed', () => {
    // Requires a FACT_SHEET row where above and atLeast differ; extend the
    // fixture with such a row if it lacks one, keeping it hand-checkable.
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 82, comparison: 'above', statedCount: 3 },
      FACT_SHEET,
      { goalId: 'allfields', handed: handedClaimSpecs('allfields', 'slice8b') },
    )
    expect(result.verdict).toBe('TRUE')
    expect(result.reasoning).toContain('handed')
  })

  it('still rules FALSE when neither the claimed bucket nor the handed sibling matches', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 82, comparison: 'above', statedCount: 9 },
      FACT_SHEET,
      { goalId: 'allfields', handed: handedClaimSpecs('allfields', 'slice8b') },
    )
    expect(result.verdict).toBe('FALSE')
  })
})

describe('range claims at a handed band (Slice 8b false positives, contact-s4)', () => {
  // "8 swings in the target window" on contact: the prompt hands contact an
  // launch-angle-only band count, so the old two-metric ambiguity guard does
  // not apply; the claim is concrete and rulable.
  it('rules on a goal-band range when the band count was handed', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 8, max: 18, statedCount: 2 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.verdict).not.toBe('UNVERIFIABLE')
  })

  it('keeps the two-metric guard for power, whose handed count is two-metric', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 25, max: 35, statedCount: 2 },
      FACT_SHEET,
      { goalId: 'power', handed: handedClaimSpecs('power', 'current') },
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })
})

describe('the negated-exceedance guard (Slice 8d)', () => {
  // The bug: the extractor turns "nothing got out past 265 feet" into
  // (below|atMost, 0), the complement of what the sentence means, so
  // comparing 0 against the below/atMost bucket (the whole session) fails a
  // true statement. Both instances are from the real open-s4 committed
  // records (docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.json,
  // elements [28] and [29]); the same quote was stored under both stored
  // comparisons across the round.
  it('rules TRUE on a negated-exceedance claim stored as atMost', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 265, comparison: 'atMost', statedCount: 0, quote: 'nothing got out past 265 feet' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  it('rules TRUE on the same negated-exceedance claim stored as below', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 265, comparison: 'below', statedCount: 0, quote: 'nothing got out past 265 feet' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // Pattern robustness: a differently worded quote naming the same fact,
  // from after-grading.json element [33].
  it('rules TRUE on a differently worded negated-exceedance quote', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 265, comparison: 'atMost', statedCount: 0, quote: 'nothing left the bat past 265 feet' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // The subset face, from the real power-s1/run12 committed instance
  // (after-grading.json element [11], claims[4]): "none of them broke 80
  // mph" of swings 2, 9, 12. All three are really below 80, so none is
  // above it, so the negated claim is true.
  it('rules TRUE on a negated-exceedance subset claim', () => {
    const result = verdictForClaim(
      { kind: 'subset', sessionNumber: 1, metric: 'exitVelocity', threshold: 80, comparison: 'below', statedCount: 0, ofSwings: [2, 9, 12], quote: 'none of them broke 80 mph' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // Its pair, from the same real record (claims[5]): "none of them got above
  // 14 degrees" of the same three swings. Swing 9 sits exactly at 14, which
  // the above-list excludes, so none of the three is above it either.
  it('rules TRUE on the paired negated-exceedance subset claim', () => {
    const result = verdictForClaim(
      { kind: 'subset', sessionNumber: 1, metric: 'launchAngle', threshold: 14, comparison: 'below', statedCount: 0, ofSwings: [2, 9, 12], quote: 'none of them got above 14 degrees' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('TRUE')
  })

  // Negative case 1, the genuinely false complement: from the real
  // before-round popup-s4/run3 instance, comparison is already "above" (not
  // below/atMost), so the guard must not reroute it. Swing 13 really is
  // above 75, so the claim of zero stays FALSE.
  it('does not reroute a claim already stored as above', () => {
    const result = verdictForClaim(
      { kind: 'subset', sessionNumber: 4, metric: 'exitVelocity', threshold: 75, comparison: 'above', statedCount: 0, ofSwings: [1, 7, 13], quote: 'none of them got above 75 mph' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
  })

  // Negative case 2, negation without an exceedance verb: "dipped under"
  // names no word the exceedance half of the pattern matches, so the guard
  // must not fire, and the claim is ruled on the below bucket itself, which
  // is genuinely nonzero (6).
  it('does not reroute a negation with no exceedance verb', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 1, metric: 'exitVelocity', threshold: 80, comparison: 'below', statedCount: 0, quote: 'none of them dipped under 80 mph' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.reasoning).not.toContain('negates exceedance')
    expect(result.reasoning).toBe('claimed 0, the row says 6')
  })

  // Negative case 3, nonzero stated count: from the real before-round
  // power-s1/run6 instance. The guard only ever applies to a literal zero,
  // so a claim of 4 is untouched by it and rules on the below bucket itself
  // (real count 6), exactly as it did before this guard existed.
  it('does not reroute a negated-exceedance quote with a nonzero stated count', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 1, metric: 'exitVelocity', threshold: 80, comparison: 'below', statedCount: 4, statedSwings: [2, 4, 9, 12], quote: 'none of them broke 80 mph or 15 degrees' },
      FACT_SHEET,
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.reasoning).not.toContain('negates exceedance')
    expect(result.reasoning).toBe('claimed 4, the row says 6')
  })
})
