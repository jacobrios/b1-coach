#!/usr/bin/env node
//
// The coach brevity bench: how much does B1 write, and does it still quote the
// player's real swings while doing it?
//
// Added in Slice 7, 14 August 2026. It is this project's first eval bench, and
// it exists because "be brief" had been tried twice as a prompt instruction and
// did not hold. Nothing noticed when it drifted, which is the actual defect:
// an unmeasured instruction is a wish. This bench is the measurement.
//
// It grades TWO things on every run, deliberately, and grading only the first
// is how this whole exercise goes wrong:
//
//   1. Did the coach stay inside its length budget?
//   2. Did it still cite real numbers from the session it was given?
//
// A coach that got short by going vague would score beautifully on (1) alone.
// The product manager's instruction was explicit: a shorter coach that stops
// quoting the player's actual swings is worse than the long one.
//
// HOW TO RUN
//
//   node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition baseline --runs 8
//
// The --env-file is how the Anthropic key reaches this script without ever
// being read into a terminal, a transcript, or this file. The key is used and
// never printed. `VITE_ANTHROPIC_API_KEY` is the same variable `npm run dev`
// uses (see vite.config.js); production's key has a different name and lives in
// Vercel, and neither is needed here.
//
// THIS SPENDS REAL MONEY. Every run is one live Anthropic call against the
// project's prepaid balance. The script prints its planned cost before it
// starts and its measured cost when it finishes, and refuses outright to plan
// more than MAX_PLANNED_CALLS in one go.
//
// WHY IT IS NOT A TEST, AND CANNOT BECOME ONE BY ACCIDENT
//
// It lives under scripts/ beside the two measurement scripts, outside the test
// runner's collection. Vitest has no config in this project, so its default
// glob takes only *.test.* / *.spec.* files; nothing here matches. That claim
// is checked by file count rather than asserted: `npm test` reported 11 files
// and 326 tests before this file existed and must report 11 and 326 after.
// The test suite must never call the model, and a bench that could be collected
// by the runner would break that rule the first time someone ran it in CI.
//
// WHY IT TALKS TO ANTHROPIC DIRECTLY
//
// api/coach.js is a Vercel serverless function and does not exist locally (see
// THE TRAP in CLAUDE.md). So this is the same shape `npm run dev` uses: the
// browser's Vite proxy also calls api.anthropic.com directly. What matters for
// fidelity is that the prompt, the model and the length ceiling are the real
// ones, and they are: DEBRIEF_SYSTEM, buildDebriefUserMessage, MODEL and
// MAX_TOKENS are all imported from src/coachApi.js rather than copied. The one
// piece of production this cannot exercise is the serverless function's own
// payload rebuild, which does not touch what the coach writes.

// THE SAME LOADER WRINKLE scripts/measure-swing-generation.mjs documents at
// length, solved the same way on purpose rather than a second way. Files under
// src/ import their neighbours without a file extension (`./goalTargets`), which
// Vite and vitest both resolve and plain `node` refuses with
// ERR_MODULE_NOT_FOUND. Adding extensions to shipped source for a script's
// convenience is not this slice's business, so this registers the same tiny
// inline hook: retry a failed extensionless relative import with `.js` on the
// end. It helps Node find the file and touches nothing else.
import { register } from 'node:module'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'

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
  MAX_TOKENS,
  MODEL,
  buildDebriefUserMessage,
  parseCoachResponse,
} = await import('../src/coachApi.js')
const { generateSwings } = await import('../src/swingGenerator.js')
const { computeStats, topExitVelocity } = await import('../src/sessionStats.js')
const { carryDistance, DISTANCE_BUCKETS } = await import('../src/ballFlight.js')
const { goalTarget, hasTarget } = await import('../src/goalTargets.js')

// A hard stop on how much one invocation can spend, not a budget. The realistic
// accident here is a typo in --runs, and the balance behind this key is what
// keeps the deployed demo alive.
const MAX_PLANNED_CALLS = 150

// Sonnet 4.6 list pricing, dollars per million tokens, for the cost line only.
// Nothing behaves differently if these drift; the printed estimate just gets
// less useful.
const USD_PER_M_INPUT = 3
const USD_PER_M_OUTPUT = 15

