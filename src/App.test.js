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
// curve the same swing carries roughly 310-323 feet, a warning-track flyball,
// so the goal's own name must not promise a home run next to a chart that
// shows one falling short. Task 6 already pinned this for the coach prompt;
// this pins it for the goal label the coach was regenerating the claim from.
describe('the Power goal label', () => {
  it('does not claim home runs', () => {
    const power = GOALS.find((g) => g.id === 'power')
    expect(power.label.toLowerCase()).not.toMatch(/home run/)
  })
})
