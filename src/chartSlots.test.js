// Tests for the chart the results screen actually renders.
//
// The model chooses these by name, so its answer is a claim to be checked rather
// than a fact. Before Slice 1 an invented key produced an empty box on screen,
// twice, silently. This is what stops that returning.

import { describe, it, expect } from 'vitest'
import { resolveChartSlots, validChartKey, CHART_KEYS, FALLBACK_CHART_KEYS } from './chartSlots.js'

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

describe('a key the model names twice', () => {
  // Fixed in Slice 4. Two valid but identical keys both used to survive, so a
  // visitor saw the same chart drawn side by side and lost one of the two charts
  // they were owed. A repeated key is as unusable as an invented one.

  it('does not render the same chart twice', () => {
    const [first, second] = resolveChartSlots(['trend_ev', 'trend_ev'])
    expect(first.type).toBe('trend_ev')
    expect(second.type).not.toBe('trend_ev')
    expect(CHART_KEYS).toContain(second.type)
  })

  it('keeps the first of the two and fills the second with a real chart', () => {
    expect(resolveChartSlots(['trend_ev', 'trend_ev']))
      .toEqual([{ type: 'trend_ev' }, { type: 'scatter_ev_la' }])
  })

  it('dedupes a repeat written as an object against one written as a string', () => {
    const [first, second] = resolveChartSlots(['pitch_location', { type: 'pitch_location' }])
    expect(first.type).toBe('pitch_location')
    expect(second.type).not.toBe('pitch_location')
  })

  it('still replaces the stand-in it would otherwise duplicate', () => {
    // The repeated key is itself the first fallback, so the filler has to skip it.
    const [first, second] = resolveChartSlots(['scatter_ev_la', 'scatter_ev_la'])
    expect(first.type).toBe('scatter_ev_la')
    expect(second.type).toBe('trend_ev')
  })
})

describe('a chart the coach names in a chat reply', () => {
  // A chat reply carries a single chart key, and it overwrites one of the two
  // charts already on the debrief. Nothing checked it first, so a key the model
  // invented destroyed a chart the visitor was already looking at, with no way
  // back. Only a key the screen can actually render is allowed through.

  // Written out rather than driven from CHART_KEYS. validChartKey is defined as
  // a lookup in CHART_KEYS, so iterating that same constant passes for any value
  // it could ever hold, including a corrupted one. Literals are the only version
  // of this test that can fail.
  it.each([
    'scatter_ev_la', 'trend_ev', 'bar_distance',
    'spray_direction', 'zone_breakdown', 'pitch_location',
  ])('lets %s through', (key) => {
    expect(validChartKey(key)).toBe(key)
  })

  it('rejects a key the model invented', () => {
    expect(validChartKey('launch_angle_heatmap')).toBeNull()
  })

  it.each([
    ['the string "null", which the prompt asks for and which passes a truthiness check', 'null'],
    ['the string "none"', 'none'],
    ['a real null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a number', 7],
    ['true', true],
    ['an array', ['trend_ev']],
    ['an object with a bad type', { type: 'nope' }],
    ['an empty object', {}],
  ])('rejects %s', (_label, bad) => {
    expect(validChartKey(bad)).toBeNull()
  })

  it('accepts a key wrapped in an object, the same as the debrief path does', () => {
    // resolveChartSlots accepts both shapes, so rejecting the object form here
    // would silently drop a chart the debrief path would have rendered.
    expect(validChartKey({ type: 'trend_ev' })).toBe('trend_ev')
  })
})
