// THE SWING GENERATOR AS IT STOOD BEFORE SLICE 11 CHANGED IT.
// Recovered with `git show 53315e5:src/swingGenerator.js`, not retyped, and
// deliberately frozen from the moment it was committed.
//
// WHY THIS FILE EXISTS
// Sessions 2, 3 and 4 are not stored anywhere. They are generated from
// session 1 with a seeded PRNG, which means the only record of what a
// visitor (or a coach) actually saw in a given round is the generator that
// produced it. Five committed rounds of debriefs describe swings this file
// made:
//
//   docs/eval-fixtures/slice9-session-one/before
//   docs/eval-fixtures/slice9-session-one/after-a
//   docs/eval-fixtures/slice9-session-one/after-b
//   docs/eval-fixtures/slice10-direction-key/after
//   docs/eval-fixtures/slice10-direction-key/after-spray
//
// Slice 11 rewrites src/swingGenerator.js: the link between where a pitch
// was and how well it was struck, the pull and opposite-field bias, and the
// pop-up ceiling. From the moment it lands, the working tree no longer holds
// what those five rounds were written about.
//
// Grading one of those rounds against the working tree generator does not
// fail, and that is exactly the danger: it produces a complete,
// plausible-looking fact sheet for swings that never existed, on 40 of every
// 64 records, and every verdict computed from it is garbage that reads like
// a result. Nothing on screen would say so.
//
// DO NOT "UPDATE" THIS FILE. Not to match src/swingGenerator.js, not to fix
// a constant that looks wrong, not to keep it in step with anything. It is a
// record of what was, in the same spirit as
// docs/eval-fixtures/slice7-debriefs/rebuild.mjs, which freezes an entire
// stand-in generator for the identical reason two generations earlier, and
// docs/eval-fixtures/slice9-session-one/session-one-before.mjs, which
// freezes the previous fifteen session-1 swings for the same reason one
// generation earlier. If the generator is ever rewritten again, that rewrite
// writes its own new snapshot beside its own new records; it does not touch
// this one.
//
// IT IMPORTS NOTHING FROM src/, AND THE DUPLICATION BELOW IS THE POINT.
// The original imported carryDistance from src/ballFlight.js and hasTarget,
// meetsTarget from src/goalTargets.js. Both are copied in below instead,
// frozen at the same commit. That is not an oversight and it is not laziness
// about imports. A snapshot that reaches into src/ for half its behaviour is
// only half a snapshot: change how far a ball carries, or move a goal's
// target band by a degree, and this file starts producing different swings
// while still calling itself frozen. The whole file has to stand still, or
// none of it does.
//
// A bonus of importing nothing from src/: it needs no extensionless-resolve
// loader hook. Files under src/ import their neighbours without a file
// extension, which plain `node` refuses, and every hand-run script in this
// project carries its own copy of a hook to work around that. This file has
// no relative imports at all, so any script or test can load it directly.
//
// The export is named generateSwingsPreSlice11 rather than generateSwings on
// purpose, so an import of this file can never be mistaken at a glance for
// an import of the live module. Everything below that line is byte-identical
// to the recovered file apart from the two deleted imports and that one
// renamed function.
//
// Read by scripts/grade-coach-accuracy.mjs's "slice11-before" and
// "slice9-before" session builders, which are the only supported way to
// grade any of the five rounds listed above, and checked on every npm test
// by scripts/frozenGenerator.test.js against the digest committed beside it.

// ─────────────────────────────────────────────────────────────────────────────
// Frozen copies of what this file used to import from src/
// ─────────────────────────────────────────────────────────────────────────────
// All four are `git show 53315e5:src/ballFlight.js` and
// `git show 53315e5:src/goalTargets.js` as they stood that day, with their
// own comments trimmed to what a reader needs here. The originals remain the
// live single source of truth for the app; these copies exist only to hold
// this snapshot still, and must never be reconciled with them.

