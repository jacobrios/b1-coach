#!/usr/bin/env node
//
// Offline replay of a committed grading run, at zero cost.
//
// Built for Slice 8d, Task 4. Slice 8d fixed the grading tool calling a true
// "none of them exceeded X" claim FALSE instead of TRUE (the
// negated-exceedance bug: the extractor flips a negated exceedance to the
// complement comparison but keeps the literal zero, so the grader compared
// 0 against the wrong bucket). That fix landed in scripts/claimVerdict.js.
// This script proves it moves exactly the verdicts it is supposed to and
// nothing else, by re-running verdictForClaim on every claim a PAST grading
// run already extracted, against the FIXED code, with no re-extraction and
// no live model call: extraction already happened when the run was
// recorded and is not being replayed, only the ruling half of the pipeline.
//
// Rebuilding a cell's fact sheet and re-verdicting a stored claim is exactly
// what scripts/grade-coach-accuracy.mjs itself does in its --validate path
// (buildFactSheet, eraExtraThresholds, handedClaimSpecs, verdictForClaim),
// so this script imports those same tested pieces rather than re-deriving
// any judgment of its own. All judgment lives in already-tested modules;
// this script is thin on purpose.
//
// HOW TO RUN (no network, no spend, no API key needed)
//   node scripts/replay-grading.mjs --input <grading.json> --handed-era slice8b|current [--seed 20260814]
//   ... [--builder <name>], which is refused outright if it disagrees with a
//   BUILDER.txt sitting beside the file. See the note beside the builder
//   resolution below for why the marker, not the saved run's own meta, is
//   what a replay trusts.
//
// Era and seed come from the file's own `meta` when present (the
// { meta, results } shape scripts/gradingOutput.js reads); pass the flags
// explicitly for a pre-metadata bare-array file, since those carry no meta
// at all, which is the shape of both Slice 8c fixtures this task replays.
// If a flag and the file's meta disagree, the flag wins and a warning
// prints saying so.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readGradingOutput } from './gradingOutput.js'
import { buildFactSheet } from './factSheet.js'
import { verdictForClaim } from './claimVerdict.js'
import { handedClaimSpecs, eraExtraThresholds } from './handedCounts.js'
import { CURRENT_CELLS, readBuilderMarker, resolveSessions } from './grade-coach-accuracy.mjs'

const VALID_ERAS = new Set(['slice8b', 'current'])
const VERDICTS = ['TRUE', 'FALSE', 'UNVERIFIABLE']

function parseArgs(argv) {
  const args = { input: null, handedEra: null, seed: null, builder: null }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--input') { args.input = argv[i + 1]; i += 1 }
    else if (flag === '--handed-era') { args.handedEra = argv[i + 1]; i += 1 }
    else if (flag === '--seed') { args.seed = Number(argv[i + 1]); i += 1 }
    else if (flag === '--builder') { args.builder = argv[i + 1]; i += 1 }
    else throw new Error(`Unknown flag: ${flag}`)
  }
  if (!args.input) {
    throw new Error(
      'Pass --input <grading.json> [--handed-era slice8b|current] [--seed 20260814] [--builder <name>].',
    )
  }
  if (args.handedEra !== null && !VALID_ERAS.has(args.handedEra)) {
    throw new Error(`--handed-era must be "slice8b" or "current", got "${args.handedEra}".`)
  }
  return args
}

// Era/seed resolution, per this script's own header: the file's meta wins
// when a flag was not given; a given flag wins on a disagreement, with a
// printed warning; meta absent and no flag is a hard error for the era
// (there is no sane default for which prompt generation produced a record),
// but the seed does have a sane default, since every recorded round so far
// used the same one.
function resolveEraAndSeed(meta, args) {
  let handedEra = args.handedEra
  let seed = args.seed
  // The era actually in use is the flag whenever one was passed (the flag
  // always wins on a disagreement, per this script's own header comment);
  // otherwise it can only have come from the file's meta, since the error
  // below refuses to proceed with neither.
  const eraSource = args.handedEra !== null ? 'flag' : 'file meta'

  if (meta) {
    if (handedEra === null) {
      handedEra = meta.handedEra ?? null
    } else if (meta.handedEra && meta.handedEra !== handedEra) {
      console.warn(`WARNING: --handed-era ${handedEra} overrides the file's own meta.handedEra ${meta.handedEra}.`)
    }
    if (seed === null) {
      seed = Number.isFinite(meta.seed) ? meta.seed : null
    } else if (Number.isFinite(meta.seed) && meta.seed !== seed) {
      console.warn(`WARNING: --seed ${seed} overrides the file's own meta.seed ${meta.seed}.`)
    }
  }

  if (handedEra === null) {
    throw new Error(
      'This file carries no meta.handedEra (it is the pre-metadata bare-array shape); ' +
      'pass --handed-era slice8b|current explicitly.',
    )
  }
  if (!VALID_ERAS.has(handedEra)) {
    throw new Error(`Resolved --handed-era "${handedEra}" is not "slice8b" or "current".`)
  }
  if (seed === null) seed = 20260814
  return { handedEra, seed, eraSource }
}

const recordId = (r) => `${r.conditionKey}/${r.cell}/run${r.run}`

