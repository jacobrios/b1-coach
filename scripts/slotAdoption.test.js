import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  analyseText,
  analyseFields,
  analyseDebrief,
  adoptionPercent,
} from './slotAdoption.js'
import { generateSwings } from '../src/swingGenerator.js'
import { SESSION_ONE_SWINGS } from '../src/sessionOneSwings.js'

// See scripts/slotAdoption.js for why the adoption count lives in its own
// module: the probe that first measured it runs a live model call at import
// time, so nothing in it could be tested, and the bench audit needs the same
// count over a different record shape.

// One swing with the six values the counter compares against. Values are
// distinct per swing on purpose, so a recital can only match the swing the
// sentence names.
function swing({ ev, la, dir, dist, ht, side }) {
  return {
    hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } },
    plateLocHeight: ht,
    plateLocSide: side,
  }
}

const SWINGS = [
  swing({ ev: 80, la: 12, dir: -3, dist: 200, ht: 2.5, side: 0.1 }), // swing 1
  swing({ ev: 72, la: 5, dir: 20, dist: 120, ht: 1.4, side: -0.4 }), // swing 2
  swing({ ev: 91, la: 27, dir: -18, dist: 340, ht: 3.1, side: 0.7 }), // swing 3
]

const SESSIONS = [
  { sessionNumber: 1, swings: SWINGS },
  {
    sessionNumber: 2,
    swings: [
      swing({ ev: 66, la: 9, dir: 4, dist: 150, ht: 2.2, side: 0.3 }), // s2 swing 1
      swing({ ev: 84, la: 15, dir: 6, dist: 255, ht: 2.6, side: -0.2 }), // s2 swing 2
    ],
  },
]

describe('analyseText: placeholders', () => {
  it('counts each placeholder and resolves it to the value the app would fill in', () => {
    const a = analyseText('Swings 1 and 3 came off at {{s1.sw1.ev}} and {{s1.sw3.ev}} mph.', SESSIONS, 1)
    expect(a.markers).toHaveLength(2)
    expect(a.markers.every((m) => m.resolvable)).toBe(true)
    expect(a.markers.map((m) => m.value)).toEqual([80, 91])
    expect(a.bareRecitals).toEqual([])
  })

  it('tolerates whitespace inside the braces, as the app does', () => {
    const a = analyseText('Swing 2 went {{ s1 . sw2 . ev }} mph.', SESSIONS, 1)
    expect(a.markers).toHaveLength(1)
    expect(a.markers[0].resolvable).toBe(true)
    expect(a.markers[0].value).toBe(72)
  })

  it('reads the session the placeholder names, not the viewed one', () => {
    const a = analyseText('Swing 2 of session 2 hit {{s2.sw2.dist}} feet.', SESSIONS, 1)
    expect(a.markers[0].resolvable).toBe(true)
    expect(a.markers[0].value).toBe(255)
  })

  it('marks a placeholder naming a session, swing or field that does not exist as unresolvable, with the reason', () => {
    const a = analyseText(
      '{{s9.sw1.ev}} then {{s1.sw99.ev}} then {{s1.sw1.spin}}',
      SESSIONS,
      1,
    )
    expect(a.markers).toHaveLength(3)
    expect(a.markers.map((m) => m.resolvable)).toEqual([false, false, false])
    expect(a.markers.map((m) => m.why)).toEqual(['no such session', 'no such swing', 'unknown field'])
  })

  it('resolves all six field names', () => {
    const text = ['ev', 'la', 'dir', 'dist', 'ht', 'side'].map((f) => `{{s1.sw1.${f}}}`).join(' ')
    const a = analyseText(text, SESSIONS, 1)
    expect(a.markers.map((m) => m.value)).toEqual([80, 12, -3, 200, 2.5, 0.1])
  })

  it('returns nothing for empty, missing or non-string text', () => {
    for (const t of ['', undefined, null, 42]) {
      expect(analyseText(t, SESSIONS, 1)).toEqual({ markers: [], bareRecitals: [] })
    }
  })
})

