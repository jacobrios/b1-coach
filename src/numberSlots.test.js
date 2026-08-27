import { describe, it, expect } from 'vitest'
import { fillNumberSlots, fillDebriefNumbers, fillChatNumbers, NUMBER_SLOT_RE } from './numberSlots'

// A swing shaped exactly like the app's, with only the six fields a slot can
// name. Pitch height and side carry two decimals on a generated session and one
// on the hand-written first session; both are represented here on purpose.
const swing = (ev, la, dir, dist, ht, side) => ({
  hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } },
  plateLocHeight: ht,
  plateLocSide: side,
})

const sessions = [
  {
    sessionNumber: 1,
    swings: [swing(86, 22, -22, 272, 2.8, 0.2), swing(72, 8, 5, 122, 1.2, -0.3)],
  },
  {
    sessionNumber: 4,
    swings: [swing(82, 22, 2, 245, 3.63, 0.47), swing(87, 19, -42, 260, 2.31, 0.67)],
  },
]

describe('fillNumberSlots', () => {
  it('replaces a slot with the real value for that swing', () => {
    expect(fillNumberSlots('Swing 1 came off at {{s1.sw1.ev}} mph.', sessions))
      .toBe('Swing 1 came off at 86 mph.')
  })

  it('keeps two slots in the order they were written, so a pair cannot transpose', () => {
    expect(fillNumberSlots('Swings 1 and 2 hit {{s1.sw1.ev}} and {{s1.sw2.ev}} mph.', sessions))
      .toBe('Swings 1 and 2 hit 86 and 72 mph.')
  })

  it('reads the session named in the slot, not the newest one', () => {
    expect(fillNumberSlots('{{s1.sw1.ev}} then {{s4.sw1.ev}}', sessions)).toBe('86 then 82')
  })

  it('fills every one of the six fields', () => {
    expect(fillNumberSlots('{{s4.sw1.ev}}|{{s4.sw1.la}}|{{s4.sw1.dir}}|{{s4.sw1.dist}}', sessions))
      .toBe('82|22|2|245')
  })

  // The defect the probe's own filled output turned up: the stored pitch
  // position carries two decimals and a coach says "3.6 feet", never
  // "3.63 feet". Rounding here is what stops the mechanism making the prose
  // read more machine-written than the coach's own typing did.
  it('rounds pitch height and pitch side to one decimal', () => {
    expect(fillNumberSlots('at {{s4.sw1.ht}} feet, {{s4.sw1.side}} off the plate', sessions))
      .toBe('at 3.6 feet, 0.5 off the plate')
  })

  it('leaves a value that is already one decimal alone', () => {
    expect(fillNumberSlots('{{s1.sw1.ht}}', sessions)).toBe('2.8')
  })

  it('tolerates spaces inside the braces', () => {
    expect(fillNumberSlots('{{ s1.sw1.ev }}', sessions)).toBe('86')
  })

  it('leaves text with no slots untouched', () => {
    const text = 'Nine of your fifteen swings flew above 18 degrees.'
    expect(fillNumberSlots(text, sessions)).toBe(text)
  })

  // An unresolvable slot means the coach is talking about a swing that does not
  // exist, so the sentence is wrong whatever we put in it. Dropping the
  // sentence removes a false statement; filling it would invent one and printing
  // the braces would show a visitor the machinery.
  it('drops the sentence around a slot naming a swing that does not exist', () => {
    const out = fillNumberSlots('Swing 1 hit {{s1.sw1.ev}} mph. Swing 9 hit {{s1.sw9.ev}} mph. Keep going.', sessions)
    expect(out).toBe('Swing 1 hit 86 mph. Keep going.')
  })

  it('drops the sentence around a slot naming a session that does not exist', () => {
    expect(fillNumberSlots('Good work. Swing 1 hit {{s3.sw1.ev}} mph.', sessions)).toBe('Good work.')
  })

  it('drops the sentence around a slot naming a field that does not exist', () => {
    expect(fillNumberSlots('Good work. Swing 1 spun {{s1.sw1.rpm}}.', sessions)).toBe('Good work.')
  })

  it('returns an empty string when every sentence had to be dropped', () => {
    expect(fillNumberSlots('Swing 9 hit {{s1.sw9.ev}} mph.', sessions)).toBe('')
  })
})

