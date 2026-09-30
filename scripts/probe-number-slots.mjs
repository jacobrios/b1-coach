// Slice 15, Task 0. THE KILL SWITCH, and it is meant to be cheap.
//
// The question: if we tell the coach to write a placeholder instead of a
// number, does it actually do it? Everything else about this slice is
// downstream of that. This project's own record says a prompt instruction is
// persuasion rather than a guarantee: "be brief" failed twice before the word
// budget existed, and the 50-word tip ceiling is STILL not obeyed today at a
// measured 67 to 82 words. So adoption is an open empirical question, not a
// detail.
//
// What this deliberately does NOT do: fill anything in, touch any shipped
// file, or measure accuracy. It appends an instruction to the real shipped
// prompt at runtime and counts what comes back. If adoption is poor the branch
// is abandoned having spent about $0.30.
//
// Run:  node --env-file=.env.local scripts/probe-number-slots.mjs
//       node scripts/probe-number-slots.mjs --dry-run     (free, no network)

import { register } from 'node:module'
import { performance } from 'node:perf_hooks'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// The same loader wrinkle scripts/bench-coach-brevity.mjs documents at length,
// solved the same way on purpose rather than a second way: files under src/
// import their neighbours without a file extension, which plain `node` refuses.
const EXTENSIONLESS_RESOLVE_HOOK = `
  export async function resolve(specifier, context, nextResolve) {
    try {
      return await nextResolve(specifier, context)
    } catch (err) {
      const looksExtensionless = specifier.startsWith('.') && !/\\.[a-zA-Z0-9]+$/.test(specifier)
      if (err && err.code === 'ERR_MODULE_NOT_FOUND' && looksExtensionless) {
        return await nextResolve(specifier + '.js', context)
      }
      throw err
    }
  }
`
register('data:text/javascript,' + encodeURIComponent(EXTENSIONLESS_RESOLVE_HOOK), import.meta.url)

const {
  DEBRIEF_SYSTEM,
  MODEL,
  MAX_TOKENS,
  buildDebriefUserMessage,
  parseCoachResponse,
} = await import('../src/coachApi.js')
const { generateSwings } = await import('../src/swingGenerator.js')
const { computeStats } = await import('../src/sessionStats.js')
const { SESSION_ONE_SWINGS } = await import('../src/sessionOneSwings.js')
// The counting moved to its own tested module; see scripts/slotAdoption.js.
const { analyseDebrief, adoptionPercent } = await import('./slotAdoption.js')

// ─────────────────────────────────────────────────────────────────────────────
// The instruction being probed
// ─────────────────────────────────────────────────────────────────────────────

// EXPERIMENTAL WORDING, NOT APPROVED AND NOT SHIPPING. Prompt wording that
// ships needs the product manager's sign-off word for word; this never reaches
// a visitor, it exists to answer "will the coach cooperate at all."
//
// One marker holds one value and names its own session and swing. That is
// deliberate rather than terse-for-its-own-sake: a pair syntax would have to
// decide an order, and getting a pair's order wrong is the single most common
// transcription error this slice exists to remove. If each marker carries its
// own swing number, a transposition has nowhere to happen.
const SLOT_FIELDS = {
  ev: 'exit velocity in mph',
  la: 'launch angle in degrees',
  dir: 'spray direction in degrees',
  dist: 'distance in feet',
  ht: 'pitch height in feet',
  side: 'pitch side in feet',
}

const SLOT_INSTRUCTION = `WRITING A SPECIFIC SWING'S NUMBERS.
When you state one of these six values for a swing you have named, do not type
the number. Write a placeholder and the system will fill in the exact figure
before the player sees it.

{{s<session>.sw<swing>.ev}}    ${SLOT_FIELDS.ev}
{{s<session>.sw<swing>.la}}    ${SLOT_FIELDS.la}
{{s<session>.sw<swing>.dir}}   ${SLOT_FIELDS.dir}
{{s<session>.sw<swing>.dist}}  ${SLOT_FIELDS.dist}
{{s<session>.sw<swing>.ht}}    ${SLOT_FIELDS.ht}
{{s<session>.sw<swing>.side}}  ${SLOT_FIELDS.side}

Example: "Swings 4 and 5 came off at {{s4.sw4.ev}} and {{s4.sw5.ev}} mph."

Always name the session the swing belongs to. Use a placeholder every single
time you give one of those six values for a named swing, including inside the
tips. A placeholder counts as one word against your length budget.

Every other number you still write yourself, exactly as you do now: counts,
averages, session totals, targets, thresholds, and any number you work out.`