// From src/ballFlight.js: carry in feet for one swing.
function carryDistance({ exitSpeed, angle } = {}) {
  if (!Number.isFinite(exitSpeed) || !Number.isFinite(angle)) return 0
  const potential = Math.max(0, (exitSpeed - 45) * 7.5)
  const shape =
    angle <= 28
      ? 0.3 + 0.7 * ((angle + 5) / 33) ** 0.9
      : Math.max(0.55, 1 - (angle - 28) * 0.02)
  return Math.round(potential * shape)
}

// From src/goalTargets.js: what each goal asks of a swing. Only the three
// goals that have a target are listed, because absence is how this table says
// "this goal asks for nothing" and a row of zeroes would say something else.
const GOAL_TARGETS = {
  power: { launchAngle: { min: 25, max: 35 }, exitVelocity: 88 },
  contact: { launchAngle: { min: 8, max: 18 }, exitVelocity: 85 },
  popup: { launchAngle: { min: 10, max: 25 }, exitVelocity: null },
}

function goalTarget(goalId) {
  return GOAL_TARGETS[goalId] ?? null
}

function hasTarget(goalId) {
  return goalTarget(goalId) !== null
}

function meetsTarget(goalId, { exitSpeed, angle } = {}) {
  const target = goalTarget(goalId)
  if (!target) return false
  if (!Number.isFinite(angle)) return false
  if (angle < target.launchAngle.min || angle > target.launchAngle.max) return false
  if (target.exitVelocity == null) return true
  if (!Number.isFinite(exitSpeed)) return false
  return exitSpeed >= target.exitVelocity
}

// ─────────────────────────────────────────────────────────────────────────────
// The recovered file begins here
// ─────────────────────────────────────────────────────────────────────────────

// The synthetic hitter: fifteen made-up swings for one practice session.
//
// There is no real TrackMan feed behind this app, so every number a visitor
// sees after session 1 comes from here. That makes this file the place where
// the demo is either believable or not.
//
// It used to be a closure inside App.jsx, where nothing could test it and
// nothing could see it. It was moved out for the same reason goalTargets.js,
// sessionStats.js and chartSlots.js were moved out before it: the judgment in
// here is worth proving, and proving it should not mean loading a screen, a
// chart library and a DOM. Its tests are in swingGenerator.test.js.
//
// Three things it now does that it did not before, all aimed at one complaint:
// on the Power goal, 56 percent of session 2s used to put nothing at all inside
// the orange target band, rising to 63 percent by session 4, and a chart with
// an empty target reads as broken software rather than as a hard practice
// session. (Those two figures bracket sessions 2 to 4; 56 on its own is the
// best of the three, not the whole story. They are the rounded numbers this
// repo has used throughout; `node scripts/measure-swing-generation.mjs` prints
// 56.7 and 63.0, and is what to rerun rather than citing this comment.)
//
//   1. Exit velocity and launch angle come off the same swing (see below).
//   2. A player working on Power slowly gets the ball in the air.
//   3. A session that would render a completely empty band is re-rolled once.
//
// What it deliberately does not do: chase a better-looking session. The re-roll
// happens once and keeps whatever it gets. Everything else here is the demo's
// existing behaviour, carried across unchanged, including the 65/35 chance that
// a session trends better than the last one and the variance factor, both of
// which are settled product decisions recorded in the decision log.

// (The two imports from ./ballFlight and ./goalTargets stood here in the
// original. They are the frozen copies at the top of this file instead; see
// the header for why a half-frozen snapshot is not a snapshot.)

