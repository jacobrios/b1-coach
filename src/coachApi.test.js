// Tests for the single choke point every coach request goes through.
//
// Two behaviors matter here and neither is visible on a happy path: the one
// automatic retry, which fires only for failures that never reached a good
// response and only while the call's time budget can still afford it, and the
// unwrapping of a model response that arrives fenced in Markdown. Both were
// added because the real thing went wrong; both are silent when they work.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  callApi, goalContext, generateDebrief, sendChatMessage, CoachError,
  DEBRIEF_SYSTEM, DEBRIEF_SYSTEM_BASE, DEBRIEF_BUDGET, buildDebriefUserMessage,
  DIRECTION_KEY_LINE, SETTING_LINE, SESSIONS_LINE, NUMBER_SLOT_LINES,
} from './coachApi.js'
import { distanceDistributionLine } from './ballFlight.js'
// Imported rather than hand-copied, unlike the distances the block below pins
// as literals: these tests are about which swings the coach is told went
// where, so they have to run against the real session 1, not a copy of it.
import { SESSION_ONE_SWINGS } from './sessionOneSwings.js'
import { sprayBreakdown, pitchZoneBreakdown } from './sessionStats.js'
import { generateSwings } from './swingGenerator.js'

const RETRY_DELAY_MS = 1500
const REQUEST_TIMEOUT_MS = 50000

const ok = (text) => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: 'text', text }] }),
})

// A non-ok response carrying the server's classified envelope from api/coach.js:
// { error: { reason, upstreamStatus, upstreamMs, cold } }.
const serverError = (status, reason, cold = false) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ error: { reason, upstreamStatus: status, upstreamMs: 10, cold } }),
})

// The legacy caller-shape refusal from api/coach.js's `reject`, where `error` is
// a bare string rather than the classified envelope object.
const legacyInvalid = (status = 400) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ error: 'Invalid request' }),
})

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

// callApi waits 1500ms before its retry, so a test that simply awaits would sit
// there. Start the call, push the clock past the delay, then take the result.
async function run(promiseFactory) {
  const promise = promiseFactory()
  // Attach a handler now so a rejection landing while the clock advances is not
  // reported as unhandled. The assertion still sees the original promise.
  promise.catch(() => {})
  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
  return promise
}

// The numbers below are written as literals rather than read from goalTargets.js.
// Asserting the prompt against the same module it is built from would pass no
// matter what those numbers became, which is exactly the change worth catching:
// this is the text the coach reads before telling the player what to aim for.
describe('the targets the coach is told about', () => {
  it('tells the coach power is 25 to 35 degrees at 88 mph', () => {
    const context = goalContext({ id: 'power' })
    expect(context).toContain('25-35 degrees')
    expect(context).toContain('88+ mph')
  })

  // Slice 6 replaced the fake distance formula with an honest carry curve.
  // Under the old formula, 88 mph at 25-35 degrees carried 399 feet, so calling
  // it "home run distance" was true. Under the honest curve a swing that meets
  // the target carries 277 to 368 feet, and at the band's own minimum of 88 mph
  // it never clears 323, warning-track territory, not out of the park. Only
  // the hardest contact the generator can produce, 94 mph at 28 degrees,
  // reaches 368. So the prompt must not claim a home run next to a chart that
  // shows one falling short. This
  // pins the wording, not the number, so it survives future retuning of the
  // carry curve itself.
  //
  // The two figures above were 390 feet and 97 mph until 21 August 2026;
  // Slice 11 moved the exit velocity ceiling to 94, and "ceiling" now means a
  // soft limit nothing exceeds rather than a wall. Re-measured against the
  // current ceiling rather than adjusted by eye. The 277 and the 323 did not
  // move, and neither does what this test asserts, which is the absence of a
  // phrase rather than any number.
  it('does not tell the coach the Power target is home run distance', () => {
    const context = goalContext({ id: 'power' })
    expect(context.toLowerCase()).not.toMatch(/home run/)
  })

  it('tells the coach contact is 8 to 18 degrees at 85 mph', () => {
    const context = goalContext({ id: 'contact' })
    expect(context).toContain('8-18 degrees')
    expect(context).toContain('85+ mph')
  })

  it('tells the coach popup is 10 to 25 degrees', () => {
    expect(goalContext({ id: 'popup' })).toContain('10-25 degrees')
  })

  it('tells the coach that Open Session has no target metrics', () => {
    expect(goalContext({ id: 'open' })).toContain('no specific target metrics')
  })

  it('gives Hit to All Fields its spray-direction context and no launch angle target', () => {
    const context = goalContext({ id: 'allfields' })
    expect(context).toContain('all three zones')
    expect(context).not.toContain('target launch angle')
  })

  it('says nothing at all for a goal it does not know', () => {
    expect(goalContext({ id: 'dashboard' })).toBe('')
    expect(goalContext(undefined)).toBe('')
  })

  // power, contact and popup quote their target numbers, so they read the shared
  // definition without checking it is there. Nothing else keeps this switch and
  // GOAL_TARGETS in step, and a goal that lost its target would throw here
  // rather than in a test: every debrief for that goal would fail before the
  // request was even sent. This is that missing check.
  it.each(['power', 'contact', 'popup', 'allfields', 'open', 'dashboard'])(
    'builds the context for %s without throwing',
    (id) => {
      expect(() => goalContext({ id })).not.toThrow()
    },
  )
})

