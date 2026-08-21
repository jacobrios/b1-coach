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
//
// Slice 9's three rounds, for the record:
//   --input docs/eval-fixtures/slice9-session-one/before  --builder slice9-before --seed 20260814
//   --input docs/eval-fixtures/slice9-session-one/after-a --builder current       --seed 20260814
//   --input docs/eval-fixtures/slice9-session-one/after-b --builder current       --seed 20260819
// (Dated correction, 20 August 2026, Slice 11: the two "current" lines above
// are what was run on the day and are left standing as the record of it, but
// they are no longer the right command. Both rounds now take
// --builder slice11-before, because "current" has since come to mean a
// different swing generator. So do Slice 10's two rounds. See the fourth
// section of the session-builders comment below.)
// NOTE THE THIRD SEED. Round B was generated at a different seed from the
// other two and from this script's own default. Each of those directories
// carries a BUILDER.txt naming its own builder AND its own seed, so both
// flags are checked rather than trusted, and both can be omitted entirely.
// See the session-builders section below.
// --out writes { meta, results }, where meta = { generatedAt, model, source,
// builder, seed, handedEra }. Files written before 19 August 2026 are bare
// arrays; this change makes a committed grading run prove from its own
// contents which flags produced it.
// THIS SPENDS REAL MONEY in --validate mode without --dry-run. It prints the
// planned call count and model before spending a cent, and refuses outright
// to plan more than MAX_PLANNED_CALLS.
//
// --handed-era slice8b|current (default current). Which prompt era's set of
// handed thresholds, ranges and stat names to grade a FALSE claim against
// when splitting the report into "contradicted a number the prompt handed
// the coach" versus "self-derived". Pass --handed-era slice8b only when the
// records being graded were generated by the Slice 8b prompt, before the
// fly-ball threshold moved from 20 to 18 and before the strike-zone count
// lines existed. Grading a Slice 8c record with era slice8b, or a Slice 8b
// record with era current, misclassifies which claims were handed.
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
import { fileURLToPath, pathToFileURL } from 'node:url'
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
import { handedClaimSpecs, eraExtraThresholds } from './handedCounts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_DIR = path.join(REPO_ROOT, 'docs/eval-fixtures/slice7-debriefs')
const SLICE9_DIR = path.join(REPO_ROOT, 'docs/eval-fixtures/slice9-session-one')
const SLICE10_DIR = path.join(REPO_ROOT, 'docs/eval-fixtures/slice10-direction-key')
// Snapshots that belong to no single round, because more than one round
// depends on them. The pre-Slice-11 generator is the first of them.
const FROZEN_DIR = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen')

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
// Session builders: frozen, slice9-before, slice11-before, current
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
// *** THE SAME HAZARD RECURRED ONE GENERATION LATER, 19 AUGUST 2026. ***
// Slice 9 REPLACED all fifteen swings in src/sessionOneSwings.js. Its
// before round (docs/eval-fixtures/slice9-session-one/before/) was generated
// against the OLD fifteen; its after rounds against the NEW fifteen. The
// "current" builder reads the working tree, so grading the before round with
// --builder current would check claims written about the old swings against
// facts derived from the new ones, and for the 24 session-1 records in that
// round the entire fact sheet would be wrong while every verdict still
// looked plausible. Hence a THIRD builder, "slice9-before", which reads a
// frozen snapshot of the old fifteen
// (docs/eval-fixtures/slice9-session-one/session-one-before.mjs) instead of
// the working tree. It shares every line of session-construction logic with
// the current builder and differs in nothing but which fifteen swings it
// starts from.
//
// *** AND IT RECURRED AGAIN, IN A NEW PLACE, 20 AUGUST 2026. ***
// See the fourth section below, "A builder is a pair now." Everything above
// this line is about WHICH FIFTEEN SWINGS a round started from. That turned
// out to be only half of what the working tree contributes.
//
// Which builder goes with which records:
//   frozen          docs/eval-fixtures/slice7-debriefs (the 96-debrief fixture)
//   slice9-before   docs/eval-fixtures/slice9-session-one/before
//   slice11-before  docs/eval-fixtures/slice9-session-one/after-a and after-b,
//                   docs/eval-fixtures/slice10-direction-key/after and
//                   after-spray. All four said "current" until 20 August 2026;
//                   see below for what changed and why it is not a rename.
//   current         anything produced by the bench against today's working
//                   tree, and nothing that is already committed
//
// The flag design makes the choice unavoidable rather than defaulted:
//   - No --records flag (the default: grade the 96-debrief fixture) locks
//     the builder to "frozen" outright. Passing any other --builder in this
//     mode is refused with an error, because that combination is exactly
//     the mistake that would silently produce wrong verdicts against the
//     fixture's own ground truth.
//   - A --records or --input flag REQUIRES an explicit --builder, unless the
//     records carry a provenance marker (see below). There is no default,
//     on purpose: a silent default here is the one mistake with no error
//     message to catch it, since every builder produces a plausible-looking
//     fact sheet, just for the wrong swings.
//   - A records directory may commit a BUILDER.txt naming the builder its
//     debriefs were written against. When one is present, a --builder flag
//     that disagrees with it is refused outright rather than obeyed. That is
//     the only fully enforceable guard available here: a bench record
//     carries no field saying which session-1 swings produced it, so nothing
//     in the records themselves can be checked against the working tree.
//     The marker is committed beside the records by whoever generated them,
//     which is the one moment the answer is actually known. See
//     readBuilderMarker below.
//
// *** A BUILDER IS A PAIR NOW, NOT A BASELINE. 20 AUGUST 2026, SLICE 11. ***
//
// Every paragraph above this one treats a builder as an answer to one
// question: which fifteen session-1 swings did this round start from. That
// framing was wrong, and it was wrong from the day the second builder was
// added; it simply could not be noticed while only session 1 ever moved.
//
// Sessions 2, 3 and 4 are not stored anywhere either. They are GENERATED
// from session 1, by src/swingGenerator.js, read out of the working tree.
// So a builder has always depended on two moving parts, and only one of them
// was pinned. Slice 11 rewrites the generator (the link between where a
// pitch was and how well it was struck, the pull and opposite-field bias,
// and the pop-up ceiling). The moment it lands, four committed rounds that
// said "current" would rebuild sessions 2 to 4 from the new generator while
// their session 1 stayed correct: a complete, entirely plausible fact sheet
// covering 40 of every 64 records, describing swings no coach ever saw, with
// nothing appearing broken. This is the identical failure the two sections
// above describe, arriving through the other door.
//
// So a builder is now a PAIR: which baseline, and which generator.
//
//   current          live baseline, live generator
//   slice11-before   live baseline, frozen generator
//   slice9-before    frozen baseline, frozen generator
//
// The frozen generator is
// docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs, recovered from
// commit 53315e5. It imports nothing from src/ at all, carrying its own
// frozen copies of the carry formula and the goal target table, because a
// snapshot that reaches into the live app for half its behaviour would drift
// the first time a target band moved by a degree. Exactly what it produces,
// for every cell at every seed, is written down in
// docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json and re-checked
// on every npm test by scripts/frozenGenerator.test.js.
//
// slice9-before was REPOINTED, not renamed, and the distinction matters if
// you are reading its marker. That builder's meaning was always "what that
// round was written against", and what that round was written against now
// requires the frozen generator too. Its BUILDER.txt still says
// slice9-before and always will; only its meaning was completed.
//
// THE NEXT QUESTION A READER ASKS: what about computeStats? It still comes
// from the working tree, in every builder, deliberately. computeStats is not
// part of the generator; it summarises swings that have already been
// decided, and src/sessionStats.js is not touched by this slice. If a future
// slice does change how a session is summarised, that is a third moving part
// and it needs its own answer, not a quiet extension of this one.

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
//
// One cell list, shared by the two baseline-driven builders (current and
// slice9-before): a cell says which goal and which session number, and both
// builders answer that question the same way. Only the fifteen baseline
// swings differ.
export const CURRENT_CELLS = [
  { key: 'power-s1', goal: { id: 'power', label: 'Power & Distance' }, session: 1 },
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2 },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4 },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4 },
  // The two cells Slice 8b added to the bench, kept in step by hand like the
  // rest of this list. Without them a bench round containing either goal
  // would fail to resolve here and the round could not be graded at all.
  { key: 'allfields-s4', goal: { id: 'allfields', label: 'Hit to All Fields' }, session: 4 },
  { key: 'popup-s4', goal: { id: 'popup', label: 'Reduce Pop-Ups' }, session: 4 },
  // The cell Slice 9 added to the bench, same hand-kept convention. The label
  // was checked against the real GOALS array in src/App.jsx, which this
  // script cannot import. Without this entry every Slice 9 round fails to
  // resolve on 12 of its 64 records and cannot be graded at all.
  { key: 'contact-s1', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 1 },
]

