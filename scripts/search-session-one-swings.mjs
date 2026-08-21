// Searches for a replacement set of fifteen session-1 swings, under every
// constraint Slice 9 settled, and prints a full report of what the chosen set
// actually measures rather than what it was hoped to measure.
//
// WHY THIS FILE EXISTS. Session 1 is the fifteen hand-written swings every
// visitor sees on their very first debrief. Today they are drawn with a
// ruler: sort them by exit velocity and the launch angles climb in
// near-lockstep (Pearson r = 0.975), and the first eleven launch angles step
// by exactly 2 degrees. That single artifact is also why Line Drives &
// Contact renders an empty target band on the first screen, and why Hit to
// All Fields has never met its own stated bar of 3 pulled and 3 opposite
// field. Slice 9 replaces the fifteen swings.
//
// The replacement could have been fifteen numbers typed out by hand and
// checked afterwards. It is not, for the same reason the distance buckets in
// src/ballFlight.js were chosen by a script rather than by eye: a set of
// numbers that appeared once, in a session nobody can re-enter, is not
// reproducible, and this project has already been bitten by quoting a figure
// ("9.7% to 16.8%") that no rerun could ever produce. Everything below is
// seeded. Run it again and it prints the same fifteen swings and the same
// report.
//
// HAND-RUN, NOT PART OF THE SUITE. Named search-*.mjs, not *.test.js, which
// is what this project's default vitest collection keys on (there is no
// vitest.config here, so vitest's own default include glob applies). It will
// never run inside `npm test` and never gate a commit. It makes no network
// calls and spends no money.
//
//   node scripts/search-session-one-swings.mjs
//   node scripts/search-session-one-swings.mjs --out path/to/candidate.json
//   node scripts/search-session-one-swings.mjs --raw     (see below)
//   node scripts/search-session-one-swings.mjs --seed 12345
//
// WHAT `--raw` IS FOR, AND WHY IT IS NOT DEAD CODE. The numeric constraints
// below are necessary and nowhere near sufficient. A search that satisfies
// every one of them still produces sets containing a 66 mph swing or a swing
// at -1 degrees: legal, inside the same clamps the generator obeys, and still
// reading as noise rather than as one hitter taking fifteen cuts. `--raw`
// turns off the believability filters and prints exactly that, so the claim
// "the taste filters are doing work" is something a reader can check in five
// seconds instead of taking on faith. The rejected raw output is quoted in
// this task's report for the same reason.
//
// WHAT IS NOT SEARCHED, DELIBERATELY: the fifteen pitch locations. Slice 9's
// settled list holds the strike-zone mix at 9 in and 6 out, and pitch
// location is named in the plan's not-in-this-slice list. So the fifteen
// plateLocHeight/plateLocSide pairs are carried over from today's data
// unchanged, in their existing order, and the Pitch Location chart on the
// first screen does not move at all. What this script does decide is which
// SWING lands on which pitch, which is a different question and a
// load-bearing one; see "the in-zone advantage" below.
//
// A LOADER WRINKLE, EXPLAINED SO NOBODY "FIXES" IT AWAY. src/swingGenerator.js
// imports its neighbours as `./ballFlight` and `./goalTargets`, with no file
// extension. Vite and vitest both resolve that; plain `node` refuses it with
// ERR_MODULE_NOT_FOUND. Editing shipped source for a script's convenience was
// not on the table, so this file registers the same tiny inline module hook
// scripts/measure-swing-generation.mjs already uses, which retries a failed
// extensionless relative import with `.js` appended. It changes nothing about
// how any module behaves; it only helps Node find the file.
import { register } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

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

// Every threshold below is imported, never re-typed. That is the whole point:
// a search that hard-codes its own copy of "Power wants 25-35 degrees at 88+"
// would happily certify a set the app itself judges differently, which is the
// exact drift goalTargets.js exists to prevent.
const { meetsTarget } = await import('../src/goalTargets.js')
const { GOAL_COUNT_SPECS } = await import('../src/goalCountSpecs.js')
const { inStrikeZone, STRIKE_ZONE, topExitVelocity } = await import('../src/sessionStats.js')
const { carryDistance, distanceBucketCounts } = await import('../src/ballFlight.js')
const { SESSION_ONE_SWINGS: TODAYS_SWINGS } = await import('../src/sessionOneSwings.js')
const { generateSwings } = await import('../src/swingGenerator.js')