// Slice 8b Task 3 moves the numbers that lived only inside goalContext's
// prose (the direction cutoffs, the 82 mph hard-contact line, the fly-ball,
// pop-up and grounder angles) into GOAL_COUNT_SPECS, with the prose
// interpolating them back in. That refactor is only safe if it changes no
// prompt output at all: the baseline measurement round runs against these
// exact strings after the refactor lands. So every rendered string is pinned
// here byte for byte, as literals captured from the shipped code on
// 18 August 2026, before the refactor began. The em and en dashes inside
// the pinned strings are the coach's shipped prose, preserved exactly.
// If one of these fails after an INTENDED prompt change, that change is
// Task 6's to make with sign-off; update the literal in the same commit that
// changes the prose, never to make an unintended diff pass.
//
// Task 6 landed later on 18 August 2026 and made exactly that intended
// change: the count lines are per-goal now, so the allfields pin below
// carries allfields' own three count lines instead of Power's two. The
// power pin is untouched, deliberately: Power's lines were already correct
// and its rendered prompt is byte-identical before and after Task 6.
describe('the rendered prompt strings, pinned byte for byte', () => {
  it('renders every goalContext exactly as shipped', () => {
    expect(goalContext({ id: 'power' })).toBe(
      "Goal context: target launch angle 25-35 degrees, target exit velocity 88+ mph. These are the conditions for the player's best contact.",
    )
    expect(goalContext({ id: 'contact' })).toBe(
      'Goal context: target launch angle 8-18 degrees for true line drives, target exit velocity 85+ mph for hard contact. Angles above 18 degrees are fly balls, not line drives.',
    )
    expect(goalContext({ id: 'allfields' })).toBe(
      'Goal context: goal is meaningful contact to all three zones — at least 3 swings pull side (direction below -15 degrees), at least 3 swings opposite field (direction above +15 degrees), remainder center field. Exit velocity 82+ mph indicates hard contact that challenges fielders.',
    )
    expect(goalContext({ id: 'popup' })).toBe(
      'Goal context: goal is to eliminate pop-ups (launch angles above 35 degrees) while avoiding weak grounders (launch angles below 5 degrees). Target launch angle is 10-25 degrees — enough loft to drive the ball into the outfield productively without ballooning. Staying consistently between 10-25 degrees is success.',
    )
    expect(goalContext({ id: 'open' })).toBe(
      'Goal context: open session with no specific target metrics. Analyze the most interesting patterns in the data.',
    )
  })

  // The whole user message, not just the goalContext inside it, so a slip
  // anywhere in buildDebriefUserMessage during the refactor shows up too.
  // Two swings and one session keep the literal small enough to read; the
  // two goals cover a goal with a target and a goal without one.
  const pinSwings = [
    { plateLocHeight: 2.1, plateLocSide: 0.3, hit: { launch: { exitSpeed: 91, angle: 27, direction: -12 }, landing: { distance: 305 } } },
    { plateLocHeight: 1.8, plateLocSide: -0.4, hit: { launch: { exitSpeed: 74, angle: 9, direction: 18 }, landing: { distance: 118 } } },
  ]
  const pinSessions = [{
    sessionNumber: 1,
    swings: pinSwings,
    stats: { avgExitVelocity: 82.5, avgLaunchAngle: 18, inZoneCount: 2, totalSwings: 2 },
  }]
  // Slice 11 Task 3 replaced the old Note paragraph with the two approved
  // setting and sessions lines.
  const pinTop = `\n\n${SETTING_LINE}\n${SESSIONS_LINE}\n\nSession 1:\n- Avg Exit Velocity: 82.5 mph\n- Avg Launch Angle: 18 degrees\n- Pitches in strike zone: 2/2 (strike zone = height 1.5–3.5ft, side –0.7 to 0.7ft — full per-swing pitch coordinates included above)\n- Swings on pitches outside the strike zone: 0 swings\n- Swings on pitches high (height above 3.5ft): 0 swings\n- Swings on pitches low (height below 1.5ft): 0 swings\n- Swings on pitches wide (side outside -0.7 to 0.7ft): 0 swings\n`
  // Slice 10 added the three spray count lines here and reworded the direction
  // key. Swing 1 is -12 degrees (up the middle under the screen's own rule,
  // which is exactly the case the old "negative is pull side" wording got
  // wrong) and swing 2 is +18, opposite field.
  const pinTail = `- Top 3 exit velocities: 91, 74 mph\n- Distance distribution: Under 175ft: 1 swing, 175-225ft: 0 swings, 225-265ft: 0 swings, 265-305ft: 0 swings, 305+ft: 1 swing\n- Swings pull side (direction strictly below -15 degrees, not including -15): 0 swings\n- Swings up the middle (direction -15 to +15 degrees, including both): 1 swing — numbers: 1\n- Swings opposite field (direction strictly above +15 degrees, not including +15): 1 swing — numbers: 2\n- Direction key: below -15 degrees is pull side, above +15 degrees is opposite field, -15 to +15 is up the middle.\n- Individual swings: Swing 1: 91mph EV, 27° LA, -12° direction, 305ft distance, pitch height 2.1ft / pitch side 0.3ft | Swing 2: 74mph EV, 9° LA, 18° direction, 118ft distance, pitch height 1.8ft / pitch side -0.4ft\n\nCurrent session being debriefed: Session 1`

  it('renders the full debrief user message for a power session exactly as shipped', () => {
    const message = buildDebriefUserMessage({
      goal: { id: 'power', label: 'Power & Distance' },
      player: { firstName: 'Jake' },
      sessions: pinSessions,
      viewingSessionNumber: 1,
    })
    expect(message).toBe(
      `Player: Jake\nGoal: Power & Distance\n${goalContext({ id: 'power' })}${pinTop}- Swings with launch angle strictly below 15 degrees (not including 15): 1 swing — numbers: 2\n- Swings in power zone (EV >= 88 mph AND launch angle 25-35 degrees): 1 swing\n${pinTail}`,
    )
  })

  it('renders the full debrief user message for an allfields session with its own count lines', () => {
    const message = buildDebriefUserMessage({
      goal: { id: 'allfields', label: 'Hit to All Fields' },
      player: { firstName: 'Jake' },
      sessions: pinSessions,
      viewingSessionNumber: 1,
    })
    expect(message).toBe(
      `Player: Jake\nGoal: Hit to All Fields\n${goalContext({ id: 'allfields' })}${pinTop}- Swings pull side (direction strictly below -15 degrees, not including -15): 0 swings\n- Swings opposite field (direction strictly above +15 degrees, not including +15): 1 swing\n- Swings with exit velocity 82 mph or higher: 1 swing\n${pinTail}`,
    )
  })
})

// Slice 8b Task 6: the coach reliably repeats a count it is handed and
// miscounts anything it derives itself, so every threshold a goal's prompt
// prose names arrives pre-counted in the data block. Seven hand-checkable
// swings cover every boundary where an off-by-one would hide: 85 and 82 mph
// sit exactly on the two exit-velocity thresholds (counted, "or higher" is
// inclusive), 18 sits on contact's range edge (counted, the range includes
// both ends), 20 sits on the fly-ball cutoff and -15/+15 on the direction
// cutoffs (all excluded, matching the spray chart's own strict
// inequalities), and 35 sits on the pop-up cutoff (excluded there, but
// counted by Power's zone, whose range includes 35).
//
// The expected counts are literals, hand-derived from the fixture, for the
// same reason the target tests above use literals: a count computed by the
// test the same way the code computes it would pass no matter what.
describe('the count lines each goal is handed', () => {
  const countSwings = [
    { exitSpeed: 91, angle: 27, direction: -20 },
    { exitSpeed: 74, angle: 9, direction: 18 },
    { exitSpeed: 85, angle: 18, direction: -15 },
    { exitSpeed: 82, angle: 20, direction: 15 },
    { exitSpeed: 68, angle: 4, direction: -30 },
    { exitSpeed: 88, angle: 36, direction: 25 },
    { exitSpeed: 89, angle: 35, direction: 0 },
  ].map((launch, i) => ({
    plateLocHeight: 2.0,
    plateLocSide: 0.1,
    hit: { launch, landing: { distance: 150 + i } },
  }))
  const countSessions = [{
    sessionNumber: 1,
    swings: countSwings,
    stats: { avgExitVelocity: 82.4, avgLaunchAngle: 21.3, inZoneCount: 4, totalSwings: 7 },
  }]
  const messageFor = (goal) => buildDebriefUserMessage({
    goal,
    player: { firstName: 'Jake' },
    sessions: countSessions,
    viewingSessionNumber: 1,
  })

  it('power: keeps the shipped below-15 and power-zone lines, with swing numbers on below-15', () => {
    const message = messageFor({ id: 'power', label: 'Power & Distance' })
    expect(message).toContain('- Swings with launch angle strictly below 15 degrees (not including 15): 2 swings — numbers: 2, 5')
    expect(message).toContain('- Swings in power zone (EV >= 88 mph AND launch angle 25-35 degrees): 2 swings')
    expect(message).not.toContain('or higher')
    // Narrowed in Slice 10: "including both" now also appears in the universal
    // "up the middle" line every goal gets, so this checks for the goal count
    // line it was written about, not the two words.
    expect(message).not.toContain('launch angle in the target')
  })

  it('contact: counts the target range, hard contact, and fly balls', () => {
    const message = messageFor({ id: 'contact', label: 'Line Drives & Contact' })
    expect(message).toContain('- Swings with launch angle in the target 8-18 degrees (including both 8 and 18): 2 swings')
    expect(message).toContain('- Swings with exit velocity 85 mph or higher: 4 swings')
    expect(message).toContain('- Swings with launch angle strictly above 18 degrees (not including 18): 4 swings')
    expect(message).not.toContain('power zone')
    expect(message).not.toContain('below 15 degrees')
  })

  it('allfields: counts pull side, opposite field, and hard contact', () => {
    const message = messageFor({ id: 'allfields', label: 'Hit to All Fields' })
    expect(message).toContain('- Swings pull side (direction strictly below -15 degrees, not including -15): 2 swings')
    expect(message).toContain('- Swings opposite field (direction strictly above +15 degrees, not including +15): 2 swings')
    expect(message).toContain('- Swings with exit velocity 82 mph or higher: 5 swings')
    expect(message).not.toContain('power zone')
    expect(message).not.toContain('below 15 degrees')
  })

  it('popup: counts pop-ups, weak grounders, and the target range', () => {
    const message = messageFor({ id: 'popup', label: 'Reduce Pop-Ups' })
    expect(message).toContain('- Swings popped up (launch angle strictly above 35 degrees, not including 35): 1 swing')
    expect(message).toContain('- Swings hit as weak grounders (launch angle strictly below 5 degrees, not including 5): 1 swing')
    expect(message).toContain('- Swings with launch angle in the target 10-25 degrees (including both 10 and 25): 2 swings')
    expect(message).not.toContain('power zone')
    expect(message).not.toContain('below 15 degrees')
  })

  it('open: hands the coach no counts at all, and leaves no gap where they were', () => {
    const message = messageFor({ id: 'open', label: 'Open Session' })
    expect(message).not.toContain('power zone')
    expect(message).not.toContain('below 15 degrees')
    expect(message).not.toContain('or higher')
    // Both narrowed in Slice 10 for the same reason as the power test above:
    // the three universal spray count lines legitimately carry "including
    // both" and "strictly above", so these now name the launch-angle count
    // lines they were written about. Open still gets no GOAL count lines.
    expect(message).not.toContain('launch angle in the target')
    expect(message).not.toContain('launch angle strictly above')
    // The strike-zone summary now runs into the zone lines, and the last
    // zone line runs straight into the top-3 line, no blank line left behind
    // where the two shipped count lines used to sit.
    expect(message).toContain('full per-swing pitch coordinates included above)\n- Swings on pitches outside the strike zone:')
    expect(message).toContain('side outside -0.7 to 0.7ft): 0 swings\n- Top 3 exit velocities:')
  })
})