const PROBE_SYSTEM = `${DEBRIEF_SYSTEM}\n\n${SLOT_INSTRUCTION}`

// ─────────────────────────────────────────────────────────────────────────────
// Sessions, built exactly the way the bench builds them
// ─────────────────────────────────────────────────────────────────────────────

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
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

// Goal labels are hand-copied for the same already-disclosed reason the bench
// hand-copies them: src/App.jsx holds the real GOALS array and has JSX in it,
// which a plain Node script cannot load.
const CELLS = [
  { key: 'power-s1', goal: { id: 'power', label: 'Power & Distance' }, session: 1 },
  { key: 'contact-s1', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 1 },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4 },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4 },
]

// Two session-1 cells and two session-4 cells on purpose. Session 1 has no
// prior session, so a marker cannot get the session wrong; session 4 carries
// three priors in the prompt, which is where naming the wrong session becomes
// possible. If adoption differs between them, that is worth knowing before
// designing anything.

// ─────────────────────────────────────────────────────────────────────────────
// What gets counted
// ─────────────────────────────────────────────────────────────────────────────
//
// Placeholders and bare recitals are counted by scripts/slotAdoption.js, moved
// out of this file unchanged so the count could be tested and reused. The
// limits of the bare-recital proxy are printed with the results below.

// ─────────────────────────────────────────────────────────────────────────────
// Running
// ─────────────────────────────────────────────────────────────────────────────

