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
// is checked by file count rather than asserted: as measured 17 August 2026,
// `npm test` reports 16 files and 392 tests with this file present in the
// repo. (The same check read 11 files and 326 tests when this file was first
// added in Slice 7, 14 August 2026; the counts move as the suite grows, the
// point, that this file adds none of them, does not.) Re-measure before
// trusting this comment if it has been a while; a dated number is a claim
// about the day it was checked, not a promise it still holds.
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
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

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
  DEBRIEF_SYSTEM_BASE,
  DEBRIEF_BUDGET,
  lengthBudget,
  MAX_TOKENS,
  MODEL,
  buildDebriefUserMessage,
  parseCoachResponse,
} = await import('../src/coachApi.js')
const { generateSwings } = await import('../src/swingGenerator.js')
const { computeStats, topExitVelocity } = await import('../src/sessionStats.js')
const { DISTANCE_BUCKETS } = await import('../src/ballFlight.js')
const { goalTarget, hasTarget } = await import('../src/goalTargets.js')
const { SESSION_ONE_SWINGS } = await import('../src/sessionOneSwings.js')
const { contentWordOverlap } = await import('./contentWordOverlap.js')
const { CoachCallError, buildFailureRecord } = await import('./coachFailureRecord.js')

// A hard stop on how much one invocation can spend, not a budget. The realistic
// accident here is a typo in --runs, and the balance behind this key is what
// keeps the deployed demo alive.
//
// Left at its Slice 7 value on purpose. Slice 7b's power-s1 cell raised the
// cost of a single condition from 24 calls (3 cells x 8 runs) to 36, Slice 8b's
// two new cells (allfields-s4, popup-s4) raised it again to 52, and Slice 9's
// contact-s1 cell raises it once more to 64 at the default --runs 8
// (12+8+12+8+8+8+8), so --condition all (5 conditions) now needs 320, above
// this cap where it once needed 120. That is intentional, not an oversight:
// --condition all was already a wasteful invocation before those cells existed
// (B and shipped build byte-identical prompts) and this project's owner has
// said it should never be run. Raising the cap to fit it would remove the one
// thing stopping that command from working by default; the refusal message at
// the call site explains this rather than reading as an arbitrary number. A
// single condition at 64 calls still clears the cap with room for a larger
// deliberate --runs.
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

// Session 1 in this app is not generated: it is fifteen swings typed out by
// hand. Until Slice 7b's Task 1 they lived inside src/App.jsx, which imports
// React and JSX, so a plain Node script could not load them, and this bench
// built a stand-in instead, pinned to the scripted session's two averages.
// That gap closed on 17 August 2026: the fifteen swings now live in
// src/sessionOneSwings.js, a plain module this bench can import directly, so
// every one of its four cells reads the exact starting point a real visitor
// sees rather than an approximation of it. This also means every cell's
// downstream sessions (2 to 4, built off session 1 as their baseline) shift
// from what earlier runs measured, since they now branch off real data
// instead of a randomly-drawn stand-in with the same averages; Slice 7b's own
// before-run is the reference going forward, not Slice 7's recorded figures.
const SESSION_1_BASELINE = SESSION_ONE_SWINGS

// The app rebuilds every later session off session 1, not off the session before
// it (see the single generateSwings call in src/App.jsx), so this does the same.
function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = SESSION_1_BASELINE
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
// not being able to import a JSX file. Slice 8b grew this from four cells to
// six; Slice 9 added a seventh, contact-s1, so the hand-copied labels that
// must be kept in step with App.jsx now number seven, one per cell, still
// covering four distinct goals (contact now has two cells, one per session
// shape it is measured on).
// `weight` is how each cell's share of --runs is expressed; see cellRuns()
// below for the arithmetic and the reasoning for doing it this way rather
// than a fixed absolute count on power-s1.
const CELLS = [
  { key: 'power-s1', goal: { id: 'power', label: 'Power & Distance' }, session: 1, weight: 1.5, why: 'session 1 is where every visitor lands and where the coach was caught stating something false; no prior session to compare against, which is part of why it earns its own cell' },
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2, weight: 1, why: 'the goal most visitors pick, early session' },
  { key: 'contact-s1', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 1, weight: 1.5, why: 'Slice 9 rewrites the fifteen hand-written session-1 swings, and this is the goal whose session-1 screen the rewrite most changes (0 on target today, 2 after); weighted to match power-s1 since it is the other session-1 cell and carries the same no-prior-session case' },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4, weight: 1, why: 'largest session, three priors to compare against' },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4, weight: 1, why: 'no target, so the coach has the most latitude' },
  { key: 'allfields-s4', goal: { id: 'allfields', label: 'Hit to All Fields' }, session: 4, weight: 1, why: 'never measured by anything; judged on spray direction, which no other cell exercises' },
  { key: 'popup-s4', goal: { id: 'popup', label: 'Reduce Pop-Ups' }, session: 4, weight: 1, why: 'never measured by anything; the only goal judged on launch angle alone, with no exit velocity ask' },
]

