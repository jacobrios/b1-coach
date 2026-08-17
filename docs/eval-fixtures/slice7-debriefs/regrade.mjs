// THROWAWAY analysis script. Not part of the repo, not a test, makes no API
// calls. Regrades 96 already-collected debriefs (24 baseline + 24 each of
// budget conditions A/B/C) for counting and swing-attribution errors, to
// answer: did the length budget (condition B, the one that shipped) make the
// coach's arithmetic worse than the unbudgeted baseline?
import { readFileSync, writeFileSync } from 'node:fs'
import { sessionsForCell, viewingSessionSwings, CELLS } from './rebuild.mjs'

// The record files now sit beside this script, in the committed fixture. This
// was a scratch-directory absolute path until 17 August 2026; that directory was
// temporary and would have taken the ground truth with it when it was cleaned up.
const SCRATCH = new URL('.', import.meta.url).pathname.replace(/\/$/, '')

const baseline = JSON.parse(readFileSync(`${SCRATCH}/baseline-records.json`, 'utf8'))
const budget = JSON.parse(readFileSync(`${SCRATCH}/budget-records.json`, 'utf8'))
const all = [...baseline, ...budget]

// ---------------------------------------------------------------------------
// Sanity check: rebuild power-s2 and eyeball it before trusting anything else
// ---------------------------------------------------------------------------
{
  const sessions = sessionsForCell('power-s2')
  console.log('SANITY CHECK: power-s2')
  for (const s of sessions) {
    console.log(
      `  Session ${s.sessionNumber}: ${s.swings.length} swings, ` +
      `avgEV ${s.stats.avgExitVelocity}, avgLA ${s.stats.avgLaunchAngle}, ` +
      `EV range ${Math.min(...s.swings.map(w => w.hit.launch.exitSpeed))}-${Math.max(...s.swings.map(w => w.hit.launch.exitSpeed))}`,
    )
  }
  // Cross-check against a known-good quote from baseline/power-s2/run1:
  // "you went from averaging 81 mph to 85 mph, and your top swings hit 91 and 92 mph"
  // "4 balls over 305 feet this round after hitting zero in Session 1"
  const s2 = sessions.find(s => s.sessionNumber === 2)
  const top3 = [...s2.swings].sort((a, b) => b.hit.launch.exitSpeed - a.hit.launch.exitSpeed).slice(0, 3).map(w => w.hit.launch.exitSpeed)
  console.log(`  Session 2 top 3 EV: ${top3.join(', ')} (quoted debrief said 91 and 92 among top swings)`)
  const over305 = s2.swings.filter(w => w.hit.landing.distance >= 305).length
  console.log(`  Session 2 balls >=305ft: ${over305} (quoted debrief said 4)`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Number-word handling
// ---------------------------------------------------------------------------
const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15,
}
const NUM_WORD_ALT = Object.keys(NUM_WORDS).join('|')
function toNum(tok) {
  if (tok == null) return null
  if (/^\d+$/.test(tok)) return parseInt(tok, 10)
  return NUM_WORDS[tok.toLowerCase()] ?? null
}

// ---------------------------------------------------------------------------
// Sentence splitting with char offsets, so "same sentence" checks are honest
// ---------------------------------------------------------------------------
function splitSentences(text) {
  const sentences = []
  let start = 0
  const re = /[.!?]+(?=\s|$)/g
  let m
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length
    sentences.push({ text: text.slice(start, end), start, end })
    start = end
  }
  if (start < text.length) sentences.push({ text: text.slice(start), start, end: text.length })
  return sentences
}

// ---------------------------------------------------------------------------
// Extract "swing(s) <number-list>" occurrences: one or more numbers
// (digit or spelled) immediately following the word "swing"/"swings",
// connected by commas/"and"/"&". A single "swing 4" is a list of length 1.
// ---------------------------------------------------------------------------
// Plain number token, used by the "N of TOTAL" checks below where the
// number IS meant to be followed by "of".
const NUMTOK = `(?:\\d+|${NUM_WORD_ALT})`

