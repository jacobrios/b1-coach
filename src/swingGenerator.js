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
//
// Second annotation, the same day, and this one does touch the swing. A FIFTH
// thing now happens: where the pitch was thrown decides part of how well it was
// struck. Until now it decided nothing at all, measured at a 0.00 mph
// difference in exit velocity between swings at strikes and swings at balls
// across 4,500,000 generated swings, against session 1's own 8.78. The section
// headed "What the pitch does to the swing" is where that is explained, and it
// is the section to read before changing any of the blending arithmetic below.

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

// The standard deviation of one of this file's uniform draws, which are all
// `random() - 0.5` and so spread evenly over an interval of width 1. Every
// term blended into an offset is standardised to exactly this, which is what
// lets the sqrt(1 - w**2) arithmetic above and below hold: two terms on the
// same scale, blended at weights whose squares sum to 1, come out on that
// scale again. Named rather than written as a literal because three separate
// places lean on it meaning the same thing.
const UNIFORM_DRAW_SD = Math.sqrt(1 / 12)

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
const ZONE_HEIGHT_MIDDLE = (STRIKE_ZONE.heightMin + STRIKE_ZONE.heightMax) / 2
const ZONE_SIDE_MIDDLE = (STRIKE_ZONE.sideMin + STRIKE_ZONE.sideMax) / 2

// How wide a swing's two readings are spread, in the units each is reported
// in. These were bare literals inside the swing arithmetic until Slice 11's
// Task 5, and they are named and exported now for one reason: the test that
// proves adding a pitch influence did not widen the distribution has to read
// the scale from here rather than carry its own 16 and 22, or it would be
// proving that two copies of a number agree rather than that the spread is
// what the generator claims. Nothing about their values changed.
export const EV_SPREAD_MPH = 16
export const LA_SPREAD_DEGREES = 22

// Where a pitch sits relative to the zone, in units of the zone's own half
// height and half width, so that 1.0 means "at the edge" on either axis
// despite the zone being wider than it is tall in feet. `distanceFromHeart`
// is how far it sits from the middle, treating the two axes together: 0 is a
// pitch straight down the middle and 1.41 is a corner.
//
// A judgment worth naming rather than leaving in the arithmetic: a foot off
// the side counts for more than a foot off the top, because the zone is
// narrower than it is tall and a pitch a foot outside is further out of the
// hitter's reach than one a foot high. Measuring in feet on both axes instead
// is the obvious alternative and would say the opposite.
//
// Exported so swingGenerator.test.js can measure the population of pitches
// this file throws through the same normalisation the generator uses, and
// hold PITCH_SCALING below to what it finds.
export function normalisedPitch({ height, side }) {
  const h = (height - ZONE_HEIGHT_MIDDLE) / (ZONE_HEIGHT / 2)
  const s = (side - ZONE_SIDE_MIDDLE) / (ZONE_WIDTH / 2)
  return { height: h, side: s, distanceFromHeart: Math.hypot(h, s) }
}

// What that population looks like, measured over 4,000,000 pitches drawn from
// `drawPitch` on 21 August 2026, with the hundredth-of-a-foot rounding applied
// first so these describe the pitches a visitor is actually shown: the
// distance from the heart averages 1.007 with a spread of 0.432, and the
// signed height averages -0.045 with a spread of 0.822. (The height mean is
// slightly below the middle of the zone rather than exactly on it because the
// thrower misses low more often than high.)
//
// THESE ARE MEASURED, NOT DERIVED, WHICH MAKES THEM STALE THE MOMENT THE
// PITCH DISTRIBUTION MOVES. They exist to put the two pitch terms on the same
// scale as the generator's own uniform draws, and centring is the half that
// matters most: a term that is not centred shifts every session's average
// exit velocity rather than merely re-weighting it. There is no closed form
// for the mean of a distance over this mixture, so it is measured and then
// guarded, by a test in swingGenerator.test.js that re-measures the population
// and fails by name if these drift out of date.
export const PITCH_SCALING = {
  distanceMean: 1.007,
  distanceSd: 0.432,
  heightMean: -0.045,
  heightSd: 0.822,
}

