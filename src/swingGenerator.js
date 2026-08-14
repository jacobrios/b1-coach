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
// on the Power goal, 56 percent of generated sessions used to put nothing at
// all inside the orange target band, and a chart with an empty target reads as
// broken software rather than as a hard practice session.
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

import { carryDistance } from './ballFlight'
import { hasTarget, meetsTarget } from './goalTargets'

// How much of a swing's spread comes from one shared quality of contact rather
// than from two unrelated accidents. Exit velocity and launch angle used to be
// drawn completely independently, which is why a hitter averaging 17 degrees
// essentially never produced a swing that was hard AND well angled: the two
// numbers had to get lucky separately. Real batted balls do not work that way,
// because a barrel is both at once.
//
// The independent share is the arithmetic that stops the charts tightening just
// because the two numbers now agree with each other: 0.6 squared plus 0.8
// squared is 1, so the typical distance of a swing from its session average is
// unchanged. Measured over 40,000 replays it holds almost exactly, 5.2 mph and
// 6.5 degrees either way.
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
export function generateSwings({ sessionNum = 2, goalId = null, baselineSwings, random = Math.random } = {}) {
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
  // same swing sails through that ceiling. Measured over 40,000 replays of each,
  // Contact renders an empty band on 9% of sessions today, 16% with the shared
  // contact quality and no re-roll, and 3% as this file ships. A Power-only
  // re-roll would have fixed the goal everyone was looking at and quietly
  // damaged the one nobody was.
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
