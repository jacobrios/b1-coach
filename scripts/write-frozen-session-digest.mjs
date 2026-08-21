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
// ADDING A GROUP THAT WAS NEVER CAPTURED IS NOT THE SAME ACT, AND HAS ITS OWN
// FLAG. Added 20 August 2026, hours after the file above was first written,
// when review found a sixth exposed fixture directory nothing had recorded.
//
// The refusal above is there to stop the committed numbers being REPLACED. It
// is not a reason to leave a newly discovered builder unrecorded forever, and
// the only alternatives were re-running the whole thing with --overwrite (which
// would rewrite every existing group from a working tree that has since moved,
// and stamp a new commit id over the old one) or hand-editing an 84 KB JSON
// record. Both are worse than a flag that can only append.
//
//   --add-group <builder>   computes exactly one group and inserts it, refuses
//                           if that group is already in the file, and touches
//                           no byte of any group already there. It also writes
//                           a dated line into the file saying the group was
//                           added later and by what, so a reader is never left
//                           guessing why one group has a different provenance
//                           from the rest.
//
// This is still only honest while the working tree holds the pre-Slice-11
// generator. After that it records what the new generator makes, under a name
// claiming otherwise, which is the exact failure everything here exists to
// stop. It refuses nothing on that front, because it cannot tell; the ordering
// is the human's to get right, and it is provable from git history afterwards.
//
// HOW TO RUN
//   node scripts/write-frozen-session-digest.mjs
//   node scripts/write-frozen-session-digest.mjs --out <path>
//   node scripts/write-frozen-session-digest.mjs --overwrite   (see above)
//   node scripts/write-frozen-session-digest.mjs --add-group <builder>
//
// No API key, no network call, no spend. It only runs the generator.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { resolveSessions } from './grade-coach-accuracy.mjs'
import { DIGEST_GROUPS, SWING_LINE_FORMAT, digestForCell } from './sessionDigest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUT = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json')

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, overwrite: false, addGroup: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      args.out = path.resolve(REPO_ROOT, argv[++i])
    } else if (argv[i] === '--overwrite') {
      args.overwrite = true
    } else if (argv[i] === '--add-group') {
      args.addGroup = argv[++i]
    } else {
      throw new Error(
        `Unknown argument "${argv[i]}". Supported: --out <path>, --overwrite, --add-group <builder>.`,
      )
    }
  }
  // The two are opposites: one refuses to touch an existing file, the other
  // only works on one. Taking both would leave it ambiguous which refusal was
  // meant to apply, so it is refused rather than resolved in favour of either.
  if (args.addGroup && args.overwrite) {
    throw new Error('--add-group appends one group to an existing digest. --overwrite replaces the whole file. Pick one.')
  }
  return args
}

// The calendar day where this repository's author is standing, not UTC.
//
// Written the long way rather than with toISOString().slice(0, 10), and it is
// not a style preference. Measured on the machine that wrote this, at 22:45 on
// 20 August 2026 in CDT: toISOString() reports 2026-08-21, because it converts
// to UTC first. Every dated record in this project (CLAUDE.md, the decision
// log, every BUILDER.txt annotation) is stamped with the author's own local
// day, so a UTC stamp would have quietly filed this evening's work under
// tomorrow, in the one file whose entire job is saying which day something
// happened on. Caught by reading the output instead of trusting it.
function localDay() {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
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

// One group's worth of work, shared by the full write and by --add-group, so
// a group appended later cannot be built by a second, subtly different loop
// from the ones already in the file.
async function buildGroupEntry(group) {
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
  return entry
}

// Appends one group to a digest that already exists, and refuses everything
// else. Every refusal here is guarding the same thing: that this file records
// what happened rather than what somebody wanted it to say.
async function addGroup(args) {
  const group = DIGEST_GROUPS.find((g) => g.builder === args.addGroup)
  if (!group) {
    throw new Error(
      `Unknown group "${args.addGroup}". It must first exist in DIGEST_GROUPS in ` +
        `scripts/sessionDigest.js, so the writer and the permanent test agree on what is covered. ` +
        `Known: ${DIGEST_GROUPS.map((g) => g.builder).join(', ')}.`,
    )
  }
  if (!existsSync(args.out)) {
    throw new Error(
      `${path.relative(REPO_ROOT, args.out)} does not exist. --add-group appends to a digest that is ` +
        'already committed. Run this script with no flags to write one from scratch.',
    )
  }
  const digest = JSON.parse(readFileSync(args.out, 'utf8'))
  if (digest.groups[group.builder]) {
    throw new Error(
      `${path.relative(REPO_ROOT, args.out)} already records the "${group.builder}" group. This flag only ` +
        'ever appends. Replacing a group that is already committed destroys the only evidence of what the ' +
        'old generator produced, which is the one thing this file is for.',
    )
  }

  digest.groups[group.builder] = await buildGroupEntry(group)
  // Written into the record itself rather than left to the commit message,
  // because a reader opening this JSON in a year will not have the commit in
  // front of them and would otherwise have no way to tell why one group has a
  // later provenance than the rest.
  digest.laterAdditions = [
    ...(digest.laterAdditions ?? []),
    {
      group: group.builder,
      addedOn: localDay(),
      fromWorkingTreeAtCommit: currentCommit(),
      by: `node scripts/write-frozen-session-digest.mjs --add-group ${group.builder}`,
      why:
        'Not captured in the original write because nobody had noticed this fixture was exposed. ' +
        'Every group already in this file was left untouched.',
    },
  ]
  writeFileSync(args.out, `${JSON.stringify(digest, null, 2)}\n`, 'utf8')
  console.log('')
  console.log(`Appended the "${group.builder}" group to ${path.relative(REPO_ROOT, args.out)}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.addGroup) {
    await addGroup(args)
    return
  }

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
    digest.groups[group.builder] = await buildGroupEntry(group)
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