// The live generator: what a bench round run today is written about.
let _currentGenerator = null
async function loadCurrentGenerator() {
  if (_currentGenerator) return _currentGenerator
  const { generateSwings } = await import(`${REPO_ROOT}/src/swingGenerator.js`)
  _currentGenerator = generateSwings
  return _currentGenerator
}

// The frozen pre-Slice-11 generator: what every round committed before
// 20 August 2026 is written about. A committed snapshot, never the working
// tree, for the reason its own header spells out at length.
//
// THE PATH IS AN EXPORTED CONSTANT RATHER THAN A STRING INSIDE THE LOADER,
// AND THAT IS LOAD-BEARING RATHER THAN TIDINESS.
//
// scripts/frozenGenerator.test.js hashes this snapshot to prove it has not
// moved. It computes the path to hash itself. Until 20 August 2026 nothing
// tied the two together, so the test hashed a path it worked out and the
// loader imported a path IT worked out, and a change to one was invisible to
// the other. Measured, not argued: repointing this loader at a copy of the
// snapshot carrying a mutated carryDistance floor left `npm test` reporting
// 597 passed across 23 files, while the file actually being imported ran
// 0.40 and the file being hashed ran 0.55. The hash was guarding a file
// nothing read.
//
// The realistic way that happens is not tampering. It is a future slice
// adding a second snapshot beside this one and repointing this loader, while
// the test's own copy of the path stays exactly where it is.
//
// So the test now imports this constant and asserts it equals the path it
// resolved independently. Same shape src/sessionStats.test.js already uses to
// hold src/DebriefScreen.jsx's hardcoded cutoffs to SPRAY_CUTOFFS: two
// independent definitions, held equal by a test, so a drift is loud.
export const PRE_SLICE11_SNAPSHOT_PATH = path.join(
  FROZEN_DIR,
  'swing-generator-pre-slice11.mjs',
)

let _preSlice11Generator = null
async function loadPreSlice11Generator() {
  if (_preSlice11Generator) return _preSlice11Generator
  const url = pathToFileURL(PRE_SLICE11_SNAPSHOT_PATH).href
  const { generateSwingsPreSlice11 } = await import(url)
  if (typeof generateSwingsPreSlice11 !== 'function') {
    throw new Error(`${url} did not export generateSwingsPreSlice11.`)
  }
  _preSlice11Generator = generateSwingsPreSlice11
  return _preSlice11Generator
}

// How a session is SUMMARISED, as opposed to how it is made. This one stays
// on the working tree in every builder, on purpose; see the note at the end
// of the builder comment block above for why it is not a third frozen part.
let _computeStats = null
async function loadComputeStats() {
  if (_computeStats) return _computeStats
  const { computeStats } = await import(`${REPO_ROOT}/src/sessionStats.js`)
  _computeStats = computeStats
  return _computeStats
}

