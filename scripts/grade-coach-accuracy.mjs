#!/usr/bin/env node
//
// The coach claim-accuracy grader: reads a debrief against the exact session
// data it was given and produces a TRUE / FALSE / UNVERIFIABLE verdict for
// every countable claim, with the fact-sheet data that settles it.
//
// Built for Slice 7b Task 4. The product manager's question this instrument
// answers: does lengthening "What This Means" make the coach more factually
// wrong? A human reading 96 transcripts by hand already answered that once
// (docs/eval-fixtures/slice7-debriefs/regrade-report.md) and found the coach
// reliably repeats a count the prompt hands it, and is unreliable at a count
// it has to derive itself. Automated pattern-matching in that same report had
// poor recall and one actively misleading collision (a regex read "Six of
// your 15 swings in Session 4 came in above 20 degrees" as the count being
// FOUR, grabbing the digit out of "Session 4"). This script is built to be
// neither of those: it hands the model a fact sheet with the counting
// already done, so the model's only job is finding a claim in the prose and
// reading a table, the same shape of task the report found humans reliable
// at.
//
// *** METHODOLOGICAL NOTE, READ BEFORE CHANGING THE --validate PATH ***
// This script must never be fitted to the fixture's 8 known-wrong records by
// name. --validate reports only what it flagged; it does not compute or
// print a recall number against ground truth, because it is never told which
// records are the known-wrong ones. A separate, blind comparison is the
// controller's job, run once, so the resulting recall number is an honest
// test score rather than training accuracy. If a future change references a
// specific cell/run/condition triple to special-case a result, that change
// is wrong regardless of how it makes the numbers look.
//
// WHAT THE MODEL DOES AND DOES NOT DO
// The model does no arithmetic. scripts/factSheet.js computes, in plain JS,
// a per-swing table and threshold counts (above / below / equal / at-least /
// at-most, each with the qualifying swing numbers) at every threshold a
// coach plausibly cites: every value actually present in the session, plus a
// small fixed set of round numbers and the two thresholds the regrade report
// named by name (15, spelled out in the debrief prompt; 20, the exact
// "above 20 degrees" threshold every real attempt in the 96-debrief fixture
// got wrong). The model's job is to find a countable claim in the prose and
// read the matching table row. The one place this is not perfectly
// arithmetic-free is an "N of those [swings X, Y, Z] were under T" claim:
// the model still has to intersect the named swing numbers with the
// threshold row's full qualifying set, a small, bounded lookup rather than a
// derivation from scratch. That is disclosed as a known limit in this
// script's own report, not hidden.
//
// HOW TO RUN
//   node --env-file=.env.local scripts/grade-coach-accuracy.mjs --dry-run
//   node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --sample 40
//   node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --input <dir> --builder current
// The third form (Slice 8b) grades a directory of fresh bench --out files
// instead of the committed fixture; pair it with --dry-run first to see the
// planned call count for that directory before spending.
// THIS SPENDS REAL MONEY in --validate mode without --dry-run. It prints the
// planned call count and model before spending a cent, and refuses outright
// to plan more than MAX_PLANNED_CALLS.
//
// WHY IT IS NOT A TEST, AND CANNOT BECOME ONE BY ACCIDENT
// It lives under scripts/ beside the project's other hand-run scripts,
// outside the test runner's collection: vitest has no config here, so its
// default glob takes only *.test.* files, and this filename does not match
// it. That claim is checked by file count in this task's report, the same
// way bench-coach-brevity.mjs's own header checks it. The test suite must
// never call the model, and this script does, so it must never be
// collected.

import { register } from 'node:module'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// THE SAME LOADER WRINKLE every hand-run script in this project documents:
// files under src/ import their neighbours without a file extension
// (`./goalTargets`), which Vite and vitest both resolve and plain `node`
// refuses with ERR_MODULE_NOT_FOUND. This registers the same tiny inline
// hook scripts/measure-swing-generation.mjs and scripts/bench-coach-brevity.mjs
// each carry their own copy of: retry a failed extensionless relative import
// with `.js` on the end. It is only needed for the "current" session
// builder below, which imports src/swingGenerator.js; scripts/factSheet.js
// needs no such hook, because every module it imports uses full `.js`
// extensions already.
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

import { buildFactSheet, goalExtraThresholds } from './factSheet.js'
import { verdictForClaim } from './claimVerdict.js'
import { mergeInputRecords } from './inputRecords.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_DIR = path.join(REPO_ROOT, 'docs/eval-fixtures/slice7-debriefs')

// ─────────────────────────────────────────────────────────────────────────────
// Model, pricing, cost guardrails
// ─────────────────────────────────────────────────────────────────────────────

// The task brief's own instruction: default to the cheap model so the
// controller can try it first and escalate only if validation misses the 8
// known-wrong records. This is the full dated ID (not the bare alias) on
// purpose, matching how docs/eval-fixtures/slice7-debriefs itself pins
// dates rather than aliases wherever a specific measurement depends on it.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const GRADER_MAX_TOKENS = 4096

// Dollars per million tokens, list pricing, for the cost line only. Nothing
// behaves differently if these drift; the printed estimate just gets less
// useful. Source: the claude-api skill's cached pricing table, confirmed
// against Claude Haiku 4.5 / Sonnet 4.6 current at the time this was written.
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-5': { input: 3, output: 15 },
}
const FALLBACK_PRICING = PRICING['claude-haiku-4-5-20251001']

// A hard stop, not a budget: the realistic accident here is a typo in
// --sample or --limit, not a deliberate large run. The controller's own plan
// is 40 calls; this leaves headroom for a bigger deliberate run without
// leaving the door open to an unbounded one.
const MAX_PLANNED_CALLS = 100