// ─────────────────────────────────────────────────────────────────────────────
// The sessions the coach is graded on
// ─────────────────────────────────────────────────────────────────────────────

// Seeded so every condition sees byte-identical session data. This is the whole
// reason the bench can compare budgets at all: if condition A and condition B
// were shown different hitters, a difference in output length would be a
// difference in the data, not in the instruction.
function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Session 1 in this app is not generated: it is fifteen swings typed out by hand
// in src/App.jsx. That file imports React and JSX, so a plain Node script cannot
// load it, and the two scripts beside this one solve that by keeping their own
// full copies. This bench deliberately does NOT add a sixth copy. It builds a
// stand-in instead, pinned to the two numbers that matter for everything
// downstream: the scripted session 1 averages 81.6 mph and 17.33 degrees, and
// those averages are all `generateSwings` reads off a baseline.
//
// What this costs, stated plainly rather than buried: the bench cannot grade the
// debrief a visitor sees on their FIRST click, because that debrief is built on
// the real hand-written swings and these are not them. Sessions 2 to 4 are the
// app's own generator output and are exact. Closing that gap means extracting
// those fifteen swings into a module of their own, which belongs to the slice
// that rewrites them, not to this one.
const SESSION_1_AVG_EV = 81.6
const SESSION_1_AVG_LA = 17.3333

// The stand-in is drawn with the same shared-contact-quality model the real
// generator uses, so it has a believable spread rather than fifteen identical
// swings, which would be a strange thing to hand a coach and would distort every
// session-4 debrief that includes it.
function standInSessionOne(random) {
  return Array.from({ length: 15 }, () => {
    const quality = random() - 0.5
    const evNoise = random() - 0.5
    const laNoise = random() - 0.5
    const ev = Math.round(Math.max(65, Math.min(97, SESSION_1_AVG_EV + (0.6 * quality + 0.8 * evNoise) * 16)))
    const la = Math.round(Math.max(-5, Math.min(35, SESSION_1_AVG_LA + (0.6 * quality + 0.8 * laNoise) * 22)))
    const dir = Math.round((random() - 0.45) * 70)
    const inZonePitch = random() < 0.7
    const plateLocHeight = inZonePitch ? 1.5 + random() * 2.0 : random() < 0.5 ? 0.5 + random() * 0.9 : 3.6 + random() * 0.5
    const plateLocSide = inZonePitch ? -0.7 + random() * 1.4 : random() < 0.5 ? -0.8 - random() * 0.3 : 0.8 + random() * 0.3
    return {
      plateLocHeight: Math.round(plateLocHeight * 100) / 100,
      plateLocSide: Math.round(plateLocSide * 100) / 100,
      hit: {
        launch: { exitSpeed: ev, angle: la, direction: dir },
        // The same curve every other swing in the app goes through, so a
        // distance the coach quotes here is one the app would really show.
        landing: { distance: carryDistance({ exitSpeed: ev, angle: la }) },
      },
    }
  })
}

// The app rebuilds every later session off session 1, not off the session before
// it (see the single generateSwings call in src/App.jsx), so this does the same.
function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = standInSessionOne(random)
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

// ─────────────────────────────────────────────────────────────────────────────
// What gets graded
// ─────────────────────────────────────────────────────────────────────────────

// Goal id and label only. The full GOALS array lives in src/App.jsx, which this
// script cannot import; only `label` is used in the prompt and only `id`
// anywhere else, so these two fields are the whole dependency. If a label is
// ever renamed in App.jsx it must be renamed here too, which is the price of
// not being able to import a JSX file.
const CELLS = [
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2, why: 'the goal most visitors pick, early session' },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4, why: 'largest session, three priors to compare against' },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4, why: 'no target, so the coach has the most latitude' },
]