async function callCoach({ system, userMessage, apiKey }) {
  const startedAt = performance.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const elapsedMs = performance.now() - startedAt
  // Deliberately does not echo the body: an auth failure can carry the key
  // fragment back, and this output gets pasted around.
  if (!res.ok) throw new Error(`Anthropic returned ${res.status} ${res.statusText}`)
  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error(`No text content. stop_reason=${data?.stop_reason ?? 'unknown'}`)
  return { text, elapsedMs, usage: data.usage ?? {}, stopReason: data?.stop_reason ?? null }
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const runsArg = args.indexOf('--runs')
const RUNS = runsArg >= 0 ? Number(args[runsArg + 1]) : 4
const SEED = 20260814
const MAX_PLANNED_CALLS = 24

const planned = CELLS.length * RUNS
if (planned > MAX_PLANNED_CALLS) {
  console.error(`Refusing: ${planned} planned calls is over this probe's cap of ${MAX_PLANNED_CALLS}.`)
  console.error('This is a kill-switch probe, not a measurement round. Use the bench for those.')
  process.exit(1)
}

const apiKey = process.env.VITE_ANTHROPIC_API_KEY
if (!dryRun && !apiKey) {
  console.error('No VITE_ANTHROPIC_API_KEY in the environment.')
  console.error('Run with: node --env-file=.env.local scripts/probe-number-slots.mjs')
  process.exit(1)
}

// A canned reply for the free path: half placeholders, half bare numbers, so
// both counters are exercised before any money is spent.
const DRY_REPLY = JSON.stringify({
  coachingSummary: 'Swings 4 and 5 came off at {{s4.sw4.ev}} and {{s4.sw5.ev}} mph.',
  whatThisMeans: 'Swing 2 went 72 mph, which is soft.',
  tipsIntro: 'Two things.',
  nextSessionTips: ['Swing 9 at {{s4.sw9.la}} degrees is the shape you want.'],
  charts: ['scatter_ev_la', 'trend_ev'],
})

console.log(`Probe: will the coach write placeholders instead of numbers?`)
console.log(`Mode: ${dryRun ? 'DRY RUN (no network, no spend)' : 'LIVE'}`)
console.log(`Cells: ${CELLS.map((c) => c.key).join(', ')}   Runs per cell: ${RUNS}   Planned calls: ${dryRun ? 0 : planned}`)
console.log(`Seed: ${SEED}   Model: ${MODEL}\n`)

const records = []
let parseFailures = 0
let callFailures = 0

for (const cell of CELLS) {
  const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: SEED })
  const userMessage = buildDebriefUserMessage({
    goal: cell.goal,
    player: { firstName: 'Jake' },
    sessions,
    viewingSessionNumber: cell.session,
  })

  for (let run = 1; run <= RUNS; run++) {
    let text
    try {
      if (dryRun) {
        text = DRY_REPLY
      } else {
        const out = await callCoach({ system: PROBE_SYSTEM, userMessage, apiKey })
        text = out.text
      }
    } catch (err) {
      callFailures++
      console.log(`  ${cell.key}/run${run}: CALL FAILED - ${err.message}`)
      records.push({ cell: cell.key, run, callFailed: true, error: err.message })
      continue
    }

    let parsed
    try {
      parsed = parseCoachResponse(text)
    } catch (err) {
      parseFailures++
      console.log(`  ${cell.key}/run${run}: PARSE FAILED - ${err.message}`)
      records.push({ cell: cell.key, run, parseFailed: true, error: err.message, raw: text })
      continue
    }

    const { markers, bareRecitals, texts } = analyseDebrief(parsed, sessions, cell.session)
    const resolvable = markers.filter((m) => m.resolvable).length
    const unresolvable = markers.length - resolvable
    records.push({
      cell: cell.key,
      run,
      markers: markers.length,
      resolvable,
      unresolvable,
      unresolvableDetail: markers.filter((m) => !m.resolvable).map((m) => ({ raw: m.raw, why: m.why })),
      bareRecitals: bareRecitals.length,
      bareRecitalDetail: bareRecitals,
      texts,
    })
    console.log(`  ${cell.key}/run${run}: ${markers.length} placeholders (${unresolvable} unresolvable), ${bareRecitals.length} bare recitals`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

const ok = records.filter((r) => !r.parseFailed && !r.callFailed)
const totalMarkers = ok.reduce((a, r) => a + r.markers, 0)
const totalResolvable = ok.reduce((a, r) => a + r.resolvable, 0)
const totalUnresolvable = ok.reduce((a, r) => a + r.unresolvable, 0)
const totalBare = ok.reduce((a, r) => a + r.bareRecitals, 0)
const adoption = adoptionPercent(totalResolvable, totalBare)

console.log('\n─────────────────────────────────────────────')
console.log('RESULT')
console.log('─────────────────────────────────────────────')
console.log(`Debriefs that came back and parsed: ${ok.length} of ${records.length}`)
console.log(`Parse failures: ${parseFailures}    Call failures: ${callFailures}`)
console.log(`Placeholders written: ${totalMarkers}  (resolvable ${totalResolvable}, unresolvable ${totalUnresolvable})`)
console.log(`Bare recitals (a number typed where a placeholder belonged): ${totalBare}`)
console.log(`ADOPTION: ${adoption === null ? 'n/a' : adoption.toFixed(1) + '%'} of per-swing values were written as a placeholder`)
console.log(`Debriefs with zero placeholders: ${ok.filter((r) => r.markers === 0).length} of ${ok.length}`)

console.log('\nBy cell:')
for (const cell of CELLS) {
  const rs = ok.filter((r) => r.cell === cell.key)
  const res = rs.reduce((a, r) => a + r.resolvable, 0)
  const bare = rs.reduce((a, r) => a + r.bareRecitals, 0)
  const d = res + bare
  console.log(`  ${cell.key.padEnd(12)} placeholders ${String(res).padStart(3)}  bare ${String(bare).padStart(3)}  adoption ${d === 0 ? 'n/a' : ((res / d) * 100).toFixed(0) + '%'}`)
}

console.log(`\nLIMITS OF THE BARE-RECITAL COUNTER, so nothing above is over-read.`)
console.log(`It is a proxy. It only sees a number in the same sentence as a swing`)
console.log(`reference, so a recital spread over two sentences is invisible to it,`)
console.log(`and a count that happens to equal one of that swing's six values is`)
console.log(`counted as a recital when it is not one. Treat the adoption figure as`)
console.log(`good to a few points, not exact.`)

if (!dryRun) {
  const outDir = path.join(process.cwd(), 'docs/eval-fixtures/slice15-number-slots/probe')
  mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'probe-records.json')
  writeFileSync(outFile, JSON.stringify({
    meta: { seed: SEED, model: MODEL, runs: RUNS, cells: CELLS.map((c) => c.key), instruction: SLOT_INSTRUCTION },
    records,
  }, null, 2))
  console.log(`\nRecords written to ${path.relative(process.cwd(), outFile)}`)
}