// ── What the pitch does to the swing ────────────────────────────────────────
//
// THE DEFECT THIS CLOSES, MEASURED BEFORE ANYTHING WAS CHANGED. Across
// 4,500,000 generated swings, the difference in exit velocity between swings
// at strikes and swings at balls off the plate was 0.00 mph. Session 1, the
// fifteen hand-written swings this demo is calibrated against, has a gap of
// 8.78. The pitch and the swing were simply drawn without reference to each
// other, and since Slice 8c the coach has been handed which pitches were
// outside the zone and has reasoned about them out loud, so on every generated
// session that reasoning was a coincidence.
//
// TWO TERMS, NOT ONE, AND THEY ANSWER DIFFERENT QUESTIONS.
//
//   The pitch-quality term is how far the pitch sits from the heart of the
//   zone, and it is SYMMETRIC: a ball badly missed high and a ball badly
//   missed low are both hard to square up. It feeds the shared contact
//   quality, which is what makes a chased pitch come out soft AND flat
//   together, the way a real mis-hit does rather than one number at a time.
//
//   The pitch-height term is WHICH WAY the pitch is off, and it is
//   directional: a high pitch produces a higher launch angle and a low pitch
//   a lower one. That is ordinary baseball and it is visible in session 1's
//   own data. It feeds launch angle only, and it must not feed exit velocity,
//   or a high strike would come out harder than a low one for no reason.
//
// BLENDED IN, NEVER ADDED ON TOP, and this is the one line to read if you are
// about to change any of it. The first prototype of this task added the pitch
// term on top of the existing draws. It produced an 11 mph zone gap against an
// adopted target of about 4.5 mph and stacked 10 percent of every swing
// exit velocity ceiling, because adding independent terms widens the
// distribution. The sqrt(1 - w**2) weights below are the same arithmetic
// CONTACT_CORRELATION already uses and are what keeps the total spread
// governed by EV_SPREAD_MPH and LA_SPREAD_DEGREES rather than by how many
// influences somebody has added since.
//
// WHERE THE HEIGHT TERM IS BLENDED IN IS A CHOICE, and it is not the obvious
// one. It goes inside the independent half of the launch angle, beside
// laNoise, rather than over the finished offset. Blending it over the finished
// offset dilutes the shared contact term as well, which quietly re-tunes
// CONTACT_CORRELATION, a settled product decision this task has no business
// touching. Measured over 4,000 sessions per goal and session number: doing it
// the obvious way took the Power goal's empty target band from 14.6% to 15.3%
// at session 2 for that reason alone. Blended where it is, exit velocity and
// launch angle still agree with each other exactly as much as 0.6 says they do.
//
// BOTH WEIGHTS ARE PROVISIONAL. Task 9 is a tuning pass that sets every
// constant in this file at once, against nine targets that interact, and these
// two are on its list. What they were chosen for here is the structure, not
// the calibration:
//
//   0.8 on pitch quality puts the pitch behind roughly 23% of the variance in
//   exit velocity (0.6 squared times 0.8 squared), and lands the strike-versus-
//   ball gap at about 3.4 mph. It cannot be pushed to 6 by moving this number:
//   see the ceiling note below.
//
//   0.4 on pitch height makes a pitch at the top of the zone come out about 5
//   degrees higher than one at the bottom, which is a believable batting
//   practice effect rather than a dramatic one.
//
// THE CEILING THIS STRUCTURE HAS, worth knowing before anybody tries to reach
// a 6 mph gap by raising PITCH_QUALITY_WEIGHT. The pitch's effect on exit
// velocity is throttled twice over: once by this weight, and again by
// CONTACT_CORRELATION, because the pitch reaches exit velocity only through
// the shared term. Even at a weight of 1.0, where the pitch would BE the
// contact quality and the swing's own quality draw would count for exactly
// nothing, the gap comes out at about 4.2 mph.
//
// AND WIDENING THE SPREAD DOES NOT GET THERE EITHER, which is the half a first
// reading of this paragraph used to miss. Measured through this generator with
// one constant changed at a time, 1,800,000 swings a row: widening
// EV_SPREAD_MPH to 21.88, which is what it takes to match the hand-written
// session's own spread, gives 4.61 at the shipped weight and 5.77 even at full
// weight. Widening all the way to 28, a third wider than the session the target
// is anchored to, still only gives 5.74. The one combination measured to clear
// 6 was that widening plus CONTACT_CORRELATION at 0.81, which reads 6.20 and
// moves a settled product decision to chase a number. So the honest reading is
// that a 6 mph gap is not what this generator is, and the fuller version of
// that argument, with the whole table, is in docs/slice-11-plan.md.
//
// AND THAT IS WHAT HAPPENED: on 21 August 2026 the product manager adopted a
// target of about 4.5 mph, which is what the widened configuration above
// actually produces. So read the two paragraphs here as the record of why the
// target moved rather than as an open argument against one.
const PITCH_QUALITY_WEIGHT = 0.8
const PITCH_QUALITY_ACCIDENT_SHARE = Math.sqrt(1 - PITCH_QUALITY_WEIGHT ** 2)
const PITCH_HEIGHT_WEIGHT = 0.4
const PITCH_HEIGHT_ACCIDENT_SHARE = Math.sqrt(1 - PITCH_HEIGHT_WEIGHT ** 2)

