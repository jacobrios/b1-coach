// Tests for app-level content that has no other file of its own.
//
// GOALS lives inside App.jsx, a 1000-line screen file the suite otherwise
// never reaches. It is exported (Task 11, Slice 6) solely so this one label
// can be checked; nothing else about App.jsx is under test here.

import { describe, it, expect, vi } from 'vitest'
import { GOALS } from './App.jsx'
import { launchAngleRangeLabel } from './goalTargets'

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

// The Reduce Pop-Ups card read 'LA < 0° ↓ · Drive more' until 24 August 2026.
// A pop-up is a HIGH launch angle, so that tag pointed the opposite way from
// the goal it labelled, on the goal-picker screen, which is the second thing
// any visitor sees. Slice 4 changed the Power and Contact tags to read their
// ranges from goalTargets.js and left this one behind, because it was not a
// numeric range at the time. It is one now, so it gets the same treatment and
// the same guard.
describe('the Reduce Pop-Ups goal tag', () => {
  it('names the goal\'s own launch angle range', () => {
    const popup = GOALS.find((g) => g.id === 'popup')
    expect(popup.tag).toContain(launchAngleRangeLabel('popup'))
  })

  it('does not point downward, which is the wrong way for a pop-up', () => {
    const popup = GOALS.find((g) => g.id === 'popup')
    expect(popup.tag).not.toMatch(/<\s*0|↓/)
  })

  // The two tests above would both pass on a hand-typed '10–25°' that merely
  // agrees with goalTargets.js rather than being computed from it, which is
  // exactly the drift Slice 4 found in five other places. This one hands the
  // card a different range and checks the tag follows, so a literal typed back
  // in turns the suite red. Same question src/pitchChartWindow.test.js asks of
  // the strike zone: is a number that agrees with its source actually derived
  // from it?
  it('reads that range from goalTargets.js rather than repeating it', async () => {
    vi.resetModules()
    vi.doMock('./goalTargets', async () => {
      const actual = await vi.importActual('./goalTargets')
      return {
        ...actual,
        launchAngleRangeLabel: (goalId) =>
          goalId === 'popup' ? '99–100°' : actual.launchAngleRangeLabel(goalId),
      }
    })

    try {
      const { GOALS: rebuilt } = await import('./App.jsx')
      const popup = rebuilt.find((g) => g.id === 'popup')
      expect(popup.tag).toContain('99–100°')
    } finally {
      vi.doUnmock('./goalTargets')
      vi.resetModules()
    }
  })
})