// The one piece of session-construction logic behind all three
// baseline-driven builders. Deliberately not forked per builder: the seeding,
// the generator call and the stats are identical for the before round and
// the after rounds, and the whole point of a before/after comparison is that
// exactly one thing differs. Two copies of this loop would let something
// else drift into the difference without anyone noticing.
//
// The generator arrives as a parameter rather than being fetched in here,
// which is the Slice 11 change: this function used to reach for the working
// tree itself, which is precisely how four committed rounds came to depend
// on a file nobody thought of as part of their provenance.
async function buildSessionsFromBaseline({ baseline, generateSwings, goalId, upTo, seed }) {
  const computeStats = await loadComputeStats()
  const random = mulberry32(seed)
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

// The working tree's live session 1: what a bench round run today is written
// about.
let _currentBaseline = null
async function loadCurrentBaseline() {
  if (_currentBaseline) return _currentBaseline
  const { SESSION_ONE_SWINGS } = await import(`${REPO_ROOT}/src/sessionOneSwings.js`)
  _currentBaseline = SESSION_ONE_SWINGS
  return _currentBaseline
}

// The frozen pre-rewrite session 1: what Slice 9's before round is written
// about. A committed snapshot, never the working tree, for the reason its own
// header spells out at length.
let _slice9BeforeBaseline = null
async function loadSlice9BeforeBaseline() {
  if (_slice9BeforeBaseline) return _slice9BeforeBaseline
  const url = pathToFileURL(path.join(SLICE9_DIR, 'session-one-before.mjs')).href
  const { SESSION_ONE_SWINGS_BEFORE } = await import(url)
  if (!Array.isArray(SESSION_ONE_SWINGS_BEFORE) || SESSION_ONE_SWINGS_BEFORE.length !== 15) {
    throw new Error(`${url} did not export fifteen frozen session-1 swings.`)
  }
  _slice9BeforeBaseline = SESSION_ONE_SWINGS_BEFORE
  return _slice9BeforeBaseline
}

// builder name -> the PAIR it stands for: which fifteen baseline swings, and
// which generator builds sessions 2 to 4 off them. Adding a fourth generation
// means adding one line here and one frozen snapshot, not another copy of the
// loop above.
//
// Read the rows against each other rather than one at a time. Each frozen
// half is a thing the working tree has already moved on from, and the
// combinations that exist are exactly the combinations some committed round
// was actually written against.
const BUILDERS = {
  current: { baseline: loadCurrentBaseline, generator: loadCurrentGenerator },
  'slice11-before': { baseline: loadCurrentBaseline, generator: loadPreSlice11Generator },
  'slice9-before': { baseline: loadSlice9BeforeBaseline, generator: loadPreSlice11Generator },
}
const BUILDER_NAMES = ['frozen', ...Object.keys(BUILDERS)]
// The prompt eras --handed-era accepts. One list, so a value arriving from a
// marker is checked against exactly what a value arriving from the flag is.
const HANDED_ERAS = ['slice8b', 'current']

let _frozenRebuild = null
async function loadFrozenRebuild() {
  if (_frozenRebuild) return _frozenRebuild
  _frozenRebuild = await import(path.join(FIXTURE_DIR, 'rebuild.mjs'))
  return _frozenRebuild
}

// Resolves ONE cell's session data through the named builder. Throws loudly
// on an unknown builder name or an unknown cell for that builder, rather
// than silently falling through to a default.
export async function resolveSessions({ builder, cellKey, seed = 20260814 }) {
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
  const pair = BUILDERS[builder]
  if (pair) {
    const cell = CURRENT_CELLS.find((c) => c.key === cellKey)
    if (!cell) {
      throw new Error(
        `Unknown cell "${cellKey}" for the ${builder} builder. Known: ${CURRENT_CELLS.map((c) => c.key).join(', ')}`,
      )
    }
    const baseline = await pair.baseline()
    const generateSwings = await pair.generator()
    const sessions = await buildSessionsFromBaseline({
      baseline,
      generateSwings,
      goalId: cell.goal.id,
      upTo: cell.session,
      seed,
    })
    return { sessions, goal: cell.goal, viewingSessionNumber: cell.session }
  }
  throw new Error(`Unknown builder "${builder}". Must be one of: ${BUILDER_NAMES.join(', ')}.`)
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
// after parsing (which files are bench records at all, concatenation order,
// refusing a file nobody can identify, setting aside failed bench records
// instead of grading their empty fields) lives in scripts/inputRecords.js,
// where the test suite reaches it.
//
// 20 August 2026: this reads every .json in the directory and always has,
// which was harmless only while a round directory held nothing but bench
// output. Slice 9 writes each round's grading.json in beside its records, so
// classifyInputFile now decides what each file actually is. See that module's
// header for what the old behaviour would have done with a bare-array
// grading file, and why it would not have said so.
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

// ── The provenance marker ────────────────────────────────────────────────────
//
// WHAT CAN ACTUALLY BE ENFORCED HERE, AND WHAT CANNOT.
// A bench record (scripts/bench-coach-brevity.mjs's --out shape) carries a
// condition, a cell, a run number and the coach's five text fields. It
// carries NOTHING about which fifteen session-1 swings the coach was looking
// at. So there is no way to read a records file and check it against the
// working tree; the information simply is not in there. Guessing it back out
// of the prose (does the coach quote numbers that appear in these swings?)
// would be a heuristic that fails quietly on exactly the rounds where it
// matters, which is worse than no guard at all.
//
// What IS enforceable is a marker written at the one moment the answer is
// known for certain: when the round is committed. A records directory may
// hold a BUILDER.txt of `key = value` lines (# starts a comment) naming the
// builder those debriefs were written against, and optionally the
// --handed-era they should be graded under. When one is present:
//   - a --builder that disagrees with it is REFUSED, loudly, not obeyed;
//   - a --builder that agrees is confirmed in the run header;
//   - no --builder at all is filled in from the marker, and the run header
//     says where the value came from. This is not the silent default the
//     comment block above rules out: a default is a guess, a marker is a
//     recorded fact committed beside the records it describes.
// A directory with no marker behaves exactly as it did before: an explicit
// --builder is required and nothing can be cross-checked.
const BUILDER_MARKER_FILENAME = 'BUILDER.txt'

// Exported since Slice 11 so scripts/replay-grading.mjs can read the same
// provenance marker rather than trusting a saved run's record of which flag
// was passed on the day. Those two answers came apart the moment four
// markers were repointed; see the fourth section of the builder comment.
export function readBuilderMarker(dir) {
  const markerPath = path.join(dir, BUILDER_MARKER_FILENAME)
  let text
  try {
    text = readFileSync(markerPath, 'utf8')
  } catch {
    return null
  }
  // A PRESENT KEY WITH AN EMPTY VALUE IS MALFORMED, for every field, and it
  // is refused here rather than left to each field's own validation below.
  // Found by review on 19 August 2026: `seed = ` with nothing after it used
  // to survive, because Number('') is 0 and 0 is a perfectly good integer, so
  // a botched edit or a truncated write produced a silent `seed 0` and a live
  // round rebuilt sessions 2, 3 and 4 at a seed nothing was generated at.
  // That is the exact failure this marker exists to prevent, reached through
  // a different door. An unknown key is refused for the same reason: `sed =
  // 20260819` would otherwise be ignored in silence and the round would fall
  // back to the default seed, which is the same silent-wrong-seed outcome one
  // typo away. A marker is a handful of lines that somebody typed once, so
  // strict is cheap here and a quiet misread is not.
  const KNOWN_KEYS = ['builder', 'handed-era', 'seed']
  const settings = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!KNOWN_KEYS.includes(key)) {
      throw new Error(
        `${markerPath} has a line naming "${key}", which is not one of ${KNOWN_KEYS.join(', ')}. ` +
        'A misspelled key would be ignored in silence and the run would quietly fall back to a default, ' +
        'which is the mistake this file exists to stop. Fix the key, or make the line a # comment.',
      )
    }
    if (value === '') {
      throw new Error(
        `${markerPath} has a "${key}" line with nothing after the "=". A blank value is malformed, not a ` +
        'default: it usually means a botched edit or a truncated write. Give it a value or delete the line ' +
        '(a missing line falls back honestly and says so in the run header).',
      )
    }
    settings[key] = value
  }
  if (!settings.builder) {
    throw new Error(
      `${markerPath} exists but names no builder. It must carry a line reading "builder = <name>". ` +
      'Fix it or delete it; a marker that says nothing is worse than none, because it looks like a check that ran.',
    )
  }
  if (!BUILDER_NAMES.includes(settings.builder)) {
    throw new Error(
      `${markerPath} names builder "${settings.builder}", which this script does not have. ` +
      `Known builders: ${BUILDER_NAMES.join(', ')}.`,
    )
  }
  // A value arriving from a marker gets the same validation a value arriving
  // from a flag gets. Without this a marker reading "handed-era = slice8c" is
  // accepted and printed, and then every record throws inside the per-record
  // try, so the run ends with an empty report rather than an error naming the
  // cause.
  const handedEra = settings['handed-era'] ?? null
  if (handedEra !== null && !HANDED_ERAS.includes(handedEra)) {
    throw new Error(
      `${markerPath} names handed era "${handedEra}", which this script does not have. ` +
      `Known eras: ${HANDED_ERAS.join(', ')}.`,
    )
  }
  let seed = null
  if (settings.seed != null) {
    seed = Number(settings.seed)
    if (!Number.isInteger(seed)) {
      throw new Error(`${markerPath} names seed "${settings.seed}", which is not a whole number.`)
    }
  }
  return { path: markerPath, builder: settings.builder, handedEra, seed }
}