// The two terms one pitch contributes, each standardised to the same scale as
// one of this file's uniform draws so they can be blended without changing
// what the scale constants mean.
//
// The quality term is NEGATED: distance from the heart is a bad thing, so the
// further out the pitch, the lower the contact quality. A sign error here is
// the likeliest way this whole change goes wrong, and it would show up as a
// hitter who strikes balls off the plate better than strikes down the middle;
// section 1 of `node scripts/measure-swing-generation.mjs` reports it in those
// words rather than as a number to squint at.
//
// WHAT IS NOT PRESERVED IS THE EXTREMES, the same caveat CONTACT_CORRELATION
// carries above. The typical distance of a swing from its session average is
// unchanged, but the best pitch this file can throw now reaches further than
// any single draw could, so the occasional swing lands further out on the
// chart. That is honest for a hitter and worth knowing before anyone reads a
// wider scatter as a bug.
//
// AND ONE THING THAT IS PRESERVED ONLY ALMOST, measured rather than assumed
// and named here because this file names its other overshoots. Across the
// whole report, exit velocity spread within a session came back identical to
// the hundredth, 4.49 / 4.27 / 4.04 mph on sessions 2, 3 and 4 either side of
// this change. Launch angle rose by about eight tenths of a percent, 6.15 to
// 6.20 degrees on session 2 and the same shift on the other two.
//
// The reason is that these two terms are not quite independent of each other:
// the thrower misses low more often than high, so a pitch far from the heart of
// the zone is slightly more likely to be a low one, which leaves them
// correlated rather than orthogonal. Measured through generateSwings itself at
// three seeds of 2,100,000 swings each, it is +0.0576, +0.0577 and +0.0579.
// Feeding one term into the shared half and the other into the independent half
// then adds a little variance instead of none. The arithmetic, since a wrong
// version of it stood here for part of a day: the covariance reaches the launch
// angle offset through both weights on the way, so the term is
// 2 * CONTACT_CORRELATION * INDEPENDENT_SHARE * PITCH_QUALITY_WEIGHT *
// PITCH_HEIGHT_WEIGHT * rho, which is 0.3072 * rho. At 0.0576 that predicts a
// rise of 0.88%.
//
// Against a measured 0.93% for the whole thing, of which rounding to whole
// degrees accounts for 0.103% and the clamps pull the rest back. That rounding
// figure is Sheppard's correction rather than a measurement, so a reader can
// check it without running anything: rounding to a bin of width 1 adds 1/12 to
// the variance, and sqrt(6.35085**2 + 1/12) / 6.35085 is 1.00103. The same
// arithmetic on exit velocity gives 0.195%, which is why the 4.6188 the scale
// constant implies is measured at 4.6233 rather than dead on it.
//
// So the prediction and the measurement agree, which the earlier version of this
// comment could not say: it dropped the pitch-quality weight out of the
// covariance, predicted 1.05%, and then shrugged at a 25% disagreement with its
// own measurement. (A later version of it got the rounding term wrong too, by
// about a factor of two in the same paragraph written to correct that class of
// defect, which is how these two numbers came to be quoted in closed form.)
//
// Not worth correcting for: the fix would be to orthogonalise the two terms,
// which buys six hundredths of a degree at the cost of a step nobody could read.
function pitchInfluence(pitch) {
  const { height, distanceFromHeart } = normalisedPitch(pitch)
  return {
    quality: -((distanceFromHeart - PITCH_SCALING.distanceMean) / PITCH_SCALING.distanceSd) * UNIFORM_DRAW_SD,
    height: ((height - PITCH_SCALING.heightMean) / PITCH_SCALING.heightSd) * UNIFORM_DRAW_SD,
  }
}