// A condition is an instruction appended to the real system prompt, or nothing
// at all for the baseline. Budgets are word counts on purpose: the prompt
// already caps each tip at three sentences and the model already obeys that,
// writing longer sentences instead. Anything that counts sentences would report
// success while the panel overflowed.
//
// The three budgets are pitched at measured panel capacity, not at taste. On a
// 1440x790 window (the viewport a MacBook Air actually gives) the Session
// Summary box holds 154 words at today's 16px, 106 at 18px and 96 at 20px.
// Baseline output runs 78 to 181 words. So: A is sized to clear 18px, B to
// clear 20px with room, C to clear 20px on a smaller window too.
//
// Every instruction names the failure mode out loud, because the risk here is
// not that the coach writes too much, it is that it gets short by getting
// vague. A shorter coach that stops quoting the player's swings is worse than
// the long one, and the grader above is what checks that it didn't.
const budget = ({ summary, means, intro, tip }) => `LENGTH BUDGET. These are hard limits, not suggestions. Count words, not sentences.
- coachingSummary: ${summary} words maximum.
- whatThisMeans: ${means} words maximum.
- tipsIntro: ${intro} words maximum.
- each tip in nextSessionTips: ${tip} words maximum.

Stay inside the budget by cutting words, never by cutting specifics. Every number you were going to cite, still cite. Keep the three-part shape of each tip exactly as described above: an observation quoting real numbers from the session, then what it means in baseball terms, then one physical cue. Write shorter sentences rather than dropping one of the three parts. A vague tip that fits the budget is a failure, not a success.`

const CONDITIONS = {
  baseline: { label: 'baseline (today, no budget)', instruction: null },
  A: {
    label: 'A, light: box target 90 words',
    instruction: budget({ summary: 55, means: 35, intro: 15, tip: 60 }),
  },
  B: {
    label: 'B, medium: box target 75 words',
    instruction: budget({ summary: 45, means: 30, intro: 12, tip: 50 }),
  },
  C: {
    label: 'C, tight: box target 60 words',
    instruction: budget({ summary: 35, means: 25, intro: 10, tip: 40 }),
  },
}

const PLAYER = { firstName: 'Jake' }

// ─────────────────────────────────────────────────────────────────────────────
// The grader
// ─────────────────────────────────────────────────────────────────────────────