// ---------------------------------------------------------------------------
// The constraints, all of them, in one place
// ---------------------------------------------------------------------------
//
// HARD. Every one of these is a settled decision from docs/slice-9-plan.md,
// and src/sessionOneSwings.test.js asserts most of them directly. A candidate
// that misses any one of them is not a candidate.
//
//   The two sums are the invariant the entire slice rests on. generateSwings
//   builds every later session off session 1's AVERAGES (see prevEV/prevLA in
//   src/swingGenerator.js), never off an individual swing, so holding the two
//   sums exactly is what keeps sessions 2 through 4 bit-for-bit identical
//   while the fifteen swings underneath them change completely.
const SUM_EXIT_VELOCITY = 1224 // mean 81.6, the "82 mph" stat tile
const SUM_LAUNCH_ANGLE = 260 //   mean 17.33, the "17°" stat tile
//
//   The on-target counts come from the app's own 65/35 improve-or-decline
//   rule, not from taste: today's 3 / 0 / 9 makes a later Power session look
//   WORSE than session 1 roughly 7 times out of 10, which is backwards for a
//   demo whose whole job is to show improvement. See finding 2 in the plan.
const TARGET_ON_TARGET = { power: 2, contact: 2, popup: 11 }
//
//   Hit to All Fields' own coaching prose asks for at least 3 pulled and 3
//   opposite field. Session 1 has never delivered it (2 and 2). 3 and 4 clears
//   the bar with a swing to spare on the side the generator is stingiest with.
const TARGET_PULL = 3
const TARGET_OPPO = 4
//
//   The correlation band. The generator itself couples exit velocity and
//   launch angle at 0.6 through a shared contact-quality term, and 0.36 is
//   what that produces as a median measured r on a fifteen-swing session, so
//   this is session 1 being asked to look like the app's own output rather
//   than like a hand-drawn line. The test in src/sessionOneSwings.test.js
//   passes anything from 0.20 to 0.55; this script holds itself to the
//   tighter band the plan named, so the shipped number is not sitting on the
//   edge of the gate that guards it.
const CORRELATION_MIN = 0.3
const CORRELATION_MAX = 0.42
const CORRELATION_AIM = 0.36
//
//   No ramp, in either variable. This is the same rule the test applies, and
//   it is a SHARE, not a count of distinct gap sizes: a near-perfect ramp
//   with two single-point perturbations has three distinct gap sizes and
//   still reads as a straight line. No single consecutive-gap size may
//   account for more than 60% of the fourteen gaps.
const MAX_GAP_SHARE = 0.6
//
//   The clamps the generator obeys, so session 1 cannot contain a swing the
//   rest of the app could never produce.
//
//   ANNOTATION, 21 AUGUST 2026, TASK 6: the launch angle line below is a
//   hand-copy and it is now out of date, deliberately left that way. The
//   generator's own range runs to 50 degrees since pop-ups exist, so 35 is no
//   longer "the clamp the generator obeys" and the sentence above is only half
//   true: a swing this search rejects for being too high is now producible.
//   It is not updated because session 1 is hand-written, frozen, and has no
//   pop-up in it on purpose, so a search allowed to reach 50 would be
//   searching for a different session than the one that shipped. Read these two
//   as "the range session 1 is allowed to occupy", which is what they have
//   really been since this file was written, rather than as a copy of anything.
const EV_CLAMP = { min: 65, max: 97 }
const LA_CLAMP = { min: -5, max: 35 }
//
//   The TOP EXIT VELO tile reads 92 today. Holding it means the three stat
//   tiles on the first screen read exactly as they do now (82 mph, 17
//   degrees, 92 mph) and a reviewer comparing before and after sees the
//   scatter change and the headline numbers hold still. Recorded in the plan
//   as an assumption rather than something the product manager ruled on.
const TOP_EXIT_VELOCITY = 92
//
//   The in-zone advantage. Whoever hand-wrote today's fifteen swings put the
//   weak contact on the bad pitches: in-zone pitches average 85.1 mph against
//   76.3 out of zone, an 8.8 mph gap. The generator's own gap is 0.0, because
//   it draws pitch location from an unrelated random(). Since Slice 8c the
//   coach is handed which swings were on pitches outside the zone and reasons
//   about them out loud, so this gap is the only thing in the app that makes
//   that reasoning true rather than coincidental. The floor is 5 mph; the
//   search aims near today's figure rather than at the floor.
const MIN_ZONE_ADVANTAGE = 5
const ZONE_ADVANTAGE_AIM = 8.8