// Reconciles a marker (if any) with the flags actually passed. Returns the
// builder, handed era and seed to use, plus a line for the run header saying
// where each came from.
//
// *** WHY THE SEED IS HERE AND NOT LEFT TO ITS DEFAULT ***
// Found by review on 19 August 2026, after the first version of this marker
// closed the session-1 hazard and left the identical hazard open one level
// down. Session 1 is the same whatever the seed, but sessions 2, 3 and 4 are
// generated from it with a seeded PRNG, so the seed alone decides what those
// sessions contain. Slice 9's rounds were not all run at the same seed: the
// before round and after round A used 20260814 (the default), and after round
// B used 20260819. Grading round B at the default rebuilds sessions that
// never existed for the five multi-session cells, which is 40 of its 64
// records, while the 24 session-1 records stay correct. That is worse than an
// outright failure, not better: the report comes out looking partly sane.
// So a marker may record the seed too, on exactly the same terms as the
// builder: an explicit --seed that contradicts it is refused, and a run that
// passes no --seed takes the marker's value rather than the default.
function reconcileWithMarker({ dir, args, missingBuilderMessage }) {
  const marker = readBuilderMarker(dir)
  if (!marker) {
    if (!args.builder) throw new Error(missingBuilderMessage)
    // No marker: the seed falls back to the flag or its default, exactly as
    // it always has. Older committed fixtures carry no marker and were all
    // graded at the default, so changing this would break them. What changed
    // instead is that the resolved seed and where it came from are now
    // PRINTED, in the run header and in the dry-run plan, so an unmarked
    // round says out loud which seed it is about to use.
    return {
      builder: args.builder,
      handedEra: args.handedEra,
      seed: args.seed,
      seedSource: args.seedGiven ? '--seed flag' : 'script default, no marker',
      provenance: null,
    }
  }
  if (args.builder && args.builder !== marker.builder) {
    throw new Error(
      `${marker.path} records that these debriefs were written against the "${marker.builder}" session data, ` +
      `but --builder ${args.builder} was passed. Refusing: grading a round through the wrong builder does not ` +
      'fail, it produces a complete, plausible-looking fact sheet for the wrong fifteen swings, and every ' +
      'verdict computed from it is garbage that reads like a result. Fix the flag. Do not edit the marker to ' +
      'match the flag; the marker was written by whoever generated the round, which is the only moment the ' +
      'answer was actually known.',
    )
  }
  if (marker.handedEra && args.handedEraGiven && args.handedEra !== marker.handedEra) {
    throw new Error(
      `${marker.path} records that these debriefs were produced by the "${marker.handedEra}" prompt era, but ` +
      `--handed-era ${args.handedEra} was passed. Refusing: the era decides which FALSE claims are counted as ` +
      'contradicting a number the prompt handed the coach, so the wrong era silently mislabels the split. ' +
      'Fix the flag rather than the marker.',
    )
  }
  if (marker.seed != null && args.seedGiven && args.seed !== marker.seed) {
    throw new Error(
      `${marker.path} records that these debriefs were generated at seed ${marker.seed}, but --seed ${args.seed} ` +
      'was passed. Refusing: session 1 is the same at any seed, but sessions 2, 3 and 4 are generated from it ' +
      'with a seeded PRNG, so the wrong seed rebuilds sessions that never existed for every multi-session ' +
      'cell while the session-1 cells stay correct. The report that comes out looks partly sane, which is ' +
      'worse than an outright failure. Fix the flag rather than the marker.',
    )
  }
  const seed = marker.seed ?? args.seed
  const seedSource = marker.seed != null
    ? `${marker.path}`
    : (args.seedGiven ? '--seed flag' : `script default, marker names no seed`)
  const recorded = [`builder ${marker.builder}`]
  if (marker.handedEra) recorded.push(`handed era ${marker.handedEra}`)
  if (marker.seed != null) recorded.push(`seed ${marker.seed}`)
  return {
    builder: marker.builder,
    handedEra: marker.handedEra ?? args.handedEra,
    seed,
    seedSource,
    provenance: `${marker.path} (${recorded.join(', ')})`,
  }
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
    // today wants --builder current. A committed BUILDER.txt beside the
    // records answers this without a flag; see reconcileWithMarker above.
    const reconciled = reconcileWithMarker({
      dir: args.input,
      args,
      missingBuilderMessage:
        '--input was given without --builder, and the directory carries no BUILDER.txt. There is no default: ' +
        'pass --builder current for anything produced by the bench against today\'s working tree, ' +
        '--builder slice11-before for a round committed before the Slice 11 generator rewrite, ' +
        '--builder slice9-before for Slice 9\'s pre-rewrite round, or --builder frozen only if the directory ' +
        'holds records generated against the old stand-in session 1 (rare, and you should know why).',
    })
    const { records, skippedFailed, skippedFiles } = loadInputDirectory(args.input)
    return {
      records,
      skippedFailed,
      skippedFiles,
      builder: reconciled.builder,
      handedEra: reconciled.handedEra,
      seed: reconciled.seed,
      seedSource: reconciled.seedSource,
      provenance: reconciled.provenance,
      source: `${args.input} (directory)`,
    }
  }
  if (!args.records) {
    if (args.builder && args.builder !== 'frozen') {
      throw new Error(
        'The default records (the 96-debrief fixture) were written against the frozen stand-in session 1. ' +
        `--builder ${args.builder} would grade them against the wrong swings. Omit --builder (frozen is ` +
        'implied), or pass --records to point at a different file first.',
      )
    }
    return {
      records: loadFixtureRecords(),
      builder: 'frozen',
      handedEra: args.handedEra,
      seed: args.seed,
      seedSource: args.seedGiven ? '--seed flag' : 'script default, no marker',
      provenance: null,
      source: 'docs/eval-fixtures/slice7-debriefs (both files)',
    }
  }
  // A single --records file is reconciled against a BUILDER.txt sitting in
  // the same directory, on the same terms as --input.
  const reconciled = reconcileWithMarker({
    dir: path.dirname(args.records),
    args,
    missingBuilderMessage:
      '--records was given without --builder, and no BUILDER.txt sits beside it. There is no default: pass ' +
      '--builder frozen only if this file was generated against the old stand-in session 1 (rare, and you ' +
      'should know why), --builder slice9-before for Slice 9\'s pre-rewrite round, --builder slice11-before ' +
      'for a round committed before the Slice 11 generator rewrite, or --builder current for ' +
      'anything produced by the bench against today\'s working tree.',
  })
  const records = JSON.parse(readFileSync(args.records, 'utf8'))
  if (!Array.isArray(records)) throw new Error(`${args.records} did not parse to a JSON array of records.`)
  return {
    records,
    builder: reconciled.builder,
    handedEra: reconciled.handedEra,
    seed: reconciled.seed,
    seedSource: reconciled.seedSource,
    provenance: reconciled.provenance,
    source: args.records,
  }
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
  statName must be one of: avgExitVelocity, avgLaunchAngle, inZoneCount, totalSwings, topExitVelocity, underFifteenCount, powerZoneCount, contactTargetBandCount, contactHardHitCount, contactFlyBallCount, pullSideCount, upTheMiddleCount, oppoFieldCount, allfieldsHardContactCount, popUpCount, weakGrounderCount, popupTargetBandCount, outsideZoneCount, highPitchCount, lowPitchCount, widePitchCount.
  Use sessionStat ONLY when the coach names the statistic itself. A count of balls over or under some distance, angle, or speed is a "threshold" claim with that metric, NEVER a sessionStat: "4 balls hit 305 feet or more" is threshold, metric distance, atLeast 305, statedCount 4. Bare "exit velocity" means avgExitVelocity; use topExitVelocity only when the coach says top, best, peak, or hardest.

