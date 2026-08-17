// The overlap measure exists to catch a specific failure mode: a word-count
// floor on whatThisMeans can be satisfied by restating coachingSummary in
// different words, which reads as padding rather than as new information. A
// human reviewer eyeballing one debrief would catch that; the bench needs a
// deterministic stand-in that can run across dozens of debriefs without a
// person reading each one.

import { describe, it, expect } from 'vitest'
import { contentWords, contentWordOverlap } from './contentWordOverlap'

describe('contentWords', () => {
  it('lowercases and splits on non-word characters', () => {
    expect(contentWords('Hard contact, real bat speed.')).toEqual(
      new Set(['hard', 'contact', 'real', 'bat', 'speed']),
    )
  })

  it('strips markdown emphasis characters rather than treating them as word breaks that survive', () => {
    // `**hard**` should read as the same content word as `hard`, not vanish
    // and not turn into two fragments either.
    expect(contentWords('**hard** contact')).toEqual(new Set(['hard', 'contact']))
  })

  it('drops stopwords', () => {
    expect(contentWords('that is the swing you want')).toEqual(new Set(['swing', 'want']))
  })

  it('drops words under three letters, stopword or not', () => {
    // "mph" and "hit" are real content; "at", "in", "on" are connective
    // tissue that two sentences about the same swing will always share.
    expect(contentWords('it hit at 92 mph on that pitch')).toEqual(new Set(['hit', 'mph', 'pitch']))
  })

  it('returns an empty set for a non-string', () => {
    expect(contentWords(undefined)).toEqual(new Set())
    expect(contentWords(null)).toEqual(new Set())
  })

  it('returns an empty set for an all-stopword sentence', () => {
    expect(contentWords('it was the one that you had')).toEqual(new Set())
  })
})

describe('contentWordOverlap', () => {
  it('is 1 for identical text', () => {
    const text = 'Hard contact at 92 mph, right where you want it.'
    expect(contentWordOverlap(text, text)).toBe(1)
  })

  it('is 0 when no content words are shared', () => {
    expect(
      contentWordOverlap('Hard contact at ninety two miles per hour.', 'Stay tall through the zone next round.'),
    ).toBe(0)
  })

  it('is 0 when both sides reduce to no content words', () => {
    expect(contentWordOverlap('it was the one', 'that you had it')).toBe(0)
  })

  it('scores partial overlap as the Jaccard ratio of shared to total content words', () => {
    // a's content words: {swing, hard, good, angle}. b's: {real, speed,
    // swing, hard, contact}. Shared: {swing, hard} = 2. Union of both sets:
    // {swing, hard, good, angle, real, speed, contact} = 7. 2 / 7.
    const a = 'That swing was hard with good angle.'
    const b = 'Real speed on that swing, hard contact.'
    expect(contentWordOverlap(a, b)).toBeCloseTo(2 / 7, 10)
  })

  it('is 0 when one side is empty text', () => {
    expect(contentWordOverlap('', 'Hard contact at 92 mph.')).toBe(0)
  })

  it('is 0 when both sides are empty text', () => {
    expect(contentWordOverlap('', '')).toBe(0)
  })

  it('is high when whatThisMeans mostly restates coachingSummary', () => {
    // The exact failure this measure exists to catch: a floor met by
    // repeating the summary's own words back with light rewording.
    const summary = 'You hit the ball hard at 92 mph and drove it 320 feet.'
    const restated = 'Hitting the ball hard at 92 mph drove it a long 320 feet.'
    expect(contentWordOverlap(summary, restated)).toBeGreaterThan(0.5)
  })
})
