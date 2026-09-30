// How often the coach writes a placeholder instead of typing a swing's number.
//
// Since Slice 15 the coach is asked to write {{s1.sw5.ev}} where it would have
// typed "92", and the app fills the digit in. Whether it actually does is an
// empirical question, not a guarantee (this project has measured twice that a
// prompt instruction is persuasion rather than a rule). This module is the
// count that answers it: resolvable placeholders, divided by resolvable
// placeholders plus bare recitals.
//
// It was the inline calculation in scripts/probe-number-slots.mjs, which runs
// a live model call at import time and so could not be tested or reused. The
// bench audit needs the same count over a different record shape (a bench
// record's rawFields), so it is its own module on the same pattern as
// coachFailureRecord.js and benchFill.js. The counting itself is moved
// unchanged; the probe's committed records, run back through it in
// slotAdoption.test.js, are the proof.
//
// A bare recital is the thing a placeholder was supposed to replace: a number
// typed out that exactly equals one of the six values of a swing named in the
// same sentence. This is a PROXY and its limits are the probe's to print: it
// can miss a recital phrased across two sentences, and it can over-count a
// coincidence, for example a count that happens to equal a launch angle.
import { NUMBER_SLOT_RE } from '../src/numberSlots.js'

// The six values a placeholder can name. The probe's prompt wording carries the
// same six names beside their descriptions; this list is only which names are
// known, so a placeholder naming any other field is reported as unresolvable.
const SLOT_FIELD_NAMES = ['ev', 'la', 'dir', 'dist', 'ht', 'side']

// Same pattern the app fills by (NUMBER_SLOT_RE), made global. Built fresh per
// call so no lastIndex is shared between callers.
const markerPattern = () => new RegExp(NUMBER_SLOT_RE.source, 'g')

function swingValues(swing) {
  return {
    ev: swing.hit.launch.exitSpeed,
    la: swing.hit.launch.angle,
    dir: swing.hit.launch.direction,
    dist: swing.hit.landing.distance,
    ht: swing.plateLocHeight,
    side: swing.plateLocSide,
  }
}

function findSession(sessions, n) {
  return sessions.find((s) => s.sessionNumber === n) ?? null
}

// `sessions` is [{ sessionNumber, swings }], the same shape the app fills by
// and the bench's buildSessions returns. A caller counting a bench record must
// rebuild them first; a bench record does not store them.
export function analyseText(text, sessions, currentSessionNumber) {
  const markers = []
  const bareRecitals = []
  if (typeof text !== 'string' || !text) return { markers, bareRecitals }

  const markerRe = markerPattern()
  let m
  while ((m = markerRe.exec(text)) !== null) {
    const [raw, sessionStr, swingStr, field] = m
    const session = findSession(sessions, Number(sessionStr))
    const swing = session?.swings?.[Number(swingStr) - 1]
    const known = SLOT_FIELD_NAMES.includes(field)
    markers.push({
      raw,
      resolvable: Boolean(session && swing && known),
      why: !session ? 'no such session' : !swing ? 'no such swing' : !known ? 'unknown field' : null,
      value: session && swing && known ? swingValues(swing)[field] : null,
    })
  }

  // Strip markers before hunting bare numbers, so a filled-in-later figure is
  // never counted as a number the coach typed.
  const stripped = text.replace(markerPattern(), ' @@MARKER@@ ')

  for (const sentence of stripped.split(/(?<=[.!?])\s+|\n+/)) {
    const swingRefRe = /swings?\s+(\d+(?:\s*(?:,|and|&|through|-|to)\s*\d+)*)/gi
    const referenced = []
    const refSpans = []
    let r
    while ((r = swingRefRe.exec(sentence)) !== null) {
      refSpans.push([r.index, r.index + r[0].length])
      for (const d of r[1].match(/\d+/g) ?? []) referenced.push(Number(d))
    }
    if (referenced.length === 0) continue

    const sessionMatch = sentence.match(/session\s+(\d+)/i)
    const sessionNumber = sessionMatch ? Number(sessionMatch[1]) : currentSessionNumber
    const session = findSession(sessions, sessionNumber)
    if (!session) continue

    const candidates = new Set()
    for (const idx of referenced) {
      const swing = session.swings[idx - 1]
      if (!swing) continue
      for (const v of Object.values(swingValues(swing))) candidates.add(Number(v))
    }
    if (candidates.size === 0) continue

    // Blank out the swing references themselves, so "swing 12" never counts as
    // a recital of some other swing's 12-degree launch angle.
    let hunting = sentence
    for (const [start, end] of refSpans) {
      hunting = hunting.slice(0, start) + ' '.repeat(end - start) + hunting.slice(end)
    }

    for (const numStr of hunting.match(/-?\d+(?:\.\d+)?/g) ?? []) {
      if (candidates.has(Number(numStr))) {
        bareRecitals.push({ number: numStr, sentence: sentence.trim().slice(0, 200) })
      }
    }
  }

  return { markers, bareRecitals }
}

function analyseTexts(texts, sessions, currentSessionNumber) {
  const markers = []
  const bareRecitals = []
  for (const t of texts) {
    const a = analyseText(t, sessions, currentSessionNumber)
    markers.push(...a.markers)
    bareRecitals.push(...a.bareRecitals)
  }
  return { markers, bareRecitals, texts }
}

const TEXT_FIELDS = ['coachingSummary', 'whatThisMeans', 'tipsIntro']

// The parsed reply shape the probe reads: tips under nextSessionTips, each a
// string or an object of strings.
export function analyseDebrief(parsed, sessions, currentSessionNumber) {
  const texts = []
  for (const f of TEXT_FIELDS) if (parsed?.[f]) texts.push(parsed[f])
  for (const tip of parsed?.nextSessionTips ?? []) {
    if (typeof tip === 'string') texts.push(tip)
    else if (tip && typeof tip === 'object') for (const v of Object.values(tip)) if (typeof v === 'string') texts.push(v)
  }
  return analyseTexts(texts, sessions, currentSessionNumber)
}

// The bench record shape: rawFields, the coach's text with placeholders
// verbatim (see fillForGrading in benchFill.js). A thin adapter over the same
// counting, so a bench round and a probe round are counted by one rule. A
// bench-side count sees only tip1 and tip2, which matches what the grader sees.
export function analyseFields(rawFields, sessions, currentSessionNumber) {
  const texts = []
  for (const f of [...TEXT_FIELDS, 'tip1', 'tip2']) if (typeof rawFields?.[f] === 'string' && rawFields[f]) texts.push(rawFields[f])
  return analyseTexts(texts, sessions, currentSessionNumber)
}

// Percent of per-swing values written as a placeholder. null, not 0 or 100,
// when the coach wrote neither, so an empty round cannot read as a result.
export function adoptionPercent(totalResolvable, totalBare) {
  const denom = totalResolvable + totalBare
  return denom === 0 ? null : (totalResolvable / denom) * 100
}
