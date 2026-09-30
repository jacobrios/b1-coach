#!/usr/bin/env node
//
// Free, deterministic proof that the pitch-position rounding fix in
// scripts/claimVerdict.js (the fix commit on this branch) removes only false flags.
//
// Written 30 September 2026 for the grader-accepts-rounded-pitch micro-PR,
// Task 2. scripts/replay-grading.mjs compares a saved grading file's STORED
// verdicts with today's code, which mixes two things: this fix and every
// earlier verdict-code fix made since the file was saved (the Slice 8d
// negated-exceedance guard, the Slice 9 empty-list fix, and so on). This script
// isolates this fix by running each stored claim through BOTH the verdict code
// as it stood just before the fix (git show f16eba1:scripts/claimVerdict.js)
// and the code as it stands now, against one fact sheet rebuilt the same way
// the replay tool rebuilds it, and listing only what differs between the two.
//
// It imports the verdict code, the fact sheet builder, the era rules, the
// session builders and the output reader from the tested modules; the only
// judgment it adds is the assertion at the bottom of each change. No network,
// no API key, no .env read, no spend.
//
// HOW TO RUN, from the repo root:
//   node docs/eval-fixtures/audit-2026-09-30/replay-rounding-fix.mjs
//
// Era, seed and builder are resolved per file the way replay-grading.mjs does:
// a BUILDER.txt beside the file wins, then the file's own meta. A bare-array
// file carries neither, so the table below names them, and each such row says
// where the choice came from. A file the tool cannot replay is printed with the
// reason and skipped, never forced.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { readGradingOutput } from '../../../scripts/gradingOutput.js'
import { buildFactSheet } from '../../../scripts/factSheet.js'
import { verdictForClaim as verdictNew } from '../../../scripts/claimVerdict.js'
import { handedClaimSpecs, eraExtraThresholds } from '../../../scripts/handedCounts.js'
import { CURRENT_CELLS, readBuilderMarker, resolveSessions } from '../../../scripts/grade-coach-accuracy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
// The pre-fix verdict code is read from f16eba1, the main commit this branch
// was cut from, and NOT from the fix commit's parent: a branch commit does not
// survive a squash merge, so a reference to it would stop this script being
// re-runnable once the PR lands. f16eba1 is on main and holds the identical
// pre-fix scripts/claimVerdict.js. Checked 30 September 2026 with
// `git diff f16eba1 <fix-commit>^ -- scripts/claimVerdict.js scripts/goalTargets.js
// src/goalTargets.js`, which printed nothing (the script copies the working-tree
// src/goalTargets.js beside the old verdict code, so that file had to match too).
const BASE_COMMIT = 'f16eba1'

// The verdict code as it stood immediately before the fix, materialised beside
// a copy of the one module it imports so its relative import still resolves.
async function loadVerdictBeforeFix() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'verdict-before-fix-'))
  mkdirSync(path.join(dir, 'scripts'))
  mkdirSync(path.join(dir, 'src'))
  const old = execFileSync('git', ['show', `${BASE_COMMIT}:scripts/claimVerdict.js`], { cwd: REPO, encoding: 'utf8' })
  writeFileSync(path.join(dir, 'scripts', 'claimVerdict.js'), old)
  copyFileSync(path.join(REPO, 'src', 'goalTargets.js'), path.join(dir, 'src', 'goalTargets.js'))
  const mod = await import(pathToFileURL(path.join(dir, 'scripts', 'claimVerdict.js')).href)
  return mod.verdictForClaim
}

const round1 = (v) => Math.round(v * 10) / 10