function bump(totals, verdict) {
  if (totals[verdict] !== undefined) totals[verdict] += 1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const raw = JSON.parse(readFileSync(args.input, 'utf8'))
  const { meta, results } = readGradingOutput(raw)
  const { handedEra, seed, eraSource } = resolveEraAndSeed(meta, args)
  // Same fallback shape as the era/seed resolution above: bare-array files
  // predate the self-describing-output change and carry no meta.builder at
  // all, and every one of them (including both Slice 8c fixtures this
  // script replays) was graded with --builder current, so that is the only
  // sane default for the pre-metadata shape.
  //
  // 20 August 2026, Slice 11: meta.builder is no longer the last word, and
  // this is the one place in this script where a saved file can be out of
  // date about itself. meta.builder records the flag that was passed on the
  // day. The BUILDER.txt beside the records says what the round is actually
  // about, and four of them were repointed from "current" to
  // "slice11-before" when the swing generator was frozen, because "current"
  // has since come to mean a different generator. Left trusting meta, a
  // replay of any of those four would silently rebuild sessions 2 to 4 from
  // swings no coach ever saw. So the marker wins, and it says why out loud.
  const marker = readBuilderMarker(path.dirname(path.resolve(args.input)))
  let builder = marker?.builder ?? meta?.builder ?? 'current'
  if (marker && meta?.builder && marker.builder !== meta.builder) {
    console.log(
      `NOTE: replaying through builder "${marker.builder}", named by the BUILDER.txt beside this file, ` +
      `not "${meta.builder}", which is the flag that was passed when the run was saved. The marker is the ` +
      'later and better answer; see the session-builders comment in scripts/grade-coach-accuracy.mjs.',
    )
  }
  if (args.builder !== null) {
    if (marker && args.builder !== marker.builder) {
      throw new Error(
        `--builder ${args.builder} disagrees with the BUILDER.txt beside this file, which names ` +
        `"${marker.builder}". Refusing: replaying through the wrong builder does not fail, it re-rules every ` +
        'claim against a complete, plausible-looking fact sheet for swings the coach never saw. Fix the flag ' +
        'rather than the marker.',
      )
    }
    builder = args.builder
  }

  // Fail fast, before doing any grading work, on a record whose cell this
  // session builder does not know about, rather than discovering it one
  // resolveSessions call at a time deep in the loop below.
  const knownCells = new Set(CURRENT_CELLS.map((c) => c.key))
  for (const { record } of results) {
    if (!knownCells.has(record.cell)) {
      throw new Error(
        `${recordId(record)}: unknown cell "${record.cell}". Known cells: ${[...knownCells].join(', ')}`,
      )
    }
  }

  const eraLabel = eraSource === 'flag' ? '(from --handed-era flag)' : '(from file meta)'
  console.log(`REPLAY  ${args.input}`)
  console.log(`  era=${handedEra} ${eraLabel}  seed=${seed}  ${meta ? '(from file meta)' : '(no meta in file; from flags)'}`)
  console.log('')

  const cellCache = new Map()
  async function factSheetForCell(cellKey) {
    if (!cellCache.has(cellKey)) {
      const resolved = await resolveSessions({ builder, cellKey, seed })
      const factSheet = buildFactSheet({
        sessions: resolved.sessions,
        viewingSessionNumber: resolved.viewingSessionNumber,
        extraThresholds: eraExtraThresholds(resolved.goal.id, handedEra),
        goalId: resolved.goal.id,
      })
      const handed = handedClaimSpecs(resolved.goal.id, handedEra)
      cellCache.set(cellKey, { factSheet, goalId: resolved.goal.id, handed })
    }
    return cellCache.get(cellKey)
  }

  const storedTotals = { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 }
  const replayedTotals = { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 }
  let storedFlagged = 0
  let replayedFlagged = 0
  let totalClaims = 0
  const changeLines = []

  for (const result of results) {
    const { record, claims } = result
    const id = recordId(record)
    const { factSheet, goalId, handed } = await factSheetForCell(record.cell)
    const context = { goalId, handed }

    let replayedFlaggedThisRecord = false
    for (const claim of claims) {
      totalClaims += 1
      bump(storedTotals, claim.verdict)

      // Mirrors gradeParsedResponse's own default in
      // scripts/grade-coach-accuracy.mjs: a claim with no session number is
      // read as being about the session being debriefed. Stored claims
      // already carry sessionNumber in every record this task replays, so
      // this is a defensive match rather than something exercised here.
      const withSession = claim.sessionNumber === undefined
        ? { ...claim, sessionNumber: factSheet.viewingSessionNumber }
        : claim

      const fresh = verdictForClaim(withSession, factSheet, context)
      bump(replayedTotals, fresh.verdict)
      if (fresh.verdict === 'FALSE') replayedFlaggedThisRecord = true

      if (fresh.verdict !== claim.verdict) {
        changeLines.push(
          `  ${id}  field=${claim.field}  quote="${claim.quote}"  ` +
          `${claim.verdict} -> ${fresh.verdict}  reasoning: ${fresh.reasoning}`,
        )
      }
    }
    if (claims.some((c) => c.verdict === 'FALSE')) storedFlagged += 1
    if (replayedFlaggedThisRecord) replayedFlagged += 1
  }

  console.log(`RECORDS  ${results.length}`)
  console.log(`CLAIMS   ${totalClaims}`)
  for (const v of VERDICTS) {
    console.log(`  ${v.padEnd(13)} stored=${storedTotals[v]}  replayed=${replayedTotals[v]}`)
  }
  console.log(`FLAGGED DEBRIEFS  stored=${storedFlagged}  replayed=${replayedFlagged}`)
  console.log('')

  if (changeLines.length) {
    console.log('VERDICT CHANGES, one per claim:')
    for (const line of changeLines) console.log(line)
  } else {
    console.log('(no verdict changes)')
  }
  console.log('')
  console.log(`VERDICT CHANGES: ${changeLines.length}`)
}

await main()
