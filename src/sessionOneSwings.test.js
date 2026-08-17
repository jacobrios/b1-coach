// Pins every one of session 1's fifteen hand-written distances to what the
// honest carry formula actually produces for that swing's own exit speed and
// angle. Added in Slice 7b, closing the "pin the fifteen hand-written
// session-1 distances" item on CLAUDE.md's What's Next list: before this,
// nothing checked those distances at all, and a reviewer changing one from
// 170 to a physically impossible 999 left every existing test green.

import { describe, it, expect } from 'vitest'
import { SESSION_ONE_SWINGS } from './sessionOneSwings.js'
import { carryDistance } from './ballFlight.js'

describe('session 1 has exactly fifteen swings', () => {
  it('is fifteen long', () => {
    expect(SESSION_ONE_SWINGS).toHaveLength(15)
  })
})

describe('every stored distance equals carryDistance of its own swing', () => {
  it.each(SESSION_ONE_SWINGS.map((swing, index) => [index, swing]))(
    'swing %i (exit speed and angle determine the stored distance)',
    (_index, swing) => {
      const { exitSpeed, angle } = swing.hit.launch
      expect(swing.hit.landing.distance).toBe(carryDistance({ exitSpeed, angle }))
    },
  )
})