// One row per committed grading file. `flags` is only used where the file
// carries no meta.handedEra (bare arrays) and says where the choice came from.
const FX = 'docs/eval-fixtures'
const FILES = [
  { id: 'audit after-a', file: `${FX}/audit-2026-09-30/after-a/grading.json`, hand: ['audit-2026-09-30/HAND-CHECK.md'] },
  { id: 'audit after-b', file: `${FX}/audit-2026-09-30/after-b/grading.json`, hand: ['audit-2026-09-30/HAND-CHECK.md'] },
  { id: 'slice11 before', file: `${FX}/slice11-generator-realism/before/grading.json`, hand: ['slice11-generator-realism/HAND-CHECK.md'] },
  { id: 'slice11 after-a', file: `${FX}/slice11-generator-realism/after-a/grading.json`, hand: ['slice11-generator-realism/HAND-CHECK.md'] },
  { id: 'slice11 after-b', file: `${FX}/slice11-generator-realism/after-b/grading.json`, hand: ['slice11-generator-realism/HAND-CHECK.md'] },
  { id: 'slice10 after', file: `${FX}/slice10-direction-key/after/grading.json`, hand: ['slice10-direction-key/HAND-CHECK.md'] },
  { id: 'slice10 after-spray', file: `${FX}/slice10-direction-key/after-spray/grading.json`, hand: ['slice10-direction-key/HAND-CHECK-after-spray.md'] },
  { id: 'slice9 before', file: `${FX}/slice9-session-one/before/grading.json`, hand: ['slice9-session-one/HAND-CHECK.md'] },
  { id: 'slice9 after-a', file: `${FX}/slice9-session-one/after-a/grading.json`, hand: ['slice9-session-one/HAND-CHECK.md'] },
  { id: 'slice9 after-b', file: `${FX}/slice9-session-one/after-b/grading.json`, hand: ['slice9-session-one/HAND-CHECK.md'] },
  // Bare-array and unmarked files. Era and builder come from each slice's own
  // README, which names the exact command that produced the file; both 8d
  // files carry meta naming builder "current", which was right on the day and
  // is stranded now that "current" means a different generator. The builder
  // used here is the one matching what the coach actually saw, and each row's
  // faithfulness (stored versus before-fix verdicts) is printed beside it. That
  // figure holds outright for the two 8d files (0 mismatches); for the two 8c
  // files the 1 and 8 mismatches are fully explained by the Slice 8d guard
  // recorded in slice8d-grader-fp/replay-8c-rounds.txt, not a clean match.
  { id: 'slice8c before', file: `${FX}/slice8c-strike-zone-counts/before-grading.json`, era: 'slice8b', builder: 'slice9-before', hand: [] },
  { id: 'slice8c after', file: `${FX}/slice8c-strike-zone-counts/after-grading.json`, era: 'current', builder: 'slice9-before', hand: [] },
  { id: 'slice8d regrade-8b-after', file: `${FX}/slice8d-grader-fp/regrade-8b-after.json`, builder: 'slice9-before', hand: [] },
  { id: 'slice8d regrade-8c-after', file: `${FX}/slice8d-grader-fp/regrade-8c-after.json`, builder: 'slice9-before', hand: [] },
  { id: 'slice8 validate-96-before', file: `${FX}/slice8-grader-validation/validate-96-before.json`, hand: [] },
  { id: 'slice8 validate-96-after', file: `${FX}/slice8-grader-validation/validate-96-after.json`, hand: [] },
  { id: 'slice7 regrade-results', file: `${FX}/slice7-debriefs/regrade-results.json`, hand: [] },
]

const recordId = (r) => `${r.conditionKey}/${r.cell}/run${r.run}`

function describeRefusal(cfg, raw, err) {
  return err.message.split('\n')[0]
}

