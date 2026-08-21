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
//
// Annotation, 21 August 2026, Slice 11. That last sentence was true when it was
// written and is not any more, so read it as a description of Slice 6 rather
// than of this file. A fourth thing now happens: the pitch is drawn before the
// swing, and a missed pitch is a near miss on one side of the zone rather than
// a wild one off on both. Everything the header above says about the swing
// itself still stands untouched. The section headed "The thrower", below the
// Power lift, is where that change is explained.

import { carryDistance } from './ballFlight'
import { hasTarget, meetsTarget } from './goalTargets'
// The strike zone is read from sessionStats.js rather than written out again
// here. It matters more in this file than anywhere else it is copied: whether a
// pitch counts as a strike is decided by `inStrikeZone` over there, and every
// pitch a visitor ever sees is thrown here. Two copies of those four numbers
// would mean this file could aim at a zone the rest of the app does not
// recognise, and nothing would say so. Adopted while rewriting these very lines
// in Slice 11, not as a tidy-up of anything else; the remaining copies in
// DebriefScreen.jsx and the coach prompt are untouched and still counted in
// CLAUDE.md's consolidation note.
import { STRIKE_ZONE } from './sessionStats'

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

// ── The thrower ─────────────────────────────────────────────────────────────
//
// WHAT THIS FILE NOW CLAIMS ABOUT THE PERSON THROWING. A batting practice arm
// that puts about two pitches in three where the hitter can reach them, and
// whose misses are misses rather than wild ones: a ball just off the edge, on
// one side of the zone at a time. Before Slice 11 it claimed neither of those
// things, and both were measured rather than argued about, across 4,500,000
// generated swings by `node scripts/measure-swing-generation.mjs`, which is
// what that script's own sample of 20,000 sessions per goal per session number
// comes to and what it prints for itself:
//
//   Every single missed pitch was off on BOTH axes at once, 100% of them.
//   There was no such thing here as a pitch that was simply low, because a low
//   pitch was always wide as well. No real thrower misses that way, and it is
//   the single reason the pitch location chart looked wrong.
//
//   A miss was 0.47 feet outside the zone on average and could be thrown as
//   low as 0.50 feet off the ground, which is a ball bouncing in front of the
//   plate rather than a ball anybody would swing at. Session 1, the fifteen
//   hand-written swings this whole demo is calibrated against, misses by 0.28
//   feet on average and its worst miss is 0.70.

// READ THIS ONE THE RIGHT WAY ROUND, because a future reader will otherwise
// get it backwards. IN_ZONE_RATE is a CHASE rate, not a command rate. It is
// not how often the thrower finds the zone; it is how often the pitch the
// hitter chose to go after turned out to be a strike. Every pitch this file
// produces is swung at, because a session is fifteen SWINGS: the pitches he
// let go by are not modelled here at all, so the arm threw some larger and
// entirely unrecorded number of which these fifteen are the ones he offered
// at. That is what resolves the next sentence, which otherwise reads as a flat
// contradiction of this one. A hitter who lets the worst balls go by is why
// this number sits well above any real thrower's strike percentage, and it is
// why moving it says something about the hitter's discipline rather than about
// the arm.
//
// 0.65 is a product judgment between two anchors, not a measurement. It
// replaces 0.70, which nothing was ever calibrated against, and it moves
// toward session 1's own 60% without matching it: session 1 is fifteen swings,
// far too few to fit a rate to, and its 60% is itself a hand-written choice.
//
// Exported so swingGenerator.test.js can drive the generator either side of
// this exact number, which is what proves the rate the file declares is the
// rate it actually throws to.
export const IN_ZONE_RATE = 0.65

// How far outside the zone a missed pitch lands, in feet. Session 1's own six
// missed pitches are the shape being matched: 0.10, 0.10, 0.20, 0.30, 0.30 and
// 0.70 feet outside, averaging 0.28, with 0.70 the worst of them.
//
// The miss is drawn as `min + random()**2 * (max - min)` rather than flat,
// because squaring a uniform draw piles the results up near zero. Most misses
// then come out just off the edge, which is what a hitter actually chases, and
// the occasional one gets further away. That shape averages 0.30 feet against
// session 1's 0.28, and can never exceed 0.80, which is a ball off the plate
// rather than a ball in the dirt.
//
// ONE ARTIFACT THAT COMES WITH THAT SHAPE, named here because this file names
// every other thing it does. Piling misses up against the floor leaves a
// density spike on the zone edge, and the size of it can be read straight off
// the formula rather than sampled: a miss rounds to the nearest bin when it is
// under 0.055 feet, which happens on `sqrt(0.005 / 0.75)` of draws, about
// 8.16%. So roughly one low miss in twelve lands on exactly 1.45 feet and one
// high miss in twelve on exactly 3.55, while a wide miss splits between two
// sides and puts about 4.08% on each of 0.75 and -0.75. (A one-off sweep of
// 209,463 balls agreed at 8.29, 8.07, 4.08 and 4.17 percent. The analytic
// number is quoted first on purpose, because it is checkable without running
// anything, and no committed script reproduces that sweep.) Either side of the
// spike sits a hard dead band, because a miss can never be smaller than the
// floor: not one pitch anywhere lands strictly between 1.45 and 1.50 feet,
// between 3.50 and 3.55, or between 0.70 and 0.75 sideways.
//
// This is NOT the launch angle clamp in a second costume, and the difference is
// worth holding on to. A clamp piles values onto one extreme and nothing exists
// beyond it; here the values fan out smoothly from the edge and the spike is
// merely the nearest bin. It is still a boundary artifact on the pitch location
// chart, which is the one screen this change alters, so it goes on the list for
// this slice's browser gate rather than waiting for somebody to notice it.
//
// The maximum is exported for the same reason as the rate above: the test that
// holds every generated pitch inside these walls reads the wall from here, so
// a test carrying its own copy cannot quietly drift away from the limit it is
// supposed to be guarding.
export const PITCH_MISS_MAX_FEET = 0.80
const PITCH_MISS_MIN_FEET = 0.05