If a sentence carries a number but fits none of these shapes, use kind "other" and give the quote alone. Do not force it into a shape that does not fit; "other" is the correct and expected answer for anything you cannot structure cleanly.

metric must be one of: exitVelocity, launchAngle, direction, distance, pitchHeight, pitchSide.
pitchHeight and pitchSide describe where the PITCH was, not what the swing did. Use them for claims like "a pitch 0.6 feet off the ground" or "that pitch was well outside". Never label a pitch-location claim with exitVelocity, launchAngle, direction or distance.

The strike zone is about pitch LOCATION (pitchHeight, pitchSide). A goal's "target window", "target zone" or "target band" is about LAUNCH ANGLE. Never label a launch-angle window count as inZoneCount or outsideZoneCount, and never label a pitch-location count with a launch-angle stat. A count of pop-ups is popUpCount, never underFifteenCount.

comparison maps from the coach's own words, and the distinction is strict:
- "above", "over", "more than", "north of" -> "above"
- "under", "below", "less than" -> "below"
- "at least", "or more", "or better", "plus" -> "atLeast"
- "at most", "or fewer", "or less" -> "atMost"
- an exact number with no direction word -> "equal"
- "cleared", "topped" -> "atLeast"
- "got past", "got out past", "went past", "beyond" -> "above"

NEGATED EXCEEDANCE. "None of them broke 80 mph", "nothing got out past 265 feet", "no ball cleared 300" are claims that the count ABOVE the threshold is ZERO: comparison "above", statedCount 0. Never map a negated exceedance onto "below" or "atMost", and never use the size of the named group as statedCount. The same applies inside subset claims: "none of swings 2, 9 and 12 broke 80" is comparison "above", statedCount 0, ofSwings [2, 9, 12].

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
    const v = verdictForClaim(withSession, factSheet, context)
    // Slice 8c whole-branch review, Finding 1: verdictForClaim attaches
    // `handed` only when context.handed was supplied, and that key was being
    // dropped right here by a destructure that never named it. printReport's
    // FALSE breakdown and its per-claim (handed)/(self-derived) tags both
    // read c.handed, so the drop meant every committed run's split was
    // computed by hand after the fact rather than printed by the tool. See
    // the dated note in docs/eval-fixtures/slice8c-strike-zone-counts/README.md.
    return {
      ...withSession,
      verdict: v.verdict,
      actual: v.actual,
      reasoning: v.reasoning,
      ...(typeof v.handed === 'boolean' ? { handed: v.handed } : {}),
    }
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