const words = (text) => {
  if (typeof text !== 'string') return 0
  return text
    .replace(/[*_`#>]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

// Every number the coach could legitimately quote from the data it was handed,
// grouped by the unit it would carry. Built from the sessions actually sent in
// the prompt, because the coach is free to reach back into an earlier one.
function sessionValueSets(sessions) {
  const mph = new Set()
  const degrees = new Set()
  const feet = new Set()
  const swingIndex = new Set()

  // Deliberately NOT collected: the session's various counts (swings in the
  // zone, swings under 15 degrees, balls per distance bucket). A count reaches
  // the page as a bare number with no unit, and the classifier below only
  // grades numbers that carry one, so a count set would be built and never
  // read. Bare numbers are set aside as ungradeable instead of being guessed at.
  for (const s of sessions) {
    mph.add(s.stats.avgExitVelocity)
    degrees.add(s.stats.avgLaunchAngle)
    const top = topExitVelocity(s.swings)
    if (top != null) mph.add(top)

    for (const [i, w] of s.swings.entries()) {
      mph.add(w.hit.launch.exitSpeed)
      degrees.add(w.hit.launch.angle)
      degrees.add(w.hit.launch.direction)
      feet.add(w.hit.landing.distance)
      swingIndex.add(i + 1)

      // Pitch height and side are also given to the coach in feet, and it does
      // quote them ("a pitch 2.7 feet high"). Leaving them out flagged real
      // citations as fabrications on the very first run of this bench. Both the
      // stored two-decimal value and its one-decimal rounding count, because a
      // coach saying "1.8 feet" about a 1.78-foot pitch is reading the data,
      // not inventing it.
      for (const v of [w.plateLocHeight, w.plateLocSide]) {
        if (v == null) continue
        feet.add(v)
        feet.add(Math.round(v * 10) / 10)
        feet.add(Math.abs(v))
        feet.add(Math.round(Math.abs(v) * 10) / 10)
      }
    }

  }

  // The strike zone bounds are handed to the coach in the prompt itself
  // ("height 1.5-3.5ft, side -0.7 to 0.7ft"), and it quotes them. They are data
  // it was given, not numbers it invented.
  for (const v of [1.5, 3.5, 0.7]) feet.add(v)

  // Bucket edges appear in the prompt's distance line, so a coach naming one is
  // reading the data rather than inventing it.
  for (const b of DISTANCE_BUCKETS) {
    if (Number.isFinite(b.min)) feet.add(b.min)
    if (Number.isFinite(b.max)) feet.add(b.max)
  }

  return { mph, degrees, feet, swingIndex }
}

// The goal's own target numbers. Quoting these is perfectly legitimate coaching,
// but it is NOT evidence the coach looked at the player's swings, so it is
// counted separately. Conflating the two would let a coach score full marks for
// reciting its own instructions back.
function goalTargetSet(goalId) {
  const set = new Set()
  if (!hasTarget(goalId)) return set
  const t = goalTarget(goalId)
  if (t?.launchAngle) {
    set.add(t.launchAngle.min)
    set.add(t.launchAngle.max)
  }
  if (t?.exitVelocity != null) set.add(t.exitVelocity)
  return set
}

const NUMBER_WITH_CONTEXT = /(\d+(?:\.\d+)?)([^\d]{0,14})/g

// Classify every number the coach wrote. A number only counts as a claim about
// the session if it carries a unit; bare numbers ("two of those", "the first
// three") are real language but not gradeable this way, so they are set aside
// rather than counted against anyone.
function classifyNumbers(text, values, targets) {
  const result = { grounded: 0, target: 0, unmatched: 0, ungradeable: 0, unmatchedExamples: [] }
  if (typeof text !== 'string') return result

  for (const match of text.matchAll(NUMBER_WITH_CONTEXT)) {
    const n = Number(match[1])
    const after = match[2].toLowerCase()
    const before = text.slice(Math.max(0, match.index - 14), match.index).toLowerCase()

    let set = null
    if (/^\s*(mph|mile)/.test(after)) set = values.mph
    else if (/^\s*(°|deg)/.test(after)) set = values.degrees
    else if (/^\s*(ft|feet|foot)/.test(after)) set = values.feet
    else if (/swing\s*#?\s*$/.test(before)) set = values.swingIndex

    if (!set) {
      result.ungradeable++
      continue
    }
    if (set.has(n)) result.grounded++
    else if (targets.has(n)) result.target++
    else {
      result.unmatched++
      if (result.unmatchedExamples.length < 3) {
        result.unmatchedExamples.push(`${match[1]}${match[2].trimEnd()}`)
      }
    }
  }
  return result
}

const firstSentence = (text) =>
  typeof text === 'string' ? text.split(/(?<=[.!?])\s+/)[0] ?? '' : ''

function grade(parsed, values, targets) {
  const tips = Array.isArray(parsed?.nextSessionTips) ? parsed.nextSessionTips : []
  const fields = {
    coachingSummary: parsed?.coachingSummary,
    whatThisMeans: parsed?.whatThisMeans,
    tipsIntro: parsed?.tipsIntro,
    tip1: tips[0],
    tip2: tips[1],
  }

  const wordCounts = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, words(v)]),
  )
  // The only number the font size actually depends on: the fixed-height Session
  // Summary panel holds these two fields and nothing else. The tips render in
  // the chat panel, which scrolls.
  wordCounts.box = wordCounts.coachingSummary + wordCounts.whatThisMeans

  const all = Object.values(fields).filter((v) => typeof v === 'string').join('\n')
  const numbers = classifyNumbers(all, values, targets)

  // The load-bearing half of the tip structure the product manager asked to
  // keep: sentence one is meant to be an observation citing real numbers.
  const tipLeadsCite = tips.map(
    (t) => classifyNumbers(firstSentence(t), values, targets).grounded > 0,
  )

  return { wordCounts, numbers, tipLeadsCite, tipCount: tips.length, fields }
}

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

  if (!res.ok) {
    // Deliberately does not echo the body: an auth failure can carry the key
    // fragment back, and this output gets pasted around.
    throw new Error(`Anthropic returned ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('No text content in the response')

  return {
    parsed: parseCoachResponse(text),
    elapsedMs,
    usage: data.usage ?? {},
  }
}

const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const percentile = (xs, p) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10)

function parseArgs(argv) {
  const args = { condition: 'baseline', runs: 8, seed: 20260814, out: null, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--dry-run') {
      args.dryRun = true
      continue
    }
    const value = argv[i + 1]
    i += 1
    if (flag === '--condition') args.condition = value
    else if (flag === '--runs') args.runs = Number(value)
    else if (flag === '--seed') args.seed = Number(value)
    else if (flag === '--out') args.out = value
    else throw new Error(`Unknown flag: ${flag}`)
  }
  return args
}