// ── The limits, which are approached rather than parked on ──────────────────
//
// WHAT WAS WRONG WITH THE OLD ONES, AND IT IS NOT WHERE THEY SAT. Every swing
// used to end with `Math.max(65, Math.min(97, ...))` and `Math.max(-5,
// Math.min(35, ...))`, which is a wall: every swing that would have gone past
// a limit is handed back the limit itself. Measured across 4,500,000 generated
// swings before this task, 3.67% of Power's session 4 swings came out at
// exactly 35.0 degrees against 2.13% on 34, which is not a tail, it is a stack.
// On screen it is a flat row of dots pinned along the top edge of the launch
// angle chart on a goal every visitor can pick, and it is the same class of
// defect as the impossible hit distances Slice 6 removed: a baseball-literate
// visitor sees it in a second.
//
// MOVING A WALL DOES NOT FIX A WALL. The obvious change, once the pop-up band
// below needs room, is to move the launch angle limit from 35 to 50 and stop
// there. It looks fixed only because nothing reaches 50 today. Measured while
// designing this task: widening the exit velocity spread put 3% of swings
// against a hard 94, the identical artefact relocated one constant over. Task 9
// is a tuning pass over every constant in this file at once, so a fix that only
// holds at today's settings is not a fix.
//
// SO THE LIMIT IS APPROACHED INSTEAD. Inside `soft` units of a limit the value
// is eased toward it along an exponential that never arrives, which is one
// mechanism covering both ends of both readings:
//
//   Two different overshoots come out as two different numbers, so the chart
//   still says which swing was the harder one. A wall cannot do that, and that
//   is exactly what its flat row of dots means.
//
//   QUALIFIED 21 AUGUST 2026, BY REVIEW, because that sentence is
//   unconditional and the drawn number is rounded to a whole one. Far enough
//   out the curve flattens under half a unit and two overshoots do draw the
//   same: measured, every raw launch angle at or above 56.51 draws as 50 and
//   every raw exit velocity at or above 99.38 draws as 97. What makes that a
//   headroom figure rather than a live defect is that the highest angle this
//   generator produced across 4,500,000 swings is 47, nine and a half degrees
//   short of it, and that it degrades gradually rather than at a cliff: driven
//   off baselines of 40, 50, 60, 80, 300 and 1000 degrees the drawn angles are
//   48, 50, 50, 50, 50, 50. Read the claim as true across the range this
//   generator reaches, which is the range the charts draw.
//
//   Nothing can exceed a limit, which is what the charts and the coach's count
//   lines assume, so the guarantee the wall was there for is kept.
//
//   The curve is continuous and its slope is 1 at the knee, so an ordinary
//   swing inside the soft zone is barely moved and there is no second edge
//   where the compression starts.
//
// HOW WIDE THE SOFT ZONE IS, IS THE ONE JUDGMENT HERE, and both numbers are
// provisional for Task 9. Too wide and the compression reaches into the body
// of the distribution and quietly shrinks an honest tail; too narrow and it
// crushes the overshoots back together, which is a wall again by another name.
// 5 degrees and 3 mph put the knees at 45 degrees and 94 mph.
//
// WHAT THAT COSTS, COUNTED RATHER THAN ESTIMATED, and corrected on 21 August
// 2026 the same day it was written: this paragraph first said "the pop-up band
// passes through untouched and roughly one exit velocity in seventy is moved at
// all", and neither half held. Measured by counting the branch taken, over
// 900,000 swings off session 1:
//
//   Exit velocity is eased at all on 0.85% of swings, one in 118, of which one
//   in 200 is at the top end and the rest at the floor. The old "one in
//   seventy" overstated it by nearly a factor of two.
//
//   The pop-up band is NOT untouched. It runs to 48 and the knee is at 45, so
//   30% of pop-up draws land in the soft zone and the worst of them moves 0.74
//   of a degree. That is exactly why the realised band tops out at 47.26 rather
//   than 48, and it is most of why launch angle is eased on 0.98% of swings
//   against exit velocity's 0.85%.
//
// A SOFT ZONE WIDER THAN HALF THE RANGE BREAKS THIS OUTRIGHT, and the guard
// below rather than this sentence is what stops it, because Task 9 is handed
// `soft` by name as a constant to tune and a sentence relies on being read.
//
// Exported for the reason PITCH_MISS_MAX_FEET is exported: the test that holds
// every generated swing inside these limits reads them from here, so it cannot
// go on agreeing with a number that has stopped being true.
export const EXIT_VELOCITY_LIMITS = { min: 65, max: 97, soft: 3 }
export const LAUNCH_ANGLE_LIMITS = { min: -5, max: 50, soft: 5 }

