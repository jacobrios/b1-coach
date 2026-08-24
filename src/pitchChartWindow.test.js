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
  pitchChartRows,
  chevronPoints,
  chevronIsOnTarget,
  CHEVRON_RISE_PX,
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

// ── The rules, not just the arithmetic ────────────────────────────────────
//
// Added 24 August 2026, in the fix round on this change. The first version of
// this file tested the window and the clamp and stopped there, which left six
// one-line edits to src/DebriefScreen.jsx that each broke the fix with all 671
// tests still passing. The blocks below close what can be closed in code; the
// text-scoped block at the end is a tripwire for the rest.

describe('pitchChartRows', () => {
  const swing = (side, height, launch = {}) => ({
    plateLocSide: side,
    plateLocHeight: height,
    hit: { launch: { exitSpeed: 90, angle: 30, direction: 5, ...launch } },
  })

  it('keeps the pitch\'s real position on x and the drawable one on plotX', () => {
    const [row] = pitchChartRows([swing(1.32, 2.79)], 'power')
    expect({ x: row.x, plotX: row.plotX, beyond: row.beyond })
      .toEqual({ x: 1.32, plotX: 1.2, beyond: 'right' })
  })

  // The one that matters most. A row whose `x` had been clamped would let the
  // tooltip report 1.20 feet for a pitch thrown at 1.32, which is precisely the
  // false statement the chevron exists to avoid making.
  it('never clamps x, however far outside the window the pitch was', () => {
    const rows = pitchChartRows([swing(1.5, 2), swing(-1.5, 2), swing(1.21, 2)], 'power')
    expect(rows.map((r) => r.x)).toEqual([1.5, -1.5, 1.21])
  })

  it('leaves a pitch inside the window with x and plotX identical', () => {
    const rows = pitchChartRows([swing(0.4, 2), swing(-1.2, 2), swing(1.2, 2)], 'power')
    expect(rows.map((r) => r.x)).toEqual(rows.map((r) => r.plotX))
    expect(rows.map((r) => r.beyond)).toEqual([null, null, null])
  })

  it('numbers swings from one, so the tooltip agrees with the Raw Data table', () => {
    const rows = pitchChartRows([swing(0, 2), swing(0, 2), swing(0, 2)], 'power')
    expect(rows.map((r) => r.swing)).toEqual([1, 2, 3])
  })

  it('judges each swing against the goal actually being shown', () => {
    const onTargetForPower = swing(0, 2, { exitSpeed: 90, angle: 30 })
    expect(pitchChartRows([onTargetForPower], 'power')[0].outcome).toBe(true)
    // Same swing, different goal: 30 degrees is above Line Drives & Contact's band.
    expect(pitchChartRows([onTargetForPower], 'contact')[0].outcome).toBe(false)
  })
})

describe('chevronPoints', () => {
  // The clip that pinning the axis brings with it cuts anything drawn past the
  // plot edge, so an outward chevron is not a style variant, it is an invisible
  // swing. Both directions are asserted because the sign is the easy thing to
  // get backwards.
  it('puts the tip exactly on the edge and both arms inside it, on the right', () => {
    const pts = chevronPoints({ cx: 313, cy: 100, beyond: 'right' })
      .split(' ').map((p) => p.split(',').map(Number))
    expect(pts.map(([x]) => x)).toEqual([306, 313, 306])
    expect(Math.max(...pts.map(([x]) => x))).toBe(313)
  })

  it('mirrors on the left, arms inside again', () => {
    const pts = chevronPoints({ cx: 70, cy: 100, beyond: 'left' })
      .split(' ').map((p) => p.split(',').map(Number))
    expect(pts.map(([x]) => x)).toEqual([77, 70, 77])
    expect(Math.min(...pts.map(([x]) => x))).toBe(70)
  })

  it('never reaches past the edge in either direction, at any height', () => {
    for (const cy of [0, 50, 250]) {
      const right = chevronPoints({ cx: 313, cy, beyond: 'right' })
        .split(' ').map((p) => Number(p.split(',')[0]))
      const left = chevronPoints({ cx: 70, cy, beyond: 'left' })
        .split(' ').map((p) => Number(p.split(',')[0]))
      expect(right.every((x) => x <= 313)).toBe(true)
      expect(left.every((x) => x >= 70)).toBe(true)
    }
  })

  it('is symmetrical about the swing\'s own height', () => {
    const ys = chevronPoints({ cx: 313, cy: 100, beyond: 'right' })
      .split(' ').map((p) => Number(p.split(',')[1]))
    expect(ys).toEqual([100 - CHEVRON_RISE_PX, 100, 100 + CHEVRON_RISE_PX])
  })
})