// BELIEVABILITY, i.e. the hand-tuning. Everything above is arithmetic a
// search can check. Nothing above stops the search handing back fifteen legal
// numbers that look wrong to anyone who has watched batting practice, and in
// practice it does exactly that unless told not to (run --raw and look). Each
// filter below is a judgment call with a stated reason, applied as a hard
// filter so the choice is recorded in code rather than made silently by
// picking a favourite out of a list.
const TASTE = {
  // A high school hitter in a scripted demo session does not put a 66 mph
  // swing on the board. One genuinely weak cut is a story ("he got fooled by
  // the pitch in the dirt"); a floor below this is noise.
  minExitVelocity: 70,
  // ...and at most two swings anywhere near that floor. A hitter who
  // mis-hits a third of his cuts is not the hitter this demo is about.
  weakExitVelocity: 74,
  maxWeakSwings: 2,
  // Launch angle: nothing at or below 0 degrees (a swing at -1 is a
  // legal number and reads as a data-entry error, not as a hitter), and
  // nothing above 32 (the top of the clamp is 35, but a 34-degree pop-up in a
  // fifteen-swing set is the kind of outlier that draws the eye away from the
  // shape of the session).
  minLaunchAngle: 2,
  maxLaunchAngle: 32,
  // Every distance column on the results screen has at least one ball in it.
  // Not a settled constraint, added here on the same reasoning the product
  // manager used when he chose the bucket edges in Slice 6 on how they
  // rendered: today's session 1 fills all five (5, 3, 1, 3, 3), and shipping
  // a rewrite that empties one would be a visible regression on the very
  // screen this slice exists to improve.
  everyDistanceBucketFilled: true,
  // Real fifteen-swing samples repeat numbers. A set of fifteen all-distinct
  // exit velocities is itself a tell that something generated them to be
  // distinct, so require at least one repeated value in each variable.
  requireRepeats: true,
  // ...but never the SAME repeat in both variables at once. A repeated exit
  // velocity is realistic and a repeated launch angle is realistic; two
  // swings sharing both draw one dot on top of another, and the chart this
  // whole slice exists to fix then shows a visitor thirteen swings where the
  // table beside it says fifteen. Added after reading the first ranked
  // candidate, which had two such pairs; see this task's report.
  noCoincidentPoints: true,
  // Repeats are realistic; a pile is not. The results screen's Raw Data table
  // prints all fifteen swings as rows, so four swings reading exactly 77 mph
  // is not a subtle statistical property, it is a visible column of the same
  // number. Three is the most a value may appear. Added after reading the
  // second ranked candidate, which had exactly that pile.
  maxSameValue: 3,
  // Exactly one genuinely weak swing is the target, not zero. The brief's
  // ceiling is two; the floor matters just as much, because a hitter who
  // never mis-hits one of fifteen cuts is its own kind of unbelievable, and
  // a set with no weak contact also squeezes the scatter's horizontal spread
  // on the chart this slice exists to open up. Today's session has two (70
  // and 72 mph). Enforced as a preference in the ranking rather than a hard
  // filter, so a candidate is never rejected for it, only outranked.
  idealWeakSwings: 1,
  // Tighter than the 0.6 the test gates on, so the shipped set is not sitting
  // one gap away from the line. The progress ledger flagged that margin as
  // thin on exit velocity for today's data (8 of 14, 57%); this leaves room.
  maxGapShare: 0.5,
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

// Mulberry32, the same small PRNG src/sessionOneSwings.test.js uses. Minimal
// and fast, not claimed to be cryptographically sound, which this has no need
// of. It is here so the search is reproducible without depending on
// Math.random, which would make every number this prints a one-off.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - meanX) * (ys[i] - meanY)
    vx += (xs[i] - meanX) ** 2
    vy += (ys[i] - meanY) ** 2
  }
  return cov / Math.sqrt(vx * vy)
}

// The share of a sorted array's fourteen consecutive gaps taken by its single
// most common gap size. Deliberately a copy of the function in
// src/sessionOneSwings.test.js rather than an import: that one is local to
// the test file by design (nothing in src/ needs it), and a script reaching
// into a test file for a helper would be worse than nine lines of arithmetic
// written twice. If the two ever disagree the test wins, and the test is what
// gates the merge.
function maxGapShare(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const counts = new Map()
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1]
    counts.set(gap, (counts.get(gap) ?? 0) + 1)
  }
  return Math.max(...counts.values()) / (sorted.length - 1)
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const countRepeats = (xs) => xs.length - new Set(xs).size
// How many times the most-repeated value appears. Two swings reading 77 mph is
// a session; four is a column of the same number in the Raw Data table.
const maxMultiplicity = (xs) => {
  const counts = new Map()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return Math.max(...counts.values())
}

