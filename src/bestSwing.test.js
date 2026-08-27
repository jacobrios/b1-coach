import { describe, it, expect } from 'vitest'
import { bestSwing, BEST_SWING_METRICS } from './bestSwing'

const swing = (ev, la, dist) => ({
  hit: { launch: { exitSpeed: ev, angle: la, direction: 0 }, landing: { distance: dist } },
  plateLocHeight: 2.5,
  plateLocSide: 0,
})

describe('bestSwing', () => {
  // The two goals rank on DIFFERENT things, and these two fixtures are built so
  // that a single shared rule would fail one of them. Swing 1 is the hardest
  // hit; swing 2 is the longest ball. Both meet both targets' bands where
  // relevant. If the metric table is ever collapsed into one rule, one of these
  // two tests goes red.
  const powerSwings = [
    swing(92, 26, 330),   // hardest hit, shorter
    swing(89, 31, 352),   // longest ball
    swing(95, 12, 260),   // hardest of all, but flat: misses the 25-35 band
  ]

  it('Power & Distance takes the longest ball, not the hardest hit', () => {
    expect(bestSwing('power', powerSwings)).toEqual({ number: 2, phrase: 'the longest ball' })
  })

  const contactSwings = [
    swing(88, 12, 240),   // hardest hit inside the band
    swing(86, 17, 268),   // longest ball inside the band
  ]

  it('Line Drives & Contact takes the hardest hit, not the longest ball', () => {
    expect(bestSwing('contact', contactSwings)).toEqual({ number: 1, phrase: 'the hardest hit' })
  })

  it('Reduce Pop-Ups takes the hardest hit among swings inside its window', () => {
    // No exit velocity requirement on this goal, so a 71 mph ball at 14 degrees
    // is on target; it is simply not the best one.
    const swings = [swing(71, 14, 150), swing(84, 22, 275), swing(90, 33, 320)]
    expect(bestSwing('popup', swings)).toEqual({ number: 2, phrase: 'the hardest hit' })
  })

  it('never nominates a swing that missed the target, however good its numbers', () => {
    // A 400-foot bomb at 40 degrees is outside Power's band, so it is not the
    // swing to copy for this goal. The app must never call a miss the example.
    const swings = [swing(99, 40, 400), swing(88, 27, 300)]
    expect(bestSwing('power', swings)).toEqual({ number: 2, phrase: 'the longest ball' })
  })

  it('returns null for a goal with no target at all', () => {
    for (const goalId of ['allfields', 'open', 'dashboard']) {
      expect(bestSwing(goalId, powerSwings)).toBeNull()
    }
  })

  it('returns null when no swing met the target, rather than naming a near miss', () => {
    expect(bestSwing('power', [swing(95, 12, 260), swing(70, 5, 90)])).toBeNull()
  })

  it('returns null for an unknown goal id', () => {
    expect(bestSwing('nonsense', powerSwings)).toBeNull()
  })

  it('returns null on an empty session', () => {
    expect(bestSwing('power', [])).toBeNull()
  })

  it('breaks a tie on the lower swing number, so the answer is stable', () => {
    const tied = [swing(90, 27, 320), swing(90, 28, 320)]
    expect(bestSwing('power', tied).number).toBe(1)
    expect(bestSwing('contact', [swing(90, 12, 250), swing(90, 14, 250)]).number).toBe(1)
  })

  it('numbers swings from 1, matching how the prompt lists them', () => {
    const swings = [swing(70, 5, 90), swing(70, 5, 90), swing(89, 27, 300)]
    expect(bestSwing('power', swings).number).toBe(3)
  })

  it('covers exactly the three goals that have a target, and no others', () => {
    expect(Object.keys(BEST_SWING_METRICS).sort()).toEqual(['contact', 'popup', 'power'])
  })
})