// The one way to set a soft zone that turns `withinLimits` into something worse
// than the wall it replaced. Past half the range the two branches below overlap,
// and the value where they meet becomes a cliff the curve falls off: at
// { min: 65, max: 97, soft: 20 } a raw 77.00 comes back as 78.41 and a raw 77.01
// as 77.01, so a swing struck a hundredth of a mph harder draws nearly a mph and
// a half softer, on every chart, with nothing anywhere saying so. The threshold
// is half the range either way, which is 16 mph and 27.5 degrees at today's
// limits, and the cliff always sits at `max - soft`.
//
// THE EXAMPLE HERE WAS WRONG FOR HALF A DAY AND THE CORRECTION IS WORTH KEEPING.
// It first cited a raw 66 giving 72.73 against a raw 96 giving 89.27, and both
// of those numbers are real, but 89.27 is the LARGER of the two: that pair shows
// the harder swing still drawing harder, so it disproved the sentence it was
// printed under. Scanning the whole range at a thousandth of a mph finds exactly
// one descent, and it is the one now quoted. The guard and the threshold were
// right all along; only the illustration was not, and an illustration a reader
// can check is the entire reason for putting one here.
//
// It throws at module load rather than warning, because a generator that has
// silently swapped hard contact for weak contact is not a degraded demo, it is a
// demo saying the opposite of what happened. Exported so its own test can drive
// the broken case directly; nothing else has any reason to call it.
export function assertSoftZoneFits(name, { min, max, soft }) {
  if (!(soft > 0) || soft > (max - min) / 2) {
    throw new Error(
      `The ${name} soft zone of ${soft} does not fit inside its own range of ${min} to ${max}: ` +
        `it has to be above 0 and at most ${(max - min) / 2}, or the two ends of the compression overlap and the curve inverts.`
    )
  }
}
assertSoftZoneFits('exit velocity', EXIT_VELOCITY_LIMITS)
assertSoftZoneFits('launch angle', LAUNCH_ANGLE_LIMITS)

// THE TOP OF THE LAUNCH ANGLE RANGE IS COUPLED TO src/ballFlight.js AND THE
// COUPLING WAS CHECKED RATHER THAN ASSUMED. `carryDistance`'s shape term reads
// `Math.max(0.55, 1 - (angle - 28) * 0.02)`, so it stops falling at exactly
// 50.5 degrees and every angle above that is credited with the same carry.
// A limit of 50 sits under that, so no swing this file can produce reaches the
// flat part, and the carry formula needed no change for this task. Raise this
// limit past 50.5 and that stops being true: a 60 degree pop-up and a 51
// degree one would carry the same distance, which is the sort of thing this
// project's charts get judged on.
function withinLimits(value, { min, max, soft }) {
  if (value > max - soft) return max - soft * Math.exp((max - soft - value) / soft)
  if (value < min + soft) return min + soft * Math.exp((value - min - soft) / soft)
  return value
}