// Task 2, Slice 10: the below-15 line predates zoneCountLines and always
// appended "— numbers: ${list}" unconditionally, so a session with nothing
// under 15 degrees rendered a dangling "0 swings — numbers:" with nothing
// after the colon. zoneCountLines already guards on count four lines below;
// this brings the older line in line with it.
describe('the power below-15 line, on the dangling numbers clause', () => {
  const sessionFor = (swings) => [{
    sessionNumber: 1,
    swings,
    stats: { avgExitVelocity: 82, avgLaunchAngle: 22, inZoneCount: swings.length, totalSwings: swings.length },
  }]
  const messageFor = (swings) => buildDebriefUserMessage({
    goal: { id: 'power', label: 'Power & Distance' },
    player: { firstName: 'Jake' },
    sessions: sessionFor(swings),
    viewingSessionNumber: 1,
  })

  it('a session with nothing under 15 degrees ends the line at the count, no trailing numbers clause', () => {
    const swings = [
      { exitSpeed: 80, angle: 20, direction: 0 },
      { exitSpeed: 85, angle: 25, direction: 5 },
      { exitSpeed: 90, angle: 30, direction: -5 },
    ].map((launch, i) => ({
      plateLocHeight: 2.0,
      plateLocSide: 0.1,
      hit: { launch, landing: { distance: 150 + i } },
    }))
    const message = messageFor(swings)
    expect(message).toContain('- Swings with launch angle strictly below 15 degrees (not including 15): 0 swings\n')
    expect(message).not.toContain('below 15 degrees (not including 15): 0 swings — numbers:')
  })

  it('a session with some swings under 15 degrees is unchanged: count and numbers still print', () => {
    const angles = [20, 10, 22, 25, 30, 18, 5, 28, 33, 19, 12]
    const swings = angles.map((angle, i) => ({
      plateLocHeight: 2.0,
      plateLocSide: 0.1,
      hit: { launch: { exitSpeed: 75 + i, angle, direction: 0 }, landing: { distance: 150 + i } },
    }))
    const message = messageFor(swings)
    expect(message).toContain('- Swings with launch angle strictly below 15 degrees (not including 15): 3 swings — numbers: 2, 7, 11\n')
  })
})

// Slice 8c: the zone count lines every goal is handed, unconditionally, since
// the strike-zone summary line they extend is unconditional too. Before this,
// the coach was handed a total and the bounds but not which swings were
// outside, so it worked that out for itself and got it wrong.
describe('the strike-zone count lines every goal is handed', () => {
  const zoneSwings = [
    { plateLocHeight: 2.5, plateLocSide: 0.0 },
    { plateLocHeight: 3.6, plateLocSide: 0.2 },
    { plateLocHeight: 1.2, plateLocSide: -0.3 },
    { plateLocHeight: 2.8, plateLocSide: 0.9 },
    { plateLocHeight: 1.4, plateLocSide: -0.8 },
    { plateLocHeight: 3.5, plateLocSide: -0.7 },
  ].map((loc, i) => ({
    ...loc,
    hit: { launch: { exitSpeed: 80 + i, angle: 12, direction: 0 }, landing: { distance: 200 + i } },
  }))
  const zoneSessions = [{
    sessionNumber: 1,
    swings: zoneSwings,
    stats: { avgExitVelocity: 82.5, avgLaunchAngle: 12, inZoneCount: 2, totalSwings: 6 },
  }]

  it('names which swings were outside, and which way each pitch was off', () => {
    const message = buildDebriefUserMessage({
      goal: { id: 'open', label: 'Open Session' },
      player: { firstName: 'Jake' },
      sessions: zoneSessions,
      viewingSessionNumber: 1,
    })
    expect(message).toContain('- Swings on pitches outside the strike zone: 4 swings — numbers: 2, 3, 4, 5')
    expect(message).toContain('- Swings on pitches high (height above 3.5ft): 1 swing — numbers: 2')
    expect(message).toContain('- Swings on pitches low (height below 1.5ft): 2 swings — numbers: 3, 5')
    expect(message).toContain('- Swings on pitches wide (side outside -0.7 to 0.7ft): 2 swings — numbers: 4, 5')
  })
})