describe('fillDebriefNumbers', () => {
  const debrief = () => ({
    coachingSummary: 'Swing 1 hit {{s1.sw1.ev}} mph.',
    whatThisMeans: 'That is real bat speed.',
    tipsIntro: 'Two things.',
    nextSessionTips: ['Swing 2 at {{s1.sw2.la}} degrees is flat.', 'Stay through it.'],
    charts: ['scatter_ev_la', 'trend_ev'],
  })

  it('fills every text field and both tips', () => {
    const out = fillDebriefNumbers(debrief(), sessions)
    expect(out.coachingSummary).toBe('Swing 1 hit 86 mph.')
    expect(out.nextSessionTips[0]).toBe('Swing 2 at 8 degrees is flat.')
  })

  it('leaves the chart keys alone', () => {
    expect(fillDebriefNumbers(debrief(), sessions).charts).toEqual(['scatter_ev_la', 'trend_ev'])
  })

  it('does not mutate the object it was given', () => {
    const original = debrief()
    fillDebriefNumbers(original, sessions)
    expect(original.coachingSummary).toBe('Swing 1 hit {{s1.sw1.ev}} mph.')
  })

  // The doubly-rare case: an unresolvable slot AND it was the only sentence in
  // a field the screen needs. Better to fail honestly than to render a debrief
  // with a blank summary where the coaching should be.
  it('throws when a required field is emptied by dropping', () => {
    const bad = { ...debrief(), coachingSummary: 'Swing 9 hit {{s1.sw9.ev}} mph.' }
    expect(() => fillDebriefNumbers(bad, sessions)).toThrow(/emptied/i)
  })

  it('does not throw when a tip is emptied, since the other tip still stands', () => {
    const bad = { ...debrief(), nextSessionTips: ['Swing 9 hit {{s1.sw9.ev}} mph.', 'Stay through it.'] }
    expect(() => fillDebriefNumbers(bad, sessions)).not.toThrow()
  })
})

// The test that used to sit here rebuilt the pattern without its flags, so it
// exercised a different regex than the module exported and could never surface
// the statefulness problem review found. Replaced by the two tests at the end
// of this file, which drive the export itself.

// The chat coach recites per-swing values constantly, because the player asks
// it to ("which ones did I pull?"). Leaving it out would put app-owned numbers
// in the debrief and coach-typed numbers in the panel beside it on the same
// screen, which is the exact split this repo has been bitten by before:
// DISTANCE_BUCKETS lived in three copies and the chat prompt was the one that
// kept getting missed.
describe('fillChatNumbers', () => {
  it('fills the message', () => {
    expect(fillChatNumbers({ message: 'Swing 1 hit {{s1.sw1.ev}} mph.', chart: null }, sessions).message)
      .toBe('Swing 1 hit 86 mph.')
  })

  it('leaves the chart key alone', () => {
    expect(fillChatNumbers({ message: 'Sure.', chart: 'spray_direction' }, sessions).chart)
      .toBe('spray_direction')
  })

  it('throws when the whole message is emptied by dropping', () => {
    expect(() => fillChatNumbers({ message: 'Swing 9 hit {{s1.sw9.ev}} mph.' }, sessions)).toThrow(/emptied/i)
  })
})

