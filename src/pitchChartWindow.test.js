// The window the Pitch Location vs Outcome chart draws, and what happens to a
// pitch that lands outside it.
//
// This project has no rendering tests by design, so the geometry was pulled
// out of the chart component for the same reason scrollFade.js was pulled out
// of the summary box: a decision that lives inside JSX cannot be checked at
// all. What is tested here is the window and the outside-the-window rule. How
// the chevron is actually drawn is left to the eye, and was checked in a
// browser instead.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import {
  PITCH_CHART_WINDOW,
  PITCH_WINDOW_PAD_FEET,
  sideBeyondWindow,
  plottedSide,
} from './pitchChartWindow'
import { STRIKE_ZONE } from './sessionStats'
import { PITCH_MISS_MAX_FEET } from './swingGenerator'

describe('the horizontal window', () => {
  // Not derived from anything, and that is the decision. It was chosen on
  // rendered mockups because a real strike zone is taller than it is wide, and
  // the wider the window gets the flatter the drawn zone looks.
  it('is the pair that was chosen, exactly plus or minus 1.2 feet', () => {
    expect(PITCH_CHART_WINDOW.side).toEqual({ min: -1.2, max: 1.2 })
  })

  // The half of that decision worth pinning, because it is the half that
  // surprises a reader: the window is deliberately NARROWER than the widest
  // pitch the app can produce. That is what the chevron exists to cover, and
  // if the window ever grew past the generator's reach the chevron would
  // become dead code nobody had decided to delete.
  it('sits inside the widest pitch the generator can throw, so it can be exceeded', () => {
    const widestPitch = STRIKE_ZONE.sideMax + PITCH_MISS_MAX_FEET
    expect(PITCH_CHART_WINDOW.side.max).toBeLessThan(widestPitch)
    expect(PITCH_CHART_WINDOW.side.min).toBeGreaterThan(-widestPitch)
  })
})

describe('the vertical window', () => {
  it('is the pair the product manager saw, 0.6 to 4.4 feet', () => {
    expect(PITCH_CHART_WINDOW.height).toEqual({ min: 0.6, max: 4.4 })
  })

  // The opposite decision to the horizontal one: nothing may ever fall off the
  // top or the bottom, so this pair has to cover the whole range the generator
  // can reach with room to spare. A pitch clipped vertically would be a swing
  // the visitor simply cannot see.
  it('clears the highest and lowest pitch the generator can throw, by the pad', () => {
    const highest = STRIKE_ZONE.heightMax + PITCH_MISS_MAX_FEET
    const lowest = STRIKE_ZONE.heightMin - PITCH_MISS_MAX_FEET
    expect(PITCH_CHART_WINDOW.height.max).toBeCloseTo(highest + PITCH_WINDOW_PAD_FEET, 10)
    expect(PITCH_CHART_WINDOW.height.min).toBeCloseTo(lowest - PITCH_WINDOW_PAD_FEET, 10)
  })
})

// The two assertions above would both pass against a module that simply typed
// 0.6 and 4.4 out, because those are the right answers today. This is the one
// that would not: it hands the module different source constants and checks
// that the vertical window moves with them. It is the difference between a
// number that agrees with the strike zone and a number that is computed from
// it, which is the distinction this project draws everywhere else.
describe('the vertical window is computed from its sources, not copied from them', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('./sessionStats')
    vi.doUnmock('./swingGenerator')
  })

  it('follows a change to how far a pitch may miss the zone by', async () => {
    vi.doMock('./swingGenerator', () => ({ PITCH_MISS_MAX_FEET: 1.3 }))
    const { PITCH_CHART_WINDOW: moved } = await import('./pitchChartWindow')
    // 1.5 - 1.3 - 0.1 and 3.5 + 1.3 + 0.1, on the real strike zone.
    expect(moved.height).toEqual({ min: 0.1, max: 4.9 })
  })

  it('follows a change to the strike zone itself', async () => {
    vi.doMock('./sessionStats', () => ({
      STRIKE_ZONE: { heightMin: 2, heightMax: 3, sideMin: -0.7, sideMax: 0.7 },
    }))
    const { PITCH_CHART_WINDOW: moved } = await import('./pitchChartWindow')
    // 2 - 0.8 - 0.1 and 3 + 0.8 + 0.1, on the real miss distance.
    expect(moved.height).toEqual({ min: 1.1, max: 3.9 })
  })

  it('leaves the horizontal window alone when either source moves', async () => {
    vi.doMock('./swingGenerator', () => ({ PITCH_MISS_MAX_FEET: 1.3 }))
    const { PITCH_CHART_WINDOW: moved } = await import('./pitchChartWindow')
    expect(moved.side).toEqual({ min: -1.2, max: 1.2 })
  })
})

