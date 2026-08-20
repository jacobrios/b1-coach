import { describe, it, expect } from 'vitest'
import { handedClaimSpecs } from './handedCounts.js'

describe('handedClaimSpecs', () => {
  it('describes what the current prompt hands a contact debrief', () => {
    const handed = handedClaimSpecs('contact', 'current')
    expect(handed.thresholds).toContainEqual({ metric: 'exitVelocity', threshold: 85, comparison: 'atLeast' })
    expect(handed.thresholds).toContainEqual({ metric: 'launchAngle', threshold: 18, comparison: 'above' })
    expect(handed.ranges).toContainEqual({ metric: 'launchAngle', min: 8, max: 18 })
    expect(handed.statNames).toContain('contactTargetBandCount')
    expect(handed.statNames).toContain('outsideZoneCount')
    expect(handed.zoneLines).toBe(true)
  })

  it('describes the slice8b prompt: fly-ball 20 and no zone lines', () => {
    const handed = handedClaimSpecs('contact', 'slice8b')
    expect(handed.thresholds).toContainEqual({ metric: 'launchAngle', threshold: 20, comparison: 'above' })
    expect(handed.thresholds).not.toContainEqual({ metric: 'launchAngle', threshold: 18, comparison: 'above' })
    expect(handed.statNames).not.toContain('outsideZoneCount')
    expect(handed.zoneLines).toBe(false)
  })

  it('hands open goals only the base stats, plus the zone lines in the current era', () => {
    const current = handedClaimSpecs('open', 'current')
    // Widened in Slice 10: the current era also hands every goal the two
    // direction cutoffs, from the universal spray count lines. Open Session
    // still names no thresholds of its OWN, which is what this pins.
    expect(current.thresholds.filter((t) => t.metric !== 'pitchHeight' && t.metric !== 'direction')).toEqual([])
    expect(current.statNames).toContain('avgExitVelocity')
    const old = handedClaimSpecs('open', 'slice8b')
    expect(old.thresholds).toEqual([])
  })
})

// Slice 10 fix round 1, review Important 1. The three spray count lines go to
// EVERY goal, like the zone lines, so this module has to say so on every goal
// too. Two things go wrong when it does not, and the second is not
// bookkeeping: every direction claim on the other five goals is filed as
// self-derived, hiding the very split that would show whether the fix worked;
// and claimVerdict's sibling-bucket rescue reads the handed thresholds to
// decide whether an above/atLeast phrasing is ambiguous rather than wrong, so
// with no handed direction entry a swing sitting exactly on -15 or +15 can
// only turn a rescuable TRUE into a FALSE.
describe('the spray counts every goal is handed (Slice 10)', () => {
  const PULL = { metric: 'direction', threshold: -15, comparison: 'below' }
  const OPPO = { metric: 'direction', threshold: 15, comparison: 'above' }

  it.each(['power', 'contact', 'popup', 'open', 'allfields'])(
    'the current era hands %s both direction cutoffs and all three spray stats',
    (goalId) => {
      const handed = handedClaimSpecs(goalId, 'current')
      expect(handed.thresholds).toContainEqual(PULL)
      expect(handed.thresholds).toContainEqual(OPPO)
      expect(handed.statNames).toContain('pullSideCount')
      expect(handed.statNames).toContain('upTheMiddleCount')
      expect(handed.statNames).toContain('oppoFieldCount')
    },
  )

  // The slice8b prompt had no spray lines at all. Only Hit to All Fields
  // stated the two cutoffs, in its own goal count lines, so only it may carry
  // them in that era or the tool starts calling an old derived claim handed.
  it.each(['power', 'contact', 'popup', 'open'])(
    'the slice8b era still hands %s no direction counts at all',
    (goalId) => {
      const handed = handedClaimSpecs(goalId, 'slice8b')
      expect(handed.thresholds).not.toContainEqual(PULL)
      expect(handed.thresholds).not.toContainEqual(OPPO)
      expect(handed.statNames).not.toContain('pullSideCount')
      expect(handed.statNames).not.toContain('upTheMiddleCount')
      expect(handed.statNames).not.toContain('oppoFieldCount')
    },
  )

  it('keeps allfields\' own two cutoffs in the slice8b era, where its goal lines really did state them', () => {
    const handed = handedClaimSpecs('allfields', 'slice8b')
    expect(handed.thresholds).toContainEqual(PULL)
    expect(handed.thresholds).toContainEqual(OPPO)
    // But not the universal spray stats, which did not exist then. Its own
    // goal-line stats are a different question and stay.
    expect(handed.statNames).not.toContain('upTheMiddleCount')
  })

  // allfields is the one goal that states these cutoffs twice, once in its own
  // count lines and once in the universal ones. The description of what was
  // handed should say it once.
  it('does not list the same handed threshold twice on allfields', () => {
    const handed = handedClaimSpecs('allfields', 'current')
    const seen = handed.thresholds.map((t) => `${t.metric}:${t.threshold}:${t.comparison}`)
    expect(new Set(seen).size).toBe(seen.length)
    expect(new Set(handed.statNames).size).toBe(handed.statNames.length)
  })
})