async function replayFile(cfg, verdictOld) {
  const raw = JSON.parse(readFileSync(path.join(REPO, cfg.file), 'utf8'))
  const { meta, results } = readGradingOutput(raw)
  const handedEra = cfg.era ?? meta?.handedEra ?? null
  if (handedEra === null) {
    throw new Error('no meta.handedEra (pre-metadata bare array) and no era recorded in the file; the replay tool also refuses it without --handed-era')
  }
  const seed = Number.isFinite(meta?.seed) ? meta.seed : 20260814
  const marker = readBuilderMarker(path.dirname(path.join(REPO, cfg.file)))
  const builder = cfg.builder ?? marker?.builder ?? meta?.builder ?? 'current'
  const known = new Set(CURRENT_CELLS.map((c) => c.key))
  for (const { record } of results) {
    if (!known.has(record.cell)) throw new Error(`unknown cell "${record.cell}" in ${recordId(record)}`)
  }

  const cache = new Map()
  async function sheet(cellKey) {
    if (!cache.has(cellKey)) {
      const resolved = await resolveSessions({ builder, cellKey, seed })
      const factSheet = buildFactSheet({
        sessions: resolved.sessions,
        viewingSessionNumber: resolved.viewingSessionNumber,
        extraThresholds: eraExtraThresholds(resolved.goal.id, handedEra),
        goalId: resolved.goal.id,
      })
      cache.set(cellKey, { factSheet, context: { goalId: resolved.goal.id, handed: handedClaimSpecs(resolved.goal.id, handedEra) } })
    }
    return cache.get(cellKey)
  }

  const out = {
    cfg, handedEra, seed, builder, records: results.length, claims: 0,
    stored: { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 },
    before: { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 },
    after: { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 },
    storedVsBeforeMismatch: 0,
    changes: [],
    violations: [],
  }
  for (const { record, claims } of results) {
    const { factSheet, context } = await sheet(record.cell)
    for (const claim of claims) {
      out.claims += 1
      out.stored[claim.verdict] += 1
      const c = claim.sessionNumber === undefined ? { ...claim, sessionNumber: factSheet.viewingSessionNumber } : claim
      const vOld = verdictOld(c, factSheet, context)
      const vNew = verdictNew(c, factSheet, context)
      out.before[vOld.verdict] += 1
      out.after[vNew.verdict] += 1
      if (vOld.verdict !== claim.verdict) out.storedVsBeforeMismatch += 1
      if (vOld.verdict === vNew.verdict) continue

      // A change. Pull the true value out of the fact sheet's own "actual" text
      // ("swing 5 pitchHeight: 1.78") rather than re-reading the table.
      const m = /^swing (\d+) (\w+): (-?[\d.]+)$/.exec(vOld.actual ?? '')
      const trueValue = m ? Number(m[3]) : null
      const change = {
        id: recordId(record), field: claim.field, quote: claim.quote, kind: claim.kind, metric: claim.metric,
        swingNumber: claim.swingNumber, sessionNumber: c.sessionNumber, stated: claim.statedValue, trueValue,
        from: vOld.verdict, to: vNew.verdict, storedVerdict: claim.verdict,
      }
      out.changes.push(change)
      const ok = vOld.verdict === 'FALSE' && vNew.verdict === 'TRUE' &&
        claim.kind === 'swingValue' && (claim.metric === 'pitchHeight' || claim.metric === 'pitchSide') &&
        trueValue !== null && claim.statedValue === round1(trueValue) && claim.statedValue !== trueValue
      if (!ok) out.violations.push(change)
    }
  }
  return out
}