// Slice 11 Task 14b. The block above only ever asked the DEBRIEF prompt, and
// the chat prompt carried none of these four lines at all, which is the whole
// defect: asked in chat which pitches he chased, the coach named two in-zone
// pitches as chases, missed two real ones, and called four high pitches low.
// Same shape as the spray and direction-key blocks below, and the same reason:
// the coach repeats a count it is handed and miscounts one it derives. No new
// wording is introduced here; these four lines have shipped in the debrief
// prompt since Slice 8c.
describe('the strike-zone count lines the CHAT prompt is handed', () => {
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  const sessionOf = (swings) => ({
    sessionNumber: 1,
    stats: {
      avgExitVelocity: 80, avgLaunchAngle: 15,
      inZoneCount: swings.length, totalSwings: swings.length,
    },
    swings,
  })

  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  const debriefFor = (session) => capturedMessage(() =>
    generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
  )
  // The question Task 14's browser gate actually asked, which is the one that
  // produced the wrong answer twice out of two.
  const chatFor = (session) => capturedMessage(() =>
    sendChatMessage({
      goal, player, sessions: [session], viewingSessionNumber: 1,
      messages: [{ role: 'user', content: 'Which pitches did I chase?' }],
    }),
  )

  // Literals, hand-derived from the plate locations in src/sessionOneSwings.js
  // against the 1.5-3.5ft / -0.7 to 0.7ft strike zone, so this pins the shipped
  // sentence AND the shipped numbers rather than proving the prompt echoes
  // whatever the code happens to return. Swing 14 is both high and wide, which
  // is why the three sub-counts do not sum to the outside count.
  const OUTSIDE_LINE = '- Swings on pitches outside the strike zone: 6 swings — numbers: 2, 4, 6, 9, 12, 14'
  const HIGH_LINE = '- Swings on pitches high (height above 3.5ft): 2 swings — numbers: 6, 14'
  const LOW_LINE = '- Swings on pitches low (height below 1.5ft): 3 swings — numbers: 2, 9, 12'
  const WIDE_LINE = '- Swings on pitches wide (side outside -0.7 to 0.7ft): 2 swings — numbers: 4, 14'

  it('the chat prompt states all four, exactly, on session 1\'s real swings', async () => {
    const message = await chatFor(sessionOf(SESSION_ONE_SWINGS))
    expect(message).toContain(OUTSIDE_LINE)
    expect(message).toContain(HIGH_LINE)
    expect(message).toContain(LOW_LINE)
    expect(message).toContain(WIDE_LINE)
  })

  it('cannot drift apart: both prompts report the same four lines for the same swings', async () => {
    const session = sessionOf(SESSION_ONE_SWINGS)
    const debriefMessage = await debriefFor(session)
    const chatMessage = await chatFor(session)
    const extract = (text) => [
      text.match(/- Swings on pitches outside the strike zone[^\n]+/)[0],
      text.match(/- Swings on pitches high \([^\n]+/)[0],
      text.match(/- Swings on pitches low \([^\n]+/)[0],
      text.match(/- Swings on pitches wide \([^\n]+/)[0],
    ]
    expect(extract(chatMessage)).toEqual(extract(debriefMessage))
    // And they are the shared breakdown's numbers, not a third value.
    const zone = pitchZoneBreakdown(SESSION_ONE_SWINGS)
    expect(extract(chatMessage)[0]).toContain(`numbers: ${zone.outside.swings.join(', ')}`)
  })

  // Placement matters as much as presence: the debrief hangs these four off
  // its strike-zone summary line, and a reader comparing the two prompts
  // should find them in the same seat. Also the seat that keeps them next to
  // the in-zone total they break down.
  it('sits directly under the chat prompt\'s own In Zone line', async () => {
    const message = await chatFor(sessionOf(SESSION_ONE_SWINGS))
    expect(message).toContain(`swing outcome)\n${OUTSIDE_LINE}\n${HIGH_LINE}\n${LOW_LINE}\n${WIDE_LINE}\n`)
  })
})

// Slice 8b Task 6's other half: the two changes to DEBRIEF_SYSTEM_BASE the
// product manager approved verbatim on 18 August 2026, pinned character for
// character. The old worked example modeled exactly the failure the slice
// exists to remove: "two of those were your weakest swings" is the model
// counting for itself.
describe('the never-count rule and the recount-free worked example', () => {
  it('the tips example no longer models deriving a count', () => {
    expect(DEBRIEF_SYSTEM_BASE).toContain('(ex: You only hit to the opposite field on swings 9, 12, and 14, and swing 12 left the bat at just 83 mph.)')
    expect(DEBRIEF_SYSTEM_BASE).not.toContain('two of those were your weakest swings')
  })

  it('the Rules list forbids the coach counting for itself', () => {
    expect(DEBRIEF_SYSTEM_BASE).toContain('- Never count, total, or tally swings yourself. Use a count only if it appears in the session data. If no count is provided, describe the pattern without a number.')
  })
})

describe('reading the reason a failure carries', () => {
  // The five classification branches from the plan, each checked by reading
  // `reason` and `cold` off the CoachError callApi throws, not by string
  // matching a message.

  it('branch 1: an abort is classified timeout', async () => {
    const fetchMock = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Found by review: the deadline used to cover only the wait for headers.
  // clearTimeout sat in a finally around the fetch call alone, so once headers
  // arrived, reading the body had no deadline at all. These two pin that the
  // same AbortController now covers the body read too, for both the coach's
  // reply and the server's error envelope.

  it('the deadline covers reading a successful reply, not just the wait for headers', async () => {
    const fetchMock = vi.fn((_url, { signal }) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout', respondedOk: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('the deadline covers reading the server error envelope, not just the wait for headers', async () => {
    const fetchMock = vi.fn((_url, { signal }) => Promise.resolve({
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('branch 2: any other thrown error is classified unreachable', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
  })

  it('branch 3: a non-ok response with a server envelope uses its reason and cold verbatim', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => serverError(502, 'credits', true)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits', cold: true })
  })

  it('branch 4: a non-ok response with no usable envelope reads timeout off a 504 status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => null },
      json: async () => { throw new Error('not json') },
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('branch 4: a non-ok response with no usable envelope reads timeout off an x-vercel-error header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      headers: { get: (name) => (name === 'x-vercel-error' ? 'FUNCTION_INVOCATION_TIMEOUT' : null) },
      json: async () => ({}),
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('branch 4: a non-ok response with no usable envelope otherwise reads unreachable, and a bare string error does not crash it', async () => {
    // The older 400 caller-shape refusal answers { error: 'Invalid request' },
    // a string rather than the classified envelope object. Reading `.reason`
    // off a string must not throw and must not be mistaken for a real reason.
    vi.stubGlobal('fetch', vi.fn(async () => legacyInvalid(400)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
  })

  it('branch 5: an ok response with no text content is classified trouble', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
  })

  it('branch 5: an ok response that will not parse is classified trouble', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('I am afraid I cannot do that.')))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
  })

  // Found by review after this task's first pass: an ok response whose body is
  // not valid JSON at all (not even an unparseable coach reply, the envelope
  // itself) reached response.json() outside any try, so it threw a raw
  // SyntaxError with no `reason`. A caller switching on `.reason` would see
  // `undefined`, which is exactly the blank-screen failure this slice exists
  // to prevent.
  it('branch 5: an ok response whose body is not JSON at all is classified trouble, not a raw SyntaxError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token in JSON') },
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble', respondedOk: true })
  })

  // A null body reaches the same unguarded `.content` read and throws a raw
  // TypeError instead, for the same reason.
  it('branch 5: an ok response whose body is null is classified trouble, not a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => null })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble', respondedOk: true })
  })
})

describe('the retry policy: cheap failures repeat once, an already-spent wait never does', () => {
  it('does not retry when the first attempt works', async () => {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)

    await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries for unreachable: the fetch never reached the server', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('retries for trouble: the server answered quickly with an error, not a good reply', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(serverError(502, 'trouble'))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('does not retry credits on a cold instance either, because a dry balance is not a waking-up problem', async () => {
    // This test used to assert the opposite, and the opposite was wrong. Cold is
    // the ordinary state of a stranger's first click, and a drained balance is
    // the failure this whole slice exists to report honestly. Retrying it told
    // the visitor "Trying once more" for something a second try can never fix.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(serverError(502, 'credits', true))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits', cold: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a cold timeout either, so cold changes no answer the reason had not already given', async () => {
    // The other half of why cold is not consulted at all: every reason it could
    // have flipped either must not retry (credits, timeout) or already retries
    // without it (unreachable, trouble).
    const fetchMock = vi.fn(async () => serverError(504, 'timeout', true))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry timeout: the visitor already waited the whole budget', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => null },
      json: async () => ({}),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('trap: does not retry timeout even when cold is also set, because timeout wins', async () => {
    const fetchMock = vi.fn(async () => serverError(504, 'timeout', true))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout', cold: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry credits: reloading the balance is not something a second try fixes', async () => {
    const fetchMock = vi.fn(async () => serverError(502, 'credits', false))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('trap: does not retry a parse failure that followed a successful response, because that attempt already spent its full wait', async () => {
    const fetchMock = vi.fn(async () => ok('I am afraid I cannot do that.'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Found by the whole-branch review. The ceiling used to rest on an assumption
  // stated in a comment: that everything retryable "answered quickly." Nothing
  // in the code held it. A degraded Anthropic answering 529 at 35 seconds is a
  // server-classified 'trouble', and it bought a second attempt with a fresh
  // full deadline, so the roughly 50 second promise quietly became roughly 90.
  // The budget below is the same promise made structural: one wall clock for
  // the whole call, spent down by each attempt.

  it('a trouble that took 35 seconds does not buy a second full wait', async () => {
    const startedAt = Date.now()
    let finishedAt = null

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve(serverError(502, 'trouble')), 35000)
      }))
      .mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    const settled = promise.then(
      () => { finishedAt = Date.now() },
      () => { finishedAt = Date.now() },
    )
    await vi.advanceTimersByTimeAsync(4 * REQUEST_TIMEOUT_MS)
    await settled

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(finishedAt - startedAt).toBeLessThanOrEqual(REQUEST_TIMEOUT_MS)
  })

  it('does not start a second attempt with almost none of the budget left', async () => {
    // A retry here could not finish before the ceiling anyway, so all it would
    // buy the visitor is a longer silence before the same honest message.
    const onRetry = vi.fn()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve(serverError(502, 'trouble')), 49000)
      }))
      .mockResolvedValue(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] }, { onRetry })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(4 * REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'trouble' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('tells the caller a retry is happening, and what it is retrying for', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith({ reason: 'unreachable', cold: false })
  })

  it('does not announce a retry that never happened', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('gives up after the second failure rather than retrying forever', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('genuinely dead') })
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('survives a caller that passes no options at all', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await expect(run(() => callApi({ messages: [] }))).resolves.toEqual({})
  })

  it('every CoachError thrown is an instance callers can check with instanceof', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => serverError(502, 'credits', false)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toBeInstanceOf(CoachError)
  })

  // A note on the ceiling tests above, because an earlier version of this file
  // got them wrong twice and the second mistake is the instructive one.
  //
  // The first attempt mocked two instant fetches, advanced 1500ms, and asserted
  // the resolved result, which was 'retries for unreachable' under a grander
  // name. It would have passed no matter what REQUEST_TIMEOUT_MS was.
  //
  // It was replaced by an argument rather than a test: that a timeout is the
  // only failure that can spend the whole budget, and it never retries, so
  // everything else must fail fast. The whole-branch review found the hole. A
  // server-classified 'trouble' can take 35 seconds to arrive and still retry,
  // so "fails fast" was an assumption about Anthropic's behavior, not a
  // property of this code. The two tests above measure the clock instead of
  // reasoning about it, which is why they could go red and the argument could
  // not.
})

describe('unwrapping what the model actually returns', () => {
  it('parses a bare JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"coachingSummary":"nice swing"}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ coachingSummary: 'nice swing' })
  })

  it('strips a ```json fence, which the model adds unpredictably', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```json\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('strips a fence with prose in front of it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Here you go:\n\n```json\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('throws a recognizable error when the response holds no text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) })))
    await expect(run(() => callApi({}))).rejects.toThrow('No text content in API response')
  })

  it('throws a recognizable error when the text is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('I am afraid I cannot do that.')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })

  // ── Fixed in Slice 4 ──────────────────────────────────────────────────────
  // The two cases below used to be thrown away. Both surfaced to the player as a
  // connection error, which was wrong on the facts: the connection worked, the
  // model answered, and the answer was discarded on the way in. On the debrief
  // that was the full "coach unavailable" screen; in chat it was "Sorry, I
  // couldn't connect right now."

  it('reads a fence with no json tag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('reads a fence with no json tag and prose in front of it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Sure thing:\n\n```\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('keeps a literal fence that is part of the coach message, rather than truncating there', async () => {
    // The coach may quote a code fence inside its own answer. That is content,
    // not a wrapper, and everything after it used to be discarded.
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"note":"use ``` for code","after":1}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ note: 'use ``` for code', after: 1 })
  })

  it('keeps a literal fence inside a value that is itself wrapped in a fence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```json\n{"note":"use ``` for code"}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ note: 'use ``` for code' })
  })

  it('reads the real shape of a chat reply, fence and all', async () => {
    const reply = '```json\n{"message":"Nice work.","chart":"trend_ev"}\n```'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'Nice work.', chart: 'trend_ev' })
  })

  // Found by an independent review of Slice 4, before merge. The first version of
  // the fix read the reply as it stood and then fell back to the outermost
  // braces, which quietly regressed two cases the old regex did handle: a brace
  // anywhere in the prose around the fence dragged the slice past the JSON. The
  // coach writes prose for a living, so a stray brace in a friendly closing
  // sentence is not exotic, and it would have reached the player as a connection
  // error.

  it('reads a fenced reply with prose after the closing fence', async () => {
    const reply = '```json\n{"message":"ok"}\n```\nWant the {spray} chart too?'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'ok' })
  })

  it('reads a fenced reply with a brace in the prose before it', async () => {
    const reply = 'Quick note {see below}:\n```json\n{"message":"ok"}\n```'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'ok' })
  })

  it('reads a bare object with a sentence in front of it and no fence at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Here you go: {"a":1}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('reads the answer when the reply carries a third fence after it', async () => {
    // The fence match is greedy to the last fence, so a trailing code sample
    // swallows the real closing fence. The braces inside the block still find it.
    const reply = '```json\n{"a":1}\n```\nAlso ```code``` if you want it.'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('refuses a reply that opens an object and never closes it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"a":1')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })

  it('still refuses prose that only looks like an answer', async () => {
    // The point of the fix is to stop discarding real answers, not to start
    // accepting things that are not answers.
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\nI am afraid I cannot do that.\n```')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })
})

// Task 4 of the honest-ball-flight slice: the debrief prompt and the chat
// prompt both used to write out the same 160-220/220-260/260-300/300-340/340+
// filter logic by hand, tuned to the old dishonest carry formula. The chat
// prompt is the one CLAUDE.md names as "easy to miss" — Slice 4's chart-slot
// validation had exactly this failure once already. These tests read the
// actual text callApi sends, not a copy of the buckets, so a hand-written
// range creeping back into either prompt fails here.
describe('the distance distribution both prompts describe', () => {
  // src/sessionOneSwings.js's SESSION_ONE_SWINGS distances, the hand-written
  // session 1 every visitor opens on. Updated 19 August 2026, in Slice 9,
  // when those fifteen swings were rewritten; see the header comment in
  // src/sessionOneSwings.js for why. This stays an independent literal
  // rather than an import, proving these specific numbers still write the
  // right sentence rather than proving only that the module re-exports
  // whatever it currently holds.
  //
  // AND ONE CROSS-CHECK, ADDED 21 AUGUST 2026, WHICH IS THE PRICE OF KEEPING
  // THE LITERAL. The reasoning above stands and this array stays a literal.
  // What it did not cover is the failure that actually happened: when Slice 9
  // replaced all fifteen swings, this block kept its old numbers and stayed
  // green, so for a while it was pinning the sentence the coach reads about a
  // session the app no longer had. The single assertion below holds the
  // literal against what SESSION_ONE_SWINGS really contains, so the next
  // rewrite of session 1 turns this file red rather than quietly making it
  // meaningless. Everything under it still runs off the literal.
  const mockDistances = [272, 122, 192, 159, 346, 249, 246, 266, 201, 219, 229, 117, 311, 204, 156]
  const swings = mockDistances.map((distance) => ({
    plateLocHeight: 2.5,
    plateLocSide: 0,
    hit: {
      launch: { exitSpeed: 80, angle: 15, direction: 0 },
      landing: { distance },
    },
  }))
  const session = {
    sessionNumber: 1,
    stats: { avgExitVelocity: 80, avgLaunchAngle: 15, inZoneCount: 10, totalSwings: 15 },
    swings,
  }
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  it('is still the fifteen distances session 1 actually holds', () => {
    expect(mockDistances).toEqual(SESSION_ONE_SWINGS.map((w) => w.hit.landing.distance))
  })

  // Runs a real call through callApi with fetch stubbed, and hands back the
  // exact user-message text that was about to leave the browser.
  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  it('the debrief prompt states the exact five-bucket distribution', async () => {
    const message = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    // Hardcoded rather than built from distanceDistributionLine, so this does
    // not just prove the prompt echoes whatever that function currently
    // returns — it proves the buckets are actually the ones the plan chose.
    expect(message).toContain(
      'Distance distribution: Under 175ft: 4 swings, 175-225ft: 4 swings, 225-265ft: 3 swings, 265-305ft: 2 swings, 305+ft: 2 swings',
    )
  })

  it('the chat prompt — the copy that is easy to miss — states the identical distribution', async () => {
    const message = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    expect(message).toContain(
      'Distance distribution: Under 175ft: 4 swings, 175-225ft: 4 swings, 225-265ft: 3 swings, 265-305ft: 2 swings, 305+ft: 2 swings',
    )
  })

  it('cannot drift apart: the debrief prompt and the chat prompt report the same sentence for the same swings', async () => {
    const debriefMessage = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chatMessage = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    const extract = (text) => text.match(/Distance distribution: [^\n]+/)[0]
    expect(extract(debriefMessage)).toBe(extract(chatMessage))
    // Also matches the function both prompts actually call, confirming the
    // request that left the browser is not some third, independent value.
    expect(extract(debriefMessage)).toBe(`Distance distribution: ${distanceDistributionLine(swings)}`)
  })
})

// The coach is handed each swing's spray direction as a raw signed number and,
// on five of the six goals, nothing tells it which sign means which way. A live
// Power debrief called a +29 degree ball (opposite field) "driven to the pull
// side." This line hands the coach the convention directly. Mirrors the
// distance-distribution block above: a debrief assertion, a chat assertion, and
// a cannot-drift-apart test, plus an adjacency check because the fact is only
// useful sitting right next to the per-swing data it explains.
describe('the direction key both prompts state', () => {
  const swings = [{
    plateLocHeight: 2.5,
    plateLocSide: 0,
    hit: {
      launch: { exitSpeed: 80, angle: 15, direction: 0 },
      landing: { distance: 200 },
    },
  }]
  const session = {
    sessionNumber: 1,
    stats: { avgExitVelocity: 80, avgLaunchAngle: 15, inZoneCount: 1, totalSwings: 1 },
    swings,
  }
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  it('the debrief prompt states the exact direction key line', async () => {
    const message = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(message).toContain(
      '- Direction key: below -15 degrees is pull side, above +15 degrees is opposite field, -15 to +15 is up the middle.',
    )
  })

  it('the chat prompt — the copy that is easy to miss — states the identical direction key', async () => {
    const message = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    expect(message).toContain(
      '- Direction key: below -15 degrees is pull side, above +15 degrees is opposite field, -15 to +15 is up the middle.',
    )
  })

  it('cannot drift apart: the debrief prompt and the chat prompt state the same direction key line, and both equal the exported constant', async () => {
    const debriefMessage = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chatMessage = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    const extract = (text) => text.match(/- Direction key: [^\n]+/)[0]
    expect(extract(debriefMessage)).toBe(extract(chatMessage))
    expect(extract(debriefMessage)).toBe(DIRECTION_KEY_LINE)
  })

  it('sits immediately above the Individual swings line in both prompts', async () => {
    const debriefMessage = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chatMessage = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    const adjacency = `${DIRECTION_KEY_LINE}\n- Individual swings:`
    expect(debriefMessage).toContain(adjacency)
    expect(chatMessage).toContain(adjacency)
  })
})

// Slice 10 Task 7. The browser QA gate caught the app holding two definitions
// of pull at once: the coach was handed "negative direction is pull side" and
// named six pull-side swings, while the spray chart beside it coloured the
// three below -15 and called the other three Center. Both were right by their
// own rule. These lines hand the coach the screen's own rule, pre-counted, so
// it never has to decide for itself which swings went where.
//
// Same three-part shape as the two blocks above (debrief, chat, cannot drift),
// because the chat prompt is the one that gets missed, and it is where the
// product manager actually saw the defect.
describe('the spray count lines both prompts state', () => {
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  const sessionOf = (swings) => ({
    sessionNumber: 1,
    stats: {
      avgExitVelocity: 80, avgLaunchAngle: 15,
      inZoneCount: swings.length, totalSwings: swings.length,
    },
    swings,
  })

  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  const debriefFor = (session, forGoal = goal) => capturedMessage(() =>
    generateDebrief({ goal: forGoal, player, sessions: [session], viewingSessionNumber: 1 }),
  )
  const chatFor = (session, forGoal = goal) => capturedMessage(() =>
    sendChatMessage({
      goal: forGoal, player, sessions: [session], viewingSessionNumber: 1,
      messages: [{ role: 'user', content: 'Which ones did I pull?' }],
    }),
  )

  // The three lines as the product manager approved them on 20 August 2026,
  // against session 1's real fifteen swings. Literals, hand-derived from the
  // directions in src/sessionOneSwings.js (pull: -24, -22, -20; oppo: 29, 24,
  // 21, 17; the other eight between), so this proves the shipped sentence and
  // the shipped numbers, not that the prompt echoes whatever the code returns.
  const PULL_LINE = '- Swings pull side (direction strictly below -15 degrees, not including -15): 3 swings — numbers: 3, 7, 15'
  const MIDDLE_LINE = '- Swings up the middle (direction -15 to +15 degrees, including both): 8 swings — numbers: 1, 2, 4, 6, 10, 11, 13, 14'
  const OPPO_LINE = '- Swings opposite field (direction strictly above +15 degrees, not including +15): 4 swings — numbers: 5, 8, 9, 12'

  it('the debrief prompt states all three, exactly, on session 1\'s real swings', async () => {
    const message = await debriefFor(sessionOf(SESSION_ONE_SWINGS))
    expect(message).toContain(PULL_LINE)
    expect(message).toContain(MIDDLE_LINE)
    expect(message).toContain(OPPO_LINE)
  })

  it('the chat prompt (where the defect was actually seen) states the identical three', async () => {
    const message = await chatFor(sessionOf(SESSION_ONE_SWINGS))
    expect(message).toContain(PULL_LINE)
    expect(message).toContain(MIDDLE_LINE)
    expect(message).toContain(OPPO_LINE)
  })

  it('cannot drift apart: both prompts report the same three lines for the same swings', async () => {
    const session = sessionOf(SESSION_ONE_SWINGS)
    const debriefMessage = await debriefFor(session)
    const chatMessage = await chatFor(session)
    const extract = (text) => [
      text.match(/- Swings pull side \([^\n]+/)[0],
      text.match(/- Swings up the middle \([^\n]+/)[0],
      text.match(/- Swings opposite field \([^\n]+/)[0],
    ]
    expect(extract(debriefMessage)).toEqual(extract(chatMessage))
    // And the swing numbers are the shared breakdown's, not a third value.
    const spray = sprayBreakdown(SESSION_ONE_SWINGS)
    expect(extract(debriefMessage)[0]).toContain(`numbers: ${spray.pull.swings.join(', ')}`)
  })

  // The same guard Task 2 put on the power below-15 line: a count of zero ends
  // at the count, with no colon left hanging over nothing.
  it('a bucket with nothing in it ends at the count, no dangling numbers clause', async () => {
    const noPulls = [11, 0, 24].map((direction) => ({
      plateLocHeight: 2.5,
      plateLocSide: 0,
      hit: { launch: { exitSpeed: 80, angle: 15, direction }, landing: { distance: 200 } },
    }))
    const message = await debriefFor(sessionOf(noPulls))
    expect(message).toContain('- Swings pull side (direction strictly below -15 degrees, not including -15): 0 swings\n')
    expect(message).not.toContain('not including -15): 0 swings — numbers:')
    // And a bucket of exactly one reads "1 swing", not "1 swings".
    expect(message).toContain('- Swings opposite field (direction strictly above +15 degrees, not including +15): 1 swing — numbers: 3')
  })

  // Every swing goes somewhere, and nowhere twice: three counts, one session.
  // Run over a generated session as well as the hand-written one, because the
  // generator is where a direction the buckets do not cover would come from.
  it('the three counts sum to the session, on generated sessions as well as session 1', async () => {
    const countsIn = (message) => [
      /- Swings pull side \([^:]+: (\d+) swings?/,
      /- Swings up the middle \([^:]+: (\d+) swings?/,
      /- Swings opposite field \([^:]+: (\d+) swings?/,
    ].map((re) => Number(message.match(re)[1]))

    expect(countsIn(await debriefFor(sessionOf(SESSION_ONE_SWINGS))).reduce((a, b) => a + b)).toBe(15)

    // A fixed sequence rather than Math.random, so a failure here is
    // reproducible instead of a coin flip nobody can rerun.
    let seed = 7
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    let pooledPull = 0
    let pooledOppo = 0
    for (const sessionNum of [2, 3, 4]) {
      const swings = generateSwings({
        sessionNum, goalId: 'power', baselineSwings: SESSION_ONE_SWINGS, random,
      })
      const [pull, middle, oppo] = countsIn(await debriefFor(sessionOf(swings)))
      expect(pull + middle + oppo).toBe(swings.length)
      pooledPull += pull
      pooledOppo += oppo
    }

    // Summing to the total is satisfied trivially by a classifier that puts
    // every ball up the middle and never fires the other two, so check the
    // outer buckets are actually populated on real generated data.
    //
    // POOLED ACROSS THE THREE SESSIONS RATHER THAN ASKED OF EACH ONE, changed
    // 21 August 2026 in Slice 11, and the reason is what this comment is for.
    // Asked of each session, this was a statistical claim resting on one fixed
    // draw sequence: any change to the ORDER the generator pulls its numbers in
    // reshuffles which swing gets which direction, and a fifteen-swing session
    // holds no pull-side ball about one time in fifty by luck alone. Slice 11
    // moved the pitch draw to the front of every swing and session 3 duly came
    // out with its hardest pull at exactly -15, one degree short of the bucket,
    // while every count in this test still summed correctly. That is the second
    // slice to reorder these draws, and Slice 11 is not finished doing it.
    //
    // Pooling makes the assertion about the hitter rather than about the seed:
    // across forty-five generated swings a hitter who never once pulls a ball
    // is a real defect in the generator or the buckets, which is what this
    // check was always meant to catch. The per-session assertion above is
    // untouched and exactly as strong as it was, because that one is what this
    // test is named for.
    expect(pooledPull).toBeGreaterThan(0)
    expect(pooledOppo).toBeGreaterThan(0)
  })

  // The disagreement that caused the defect, one layer up from the unit test
  // in goalCountSpecs.test.js: on the one goal that states its own pull and
  // oppo counts, the goal's line and the universal line are two sentences in
  // one prompt, and they must carry the same number.
  it('the Hit to All Fields count lines and the universal ones report the same pull and oppo numbers', async () => {
    const message = await debriefFor(
      sessionOf(SESSION_ONE_SWINGS),
      { id: 'allfields', label: 'Hit to All Fields' },
    )
    const counts = (label) => [...message.matchAll(
      new RegExp(`- Swings ${label} \\([^:]+: (\\d+) swings?`, 'g'),
    )].map((m) => Number(m[1]))
    // Two lines each: the goal's own, and the universal one.
    expect(counts('pull side')).toEqual([3, 3])
    expect(counts('opposite field')).toEqual([4, 4])
  })
})

// The bench that picked budget B measured DEBRIEF_SYSTEM_BASE plus condition
// B's wording, not the prompt this app actually sends. These two tests are
// what keeps that true after this file ships: one holds the shipped prompt to
// exactly base-plus-budget so nobody can slip a change into either half
// without the other noticing, and the other holds the shipped budget to the
// exact numbers the product manager picked (45/30/12/50), so a future edit
// that quietly reaches for a different set of numbers is caught here rather
// than by someone re-reading the bench output from three weeks ago.
describe('the length budget the coach was shipped with', () => {
  // Updated in Slice 15, and the update is itself the record of this test
  // doing its job: adding the number-slot instruction to the shipped constant
  // turned this red, which is exactly the one kind of drift CLAUDE.md says it
  // can catch (something appended to or inlined into the shipped constant
  // instead of built from its pieces). The composition is now three parts.
  it('DEBRIEF_SYSTEM is exactly the base prompt, the shipped budget and the number-slot instruction', () => {
    expect(DEBRIEF_SYSTEM).toBe(`${DEBRIEF_SYSTEM_BASE}\n\n${DEBRIEF_BUDGET}\n\n${NUMBER_SLOT_LINES}`)
  })

  it('the shipped budget names all four fields at the numbers the bench picked', () => {
    expect(DEBRIEF_BUDGET).toContain('coachingSummary: 45 words maximum.')
    expect(DEBRIEF_BUDGET).toContain('whatThisMeans: 30 words maximum.')
    expect(DEBRIEF_BUDGET).toContain('tipsIntro: 12 words maximum.')
    expect(DEBRIEF_BUDGET).toContain('each tip in nextSessionTips: 50 words maximum.')
  })
})

// Slice 7b's pivot, Task 9: session 1 has no prior session to compare
// against, and the prompt used to give the model no instruction at all for
// that case, only what to do "if multiple sessions are provided." The
// diagnosed failure (7 of 10 session-1 debriefs writing a long analysis and
// running into the hard 4096-token ceiling) is model behaviour, which is the
// bench's job to measure, not the suite's. Slice 7b shipped two candidate
// fixes for that failure: a single-session instruction telling the model not
// to look for trends, and a strengthened instruction that the reply must
// start with the JSON object. An isolation experiment on 17 August 2026 (12
// live session-1 calls with only the JSON-first instruction in place) found
// the single-session instruction was dead weight: 0 of 12 hit the ceiling
// with it removed. It was deleted from the shipped prompt the same day. What
// the suite pins now is only the instruction the experiment showed actually
// does the work, plus the cross-session comparison instruction, which the
// product manager has confirmed is desired behaviour and was never in
// question.
describe('the JSON-first instruction that fixed the session-1 MAX_TOKENS bug', () => {
  it('still tells the model to compare when multiple sessions are provided', () => {
    expect(DEBRIEF_SYSTEM_BASE).toContain('If multiple sessions are provided, compare the current session to prior sessions')
  })

  it('does not carry the single-session instruction the isolation experiment showed was unnecessary', () => {
    expect(DEBRIEF_SYSTEM_BASE).not.toContain('If this is the only session provided')
  })

  it('tells the model its reply must start with the JSON object, not analysis first', () => {
    expect(DEBRIEF_SYSTEM_BASE).toContain('Do not write any analysis, reasoning, or commentary before it')
  })
})

// Slice 11 Task 3. The old Note paragraph told the coach these were
// consecutive practice rounds, but said nothing about who is throwing, so a
// pitch that misses the zone reads to the coach as a mistake worth reasoning
// about rather than a live thrower varying his location. The two approved
// lines below replace that paragraph in the debrief prompt and, for the
// first time, reach the chat prompt too, closing a gap where the chat coach
// could say "yesterday" with nothing stopping it. Same three-part shape as
// the direction key block above (debrief, chat, cannot drift), plus a fourth
// check that the old paragraph is actually gone, since this change can
// half-land and leave both versions in the prompt at once.
describe('the setting and sessions lines both prompts state', () => {
  const swings = [{
    plateLocHeight: 2.5,
    plateLocSide: 0,
    hit: {
      launch: { exitSpeed: 80, angle: 15, direction: 0 },
      landing: { distance: 200 },
    },
  }]
  const session = {
    sessionNumber: 1,
    stats: { avgExitVelocity: 80, avgLaunchAngle: 15, inZoneCount: 1, totalSwings: 1 },
    swings,
  }
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  it('the debrief prompt states both exact lines', async () => {
    const message = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(message).toContain(
      '- Setting: a coach throws live from behind a screen, so pitch locations vary. Coach the player\'s swing decisions; never guess at the thrower\'s intent.',
    )
    expect(message).toContain(
      '- Sessions: consecutive rounds in one continuous practice period. Refer to them by number, never "today" or "yesterday." Do not imply this is the final session unless it is Session 4.',
    )
  })

  it('the chat prompt (which carries no setting note at all today) states both exact lines too', async () => {
    const message = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    expect(message).toContain(
      '- Setting: a coach throws live from behind a screen, so pitch locations vary. Coach the player\'s swing decisions; never guess at the thrower\'s intent.',
    )
    expect(message).toContain(
      '- Sessions: consecutive rounds in one continuous practice period. Refer to them by number, never "today" or "yesterday." Do not imply this is the final session unless it is Session 4.',
    )
  })

  it('cannot drift apart: the debrief prompt and the chat prompt state the same two lines, and both equal the exported constants', async () => {
    const debriefMessage = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chatMessage = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    const extractSetting = (text) => text.match(/- Setting: [^\n]+/)[0]
    const extractSessions = (text) => text.match(/- Sessions: [^\n]+/)[0]
    expect(extractSetting(debriefMessage)).toBe(extractSetting(chatMessage))
    expect(extractSessions(debriefMessage)).toBe(extractSessions(chatMessage))
    expect(extractSetting(debriefMessage)).toBe(SETTING_LINE)
    expect(extractSessions(debriefMessage)).toBe(SESSIONS_LINE)
  })

  it('the debrief prompt no longer carries the old Note paragraph the two lines replaced', async () => {
    const message = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(message).not.toContain('Note: All sessions shown here are consecutive rounds of batting practice')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Slice 15: the app writes the coach's per-swing numbers
// ─────────────────────────────────────────────────────────────────────────────
describe('the number-slot instruction and the filling that backs it', () => {
  const goal = { id: 'power', label: 'Power & Distance' }
  const player = { firstName: 'Jake' }
  const swing = (ev, la, dir, dist, ht, side) => ({
    hit: { launch: { exitSpeed: ev, angle: la, direction: dir }, landing: { distance: dist } },
    plateLocHeight: ht,
    plateLocSide: side,
  })
  const session = {
    sessionNumber: 1,
    swings: [swing(86, 22, -22, 272, 2.8, 0.2), swing(72, 8, 5, 122, 1.24, -0.3)],
    stats: { avgExitVelocity: 79, avgLaunchAngle: 15, inZoneCount: 2, totalSwings: 2 },
  }

  const okRes = (text) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ content: [{ text }] }),
  })

  async function systemFor(sendCall) {
    const fetchMock = vi.fn(async () => okRes('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await sendCall().catch(() => {})
    return JSON.parse(fetchMock.mock.calls[0][1].body).system
  }

  async function replyWith(text, sendCall) {
    vi.stubGlobal('fetch', vi.fn(async () => okRes(text)))
    return sendCall()
  }

  it('reaches the debrief prompt', async () => {
    expect(await systemFor(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )).toContain(NUMBER_SLOT_LINES)
  })

  // The DIRECTION_KEY_LINE precedent. This project has watched a shared rule
  // live in several copies with the chat prompt as the one that kept getting
  // missed, and the last two browser QA gates both caught a defect in the chat
  // coach specifically.
  it('reaches the chat prompt too', async () => {
    expect(await systemFor(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'Which ones did I pull?' }],
      }),
    )).toContain(NUMBER_SLOT_LINES)
  })

  it('is the same string in both, so the two cannot drift apart', async () => {
    const debrief = await systemFor(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chat = await systemFor(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'Which ones did I pull?' }],
      }),
    )
    const extract = (t) => t.slice(t.indexOf("WRITING A SPECIFIC SWING'S NUMBERS."))
    expect(extract(debrief)).toBe(extract(chat))
    expect(extract(debrief)).toBe(NUMBER_SLOT_LINES)
  })

  // The end-to-end claim, and the one that makes this slice worth anything: a
  // figure the coach hands over comes back as the real value, not as whatever
  // the model would have typed.
  it('fills a debrief slot with the real value before the caller ever sees it', async () => {
    const reply = await replyWith(
      JSON.stringify({
        coachingSummary: 'Swing 1 came off at {{s1.sw1.ev}} mph.',
        whatThisMeans: 'Real bat speed.',
        tipsIntro: 'Two things.',
        nextSessionTips: ['Swing 2 sat at {{s1.sw2.la}} degrees on a pitch at {{s1.sw2.ht}} feet.'],
        charts: ['scatter_ev_la', 'trend_ev'],
      }),
      () => generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(reply.coachingSummary).toBe('Swing 1 came off at 86 mph.')
    // And the pitch height is rounded the way a coach writes it, not dumped at
    // the two decimals the generator stores.
    expect(reply.nextSessionTips[0]).toBe('Swing 2 sat at 8 degrees on a pitch at 1.2 feet.')
  })

  it('fills a chat slot too', async () => {
    const reply = await replyWith(
      JSON.stringify({ message: 'Swing 1 went {{s1.sw1.dist}} feet.', chart: null }),
      () => sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'How far did swing 1 go?' }],
      }),
    )
    expect(reply.message).toBe('Swing 1 went 272 feet.')
  })

  // A transposition has nowhere to happen once each slot carries its own swing
  // number. This is the single most common transcription error this slice
  // exists to remove, so it is pinned end to end rather than only in the unit.
  it('cannot transpose a pair, because each slot names its own swing', async () => {
    const reply = await replyWith(
      JSON.stringify({
        coachingSummary: 'Swings 1 and 2 hit {{s1.sw1.ev}} and {{s1.sw2.ev}} mph.',
        whatThisMeans: 'x', tipsIntro: 'y', nextSessionTips: ['z'], charts: ['trend_ev', 'bar_distance'],
      }),
      () => generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(reply.coachingSummary).toBe('Swings 1 and 2 hit 86 and 72 mph.')
  })

  it('drops a sentence naming a swing that does not exist rather than showing the braces', async () => {
    const reply = await replyWith(
      JSON.stringify({
        coachingSummary: 'Swing 1 hit {{s1.sw1.ev}} mph. Swing 9 hit {{s1.sw9.ev}} mph.',
        whatThisMeans: 'x', tipsIntro: 'y', nextSessionTips: ['z'], charts: ['trend_ev', 'bar_distance'],
      }),
      () => generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    expect(reply.coachingSummary).toBe('Swing 1 hit 86 mph.')
    expect(reply.coachingSummary).not.toContain('{{')
  })
})
