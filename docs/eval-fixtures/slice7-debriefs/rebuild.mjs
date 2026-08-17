// Rebuild the exact session data each debrief was written about.
// Copied verbatim from scripts/bench-coach-brevity.mjs (mulberry32,
// standInSessionOne, buildSessions, CELLS, the extensionless-import hook)
// rather than reimplemented, because that file is not structured to be
// imported (it calls main() unconditionally at module scope, which would try
// to make a live API call or exit the process). This is a read-only copy for
// analysis, not a second implementation of the algorithm.

import { register } from 'node:module'

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

// Resolved from this file's own location (docs/eval-fixtures/slice7-debriefs/)
// rather than hardcoded, so the fixture still runs after a clone or a move.
// Was an absolute path while this lived in a scratch directory.
const REPO = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '')
const { generateSwings } = await import(`${REPO}/src/swingGenerator.js`)
const { computeStats } = await import(`${REPO}/src/sessionStats.js`)
const { carryDistance } = await import(`${REPO}/src/ballFlight.js`)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SESSION_1_AVG_EV = 81.6
const SESSION_1_AVG_LA = 17.3333

export function standInSessionOne(random) {
  return Array.from({ length: 15 }, () => {
    const quality = random() - 0.5
    const evNoise = random() - 0.5
    const laNoise = random() - 0.5
    const ev = Math.round(Math.max(65, Math.min(97, SESSION_1_AVG_EV + (0.6 * quality + 0.8 * evNoise) * 16)))
    const la = Math.round(Math.max(-5, Math.min(35, SESSION_1_AVG_LA + (0.6 * quality + 0.8 * laNoise) * 22)))
    const dir = Math.round((random() - 0.45) * 70)
    const inZonePitch = random() < 0.7
    const plateLocHeight = inZonePitch ? 1.5 + random() * 2.0 : random() < 0.5 ? 0.5 + random() * 0.9 : 3.6 + random() * 0.5
    const plateLocSide = inZonePitch ? -0.7 + random() * 1.4 : random() < 0.5 ? -0.8 - random() * 0.3 : 0.8 + random() * 0.3
    return {
      plateLocHeight: Math.round(plateLocHeight * 100) / 100,
      plateLocSide: Math.round(plateLocSide * 100) / 100,
      hit: {
        launch: { exitSpeed: ev, angle: la, direction: dir },
        landing: { distance: carryDistance({ exitSpeed: ev, angle: la }) },
      },
    }
  })
}

export function buildSessions({ goalId, upTo, seed }) {
  const random = mulberry32(seed)
  const baseline = standInSessionOne(random)
  const sessions = [{ sessionNumber: 1, swings: baseline, stats: computeStats(baseline) }]
  for (let n = 2; n <= upTo; n++) {
    const swings = generateSwings({ sessionNum: n, goalId, baselineSwings: baseline, random })
    sessions.push({ sessionNumber: n, swings, stats: computeStats(swings) })
  }
  return sessions
}

export const CELLS = [
  { key: 'power-s2', goal: { id: 'power', label: 'Power & Distance' }, session: 2, why: 'the goal most visitors pick, early session' },
  { key: 'contact-s4', goal: { id: 'contact', label: 'Line Drives & Contact' }, session: 4, why: 'largest session, three priors to compare against' },
  { key: 'open-s4', goal: { id: 'open', label: 'Open Session' }, session: 4, why: 'no target, so the coach has the most latitude' },
]

export const SEED = 20260814

// Cache: cellKey -> sessions array
const cache = new Map()
export function sessionsForCell(cellKey) {
  if (cache.has(cellKey)) return cache.get(cellKey)
  const cell = CELLS.find((c) => c.key === cellKey)
  if (!cell) throw new Error(`Unknown cell ${cellKey}`)
  const sessions = buildSessions({ goalId: cell.goal.id, upTo: cell.session, seed: SEED })
  cache.set(cellKey, sessions)
  return sessions
}

export function viewingSessionSwings(cellKey) {
  const cell = CELLS.find((c) => c.key === cellKey)
  const sessions = sessionsForCell(cellKey)
  return sessions.find((s) => s.sessionNumber === cell.session).swings
}