// --runs sets the volume for a weight-1 cell (default 8, matching power-s2,
// contact-s4 and open-s4). power-s1 carries a 1.5x weight baked into its own
// definition rather than a second flag, so a single --runs value scales
// every cell together and keeps the extra session-1 volume proportional: the
// default --runs 8 reproduces the 12/8/8/8 split named in the slice plan
// (36 calls per condition), --runs 4 gives 6/4/4/4, --runs 16 gives
// 24/16/16/16, and so on. Chosen over a fixed absolute count on power-s1 so a
// cheap smoke-test run (a small --runs) still exercises every cell without
// the caller having to reason about two independent numbers, and so a single
// flag keeps meaning "how many runs, roughly" the way it always has.
function cellRuns(cell, baseRuns) {
  return Math.max(1, Math.round(baseRuns * cell.weight))
}

// A condition is a complete system prompt: the real base prompt, plus whatever
// budget wording (if any) that condition is testing. Every condition below is
// built on DEBRIEF_SYSTEM_BASE rather than on DEBRIEF_SYSTEM, on purpose. Once
// Task 2 baked condition B's budget into DEBRIEF_SYSTEM itself, building
// baseline/A/C on top of that constant would have silently turned every one of
// them into "budget B plus a second budget," and the baseline condition would
// have stopped measuring what its own label claims. lengthBudget and its
// wording live in src/coachApi.js now, imported rather than copied, for the
// same reason DEBRIEF_SYSTEM_BASE is imported: a bench grading its own copy of
// the wording grades nothing, because the copy can drift from what the app
// actually sends and nothing would notice.
//
// The three sized budgets (A, B, C) are pitched at measured panel capacity, not
// at taste. On a 1440x790 window (the viewport a MacBook Air actually gives)
// the Session Summary box holds 154 words at today's 16px, 106 at 18px and 96
// at 20px. Baseline output runs 78 to 181 words. So: A is sized to clear 18px,
// B to clear 20px with room, C to clear 20px on a smaller window too.
const CONDITIONS = {
  baseline: { label: 'baseline (the prompt before budget B, no budget)', system: DEBRIEF_SYSTEM_BASE },
  A: {
    label: 'A, light: box target 90 words',
    system: `${DEBRIEF_SYSTEM_BASE}\n\n${lengthBudget({ summary: 55, means: 35, intro: 15, tip: 60 })}`,
  },
  B: {
    label: 'B, medium: box target 75 words (the budget that shipped)',
    system: `${DEBRIEF_SYSTEM_BASE}\n\n${DEBRIEF_BUDGET}`,
  },
  C: {
    label: 'C, tight: box target 60 words',
    system: `${DEBRIEF_SYSTEM_BASE}\n\n${lengthBudget({ summary: 35, means: 25, intro: 10, tip: 40 })}`,
  },
  // Not one of the four sizes the original comparison ran. This condition
  // exists so the prompt can be re-measured exactly as the app ships it,
  // markdown fences, chart-key instructions and all, rather than trusting that
  // stitching DEBRIEF_SYSTEM_BASE and DEBRIEF_BUDGET back together by hand
  // reproduces DEBRIEF_SYSTEM byte for byte. Task 5 is the slice task that runs
  // this one for real.
  //
  // Since budget B was re-expressed as DEBRIEF_BUDGET, this condition and
  // condition B now send byte-identical system prompts. Both stay defined
  // because they answer different questions, but running them together
  // (--condition all) measures the same string twice for no reason, at the
  // cost of another 24 live calls. Use --condition shipped when the question
  // is what the app sends today.
  shipped: { label: 'shipped (DEBRIEF_SYSTEM exactly as the app sends it)', system: DEBRIEF_SYSTEM },
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

// A run that parses as valid JSON is not automatically a real answer. The
// model can drop a field, or hand back an empty string for it, and neither
// trips parseCoachResponse's throw: a hard parse failure is already caught,
// excluded from every statistic, and counted separately in the report. This
// is the quieter failure a hard parse failure cannot see. `words()` returns 0
// for `undefined`, so a missing field just pulls the box-words median DOWN
// and reads as excellent brevity discipline instead of as a broken reply.
// Found in review, 14 August 2026: nothing before this line ever flagged it.
function isRealString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function missingFields(parsed) {
  const tips = Array.isArray(parsed?.nextSessionTips) ? parsed.nextSessionTips : []
  const missing = []
  if (!isRealString(parsed?.coachingSummary)) missing.push('coachingSummary')
  if (!isRealString(parsed?.whatThisMeans)) missing.push('whatThisMeans')
  if (!isRealString(parsed?.tipsIntro)) missing.push('tipsIntro')
  if (!isRealString(tips[0])) missing.push('nextSessionTips[0]')
  if (!isRealString(tips[1])) missing.push('nextSessionTips[1]')
  return missing
}

function grade(parsed, values, targets) {
  const tips = Array.isArray(parsed?.nextSessionTips) ? parsed.nextSessionTips : []
  const fields = {
    coachingSummary: parsed?.coachingSummary,
    whatThisMeans: parsed?.whatThisMeans,
    tipsIntro: parsed?.tipsIntro,
    tip1: tips[0],
    tip2: tips[1],
  }
  const missing = missingFields(parsed)

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

  // Content-word overlap between whatThisMeans and coachingSummary; see
  // scripts/contentWordOverlap.js for the definition. A three-sentence floor
  // on whatThisMeans was scoped for this slice but deferred when it pivoted;
  // this measure exists ahead of that floor so, whenever it ships, a coach
  // that hits it by restating the summary shows up HIGH here rather than
  // reading as a clean pass in the word-count numbers above.
  const overlap = contentWordOverlap(fields.whatThisMeans, fields.coachingSummary)

  return { wordCounts, numbers, tipLeadsCite, tipCount: tips.length, fields, missing, overlap }
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
  const stopReason = data?.stop_reason ?? null
  const outputTokens = data?.usage?.output_tokens ?? null

  if (!text) {
    throw new CoachCallError('No text content in the response', { stopReason, outputTokens })
  }

  // The evidence Task 10 (Slice 7b's pivot) exists to keep. Before this, a
  // parse failure here produced only a message: not the raw reply, not why
  // the model stopped, not how much it wrote. Diagnosing the session-1
  // MAX_TOKENS bug needed all three, and none were on disk, which is why that
  // diagnosis needed a separate scratch script and a second round of spend.
  try {
    const parsed = parseCoachResponse(text)
    return { parsed, elapsedMs, usage: data.usage ?? {} }
  } catch (err) {
    throw new CoachCallError(err.message, { rawText: text, stopReason, outputTokens })
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
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100)

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
function dryRun(conditionKeys, seed, runs) {
  console.log('DRY RUN. No API calls, no spend. Exercising every path but the network.')
  console.log('')
  console.log(
    `Run allocation at --runs ${runs}: ${CELLS.map((c) => `${c.key} ${cellRuns(c, runs)}`).join(', ')}`,
  )
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

  // A second canned reply, deliberately incomplete, so this dry run also
  // proves the missing-field counter fires rather than trusting that by
  // reading the code. One field blanked to an empty string, one tip dropped
  // entirely: the two shapes a partial reply has actually been seen to take.
  const broken = {
    coachingSummary: 'You hit 92 mph and got it out to 305 feet on swing 4.',
    whatThisMeans: '',
    tipsIntro: 'Two things before next round.',
    nextSessionTips: [
      'Swing 12 came off at 80 mph and 191 feet. You got on top of it. Stay back a half beat longer.',
    ],
    charts: ['scatter_ev_la', 'bar_distance'],
  }

  for (const conditionKey of conditionKeys) {
    const condition = CONDITIONS[conditionKey]
    const system = condition.system
    for (const cell of CELLS) {
      const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed })
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
        `${graded.numbers.unmatched} unmatched, ${graded.missing.length} missing, overlap ${round2(graded.overlap)})`,
      )
    }
  }

  console.log('')
  const sample = buildSessions({ goalId: CELLS[0].goal.id, upTo: CELLS[0].session, seed })
  const sampleValues = sessionValueSets(sample)
  const sampleTargets = goalTargetSet(CELLS[0].goal.id)
  const cannedGraded = grade(canned, sampleValues, sampleTargets)
  const brokenGraded = grade(broken, sampleValues, sampleTargets)
  console.log(
    `Missing-field self-check: complete reply -> ${cannedGraded.missing.length} missing (expect 0), ` +
    `broken reply -> ${brokenGraded.missing.length} missing (expect 2: ${brokenGraded.missing.join(', ')})`,
  )
  if (cannedGraded.missing.length !== 0 || brokenGraded.missing.length !== 2) {
    throw new Error('Missing-field self-check failed: see the two counts printed above.')
  }

  // Overlap self-check, independent of the canned dry-run reply above (whose
  // two fields happen to share zero content words, which is a valid grade
  // but not a useful thing to assert against): identical text must score
  // exactly 1, and a pair that shares some but not all content words
  // ("hard", "mph") while differing on the rest must land strictly between
  // 0 and 1.
  const identicalOverlap = contentWordOverlap(canned.coachingSummary, canned.coachingSummary)
  const partialA = 'You hit the ball hard at 92 mph and drove it 320 feet.'
  const partialB = 'That was hard contact at 92 mph, a strong swing.'
  const partialOverlap = contentWordOverlap(partialA, partialB)
  console.log(
    `Overlap self-check: identical text -> ${round2(identicalOverlap)} (expect 1), ` +
    `partially-shared text -> ${round2(partialOverlap)} (expect strictly between 0 and 1)`,
  )
  if (identicalOverlap !== 1 || !(partialOverlap > 0 && partialOverlap < 1)) {
    throw new Error('Overlap self-check failed: see the two values printed above.')
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
    dryRun(conditionKeysForDryRun, args.seed, args.runs)
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

  const runsPerCell = CELLS.map((c) => cellRuns(c, args.runs))
  const runsPerCondition = runsPerCell.reduce((sum, n) => sum + n, 0)
  const planned = conditionKeys.length * runsPerCondition
  if (planned > MAX_PLANNED_CALLS) {
    console.error(
      `Refusing to plan ${planned} calls; the cap is ${MAX_PLANNED_CALLS} ` +
      `(${conditionKeys.length} condition(s) x ${runsPerCondition} calls/condition).`,
    )
    // The power-s1 cell (Slice 7b) raised every condition's own cost from 24
    // to 36 calls, Slice 8b's allfields-s4 and popup-s4 cells raised it to 52,
    // and Slice 9's contact-s1 cell raised it again to 64, so --condition all
    // now needs 320 at the default --runs 8, far above the cap on its own.
    // That is not a bug to route around by raising the cap: --condition all
    // was already discouraged before those cells,
    // since B and shipped send byte-identical system prompts and running
    // both spends calls measuring the same string twice. This message exists
    // so a future caller who hits the refusal understands why, rather than
    // reading it as an arbitrary number to push past.
    if (args.condition === 'all') {
      console.error(
        '"all" runs every condition, including both B and shipped, which build ' +
        'byte-identical system prompts — that duplication was already wasteful ' +
        'before this slice and is now what pushes the plan over the cap. Use ' +
        '--condition shipped (what the app sends today) unless you specifically ' +
        'need the historical A/B/C comparison, or name only the conditions you need.',
      )
    }
    console.error('Lower --runs or narrow --condition.')
    process.exit(1)
  }

  console.log('B1 coach brevity bench')
  console.log('='.repeat(70))
  console.log(`Model            ${MODEL} (imported from src/coachApi.js, not copied)`)
  console.log(`Conditions       ${conditionKeys.join(', ')}`)
  console.log(`Cells            ${CELLS.map((c, i) => `${c.key}(${runsPerCell[i]})`).join(', ')}`)
  console.log(`Runs             --runs ${args.runs} (per-cell counts above; ${runsPerCondition} calls/condition)`)
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
    const system = condition.system

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

      for (let run = 1; run <= cellRuns(cell, args.runs); run++) {
        process.stdout.write(`  ${conditionKey} / ${cell.key} / run ${run}... `)
        try {
          const { parsed, elapsedMs, usage } = await callCoach({ system, userMessage, apiKey })
          inputTokens += usage.input_tokens ?? 0
          outputTokens += usage.output_tokens ?? 0
          const graded = grade(parsed, values, targets)
          records.push({ conditionKey, cell: cell.key, run, elapsedMs, ...graded })
          console.log(`${graded.wordCounts.box} words in the box, ${Math.round(elapsedMs / 100) / 10}s`)
        } catch (err) {
          const ceilingNote = err instanceof CoachCallError && err.stopReason === 'max_tokens' ? ' (hit MAX_TOKENS)' : ''
          console.log(`FAILED: ${err.message}${ceilingNote}`)
          records.push(buildFailureRecord({ conditionKey, cell: cell.key, run }, err))
        }
      }
    }
  }

  report(records, conditionKeys)

  const cost = (inputTokens / 1e6) * USD_PER_M_INPUT + (outputTokens / 1e6) * USD_PER_M_OUTPUT
  console.log('')
  console.log(`Measured spend   ${inputTokens} input + ${outputTokens} output tokens = $${cost.toFixed(2)}`)

  if (args.out) {
    // A run on 18 August 2026 completed all 52 paid calls and then lost every
    // record to ENOENT because the output directory did not exist; the
    // directory is cheaper than the calls.
    mkdirSync(path.dirname(args.out), { recursive: true })
    writeFileSync(args.out, JSON.stringify(records, null, 2))
    console.log(`Raw records      ${args.out}`)
  }
}