describe('chevronIsOnTarget', () => {
  // The defect this rule fixes: a swing that MET its goal was being drawn as a
  // plain neutral arrow on a chart headed "Pitch Location vs Outcome", because
  // the chevron overrode the on-target colouring. Measured over 54,000 sessions
  // on the three goals that have a target, 23.6% of chevrons were swings that
  // met the goal and 7.36% of sessions, about one in fourteen, hid a win.
  it('paints a successful swing in the on-target colour on a goal with a target', () => {
    for (const goalId of ['power', 'contact', 'popup']) {
      expect(chevronIsOnTarget({ goalId, outcome: true })).toBe(true)
    }
  })

  it('leaves a missed swing neutral', () => {
    expect(chevronIsOnTarget({ goalId: 'power', outcome: false })).toBe(false)
  })

  // Not an oversight. That goal has no target, so there is no success to
  // report, and a chevron painted in a spray colour would carry two directions
  // at once: the arrow says where the pitch went outside, the colour would say
  // where the ball was hit.
  it('leaves Hit to All Fields neutral even if something claims an outcome', () => {
    expect(chevronIsOnTarget({ goalId: 'allfields', outcome: true })).toBe(false)
  })

  it('leaves a goal with no target at all neutral', () => {
    expect(chevronIsOnTarget({ goalId: null, outcome: false })).toBe(false)
  })
})

// Three rules that can only live in the screen file, guarded the one way this
// project guards anything in there: by reading it as text. Same technique and
// the same limits as the spray-cutoff guard in sessionStats.test.js. Nothing is
// mounted and no DOM exists, so these are tripwires that catch an edit, not
// proof that the chart draws correctly. What proves that is a person looking at
// it, which is recorded in the decision log.
describe('the rules the pitch chart holds on its own', () => {
  const source = readFileSync(new URL('./DebriefScreen.jsx', import.meta.url), 'utf8')
  const pitchChart = source.slice(
    source.indexOf('function PitchLocation'),
    source.indexOf('function ZoneBreakdown'),
  )

  // The honesty guarantee in one line. Switching this to the clamped value
  // makes the tooltip report 1.20 feet for a pitch thrown at 1.32, which is the
  // false position the whole design exists to prevent, and it is a one-word
  // edit.
  it('shows the pitch\'s true side and height in the tooltip, never the drawn one', () => {
    const fields = [...pitchChart.matchAll(/Number\(d\.(\w+)\)\.toFixed\(2\)\}\s*ft\s*(Side|Height)/g)]
      .map(([, field, label]) => ({ label, field }))
    expect(fields).toEqual([{ label: 'Side', field: 'x' }, { label: 'Height', field: 'y' }])
  })

  // The other half of the same guarantee: the axis is the one thing that may
  // read the clamped value. Pointing it back at the true one un-pins the window
  // and, because the layer is clipped, silently deletes the wide pitch from a
  // fifteen-swing chart instead of merely misplacing it.
  it('plots the drawn side on the axis and nothing else', () => {
    const keys = [...pitchChart.matchAll(/<XAxis[^>]*dataKey="(\w+)"/g)].map(([, k]) => k)
    expect(keys).toEqual(['plotX'])
  })

  it('builds its rows from the shared module rather than shaping them inline', () => {
    expect({
      usesTheRowBuilder: pitchChart.includes('pitchChartRows('),
      // `plateLocSide` is the raw swing field, and a `plotX:` key would mean
      // an object literal is being built here again. `beyond:` is deliberately
      // NOT a smell: it is a named argument to chevronPoints below.
      shapesRowsInline: /plateLocSide|plotX:/.test(pitchChart),
    }).toEqual({ usesTheRowBuilder: true, shapesRowsInline: false })
  })

  // The colour rule was added to fix a defect and arrived with the same hole
  // the chevron branch above had: asserting that `chevronIsOnTarget(` appears
  // somewhere lets both arms of the ternary be swapped, which does not merely
  // switch the fix off, it makes the chart report the missed swings as the good
  // ones. Hardcoding the goal to 'allfields' turns every chevron neutral and
  // reinstates the original defect. Both are one token, both left the suite
  // green, so this asserts the whole expression rather than a fragment of it.
  it('paints the chevron on-target through the shared rule, and not the other way round', () => {
    const stroke = pitchChart.split('\n').map((l) => l.trim())
      .find((l) => l.startsWith('stroke={chevronIsOnTarget'))
    expect(stroke).toBe(
      'stroke={chevronIsOnTarget({ goalId, outcome: payload.outcome }) ? ACCENT : CHEVRON_STROKE}')
  })

  it('still draws an off-window pitch as a chevron, from the shared geometry', () => {
    expect({
      // Matched as the exact branch, not merely as text appearing somewhere.
      // `if (false && payload.beyond)` disables the chevron while leaving the
      // words in place, and a looser check passed straight over it.
      branchesOnBeyond: /if \(payload\.beyond\) \{/.test(pitchChart),
      usesSharedGeometry: pitchChart.includes('chevronPoints('),
      usesTheColourRule: pitchChart.includes('chevronIsOnTarget('),
    }).toEqual({ branchesOnBeyond: true, usesSharedGeometry: true, usesTheColourRule: true })
  })
})