// List-item token, used only inside a swing-number list. Guarded with a
// negative lookahead against "<number> of ...": that combination almost
// always means the number starts a NEW clause ("...and four of those were
// also under 80 mph"), not a continuation of the swing list. Found by
// testing this script directly against the motivating false-counting
// example: without the guard, "and four of those" was swallowed into the
// swing list as a bogus 7th member. Kept as a separate constant from NUMTOK
// because COUNT_OF_TOTAL_RE below needs the *opposite* behavior: its number
// is required to be followed by "of".
const NUMTOK_LIST = `(?:(?:\\d+|${NUM_WORD_ALT})(?!\\s+of\\b))`
// Separator handles a bare comma, a bare "and", an Oxford-comma "and", and
// "&". Found necessary by testing: a plain "(?:,|and|&)" alternation cannot
// match ", and " (comma immediately followed by "and") as one unit, so a
// three-or-more item Oxford-comma list like "2, 4, and 5" was silently
// truncated to its first two items before this fix.
const SEP = `(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+|\\s*&\\s*)`
const SWING_NUMS_RE = new RegExp(
  `\\bswings?\\s*#?\\s*(${NUMTOK_LIST}(?:${SEP}${NUMTOK_LIST})*)`,
  'gi',
)

function extractSwingNumLists(text) {
  const out = []
  for (const m of text.matchAll(SWING_NUMS_RE)) {
    const raw = m[1]
    const toks = raw.split(new RegExp(SEP, 'i')).filter(Boolean)
    const nums = toks.map(toNum).filter((n) => n != null)
    if (nums.length === 0) continue
    out.push({ nums, index: m.index, matchText: m[0], raw })
  }
  return out
}

// ---------------------------------------------------------------------------
// CHECK 1: impossible swing numbers (below 1 or above 15)
// ---------------------------------------------------------------------------
function checkImpossibleSwingNumbers(text) {
  const findings = []
  for (const { nums, matchText } of extractSwingNumLists(text)) {
    for (const n of nums) {
      if (n < 1 || n > 15) {
        findings.push({ quoted: matchText.trim(), badNumber: n })
      }
    }
  }
  return findings
}

// ---------------------------------------------------------------------------
// CHECK 2: stated total disagreeing with reality ("N of your TOTAL swings")
// Flags when TOTAL != 15, or when the count N exceeds 15 (or exceeds TOTAL).
// ---------------------------------------------------------------------------
const COUNT_OF_TOTAL_RE = new RegExp(
  `\\b(${NUMTOK})\\s+of\\s+(?:your\\s+)?(\\d+)\\s*(swings|pitches)?\\b`,
  'gi',
)
function checkStatedTotal(text) {
  const findings = []
  for (const m of text.matchAll(COUNT_OF_TOTAL_RE)) {
    const countVal = toNum(m[1])
    const totalVal = parseInt(m[2], 10)
    if (totalVal !== 15) {
      findings.push({ quoted: m[0].trim(), reason: `stated total is ${totalVal}, not 15`, countVal, totalVal })
    } else if (countVal != null && countVal > 15) {
      findings.push({ quoted: m[0].trim(), reason: `count ${countVal} exceeds 15`, countVal, totalVal })
    } else if (countVal != null && countVal > totalVal) {
      findings.push({ quoted: m[0].trim(), reason: `count ${countVal} exceeds stated total ${totalVal}`, countVal, totalVal })
    }
  }
  return findings
}

// ---------------------------------------------------------------------------
// CHECK 3: "<count> of your 15 swings ... swings a, b, c" - count vs list
// length, within the same sentence. Narrowly scoped to the "of ... 15"
// construction that the motivating example uses, so it doesn't overreach.
// ---------------------------------------------------------------------------
const COUNT_OF_15_RE = new RegExp(`\\b(${NUMTOK})\\s+of\\s+(?:your\\s+)?15\\b`, 'gi')
function checkCountVsList(text) {
  const findings = []
  const sentences = splitSentences(text)
  for (const sent of sentences) {
    const countMatches = [...sent.text.matchAll(COUNT_OF_15_RE)]
    if (!countMatches.length) continue
    const lists = extractSwingNumLists(sent.text).filter((l) => l.nums.length >= 2)
    if (!lists.length) continue
    for (const cm of countMatches) {
      const countVal = toNum(cm[1])
      // Compare against every actual enumerated list in the sentence; if any
      // list disagrees in length, flag it. (Usually there's exactly one.)
      for (const list of lists) {
        if (countVal !== list.nums.length) {
          findings.push({
            quoted: sent.text.trim(),
            reason: `states "${cm[0].trim()}" (count ${countVal}) but the list beside it has ${list.nums.length} numbers: [${list.nums.join(', ')}]`,
            countVal,
            listLen: list.nums.length,
          })
        }
      }
    }
  }
  return findings
}