function report(records, conditionKeys) {
  const ok = records.filter((r) => !r.failed)

  // Printed first and loudly on purpose, before a single brevity or citation
  // number. A hard parse failure is already safe: parseCoachResponse throws,
  // the run lands in `failed` above, and it is excluded from every statistic
  // in this report. A PARTIAL reply is not safe the same way: it parses as
  // valid JSON, so it counts as an ok run everywhere below, and a missing
  // field just pulls the box-words median DOWN, which reads as excellent
  // brevity compliance instead of as a broken answer. If this count is
  // non-zero, every number in the two sections after it is describing some
  // share of partly-empty answers, not a clean sample.
  const incomplete = ok.filter((r) => r.missing.length > 0)
  console.log('')
  console.log('='.repeat(70))
  console.log('PARSED BUT INCOMPLETE')
  console.log('='.repeat(70))
  console.log('')
  if (incomplete.length) {
    console.log(`⚠ ${incomplete.length} of ${ok.length} successfully-parsed runs were missing a`)
    console.log('required field. The numbers in every section below include these runs,')
    console.log('so read them as compromised until this list is empty.')
    console.log('')
    for (const r of incomplete) {
      console.log(`  ${r.conditionKey} / ${r.cell} / run ${r.run}: missing ${r.missing.join(', ')}`)
    }
  } else {
    console.log(`0 of ${ok.length} successfully-parsed runs were missing a required field.`)
  }

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
  console.log('DOES WHAT THIS MEANS JUST RESTATE THE SUMMARY?')
  console.log('='.repeat(70))
  console.log('')
  console.log('Content-word overlap (Jaccard, see scripts/contentWordOverlap.js) between')
  console.log('whatThisMeans and coachingSummary. 0 = no shared content words, 1 = the')
  console.log('same set on both sides. A word-count floor on whatThisMeans was scoped for')
  console.log('this slice but deferred when it pivoted, so it has not shipped; this measure')
  console.log('is instrumentation built ahead of that floor, because a floor invites padding')
  console.log('by restating the summary rather than adding to it, and a rising median here,')
  console.log('not a rising word count, is what that padding actually looks like.')
  console.log('')
  console.log('condition            cell         n   overlap median   p90    max')
  console.log('-'.repeat(84))
  for (const conditionKey of conditionKeys) {
    for (const cell of CELLS) {
      const rows = ok.filter((r) => r.conditionKey === conditionKey && r.cell === cell.key)
      if (!rows.length) continue
      const overlap = rows.map((r) => r.overlap)
      console.log(
        `${conditionKey.padEnd(20)} ${cell.key.padEnd(12)} ${String(rows.length).padStart(2)}   ` +
        `${String(round2(median(overlap))).padStart(13)}   ${String(round2(percentile(overlap, 90))).padStart(4)}   ` +
        `${String(round2(Math.max(...overlap))).padStart(4)}`,
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

    // Task 10, Slice 7b's pivot: the reason this bench now keeps stop_reason
    // and output_tokens on a failed call. A count here separates "the model
    // ran out of room and got cut off mid-JSON" from every other way a call
    // can fail, without anyone having to re-run a scratch script to find out.
    const ceilingHits = failures.filter((r) => r.stopReason === 'max_tokens')
    if (ceilingHits.length) {
      console.log(
        `${ceilingHits.length} of those ${failures.length} failures hit the MAX_TOKENS ceiling ` +
        '(stop_reason "max_tokens"): the model was still writing when its output ran out, not' +
        ' answering with something malformed. See each record\'s rawText and outputTokens for the cut-off reply.',
      )
      const byCell = {}
      for (const r of ceilingHits) byCell[r.cell] = (byCell[r.cell] ?? 0) + 1
      console.log(`By cell: ${Object.entries(byCell).map(([k, v]) => `${k} ${v}`).join(', ')}`)
    }
  }
}

await main()