// ─────────────────────────────────────────────────────────────────────────────
// Session builders: frozen (the 96-debrief fixture) vs current (a fresh bench run)
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the subtlest part of the task, so the mechanism is spelled out
// here rather than left implicit in the flag parsing below.
//
// The 96 fixture debriefs were written in August 2026 against a STAND-IN
// session 1 (mulberry32-seeded random swings pinned to session 1's real
// averages), because at that time the bench could not import the real
// hand-written session-1 swings out of src/App.jsx (JSX, no plain script
// could load it). docs/eval-fixtures/slice7-debriefs/rebuild.mjs is a
// frozen, deliberately-unmaintained copy of that exact stand-in generator,
// kept exactly as it was so it keeps reconstructing what those 96 debriefs
// actually saw. Grading them against anything else, including today's real
// session-1 swings, would silently invalidate every verdict: the swing
// numbers and values in the coach's own prose would no longer match the
// "current" fact sheet's per-swing table at all.
//
// A bench run from today onward uses the REAL session-1 swings
// (src/sessionOneSwings.js, extracted in this same slice's earlier task),
// so grading a NEW records file needs the opposite: the current generator,
// not the frozen stand-in.
//
// The flag design makes the choice unavoidable rather than defaulted:
//   - No --records flag (the default: grade the 96-debrief fixture) locks
//     the builder to "frozen" outright. Passing --builder current in this
//     mode is refused with an error, because that combination is exactly
//     the mistake that would silently produce wrong verdicts against the
//     fixture's own ground truth.
//   - A --records flag REQUIRES an explicit --builder. There is no default,
//     on purpose: a silent default here is the one mistake with no error
//     message to catch it, since both builders produce a plausible-looking
//     fact sheet, just for the wrong swings.

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hand-copied from the CELLS array in scripts/bench-coach-brevity.mjs, the
// same category of duplication CLAUDE.md already accepts for that file's own
// copy of the GOALS labels: a plain Node script cannot import src/App.jsx,
// so goal id/label pairs and cell definitions get copied by hand instead.
// This is a THIRD hand-maintained copy of the same small facts (bench,
// rebuild.mjs's frozen CELLS, and now this one); see this task's report for
// why a fourth consolidation pass was judged out of scope here.
const CURRENT_CELLS = [
  { key: 'power-s1', goal: { id: 'power', label: 'Power & Distance' }, session: 1 },
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2 },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4 },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4 },
  // The two cells Slice 8b added to the bench, kept in step by hand like the
  // rest of this list. Without them a bench round containing either goal
  // would fail to resolve here and the round could not be graded at all.
  { key: 'allfields-s4', goal: { id: 'allfields', label: 'Hit to All Fields' }, session: 4 },
  { key: 'popup-s4', goal: { id: 'popup', label: 'Reduce Pop-Ups' }, session: 4 },
]

let _currentBuilderDeps = null
async function loadCurrentBuilderDeps() {
  if (_currentBuilderDeps) return _currentBuilderDeps
  const { generateSwings } = await import(`${REPO_ROOT}/src/swingGenerator.js`)
  const { computeStats } = await import(`${REPO_ROOT}/src/sessionStats.js`)
  const { SESSION_ONE_SWINGS } = await import(`${REPO_ROOT}/src/sessionOneSwings.js`)
  _currentBuilderDeps = { generateSwings, computeStats, SESSION_ONE_SWINGS }
  return _currentBuilderDeps
}

async function buildSessionsCurrent({ goalId, upTo, seed }) {
  const { generateSwings, computeStats, SESSION_ONE_SWINGS } = await loadCurrentBuilderDeps()
  const random = mulberry32(seed)
  const baseline = SESSION_ONE_SWINGS
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

let _frozenRebuild = null
async function loadFrozenRebuild() {
  if (_frozenRebuild) return _frozenRebuild
  _frozenRebuild = await import(path.join(FIXTURE_DIR, 'rebuild.mjs'))
  return _frozenRebuild
}

// Resolves ONE cell's session data through the named builder. Throws loudly
// on an unknown builder name or an unknown cell for that builder, rather
// than silently falling through to a default.
async function resolveSessions({ builder, cellKey, seed = 20260814 }) {
  if (builder === 'frozen') {
    const { sessionsForCell, CELLS } = await loadFrozenRebuild()
    const cell = CELLS.find((c) => c.key === cellKey)
    if (!cell) {
      throw new Error(
        `Unknown cell "${cellKey}" for the frozen builder. Known: ${CELLS.map((c) => c.key).join(', ')}`,
      )
    }
    return { sessions: sessionsForCell(cellKey), goal: cell.goal, viewingSessionNumber: cell.session }
  }
  if (builder === 'current') {
    const cell = CURRENT_CELLS.find((c) => c.key === cellKey)
    if (!cell) {
      throw new Error(
        `Unknown cell "${cellKey}" for the current builder. Known: ${CURRENT_CELLS.map((c) => c.key).join(', ')}`,
      )
    }
    const sessions = await buildSessionsCurrent({ goalId: cell.goal.id, upTo: cell.session, seed })
    return { sessions, goal: cell.goal, viewingSessionNumber: cell.session }
  }
  throw new Error(`Unknown builder "${builder}". Must be "frozen" or "current".`)
}

// Same PLAYER every bench run has used (scripts/bench-coach-brevity.mjs);
// the player's name plays no role in any verdict, it only appears inside
// quoted prose the model reads, so a mismatch here could not produce a wrong
// grade. Kept fixed rather than plumbed through the record format, which
// carries no player field.
const PLAYER = { firstName: 'Jake' }

// ─────────────────────────────────────────────────────────────────────────────
// Loading records, and deciding which builder applies to them
// ─────────────────────────────────────────────────────────────────────────────

function loadFixtureRecords() {
  const baseline = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'baseline-records.json'), 'utf8'))
  const budget = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'budget-records.json'), 'utf8'))
  return [...baseline, ...budget]
}

// The Slice 8b --input flag: a whole directory of bench --out files, merged
// in filename order. The filesystem half lives here; every decision made
// after parsing (concatenation order, refusing a non-array file, setting
// aside failed bench records instead of grading their empty fields) lives in
// scripts/inputRecords.js, where the test suite reaches it.
function loadInputDirectory(dir) {
  const names = readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
  if (names.length === 0) {
    throw new Error(`${dir} contains no .json files to grade.`)
  }
  const files = names.map((name) => ({
    name,
    records: JSON.parse(readFileSync(path.join(dir, name), 'utf8')),
  }))
  return mergeInputRecords(files)
}

function resolveRecordsAndBuilder(args) {
  if (args.records && args.input) {
    throw new Error('Pass --records (one file) or --input (a directory), not both.')
  }
  if (args.input) {
    // Same rule as --records, for the same reason: there is no default
    // builder on purpose, because both builders produce a plausible-looking
    // fact sheet, just for the wrong swings, and a silent default is the one
    // mistake with no error message to catch it. A bench round produced
    // today wants --builder current.
    if (!args.builder) {
      throw new Error(
        '--input was given without --builder. There is no default: pass --builder current for anything ' +
        'produced by the bench as it runs today, or --builder frozen only if the directory holds records ' +
        'generated against the old stand-in session 1 (rare, and you should know why).',
      )
    }
    const { records, skippedFailed } = loadInputDirectory(args.input)
    return { records, skippedFailed, builder: args.builder, source: `${args.input} (directory)` }
  }
  if (!args.records) {
    if (args.builder && args.builder !== 'frozen') {
      throw new Error(
        'The default records (the 96-debrief fixture) were written against the frozen stand-in session 1. ' +
        `--builder ${args.builder} would grade them against the wrong swings. Omit --builder (frozen is ` +
        'implied), or pass --records to point at a different file first.',
      )
    }
    return { records: loadFixtureRecords(), builder: 'frozen', source: 'docs/eval-fixtures/slice7-debriefs (both files)' }
  }
  if (!args.builder) {
    throw new Error(
      '--records was given without --builder. There is no default: pass --builder frozen only if this file ' +
      'was generated against the old stand-in session 1 (rare, and you should know why), or --builder current ' +
      'for anything produced by the bench as it runs today.',
    )
  }
  const records = JSON.parse(readFileSync(args.records, 'utf8'))
  if (!Array.isArray(records)) throw new Error(`${args.records} did not parse to a JSON array of records.`)
  return { records, builder: args.builder, source: args.records }
}

