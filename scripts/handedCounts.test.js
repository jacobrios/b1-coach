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
    expect(current.thresholds.filter((t) => t.metric !== 'pitchHeight')).toEqual([])
    expect(current.statNames).toContain('avgExitVelocity')
    const old = handedClaimSpecs('open', 'slice8b')
    expect(old.thresholds).toEqual([])
  })
})
