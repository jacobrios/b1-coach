// Whether the bottom-edge scroll fade should show on a scrollable box.
//
// Extracted from DebriefScreen.jsx so the decision can be tested without a
// DOM. It reads the three numbers a scroll container already reports
// (scrollHeight, clientHeight, scrollTop) and answers one question: is there
// more content below what is currently visible? The fade is not a permanent
// affordance; a box whose content fits, or one scrolled all the way down, has
// nothing to hint at.
//
// A small tolerance absorbs the fractional pixels real browsers report for
// scrollHeight/clientHeight, and clamps out elastic overscroll past the max
// scrollTop, so neither reads as "still more below."
const BOTTOM_TOLERANCE_PX = 1

export function shouldShowScrollFade({ scrollHeight, clientHeight, scrollTop }) {
  const remaining = scrollHeight - clientHeight - scrollTop
  return remaining > BOTTOM_TOLERANCE_PX
}