// How much of a swing's spread comes from one shared quality of contact rather
// than from two unrelated accidents. Exit velocity and launch angle used to be
// drawn completely independently, which is why a hitter averaging 17 degrees
// essentially never produced a swing that was hard AND well angled: the two
// numbers had to get lucky separately. Real batted balls do not work that way,
// because a barrel is both at once.
//
// The independent share is the arithmetic that stops the charts tightening just
// because the two numbers now agree with each other: 0.6 squared plus 0.8
// squared is 1, so the typical distance of a swing from its own session's
// average is unchanged. Measured over 20,000 replayed session 2s it holds
// almost exactly: 4.63 mph and 6.35 degrees either way before, 4.63 and 6.36
// after. (Do not confuse that with the 5.2 mph and 6.5 degrees the same
// measurement prints beside it. Those pool every swing from every replay into
// one heap, so they also carry how much the session averages themselves move
// around, which is a different and larger thing. Both are printed by
// `node scripts/measure-swing-generation.mjs`, labelled, for exactly that
// reason.)
//
// What is NOT preserved is the extremes. Adding two scaled draws together can
// reach further than one draw could, so the occasional swing now lands further
// out: launch angle across those replays ran 4 to 31 degrees before and 0 to 35
// after. A visitor sees a few more dots at the edges of the chart, which is
// honest for a hitter and worth knowing before anyone reads a wider scatter as
// a bug.
const CONTACT_CORRELATION = 0.6
const INDEPENDENT_SHARE = Math.sqrt(1 - CONTACT_CORRELATION ** 2)

// How much higher a Power player hits the ball, session by session. Power asks
// for 25 to 35 degrees and the generator used to ignore the player's chosen
// goal entirely, so the one goal with the most demanding target was practised
// by a hitter who never changed.
//
// It is a ramp rather than a flat lift because a flat +5 scored marginally
// better and read far worse: it moves session 2's average launch angle five and
// a half degrees in a single round of batting practice, which is exactly the
// kind of impossible number this slice exists to remove. Measured over 40,000
// replays, the ramp lands session 2 at 20.4 degrees and session 4 at 24.4,
// against a session 1 average of 17.3: a player making progress rather than a
// different player. Those are a little above the +2 and +6 the ramp adds,
// because the re-roll below throws out some of the worst sessions and that
// pulls the average up with it.
const POWER_LIFT_PER_SESSION = 2

// One session of fifteen swings. Everything random it needs comes through the
// injected `random`, so a test can decide exactly what kind of session this is.
function generateOneSession(sessionNum, goalId, prevEV, prevLA, random) {
  // 65/35 improvement bias on session average
  const improving = random() < 0.65
  const sessionEV = prevEV + (improving ? (1 + random() * 3) : -(1 + random() * 2))
  const baseLA = prevLA + (improving ? (0.5 + random() * 2) : -(0.5 + random() * 1.5))

  // The Power lift applies to the session's whole average, before any swing's
  // own noise, so it reads as a hitter who has changed his swing rather than as
  // a hitter who got lucky fifteen times. Only Power: the other goals either
  // ask for a lower angle or ask for nothing, and an unknown or missing goal
  // gets no lift at all rather than a guessed one.
  const sessionLA = baseLA + (goalId === 'power' ? (sessionNum - 1) * POWER_LIFT_PER_SESSION : 0)

  // Variance shrinks slightly as sessions progress (more consistent with practice)
  // Session 2: 100% of session 1 spread, Session 3: 95%, Session 4: 90%. The
  // 0.85 floor never binds, because the app only ever reaches session 4.
  //
  // The comment here used to promise 87%, 75% and 65%, which the formula below
  // has never produced. Corrected in Slice 4 by fixing the comment rather than
  // the formula: how much the demo visibly improves session over session is a
  // product decision, and it is on the What's Next list as its own question.
  const varianceFactor = Math.max(0.85, 1 - (sessionNum - 2) * 0.05)

  return Array.from({ length: 15 }, () => {
    // One draw for how well this particular ball was struck, then one apiece
    // for everything else that separates the two numbers. Both readings carry
    // the same quality term, so a barrelled ball comes out fast and well
    // angled together and a mis-hit comes out slow and flat together.
    const quality = random() - 0.5
    const evNoise = random() - 0.5
    const laNoise = random() - 0.5
    const evOffset = CONTACT_CORRELATION * quality + INDEPENDENT_SHARE * evNoise
    const laOffset = CONTACT_CORRELATION * quality + INDEPENDENT_SHARE * laNoise

    const ev = Math.round(Math.max(65, Math.min(97, sessionEV + evOffset * 16 * varianceFactor)))
    const la = Math.round(Math.max(-5, Math.min(35, sessionLA + laOffset * 22 * varianceFactor)))
    const dir = Math.round((random() - 0.45) * 70 * varianceFactor)
    const dist = carryDistance({ exitSpeed: ev, angle: la })
    const inZonePitch = random() < 0.70
    const plateLocHeight = inZonePitch
      ? 1.5 + random() * 2.0
      : random() < 0.5
        ? 0.5 + random() * 0.9
        : 3.6 + random() * 0.5
    const plateLocSide = inZonePitch
      ? -0.7 + random() * 1.4
      : random() < 0.5
        ? -0.8 - random() * 0.3
        : 0.8 + random() * 0.3
    return { plateLocHeight: Math.round(plateLocHeight * 100) / 100, plateLocSide: Math.round(plateLocSide * 100) / 100, hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } } }
  })
}