describe('analyseText: bare recitals', () => {
  it('counts a typed number equal to one of the six values of a swing named in the same sentence', () => {
    const a = analyseText('Swing 2 went 72 mph, which is soft.', SESSIONS, 1)
    expect(a.bareRecitals).toHaveLength(1)
    expect(a.bareRecitals[0].number).toBe('72')
    expect(a.markers).toEqual([])
  })

  it('counts every matching number in the sentence, one recital each', () => {
    const a = analyseText('Swing 3 hit 91 mph at 27 degrees and carried 340 feet.', SESSIONS, 1)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['91', '27', '340'])
  })

  it('counts decimals and negatives', () => {
    const a = analyseText('Swing 1 was a pitch at 2.5 feet and went -3 degrees of direction.', SESSIONS, 1)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['2.5', '-3'])
  })

  it('does not count a number that is none of the named swing\'s six values', () => {
    const a = analyseText('Swing 2 went 73 mph.', SESSIONS, 1)
    expect(a.bareRecitals).toEqual([])
  })

  it('does not count a number that belongs to a swing the sentence does not name', () => {
    // 91 is swing 3's exit velocity; only swing 2 is named here.
    const a = analyseText('Swing 2 went fast, unlike the 91 you hit earlier.', SESSIONS, 1)
    expect(a.bareRecitals).toEqual([])
  })

  it('does not count a number in a sentence that names no swing', () => {
    const a = analyseText('Your average was 72 mph across the session.', SESSIONS, 1)
    expect(a.bareRecitals).toEqual([])
  })

  it('never counts the swing number itself as a recital of another swing\'s value', () => {
    // Swing 1 has a 12 degree launch angle; "swing 12" must not match it.
    const a = analyseText('Swing 1 and swing 12 are the ones to watch.', SESSIONS, 1)
    expect(a.bareRecitals).toEqual([])
  })

  it('reads the session named in the sentence, falling back to the viewed one', () => {
    // 66 is session 2 swing 1's exit velocity and is nobody's in session 1.
    const named = analyseText('In session 2, swing 1 was 66 mph.', SESSIONS, 1)
    expect(named.bareRecitals.map((b) => b.number)).toEqual(['66'])
    const fallback = analyseText('Swing 1 was 66 mph.', SESSIONS, 1)
    expect(fallback.bareRecitals).toEqual([])
    const viewing2 = analyseText('Swing 1 was 66 mph.', SESSIONS, 2)
    expect(viewing2.bareRecitals.map((b) => b.number)).toEqual(['66'])
  })

  it('handles swing ranges and lists in one reference', () => {
    const a = analyseText('Swings 1, 2 and 3 were 80, 72 and 91 mph.', SESSIONS, 1)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['80', '72', '91'])
  })

  it('never counts a figure the app will fill in, because markers are stripped first', () => {
    const a = analyseText('Swing 2 went {{s1.sw2.ev}} mph.', SESSIONS, 1)
    expect(a.bareRecitals).toEqual([])
    expect(a.markers).toHaveLength(1)
  })

  it('counts a sentence that mixes a placeholder and a typed value separately', () => {
    const a = analyseText('Swing 2 went {{s1.sw2.ev}} mph at 5 degrees.', SESSIONS, 1)
    expect(a.markers).toHaveLength(1)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['5'])
  })

  it('splits sentences on full stops, question marks, exclamation marks and newlines', () => {
    const a = analyseText('Swing 2 was soft.\nYour average was 72 mph! Swing 3 was 91.', SESSIONS, 1)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['91'])
  })
})

describe('analyseFields: a bench record\'s rawFields', () => {
  it('counts across all five text fields, including both tips', () => {
    const rawFields = {
      coachingSummary: 'Swing 3 hit {{s1.sw3.ev}} mph.',
      whatThisMeans: 'Swing 2 went 72 mph.',
      tipsIntro: 'Two things.',
      tip1: 'Swing 1 at {{s1.sw1.la}} degrees is the shape.',
      tip2: 'Swing 3 carried 340 feet.',
    }
    const a = analyseFields(rawFields, SESSIONS, 1)
    expect(a.markers).toHaveLength(2)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['72', '340'])
  })

  it('ignores a missing or non-string field', () => {
    const a = analyseFields({ coachingSummary: '{{s1.sw1.ev}}', tip1: undefined, tip2: 7 }, SESSIONS, 1)
    expect(a.markers).toHaveLength(1)
    expect(a.bareRecitals).toEqual([])
  })

  it('gives the same counts as analyseDebrief on the same text in the parsed-reply shape', () => {
    const rawFields = {
      coachingSummary: 'Swing 3 hit {{s1.sw3.ev}} mph.',
      whatThisMeans: 'Swing 2 went 72 mph.',
      tipsIntro: 'Two things.',
      tip1: 'Swing 1 at {{s1.sw1.la}} degrees.',
      tip2: 'Swing 3 carried 340 feet.',
    }
    const parsed = {
      coachingSummary: rawFields.coachingSummary,
      whatThisMeans: rawFields.whatThisMeans,
      tipsIntro: rawFields.tipsIntro,
      nextSessionTips: [rawFields.tip1, rawFields.tip2],
    }
    const viaFields = analyseFields(rawFields, SESSIONS, 1)
    const viaParsed = analyseDebrief(parsed, SESSIONS, 1)
    expect(viaFields.markers).toEqual(viaParsed.markers)
    expect(viaFields.bareRecitals).toEqual(viaParsed.bareRecitals)
  })
})

