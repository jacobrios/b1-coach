// Counts number-slot adoption over the audit's two bench rounds, from the
// raw text each record kept, with scripts/slotAdoption.js (the probe's own
// counting rule). Free: no network.
//
//   node docs/eval-fixtures/audit-2026-09-30/count-adoption.mjs
//
// Bench records do not store their sessions, so they are rebuilt here the
// way the bench builds them (mulberry32 and buildSessions copied from
// scripts/bench-coach-brevity.mjs, which cannot be imported without running
// it). The copy is checked, not trusted: every record's raw fields are
// re-filled from the rebuilt sessions and must equal the filled fields the
// bench stored, or the script refuses to count.

import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(s, c, n) {
    try { return await n(s, c) } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND' && s.startsWith('.') && !/\\.[a-z0-9]+$/i.test(s)) return n(s + '.js', c)
      throw e
    }
  }`), import.meta.url)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const { generateSwings } = await import(path.join(root, 'src/swingGenerator.js'))
const { computeStats } = await import(path.join(root, 'src/sessionStats.js'))
const { SESSION_ONE_SWINGS } = await import(path.join(root, 'src/sessionOneSwings.js'))
const { fillDebriefNumbers } = await import(path.join(root, 'src/numberSlots.js'))
const { analyseFields, adoptionPercent } = await import(path.join(root, 'scripts/slotAdoption.js'))

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const sessions = [{ sessionNumber: 1, swings: SESSION_ONE_SWINGS, stats: computeStats(SESSION_ONE_SWINGS) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: SESSION_ONE_SWINGS, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

const ROUNDS = [['after-a', 20260814], ['after-b', 20260819]]
const TEXT = ['coachingSummary', 'whatThisMeans', 'tipsIntro', 'tip1', 'tip2']

let allRes = 0, allBare = 0
for (const [dir, seed] of ROUNDS) {
  const records = JSON.parse(readFileSync(path.join(here, dir, 'shipped-64.json'), 'utf8'))
  let res = 0, bare = 0, unresolvable = 0, withValues = 0, failed = 0
  for (const r of records) {
    if (r.failed) { failed++; continue }
    const [goalId, s] = r.cell.split('-s')
    const upTo = Number(s)
    const sessions = buildSessions({ goalId, upTo, seed })
    const raw = r.rawFields
    const parsed = {
      coachingSummary: raw.coachingSummary, whatThisMeans: raw.whatThisMeans, tipsIntro: raw.tipsIntro,
      nextSessionTips: [raw.tip1, raw.tip2].filter((t) => t !== undefined),
    }
    const refilled = fillDebriefNumbers(parsed, sessions)
    const check = { ...refilled, tip1: refilled.nextSessionTips?.[0], tip2: refilled.nextSessionTips?.[1] }
    for (const f of TEXT) {
      if ((check[f] ?? '') !== (r.fields[f] ?? '')) {
        throw new Error(`${dir} ${r.cell} run ${r.run} ${f}: rebuilt sessions do not reproduce the stored fill; refusing to count`)
      }
    }
    const a = analyseFields(raw, sessions, upTo)
    const ok = a.markers.filter((m) => m.resolvable).length
    res += ok
    bare += a.bareRecitals.length
    unresolvable += a.markers.length - ok
    if (ok + a.bareRecitals.length > 0) withValues++
  }
  allRes += res; allBare += bare
  console.log(`${dir} (seed ${seed}): ${res} placeholders, ${bare} typed values, ${unresolvable} unresolvable placeholders, ` +
    `${failed} failed calls, ${withValues} debriefs with per-swing values; adoption ${adoptionPercent(res, bare)?.toFixed(1)}%`)
}
console.log(`both rounds: ${allRes} placeholders, ${allBare} typed values; adoption ${adoptionPercent(allRes, allBare)?.toFixed(1)}%`)
console.log('Every record re-filled to exactly its stored text, so the rebuilt sessions are the ones the coach saw.')