// ── Getting under a high one ────────────────────────────────────────────────
//
// THE DEFECT THIS CLOSES. The Reduce Pop-Ups goal tells the coach a pop-up is
// a launch angle above 35 degrees, and the wall above used to sit on exactly
// 35, so a pop-up was arithmetically impossible: across 4,500,000 generated
// swings the count handed to the coach was zero on every single session. One
// of the six goals a visitor can pick named a failure its own hitter could not
// commit.
//
// RAISING THE LIMIT ALONE DOES NOT PRODUCE ONE, which is the measurement that
// decided the shape of this. With the wall removed and nothing else changed,
// swings above 35 degrees appear on the Power goal alone, 0.04 per session at
// session 2 rising to 0.38 at session 4, and never above 40 degrees anywhere;
// on Reduce Pop-Ups itself, the goal that needs them, the count stays at zero.
// The other way to reach one, widening the launch angle spread until the
// ordinary distribution gets there, was rejected while scoping: it makes every
// generated session visibly wilder than the hand-written first session this
// whole demo is calibrated against.
//
// SO A POP-UP IS ITS OWN CONTACT OUTCOME HERE, not an extreme line drive. The
// hitter gets under the ball: the angle comes from its own band and the ball
// comes off the bat softer than the session average, both of which are what a
// pop-up is. That is a product decision taken on 21 August 2026 rather than an
// engineering one, and the alternatives it beat were "leave the goal naming an
// impossible failure" and "make pop-ups common".
//
// RARE, AND CAUSED BY A HIGH PITCH, is the whole of that decision. Roughly one
// pop-up every two or three sessions, so the coach has something real to coach
// against without the demo turning into a hitter who cannot square anything up.
// Tying it to pitch height is what makes the coaching point visible: the coach
// can say the pop-ups came off pitches at the top of the zone, and the visitor
// can see those pitches on the pitch location chart beside it.
//
// AND IT HAS TO BE CAUSED OUTRIGHT, because the underlying tendency runs the
// other way. Measured in Task 5: mean launch angle by pitch height band rises
// to the middle of the zone and then falls, so a ball chased above the zone
// currently comes out about two degrees FLATTER than a strike down the middle,
// where session 1 says it should be the steepest thing on the chart. Nothing
// here fixes that (it is recorded as a finding and is Task 9's to weigh); what
// it means is that a mis-hit mode leaning on the existing height term would
// have produced nothing, so this one replaces the swing rather than nudging it.
//
// ONE THING THIS COSTS, NAMED BECAUSE THE FILE NAMES ITS OTHER OVERSHOOTS.
// Session 1 is hand-written, frozen, and contains no pop-up at all, its
// steepest ball being 27 degrees. So every generated pop-up is a step away from
// the first screen a visitor sees. That was weighed when the target was set and
// it is why the answer is "rare" rather than "common".
//
// ALL FIVE CONSTANTS BELOW ARE PROVISIONAL. Task 9 sets every constant in this
// file at once against targets that interact; what was chosen here is the
// structure. The band is exported so its own test cannot carry a stale copy of
// it; the rest are not, because nothing outside this file has any business
// knowing them.
export const POP_UP_BAND = { min: 38, max: 48 }

// How much slower than the session's own average a popped-up ball comes off
// the bat. A range rather than one number, so fifteen pop-ups in a demo would
// not all read the same. It is subtracted from the session average rather than
// from the swing's own exit velocity, because a pop-up is a contact outcome in
// its own right and not a discount on the swing that would otherwise have
// happened.
const POP_UP_EV_DROP_MPH = { min: 6, max: 14 }

// Where the chance of getting under one starts to rise and where it tops out,
// in the units normalisedPitch reports: 0 is the middle of the zone, 1.0 is
// the top edge of it, and 1.8 is the highest pitch this file can throw.
//
// A RAMP RATHER THAN A STRAIGHT LINE THROUGH THE WHOLE RANGE, and the reason
// is a measurement rather than taste. Pitches at or above the top of the zone
// are only about a tenth of all pitches thrown here, so a chance that rose
// gently from the bottom of the zone upward would put most pop-ups on ordinary
// strikes purely because there are so many more of them, and the coaching
// point ("you got under the high ones") would be false. Starting the ramp
// above the middle of the zone is what keeps the majority of pop-ups on the
// pitches the coach is going to blame: about seven in ten, against the one in
// ten chance alone would give.
const POP_UP_FROM_HEIGHT = 0.6
const POP_UP_FULL_HEIGHT = 1.4

// The chance of getting under the very highest pitch this file throws. It
// reads high for a single swing, and it is the number the frequency target
// above actually lands on, because it applies to about an eighth of pitches
// once the ramp is taken into account: 0.22 at the top of the ramp works out
// at 0.027 per swing averaged over every pitch, which is 0.40 pop-ups in a
// fifteen swing session, or one every two or three sessions.
const POP_UP_MAX_CHANCE = 0.22