// --limit takes the first N records as they appear in the file(s), in order.
// --sample takes a reproducible pseudo-random N, selected with the same
// seeded PRNG the session builders use, then sorted back into original order
// so the printed report reads top-to-bottom the way the source file does.
function selectSubset(records, args) {
  if (args.limit != null && args.sample != null) {
    throw new Error('Pass --limit or --sample, not both.')
  }
  if (args.limit != null) return records.slice(0, args.limit)
  if (args.sample != null) {
    const n = Math.min(args.sample, records.length)
    const random = mulberry32(args.seed)
    const indices = records.map((_, i) => i)
    // Fisher-Yates using the seeded source, so --sample is reproducible run
    // to run at the same --seed.
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const chosen = indices.slice(0, n).sort((a, b) => a - b)
    return chosen.map((i) => records[i])
  }
  return records
}

// ─────────────────────────────────────────────────────────────────────────────
// The grading prompt
// ─────────────────────────────────────────────────────────────────────────────

// EXTRACTION ONLY. The model is not asked for a verdict and is given no way
// to express one. See the header of scripts/claimVerdict.js for what the old
// judge-and-rule prompt did on 17 August 2026 and why this half was split off.
const GRADER_SYSTEM = `You are an extraction tool for an AI hitting coach's debrief. You will be given the debrief the coach wrote, as five text fields.

Your only job is to find every COUNTABLE claim in the debrief and write it out in structured form. You do NOT decide whether any claim is true. You do NOT do arithmetic. Something else checks the claims; your job is only to state precisely what was claimed.

You are NOT given the session data, on purpose, so you cannot be influenced by it. Extract exactly what the coach's sentences say, pairing swings with values in the order the sentence pairs them. "Swings 12 and 14 at 11 and 14 degrees" pairs swing 12 with 11 and swing 14 with 14, whatever the true values are. Whether the coach is right is not your problem.

A countable claim is one of these four shapes. Use the matching "kind":

"swingValue" - a specific value for a specific numbered swing ("swing 4 hit 92 mph", "swing 12 came in at 14 degrees").
  Fields: sessionNumber, swingNumber, metric, statedValue.

"threshold" - a count of swings meeting a threshold across a whole session ("6 of your 15 swings came in above 20 degrees").
  Fields: sessionNumber, metric, threshold, comparison, statedCount, and statedSwings if the coach also lists the swing numbers.

"subset" - a count restricted to swings the coach has just named ("two of swings 3, 8 and 12 were under 84 mph", "swings 5, 6 and 2 all hit 88-plus mph").
  Fields: sessionNumber, metric, threshold, comparison, ofSwings (the named swings), statedCount.
  "N-plus" and "N or better" on named swings are subset claims with comparison "atLeast", never swingValue claims: the coach is not saying each swing measured exactly N.

"range" - a count of swings inside a two-sided window ("you only hit the 25-to-35-degree window twice", "three swings landed between 8 and 18 degrees").
  Fields: sessionNumber, metric, min, max, statedCount, and ofSwings when the claim is about swings the coach has named.
  SCOPE MATTERS MORE THAN ANYTHING ELSE HERE. "Swings 4, 5, 6, and 7 were all between 88 and 92 mph" is a claim about those four named swings, so it carries ofSwings [4, 5, 6, 7] and statedCount 4. Only a claim about the whole session ("6 of your 15 swings landed between 20 and 31 degrees") omits ofSwings. When the sentence follows a list of named swings and says "all three" or "both", the names are the scope: include them as ofSwings.
  "Your launch angle ranged from 20 to 31 degrees" states a span, not a count. That is kind "other".
  Use this whenever the coach names BOTH edges of a window, even if the second edge appears earlier in the sentence or in the sentence before. A window is not a threshold: "the 25-to-35-degree window" is a range with min 25 and max 35, NOT "at least 25". Getting this wrong asks a different question than the coach answered.
  IMPORTANT EXCEPTION. Some goal "windows" are defined by TWO metrics at once, for example a launch-angle range AND a minimum exit velocity. If the coach calls something a power window, a power zone, or the goal's target zone, the count they were given may be the two-metric count rather than the launch-angle count, and the two differ. When a window claim could plausibly mean either, use kind "other". Do not pick one reading. An honest "cannot tell" is correct here; guessing produces a confident wrong answer about a sentence the coach got right.

"sessionStat" - a whole-session statistic ("you averaged 89 mph", "you put 4 of 15 in the zone").
  Fields: sessionNumber, statName, statedValue.
  statName must be one of: avgExitVelocity, avgLaunchAngle, inZoneCount, totalSwings, topExitVelocity, underFifteenCount, powerZoneCount.
  Use sessionStat ONLY when the coach names the statistic itself. A count of balls over or under some distance, angle, or speed is a "threshold" claim with that metric, NEVER a sessionStat: "4 balls hit 305 feet or more" is threshold, metric distance, atLeast 305, statedCount 4. Bare "exit velocity" means avgExitVelocity; use topExitVelocity only when the coach says top, best, peak, or hardest.

If a sentence carries a number but fits none of these shapes, use kind "other" and give the quote alone. Do not force it into a shape that does not fit; "other" is the correct and expected answer for anything you cannot structure cleanly.

metric must be one of: exitVelocity, launchAngle, direction, distance, pitchHeight, pitchSide.
pitchHeight and pitchSide describe where the PITCH was, not what the swing did. Use them for claims like "a pitch 0.6 feet off the ground" or "that pitch was well outside". Never label a pitch-location claim with exitVelocity, launchAngle, direction or distance.

comparison maps from the coach's own words, and the distinction is strict:
- "above", "over", "more than", "north of" -> "above"
- "under", "below", "less than" -> "below"
- "at least", "or more", "or better", "plus" -> "atLeast"
- "at most", "or fewer", "or less" -> "atMost"
- an exact number with no direction word -> "equal"

Other rules:
- sessionNumber is the session the claim is ABOUT, which is not always the one being debriefed. If the coach names no session, use the session being debriefed.
- Quote the exact clause making the claim, copied verbatim from the debrief.
- One entry per claim. A sentence making two claims gets two entries.
- Ignore coaching advice, encouragement, physical cues, and any sentence with no number in it.

Respond ONLY with valid JSON, no prose before or after, in exactly this shape:
{"claims": [
  {"field": "coachingSummary|whatThisMeans|tipsIntro|tip1|tip2", "quote": "the exact clause", "kind": "swingValue|threshold|subset|range|sessionStat|other", "sessionNumber": 4, "swingNumber": 12, "metric": "launchAngle", "threshold": 20, "comparison": "above", "min": 25, "max": 35, "statedValue": 14, "statedCount": 6, "statedSwings": [2, 4, 5], "ofSwings": [3, 8, 12]}
]}
Include only the fields that apply to that claim's kind; omit the rest.
If the debrief contains no countable claims at all, respond {"claims": []}.`

