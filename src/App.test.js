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
//
// Three tests, each catching something the other two cannot. The first pins the
// approved sentence, the second guards the meaning across a future approved
// rewording, the third proves the number is computed rather than typed.
describe('the Reduce Pop-Ups goal tag', () => {
  // The wording was approved by the product manager on 3 August 2026 and is not
  // to be reworded, which makes it approved copy in the same sense as every
  // string in failureCopy.js. That file pins each of its messages with exact
  // equality, and this tag is held to the same standard rather than a looser
  // one.
  //
  // Exact equality, not a fragment. An earlier version of this test asserted
  // only that the range appeared somewhere in the tag, and review showed three
  // separate ways the original defect could come back with it still green:
  // reverting the copy half to '· Drive more', rewording it to '· Aim below
  // 0°, drive more', which is the same wrong-way advice carrying neither the
  // '< 0' nor the arrow the test below looks for, and stripping the tag to a
  // bare '10–25°'. All three now turn this red, seen failing on 24 August 2026.
  //
  // The range stays interpolated rather than written out, so that a deliberate
  // change to the goal's target in goalTargets.js moves both sides together and
  // this test keeps pinning the sentence instead of the number.
  it('is the approved wording, exactly', () => {
    const popup = GOALS.find((g) => g.id === 'popup')
    expect(popup.tag).toBe(`LA ${launchAngleRangeLabel('popup')} · Level it out`)
  })

  // Not redundant against the test above, and the difference is what it
  // survives. If the product manager approves different copy one day, that test
  // gets updated to whatever he approved, which is the correct thing for it to
  // do. This one keeps holding independently of the wording: whatever the card
  // ends up saying, it must not tell a hitter to swing under the ball.
  it('does not point downward, which is the wrong way for a pop-up', () => {
    const popup = GOALS.find((g) => g.id === 'popup')
    expect(popup.tag).not.toMatch(/<\s*0|↓/)
  })

  // Neither test above can see the difference between a computed range and a
  // hand-typed '10–25°' that happens to agree with goalTargets.js, because both
  // sides of an equality check move together when the same literal is typed
  // into each. That agreement-by-coincidence is exactly the drift Slice 4 found
  // in five other places. This one hands the card a different range and checks
  // the tag follows, so a literal typed back in turns the suite red. Same
  // question src/pitchChartWindow.test.js asks of the strike zone: is a number
  // that agrees with its source actually derived from it?
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
      // Exact here too, for the same reason as the first test: asserting only
      // that the substituted range appears would let the copy half drift while
      // this stayed green.
      expect(popup.tag).toBe('LA 99–100° · Level it out')
    } finally {
      vi.doUnmock('./goalTargets')
      vi.resetModules()
    }
  })
})
