// One shape for "what session data did a builder actually produce", shared by
// the hand-run script that writes the frozen digest and by the test that
// re-checks it forever afterwards.
//
// WHY THIS EXISTS
// The grader rebuilds sessions 2, 3 and 4 by running the swing generator out
// of the working tree. That was safe for as long as nobody changed the
// generator. Slice 11 changes it. From the moment it does, every committed
// round of debriefs whose builder reads the working tree would be graded
// against a complete, entirely plausible set of swings that no coach ever
// saw, and nothing would look broken.
//
// The defence is a snapshot of the old generator plus a digest of exactly
// what it produced, written down while the live code and the snapshot were
// still the same thing. This module is the one definition of what "exactly
// what it produced" means, so the file that was written and the check that
// re-reads it cannot drift into two different ideas of the same thing.
//
// WHAT IS AND IS NOT IN A DIGEST
// In: every swing of every session of every cell, and a small per-session
// average that exists purely so a human reading a diff can see at a glance
// which direction something moved.
//
// Out: anything computed by src/sessionStats.js. The averages below are
// worked out here, from the swings, rather than by calling computeStats.
// That is deliberate. This digest exists to catch the generator moving, and
// borrowing another module's arithmetic would let an unrelated change to
// that module turn this guard red for a reason that has nothing to do with
// the generator.
//
// A swing is written as one line of plain text rather than as a nested
// object. Six numbers, fixed formatting, one swing per line, so a diff of
// this file reads as "these three swings changed" instead of as several
// hundred lines of moved braces.

// Every cell the bench measures, and the seeds each round was run at. Both
// seeds matter and neither is redundant: session 1 is the same fifteen swings
// at any seed, but sessions 2, 3 and 4 are generated from it with a seeded
// PRNG, so a digest taken at one seed says nothing about the other.
export const DIGEST_CELL_KEYS = [
  'power-s1',
  'power-s2',
  'contact-s1',
  'contact-s4',
  'open-s4',
  'allfields-s4',
  'popup-s4',
]

// Which builder gets digested at which seeds, and which builder produced the
// numbers in the first place.
//
// Read the two halves of each row carefully, because they are not the same
// thing. `producedByBuilder` is what was run on 20 August 2026 to write the
// file, back when the working tree still held the pre-Slice-11 generator.
// `builder` is what must reproduce those numbers from now on, once the
// working tree has moved on. For the first row those are two different names
// for one and the same code, captured on the one day that was true.
export const DIGEST_GROUPS = [
  {
    builder: 'slice11-before',
    producedByBuilder: 'current',
    seeds: [20260814, 20260819],
    cellKeys: DIGEST_CELL_KEYS,
  },
  {
    builder: 'slice9-before',
    producedByBuilder: 'slice9-before',
    seeds: [20260814],
    cellKeys: DIGEST_CELL_KEYS,
  },
]

export const SWING_LINE_FORMAT =
  'ev=<mph> la=<degrees> dir=<degrees> dist=<feet> height=<feet, 2dp> side=<feet, 2dp>'

function fixed(value, places) {
  if (!Number.isFinite(value)) return 'NaN'
  // Normalising a negative zero matters here: the generator can round a tiny
  // negative to -0, which prints as "-0.00" and would make a digest differ
  // from an identical one for no reason a reader could see.
  const normalised = value === 0 ? 0 : value
  return normalised.toFixed(places)
}

// One swing, one line. Every number the generator decides is on it, so a
// change to any of them shows up.
export function swingLine(swing) {
  const launch = swing?.hit?.launch ?? {}
  const landing = swing?.hit?.landing ?? {}
  return [
    `ev=${fixed(launch.exitSpeed, 0)}`,
    `la=${fixed(launch.angle, 0)}`,
    `dir=${fixed(launch.direction, 0)}`,
    `dist=${fixed(landing.distance, 0)}`,
    `height=${fixed(swing?.plateLocHeight, 2)}`,
    `side=${fixed(swing?.plateLocSide, 2)}`,
  ].join(' ')
}

function averageOf(values) {
  if (values.length === 0) return 0
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 100) / 100
}

// One cell's whole story: which goal, which session the coach was looking at,
// and every swing of every session leading up to it.
export function digestForCell(resolved) {
  return {
    goal: resolved.goal.id,
    viewingSessionNumber: resolved.viewingSessionNumber,
    sessions: resolved.sessions.map((session) => ({
      sessionNumber: session.sessionNumber,
      swingCount: session.swings.length,
      avgExitSpeed: averageOf(session.swings.map((w) => w.hit.launch.exitSpeed)),
      avgAngle: averageOf(session.swings.map((w) => w.hit.launch.angle)),
      swings: session.swings.map(swingLine),
    })),
  }
}