// Hand-check cross-check. A hand-check document is prose blocks, each opening
// with a bold or heading label and ending in a ruling. Quotes are verbatim, so
// a changed claim is matched by its quote (whitespace and dash normalised)
// appearing inside a block; the block's ruling is read from the words
// GENUINE / FALSE POSITIVE in it.
const norm = (s) => s.replace(/[\u2014\u2013]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

function loadBlocks(rel) {
  const text = readFileSync(path.join(REPO, 'docs/eval-fixtures', rel), 'utf8')
  const lines = text.split('\n')
  const blocks = []
  let cur = []
  const flush = () => { if (cur.length) blocks.push(cur.join('\n')); cur = [] }
  for (const line of lines) {
    if (/^(\*\*[A-Z]?\d+[A-Za-z]?\.|#{2,4} |\*\*Claim \d+|---\s*$)/.test(line)) flush()
    cur.push(line)
  }
  flush()
  return blocks
}

// A block is a per-claim entry only when it opens with a claim label such as
// "**A10. open-s4 / run5, tip2**". The audit hand-check labels after-a claims A
// and after-b claims B. Anything else that happens to quote the sentence (a
// summary table, a section of prose) is a mention, reported as such, because a
// ruling cannot be read off it mechanically and is read by hand instead.
const ENTRY_HEAD = /^\*\*([AB]\d+)\. ([\w-]+) \/ run(\d+), (\w+)\*\*/

function crossCheck(change, cfg, blocksByDoc) {
  const q = norm(change.quote)
  const m = /^shipped\/([\w-]+)\/run(\d+)$/.exec(change.id)
  const [cell, run] = [m[1], m[2]]
  const letter = cfg.id.endsWith('after-a') ? 'A' : cfg.id.endsWith('after-b') ? 'B' : null
  const found = []
  for (const [doc, blocks] of blocksByDoc) {
    for (const block of blocks) {
      const head = block.split('\n').find((l) => l.trim()) ?? ''
      const e = ENTRY_HEAD.exec(head)
      const text = block.replace(/\s+/g, ' ')
      if (e) {
        // Entry: must be this round's letter, this cell and this run.
        if (e[1][0] !== letter || e[2] !== cell || e[3] !== run) continue
        const sameSentence = norm(block).includes(q)
        const ruling = /\*\*GENUINE/.test(text) ? 'GENUINE' : /\*\*FALSE POSITIVE/.test(text) ? 'FALSE POSITIVE' : 'ruling unread'
        found.push({ doc, kind: 'entry', label: e[1], field: e[4], sameSentence, ruling })
      } else if (norm(block).includes(q)) {
        found.push({ doc, kind: 'mention', head: head.trim().slice(0, 60) })
      }
    }
  }
  return found
}

function pad(n, w = 4) { return String(n).padStart(w) }

async function main() {
  const verdictOld = await loadVerdictBeforeFix()
  const lines = []
  const say = (s = '') => { lines.push(s); console.log(s) }

  say('REPLAY OF THE PITCH-POSITION ROUNDING FIX, 30 September 2026')
  say(`Verdict code compared: the pre-fix code at main commit ${BASE_COMMIT} (before) against the working tree (after), on one rebuilt fact sheet per cell.`)
  say('"stored" is what the committed grading file recorded on the day; it is shown so the before column can be checked for faithfulness.')
  say('No network, no API key, no spend.')
  say()

  const all = []
  const refused = []
  for (const cfg of FILES) {
    try {
      all.push(await replayFile(cfg, verdictOld))
    } catch (err) {
      refused.push({ cfg, reason: describeRefusal(cfg, null, err) })
    }
  }

  say('PER-ROUND TOTALS (FALSE verdicts)')
  say('  round                        records claims  stored-FALSE before-FALSE after-FALSE changed  stored!=before  builder')
  for (const r of all) {
    say(
      `  ${r.cfg.id.padEnd(28)} ${pad(r.records, 6)} ${pad(r.claims, 6)}  ${pad(r.stored.FALSE, 12)} ${pad(r.before.FALSE, 12)} ${pad(r.after.FALSE, 11)} ${pad(r.changes.length, 7)}  ${pad(r.storedVsBeforeMismatch, 14)}  ${r.builder} (${r.handedEra}, seed ${r.seed})`,
    )
  }
  say()
  say('  "stored!=before" counts claims where the before-fix code on the rebuilt fact sheet disagrees with the verdict stored on the day.')
  say('  A nonzero count means something other than this fix separates the file from today (earlier verdict fixes, or a fact sheet that')
  say('  does not match what the coach saw). The changes column is unaffected by it, since it compares before-fix with after-fix on the')
  say('  same sheet, but a file with a large mismatch is not evidence about the real debriefs and is marked below.')
  say()

  say('FILES NOT REPLAYED')
  if (!refused.length) say('  (none)')
  for (const f of refused) say(`  ${f.cfg.file}: ${f.reason}`)
  say()

  say('EVERY CHANGED VERDICT')
  let totalChanges = 0
  let totalViolations = 0
  const blocksByDoc = new Map()
  for (const cfg of FILES) for (const d of cfg.hand) if (!blocksByDoc.has(d)) blocksByDoc.set(d, loadBlocks(d))
  for (const r of all) {
    if (!r.changes.length) continue
    say(`--- ${r.cfg.id}  (${r.cfg.file})  ${r.changes.length} change(s)`)
    const docs = new Map(r.cfg.hand.map((d) => [d, blocksByDoc.get(d)]))
    for (const c of r.changes) {
      totalChanges += 1
      const hits = docs.size ? crossCheck(c, r.cfg, docs) : []
      const hand = hits.length
        ? hits.map((h) => h.kind === 'entry'
          ? `entry ${h.label} (${h.field})${h.sameSentence ? ' quotes the same sentence' : ' is a different sentence in the same debrief'}: ${h.ruling}`
          : `MENTION only in ${h.doc} [${h.head}]`).join('; ')
        : 'no hand-check entry or mention for this debrief and sentence'
      if (hits.some((h) => h.kind === 'entry' && h.sameSentence && h.ruling === 'GENUINE') && !r.violations.includes(c)) r.violations.push(c)
      const flag = r.violations.includes(c) ? '  ** VIOLATION **' : ''
      say(`  ${c.id} ${c.field} ${c.from}->${c.to} metric=${c.metric} session=${c.sessionNumber} swing=${c.swingNumber} stated=${c.stated} true=${c.trueValue} round1=${c.trueValue === null ? 'n/a' : round1(c.trueValue)}${flag}`)
      say(`      quote: "${c.quote.replace(/[\u2014\u2013]/g, '-')}"`)
      say(`      hand-check: ${hand}`)
    }
    totalViolations += r.violations.length
  }
  say()
  say('NOTES')
  say('  Hand-check matching: the audit hand-check labels claims A1.. (after-a) and B1.. (after-b) with cell, run and field. A changed claim is')
  say('  matched to an entry only when the round letter, cell and run all agree; it is "the same sentence" only when the entry quotes the changed')
  say('  claim\'s quote. The 67 audit rounding flags were never itemised one by one there (section 4 spot-checks 5 and says a script compared all')
  say('  67 to the rounded value), so most rows show no entry. A MENTION is the quote turning up in a prose section (4 or 6); those were read by hand.')
  say('  Other documents: no verdict changes exist outside the audit rounds, so no other hand-check is consulted for a change. Coach em dashes in')
  say('  quotes are printed as hyphens.')
  say('  Faithfulness: rows with stored!=before of 0 replay the stored verdicts exactly with the pre-fix code. slice9 after-b (1) is the Slice 9')
  say('  empty-list fix and slice8c (1 and 8) the Slice 8d negated-exceedance guard, both earlier fixes already recorded in their own')
  say('  directories; they are not changes made by this fix and do not appear under EVERY CHANGED VERDICT.')
  say('  slice8c and slice8d files have no BUILDER.txt and carry session-1 swings and a generator that predate Slices 9 and 11, so they are')
  say('  replayed through builder slice9-before. For the two slice8d files stored!=before of 0 shows that choice reproduces their stored verdicts')
  say('  outright. For slice8c the 1 and 8 mismatches are fully explained by the Slice 8d negated-exceedance guard, recorded in')
  say('  docs/eval-fixtures/slice8d-grader-fp/replay-8c-rounds.txt; that is an explanation of the mismatches, not a clean match.')
  say()
  say(`TOTAL CHANGES: ${totalChanges}`)
  say(`VIOLATIONS (not FALSE->TRUE on pitchHeight/pitchSide with stated == true rounded to one decimal, or matched to a GENUINE hand-check block): ${totalViolations}`)
  writeFileSync(path.join(HERE, 'replay-rounding-fix.txt'), lines.join('\n') + '\n')
  if (totalViolations) process.exitCode = 1
}

await main()
