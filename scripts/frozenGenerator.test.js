// The permanent guard on the frozen swing generator.
//
// Five committed rounds of coach debriefs describe swing data that nothing
// stores. Sessions 2, 3 and 4 are generated from session 1 with a seeded
// PRNG, so the only record of what a round was written about is the
// generator that produced it plus the seed it ran at. Slice 11 rewrites
// src/swingGenerator.js, so those five rounds now read a frozen snapshot,
// docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs, instead of the
// working tree.
//
// WHAT THIS TEST IS FOR, IN ONE SENTENCE: the snapshot is only worth
// anything for as long as it keeps producing exactly what it produced on
// 20 August 2026, and nothing else in this repository would notice if it
// stopped.
//
// The failure it exists to catch does not look like a failure. Grading a
// round through a changed generator does not throw, does not warn and does
// not leave a gap. It produces a complete, entirely plausible fact sheet for
// swings the coach never saw, on 40 of every 64 records, and every verdict
// computed from it reads like a result. There is no symptom to notice, which
// is precisely why the check has to be automatic rather than remembered.
//
// It is cheap and offline: no model call, no network, no spend. It runs the
// generator and compares numbers.
//
// WHAT IT WATCHES IS THE DATA, NOT THE FILE, and the difference showed up
// the first time this test was deliberately broken. Standing in for Slice
// 11's pop-up work, the snapshot's launch angle ceiling was raised from 35
// degrees to 55 and every one of these tests stayed green: no swing in any
// cell at either seed reaches that ceiling, so no committed round would have
// been affected. Green was the right answer. Read that as the scope of the
// guard rather than as a hole in it: it fails when the swings five committed
// rounds were written about would change, which is the thing worth
// protecting, and it is silent about a generator edit those rounds cannot
// see. A change to the spray bias, which touches every swing, turns 15 of
// these red immediately.
//
// IF THIS TEST GOES RED, the answer is never to regenerate the digest. The
// digest is a record of a day that has passed. Something has changed the
// snapshot, or changed which generator a builder reaches for, and the change
// is what needs undoing.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { resolveSessions } from './grade-coach-accuracy.mjs'
import { DIGEST_GROUPS, digestForCell } from './sessionDigest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DIGEST_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json')
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs')

const digest = JSON.parse(readFileSync(DIGEST_PATH, 'utf8'))

// WHERE THE HASHED REGION STARTS, AND THE ONE RULE THAT DECIDES IT.
//
// Everything in the snapshot that a future edit could silently change the
// behaviour of is inside the hash. The only thing outside it is prose that
// carries no behaviour. That is the whole rule, and the boundary line below
// is where it is drawn.
//
// It was drawn in the wrong place first, earlier on this same day, at the
// "recovered file begins here" marker further down the file. That left the
// frozen copies of carryDistance, hasTarget, meetsTarget and GOAL_TARGETS
// outside the hash, because they were recovered from ballFlight.js and
// goalTargets.js rather than from swingGenerator.js and therefore sit above
// that marker. Review proved the hole rather than arguing it: mutating
// carryDistance's high-angle floor from 0.55 to 0.40 left all 23 tests
// green. That constant is the coupling CLAUDE.md says to re-check if the
// pop-up ceiling is raised, and raising the pop-up ceiling is one of the
// three things Slice 11 is about to do.
//
// The prose header stays outside because it has needed correcting twice on
// this branch already (once for imprecision, once for a search pattern that
// matched its own paragraph) and no such correction should be able to force
// a re-pin of the number below. That carve-out is defended from the other
// side inside the boundary-integrity test below, which fails the suite on any
// line above the boundary that is not blank and not a single-line comment, so
// behaviour cannot be moved out of the hashed region. Read that test's own
// comment for what the pattern is fussy about and why.
//
// Held as bare line text, and every check below counts and locates it by
// whole line rather than by substring. That is not tidiness. An earlier draft
// searched for the line wrapped in newlines, which silently under-counts two
// ADJACENT copies of the boundary, because the two occurrences share the
// newline between them and the split consumes it. Found by trying it.
const HASH_BOUNDARY_LINE = '// ==== HASH BOUNDARY. EVERY LINE BELOW IS PINNED BY scripts/frozenGenerator.test.js ===='

// The second marker, kept because the snapshot's header offers a diff command
// anchored to it and because it proves the hashed region spans both halves of
// the file, the frozen imports and the recovered generator.
const RECOVERED_MARKER_LINE = '// The recovered file begins here'