// A session of fifteen swings, built off the averages of `baselineSwings`,
// which is the session the player has already seen. `random` is injected only
// so the tests can hold it still; the app passes nothing and gets Math.random.
//
// `baselineSwings` deliberately has no default. A caller that forgets it should
// crash here and be found immediately, rather than be handed fifteen swings
// whose every number is NaN and quietly drawn on a chart. This app has shipped
// a NaN through to the screen before, in computeStats before Slice 4 fixed it.
export function generateSwingsPreSlice11({ sessionNum = 2, goalId = null, baselineSwings, random = Math.random } = {}) {
  const prevEV = baselineSwings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / baselineSwings.length
  const prevLA = baselineSwings.reduce((s, w) => s + w.hit.launch.angle, 0) / baselineSwings.length

  const swings = generateOneSession(sessionNum, goalId, prevEV, prevLA, random)

  // A session where not one swing of fifteen met the goal draws the target band
  // with nothing inside it, which a visitor reads as a broken chart rather than
  // as an honest bad day. So it gets one more roll of the dice.
  //
  // Written for every goal rather than for Power, and that is not a bonus, it is
  // what stops this slice making Line Drives & Contact worse than it is today.
  // Tying exit velocity to launch angle helps Power, whose target wants both
  // numbers high, but it works against Contact, whose target wants a hard hit
  // ball UNDER 18 degrees: the harder a ball is now struck, the more likely the
  // same swing sails through that ceiling. Measured over 20,000 replays per
  // session, Contact rendered an empty band on 9% of session 2s before this
  // slice (11% by session 4), would have gone to 17% (19% by session 4) with
  // the shared contact quality and no re-roll, and lands at 3% (4% by session
  // 4) as this file ships. A Power-only re-roll would have fixed the goal
  // everyone was looking at and quietly damaged the one nobody was. All nine of
  // those numbers, three states across three sessions, are printed by the
  // "what the correlation change did on its own" section of
  // `node scripts/measure-swing-generation.mjs`. The middle state never
  // shipped, so it has to be reconstructed on purpose; that script explains
  // how, and does it without touching anything in src/.
  //
  // Goals with nothing to aim at are skipped entirely: there is no such thing as
  // an empty band on a chart that draws no band, and re-rolling them would be
  // re-rolling against nothing.
  //
  // Once, and the second attempt is kept whatever it contains. Rolling until it
  // succeeds would quietly promise a better hitter than the simulation admits
  // to, and the point of this slice is the opposite of that.
  const bandWouldBeEmpty = hasTarget(goalId) && !swings.some((w) => meetsTarget(goalId, w.hit.launch))
  if (bandWouldBeEmpty) return generateOneSession(sessionNum, goalId, prevEV, prevLA, random)

  return swings
}
