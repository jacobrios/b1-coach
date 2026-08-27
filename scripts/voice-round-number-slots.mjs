// Slice 15, the voice round. NOT a measurement, and deliberately not graded.
//
// The correctness half of this slice needs no live round: the app owning a
// digit is provable by test. The voice half cannot be tested at all, so this
// buys the only evidence that answers it, which is the product manager reading
// real prose. Same cells, same seed, same swing data, one prompt generation
// apart, written out as pairs he can read straight down.
//
// The grading tool is deliberately not involved. Its false-positive rate across
// ten rounds is 11% to 64% and it cannot see voice, which is the only question
// being asked here.
//
// Run: node --env-file=.env.local scripts/voice-round-number-slots.mjs

import { register } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const HOOK = `
  export async function resolve(specifier, context, nextResolve) {
    try { return await nextResolve(specifier, context) } catch (err) {
      const bare = specifier.startsWith('.') && !/\\.[a-zA-Z0-9]+$/.test(specifier)
      if (err && err.code === 'ERR_MODULE_NOT_FOUND' && bare) return await nextResolve(specifier + '.js', context)
      throw err } }`
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url)

const {
  DEBRIEF_SYSTEM, DEBRIEF_SYSTEM_BASE, DEBRIEF_BUDGET,
  MODEL, MAX_TOKENS, buildDebriefUserMessage, parseCoachResponse,
} = await import('../src/coachApi.js')
const { fillDebriefNumbers } = await import('../src/numberSlots.js')
const { generateSwings } = await import('../src/swingGenerator.js')
const { computeStats } = await import('../src/sessionStats.js')
const { SESSION_ONE_SWINGS } = await import('../src/sessionOneSwings.js')

// BEFORE is the prompt as it stood at the close of Slice 14, rebuilt from its
// own two exported pieces rather than copied, so it cannot drift from what
// actually shipped. AFTER is the shipped constant as this slice leaves it.
const BEFORE_SYSTEM = `${DEBRIEF_SYSTEM_BASE}\n\n${DEBRIEF_BUDGET}`
const AFTER_SYSTEM = DEBRIEF_SYSTEM

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = SESSION_ONE_SWINGS
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

const CELLS = [
  { key: 'power-s1', goal: { id: 'power', label: 'Power & Distance' }, session: 1 },
  { key: 'contact-s1', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 1 },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4 },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4 },
]

const RUNS = 3
const SEED = 20260814
const MAX_PLANNED_CALLS = 30

async function call({ system, userMessage, apiKey }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: userMessage }] }),
  })
  if (!res.ok) throw new Error(`Anthropic returned ${res.status} ${res.statusText}`)
  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error(`No text content. stop_reason=${data?.stop_reason ?? 'unknown'}`)
  return parseCoachResponse(text)
}

const planned = CELLS.length * RUNS * 2
if (planned > MAX_PLANNED_CALLS) {
  console.error(`Refusing: ${planned} planned calls is over the cap of ${MAX_PLANNED_CALLS}.`)
  process.exit(1)
}
const apiKey = process.env.VITE_ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('No VITE_ANTHROPIC_API_KEY. Run with: node --env-file=.env.local scripts/voice-round-number-slots.mjs')
  process.exit(1)
}

console.log(`Voice round: ${planned} live calls (${CELLS.length} cells x ${RUNS} runs x 2 conditions), seed ${SEED}.\n`)

const pairs = []
for (const cell of CELLS) {
  const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: SEED })
  const userMessage = buildDebriefUserMessage({
    goal: cell.goal, player: { firstName: 'Bill' }, sessions, viewingSessionNumber: cell.session,
  })
  for (let run = 1; run <= RUNS; run++) {
    try {
      const before = await call({ system: BEFORE_SYSTEM, userMessage, apiKey })
      const afterRaw = await call({ system: AFTER_SYSTEM, userMessage, apiKey })
      const after = fillDebriefNumbers(afterRaw, sessions)
      pairs.push({ cell: cell.key, run, before, afterRaw, after })
      console.log(`  ${cell.key}/run${run}: ok`)
    } catch (err) {
      console.log(`  ${cell.key}/run${run}: FAILED - ${err.message}`)
      pairs.push({ cell: cell.key, run, failed: err.message })
    }
  }
}

const outDir = path.join(process.cwd(), 'docs/eval-fixtures/slice15-number-slots/voice-round')
mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'pairs.json'), JSON.stringify({ meta: { seed: SEED, model: MODEL, runs: RUNS }, pairs }, null, 2))

// The readable artefact. Labels are deliberately neutral: "A" and "B" rather
// than "before" and "after", so the read is not primed by knowing which is the
// new one. The key is at the bottom of the file.
const lines = ['# Slice 15 voice round: can you tell which is which?', '',
  'Twelve pairs. Same hitter, same swings, same seed. One of each pair was written',
  'by the coach as it ships today; the other had its per-swing numbers written by',
  'the app. **Read for voice, not for accuracy.** The question is only whether one',
  'of them sounds less like a person than the other.', '',
  'Which letter is which is at the very bottom, so you can read first and check after.', '']

const flip = (i) => i % 2 === 0
for (const [i, p] of pairs.entries()) {
  if (p.failed) { lines.push(`## ${p.cell} run ${p.run}`, '', `_call failed: ${p.failed}_`, ''); continue }
  const A = flip(i) ? p.before : p.after
  const B = flip(i) ? p.after : p.before
  const render = (d) => [
    `**Summary.** ${d.coachingSummary}`, '',
    `**What this means.** ${d.whatThisMeans}`, '',
    `**Tips.** ${d.tipsIntro}`, '',
    ...(d.nextSessionTips ?? []).map((t, n) => `${n + 1}. ${t}`),
  ]
  lines.push(`## ${p.cell}, run ${p.run}`, '', '### A', '', ...render(A), '', '### B', '', ...render(B), '', '---', '')
}
lines.push('', '## Key', '')
for (const [i, p] of pairs.entries()) {
  if (p.failed) continue
  lines.push(`- ${p.cell} run ${p.run}: **${flip(i) ? 'B' : 'A'}** is the new one (app writes the numbers).`)
}
writeFileSync(path.join(outDir, 'READ-THESE.md'), lines.join('\n'))

const okPairs = pairs.filter((p) => !p.failed)
const slotUse = okPairs.filter((p) => /\{\{/.test(JSON.stringify(p.afterRaw))).length
console.log(`\nPairs written: ${okPairs.length} of ${pairs.length}`)
console.log(`Pairs where the new condition actually used placeholders: ${slotUse} of ${okPairs.length}`)
console.log(`Read them at docs/eval-fixtures/slice15-number-slots/voice-round/READ-THESE.md`)
