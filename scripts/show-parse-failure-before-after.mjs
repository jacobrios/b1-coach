#!/usr/bin/env node
//
// Prints, in plain language, the before/after evidence behind Slice 7b's
// headline claim: the session-1 JSON parse failure went from 14 failed
// calls out of 36 to 0 failed calls out of 36.
//
// WHY THIS FILE EXISTS. The product manager does not read code and should
// not have to trust a chat message reporting this number. This script reads
// the two committed record files the claim is built from and prints the
// count itself, so the claim can be checked from a terminal in a few
// seconds, by anyone, without opening any code.
//
// NO NETWORK CALLS. NO SPEND. This script only reads two JSON files already
// committed to the repo. It never calls Anthropic and costs nothing to run.
//
// WHAT IT READS. Both files are 36 records each, one per live Anthropic
// call made while building and then verifying the fix, across four cells:
// power-s1, power-s2, contact-s4, open-s4. Full provenance and the two
// caveats this script also prints are in
// docs/eval-fixtures/slice7b-parse-failure/README.md.
//
//   before-shipped-records.json  the coach exactly as it shipped, before
//                                 the fix.
//   after-fix-records.json       the coach with the fix applied.
//
// HAND-RUN, NOT PART OF THE SUITE. This file is named show-*.mjs, not
// *.test.js, which is what this project's default vitest collection keys
// on (no vitest.config, so vitest's own default include glob applies). It
// will never run inside `npm test` and never gate a commit.
//
// HOW TO RUN, FROM ANYWHERE
//   node scripts/show-parse-failure-before-after.mjs
//   node /full/path/to/scripts/show-parse-failure-before-after.mjs
//
// It resolves the two record files relative to its own location, not to
// whatever directory the shell happens to be standing in, so it produces
// identical output run from the repo root or from anywhere else.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.resolve(__dirname, '..', 'docs', 'eval-fixtures', 'slice7b-parse-failure')

const BEFORE_PATH = path.join(FIXTURE_DIR, 'before-shipped-records.json')
const AFTER_PATH = path.join(FIXTURE_DIR, 'after-fix-records.json')

// Plain-English gloss for each cell name, so a non-engineer reading the
// output does not have to guess what "contact-s4" means.
const CELL_GLOSS = {
  'power-s1': 'the Power goal on session 1, the first screen every visitor sees',
  'power-s2': 'the Power goal on session 2',
  'contact-s4': 'the Contact goal on session 4',
  'open-s4': 'Open Session (no goal picked) on session 4',
}

const CELL_ORDER = ['power-s1', 'power-s2', 'contact-s4', 'open-s4']

function loadRecords(filePath, label) {
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error(`Could not read the ${label} file at:`)
    console.error(`  ${filePath}`)
    console.error(`(${err.message})`)
    process.exit(1)
  }
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) {
    console.error(`Expected ${label} to be a JSON array of records; it was not.`)
    process.exit(1)
  }
  return records
}

function summarize(records) {
  const byCell = {}
  for (const cell of CELL_ORDER) {
    byCell[cell] = { total: 0, failed: 0 }
  }
  let totalFailed = 0
  for (const record of records) {
    const cell = record.cell
    if (!byCell[cell]) byCell[cell] = { total: 0, failed: 0 }
    byCell[cell].total += 1
    if (record.failed) {
      byCell[cell].failed += 1
      totalFailed += 1
    }
  }
  return { byCell, totalCalls: records.length, totalFailed }
}

function printRun(label, summary) {
  console.log(`${label}: ${summary.totalFailed} of ${summary.totalCalls} calls failed to parse.`)
  for (const cell of CELL_ORDER) {
    const cellSummary = summary.byCell[cell]
    if (!cellSummary) continue
    const gloss = CELL_GLOSS[cell] || cell
    console.log(`  ${cell} (${gloss}): ${cellSummary.failed} of ${cellSummary.total} failed`)
  }
}

const beforeRecords = loadRecords(BEFORE_PATH, 'before')
const afterRecords = loadRecords(AFTER_PATH, 'after')

const beforeSummary = summarize(beforeRecords)
const afterSummary = summarize(afterRecords)

console.log('')
console.log('=== Slice 7b parse-failure fix: before and after ===')
console.log('')
console.log('This script makes no network calls and costs nothing to run. It only')
console.log('reads two JSON files already committed to this repo.')
console.log('')
printRun('BEFORE the fix', beforeSummary)
console.log('')
printRun('AFTER the fix', afterSummary)
console.log('')
console.log(
  `CONCLUSION: the parse failure went from ${beforeSummary.totalFailed} of ` +
    `${beforeSummary.totalCalls} calls failing before the fix to ` +
    `${afterSummary.totalFailed} of ${afterSummary.totalCalls} calls failing after it.`
)
console.log('')
console.log('TWO THINGS NOT TO READ TOO FAR INTO THIS:')
console.log('')
console.log(
  '1. The before run\'s SURVIVING records are a biased sample. Only calls that'
)
console.log(
  '   did not overrun the model\'s output ceiling survived to be graded in the'
)
console.log(
  '   before run, which is not a random subset, it is specifically the calls'
)
console.log(
  '   that happened to stay short. So any citation-quality comparison between'
)
console.log(
  '   the before and after runs is not a valid comparison, even on cells where'
)
console.log('   both runs technically have data.')
console.log('')
console.log(
  '2. The failed records in the before file carry no raw text. A failed record'
)
console.log(
  '   there only says which call failed and that it failed to parse; the bench'
)
console.log(
  '   that produced this run had not yet been taught to keep the model\'s raw'
)
console.log(
  '   reply on a failure. There is no way to recover what the model actually'
)
console.log('   wrote for those 14 calls.')
console.log('')
console.log('Full detail: docs/eval-fixtures/slice7b-parse-failure/README.md')
console.log('')