// Every test below was added after an independent review found the first
// version flattened markdown structure on EVERY chat reply, slots or no slots.
// The chat prompt requires "each session must be its own bullet point" and
// paragraph breaks, react-markdown renders them, and the voice round could not
// see it because it only exercised the debrief, whose three fields are
// single-paragraph prose in plain divs.
describe('structure the coach wrote is not the app\'s to rearrange', () => {
  it('leaves text with no slots byte-identical, newlines and all', () => {
    const text = 'Nice work today.\n\nYour bat speed is up.'
    expect(fillNumberSlots(text, sessions)).toBe(text)
  })

  it('keeps each bullet on its own line while filling slots inside them', () => {
    const text = 'Here is what stood out:\n\n- Swing 1 hit {{s1.sw1.ev}} mph.\n- Swing 2 hit {{s1.sw2.ev}} mph.\n\nKeep it up.'
    expect(fillNumberSlots(text, sessions))
      .toBe('Here is what stood out:\n\n- Swing 1 hit 86 mph.\n- Swing 2 hit 72 mph.\n\nKeep it up.')
  })

  it('keeps a paragraph break between two filled paragraphs', () => {
    expect(fillNumberSlots('Swing 1 hit {{s1.sw1.ev}} mph.\n\nThat is real.', sessions))
      .toBe('Swing 1 hit 86 mph.\n\nThat is real.')
  })
})

describe('machinery never reaches the screen', () => {
  // The pattern tolerates spaces around the dots, and the first version split
  // the text into sentences BEFORE matching, so ". sw1" ended the sentence and
  // the slot was printed to the visitor verbatim.
  it('fills a slot whose dots carry spaces', () => {
    expect(fillNumberSlots('{{s1. sw1. ev}} was your best.', sessions)).toBe('86 was your best.')
  })

  it('fills a slot the model wrapped across a newline', () => {
    expect(fillNumberSlots('You hit {{s1.sw1\n.ev}} mph.', sessions)).toBe('You hit 86 mph.')
  })

  it('drops a sentence carrying an unclosed brace rather than printing it', () => {
    expect(fillNumberSlots('Swing 1 hit 86 mph. Swing 2 hit {{s1.sw2.ev mph.', sessions))
      .toBe('Swing 1 hit 86 mph.')
  })

  it('never leaves a brace behind, whatever it was handed', () => {
    for (const bad of ['{{', '{{}}', '{{s1.sw1}}', '{{sX.swY.ev}}', 'a {{ b']) {
      expect(fillNumberSlots(`Good line. ${bad} trailing.`, sessions)).not.toContain('{{')
    }
  })
})

describe('dropping a sentence does not truncate the one before it', () => {
  // Both found by review. The naive split cut "No. 9" and "Well..." in half and
  // handed the visitor a dangling fragment, which is the broken-grammar outcome
  // the drop policy exists to avoid.
  it('does not treat an abbreviation as the end of a sentence', () => {
    expect(fillNumberSlots('Look at swing No. 9 with {{s1.sw9.ev}} mph.', sessions)).toBe('')
  })

  it('does not treat an ellipsis as the end of a sentence', () => {
    expect(fillNumberSlots('Well... {{s1.sw9.ev}} mph is not it.', sessions)).toBe('')
  })

  it('still splits a genuine sentence boundary so only the bad half goes', () => {
    expect(fillNumberSlots('Swing 1 hit {{s1.sw1.ev}} mph. Swing 9 hit {{s1.sw9.ev}} mph.', sessions))
      .toBe('Swing 1 hit 86 mph.')
  })
})

describe('the exported pattern is safe for a future reader to use', () => {
  // Review found the only test touching this export rebuilt it without the /g
  // flag, so it tested a different regex than the module shipped. A global
  // regex carries lastIndex between calls, so .test() on the same input
  // alternates true and false. The export is non-global; the filling makes its
  // own global copy.
  it('gives the same answer twice on the same input', () => {
    expect(NUMBER_SLOT_RE.test('{{s1.sw2.ev}}')).toBe(true)
    expect(NUMBER_SLOT_RE.test('{{s1.sw2.ev}}')).toBe(true)
  })

  it('is not global, which is what makes that true', () => {
    expect(NUMBER_SLOT_RE.global).toBe(false)
  })
})
