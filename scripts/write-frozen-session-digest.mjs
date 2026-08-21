#!/usr/bin/env node
//
// Writes docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json: a record
// of exactly what session data the grader's builders produced on 20 August
// 2026, taken from the live working tree before Slice 11 touched
// src/swingGenerator.js.
//
// THIS SCRIPT IS A ONE-SHOT AND SAYING SO IS THE POINT.
// Run it again after Slice 11 lands and it will not reproduce the committed
// file, because the "current" builder it reads from is the working tree and
// the working tree will have moved. That is not a bug in the script; it is
// the whole reason the committed file exists. It refuses to overwrite an
// existing digest for exactly that reason, and the only honest way past that
// refusal is to be certain you are recording a new baseline rather than
// erasing the old one.
//
// The permanent check is scripts/frozenGenerator.test.js, which re-derives
// these same numbers through the frozen generator snapshot on every single
// `npm test` and fails if one of them moves.
//
// HOW TO RUN
//   node scripts/write-frozen-session-digest.mjs
//   node scripts/write-frozen-session-digest.mjs --out <path>
//   node scripts/write-frozen-session-digest.mjs --overwrite   (see above)
//
// No API key, no network call, no spend. It only runs the generator.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { resolveSessions } from './grade-coach-accuracy.mjs'
import { DIGEST_GROUPS, SWING_LINE_FORMAT, digestForCell } from './sessionDigest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUT = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json')

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, overwrite: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      args.out = path.resolve(REPO_ROOT, argv[++i])
    } else if (argv[i] === '--overwrite') {
      args.overwrite = true
    } else {
      throw new Error(`Unknown argument "${argv[i]}". Supported: --out <path>, --overwrite.`)
    }
  }
  return args
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (existsSync(args.out) && !args.overwrite) {
    throw new Error(
      `${path.relative(REPO_ROOT, args.out)} already exists. This digest is a record of a day that has ` +
      'passed, not a file to keep in step with the working tree. Rewriting it destroys the only evidence ' +
      'of what the old generator produced. Pass --overwrite only if you are deliberately recording a new ' +
      'baseline, and say so in the commit message.',
    )
  }

  const digest = {
    whatThisIs: [
      'What the coach grader\'s session builders produced on 20 August 2026, before Slice 11 changed',
      'src/swingGenerator.js. Five committed rounds of debriefs describe these swings and no others.',
      'Rebuilding those rounds against a later generator does not fail; it produces a complete and',
      'entirely plausible set of swings the coach never saw, and nothing looks broken. This file is the',
      'evidence that says which one you are looking at.',
      '',
      'DO NOT UPDATE THIS FILE to match anything. It is checked on every npm test by',
      'scripts/frozenGenerator.test.js, which rebuilds every cell below through the frozen generator',
      'snapshot in docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs. If that check goes red, the',
      'answer is a change to the snapshot or the builders, never a change to these numbers.',
    ],
    producedOn: '2026-08-20',
    producedFromWorkingTreeAtCommit: currentCommit(),
    producedBy: 'node scripts/write-frozen-session-digest.mjs',
    swingLineFormat: SWING_LINE_FORMAT,
    groups: {},
  }

  for (const group of DIGEST_GROUPS) {
    const entry = {
      // Read these two together. producedByBuilder is what was run to write
      // the file, on the one day the working tree still held the old
      // generator. The group name is what must reproduce it from now on.
      producedByBuilder: group.producedByBuilder,
      mustBeReproducedByBuilder: group.builder,
      seeds: {},
    }
    for (const seed of group.seeds) {
      const cells = {}
      for (const cellKey of group.cellKeys) {
        const resolved = await resolveSessions({
          builder: group.producedByBuilder,
          cellKey,
          seed,
        })
        cells[cellKey] = digestForCell(resolved)
        const sessionCount = resolved.sessions.length
        console.log(`  ${group.builder} @ ${seed} :: ${cellKey} (${sessionCount} session(s))`)
      }
      entry.seeds[String(seed)] = cells
    }
    digest.groups[group.builder] = entry
  }

  mkdirSync(path.dirname(args.out), { recursive: true })
  writeFileSync(args.out, `${JSON.stringify(digest, null, 2)}\n`, 'utf8')
  console.log('')
  console.log(`Wrote ${path.relative(REPO_ROOT, args.out)}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