// Everything a real run does except spend money: build the sessions, build the
// value sets, build the prompt, and push a canned reply through the grader.
//
// This exists because a typo in the grader once killed a 72-call run on its
// first line. That one cost nothing, because it happened to throw before the
// first call rather than after the fortieth. Run this before any run that
// matters.
function dryRun(conditionKeys) {
  console.log('DRY RUN. No API calls, no spend. Exercising every path but the network.')
  console.log('')
  const canned = {
    coachingSummary: 'You hit 92 mph and got it out to 305 feet on swing 4.',
    whatThisMeans: 'That is real bat speed at 27 degrees, right where you want it.',
    tipsIntro: 'Two things before next round.',
    nextSessionTips: [
      'Swing 12 came off at 80 mph and 191 feet. You got on top of it. Stay back a half beat longer.',
      'Your best three were 92, 91 and 88 mph. That is your ceiling showing up. Let the hips lead.',
    ],
    charts: ['scatter_ev_la', 'bar_distance'],
  }

  for (const conditionKey of conditionKeys) {
    const condition = CONDITIONS[conditionKey]
    const system = condition.instruction ? `${DEBRIEF_SYSTEM}\n\n${condition.instruction}` : DEBRIEF_SYSTEM
    for (const cell of CELLS) {
      const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: 20260814 })
      const values = sessionValueSets(sessions)
      const targets = goalTargetSet(cell.goal.id)
      const userMessage = buildDebriefUserMessage({
        goal: cell.goal,
        player: PLAYER,
        sessions,
        viewingSessionNumber: cell.session,
      })
      const graded = grade(canned, values, targets)
      console.log(
        `  ${conditionKey.padEnd(9)} ${cell.key.padEnd(12)} ` +
        `system ${String(system.length).padStart(5)} chars, prompt ${String(userMessage.length).padStart(5)} chars, ` +
        `grader ok (box ${graded.wordCounts.box}w, ${graded.numbers.grounded} grounded, ` +
        `${graded.numbers.unmatched} unmatched)`,
      )
    }
  }
  console.log('')
  console.log('Every path exercised. Drop --dry-run to spend money.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const conditionKeysForDryRun = args.condition === 'all' ? Object.keys(CONDITIONS) : args.condition.split(',')
  for (const key of conditionKeysForDryRun) {
    if (!CONDITIONS[key]) throw new Error(`Unknown condition: ${key}. Known: ${Object.keys(CONDITIONS).join(', ')}`)
  }
  if (args.dryRun) {
    dryRun(conditionKeysForDryRun)
    return
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('No VITE_ANTHROPIC_API_KEY in the environment.')
    console.error('Run this as: node --env-file=.env.local scripts/bench-coach-brevity.mjs')
    process.exit(1)
  }

  const conditionKeys = args.condition === 'all' ? Object.keys(CONDITIONS) : args.condition.split(',')
  for (const key of conditionKeys) {
    if (!CONDITIONS[key]) throw new Error(`Unknown condition: ${key}. Known: ${Object.keys(CONDITIONS).join(', ')}`)
  }

  const planned = conditionKeys.length * CELLS.length * args.runs
  if (planned > MAX_PLANNED_CALLS) {
    console.error(`Refusing to plan ${planned} calls; the cap is ${MAX_PLANNED_CALLS}.`)
    console.error('Lower --runs or narrow --condition.')
    process.exit(1)
  }

  console.log('B1 coach brevity bench')
  console.log('='.repeat(70))
  console.log(`Model            ${MODEL} (imported from src/coachApi.js, not copied)`)
  console.log(`Conditions       ${conditionKeys.join(', ')}`)
  console.log(`Cells            ${CELLS.map((c) => c.key).join(', ')}`)
  console.log(`Runs per cell    ${args.runs}`)
  console.log(`Live API calls   ${planned}`)
  console.log(`Rough cost       $${(planned * 0.018).toFixed(2)} at ~1.8 cents a debrief`)
  console.log(`Seed             ${args.seed} (every condition sees identical sessions)`)
  console.log('')
  console.log('Calls run one at a time, on purpose: this bench also measures how long')
  console.log('a debrief takes, and running them in parallel would corrupt that number.')
  console.log('')

  const records = []
  let inputTokens = 0
  let outputTokens = 0

  for (const conditionKey of conditionKeys) {
    const condition = CONDITIONS[conditionKey]
    const system = condition.instruction
      ? `${DEBRIEF_SYSTEM}\n\n${condition.instruction}`
      : DEBRIEF_SYSTEM

    for (const cell of CELLS) {
      const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: args.seed })
      const values = sessionValueSets(sessions)
      const targets = goalTargetSet(cell.goal.id)
      const userMessage = buildDebriefUserMessage({
        goal: cell.goal,
        player: PLAYER,
        sessions,
        viewingSessionNumber: cell.session,
      })

      for (let run = 1; run <= args.runs; run++) {
        process.stdout.write(`  ${conditionKey} / ${cell.key} / run ${run}... `)
        try {
          const { parsed, elapsedMs, usage } = await callCoach({ system, userMessage, apiKey })
          inputTokens += usage.input_tokens ?? 0
          outputTokens += usage.output_tokens ?? 0
          const graded = grade(parsed, values, targets)
          records.push({ conditionKey, cell: cell.key, run, elapsedMs, ...graded })
          console.log(`${graded.wordCounts.box} words in the box, ${Math.round(elapsedMs / 100) / 10}s`)
        } catch (err) {
          console.log(`FAILED: ${err.message}`)
          records.push({ conditionKey, cell: cell.key, run, failed: err.message })
        }
      }
    }
  }

  report(records, conditionKeys)

  const cost = (inputTokens / 1e6) * USD_PER_M_INPUT + (outputTokens / 1e6) * USD_PER_M_OUTPUT
  console.log('')
  console.log(`Measured spend   ${inputTokens} input + ${outputTokens} output tokens = $${cost.toFixed(2)}`)

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(records, null, 2))
    console.log(`Raw records      ${args.out}`)
  }
}

