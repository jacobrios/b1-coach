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

// Where the recovered half of the snapshot starts. Everything from this line
// to the end of the file is hashed; the prose header above it is not, so it
// stays editable. That split is deliberate and this branch has already
// needed it twice: the header has been corrected once for imprecision and
// once for a self-matching search pattern, and neither correction should
// have been able to force a re-pin of the number below.
const RECOVERED_MARKER = '\n// The recovered file begins here\n'

// Pinned 20 August 2026, from the file as recovered from commit 53315e5.
// IF THIS NUMBER AND THE FILE DISAGREE, THE FILE IS WRONG. Re-pinning it to
// make a test pass silently converts the snapshot into a copy of whatever
// the generator has become, which is the exact outcome the whole task
// exists to prevent.
const RECOVERED_HALF_SHA256 = 'a07c006018226854cc2e94e0633260591b4b65c2b210f50afad00640ab49a649'

describe('the frozen pre-Slice-11 generator still produces what it produced', () => {
  // TWO DIFFERENT QUESTIONS ARE ASKED IN THIS FILE, AND MIXING THEM UP IS
  // HOW A SNAPSHOT STOPS BEING ONE.
  //
  // This first test asks: HAS THE FILE MOVED? It hashes the recovered half
  // and compares it to a pinned number, so any edit to the generator code
  // fails, whether or not it changes a single swing.
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
  it('the recovered half of the snapshot is byte-for-byte what was recovered', () => {
    const text = readFileSync(SNAPSHOT_PATH, 'utf8')
    // Exactly one marker, anchored to a whole line. An unanchored search
    // would also match the snapshot's own header, which explains the marker.
    expect(text.split(RECOVERED_MARKER).length - 1, 'the snapshot must carry exactly one recovered-file marker').toBe(1)
    const recovered = text.slice(text.indexOf(RECOVERED_MARKER) + 1)
    expect(createHash('sha256').update(recovered, 'utf8').digest('hex')).toBe(RECOVERED_HALF_SHA256)
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
