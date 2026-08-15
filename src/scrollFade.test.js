// The scroll fade is a bottom-edge cue that should appear only when a box has
// more content below the fold, and disappear once everything fits or the
// visitor has scrolled to the bottom. The DOM measurements it depends on
// (scrollHeight, clientHeight, scrollTop) are plain numbers, so the decision
// itself does not need a browser to test.

import { describe, it, expect } from 'vitest'
import { shouldShowScrollFade } from './scrollFade'

describe('shouldShowScrollFade', () => {
  it('is false when content fits exactly, no scrollbar at all', () => {
    expect(shouldShowScrollFade({ scrollHeight: 400, clientHeight: 400, scrollTop: 0 })).toBe(false)
  })

  it('is false when content is shorter than the box', () => {
    expect(shouldShowScrollFade({ scrollHeight: 300, clientHeight: 400, scrollTop: 0 })).toBe(false)
  })

  it('is true when overflowing and scrolled to the top', () => {
    expect(shouldShowScrollFade({ scrollHeight: 800, clientHeight: 400, scrollTop: 0 })).toBe(true)
  })

  it('is true when overflowing and scrolled partway down', () => {
    expect(shouldShowScrollFade({ scrollHeight: 800, clientHeight: 400, scrollTop: 200 })).toBe(true)
  })

  it('is false once scrolled all the way to the bottom', () => {
    expect(shouldShowScrollFade({ scrollHeight: 800, clientHeight: 400, scrollTop: 400 })).toBe(false)
  })

  it('tolerates sub-pixel rounding at the bottom edge', () => {
    // Browsers report fractional scrollHeight/clientHeight; a visitor scrolled
    // to what they'd call "the bottom" can leave less than a pixel of
    // remaining distance rather than exactly zero.
    expect(shouldShowScrollFade({ scrollHeight: 800.4, clientHeight: 400, scrollTop: 400 })).toBe(false)
  })

  it('is false when scrollTop overshoots past the max (elastic scroll)', () => {
    expect(shouldShowScrollFade({ scrollHeight: 800, clientHeight: 400, scrollTop: 410 })).toBe(false)
  })
})