describe('sideBeyondWindow', () => {
  it('says nothing about a pitch comfortably inside the window', () => {
    expect(sideBeyondWindow(0)).toBe(null)
    expect(sideBeyondWindow(-0.7)).toBe(null)
    expect(sideBeyondWindow(0.9)).toBe(null)
  })

  // Exactly on the edge counts as inside, and drawing it as an ordinary mark
  // is the honest answer: the chart really can show a pitch at 1.20 feet, at
  // its own edge. The generator rounds every pitch to the hundredth of a foot,
  // so this is a case that genuinely occurs rather than a floating-point
  // curiosity: measured across 900,000 generated pitches on 24 August 2026, a
  // pitch lands on exactly 1.20 feet about once in a thousand.
  it('treats a pitch exactly on the edge as inside, on both sides', () => {
    expect(sideBeyondWindow(1.2)).toBe(null)
    expect(sideBeyondWindow(-1.2)).toBe(null)
  })

  it('names the side a pitch got away on, from the first hundredth past the edge', () => {
    expect(sideBeyondWindow(1.21)).toBe('right')
    expect(sideBeyondWindow(-1.21)).toBe('left')
  })

  it('names the side at the furthest a pitch can get', () => {
    const widest = STRIKE_ZONE.sideMax + PITCH_MISS_MAX_FEET
    expect(sideBeyondWindow(widest)).toBe('right')
    expect(sideBeyondWindow(-widest)).toBe('left')
  })
})

describe('plottedSide', () => {
  // The chart plots this number and the tooltip keeps reading the real one.
  // That split is what makes the chevron honest: the mark sits at the edge
  // because it has to sit somewhere, and the true coordinate is one hover
  // away.
  it('leaves a pitch inside the window exactly where it is', () => {
    expect(plottedSide(0)).toBe(0)
    expect(plottedSide(-0.42)).toBe(-0.42)
    expect(plottedSide(1.2)).toBe(1.2)
    expect(plottedSide(-1.2)).toBe(-1.2)
  })

  it('pulls a pitch outside the window back to the edge it left by', () => {
    expect(plottedSide(1.5)).toBe(PITCH_CHART_WINDOW.side.max)
    expect(plottedSide(-1.5)).toBe(PITCH_CHART_WINDOW.side.min)
    expect(plottedSide(1.21)).toBe(1.2)
  })

  it('never returns anything the axis cannot draw', () => {
    for (let side = -1.5; side <= 1.5001; side += 0.01) {
      const drawn = plottedSide(side)
      expect(drawn).toBeGreaterThanOrEqual(PITCH_CHART_WINDOW.side.min)
      expect(drawn).toBeLessThanOrEqual(PITCH_CHART_WINDOW.side.max)
    }
  })
})

// Same technique, and the same limits, as the spray-cutoff guard in
// sessionStats.test.js: the screen file is read as plain text, nothing is
// mounted, and this project gains no rendering test here. What it stops is the
// pitch chart quietly going back to axes that grow to fit the session, which is
// the state this change found it in and the whole defect being fixed.
//
// Scoped to the PitchLocation component rather than to the whole file, because
// four other charts in that file legitimately do size their axes to their data
// and must keep doing so. An exit velocity axis has no natural fixed window;
// a strike zone does.
describe('the pitch chart holds no window of its own', () => {
  const source = readFileSync(new URL('./DebriefScreen.jsx', import.meta.url), 'utf8')
  const start = source.indexOf('function PitchLocation')
  const end = source.indexOf('function ZoneBreakdown')

  it('finds the component it means to be checking', () => {
    expect({ foundPitchChart: start !== -1, foundTheChartAfterIt: end > start })
      .toEqual({ foundPitchChart: true, foundTheChartAfterIt: true })
  })

  // Asserted on small derived values rather than on the source string itself.
  // A toContain against a 1,500-line file prints the whole file when it fails,
  // which buries the one line a reader needs.
  it('reads the shared window rather than defining a second one', () => {
    const pitchChart = source.slice(start, end)
    expect({
      namesTheWindow: pitchChart.includes('PITCH_CHART_WINDOW'),
      importsTheModule: source.includes("from './pitchChartWindow'"),
    }).toEqual({ namesTheWindow: true, importsTheModule: true })
  })

  it('lets neither axis grow to fit the session', () => {
    const pitchChart = source.slice(start, end)
    const growsToFit = ['dataMin', 'dataMax'].filter((n) => pitchChart.includes(n))
    expect(growsToFit).toEqual([])
  })
})