// The extractor is deliberately BLIND: it never sees the session data.
//
// The first extraction prompt included the full fact sheet "for context", and
// the 18 August 2026 re-validation showed what that enables: on two of the
// fixture's transposition errors ("swings 12 and 14 at 11 and 14 degrees",
// true values reversed), the extractor returned the pairs already corrected
// to the true values, so the verdict code graded the coach's error as TRUE.
// It could only have gotten those pairings from the fact sheet. An extractor
// that can see the answers can repair the coach's mistakes on the way past,
// and no prompt rule reliably stops it; not handing it the answers does.
//
// It also removes the reason the fact-sheet cache existed: the whole prompt
// is now a few hundred tokens per record.
function buildGraderUserPrompt({ record, factSheet, goal }) {
  const fields = record.fields ?? {}
  return `Player: ${PLAYER.firstName}
Goal: ${goal.label}
Session being debriefed: ${factSheet.viewingSessionNumber}

THE DEBRIEF THE COACH WROTE:
coachingSummary: ${fields.coachingSummary ?? ''}
whatThisMeans: ${fields.whatThisMeans ?? ''}
tipsIntro: ${fields.tipsIntro ?? ''}
tip1: ${fields.tip1 ?? ''}
tip2: ${fields.tip2 ?? ''}`
}

// No cache breakpoints. The first rebuild cached the fact sheet, which was
// most of the input; blinding the extractor removed the fact sheet, and what
// is left (about 1,200 tokens a record) sits under Haiku 4.5's 4096-token
// minimum cacheable prefix, where a breakpoint caches nothing silently. The
// report still prints cache tokens if the API ever reports any.
function buildGraderPrompt(record, factSheet, goal) {
  return { system: GRADER_SYSTEM, user: buildGraderUserPrompt({ record, factSheet, goal }) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing and normalizing the model's response
// ─────────────────────────────────────────────────────────────────────────────

// The outermost { ... } of a string, parsed, or undefined if there is none
// or it does not parse. Mirrors the fenced/preamble tolerance
// parseCoachResponse in src/coachApi.js needed for the same reason: a small
// model asked for bare JSON sometimes wraps it in a fence anyway.
function parseOutermostObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

function parseGraderJson(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?[ \t]*\r?\n?([\s\S]*)\r?\n?[ \t]*```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      const inner = parseOutermostObject(fenced[1].trim())
      if (inner !== undefined) return inner
    }
  }
  const outer = parseOutermostObject(trimmed)
  if (outer !== undefined) return outer
  throw new Error('Failed to parse grader response as JSON')
}

const KNOWN_FIELDS = new Set(['coachingSummary', 'whatThisMeans', 'tipsIntro', 'tip1', 'tip2'])
const KNOWN_KINDS = new Set(['swingValue', 'threshold', 'subset', 'range', 'sessionStat', 'other'])
// pitchHeight and pitchSide are readable per swing but have no precomputed
// threshold rows, so a whole-session count about them comes back
// UNVERIFIABLE while a single-swing citation can be checked. Added
// 18 August 2026: without them the extractor had no honest label for "a pitch
// 0.6 feet off the ground" and graded it against the swing's direction.
const KNOWN_METRICS = new Set(['exitVelocity', 'launchAngle', 'direction', 'distance', 'pitchHeight', 'pitchSide'])

// Accepts a numeric string as well as a number, because the extraction model
// intermittently emits numbers as strings, and silently dropping "1" is worse
// than reading it: a claim about session "1" that loses its session number
// gets re-defaulted to the viewing session and graded against the wrong data,
// which review demonstrated turns a true claim FALSE. Anything non-numeric
// still becomes undefined rather than a guess.
const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}
const swingList = (v) => (Array.isArray(v) ? v.map(num).filter((n) => n !== undefined) : undefined)

// Raw model output is a claim, not a fact about its own shape. Every extracted
// claim is normalized here rather than trusted: an unrecognized kind, a
// missing quote or a non-numeric count becomes a claim the verdict code will
// refuse to rule on, instead of throwing and losing every other claim in the
// same response.
//
// The model no longer supplies a verdict, so there is nothing here to
// second-guess it about. What used to be verdict validation is now shape
// validation, which is the whole point of the split.
function normalizeClaims(rawClaims) {
  const list = Array.isArray(rawClaims) ? rawClaims : []
  let malformedCount = 0
  const claims = list.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      malformedCount++
      return { field: 'unknown', quote: '(malformed claim entry)', kind: 'other', note: `Claim #${i + 1} was not an object.` }
    }
    const problems = []
    const field = KNOWN_FIELDS.has(raw.field) ? raw.field : 'unknown'
    if (!KNOWN_FIELDS.has(raw.field)) problems.push(`unrecognized field "${raw.field}"`)
    const quote = typeof raw.quote === 'string' && raw.quote.trim() ? raw.quote : '(no quote given)'
    if (quote === '(no quote given)') problems.push('missing quote')
    // An unrecognized kind degrades to 'other', which the verdict code answers
    // UNVERIFIABLE. It never degrades to a guess at what the model meant.
    const kind = KNOWN_KINDS.has(raw.kind) ? raw.kind : 'other'
    if (!KNOWN_KINDS.has(raw.kind)) problems.push(`unrecognized kind "${raw.kind}"`)
    const metric = KNOWN_METRICS.has(raw.metric) ? raw.metric : undefined

    if (problems.length) malformedCount++
    return {
      field,
      quote,
      kind,
      metric,
      sessionNumber: num(raw.sessionNumber),
      swingNumber: num(raw.swingNumber),
      threshold: num(raw.threshold),
      min: num(raw.min),
      max: num(raw.max),
      comparison: typeof raw.comparison === 'string' ? raw.comparison : undefined,
      statedValue: num(raw.statedValue),
      statedCount: num(raw.statedCount),
      statedSwings: swingList(raw.statedSwings),
      ofSwings: swingList(raw.ofSwings),
      statName: typeof raw.statName === 'string' ? raw.statName : undefined,
      note: problems.length ? `Normalized from a malformed extraction (${problems.join('; ')}).` : undefined,
    }
  })
  return { claims, malformedCount }
}

