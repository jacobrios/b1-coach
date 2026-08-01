// Tests for the chart the results screen actually renders.
//
// The model chooses these by name, so its answer is a claim to be checked rather
// than a fact. Before Slice 1 an invented key produced an empty box on screen,
// twice, silently. This is what stops that returning.

import { describe, it, expect } from 'vitest'
import { resolveChartSlots, CHART_KEYS, FALLBACK_CHART_KEYS } from './chartSlots.js'

describe('keys the model gets right', () => {
  it('keeps two valid keys in the order given', () => {
    expect(resolveChartSlots(['bar_distance', 'spray_direction']))
      .toEqual([{ type: 'bar_distance' }, { type: 'spray_direction' }])
  })

  it('accepts a key wrapped in an object as well as a bare string', () => {
    expect(resolveChartSlots([{ type: 'zone_breakdown' }, 'pitch_location']))
      .toEqual([{ type: 'zone_breakdown' }, { type: 'pitch_location' }])
  })

  // Written out rather than driven from CHART_KEYS. Iterating the module's own
  // constant means deleting a key shrinks the test set instead of failing it.
  it.each([
    'scatter_ev_la', 'trend_ev', 'bar_distance',
    'spray_direction', 'zone_breakdown', 'pitch_location',
  ])('accepts %s', (key) => {
    expect(resolveChartSlots([key])[0]).toEqual({ type: key })
  })

  it('accepts exactly six keys and no more, so a key added here is a deliberate act', () => {
    // Nothing checks that the screen can actually render each of these, or that
    // this list still matches the one the coach prompt offers the model in
    // coachApi.js. They agree today. Keeping them in step is still a human job.
    expect(CHART_KEYS).toHaveLength(6)
  })
})

describe('keys the model gets wrong', () => {
  it('replaces an invented key with a real chart rather than an empty box', () => {
    const [first] = resolveChartSlots(['launch_angle_heatmap', 'trend_ev'])
    expect(CHART_KEYS).toContain(first.type)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
    ['an empty object', {}],
    ['an object with a bad type', { type: 'nope' }],
    ['an empty string', ''],
  ])('replaces %s with a real chart', (_label, bad) => {
    const [first] = resolveChartSlots([bad, 'trend_ev'])
    expect(CHART_KEYS).toContain(first.type)
  })

  it('always returns exactly two slots, both renderable', () => {
    for (const input of [[], ['bar_distance'], ['x', 'y'], undefined]) {
      const slots = resolveChartSlots(input)
      expect(slots).toHaveLength(2)
      slots.forEach((slot) => expect(CHART_KEYS).toContain(slot.type))
    }
  })

  it('prefers the two stand-ins when it has to choose', () => {
    // Written out rather than derived from FALLBACK_CHART_KEYS. Comparing the
    // module's output against the module's own constant would pass whatever those
    // two charts were changed to, which is exactly the change worth catching:
    // both of these work for every goal, and a swap could quietly put a
    // goal-inappropriate chart in front of every visitor.
    expect(resolveChartSlots([])).toEqual([{ type: 'scatter_ev_la' }, { type: 'trend_ev' }])
    expect(FALLBACK_CHART_KEYS).toEqual(['scatter_ev_la', 'trend_ev'])
  })

  it('does not repeat a chart the model already chose when filling the other slot', () => {
    const [first, second] = resolveChartSlots(['scatter_ev_la', 'not_a_chart'])
    expect(first.type).toBe('scatter_ev_la')
    expect(second.type).not.toBe('scatter_ev_la')
  })
})

// ── Pinned, not endorsed ────────────────────────────────────────────────────
// This records a real bug rather than approving of it. It was found while
// scoping the test suite and deliberately left for a follow-up slice, so that
// this change adds a safety net without also changing behavior.

it('currently renders the same chart twice if the model names it twice (recorded, not endorsed)', () => {
  // Both keys are valid, so neither is replaced and nothing dedupes them. The
  // comment in chartSlots.js claiming the two slots never collide holds only for
  // the fallback path. A visitor sees the same chart side by side.
  expect(resolveChartSlots(['trend_ev', 'trend_ev']))
    .toEqual([{ type: 'trend_ev' }, { type: 'trend_ev' }])
})
