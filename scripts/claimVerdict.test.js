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