// ---------------------------------------------------------------------------
// CHECK 4: misattributed per-swing values.
//
// 4a) Singular "swing N" (a list of exactly one number) followed shortly by
//     a value carrying a unit (mph / degrees / feet). Unambiguous because
//     there's exactly one swing named and the value sits right next to it.
// 4b) A swing LIST of length k followed shortly by a value LIST of the same
//     length k with a shared unit ("swings 4, 5, and 6 went 92, 91, and 88
//     mph"). Unambiguous because the prose asserts positional correspondence
//     explicitly (same count, same order, same clause).
//
// Anything else (values scattered near a list with no matching count, or a
// singular swing near multiple candidate values of the same unit) is left
// alone rather than guessed at.
// ---------------------------------------------------------------------------
const UNIT_ALT = 'mph|mile|°|deg(?:rees)?|ft|feet|foot'
const VALUE_UNIT_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})\\b`, 'gi')
const VALUE_LIST_RE = new RegExp(
  `((?:\\d+(?:\\.\\d+)?)(?:\\s*(?:,|and|&)\\s*\\d+(?:\\.\\d+)?)*)\\s*(${UNIT_ALT})\\b`,
  'gi',
)

function unitKey(u) {
  const s = u.toLowerCase()
  if (s.startsWith('mph') || s.startsWith('mile')) return 'mph'
  if (s.startsWith('deg') || s === '°') return 'degrees'
  if (s.startsWith('ft') || s.startsWith('feet') || s.startsWith('foot')) return 'feet'
  return null
}

function realValueFor(swing, key) {
  if (key === 'mph') return swing.hit.launch.exitSpeed
  if (key === 'degrees') return swing.hit.launch.angle // direction also uses degrees; angle checked first, direction checked separately below
  if (key === 'feet') return swing.hit.landing.distance
  return undefined
}

function checkMisattributedValues(text, swings) {
  const findings = []
  const lists = extractSwingNumLists(text)

  for (const list of lists) {
    const afterIdx = list.index + list.matchText.length
    const windowEnd = Math.min(text.length, afterIdx + 90)
    const window = text.slice(afterIdx, windowEnd)
    // Stop the window at the next sentence end so we don't reach into
    // unrelated prose.
    const stop = window.search(/[.!?]/)
    const clause = stop >= 0 ? window.slice(0, stop + 1) : window

    if (list.nums.length === 1) {
      // 4a: singular swing, look for value(s) with units nearby, but only
      // ones that are the immediate first number(s) in the clause (avoid
      // reaching past an unrelated intervening number).
      const n = list.nums[0]
      if (n < 1 || n > 15) continue // already flagged by check 1
      const swing = swings[n - 1]
      if (!swing) continue

      for (const vm of clause.matchAll(VALUE_UNIT_RE)) {
        // Skip a number that is a THRESHOLD, not an asserted actual value:
        // "swing 12 had a launch angle below 15 degrees" never claims swing
        // 12's angle IS 15, only that it is under it. Found by testing:
        // without this guard, "below 15 degrees" was read as a claim that
        // swing 12's real angle was 15 and flagged as a false mismatch.
        const preceding = clause.slice(Math.max(0, vm.index - 20), vm.index)
        if (/(below|under|over|above|at least|less than|more than)\s*$/i.test(preceding)) continue

        const val = Number(vm[1])
        const key = unitKey(vm[2])
        if (!key) continue
        let real = realValueFor(swing, key)
        let matched = real === val
        // degrees is ambiguous between launch angle and direction; accept
        // either as "real" before calling it a mismatch.
        if (!matched && key === 'degrees') {
          matched = swing.hit.launch.direction === val || Math.abs(swing.hit.launch.direction) === val
        }
        if (!matched) {
          findings.push({
            quoted: `swing ${n}${clause ? ' ' + clause.trim() : ''}`.trim(),
            swingNum: n,
            claimedValue: val,
            claimedUnit: key,
            real: { ev: swing.hit.launch.exitSpeed, angle: swing.hit.launch.angle, direction: swing.hit.launch.direction, distance: swing.hit.landing.distance },
            kind: 'singular',
          })
        }
      }
    } else {
      // 4b: list of k swings, look for a value list of the same length k
      // with a shared unit, appearing as the first value-list in the clause.
      const vlm = [...clause.matchAll(VALUE_LIST_RE)][0]
      if (!vlm) continue
      const valToks = vlm[1].split(/\s*(?:,|and|&)\s*/).filter(Boolean).map(Number)
      const key = unitKey(vlm[2])
      if (!key || valToks.length !== list.nums.length) continue

      list.nums.forEach((n, i) => {
        if (n < 1 || n > 15) return
        const swing = swings[n - 1]
        if (!swing) return
        const val = valToks[i]
        let real = realValueFor(swing, key)
        let matched = real === val
        if (!matched && key === 'degrees') {
          matched = swing.hit.launch.direction === val
        }
        if (!matched) {
          findings.push({
            quoted: `${list.matchText.trim()} ... ${vlm[0].trim()}`,
            swingNum: n,
            claimedValue: val,
            claimedUnit: key,
            real: { ev: swing.hit.launch.exitSpeed, angle: swing.hit.launch.angle, direction: swing.hit.launch.direction, distance: swing.hit.landing.distance },
            kind: `list-position-${i + 1}-of-${list.nums.length}`,
          })
        }
      })
    }
  }
  return findings
}

// ---------------------------------------------------------------------------
// CHECK 5: threshold counts as CANDIDATES, not verdicts.
// "N swings under X" / "N of those were also under X" patterns.
// Whole-session phrasing is computed directly against the real session.
// "of those" phrasing tries to resolve the antecedent set from an earlier
// enumerated list in the same sentence (or the immediately preceding
// sentence), and reports both readings without calling a verdict.
// ---------------------------------------------------------------------------
const THRESHOLD_RE = new RegExp(
  `\\b(${NUMTOK})\\s+(?:of\\s+(?:those|which|them)\\s+)?(?:swings?\\s+)?(?:came\\s+in\\s+|were\\s+|was\\s+|hit\\s+)?(?:also\\s+)?(under|below|less than|over|above|more than|at least)\\s+(\\d+(?:\\.\\d+)?)\\s*(mph|degrees?|°|ft|feet)?\\b`,
  'gi',
)

function realCountUnderThreshold(swings, dir, threshold, unitKeyHint) {
  // Try EV (mph) first if hinted or no unit given but context is mph-like;
  // otherwise degrees; otherwise feet. Since unit is often omitted in the
  // "N swings under 80 mph" phrasing this handles both explicit-unit and
  // trailing-unit cases; caller passes the resolved unit.
  const cmp = (v) => {
    if (dir === 'under' || dir === 'below' || dir === 'less than') return v < threshold
    if (dir === 'over' || dir === 'above' || dir === 'more than') return v > threshold
    if (dir === 'at least') return v >= threshold
    return null
  }
  const key = unitKeyHint
  return swings.filter((sw) => {
    let v
    if (key === 'mph') v = sw.hit.launch.exitSpeed
    else if (key === 'degrees') v = sw.hit.launch.angle
    else if (key === 'feet') v = sw.hit.landing.distance
    else return false
    return cmp(v)
  }).length
}

function checkThresholdCandidates(text, swings) {
  const candidates = []
  const sentences = splitSentences(text)
  for (const sent of sentences) {
    for (const m of sent.text.matchAll(THRESHOLD_RE)) {
      const countVal = toNum(m[1])
      const dir = m[2].toLowerCase()
      const threshold = Number(m[3])
      let unit = m[4] ? unitKey(m[4]) : null
      // If no explicit unit in this match, guess from context: mph if
      // threshold looks like an exit velocity range, degrees if small and
      // "degree"/"angle" appears nearby in the sentence, feet if large.
      if (!unit) {
        if (/degrees?|°|angle/i.test(sent.text)) unit = 'degrees'
        else if (threshold >= 40 && threshold <= 120) unit = 'mph'
        else if (threshold > 120) unit = 'feet'
      }
      if (!unit || countVal == null) continue

      const isOfThose = /of\s+(those|which|them)/i.test(m[0])

      const wholeSessionCount = realCountUnderThreshold(swings, dir, threshold, unit)

      let subsetInfo = null
      if (isOfThose) {
        // Try to find an enumerated list earlier in the sentence (or the
        // immediately preceding sentence) to serve as "those".
        const priorText = sent.text.slice(0, m.index)
        let lists = extractSwingNumLists(priorText).filter((l) => l.nums.length >= 2)
        let source = 'same sentence, before the phrase'
        if (!lists.length) {
          const idx = sentences.indexOf(sent)
          if (idx > 0) {
            lists = extractSwingNumLists(sentences[idx - 1].text).filter((l) => l.nums.length >= 2)
            source = 'preceding sentence'
          }
        }
        if (lists.length) {
          const antecedent = lists[lists.length - 1].nums
          const subsetSwings = antecedent.filter((n) => n >= 1 && n <= 15).map((n) => swings[n - 1])
          const subsetCount = realCountUnderThreshold(subsetSwings, dir, threshold, unit)
          subsetInfo = { antecedent, subsetCount, source }
        }
      }

      candidates.push({
        quoted: m[0].trim(),
        sentence: sent.text.trim(),
        countVal,
        dir,
        threshold,
        unit,
        isOfThose,
        wholeSessionReading: wholeSessionCount,
        subsetReading: subsetInfo,
      })
    }
  }
  return candidates
}

// ---------------------------------------------------------------------------
// Run all checks over every record
// ---------------------------------------------------------------------------
const FIELD_NAMES = ['coachingSummary', 'whatThisMeans', 'tipsIntro', 'tip1', 'tip2']

const results = []
for (const r of all) {
  if (r.failed || !r.fields) continue
  const swings = viewingSessionSwings(r.cell)
  const perField = {}
  for (const fname of FIELD_NAMES) {
    const text = r.fields[fname]
    if (typeof text !== 'string' || !text) continue
    perField[fname] = {
      impossible: checkImpossibleSwingNumbers(text),
      statedTotal: checkStatedTotal(text),
      countVsList: checkCountVsList(text),
      misattributed: checkMisattributedValues(text, swings),
      thresholdCandidates: checkThresholdCandidates(text, swings),
    }
  }
  results.push({ conditionKey: r.conditionKey, cell: r.cell, run: r.run, perField })
}

writeFileSync(`${SCRATCH}/regrade-results.json`, JSON.stringify(results, null, 2))
console.log(`Wrote ${results.length} regraded records to regrade-results.json`)

// ---------------------------------------------------------------------------
// Summarize: per condition, per check, how many of the 24 runs had >=1 hit
// ---------------------------------------------------------------------------
const CONDITIONS = ['baseline', 'A', 'B', 'C']
const CHECKS = ['impossible', 'statedTotal', 'countVsList', 'misattributed']

function runHasHit(record, check) {
  return Object.values(record.perField).some((f) => f[check] && f[check].length > 0)
}
function runHasThresholdCandidate(record) {
  return Object.values(record.perField).some((f) => f.thresholdCandidates && f.thresholdCandidates.length > 0)
}

console.log('')
console.log('condition   n   impossible   statedTotal   countVsList   misattributed   thresholdCandidates')
for (const c of CONDITIONS) {
  const rows = results.filter((r) => r.conditionKey === c)
  const n = rows.length
  const counts = CHECKS.map((chk) => rows.filter((r) => runHasHit(r, chk)).length)
  const thresh = rows.filter(runHasThresholdCandidate).length
  console.log(`${c.padEnd(11)} ${String(n).padStart(2)}   ${counts.map((x) => String(x).padStart(10)).join('   ')}   ${String(thresh).padStart(19)}`)
}