// Box-Muller, so the starting points look like a hitter's spread rather than
// a uniform draw across the clamps. The search moves off these anyway; a
// better-shaped start just means fewer restarts.
function normal(rand) {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

// ---------------------------------------------------------------------------
// The search itself
// ---------------------------------------------------------------------------
//
// A candidate at this stage is fifteen (exitSpeed, angle) pairs and nothing
// else. Direction and pitch assignment are handled afterwards, in their own
// passes, because neither interacts with any constraint above: the pull/oppo
// counts depend only on direction, and the in-zone advantage depends only on
// which swing sits on which pitch. Searching all three at once would triple
// the state space to buy nothing.
//
// The method is plain penalty-guided hill climbing from many random restarts.
// Not because anything cleverer was tried and rejected, but because the space
// is small (fifteen integer pairs) and the constraints are cheap to evaluate,
// so the simplest thing that works is the right thing to reach for.

function onTargetCounts(pairs) {
  const launches = pairs.map(([exitSpeed, angle]) => ({ exitSpeed, angle }))
  return {
    power: launches.filter((l) => meetsTarget('power', l)).length,
    contact: launches.filter((l) => meetsTarget('contact', l)).length,
    popup: launches.filter((l) => meetsTarget('popup', l)).length,
  }
}

function bucketCountsFor(pairs) {
  return distanceBucketCounts(
    pairs.map(([exitSpeed, angle]) => ({
      hit: { landing: { distance: carryDistance({ exitSpeed, angle }) } },
    })),
  ).map((b) => b.count)
}

// One number saying how far a candidate is from legal. Zero means every hard
// constraint (and, when taste is on, every believability filter) is satisfied
// exactly. The weights are not tuned: they only need to point downhill.
function penalty(pairs, { taste }) {
  const evs = pairs.map((p) => p[0])
  const las = pairs.map((p) => p[1])
  let p = 0

  p += Math.abs(sum(evs) - SUM_EXIT_VELOCITY) * 8
  p += Math.abs(sum(las) - SUM_LAUNCH_ANGLE) * 8

  const counts = onTargetCounts(pairs)
  p += Math.abs(counts.power - TARGET_ON_TARGET.power) * 6
  p += Math.abs(counts.contact - TARGET_ON_TARGET.contact) * 6
  p += Math.abs(counts.popup - TARGET_ON_TARGET.popup) * 6

  const r = pearsonCorrelation(evs, las)
  p += Math.max(0, CORRELATION_MIN - r) * 120
  p += Math.max(0, r - CORRELATION_MAX) * 120

  p += Math.max(0, maxGapShare(evs) - (taste ? TASTE.maxGapShare : MAX_GAP_SHARE)) * 120
  p += Math.max(0, maxGapShare(las) - (taste ? TASTE.maxGapShare : MAX_GAP_SHARE)) * 120

  p += Math.abs(Math.max(...evs) - TOP_EXIT_VELOCITY) * 6
  for (const ev of evs) p += Math.max(0, EV_CLAMP.min - ev) + Math.max(0, ev - EV_CLAMP.max)
  for (const la of las) p += Math.max(0, LA_CLAMP.min - la) + Math.max(0, la - LA_CLAMP.max)

  if (taste) {
    for (const ev of evs) p += Math.max(0, TASTE.minExitVelocity - ev) * 4
    p += Math.max(0, evs.filter((e) => e <= TASTE.weakExitVelocity).length - TASTE.maxWeakSwings) * 4
    for (const la of las) {
      p += Math.max(0, TASTE.minLaunchAngle - la) * 4
      p += Math.max(0, la - TASTE.maxLaunchAngle) * 4
    }
    if (TASTE.everyDistanceBucketFilled) {
      p += bucketCountsFor(pairs).filter((c) => c === 0).length * 5
    }
    if (TASTE.requireRepeats) {
      if (countRepeats(evs) === 0) p += 4
      if (countRepeats(las) === 0) p += 4
    }
    if (TASTE.noCoincidentPoints) {
      p += countRepeats(pairs.map(([ev, la]) => `${ev}/${la}`)) * 4
    }
    p += Math.max(0, maxMultiplicity(evs) - TASTE.maxSameValue) * 4
    p += Math.max(0, maxMultiplicity(las) - TASTE.maxSameValue) * 4
  }
  return p
}

// A starting point drawn from a correlated hitter model: one shared
// contact-quality term at rho = 0.6 (which produces r ~ 0.36, exactly what
// the generator's own CONTACT_CORRELATION produces) plus independent noise on
// each variable.
function seedCandidate(rand) {
  const rho = 0.6
  const pairs = []
  for (let i = 0; i < 15; i++) {
    const quality = normal(rand)
    const ev = 81.6 + 5.6 * (rho * quality + Math.sqrt(1 - rho * rho) * normal(rand))
    const la = 17.3 + 7.0 * (rho * quality + Math.sqrt(1 - rho * rho) * normal(rand))
    pairs.push([
      clamp(Math.round(ev), EV_CLAMP.min, TOP_EXIT_VELOCITY),
      clamp(Math.round(la), LA_CLAMP.min, LA_CLAMP.max),
    ])
  }
  return pairs
}

// Five move types. Two of them (the paired nudges) preserve a sum exactly,
// which matters once the search has found the right sums and is only trying
// to fix a count or the correlation without breaking them again.
function mutate(pairs, rand) {
  const next = pairs.map((p) => [...p])
  const i = Math.floor(rand() * 15)
  const j = Math.floor(rand() * 15)
  const move = Math.floor(rand() * 5)
  const step = rand() < 0.5 ? 1 : -1
  if (move === 0) next[i][0] += step
  else if (move === 1) next[i][1] += step
  else if (move === 2 && i !== j) {
    next[i][0] += step
    next[j][0] -= step
  } else if (move === 3 && i !== j) {
    next[i][1] += step
    next[j][1] -= step
  } else if (i !== j) {
    const swap = next[i][1]
    next[i][1] = next[j][1]
    next[j][1] = swap
  }
  return next
}

function searchPairs(rand, { taste, restarts, stepsPerRestart }) {
  const found = new Map()
  for (let restart = 0; restart < restarts; restart++) {
    let current = seedCandidate(rand)
    let currentPenalty = penalty(current, { taste })
    for (let step = 0; step < stepsPerRestart && currentPenalty > 0; step++) {
      const candidate = mutate(current, rand)
      const candidatePenalty = penalty(candidate, { taste })
      // Sideways moves are accepted, downhill-only would stall on the plateaus
      // this penalty is full of (any move that trades one count for another).
      if (candidatePenalty <= currentPenalty) {
        current = candidate
        currentPenalty = candidatePenalty
      }
    }
    if (currentPenalty === 0) {
      const key = JSON.stringify([...current].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
      if (!found.has(key)) found.set(key, current)
    }
  }
  return [...found.values()]
}

// Ranking among candidates that are all fully legal. Lower is better. This is
// preference, not correctness: every input here has already passed every hard
// constraint and every believability filter, so this only decides which of
// several acceptable hitters gets shipped.
function believabilityScore(pairs) {
  const evs = pairs.map((p) => p[0])
  const las = pairs.map((p) => p[1])
  const r = pearsonCorrelation(evs, las)
  const buckets = bucketCountsFor(pairs)
  return (
    // Closest to the generator's own median correlation.
    Math.abs(r - CORRELATION_AIM) * 20 +
    // Furthest from reading as a ramp, in both variables.
    (maxGapShare(evs) + maxGapShare(las)) * 3 +
    // Prefer the distance chart to have a shape rather than one tall column;
    // 3 balls in the thinnest bucket would be perfectly even, which the
    // product manager has already said reads as placeholder data, so this
    // only rewards getting off zero and one.
    Math.max(0, 2 - Math.min(...buckets)) * 0.6 +
    // ...and prefer no single column taller than today's tallest, which is 5.
    // Six of fifteen balls in one range is a bar that dwarfs its neighbours.
    Math.max(0, Math.max(...buckets) - 5) * 0.4 +
    // Exactly one genuinely weak swing, not zero and not two. See
    // TASTE.idealWeakSwings for why the floor matters as much as the ceiling.
    Math.abs(evs.filter((e) => e <= TASTE.weakExitVelocity).length - TASTE.idealWeakSwings) * 0.5
  )
}

// ---------------------------------------------------------------------------
// Direction: 3 pulled, 4 opposite field, 8 up the middle
// ---------------------------------------------------------------------------
//
// Direction touches no other constraint, so it gets its own small pass. The
// cutoffs are imported from GOAL_COUNT_SPECS rather than typed, and the rule
// is strict: pulled means STRICTLY below -15, opposite field STRICTLY above
// +15, which is how the goal's own prose and the coach's count lines read it.
// The one piece of judgment here is that the pulled and opposite-field swings
// are spread across the exit-velocity range instead of all landing on the
// hitter's best or worst cuts, which would read as a rule rather than as a
// session.
function assignDirections(pairs, rand) {
  const { pullDirection, oppoDirection } = GOAL_COUNT_SPECS.allfields
  const byQuality = pairs.map((p, index) => ({ index, ev: p[0] })).sort((a, b) => b.ev - a.ev)
  // Deal the three pull slots and four oppo slots across the quality ranking
  // at fixed strides, then let the seeded random pick the actual angle inside
  // each band. Strides rather than a random draw so a rerun cannot happen to
  // put all three pulls on the three softest swings.
  const pullSlots = [1, 6, 11].map((k) => byQuality[k].index)
  const oppoSlots = [0, 4, 8, 13].map((k) => byQuality[k].index)
  return pairs.map((_, index) => {
    if (pullSlots.includes(index)) return pullDirection - 1 - Math.floor(rand() * 14)
    if (oppoSlots.includes(index)) return oppoDirection + 1 + Math.floor(rand() * 14)
    // Up the middle: anywhere inside the cutoffs, inclusive, which is what
    // "neither pulled nor opposite field" means to every count in the app.
    return Math.round((rand() * 2 - 1) * 14)
  })
}

// ---------------------------------------------------------------------------
// Which swing lands on which pitch
// ---------------------------------------------------------------------------
//
// The fifteen pitch locations are today's, unchanged and in their existing
// order, so the strike-zone mix is 9 in and 6 out before this function does
// anything. What it decides is the pairing, and that pairing is the whole of
// finding 4 in the plan: a real hitter squares up strikes and gets beaten by
// pitches out of the zone, today's session says so with an 8.8 mph gap, and
// the generator says nothing at all.
//
// Two things are being balanced. The gap has to clear 5 mph, and it should
// land near today's 8.8 rather than scrape the floor. But a perfect sort, all
// nine hardest balls on the nine strikes, is its own artifact: real sessions
// contain a strike he was late on and a ball he still got hold of. So the
// score below wants overlap as well as separation, and it also gives a small
// nudge toward low pitches producing low launch angles and high pitches
// producing high ones, which is the same physical story told in the other
// variable.
const PITCH_SLOTS = TODAYS_SWINGS.map((swing) => ({
  plateLocHeight: swing.plateLocHeight,
  plateLocSide: swing.plateLocSide,
  inZone: inStrikeZone(swing),
}))

function assignmentScore(order, pairs) {
  const inZoneEv = []
  const outEv = []
  const heights = []
  const angles = []
  order.forEach((pairIndex, slot) => {
    const [ev, la] = pairs[pairIndex]
    if (PITCH_SLOTS[slot].inZone) inZoneEv.push(ev)
    else outEv.push(ev)
    heights.push(PITCH_SLOTS[slot].plateLocHeight)
    angles.push(la)
  })
  const gap = mean(inZoneEv) - mean(outEv)
  if (gap < MIN_ZONE_ADVANTAGE) return Infinity
  // Overlap: at least one pitch out of the zone he still got hold of, harder
  // than at least one strike he did not. Without this the search happily
  // returns a clean sort, which no real session looks like.
  if (Math.max(...outEv) <= Math.min(...inZoneEv)) return Infinity
  const heightAgreement = pearsonCorrelation(heights, angles)
  return (
    Math.abs(gap - ZONE_ADVANTAGE_AIM) +
    // A mild preference, worth about a tenth of a mile per hour of gap: the
    // low pitch he chopped into the ground and the high one he got under are
    // details a baseball-literate visitor reads without being told.
    Math.max(0, 0.35 - heightAgreement) * 4
  )
}

function assignToPitches(pairs, rand, attempts = 40000) {
  let best = null
  let bestScore = Infinity
  for (let attempt = 0; attempt < attempts; attempt++) {
    const order = [...pairs.keys()]
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const score = assignmentScore(order, pairs)
    if (score < bestScore) {
      bestScore = score
      best = order
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function buildSwings(pairs, directions, order) {
  return order.map((pairIndex, slot) => {
    const [exitSpeed, angle] = pairs[pairIndex]
    const direction = directions[pairIndex]
    return {
      plateLocHeight: PITCH_SLOTS[slot].plateLocHeight,
      plateLocSide: PITCH_SLOTS[slot].plateLocSide,
      hit: {
        launch: { exitSpeed, angle, direction },
        // Computed, never typed. src/sessionOneSwings.test.js recomputes
        // every one of these from its own swing, so a typed distance is a red
        // suite, and this script is the thing that stops that ever happening.
        landing: { distance: carryDistance({ exitSpeed, angle }) },
      },
    }
  })
}

function pad(value, width) {
  return String(value).padStart(width)
}

function report(swings, label) {
  const evs = swings.map((w) => w.hit.launch.exitSpeed)
  const las = swings.map((w) => w.hit.launch.angle)
  const dirs = swings.map((w) => w.hit.launch.direction)
  const launches = swings.map((w) => w.hit.launch)
  const inZone = swings.filter(inStrikeZone)
  const outZone = swings.filter((w) => !inStrikeZone(w))
  const r = pearsonCorrelation(evs, las)
  const buckets = distanceBucketCounts(swings)

  const lines = []
  const say = (text) => lines.push(text)
  const check = (name, actual, ok, expected) =>
    say(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} ${String(actual).padEnd(14)} ${expected}`)

  say('')
  say(`=== ${label} ===`)
  say('')
  say('  #  pitch (h, side)   zone  EV  LA   dir   carry')
  swings.forEach((w, i) => {
    const { exitSpeed, angle, direction } = w.hit.launch
    say(
      `  ${pad(i + 1, 2)}  ${pad(w.plateLocHeight.toFixed(2), 5)}, ${pad(w.plateLocSide.toFixed(2), 5)}` +
        `   ${inStrikeZone(w) ? ' in' : 'out'}  ${pad(exitSpeed, 2)}  ${pad(angle, 2)}  ${pad(direction, 4)}` +
        `   ${pad(w.hit.landing.distance, 3)} ft`,
    )
  })
  say('')
  say('  CONSTRAINT                                     ACTUAL         REQUIRED')
  check('exit velocity sum', sum(evs), sum(evs) === SUM_EXIT_VELOCITY, `= ${SUM_EXIT_VELOCITY}`)
  check('launch angle sum', sum(las), sum(las) === SUM_LAUNCH_ANGLE, `= ${SUM_LAUNCH_ANGLE}`)
  check('average exit velocity (stat tile)', Math.round(mean(evs)), Math.round(mean(evs)) === 82, '= 82')
  check('average launch angle (stat tile)', Math.round(mean(las)), Math.round(mean(las)) === 17, '= 17')
  check(
    'top exit velocity (stat tile)',
    topExitVelocity(swings),
    topExitVelocity(swings) === TOP_EXIT_VELOCITY,
    `= ${TOP_EXIT_VELOCITY}`,
  )
  for (const goal of ['power', 'contact', 'popup']) {
    const n = launches.filter((l) => meetsTarget(goal, l)).length
    check(`on target: ${goal}`, n, n === TARGET_ON_TARGET[goal], `= ${TARGET_ON_TARGET[goal]}`)
  }
  const pulled = dirs.filter((d) => d < GOAL_COUNT_SPECS.allfields.pullDirection).length
  const oppo = dirs.filter((d) => d > GOAL_COUNT_SPECS.allfields.oppoDirection).length
  check('pulled (direction < -15)', pulled, pulled === TARGET_PULL, `= ${TARGET_PULL}`)
  check('opposite field (direction > +15)', oppo, oppo === TARGET_OPPO, `= ${TARGET_OPPO}`)
  check(
    'correlation, exit velocity vs launch angle',
    r.toFixed(4),
    r >= CORRELATION_MIN && r <= CORRELATION_MAX,
    `${CORRELATION_MIN} to ${CORRELATION_MAX} (test gate 0.20 to 0.55)`,
  )
  check(
    'max gap share, exit velocity',
    `${(maxGapShare(evs) * 100).toFixed(1)}%`,
    maxGapShare(evs) <= MAX_GAP_SHARE,
    `<= ${MAX_GAP_SHARE * 100}%`,
  )
  check(
    'max gap share, launch angle',
    `${(maxGapShare(las) * 100).toFixed(1)}%`,
    maxGapShare(las) <= MAX_GAP_SHARE,
    `<= ${MAX_GAP_SHARE * 100}%`,
  )
  check('pitches in the strike zone', inZone.length, inZone.length === 9, '= 9')
  check('pitches outside the strike zone', outZone.length, outZone.length === 6, '= 6')
  const zoneGap = mean(inZone.map((w) => w.hit.launch.exitSpeed)) - mean(outZone.map((w) => w.hit.launch.exitSpeed))
  check(
    'in-zone minus out-of-zone exit velocity',
    `${zoneGap.toFixed(2)} mph`,
    zoneGap >= MIN_ZONE_ADVANTAGE,
    `>= ${MIN_ZONE_ADVANTAGE} mph (today 8.80)`,
  )
  check(
    'exit velocity range',
    `${Math.min(...evs)} to ${Math.max(...evs)}`,
    Math.min(...evs) >= EV_CLAMP.min && Math.max(...evs) <= EV_CLAMP.max,
    `inside ${EV_CLAMP.min} to ${EV_CLAMP.max}`,
  )
  check(
    'launch angle range',
    `${Math.min(...las)} to ${Math.max(...las)}`,
    Math.min(...las) >= LA_CLAMP.min && Math.max(...las) <= LA_CLAMP.max,
    `inside ${LA_CLAMP.min} to ${LA_CLAMP.max}`,
  )
  say('')
  say(`  distance chart:  ${buckets.map((b) => `${b.label} ${b.count}`).join(' | ')}`)
  say(`  repeated values: exit velocity ${countRepeats(evs)}, launch angle ${countRepeats(las)}`)
  say(
    `  coincident scatter points: ${countRepeats(swings.map((w) => `${w.hit.launch.exitSpeed}/${w.hit.launch.angle}`))}` +
      '  (dots drawn exactly on top of another swing, so the chart shows fewer than fifteen)',
  )
  say(
    `  swings at or below ${TASTE.weakExitVelocity} mph: ` +
      `${evs.filter((e) => e <= TASTE.weakExitVelocity).length}`,
  )
  say(
    `  exit velocity vs swing number: r = ${pearsonCorrelation(evs.map((_, i) => i), evs).toFixed(3)}` +
      '  (near zero means no accidental warm-up ramp across the session)',
  )
  return lines.join('\n')
}

// The point of the two sums, checked end to end rather than argued. If the
// averages truly hold, feeding the new fifteen swings into the real generator
// produces sessions 2, 3 and 4 byte-for-byte identical to what today's
// fifteen produce, because generateSwings only ever reads the baseline's
// averages. This is the same claim the pinned snapshot in
// src/sessionOneSwings.test.js makes; it is repeated here so this script's
// own output stands on its own.
function generatedSessionsUnchanged(candidate) {
  const run = (baseline) => {
    const random = mulberry32(42)
    const s2 = generateSwings({ sessionNum: 2, goalId: null, baselineSwings: baseline, random })
    const s3 = generateSwings({ sessionNum: 3, goalId: null, baselineSwings: s2, random })
    const s4 = generateSwings({ sessionNum: 4, goalId: null, baselineSwings: s3, random })
    return JSON.stringify([s2, s3, s4])
  }
  return run(candidate) === run(TODAYS_SWINGS)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const at = argv.indexOf(name)
  return at === -1 ? fallback : argv[at + 1]
}

const SEED = Number(value('--seed', 20260819))
const RAW = flag('--raw')
const OUT = value('--out', null)

console.log('Session 1 swing search. Seeded, no network calls, no spend.')
console.log(`Seed ${SEED}. Believability filters ${RAW ? 'OFF (--raw)' : 'ON'}.`)
console.log(
  `Strike zone bounds imported: height ${STRIKE_ZONE.heightMin}-${STRIKE_ZONE.heightMax}, ` +
    `side ${STRIKE_ZONE.sideMin} to ${STRIKE_ZONE.sideMax}.`,
)

const rand = mulberry32(SEED)
const candidates = searchPairs(rand, { taste: !RAW, restarts: 400, stepsPerRestart: 40000 })
console.log(`\n${candidates.length} distinct fully-legal candidate sets found across 400 restarts.`)

if (candidates.length === 0) {
  console.log('\nBLOCKED: no candidate satisfied every constraint. Nothing was written.')
  process.exit(1)
}

const ranked = candidates
  .map((pairs) => ({ pairs, score: believabilityScore(pairs) }))
  .sort((a, b) => a.score - b.score)

console.log('\nTop candidates by believability score (lower is better):')
console.log('  rank  score   r       gapshare EV/LA   EV range   LA range   distance chart')
ranked.slice(0, 5).forEach((entry, i) => {
  const evs = entry.pairs.map((p) => p[0])
  const las = entry.pairs.map((p) => p[1])
  console.log(
    `  ${pad(i + 1, 4)}  ${entry.score.toFixed(3)}  ` +
      `${pearsonCorrelation(evs, las).toFixed(4)}  ` +
      `${(maxGapShare(evs) * 100).toFixed(0)}% / ${(maxGapShare(las) * 100).toFixed(0)}%`.padEnd(16) +
      `${Math.min(...evs)}-${Math.max(...evs)}`.padEnd(11) +
      `${Math.min(...las)}-${Math.max(...las)}`.padEnd(11) +
      bucketCountsFor(entry.pairs).join(','),
  )
})

const chosen = ranked[0].pairs
const directions = assignDirections(chosen, rand)
const order = assignToPitches(chosen, rand)
if (!order) {
  console.log('\nBLOCKED: no pitch assignment cleared the in-zone advantage floor. Nothing was written.')
  process.exit(1)
}
const swings = buildSwings(chosen, directions, order)

console.log(report(TODAYS_SWINGS, "TODAY'S SESSION 1, for comparison"))
console.log(report(swings, 'CHOSEN CANDIDATE'))

console.log('')
console.log(
  `  ${generatedSessionsUnchanged(swings) ? 'PASS' : 'FAIL'}  sessions 2, 3 and 4 regenerate identical ` +
    'from this baseline (the whole point of holding the two sums)',
)

if (OUT) {
  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(swings, null, 2) + '\n')
  console.log(`\nWrote ${swings.length} swings to ${OUT}`)
}