// Which way a missed pitch got away: low 40%, high 30%, wide 30%, and a wide
// one is an even coin between the two sides of the plate.
//
// An engineering judgment rather than a measurement, and worth saying so
// plainly. The only real data this app has is session 1's own six misses,
// which are three low, two high and one wide, and six of anything is far too
// few to fit a distribution to. (Exactly, because this file should not round
// its own evidence: session 1's swing 14 is a tenth of a foot high AND a tenth
// wide, and is counted as high in that three-two-one.) Low leads because a
// dropped ball is the commonest miss out of a practice arm and the one a
// hitter is most often talked into swinging at.
const MISS_LOW_SHARE = 0.40
const MISS_HIGH_SHARE = 0.30

// AND THE JUDGMENT INSIDE THAT RULE, said out loud because this file
// acknowledges its others. Choosing one axis makes a missed pitch off on
// exactly one of them, always, so the both-axes share is now 0.000% against
// session 1's own 16.7%: one of its six misses, swing 14, is a tenth of a foot
// high AND a tenth wide. The brief asked for exactly this and it is what was
// built, but it overshoots the calibration target rather than meeting it, and
// a thrower who CANNOT miss two ways at once is a shade tidier than the session
// this demo is calibrated against. The defect being removed was 100% of misses
// off on both axes, so the overshoot buys a great deal and costs about one
// pitch in six of one fifteen-swing session. If it is ever judged worth closing,
// the change is a small chance of a second axis, not a different split.

// The zone's own dimensions, derived rather than typed, so the in-zone draw
// below covers exactly the zone `inStrikeZone` recognises and not a rectangle
// that merely resembles it.
const ZONE_HEIGHT = STRIKE_ZONE.heightMax - STRIKE_ZONE.heightMin
const ZONE_WIDTH = STRIKE_ZONE.sideMax - STRIKE_ZONE.sideMin

// Where one pitch was thrown, in feet: height off the ground, and sideways
// from the middle of the plate.
//
// A missed pitch is off on ONE axis and an ordinary pitch on the other,
// because that is how a real one misses. That is the whole difference between
// this and what it replaced.
function drawPitch(random) {
  if (random() < IN_ZONE_RATE) {
    return {
      height: STRIKE_ZONE.heightMin + random() * ZONE_HEIGHT,
      side: STRIKE_ZONE.sideMin + random() * ZONE_WIDTH,
    }
  }

  const miss = PITCH_MISS_MIN_FEET + random() ** 2 * (PITCH_MISS_MAX_FEET - PITCH_MISS_MIN_FEET)
  const wayItGotAway = random()

  if (wayItGotAway < MISS_LOW_SHARE) {
    return { height: STRIKE_ZONE.heightMin - miss, side: STRIKE_ZONE.sideMin + random() * ZONE_WIDTH }
  }
  if (wayItGotAway < MISS_LOW_SHARE + MISS_HIGH_SHARE) {
    return { height: STRIKE_ZONE.heightMax + miss, side: STRIKE_ZONE.sideMin + random() * ZONE_WIDTH }
  }
  return {
    height: STRIKE_ZONE.heightMin + random() * ZONE_HEIGHT,
    side: random() < 0.5 ? STRIKE_ZONE.sideMin - miss : STRIKE_ZONE.sideMax + miss,
  }
}

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
    // THE PITCH IS DRAWN FIRST, BEFORE ANYTHING ABOUT THE SWING, and the order
    // is the point rather than a tidy-up. A pitch drawn afterwards cannot
    // influence what the swing did, and until Slice 11 that is exactly what
    // happened: measured across 4,500,000 generated swings, the difference in
    // exit velocity between swings at strikes and swings at balls was 0.00 mph,
    // while session 1's own gap is 8.78. Since Slice 8c the coach is handed
    // which pitches were outside the zone and reasons about them out loud, so
    // on every generated session that reasoning was a coincidence.
    //
    // Moving the draw changes every generated session at a given seed, because
    // the numbers now come off the shared random source in a different order.
    // That was expected and is why the pre-Slice-11 generator was snapshotted
    // under docs/eval-fixtures/frozen/ first, so every committed round of coach
    // evaluations still describes the swings its coach actually saw.
    const pitch = drawPitch(random)

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
    // Both readings are rounded to the hundredth of a foot, which is how
    // TrackMan reports them and how every chart and count line in this app
    // reads them. The rounding can never move a pitch across the zone edge:
    // the smallest miss this file throws is 0.05 feet, ten times the most a
    // hundredth-of-a-foot rounding can shift a number.
    return { plateLocHeight: Math.round(pitch.height * 100) / 100, plateLocSide: Math.round(pitch.side * 100) / 100, hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } } }
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
