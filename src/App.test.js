// Tests for app-level content that has no other file of its own.
//
// GOALS lives inside App.jsx, a 1000-line screen file the suite otherwise
// never reaches. It is exported (Task 11, Slice 6) solely so this one label
// can be checked; nothing else about App.jsx is under test here.

import { describe, it, expect } from 'vitest'
import { GOALS } from './App.jsx'

// Slice 6 replaced the fake distance formula with an honest carry curve. Under
// the old formula the Power goal's target carried close to home run distance,
// so calling the goal 'Power & Home Runs' was defensible. Under the honest
// curve a swing that actually meets the target (25-35 degrees, 88 mph or
// better) carries 277 to 368 feet, and a swing at the bottom of that band,
// 88 mph, never clears 323, warning-track territory, not out of the park.
// Only the hardest contact the generator can produce, 94 mph at 28 degrees,
// reaches 368. So the goal's own name must not promise a home run next to a
// chart that shows one falling short.
//
// The two figures above were 390 feet and 97 mph until 21 August 2026;
// Slice 11 moved the exit velocity ceiling to 94, so the hardest ball this
// hitter can produce carries a good deal less than the sentence claimed.
// Re-measured against the current ceiling rather than adjusted by eye, and
// note that "ceiling" now means a soft limit nothing exceeds rather than a
// wall swings pile up on. The 277 and the 323 did not move.
// Task 6 already pinned this for the coach prompt;
// this pins it for the goal label the coach was regenerating the claim from.
describe('the Power goal label', () => {
  it('does not claim home runs', () => {
    const power = GOALS.find((g) => g.id === 'power')
    expect(power.label.toLowerCase()).not.toMatch(/home run/)
  })
})
