import { describe, it, expect } from 'vitest'
import { fillForGrading, fillOrFail } from './benchFill.js'
import { CoachCallError, buildFailureRecord } from './coachFailureRecord.js'
import { analyseFields } from './slotAdoption.js'
import { SESSION_ONE_SWINGS } from '../src/sessionOneSwings.js'

// See scripts/benchFill.js for why this is its own module: the bench runs
// main() at import time and cannot be imported by a test without spending
// money. What this checks is the deterministic seam, that the bench fills
// the coach's number slots the way the app does and keeps the raw reply. It
// never touches the model.

// Session 1 built the way the bench builds it: a sessionNumber and the real
// fifteen swings. Swing 5 is 92 mph, 27 degrees, 346 feet; swing 1 is 86 mph.
const sessions = [{ sessionNumber: 1, swings: SESSION_ONE_SWINGS }]

const reply = (overrides = {}) => ({
  coachingSummary: 'Swing 5 came off at {{s1.sw5.ev}} mph and went {{s1.sw5.dist}} feet.',
  whatThisMeans: 'That is {{s1.sw5.la}} degrees, right where you want it.',
  tipsIntro: 'Two things before next round.',
  nextSessionTips: [
    'Swing 1 left at {{s1.sw1.ev}} mph. Stay back a half beat longer.',
    'Keep the hips leading. You are close.',
  ],
  charts: ['scatter_ev_la', 'bar_distance'],
  ...overrides,
})

describe('fillForGrading: filled', () => {
  it('replaces a slot with the real number from the session it names', () => {
    const { filled } = fillForGrading(reply(), sessions)
    expect(filled.coachingSummary).toBe('Swing 5 came off at 92 mph and went 346 feet.')
    expect(filled.whatThisMeans).toBe('That is 27 degrees, right where you want it.')
    expect(filled.nextSessionTips[0]).toBe('Swing 1 left at 86 mph. Stay back a half beat longer.')
  })

  it('rounds pitch height and side to one decimal, as the app does', () => {
    const swing = {
      hit: { launch: { exitSpeed: 80, angle: 10, direction: 0 }, landing: { distance: 200 } },
      plateLocHeight: 2.82,
      plateLocSide: -0.64,
    }
    const { filled } = fillForGrading(
      reply({
        coachingSummary: 'A pitch at {{s1.sw1.ht}} feet, {{s1.sw1.side}} off the plate.',
        whatThisMeans: 'Nothing slotted here.',
        nextSessionTips: ['Nothing slotted here either.', 'Nor here.'],
      }),
      [{ sessionNumber: 1, swings: [swing] }],
    )
    expect(filled.coachingSummary).toBe('A pitch at 2.8 feet, -0.6 off the plate.')
  })

  it('drops the sentence when a slot names a swing that does not exist', () => {
    const { filled } = fillForGrading(
      reply({ tipsIntro: 'Swing 40 was {{s1.sw40.ev}} mph. Two things before next round.' }),
      sessions,
    )
    expect(filled.tipsIntro).toBe('Two things before next round.')
  })

  it('throws when a required prose field is emptied by the drop', () => {
    expect(() =>
      fillForGrading(reply({ coachingSummary: 'Swing 40 was {{s1.sw40.ev}} mph.' }), sessions),
    ).toThrow(/emptied/)
  })
})

describe('fillForGrading: rawFields', () => {
  it('keeps the five text fields as the coach wrote them, placeholders intact', () => {
    const { rawFields } = fillForGrading(reply(), sessions)
    expect(rawFields).toEqual({
      coachingSummary: 'Swing 5 came off at {{s1.sw5.ev}} mph and went {{s1.sw5.dist}} feet.',
      whatThisMeans: 'That is {{s1.sw5.la}} degrees, right where you want it.',
      tipsIntro: 'Two things before next round.',
      tip1: 'Swing 1 left at {{s1.sw1.ev}} mph. Stay back a half beat longer.',
      tip2: 'Keep the hips leading. You are close.',
    })
  })

  it('keeps the raw text even where the fill dropped a sentence', () => {
    const { rawFields, filled } = fillForGrading(
      reply({ tipsIntro: 'Swing 40 was {{s1.sw40.ev}} mph. Two things before next round.' }),
      sessions,
    )
    expect(rawFields.tipsIntro).toBe('Swing 40 was {{s1.sw40.ev}} mph. Two things before next round.')
    expect(filled.tipsIntro).not.toContain('{{')
  })

  it('leaves tips undefined when the coach wrote fewer than two', () => {
    const { rawFields } = fillForGrading(reply({ nextSessionTips: ['Only one.'] }), sessions)
    expect(rawFields.tip1).toBe('Only one.')
    expect(rawFields.tip2).toBeUndefined()
  })
})

describe('fillOrFail: a fill that throws keeps the evidence', () => {
  it('wraps the throw as a CoachCallError carrying the raw reply and the token count', () => {
    const parsed = reply({ coachingSummary: 'Swing 40 was {{s1.sw40.ev}} mph.' })
    let caught
    try {
      fillOrFail(parsed, sessions, { outputTokens: 812 })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CoachCallError)
    expect(caught.message).toMatch(/emptied/)
    expect(caught.rawText).toBe(JSON.stringify(parsed))
    expect(caught.outputTokens).toBe(812)
  })

  it('reaches the failure record, which keeps the raw text', () => {
    const parsed = reply({ coachingSummary: 'Swing 40 was {{s1.sw40.ev}} mph.' })
    let caught
    try {
      fillOrFail(parsed, sessions)
    } catch (err) {
      caught = err
    }
    const record = buildFailureRecord({ conditionKey: 'shipped', cell: 'power-s1', run: 1 }, caught)
    expect(record.rawText).toContain('{{s1.sw40.ev}}')
    expect(record.outputTokens).toBeNull()
  })

  it('returns the same result as fillForGrading when the fill succeeds', () => {
    expect(fillOrFail(reply(), sessions)).toEqual(fillForGrading(reply(), sessions))
  })
})

describe('fillForGrading feeds slotAdoption', () => {
  it('rawFields is the shape analyseFields reads, and its placeholders count as resolvable', () => {
    const { rawFields } = fillForGrading(reply(), sessions)
    const a = analyseFields(rawFields, sessions, 1)
    expect(a.markers.map((m) => m.raw)).toEqual([
      '{{s1.sw5.ev}}',
      '{{s1.sw5.dist}}',
      '{{s1.sw5.la}}',
      '{{s1.sw1.ev}}',
    ])
    expect(a.markers.every((m) => m.resolvable)).toBe(true)
  })
})
