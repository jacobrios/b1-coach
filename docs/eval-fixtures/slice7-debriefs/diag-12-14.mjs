// Focused diagnostic: how often does each condition attempt the "swings 12
// and 14, both at X and Y degrees" claim (the dominant transposition
// pattern found by the main regrade script), and how often does it get the
// order right vs backwards vs something else? This gives a real error RATE
// (errors / attempts) rather than a raw count out of 24, since not every
// debrief makes this specific claim.
import { readFileSync } from 'node:fs'
import { viewingSessionSwings } from './rebuild.mjs'

const SCRATCH = '/private/tmp/claude-501/-Users-rivers-m1-air-code-b1-coach/fb362653-aacd-4422-ab4a-e0a67a1673de/scratchpad'
const baseline = JSON.parse(readFileSync(`${SCRATCH}/baseline-records.json`, 'utf8'))
const budget = JSON.parse(readFileSync(`${SCRATCH}/budget-records.json`, 'utf8'))
const all = [...baseline, ...budget]

const LIST_12_14 = /\bswings?\s*(12|14)\s*(?:,|and)\s*(12|14)\b/gi
const DEGREE_PAIR = /(\d+)\s*(?:,|and)\s*(\d+)\s*degrees?\b/i

const byCond = {}
for (const r of all) {
  if (r.cell !== 'open-s4' || !r.fields) continue
  const swings = viewingSessionSwings(r.cell)
  const realAngle = { 12: swings[11].hit.launch.angle, 14: swings[13].hit.launch.angle }

  for (const [fname, text] of Object.entries(r.fields)) {
    if (typeof text !== 'string') continue
    for (const m of text.matchAll(LIST_12_14)) {
      const [a, b] = [m[1], m[2]]
      if (new Set([a, b]).size !== 2) continue // require both 12 and 14 present
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 90)
      const dm = after.match(DEGREE_PAIR)
      byCond[r.conditionKey] = byCond[r.conditionKey] || { attempts: 0, correct: 0, reversed: 0, other: [] }
      byCond[r.conditionKey].attempts++
      if (!dm) {
        byCond[r.conditionKey].other.push({ run: r.run, fname, note: 'no degree pair found nearby', quoted: m[0] + ' ' + after.slice(0, 40) })
        continue
      }
      const stated = { [a]: Number(dm[1]), [b]: Number(dm[2]) }
      const isCorrect = stated[12] === realAngle[12] && stated[14] === realAngle[14]
      const isReversed = stated[12] === realAngle[14] && stated[14] === realAngle[12]
      if (isCorrect) byCond[r.conditionKey].correct++
      else if (isReversed) byCond[r.conditionKey].reversed++
      else byCond[r.conditionKey].other.push({ run: r.run, fname, stated, realAngle, quoted: m[0] + ' ' + dm[0] })
    }
  }
}

for (const [cond, d] of Object.entries(byCond)) {
  console.log(`${cond}: attempts=${d.attempts} correct=${d.correct} reversed=${d.reversed} other=${d.other.length}`)
  if (d.other.length) console.log('  other:', JSON.stringify(d.other))
}