// Parses, normalizes, then RULES IN CODE. Never throws for a malformed claim
// body; it throws only when the whole response is not JSON at all, which the
// caller treats as a hard failure for that record (excluded from the report,
// not silently graded as clean).
//
// A claim with no session number defaults to the session being debriefed,
// matching the extraction prompt's own instruction. Done here rather than in
// claimVerdict.js so the verdict module stays a pure function of the claim it
// is handed.
function gradeParsedResponse(text, factSheet, context) {
  const parsed = parseGraderJson(text)
  const { claims, malformedCount } = normalizeClaims(parsed?.claims)
  const graded = claims.map((claim) => {
    const withSession = claim.sessionNumber === undefined
      ? { ...claim, sessionNumber: factSheet?.viewingSessionNumber }
      : claim
    const { verdict, actual, why } = verdictForClaim(withSession, factSheet, context)
    return { ...withSession, verdict, actual, reasoning: why }
  })
  const flagged = graded.some((c) => c.verdict === 'FALSE')
  return { claims: graded, flagged, malformedCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// The live model call
// ─────────────────────────────────────────────────────────────────────────────

async function callGraderModel({ system, user, apiKey, model }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: GRADER_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic returned ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text
  const usage = data.usage ?? {}
  // Slice 8, Task 4. The 17 August 2026 run lost 3 of 96 records to
  // "response was not JSON at all" and could say nothing about why, because
  // neither of these two values was kept. That matters more than tidiness: if
  // the cause is truncation at GRADER_MAX_TOKENS, the losses cluster on the
  // debriefs carrying the most claims, which is a BIASED loss, not a random
  // one, and it lands hardest on exactly the debriefs most likely to contain
  // an error. One of the three lost records was a known-wrong one.
  //
  // Same blind spot scripts/coachFailureRecord.js closed for the bench in
  // Slice 7b, in a script written the same week.
  const diagnosis = {
    stopReason: data.stop_reason ?? null,
    outputTokens: usage.output_tokens ?? null,
    maxTokens: GRADER_MAX_TOKENS,
    truncated: data.stop_reason === 'max_tokens',
  }
  if (!text) {
    const err = new Error('No text content in the response')
    err.diagnosis = diagnosis
    throw err
  }
  return { text, usage, diagnosis }
}

async function gradeDebrief(record, { factSheet, goal, apiKey, model }) {
  const { system, user } = buildGraderPrompt(record, factSheet, goal)
  const { text, usage, diagnosis } = await callGraderModel({ system, user, apiKey, model })
  try {
    const graded = gradeParsedResponse(text, factSheet, { goalId: goal?.id })
    return { ...graded, usage, diagnosis }
  } catch (err) {
    // Attach what the response looked like, so a hard failure is diagnosable
    // rather than just counted. Kept short: the point is the stop reason and
    // the size, not an archive of the reply. Only for genuine parse failures;
    // an error from the verdict layer keeping its own message stops a local
    // bug masquerading as a bad model reply.
    if (err.message === 'Failed to parse grader response as JSON') {
      err.diagnosis = { ...diagnosis, replyChars: text.length, replyTail: text.slice(-200) }
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

const recordId = (r) => `${r.conditionKey}/${r.cell}/run${r.run}`

// Cache writes bill at 1.25x the input rate on the 5 minute TTL and reads at
// 0.1x, so a run that caches has to price three buckets rather than one.
// Numbers from the Anthropic pricing documentation, read 17 August 2026.
const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.1

function costOf(model, inputTokens, outputTokens, cacheWriteTokens = 0, cacheReadTokens = 0) {
  const rates = PRICING[model] ?? FALLBACK_PRICING
  return (
    (inputTokens / 1e6) * rates.input +
    (cacheWriteTokens / 1e6) * rates.input * CACHE_WRITE_MULTIPLIER +
    (cacheReadTokens / 1e6) * rates.input * CACHE_READ_MULTIPLIER +
    (outputTokens / 1e6) * rates.output
  )
}

function printReport({ model, results, inputTokens, outputTokens, cacheWriteTokens = 0, cacheReadTokens = 0, source, builder }) {
  console.log('')
  console.log('='.repeat(70))
  console.log('GRADING REPORT')
  console.log('='.repeat(70))
  console.log(`Model            ${model}`)
  console.log(`Records source   ${source} (builder: ${builder})`)
  console.log(`Records graded   ${results.length}`)

  const failures = results.filter((r) => r.error)
  const ok = results.filter((r) => !r.error)
  const flagged = ok.filter((r) => r.flagged)
  const totalClaims = ok.reduce((s, r) => s + r.claims.length, 0)
  const byVerdict = { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 }
  for (const r of ok) for (const c of r.claims) byVerdict[c.verdict]++
  const totalMalformed = ok.reduce((s, r) => s + r.malformedCount, 0)

  console.log('')
  console.log(`Claims found     ${totalClaims} (TRUE ${byVerdict.TRUE}, FALSE ${byVerdict.FALSE}, UNVERIFIABLE ${byVerdict.UNVERIFIABLE})`)
  if (totalMalformed) {
    console.log(`Malformed claims ${totalMalformed} model claim(s) did not parse cleanly and were normalized to UNVERIFIABLE; see reasoning text.`)
  }
  if (failures.length) {
    console.log(`Hard failures    ${failures.length} record(s) whose response was not JSON at all (excluded above): ${failures.map((r) => recordId(r.record)).join(', ')}`)
    // Whether the loss is random or biased. Truncation clusters on the
    // debriefs carrying the most claims, so a truncated failure is not a
    // record that happened to drop out; it is disproportionately likely to be
    // one of the interesting ones.
    const truncated = failures.filter((r) => r.diagnosis?.truncated)
    if (truncated.length) {
      console.log(`                 ${truncated.length} of those hit the ${GRADER_MAX_TOKENS}-token output ceiling. That is a BIASED loss, not a random one: read the flagged counts below as a floor.`)
    } else if (failures.some((r) => r.diagnosis)) {
      console.log(`                 none hit the output ceiling; stop reasons: ${[...new Set(failures.map((r) => r.diagnosis?.stopReason ?? 'unknown'))].join(', ')}`)
    }
  }

  // The narrowing this instrument makes, reported rather than absorbed. The
  // verdict code rules only on claim shapes it understands, so a high
  // UNVERIFIABLE rate means the run reached less of the coach's prose than the
  // claim count suggests.
  const unverifiable = ok.flatMap((r) => r.claims).filter((c) => c.verdict === 'UNVERIFIABLE')
  const otherKind = unverifiable.filter((c) => c.kind === 'other').length
  if (unverifiable.length) {
    console.log(`Not reached      ${unverifiable.length} claim(s) the verdict code could not rule on (${otherKind} the extractor could not structure at all). Judge the run's coverage by this number, not just by the claim count.`)
  }

  console.log('')
  console.log('='.repeat(70))
  console.log(`FLAGGED DEBRIEFS: ${flagged.length} of ${ok.length}`)
  console.log('='.repeat(70))
  console.log('This script does not know which records are known-wrong. It only')
  console.log('reports what it flagged; comparing that list to ground truth is the')
  console.log('controller\'s job, done blind, once.')
  console.log('')
  if (!flagged.length) {
    console.log('(nothing flagged)')
  }
  for (const r of flagged) {
    console.log(`  ${recordId(r.record)}`)
    for (const c of r.claims.filter((c) => c.verdict === 'FALSE')) {
      console.log(`    [${c.field}] "${c.quote}"`)
      console.log(`      actual: ${c.actual}`)
      console.log(`      why: ${c.reasoning}`)
    }
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('COST')
  console.log('='.repeat(70))
  const cost = costOf(model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
  console.log(`${inputTokens} input + ${outputTokens} output tokens = $${cost.toFixed(4)}`)
  if (cacheWriteTokens || cacheReadTokens) {
    const uncachedCost = costOf(model, inputTokens + cacheWriteTokens + cacheReadTokens, outputTokens)
    console.log(`  cache: ${cacheWriteTokens} written, ${cacheReadTokens} read`)
    console.log(`  without caching this run would have cost $${uncachedCost.toFixed(4)}`)
  } else {
    console.log('  cache: none (expected; the blind extraction prompt is below the cacheable minimum)')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --dry-run: every path but the network
// ─────────────────────────────────────────────────────────────────────────────

async function dryRun(args) {
  console.log('DRY RUN. No API calls, no spend. Exercising every path but the network.')
  console.log('')

  // 0. When --input names a real directory, show exactly what a live run
  // would grade and what it would cost in calls, before a cent is spent.
  // This is the plan for THIS invocation's flags; the numbered sections
  // after it are the standing self-checks and run regardless.
  if (args.input) {
    const { records, skippedFailed, builder, source } = resolveRecordsAndBuilder(args)
    const subset = selectSubset(records, args)
    console.log('Planned --input run')
    console.log('-'.repeat(70))
    console.log(`  records source   ${source} (builder: ${builder})`)
    if (skippedFailed.length) {
      console.log(`  set aside        ${skippedFailed.length} failed bench record(s), never graded`)
    }
    console.log(`  planned calls    ${subset.length} of ${records.length} gradeable records`)
    console.log('')
  }

  // 1. Both session builders, against real project data.
  console.log('Session builders')
  console.log('-'.repeat(70))
  const frozen = await resolveSessions({ builder: 'frozen', cellKey: 'power-s2' })
  console.log(
    `  frozen  / power-s2   ${frozen.sessions.length} sessions, ` +
    `${frozen.sessions.reduce((s, ss) => s + ss.swings.length, 0)} total swings, ` +
    `goal ${frozen.goal.id}, viewing session ${frozen.viewingSessionNumber}`,
  )
  const current = await resolveSessions({ builder: 'current', cellKey: 'power-s1', seed: 20260814 })
  console.log(
    `  current / power-s1   ${current.sessions.length} sessions, ` +
    `${current.sessions.reduce((s, ss) => s + ss.swings.length, 0)} total swings, ` +
    `goal ${current.goal.id}, viewing session ${current.viewingSessionNumber}`,
  )
  if (current.sessions[0].swings.length !== 15 || frozen.sessions[0].swings.length !== 15) {
    throw new Error('Session builder self-check failed: expected 15 swings in session 1 for both builders.')
  }
  // The two cells Slice 8b added. Resolved here so a typo in their
  // CURRENT_CELLS entries fails a free dry run rather than a paid grading
  // run. Only the current builder knows them: the frozen fixture predates
  // both goals, so they are deliberately absent from its CELLS.
  for (const newCellKey of ['allfields-s4', 'popup-s4']) {
    const cell = await resolveSessions({ builder: 'current', cellKey: newCellKey, seed: 20260814 })
    console.log(
      `  current / ${newCellKey.padEnd(12)} ${cell.sessions.length} sessions, ` +
      `${cell.sessions.reduce((s, ss) => s + ss.swings.length, 0)} total swings, ` +
      `goal ${cell.goal.id}, viewing session ${cell.viewingSessionNumber}`,
    )
    if (cell.sessions.length !== 4) {
      throw new Error(`Session builder self-check failed: expected 4 sessions for ${newCellKey}.`)
    }
  }

  // 2. Builder-selection guardrails, exercised without ever making a real call.
  console.log('')
  console.log('Builder-selection guardrails')
  console.log('-'.repeat(70))
  let guardOk = 0
  try {
    resolveRecordsAndBuilder({ records: null, builder: 'current' })
    console.log('  FAILED: expected an error for --builder current with no --records')
  } catch (err) {
    guardOk++
    console.log(`  ok: default records + --builder current refused ("${err.message.slice(0, 60)}...")`)
  }
  try {
    resolveRecordsAndBuilder({ records: 'somefile.json', builder: null })
    console.log('  FAILED: expected an error for --records with no --builder')
  } catch (err) {
    guardOk++
    console.log(`  ok: --records with no --builder refused ("${err.message.slice(0, 60)}...")`)
  }
  try {
    resolveRecordsAndBuilder({ input: 'somedir', builder: null })
    console.log('  FAILED: expected an error for --input with no --builder')
  } catch (err) {
    guardOk++
    console.log(`  ok: --input with no --builder refused ("${err.message.slice(0, 60)}...")`)
  }
  try {
    resolveRecordsAndBuilder({ records: 'somefile.json', input: 'somedir', builder: 'current' })
    console.log('  FAILED: expected an error for --records and --input together')
  } catch (err) {
    guardOk++
    console.log(`  ok: --records and --input together refused ("${err.message.slice(0, 60)}...")`)
  }
  if (guardOk !== 4) throw new Error('Builder-selection guardrail self-check failed.')

  // 3. Build the real fact sheet and the real prompt for one record, report sizes.
  console.log('')
  console.log('Fact sheet and prompt sizes (real data, one record)')
  console.log('-'.repeat(70))
  const extraThresholds = goalExtraThresholds(frozen.goal.id)
  const factSheet = buildFactSheet({
    sessions: frozen.sessions,
    viewingSessionNumber: frozen.viewingSessionNumber,
    extraThresholds,
  })
  const sampleRecord = {
    conditionKey: 'dryrun',
    cell: 'power-s2',
    run: 0,
    fields: {
      coachingSummary: 'You hit 92 mph on swing 4 and drove it 310 feet.',
      whatThisMeans: 'That is real power, and 6 of your 15 swings came in above 20 degrees.',
      tipsIntro: 'Two things before next round.',
      tip1: 'Swing 12 came off at 80 mph. Stay back a half beat longer.',
      tip2: 'Your average exit velocity was 84 mph. Keep driving through the ball.',
    },
  }
  const { system, user } = buildGraderPrompt(sampleRecord, factSheet, frozen.goal)
  const thresholdRowCount = Object.values(factSheet.sessions[0].thresholds).reduce((s, arr) => s + arr.length, 0)
  console.log(`  sessions in fact sheet   ${factSheet.sessions.length}`)
  console.log(`  threshold rows/session   ${thresholdRowCount}`)
  console.log(`  system prompt            ${system.length} chars`)
  console.log(`  user prompt              ${user.length} chars (debrief fields only; the fact sheet goes to the verdict code, never the model)`)

  // Blindness, checked rather than assumed: the whole point of the second
  // rebuild is that the extractor never sees the session data, so a fact
  // sheet reappearing in this prompt would silently reintroduce the peeking
  // that let it repair the coach's transposition errors before grading.
  if (user.includes('FACT SHEET') || user.includes('"thresholds"')) {
    throw new Error('Self-check failed: the extraction prompt contains session data. The extractor must be blind.')
  }
  console.log(`  extractor is blind       true (no session data in the prompt)`)

  // Canned EXTRACTIONS now, not canned verdicts: the model no longer supplies
  // a verdict, so what these prove is that the code rules correctly on a
  // claim it is handed. They are written against the real fact sheet built
  // above, so a wrong expectation here is a real failure and not a typo.
  const s1 = factSheet.sessions[0]
  const realSwing = s1.swings[3]
  const trueRow = s1.thresholds.launchAngle.find((r) => r.threshold === 20)

  const cleanMixed = JSON.stringify({
    claims: [
      { field: 'coachingSummary', quote: `swing 4 hit ${realSwing.exitVelocity} mph`, kind: 'swingValue', sessionNumber: s1.sessionNumber, swingNumber: 4, metric: 'exitVelocity', statedValue: realSwing.exitVelocity },
      { field: 'whatThisMeans', quote: 'lots of your swings above 20 degrees', kind: 'threshold', sessionNumber: s1.sessionNumber, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: trueRow.above.count + 2 },
      { field: 'tip1', quote: 'your best swing this session', kind: 'other' },
    ],
  })
  const cleanMixedResult = gradeParsedResponse(cleanMixed, factSheet)
  console.log(`  mixed extraction    -> ${cleanMixedResult.claims.length} claims, flagged=${cleanMixedResult.flagged} (expect 3 claims, flagged=true)`)
  if (cleanMixedResult.claims.length !== 3 || cleanMixedResult.flagged !== true) {
    throw new Error('Self-check failed: mixed canned extraction did not grade as expected.')
  }
  const verdicts = cleanMixedResult.claims.map((c) => c.verdict).join(',')
  if (verdicts !== 'TRUE,FALSE,UNVERIFIABLE') {
    throw new Error(`Self-check failed: expected TRUE,FALSE,UNVERIFIABLE from the code, got ${verdicts}.`)
  }

  const allTrue = JSON.stringify({
    claims: [{ field: 'tip2', quote: `average exit velocity was ${s1.stats.avgExitVelocity} mph`, kind: 'sessionStat', sessionNumber: s1.sessionNumber, statName: 'avgExitVelocity', statedValue: s1.stats.avgExitVelocity }],
  })
  const allTrueResult = gradeParsedResponse(allTrue, factSheet)
  console.log(`  all-true extraction -> flagged=${allTrueResult.flagged} (expect false)`)
  if (allTrueResult.flagged !== false) throw new Error('Self-check failed: an all-TRUE response was flagged.')

  const noClaims = JSON.stringify({ claims: [] })
  const noClaimsResult = gradeParsedResponse(noClaims, factSheet)
  console.log(`  no-claims response  -> ${noClaimsResult.claims.length} claims, flagged=${noClaimsResult.flagged} (expect 0, false)`)
  if (noClaimsResult.claims.length !== 0 || noClaimsResult.flagged !== false) {
    throw new Error('Self-check failed: an empty-claims response did not grade as empty.')
  }

  // The shape that mattered most in the failed run: garbage must never become
  // FALSE. It becomes UNVERIFIABLE, which is what the code does by
  // construction rather than because a prompt asked nicely.
  const malformed = JSON.stringify({
    claims: [
      { field: 'nope', quote: '', kind: 'wishful', statedCount: 'lots' },
      'not even an object',
    ],
  })

  // Numeric strings survive normalization instead of being dropped; review
  // showed a dropped session number silently re-targets the viewing session.
  const stringyNums = JSON.stringify({
    claims: [
      { field: 'tip1', quote: 'one swing below 15 in session 1', kind: 'threshold', sessionNumber: '1', metric: 'launchAngle', threshold: '15', comparison: 'below', statedCount: '1' },
    ],
  })
  const stringyResult = gradeParsedResponse(stringyNums, factSheet)
  const sc = stringyResult.claims[0]
  console.log(`  stringy numbers     -> sessionNumber=${sc.sessionNumber}, threshold=${sc.threshold}, statedCount=${sc.statedCount} (expect 1, 15, 1)`)
  if (sc.sessionNumber !== 1 || sc.threshold !== 15 || sc.statedCount !== 1) {
    throw new Error('Self-check failed: numeric strings were not coerced during normalization.')
  }
  const malformedResult = gradeParsedResponse(malformed, factSheet)
  console.log(
    `  malformed response  -> ${malformedResult.claims.length} claims, ` +
    `${malformedResult.malformedCount} normalized as malformed, every verdict UNVERIFIABLE=` +
    `${malformedResult.claims.every((c) => c.verdict === 'UNVERIFIABLE')} (expect 2, 2, true)`,
  )
  if (
    malformedResult.claims.length !== 2 ||
    malformedResult.malformedCount !== 2 ||
    !malformedResult.claims.every((c) => c.verdict === 'UNVERIFIABLE')
  ) {
    throw new Error('Self-check failed: a malformed response was not fully normalized to UNVERIFIABLE.')
  }

  const notJsonAtAll = 'Sorry, I cannot help with that.'
  let threwOnGarbage = false
  try {
    gradeParsedResponse(notJsonAtAll, factSheet)
  } catch {
    threwOnGarbage = true
  }
  console.log(`  non-JSON response   -> throws=${threwOnGarbage} (expect true; caller records this as a hard failure, not a clean grade)`)
  if (!threwOnGarbage) throw new Error('Self-check failed: a non-JSON response did not throw.')

  // 5. Run the real --validate pipeline end to end against two real fixture
  // records, substituting a canned response for the network call, so the
  // load -> resolve -> fact-sheet -> prompt -> parse -> report path is
  // exercised in full, not just its pieces.
  console.log('')
  console.log('End-to-end --validate pipeline (2 real fixture records, canned response)')
  console.log('-'.repeat(70))
  const { records, builder, source } = resolveRecordsAndBuilder({ records: null, builder: null })
  const subset = selectSubset(records, { limit: 2, sample: null })
  const cellCache = new Map()
  const results = []
  let inputTokens = 0
  let outputTokens = 0
  for (const record of subset) {
    if (!cellCache.has(record.cell)) {
      const resolved = await resolveSessions({ builder, cellKey: record.cell })
      const sheet = buildFactSheet({
        sessions: resolved.sessions,
        viewingSessionNumber: resolved.viewingSessionNumber,
        extraThresholds: goalExtraThresholds(resolved.goal.id),
        goalId: resolved.goal.id,
      })
      cellCache.set(record.cell, { factSheet: sheet, goal: resolved.goal })
    }
    const { factSheet: sheet, goal } = cellCache.get(record.cell)
    buildGraderPrompt(record, sheet, goal) // built, not sent — proves the real record's fields reach the prompt builder
    const graded = gradeParsedResponse(allTrue, sheet) // canned, no network
    inputTokens += 500
    outputTokens += 80
    results.push({ record, ...graded })
  }
  printReport({ model: `${args.model} (dry run, canned responses)`, results, inputTokens, outputTokens, source, builder })

  console.log('')
  console.log('Every path exercised. Drop --dry-run and add --validate to spend money.')
}

// ─────────────────────────────────────────────────────────────────────────────
// --validate: the real thing
// ─────────────────────────────────────────────────────────────────────────────

async function validate(args) {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('No VITE_ANTHROPIC_API_KEY in the environment.')
    console.error('Run this as: node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate')
    process.exit(1)
  }

  const { records, skippedFailed, builder, source } = resolveRecordsAndBuilder(args)
  const subset = selectSubset(records, args)

  if (subset.length > MAX_PLANNED_CALLS) {
    console.error(`Refusing to plan ${subset.length} calls; the cap is ${MAX_PLANNED_CALLS}.`)
    console.error('Lower --limit/--sample.')
    process.exit(1)
  }

  console.log('B1 coach accuracy grader')
  console.log('='.repeat(70))
  console.log(`Model            ${args.model}`)
  console.log(`Records source   ${source} (builder: ${builder})`)
  if (skippedFailed?.length) {
    console.log(`Set aside        ${skippedFailed.length} failed bench record(s) with no debrief to grade`)
  }
  console.log(`Records to grade ${subset.length} of ${records.length} available`)
  console.log(`Rough cost       $${(subset.length * 0.01).toFixed(2)} at a rough ~1 cent/debrief guess; the real total prints at the end`)
  console.log('')

  const cellCache = new Map()
  const results = []
  let inputTokens = 0
  let outputTokens = 0
  let cacheWriteTokens = 0
  let cacheReadTokens = 0

  for (const record of subset) {
    const id = recordId(record)
    process.stdout.write(`  ${id}... `)
    try {
      if (!cellCache.has(record.cell)) {
        const resolved = await resolveSessions({ builder, cellKey: record.cell, seed: args.seed })
        const factSheet = buildFactSheet({
          sessions: resolved.sessions,
          viewingSessionNumber: resolved.viewingSessionNumber,
          extraThresholds: goalExtraThresholds(resolved.goal.id),
          goalId: resolved.goal.id,
        })
        cellCache.set(record.cell, { factSheet, goal: resolved.goal })
      }
      const { factSheet, goal } = cellCache.get(record.cell)
      const graded = await gradeDebrief(record, { factSheet, goal, apiKey, model: args.model })
      inputTokens += graded.usage.input_tokens ?? 0
      outputTokens += graded.usage.output_tokens ?? 0
      cacheWriteTokens += graded.usage.cache_creation_input_tokens ?? 0
      cacheReadTokens += graded.usage.cache_read_input_tokens ?? 0
      results.push({ record, ...graded })
      console.log(`${graded.claims.length} claims, flagged=${graded.flagged}`)
    } catch (err) {
      // Slice 8, Task 4: keep WHY, not just THAT. A stop reason of
      // 'max_tokens' means the loss is biased toward the debriefs with the
      // most claims rather than randomly scattered, which changes what the
      // run's numbers are allowed to say.
      const d = err.diagnosis ?? null
      const suffix = d ? ` [stop=${d.stopReason}, out=${d.outputTokens}/${d.maxTokens}${d.truncated ? ', TRUNCATED' : ''}]` : ''
      console.log(`FAILED: ${err.message}${suffix}`)
      results.push({ record, error: err.message, diagnosis: d, claims: [], flagged: false, malformedCount: 0 })
    }
  }

  printReport({ model: args.model, results, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, source, builder })

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(results, null, 2))
    console.log('')
    console.log(`Raw results      ${args.out}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dryRun: false,
    validate: false,
    records: null,
    input: null,
    builder: null,
    limit: null,
    sample: null,
    seed: 20260814,
    model: DEFAULT_MODEL,
    out: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (flag === '--validate') {
      args.validate = true
      continue
    }
    const value = argv[i + 1]
    i += 1
    if (flag === '--records') args.records = value
    else if (flag === '--input') args.input = value
    else if (flag === '--builder') args.builder = value
    else if (flag === '--limit') args.limit = Number(value)
    else if (flag === '--sample') args.sample = Number(value)
    else if (flag === '--seed') args.seed = Number(value)
    else if (flag === '--model') args.model = value
    else if (flag === '--out') args.out = value
    else throw new Error(`Unknown flag: ${flag}`)
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.dryRun) {
    await dryRun(args)
    return
  }
  if (args.validate) {
    await validate(args)
    return
  }

  console.error('Pass --dry-run (exercises every path, spends nothing) or --validate (spends real money).')
  console.error('Example: node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate --sample 40')
  process.exit(1)
}

await main()