async function gradeDebrief(record, { factSheet, goal, apiKey, model, handed }) {
  const { system, user } = buildGraderPrompt(record, factSheet, goal)
  const { text, usage, diagnosis } = await callGraderModel({ system, user, apiKey, model })
  try {
    const graded = gradeParsedResponse(text, factSheet, { goalId: goal?.id, handed })
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
  const falseClaims = ok.flatMap((r) => r.claims).filter((c) => c.verdict === 'FALSE')
  const classified = falseClaims.filter((c) => typeof c.handed === 'boolean')
  if (classified.length || falseClaims.length === 0) {
    const handedFalse = classified.filter((c) => c.handed).length
    const derivedFalse = classified.filter((c) => !c.handed).length
    const handedRecords = ok.filter((r) => r.claims.some((c) => c.verdict === 'FALSE' && c.handed === true)).length
    console.log(`FALSE breakdown  ${handedFalse} contradicting a number the prompt handed the coach, ${derivedFalse} self-derived`)
    console.log(`                 debriefs contradicting a handed number: ${handedRecords} of ${ok.length}`)
  }
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
      const tag = typeof c.handed === 'boolean' ? (c.handed ? ' (handed)' : ' (self-derived)') : ''
      console.log(`    [${c.field}] "${c.quote}"${tag}`)
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
  if (args.input || args.records) {
    const { records, skippedFailed, skippedFiles, builder, handedEra, seed, seedSource, provenance, source } =
      resolveRecordsAndBuilder(args)
    // Adopted before selectSubset, because --sample draws from the same
    // seeded PRNG: a plan must sample the same records the live run will.
    args.seed = seed ?? args.seed
    const subset = selectSubset(records, args)
    console.log('Planned run')
    console.log('-'.repeat(70))
    console.log(`  records source   ${source} (builder: ${builder}, handed era: ${handedEra ?? args.handedEra})`)
    console.log(`  seed             ${seed ?? args.seed} (from ${seedSource})`)
    console.log(`  provenance       ${provenance ?? 'no BUILDER.txt beside these records; builder and seed taken from the flags alone'}`)
    // Only the --input path sets this; a single --records file has no
    // failed-record channel to report.
    if (skippedFailed?.length) {
      console.log(`  set aside        ${skippedFailed.length} failed bench record(s), never graded`)
    }
    // Named, not just counted: which file was passed over is the one thing a
    // reader needs to spot a records file that got misidentified.
    for (const f of skippedFiles ?? []) {
      console.log(`  set aside        ${f.name} (${f.kind}, not bench records), never graded`)
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
  // The two cells Slice 8b added, and the one Slice 9 added. Resolved here
  // so a typo in their CURRENT_CELLS entries fails a free dry run rather
  // than a paid grading run. Only the baseline-driven builders know them:
  // the frozen fixture predates all three, so they are deliberately absent
  // from its CELLS.
  for (const newCellKey of ['allfields-s4', 'popup-s4', 'contact-s1']) {
    const cell = await resolveSessions({ builder: 'current', cellKey: newCellKey, seed: 20260814 })
    console.log(
      `  current / ${newCellKey.padEnd(12)} ${cell.sessions.length} sessions, ` +
      `${cell.sessions.reduce((s, ss) => s + ss.swings.length, 0)} total swings, ` +
      `goal ${cell.goal.id}, viewing session ${cell.viewingSessionNumber}`,
    )
    const expectedSessions = CURRENT_CELLS.find((c) => c.key === newCellKey).session
    if (cell.sessions.length !== expectedSessions) {
      throw new Error(
        `Session builder self-check failed: expected ${expectedSessions} sessions for ${newCellKey}.`,
      )
    }
  }

  // 1b. The slice9-before builder, and the proof that it is not the current
  // one wearing a different name. Slice 9 replaced all fifteen session-1
  // swings, so a before-round debrief and an after-round debrief describe
  // different data through the same cell key. If these two ever stop
  // differing, the frozen snapshot has been "updated" to match the working
  // tree and every before/after comparison built on it is void, so this
  // check is a hard failure rather than a printed note.
  console.log('')
  console.log('The two session-1 generations (contact-s1, seed 20260814)')
  console.log('-'.repeat(70))
  const beforeS1 = await resolveSessions({ builder: 'slice9-before', cellKey: 'contact-s1', seed: 20260814 })
  const currentS1 = await resolveSessions({ builder: 'current', cellKey: 'contact-s1', seed: 20260814 })
  for (const [name, resolved] of [['slice9-before', beforeS1], ['current', currentS1]]) {
    const swings = resolved.sessions[0].swings
    const evs = swings.map((s) => s.hit.launch.exitSpeed)
    const distances = swings.map((s) => s.hit.landing.distance)
    console.log(
      `  ${name.padEnd(14)} swing 12 = ${evs[11]} mph / ${distances[11]} ft, ` +
      `top EV ${Math.max(...evs)} mph, longest ${Math.max(...distances)} ft, ` +
      `avg EV ${(evs.reduce((a, b) => a + b, 0) / evs.length).toFixed(1)} mph`,
    )
  }
  const beforeJson = JSON.stringify(beforeS1.sessions[0].swings)
  const currentJson = JSON.stringify(currentS1.sessions[0].swings)
  if (beforeJson === currentJson) {
    throw new Error(
      'Session builder self-check failed: the slice9-before snapshot and the working tree hold the SAME ' +
      'fifteen session-1 swings. Either the snapshot was wrongly updated to match the working tree, or the ' +
      'rewrite was reverted. Either way the before/after comparison this builder exists for is void.',
    )
  }
  console.log('  ok: the two builders disagree, which is the whole point of the second one')

  // 1c. The two GENERATORS, reported rather than asserted, and the asymmetry
  // is deliberate. 1b above is a hard failure because those two builders must
  // ALWAYS differ. These two must differ EVENTUALLY: they are the same code
  // until Slice 11 rewrites src/swingGenerator.js, so a hard check either way
  // would be wrong on one side of that change. What is asserted, permanently
  // and on every npm test, is that slice11-before still reproduces the
  // committed digest; see scripts/frozenGenerator.test.js.
  console.log('')
  console.log('The two generators (power-s2, session 2, seed 20260814)')
  console.log('-'.repeat(70))
  const liveS2 = await resolveSessions({ builder: 'current', cellKey: 'power-s2', seed: 20260814 })
  const frozenS2 = await resolveSessions({ builder: 'slice11-before', cellKey: 'power-s2', seed: 20260814 })
  const generatorsAgree =
    JSON.stringify(liveS2.sessions[1].swings) === JSON.stringify(frozenS2.sessions[1].swings)
  console.log(
    generatorsAgree
      ? '  current and slice11-before produce identical swings: the generator has not been rewritten yet'
      : '  current and slice11-before now differ: the generator has been rewritten, and every committed round ' +
        'correctly reads the frozen one',
  )

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
  // The provenance marker, exercised against the real committed fixtures
  // rather than a made-up directory, so a marker that goes missing or gets
  // edited to the wrong value fails a free dry run.
  //
  // 20 August 2026, Slice 11: the four rounds that used to be marked
  // "current" are now marked "slice11-before", and Slice 10's two rounds
  // joined this list. Every committed round in this repository is now
  // exercised here, which is the state it should have been in already: the
  // two Slice 10 rounds were missing from this check for no reason anyone
  // recorded, and a marker nothing looks at is a marker nobody notices going
  // wrong.
  const markerCases = [
    { dir: path.join(SLICE9_DIR, 'before'), expected: 'slice9-before', wrong: 'current', seed: 20260814 },
    { dir: path.join(SLICE9_DIR, 'after-a'), expected: 'slice11-before', wrong: 'current', seed: 20260814 },
    // Not the default seed, and nothing but this marker says so. See its own
    // BUILDER.txt.
    { dir: path.join(SLICE9_DIR, 'after-b'), expected: 'slice11-before', wrong: 'current', seed: 20260819 },
    { dir: path.join(SLICE10_DIR, 'after'), expected: 'slice11-before', wrong: 'current', seed: 20260814 },
    { dir: path.join(SLICE10_DIR, 'after-spray'), expected: 'slice11-before', wrong: 'current', seed: 20260814 },
  ]
  for (const c of markerCases) {
    const rel = path.relative(REPO_ROOT, c.dir)
    const marker = readBuilderMarker(c.dir)
    if (!marker) {
      console.log(`  FAILED: ${rel} carries no ${BUILDER_MARKER_FILENAME}`)
      continue
    }
    if (marker.builder !== c.expected) {
      console.log(`  FAILED: ${rel} names builder "${marker.builder}", expected "${c.expected}"`)
      continue
    }
    if (marker.seed !== c.seed) {
      console.log(`  FAILED: ${rel} names seed ${marker.seed}, expected ${c.seed}`)
      continue
    }
    // ASSERT ON THE REASON, NOT MERELY THAT SOMETHING THREW. Corrected
    // 20 August 2026: both of these blocks used to be a bare `catch {}`, so
    // ANY exception counted as proof the marker had done its job.
    //
    // Be precise about what saves the old version today, because it is an
    // accident and not a design: resolveRecordsAndBuilder happens to call
    // reconcileWithMarker BEFORE loadInputDirectory, so the marker is always
    // what throws first, and the two prechecks above catch a marker that
    // reads wrong. Reverse those two calls, which is the most natural
    // refactor in the file (load the records, then reconcile them), and
    // every one of these six guards goes green on an exception the marker
    // was never consulted for. Verified by doing exactly that on 20 August
    // 2026: with the loader made to throw, the bare-catch version printed
    // `ok: ... refused --builder current` while the version below printed
    // FAILED and named the real error. A guard that cannot tell one failure
    // from another is not a guard.
    try {
      resolveRecordsAndBuilder({ input: c.dir, builder: c.wrong, handedEra: 'current', seed: c.seed })
      console.log(`  FAILED: ${rel} accepted --builder ${c.wrong}`)
    } catch (err) {
      const refusedForTheRightReason =
        err.message.includes(BUILDER_MARKER_FILENAME) &&
        err.message.includes(`--builder ${c.wrong}`) &&
        err.message.includes(c.expected)
      if (!refusedForTheRightReason) {
        console.log(
          `  FAILED: ${rel} threw, but not because the marker refused --builder ${c.wrong}: "${err.message.slice(0, 120)}"`,
        )
      } else {
        guardOk++
        console.log(`  ok: ${rel} is marked "${c.expected}" and refused --builder ${c.wrong}`)
      }
    }
    // The seed half of the same guard: a contradicting explicit --seed must
    // refuse, and a run that passes none must come back with the marker's
    // seed rather than the script default.
    const wrongSeed = c.seed === 20260814 ? 20260819 : 20260814
    try {
      resolveRecordsAndBuilder({ input: c.dir, seed: wrongSeed, seedGiven: true, handedEra: 'current' })
      console.log(`  FAILED: ${rel} accepted --seed ${wrongSeed}`)
    } catch (err) {
      const refusedForTheRightReason =
        err.message.includes(BUILDER_MARKER_FILENAME) &&
        err.message.includes(`--seed ${wrongSeed}`) &&
        err.message.includes(String(c.seed))
      if (!refusedForTheRightReason) {
        console.log(
          `  FAILED: ${rel} threw, but not because the marker refused --seed ${wrongSeed}: "${err.message.slice(0, 120)}"`,
        )
      } else {
        guardOk++
        console.log(`  ok: ${rel} is marked seed ${c.seed} and refused --seed ${wrongSeed}`)
      }
    }
    const adopted = resolveRecordsAndBuilder({ input: c.dir, seed: 20260814, handedEra: 'current' })
    if (adopted.seed !== c.seed) {
      console.log(`  FAILED: ${rel} resolved seed ${adopted.seed} with no --seed, expected ${c.seed}`)
    } else {
      guardOk++
      console.log(`  ok: ${rel} resolved seed ${c.seed} with no --seed passed (from ${adopted.seedSource})`)
    }
  }
  // Four flag-shape guards, plus three checks on each committed round's
  // marker. Derived from markerCases rather than written out as a number,
  // since Slice 11 grew that list from three rounds to five and a hand-typed
  // total is one more thing to forget. It still bites for the failure it was
  // put here to catch: a guard that prints FAILED instead of throwing does
  // not increment, so the total comes up short and the dry run stops.
  const expectedGuards = 4 + markerCases.length * 3
  if (guardOk !== expectedGuards) {
    throw new Error(
      `Builder-selection guardrail self-check failed: ${guardOk} of ${expectedGuards} passed. ` +
      'Read the FAILED lines above rather than adjusting this count.',
    )
  }

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

  // Slice 8c whole-branch review, Finding 1: prove the `handed` flag survives
  // gradeParsedResponse's assembly of the graded claim, against a real
  // handedClaimSpecs object rather than a canned one, in both directions.
  // Power's own handed set names launchAngle-below-15; it does not name
  // launchAngle-above-20, so the same fact sheet's own 20-degree row is a
  // ready-made self-derived comparison.
  const powerHanded = handedClaimSpecs(frozen.goal.id, 'current')
  const handedRow = s1.thresholds.launchAngle.find((r) => r.threshold === 15)
  const handedMixed = JSON.stringify({
    claims: [
      { field: 'tip1', quote: 'four swings below 15 degrees', kind: 'threshold', sessionNumber: s1.sessionNumber, metric: 'launchAngle', threshold: 15, comparison: 'below', statedCount: handedRow.below.count + 1 },
      { field: 'tip2', quote: 'lots of your swings above 20 degrees', kind: 'threshold', sessionNumber: s1.sessionNumber, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: trueRow.above.count + 3 },
    ],
  })
  const handedMixedResult = gradeParsedResponse(handedMixed, factSheet, { goalId: frozen.goal.id, handed: powerHanded })
  const [handedClaim, derivedClaim] = handedMixedResult.claims
  console.log(
    `  handed vs derived  -> handed claim handed=${handedClaim.handed} (threshold 15, in power's handed set), ` +
    `derived claim handed=${derivedClaim.handed} (threshold 20, not in power's handed set) (expect true, false)`,
  )
  if (handedClaim.verdict !== 'FALSE' || derivedClaim.verdict !== 'FALSE') {
    throw new Error('Self-check failed: both handed-vs-derived probe claims were expected to grade FALSE.')
  }
  if (handedClaim.handed !== true || derivedClaim.handed !== false) {
    throw new Error("Self-check failed: verdictForClaim's handed flag did not survive gradeParsedResponse.")
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
        extraThresholds: eraExtraThresholds(resolved.goal.id, args.handedEra),
        goalId: resolved.goal.id,
      })
      const handed = handedClaimSpecs(resolved.goal.id, args.handedEra)
      cellCache.set(record.cell, { factSheet: sheet, goal: resolved.goal, handed })
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

  const { records, skippedFailed, skippedFiles, builder, handedEra, seed, seedSource, provenance, source } =
    resolveRecordsAndBuilder(args)
  // The marker beside the records wins over the flag default; a marker that
  // DISAGREES with an explicit flag has already thrown by this point. Both
  // are adopted before selectSubset, because --sample draws from the same
  // seeded PRNG the sessions do.
  args.handedEra = handedEra ?? args.handedEra
  args.seed = seed ?? args.seed
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
  console.log(`Handed era       ${args.handedEra}`)
  console.log(`Seed             ${args.seed} (from ${seedSource})`)
  console.log(`Provenance       ${provenance ?? 'no BUILDER.txt beside these records; builder and seed taken from the flags alone'}`)
  if (skippedFailed?.length) {
    console.log(`Set aside        ${skippedFailed.length} failed bench record(s) with no debrief to grade`)
  }
  for (const f of skippedFiles ?? []) {
    console.log(`Set aside        ${f.name} (${f.kind}, not bench records), never graded`)
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
          extraThresholds: eraExtraThresholds(resolved.goal.id, args.handedEra),
          goalId: resolved.goal.id,
        })
        const handed = handedClaimSpecs(resolved.goal.id, args.handedEra)
        cellCache.set(record.cell, { factSheet, goal: resolved.goal, handed })
      }
      const { factSheet, goal, handed } = cellCache.get(record.cell)
      const graded = await gradeDebrief(record, { factSheet, goal, apiKey, model: args.model, handed })
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
    // A committed grading run must prove from its own contents which flags
    // produced it. Slice 8c's fixtures could not (recorded on What's Next,
    // 19 August 2026); from this change on, the file says so itself.
    const meta = {
      generatedAt: new Date().toISOString(),
      model: args.model,
      source,
      builder,
      seed: args.seed,
      handedEra: args.handedEra,
    }
    writeFileSync(args.out, JSON.stringify({ meta, results }, null, 2))
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
    handedEra: 'current',
    // Whether --handed-era was actually typed, as opposed to left at its
    // default. A BUILDER.txt may name the era, and "the caller asked for
    // this era" has to be told apart from "nobody said" before a mismatch
    // can honestly be refused.
    handedEraGiven: false,
    // Same reason as handedEraGiven: a marker may name the seed, and "the
    // caller asked for this seed" has to be told apart from "nobody said"
    // before a mismatch can honestly be refused.
    seedGiven: false,
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
    else if (flag === '--seed') {
      args.seed = Number(value)
      args.seedGiven = true
    }
    else if (flag === '--model') args.model = value
    else if (flag === '--out') args.out = value
    else if (flag === '--handed-era') {
      args.handedEra = value
      args.handedEraGiven = true
    }
    else throw new Error(`Unknown flag: ${flag}`)
  }
  if (!HANDED_ERAS.includes(args.handedEra)) {
    throw new Error(`--handed-era must be one of: ${HANDED_ERAS.join(', ')}. Got "${args.handedEra}".`)
  }
  // A misspelled builder used to survive as far as the first record's
  // resolveSessions call, which on a --dry-run --input plan is never reached
  // at all, so a typo could print a clean-looking plan and then blow up
  // mid-spend. Rejected here instead, before anything else happens.
  if (args.builder != null && !BUILDER_NAMES.includes(args.builder)) {
    throw new Error(`--builder must be one of: ${BUILDER_NAMES.join(', ')}. Got "${args.builder}".`)
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

// Run only when executed directly, so the replay script (Task 4) can import
// the cell table and session builders without triggering a CLI run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
