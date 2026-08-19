import { describe, it, expect } from 'vitest'
import { swingCountPhrase } from './promptText.js'

describe('swingCountPhrase', () => {
  it('uses the singular for exactly one', () => {
    expect(swingCountPhrase(1)).toBe('1 swing')
  })
  it('uses the plural for zero and for many', () => {
    expect(swingCountPhrase(0)).toBe('0 swings')
    expect(swingCountPhrase(3)).toBe('3 swings')
  })
})