// Pinned 20 August 2026, over every line of code in the snapshot.
// IF THESE AND THE FILE DISAGREE, THE FILE IS WRONG. Re-pinning them to make
// a test pass silently converts the snapshot into a copy of whatever the
// generator has become, which is the exact outcome this whole task exists to
// prevent.
//
// The byte count is pinned beside the hash on purpose. A hash alone says
// "different" in the same breath for a one-character edit and for a region
// that has been emptied or truncated to nothing, and those want different
// reactions from whoever reads the failure. The length is checked first so
// the shrunk-to-nothing case says so in words.
const FROZEN_CODE_BYTES = 14093
const FROZEN_CODE_SHA256 = 'b03a7c19412ecc470c66d94cb4a17d30e4a7eaab1718d906d3a3f285290202be'

describe('the frozen pre-Slice-11 generator still produces what it produced', () => {
  // TWO DIFFERENT QUESTIONS ARE ASKED IN THIS FILE, AND MIXING THEM UP IS
  // HOW A SNAPSHOT STOPS BEING ONE.
  //
  // The first two tests ask: HAS THE FILE MOVED? They hash every line of
  // code in the snapshot, the frozen copies of carryDistance and the goal
  // targets as well as the recovered generator, and compare it to a pinned
  // number. Any edit to any of it fails, whether or not it changes a single
  // swing.
  //
  // Every other test in this file asks: HAS THE DATA MOVED? Those rebuild
  // the sessions five committed rounds were written about and compare them
  // to the digest, so they fail when those rounds would be graded against
  // swings their coaches never saw.
  //
  // Neither subsumes the other, which was measured rather than assumed. On
  // 20 August 2026 the reviewer mutated the snapshot five ways, one line
  // each, and rebuilt all 21 cell-and-seed combinations against each:
  //
  //   launch angle ceiling 35 -> 55              0 of 21 red
  //   launch angle floor -5 -> -20               0 of 21 red
  //   exit velocity clamps 65..97 -> 55..105     0 of 21 red
  //   carryDistance high-angle floor .55 -> .40  0 of 21 red
  //   the empty-band re-roll removed entirely    3 of 21 red (contact-s4)
  //
  // So all four clamps and the whole above-28-degrees branch of the carry
  // formula are invisible to the data check, and the re-roll, which this
  // project's CLAUDE.md warns twice about narrowing, rested on one cell.
  // That is fine as an answer to the second question and useless as an
  // answer to the first, and the first is what the snapshot's own header
  // promises. It matters concretely right now: the pop-up ceiling is one of
  // the three things Slice 11 is about to change, and this file is a
  // near-identical copy of the live generator sitting in the same
  // repository, so a repo-wide search and replace would hit both.
  //
  // Read the fourth row of that table against the boundary constants above.
  // The first version of this hash started at the recovered-file marker, so
  // it did not reach carryDistance either, and that row was green under BOTH
  // checks. Widening the region is what closed it.
  it('the snapshot carries one unambiguous hash boundary, with only prose above it', () => {
    const lines = readFileSync(SNAPSHOT_PATH, 'utf8').split('\n')
    // Exactly one of each marker, counted as whole lines. An unanchored
    // substring search would also match the snapshot's own header, which
    // explains both markers in prose.
    expect(
      lines.filter((line) => line === HASH_BOUNDARY_LINE).length,
      'the snapshot must carry exactly one hash boundary line',
    ).toBe(1)
    expect(
      lines.filter((line) => line === RECOVERED_MARKER_LINE).length,
      'the snapshot must carry exactly one recovered-file marker',
    ).toBe(1)
    // The recovered generator must sit INSIDE the hashed region. If this ever
    // reverses, the boundary has been moved down past half the file.
    expect(
      lines.indexOf(RECOVERED_MARKER_LINE),
      'the recovered generator must sit inside the hashed region',
    ).toBeGreaterThan(lines.indexOf(HASH_BOUNDARY_LINE))
    // And the carve-out defended from the other side: nothing above the
    // boundary may carry behaviour. Without this, the boundary could simply
    // be walked downward, or a function pasted above it, and the hash would
    // still pass while covering less and less.
    //
    // THE PATTERN IS FUSSIER THAN IT LOOKS AND EVERY PART OF IT IS PAYING
    // FOR SOMETHING.
    //
    // `\s*` up front: an indented comment is a comment. The first version of
    // this check anchored `//` at column 0, so it would have called an
    // indented line behaviour and failed the suite with a message telling the
    // author their comment was not a comment. The header above this boundary
    // is actively edited (three times in one day so far), so that was a live
    // false-red trap rather than a hypothetical one.
    //
    // The excluded characters are U+2028 LINE SEPARATOR and U+2029 PARAGRAPH
    // SEPARATOR, written as escapes rather than pasted in, because the entire
    // point of them is that they are invisible in a source file. JavaScript
    // ends a `//` comment at either of them; String.split('\n') does not. So
    // one physical line starting with `//` and containing a U+2028 is prose
    // to a newline-based check and a comment followed by a live statement to
    // Node. Review demonstrated it with a line reading as a formatting note
    // that patched Math.min when not running under vitest: 597 tests green,
    // and the frozen generator's exit velocity ceiling reading 90 instead of
    // 97 when loaded by scripts/grade-coach-accuracy.mjs, which is how it is
    // actually loaded. Reproduced here before the fix, and measured after.
    //
    // CALIBRATE THIS HONESTLY, because the fix is cheap and the threat is
    // not the reason to take it. Nobody types U+2028 by accident and no
    // search and replace produces one. This was a hole in the
    // TAMPER-EVIDENCE claim, not in the drift protection that is the guard's
    // day job. It was worth closing because three committed documents assert
    // the stronger claim, and a claim this project cannot back is exactly
    // what this whole task exists to stamp out.
    const above = lines.slice(0, lines.indexOf(HASH_BOUNDARY_LINE))
    const carriesBehaviour = above.filter(
      (line) => line.trim() !== '' && !/^\s*\/\/[^\u2028\u2029]*$/.test(line),
    )
    expect(
      carriesBehaviour,
      'every line above the hash boundary must be blank, or a single-line // comment ' +
        'carrying no unicode line separator',
    ).toEqual([])
  })

  it('every line of frozen code in the snapshot is byte-for-byte what was recovered', () => {
    const lines = readFileSync(SNAPSHOT_PATH, 'utf8').split('\n')
    const frozen = lines.slice(lines.indexOf(HASH_BOUNDARY_LINE)).join('\n')
    // Length first, so a region emptied or truncated to nothing reports that
    // in words rather than as two unequal hex strings.
    expect(
      Buffer.byteLength(frozen, 'utf8'),
      'the hashed region changed size; if it shrank, the boundary was moved or the file was truncated',
    ).toBe(FROZEN_CODE_BYTES)
    expect(createHash('sha256').update(frozen, 'utf8').digest('hex')).toBe(FROZEN_CODE_SHA256)
  })

  // THE COVERAGE TEST, AND IT IS COMPARED IN BOTH DIRECTIONS ON PURPOSE.
  //
  // Every comparison below this one is generated by looping over
  // DIGEST_GROUPS, which lives in code. So deleting a group or a seed from
  // that list does not turn anything red; it silently stops seven tests from
  // existing at all, and the suite reports a smaller green number that
  // nobody reads as a loss. That is the easiest mistake available here and
  // the first one somebody chasing a red test would reach for.
  //
  // The fix is to make the code's list and the committed file check each
  // other rather than one checking the other: the group names must match
  // exactly, and within each group the seed keys must match exactly. Drop a
  // group from the code and this test fails because the file still has it.
  // Drop it from the file and this test fails because the code still has it.
  //
  // The per-cell checks underneath are a second, separate job: they stop a
  // digest that has quietly lost its contents letting every toEqual below
  // pass against nothing.
  it('reads a digest covering every builder, seed and cell it claims to', () => {
    expect(Object.keys(digest.groups).sort()).toEqual(DIGEST_GROUPS.map((g) => g.builder).sort())
    for (const group of DIGEST_GROUPS) {
      const entry = digest.groups[group.builder]
      expect(entry, `digest has no group for ${group.builder}`).toBeTruthy()
      expect(Object.keys(entry.seeds).sort(), `${group.builder} seed coverage`).toEqual(
        group.seeds.map(String).sort(),
      )
      for (const seed of group.seeds) {
        const cells = entry.seeds[String(seed)]
        expect(cells, `${group.builder} has no seed ${seed}`).toBeTruthy()
        expect(Object.keys(cells).sort()).toEqual([...group.cellKeys].sort())
        for (const cellKey of group.cellKeys) {
          expect(cells[cellKey].sessions.length).toBeGreaterThan(0)
          for (const session of cells[cellKey].sessions) {
            expect(session.swings).toHaveLength(15)
          }
        }
      }
    }
  })

  // One test per cell per seed rather than one big loop inside a single test,
  // so a failure names the cell and the seed in its own title instead of
  // making somebody read a diff of several hundred swings to find out which
  // one moved.
  for (const group of DIGEST_GROUPS) {
    for (const seed of group.seeds) {
      for (const cellKey of group.cellKeys) {
        it(`${group.builder} @ seed ${seed} :: ${cellKey}`, async () => {
          const resolved = await resolveSessions({ builder: group.builder, cellKey, seed })
          expect(digestForCell(resolved)).toEqual(digest.groups[group.builder].seeds[String(seed)][cellKey])
        })
      }
    }
  }
})
