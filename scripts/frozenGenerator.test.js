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
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { resolveSessions } from './grade-coach-accuracy.mjs'
import { DIGEST_GROUPS, digestForCell } from './sessionDigest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DIGEST_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json')

const digest = JSON.parse(readFileSync(DIGEST_PATH, 'utf8'))

describe('the frozen pre-Slice-11 generator still produces what it produced', () => {
  // The digest has to be non-trivially populated before any comparison below
  // means anything. A digest that had lost its contents would let every
  // toEqual pass against nothing.
  it('reads a digest covering every builder, seed and cell it claims to', () => {
    for (const group of DIGEST_GROUPS) {
      const entry = digest.groups[group.builder]
      expect(entry, `digest has no group for ${group.builder}`).toBeTruthy()
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