function report(records, conditionKeys) {
  const ok = records.filter((r) => !r.failed)

  console.log('')
  console.log('='.repeat(70))
  console.log('HOW MUCH THE COACH WROTE')
  console.log('='.repeat(70))
  console.log('')
  console.log('"Box" is the Session Summary panel: coachingSummary + whatThisMeans.')
  console.log('It is fixed height and is the only part a font bump is constrained by.')
  console.log('')
  console.log('condition            cell         n   box median   box p90   box MAX   tips median')
  console.log('-'.repeat(84))
  for (const conditionKey of conditionKeys) {
    for (const cell of CELLS) {
      const rows = ok.filter((r) => r.conditionKey === conditionKey && r.cell === cell.key)
      if (!rows.length) continue
      const box = rows.map((r) => r.wordCounts.box)
      const tips = rows.map((r) => r.wordCounts.tip1 + r.wordCounts.tip2)
      console.log(
        `${conditionKey.padEnd(20)} ${cell.key.padEnd(12)} ${String(rows.length).padStart(2)}   ` +
        `${String(median(box)).padStart(10)}   ${String(percentile(box, 90)).padStart(7)}   ` +
        `${String(Math.max(...box)).padStart(7)}   ${String(median(tips)).padStart(11)}`,
      )
    }
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('DID IT STILL QUOTE THE PLAYER?')
  console.log('='.repeat(70))
  console.log('')
  console.log('Grounded  = numbers carrying a unit that match a real value in the session.')
  console.log('Target    = the goal\'s own target numbers. Legitimate, but not evidence')
  console.log('            the coach looked at the swings, so counted separately.')
  console.log('Unmatched = a unit-bearing number matching no value exactly. Read it as a')
  console.log('            LEAD, not a verdict: the baseline run showed the coach rounding')
  console.log('            ("320 feet or more" against a 305+ bucket), which is loose talk')
  console.log('            rather than invention. A real fabrication looks like a number no')
  console.log('            rounding could reach.')
  console.log('Tip leads = share of tips whose FIRST sentence carries a grounded citation,')
  console.log('            which is the observation half of the three-part tip structure.')
  console.log('')
  console.log('condition            cell         grounded/run   target/run   unmatched   tip leads')
  console.log('-'.repeat(84))
  for (const conditionKey of conditionKeys) {
    for (const cell of CELLS) {
      const rows = ok.filter((r) => r.conditionKey === conditionKey && r.cell === cell.key)
      if (!rows.length) continue
      const grounded = rows.map((r) => r.numbers.grounded)
      const target = rows.map((r) => r.numbers.target)
      const unmatched = rows.reduce((s, r) => s + r.numbers.unmatched, 0)
      const leads = rows.flatMap((r) => r.tipLeadsCite)
      const leadPct = leads.length ? Math.round((leads.filter(Boolean).length / leads.length) * 100) : 0
      console.log(
        `${conditionKey.padEnd(20)} ${cell.key.padEnd(12)} ${String(round1(median(grounded))).padStart(12)}   ` +
        `${String(round1(median(target))).padStart(10)}   ${String(unmatched).padStart(9)}   ${String(leadPct + '%').padStart(9)}`,
      )
    }
  }

  const unmatchedExamples = ok.flatMap((r) => r.numbers.unmatchedExamples ?? [])
  if (unmatchedExamples.length) {
    console.log('')
    console.log(`Unmatched examples (first few): ${unmatchedExamples.slice(0, 8).join(' | ')}`)
    console.log('Worth eyeballing: some will be real fabrications, some will be the grader')
    console.log('being too literal. Read them before believing either.')
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('HOW LONG A DEBRIEF TOOK')
  console.log('='.repeat(70))
  console.log('')
  for (const conditionKey of conditionKeys) {
    const rows = ok.filter((r) => r.conditionKey === conditionKey)
    if (!rows.length) continue
    const ms = rows.map((r) => r.elapsedMs)
    const out = rows.map((r) => r.wordCounts.box + r.wordCounts.tip1 + r.wordCounts.tip2 + r.wordCounts.tipsIntro)
    console.log(
      `${conditionKey.padEnd(20)} median ${round1(median(ms) / 1000)}s, p90 ${round1(percentile(ms, 90) / 1000)}s, ` +
      `slowest ${round1(Math.max(...ms) / 1000)}s, across a median ${median(out)} words written`,
    )
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('THE LONGEST BOX SEEN, VERBATIM')
  console.log('='.repeat(70))
  console.log('')
  console.log('This is the one that decides the font size. Not the typical one.')
  console.log('')
  const longest = [...ok].sort((a, b) => b.wordCounts.box - a.wordCounts.box)[0]
  if (longest) {
    console.log(`[${longest.conditionKey} / ${longest.cell} / run ${longest.run}] ${longest.wordCounts.box} words`)
    console.log('')
    console.log('SESSION SUMMARY:')
    console.log(longest.fields.coachingSummary)
    console.log('')
    console.log('WHAT THIS MEANS:')
    console.log(longest.fields.whatThisMeans)
    console.log('')
    console.log('TIPS INTRO:')
    console.log(longest.fields.tipsIntro)
    console.log('')
    longest.fields.tip1 && console.log(`TIP 1: ${longest.fields.tip1}`)
    console.log('')
    longest.fields.tip2 && console.log(`TIP 2: ${longest.fields.tip2}`)
  }

  const failures = records.filter((r) => r.failed)
  if (failures.length) {
    console.log('')
    console.log(`${failures.length} of ${records.length} calls failed. Those runs are excluded from every`)
    console.log('number above, so treat the sample size as smaller than it was planned to be.')
  }
}

await main()