function popUpChance(pitch) {
  const { height } = normalisedPitch(pitch)
  const reach = (height - POP_UP_FROM_HEIGHT) / (POP_UP_FULL_HEIGHT - POP_UP_FROM_HEIGHT)
  return POP_UP_MAX_CHANCE * Math.min(1, Math.max(0, reach))
}

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
    // Both readings are rounded to the hundredth of a foot, which is how
    // TrackMan reports them and how every chart and count line in this app
    // reads them. The rounding can never move a pitch across the zone edge:
    // the smallest miss this file throws is 0.05 feet, ten times the most a
    // hundredth-of-a-foot rounding can shift a number.
    //
    // ROUNDED HERE, BEFORE THE SWING READS IT, rather than on the way out.
    // Since Task 5 the pitch decides part of how well the ball was struck, and
    // it should decide that from the number the visitor is shown and the coach
    // is handed, not from an unrounded one nothing else in the app ever sees.
    const drawn = drawPitch(random)
    const pitch = {
      height: Math.round(drawn.height * 100) / 100,
      side: Math.round(drawn.side * 100) / 100,
    }
    const fromPitch = pitchInfluence(pitch)

    // One draw for how well this particular ball was struck, then one apiece
    // for everything else that separates the two numbers. Both readings carry
    // the same quality term, so a barrelled ball comes out fast and well
    // angled together and a mis-hit comes out slow and flat together.
    //
    // How well the ball was struck is now part the pitch and part the hitter:
    // the accident share is what is left of a swing once the pitch has had its
    // say, and squaring the two weights and adding them still gives 1, so this
    // blend cannot widen the distribution however the weights are retuned.
    const qualityDraw = random() - 0.5
    const evNoise = random() - 0.5
    const laNoise = random() - 0.5
    const quality = PITCH_QUALITY_WEIGHT * fromPitch.quality + PITCH_QUALITY_ACCIDENT_SHARE * qualityDraw
    const evOffset = CONTACT_CORRELATION * quality + INDEPENDENT_SHARE * evNoise
    // The signed height sits inside the independent half, beside laNoise,
    // which is the half this file already describes as "everything else that
    // separates the two numbers". That is exactly what a high pitch is: a
    // reason for the launch angle to differ from the exit velocity on the same
    // swing. Blending it over the finished offset instead would water down the
    // shared term too and quietly re-tune CONTACT_CORRELATION; see the note
    // above the weights for the measurement that ruled that out.
    const laAccident = PITCH_HEIGHT_WEIGHT * fromPitch.height + PITCH_HEIGHT_ACCIDENT_SHARE * laNoise
    const laOffset = CONTACT_CORRELATION * quality + INDEPENDENT_SHARE * laAccident

    const dir = Math.round((random() - 0.45) * 70 * varianceFactor)

    // THE THREE MIS-HIT DRAWS ARE TAKEN ON EVERY SWING, whether or not it turns
    // out to be one, so a swing always costs the same number of draws. That is
    // not tidiness: several tests in swingGenerator.test.js spell a session out
    // draw by draw and read the result off the page, and a swing whose cost
    // depended on which branch it took would make those unreadable. It also
    // keeps the empty-band re-roll's arithmetic simple, since two attempts are
    // then always the same length.
    //
    // They sit AFTER the swing's own four draws rather than before them, which
    // keeps the order those tests already document (quality, exit velocity
    // noise, launch angle noise, direction) unchanged.
    const gotUnderIt = random() < popUpChance(pitch)
    const popUpAngle = POP_UP_BAND.min + random() * (POP_UP_BAND.max - POP_UP_BAND.min)
    const popUpDrop = POP_UP_EV_DROP_MPH.min + random() * (POP_UP_EV_DROP_MPH.max - POP_UP_EV_DROP_MPH.min)

    // A pop-up REPLACES the swing rather than adjusting it. Everything above
    // describes a ball the hitter squared up to some degree, and this is the
    // one outcome where he did not: he got under it, so the angle comes off
    // the ball's own band and the exit velocity comes off the session average
    // rather than off this swing's contact quality. Blending the two would
    // produce a hard pop-up on a good draw, which is not a thing.
    const rawEv = gotUnderIt ? sessionEV - popUpDrop : sessionEV + evOffset * EV_SPREAD_MPH * varianceFactor
    const rawLa = gotUnderIt ? popUpAngle : sessionLA + laOffset * LA_SPREAD_DEGREES * varianceFactor

    // One place per reading where the limits are applied, ordinary swing and
    // pop-up alike, so "nothing can leave the range the charts draw" is a
    // property of one line rather than of every branch above it remembering.
    const ev = Math.round(withinLimits(rawEv, EXIT_VELOCITY_LIMITS))
    const la = Math.round(withinLimits(rawLa, LAUNCH_ANGLE_LIMITS))
    const dist = carryDistance({ exitSpeed: ev, angle: la })
    return { plateLocHeight: pitch.height, plateLocSide: pitch.side, hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } } }
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