describe('analyseDebrief: a parsed reply', () => {
  it('reads tips given as strings or as objects of strings, and returns the texts it read', () => {
    const parsed = {
      coachingSummary: 'Swing 3 hit {{s1.sw3.ev}} mph.',
      tipsIntro: 'Two things.',
      nextSessionTips: ['Swing 2 went 72 mph.', { title: 'Level it', body: 'Swing 1 at {{s1.sw1.la}} degrees.' }],
    }
    const a = analyseDebrief(parsed, SESSIONS, 1)
    expect(a.markers).toHaveLength(2)
    expect(a.bareRecitals.map((b) => b.number)).toEqual(['72'])
    expect(a.texts).toHaveLength(5)
  })
})

describe('adoptionPercent', () => {
  it('is placeholders over placeholders plus typed recitals, as a percentage', () => {
    expect(adoptionPercent(3, 1)).toBe(75)
    expect(adoptionPercent(4, 0)).toBe(100)
    expect(adoptionPercent(0, 4)).toBe(0)
  })

  it('is null when the coach wrote neither, so an empty round never reads as 0 or 100', () => {
    expect(adoptionPercent(0, 0)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The proof the move changed nothing.
//
// scripts/probe-number-slots.mjs counted these records when it ran live, and
// wrote its own counts beside the text into probe-records.json. Feeding the
// committed text back through the extracted function, over sessions rebuilt the
// way the probe rebuilt them, must reproduce those stored counts exactly, and
// the adoption figure the probe printed from them.
//
// The figure is 85.3 (64 resolvable placeholders, 11 typed recitals, 16 of 16
// debriefs parsed). The Slice 15 decision log says "89%" for the probe. The
// committed file does not produce 89 and this test does not pretend it does;
// see the Task 2 report for the discrepancy.
// ─────────────────────────────────────────────────────────────────────────────

const PROBE_FILE = fileURLToPath(
  new URL('../docs/eval-fixtures/slice15-number-slots/probe/probe-records.json', import.meta.url),
)
const probe = JSON.parse(readFileSync(PROBE_FILE, 'utf8'))

// Same generator seed, same builder shape as the probe's buildSessions.
function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = SESSION_ONE_SWINGS
  const sessions = [{ sessionNumber: 1, swings: baseline }]
  for (let n = 2; n <= upTo; n++) {
    sessions.push({ sessionNumber: n, swings: generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random }) })
  }
  return sessions
}

const CELLS = {
  'power-s1': { goalId: 'power', session: 1 },
  'contact-s1': { goalId: 'contact', session: 1 },
  'contact-s4': { goalId: 'contact', session: 4 },
  'open-s4': { goalId: 'open', session: 4 },
}

describe('the probe\'s committed records, counted through the extracted function', () => {
  const ok = probe.records.filter((r) => !r.parseFailed && !r.callFailed)

  function recount(record) {
    const cell = CELLS[record.cell]
    const sessions = buildSessions({ goalId: cell.goalId, upTo: cell.session, seed: probe.meta.seed })
    const markers = []
    const bare = []
    for (const t of record.texts) {
      const a = analyseText(t, sessions, cell.session)
      markers.push(...a.markers)
      bare.push(...a.bareRecitals)
    }
    return { markers, bare }
  }

  it('reads all 16 debriefs as parsed', () => {
    expect(probe.records).toHaveLength(16)
    expect(ok).toHaveLength(16)
  })

  it('reproduces every record\'s stored placeholder, unresolvable and bare-recital counts', () => {
    for (const record of ok) {
      const { markers, bare } = recount(record)
      const label = `${record.cell}/run${record.run}`
      expect({ label, markers: markers.length }).toEqual({ label, markers: record.markers })
      expect({ label, resolvable: markers.filter((m) => m.resolvable).length }).toEqual({ label, resolvable: record.resolvable })
      expect({ label, bare: bare.length }).toEqual({ label, bare: record.bareRecitals })
    }
  })

  it('reproduces the probe\'s printed adoption figure', () => {
    let resolvable = 0
    let bare = 0
    for (const record of ok) {
      const r = recount(record)
      resolvable += r.markers.filter((m) => m.resolvable).length
      bare += r.bare.length
    }
    expect(resolvable).toBe(64)
    expect(bare).toBe(11)
    expect(adoptionPercent(resolvable, bare).toFixed(1)).toBe('85.3')
  })
})
