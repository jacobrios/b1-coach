import { goalTarget, meetsTarget } from './goalTargets'
import { distanceDistributionLine } from './ballFlight'
import { GOAL_COUNT_SPECS, goalCountValues } from './goalCountSpecs'
import { swingCountPhrase } from './promptText'

// Re-exported so everything that already reads this file's prompt exports
// (the bench, tests, and Task 6's count lines) finds the threshold table
// here too. It is defined in its own module, src/goalCountSpecs.js, because
// the grader's fact sheet must import it from a plain Node script that
// cannot resolve this file's extensionless imports; the comment there has
// the full reasoning.
export { GOAL_COUNT_SPECS } from './goalCountSpecs'

// These two are ALSO pinned at the top of api/coach.js, deliberately, and must be
// kept in step. Production ignores whatever is sent here and uses its own copy.
// These values are what local development actually runs on, because npm run dev
// never touches api/coach.js: vite.config.js proxies /api/coach straight to
// api.anthropic.com, which requires both fields in the body. Change one place
// without the other and local development quietly tests a different model than
// production ships.
// Exported only so the eval bench under scripts/ runs the model and the length
// ceiling production runs. A bench that quietly benchmarked a different model
// would produce numbers that look like evidence and are not.
export const MODEL = 'claude-sonnet-4-6'
export const MAX_TOKENS = 4096

// The coaching context for one goal, in the coach's own words.
//
// The prose is hand-written and stays that way; every number inside it is
// interpolated from a shared source. The target numbers come from
// goalTargets.js, so the coach, the goal cards and the charts cannot promise
// the player three different things. The rest (the pull and opposite-field
// direction cutoffs, the 82 mph that describes hard contact, the fly-ball,
// pop-up and grounder edges) moved to GOAL_COUNT_SPECS in Slice 8b, so a
// sentence naming a threshold and the pre-computed count that will feed it
// (Task 6) read the same number and cannot drift.
//
// One copy, used by both the debrief prompt and the chat prompt. This block used
// to be written out twice, verbatim, which is half of how the numbers drifted.
export function goalContext(goal) {
  const target = goalTarget(goal?.id)
  switch (goal?.id) {
    case 'power':
      // Was "the conditions for home run distance contact" until Slice 6 gave
      // distance an honest carry curve; at these numbers that is now a
      // warning-track flyball, not a home run, and the wrong word would sit
      // right next to a chart proving it wrong. Describes best contact instead,
      // which stays true regardless of how far the curve says the ball goes.
      return `Goal context: target launch angle ${target.launchAngle.min}-${target.launchAngle.max} degrees, target exit velocity ${target.exitVelocity}+ mph. These are the conditions for the player's best contact.`
    case 'contact':
      return `Goal context: target launch angle ${target.launchAngle.min}-${target.launchAngle.max} degrees for true line drives, target exit velocity ${target.exitVelocity}+ mph for hard contact. Angles above ${GOAL_COUNT_SPECS.contact.flyBallAngle} degrees are fly balls, not line drives.`
    case 'allfields':
      // oppoDirection interpolates behind a literal "+" because the shipped
      // prose writes the cutoff as "+15"; pullDirection is negative and
      // prints its own sign.
      return `Goal context: goal is meaningful contact to all three zones — at least 3 swings pull side (direction below ${GOAL_COUNT_SPECS.allfields.pullDirection} degrees), at least 3 swings opposite field (direction above +${GOAL_COUNT_SPECS.allfields.oppoDirection} degrees), remainder center field. Exit velocity ${GOAL_COUNT_SPECS.allfields.hardContactExitVelocity}+ mph indicates hard contact that challenges fielders.`
    case 'popup':
      return `Goal context: goal is to eliminate pop-ups (launch angles above ${GOAL_COUNT_SPECS.popup.popUpAngle} degrees) while avoiding weak grounders (launch angles below ${GOAL_COUNT_SPECS.popup.grounderAngle} degrees). Target launch angle is ${target.launchAngle.min}-${target.launchAngle.max} degrees — enough loft to drive the ball into the outfield productively without ballooning. Staying consistently between ${target.launchAngle.min}-${target.launchAngle.max} degrees is success.`
    case 'open':
      return 'Goal context: open session with no specific target metrics. Analyze the most interesting patterns in the data.'
    default:
      return ''
  }
}

// Exported so the eval bench under scripts/ can send the real system prompt
// rather than a copy of it. A bench grading a copy grades nothing: the copy
// drifts, and it drifts invisibly, which is worst at exactly the moment the
// bench is most trusted. Nothing in src/ should import this; the two call sites
// below are the only ones in the app.
//
// This is the prompt with no length budget attached, kept separate from
// DEBRIEF_SYSTEM below on purpose. The bench's baseline condition exists to
// answer "how much does the coach write with no budget at all," and it can
// only keep answering that question if there is a version of this prompt with
// no budget baked in. Appending the budget straight onto this constant would
// have quietly turned every future "baseline" run into a comparison between
// two budgets, and nobody would have noticed until the numbers stopped making
// sense.
export const DEBRIEF_SYSTEM_BASE = `You are B1 Coach, an AI hitting coach built into the TrackMan B1 practice system. You speak like an experienced high school or college hitting coach — direct, encouraging, and plain-spoken. You never sound like a data analyst. You never say 'statistically speaking' or 'your data shows.' You say things like 'your bat speed is there' or 'you're getting under the ball too much.'

Rules:
- Lead with what the player did well before addressing improvements
- Reference specific numbers from the session data when making observations
- Keep observations focused — two or three key insights, not everything
- Speak to a high school or college-aged player, not a professional
- Never make the player feel bad or use harsh criticism
- Be honest but always constructive
- Only reference specific numbers that appear in the session data. Never invent or estimate metrics that were not provided.
- Never count, total, or tally swings yourself. Use a count only if it appears in the session data. If no count is provided, describe the pattern without a number.
- Write all content at an eighth-grade reading level. Short sentences, plain words, no jargon.
- Never use em-dashes.

For tipsIntro: Write one short sentence the way a coach would open after practice — warm but direct. Reference how the session went if it was notable. Example: "Good work out there — two things to focus on before next time." or "Tough day, but here's what we build on." One sentence only.

For nextSessionTips: Write each tip the way a coach would say it out loud walking off the field, not as a written recommendation. Reference one specific number, then give one concrete thing to try. Three sentences per tip, no exceptions. When the session data shows a clear positive pattern worth reinforcing, one of the two tips may celebrate what the player did well and explain the mechanical reason it worked, rather than always focusing on improvement. Only do this when the data genuinely supports it. First sentence is an observation referencing specific numbers from the data. (ex: You only hit to the opposite field on swings 9, 12, and 14, and swing 12 left the bat at just 83 mph.) Second sentence translates what that means in baseball terms. (ex: That tells me you are reaching for those instead of staying through the ball.) Third sentence is one specific physical cue — something the player can feel in their body or visualize mechanically. Bad: 'Focus on driving the ball the other way.' Good: 'Let the ball travel deeper, keep your hands inside, and extend through contact toward the opposite field gap.' A cue tells the player what to do with their body, not just what outcome to chase. (ex: Try letting the ball travel a little deeper and driving it the other way with some authority.) No fourth sentence under any circumstances.

If multiple sessions are provided, compare the current session to prior sessions and call out specific improvements or regressions by number.

Respond ONLY with valid JSON matching this exact shape. Do not write any analysis, reasoning, or commentary before it. Your entire reply must be the JSON object itself, starting with { and ending with }, no preamble, no markdown fences:
{
  "coachingSummary": "2-3 sentences max",
  "whatThisMeans": "1-2 sentences translating the numbers into real baseball terms",
  "tipsIntro": "one sentence opener",
  "nextSessionTips": ["tip1", "tip2"],
  "charts": ["chart_key_1", "chart_key_2"]
}

Available chart keys — pick the 2 most relevant based on goal and data:
- scatter_ev_la: Launch Angle vs Exit Velocity scatter plot
- bar_distance: Distance Distribution bar chart
- spray_direction: Spray Chart showing pull/center/opposite field breakdown
- trend_ev: Exit Velocity Trend line across all swings in sequence
- zone_breakdown: In-Zone vs Out-of-Zone breakdown by swing
- pitch_location: Pitch location scatter — plots where each pitch crossed the plate relative to the strike zone, with shapes showing swing outcome based on the player's goal

Goal-based defaults (deviate if data tells a more interesting story):
- power: scatter_ev_la + bar_distance (use trend_ev instead of bar_distance if EV variance across swings is high; consider pitch_location when per-swing pitch data shows interesting patterns between location and exit velocity)
- contact: scatter_ev_la + spray_direction (consider pitch_location to show which pitch locations produce line drives)
- allfields: spray_direction + scatter_ev_la (consider pitch_location to show pull/center/oppo patterns by pitch location)
- popup: scatter_ev_la + trend_ev (consider pitch_location to show if pop-ups correlate with high pitch locations)
- open: choose any two based on the most interesting patterns — do NOT select pitch_location for this goal`

// The length-budget instruction, as a function of the four numbers rather than
// four numbers baked into prose, because the eval bench under scripts/ needed
// to try several sets of numbers against the same wording to find out which one
// a panel could actually hold. Moved here verbatim from the bench once the
// product manager picked a set; the wording itself is what was measured, so it
// is not rewritten in the move. Two things in it are load-bearing: it counts
// words, not sentences, because the model already obeys the three-sentence cap
// on each tip by writing longer sentences, so a sentence-counting instruction
// would report success while the summary box overflowed anyway; and it says
// out loud that a vague tip inside budget is a failure, because the risk this
// slice was warned about is not that the coach writes too much, it is that it
// gets short by getting vague.
export const lengthBudget = ({ summary, means, intro, tip }) => `LENGTH BUDGET. These are hard limits, not suggestions. Count words, not sentences.
- coachingSummary: ${summary} words maximum.
- whatThisMeans: ${means} words maximum.
- tipsIntro: ${intro} words maximum.
- each tip in nextSessionTips: ${tip} words maximum.

Stay inside the budget by cutting words, never by cutting specifics. Every number you were going to cite, still cite. Keep the three-part shape of each tip exactly as described above: an observation quoting real numbers from the session, then what it means in baseball terms, then one physical cue. Write shorter sentences rather than dropping one of the three parts. A vague tip that fits the budget is a failure, not a success.`

// Condition B out of the four the bench measured over 24 real API calls each:
// the middle of three budget sizes tried, and the one the product manager
// picked after reading how each held up against real panel space and against
// whether the coach kept citing real swings. Kept as its own constant, not
// inlined into DEBRIEF_SYSTEM below, so the eval bench can name these exact
// numbers again the next time this prompt is re-measured, rather than reading
// them back out of DEBRIEF_SYSTEM by eye.
export const DEBRIEF_BUDGET = lengthBudget({ summary: 45, means: 30, intro: 12, tip: 50 })

// What generateDebrief actually sends. Everything downstream of this line
// (generateDebrief itself, and every real debrief a visitor sees) reads this
// constant and nothing else; DEBRIEF_SYSTEM_BASE and DEBRIEF_BUDGET above exist
// so the bench can keep measuring "no budget" and "the shipped budget" as two
// distinct, honest conditions rather than one collapsing into the other.
export const DEBRIEF_SYSTEM = `${DEBRIEF_SYSTEM_BASE}\n\n${DEBRIEF_BUDGET}`

const CHAT_SYSTEM = `You are B1 Coach, an AI hitting coach built into the TrackMan B1 practice system. You are in a conversation with a player reviewing their session data. Speak like an experienced high school or college hitting coach — direct, encouraging, plain-spoken. Never sound like a data analyst.

Rules:
- Answer the player's question directly and specifically
- Reference actual numbers from the session data when relevant
- Keep responses concise — 2 to 4 sentences unless a longer answer is clearly needed
- If the player asks about a prior session, use that session's data
- Never make the player feel bad
- If showing a chart would genuinely help answer the question, include a chart key
- Only reference specific numbers that appear in the session data. Never invent or estimate metrics that were not provided.
- inZoneCount is the number of pitches that landed in the strike zone by location — it has nothing to do with launch angle or whether the player swung well
- Write at an eighth-grade reading level. Short sentences, plain words, no jargon.
- Never use em-dashes.
- You may use basic markdown formatting when it genuinely aids readability: italics for key metrics (e.g. *91 mph* or *27 degrees*), bullet points for multi-session recaps (each session must be its own bullet point), and line breaks between sections for longer responses. For responses longer than four sentences, break into paragraphs (e.g. one for the observation, one for the action or recommendation). Default to plain prose for simple conversational answers. Never use bold or headers.
- When giving advice or suggestions, use specific physical cues the player can feel in their body rather than vague outcome instructions. Bad: "Focus on driving the ball the other way." Good: "Let the ball travel deeper, keep your hands inside, and extend through contact." Tell the player what to do with their body, not just what outcome to chase.

Respond ONLY with valid JSON matching this exact shape, no preamble, no markdown fences:
{
  "message": "your coaching response",
  "chart": "chart_key or null"
}

Available chart keys: scatter_ev_la, bar_distance, spray_direction, trend_ev, zone_breakdown, pitch_location. Only include a chart key if it directly helps answer the player's question. Otherwise set chart to null.`

const RETRY_DELAY_MS = 1500

// The browser's own backstop, and the ceiling this slice promises: the longest
// a visitor is held before being told something. api/coach.js gives up on
// Anthropic at 40000ms and answers with its own classified reason; this sits
// behind that on purpose, at 50000ms, so the server's more specific answer
// almost always wins the race and this timeout only fires when the function
// itself never got to speak at all.
//
// It is a budget for the whole callApi call, not an allowance handed fresh to
// each attempt. Both attempts and the delay between them are spent out of the
// same wall clock, so the ceiling holds by construction rather than by
// assuming every retryable failure happens to fail fast.
const REQUEST_TIMEOUT_MS = 50000

// A second attempt needs some room to work in. Below this there is not enough
// budget left for one to plausibly finish, so starting it would only add
// silence in front of the same honest message the visitor was always going to
// get.
const MIN_RETRY_BUDGET_MS = 2000

// Everything callApi throws is one of these, so no caller has to guess what
// went wrong from a bare Error message again. `reason` is one of 'timeout',
// 'unreachable', 'credits' or 'trouble'. `respondedOk` marks whether this
// attempt got a successful HTTP response before failing (true only for a good
// response whose body could not be used); the retry policy below reads it to
// tell an attempt that never reached the server apart from one that did.
export class CoachError extends Error {
  constructor(message, { reason, cold = false, respondedOk = false } = {}) {
    super(message)
    this.name = 'CoachError'
    this.reason = reason
    this.cold = cold
    this.respondedOk = respondedOk
  }
}

// The model is asked for bare JSON and usually gives it, but it also wraps the
// answer in a Markdown fence unpredictably: sometimes tagged ```json, sometimes
// a plain ```, sometimes with a sentence in front of it. It may also quote a
// literal fence inside its own coaching message, which is content rather than a
// wrapper.
//
// So the response is read as it stands first. That is both the common case and
// the only reading that cannot mangle a fence the coach meant to say. Only when
// that fails does it fall back to the outermost braces, which unwraps a fence or
// a preamble without needing to know which shape it took.
//
// Before Slice 4 this was two regular expressions that between them threw away a
// plainly fenced answer and truncated any answer quoting a fence. Both reached
// the player as a connection error, which was untrue: the connection worked and
// the model answered.
// The outermost { ... } of a string, parsed, or undefined if there is no object
// in there or it does not parse. JSON has no undefined literal, so undefined is
// unambiguously "nothing usable here" rather than a value the model sent.
function parseOutermostObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

// Exported for the same reason as DEBRIEF_SYSTEM above: the bench has to turn a
// model reply into fields the way production does, fenced answers and all, or
// it is measuring a different parser than the visitor gets.
export function parseCoachResponse(text) {
  const trimmed = text.trim()

  // Almost always this, and it is the only reading that cannot mangle a fence
  // the coach meant to say out loud inside its own message.
  try {
    return JSON.parse(trimmed)
  } catch {
    // Fenced, or wrapped in prose. Keep going.
  }

  // A fence, tagged ```json or plain, with prose allowed on either side. Greedy
  // to the LAST fence on purpose, so a fence quoted inside the answer does not
  // end the block early. Unwrapping the fence before looking for braces is what
  // keeps a stray brace in the surrounding prose from dragging the slice past
  // the JSON, which is how the first version of this fix regressed.
  const fenced = trimmed.match(/```(?:json)?[ \t]*\r?\n?([\s\S]*)\r?\n?[ \t]*```/)
  if (fenced) {
    const body = fenced[1].trim()
    try {
      return JSON.parse(body)
    } catch {
      // More than two fences, so the greedy match swallowed a trailing one.
      const inner = parseOutermostObject(body)
      if (inner !== undefined) return inner
    }
  }

  // No usable fence. Covers a bare object with a sentence in front of it.
  const outer = parseOutermostObject(trimmed)
  if (outer !== undefined) return outer

  throw new Error('Failed to parse coach response as JSON')
}

const isAbort = (err) => err?.name === 'AbortError'

// One attempt: fetch, classify whatever went wrong into a CoachError, or parse
// and return the coach's reply. The server's own answer always wins when there
// is one; this only guesses when the function never got to speak at all.
//
// The deadline covers the whole attempt, not just the wait for headers: the
// timer is cleared only once this function is done with the response body, and
// an abort firing during either body read (the error envelope or the coach's
// reply) is still classified 'timeout', not misread as 'trouble' or
// 'unreachable' by the generic catches around those reads. Without that, a slow
// body on an already-answered request could hang past the deadline this slice
// promises as its ceiling.
//
// `budgetMs` is whatever is left of the call's ceiling when this attempt
// starts, not a fresh allowance. A retry therefore inherits the time its
// predecessor did not spend, and nothing else.
async function attempt(url, headers, body, budgetMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), budgetMs)

  try {
    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      if (isAbort(err)) {
        throw new CoachError('The coach did not answer in time', { reason: 'timeout' })
      }
      // The network failed or the function could not be reached at all. We know
      // nothing about Anthropic; the server never got a chance to say more.
      throw new CoachError('Could not reach the coach', { reason: 'unreachable' })
    }

    if (!response.ok) {
      let envelope
      try {
        envelope = await response.json()
      } catch (err) {
        if (isAbort(err)) {
          throw new CoachError('The coach did not answer in time', { reason: 'timeout' })
        }
        envelope = undefined
      }

      // The classified shape from api/coach.js: { error: { reason, cold, ... } }.
      // A bare string error (the older caller-shape refusal) is not this, and
      // reading `.reason` off it must not throw or be mistaken for a real reason.
      const errorField = envelope?.error
      if (errorField && typeof errorField === 'object' && typeof errorField.reason === 'string') {
        throw new CoachError('The coach could not answer', { reason: errorField.reason, cold: !!errorField.cold })
      }

      // No usable envelope: the function never got to speak, or answered in a
      // shape this app never asked for. A 504 or an x-vercel-error header is the
      // platform itself saying it gave up; anything else, we simply do not know.
      const isTimeoutSignal = response.status === 504 || response.headers?.get?.('x-vercel-error') != null
      throw new CoachError('The coach could not answer', { reason: isTimeoutSignal ? 'timeout' : 'unreachable' })
    }

    // The connection worked and the server answered; everything from here on is
    // the reply itself being unusable, in one shape or another. That attempt
    // already spent its full wait succeeding, which is exactly why every
    // failure below is marked respondedOk and the retry policy refuses to
    // repeat it. A body that is not JSON at all, or is JSON but not an object,
    // must not escape this function as a raw SyntaxError or TypeError with no
    // reason. An abort while reading this body is the one exception: it is
    // still 'timeout', because the visitor waited the full deadline regardless
    // of whether the headers had already arrived.
    let text
    try {
      const data = await response.json()
      text = data?.content?.[0]?.text
    } catch (err) {
      if (isAbort(err)) {
        throw new CoachError('The coach did not answer in time', { reason: 'timeout' })
      }
      throw new CoachError('The coach answered with something unusable', { reason: 'trouble', respondedOk: true })
    }

    if (!text) {
      throw new CoachError('No text content in API response', { reason: 'trouble', respondedOk: true })
    }

    try {
      return parseCoachResponse(text)
    } catch {
      throw new CoachError('Failed to parse coach response as JSON', { reason: 'trouble', respondedOk: true })
    }
  } finally {
    clearTimeout(timer)
  }
}

// Whether a failed attempt is worth repeating once. Two conditions, both
// required: the attempt never produced a successful HTTP response, and the
// reason is one a second try can plausibly do better on.
//
// The first condition is not decoration. A reply that arrived fine and then
// would not parse is classified 'trouble', but that attempt already spent its
// wait succeeding, so repeating it buys a second full wait for a problem in
// the model's answer rather than in reaching it.
//
// `cold` is deliberately not consulted here, and this is the third time it has
// been reasoned through, so it is written down. Work through what it could
// change and it changes nothing: cold with 'credits' must not retry, because a
// drained balance is not a waking-up problem and no second try will fund it;
// cold with 'timeout' must not retry, because the visitor has already waited
// the whole budget and the point of a ceiling is that it holds; and cold with
// 'unreachable' or 'trouble' already retries without asking about cold at all.
// A cold clause adds no case and only lets 'credits' through, which is the one
// failure this slice was built to report honestly and the one the copy table
// deliberately gives no Try Again button. Do not add it back.
function isRetryable(err) {
  if (err.respondedOk) return false
  return err.reason === 'unreachable' || err.reason === 'trouble'
}

// Exported for tests. Both callers are in this file; nothing else should use it.
//
// One wall clock governs the whole call. Each attempt gets whatever is left of
// REQUEST_TIMEOUT_MS rather than a fresh copy of it, and a retry is skipped
// outright when too little is left for a second attempt to finish inside the
// ceiling. That is what makes the ceiling a fact about the code instead of an
// assumption about how quickly retryable failures tend to fail.
export async function callApi(body, { onRetry } = {}) {
  const url = '/api/coach'
  const headers = { 'content-type': 'application/json' }
  const startedAt = Date.now()
  const remainingMs = () => REQUEST_TIMEOUT_MS - (Date.now() - startedAt)

  try {
    return await attempt(url, headers, body, remainingMs())
  } catch (err) {
    if (!(err instanceof CoachError) || !isRetryable(err)) throw err

    // The 1500ms pause comes out of the same budget as the attempts do, so it
    // is subtracted before asking whether a second attempt has room to run.
    if (remainingMs() - RETRY_DELAY_MS < MIN_RETRY_BUDGET_MS) throw err

    onRetry?.({ reason: err.reason, cold: err.cold })
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    return attempt(url, headers, body, remainingMs())
  }
}

// The pre-computed counts for the thresholds the selected goal's prose names,
// as prompt lines. Slice 8b: the coach reliably repeats a count it is handed
// and miscounts anything it derives itself, so every threshold in the goal's
// prompt prose arrives pre-counted, from the same GOAL_COUNT_SPECS the prose
// interpolates, so a sentence and the count feeding it cannot disagree.
// Before this, the below-15 and power-zone lines went to every goal, naming
// Power's numbers no matter what the player was working on, and every other
// goal's own thresholds arrived uncounted.
//
// Only the below-15 line prints swing numbers, exactly as the shipped line
// always did; it was written for Power and stays Power's. A goal whose prose
// names no thresholds (open) gets no count lines at all, matching
// goalTargets' absence-not-zeroes convention. The strict/inclusive edges
// below match the charts: pull and oppo are the spray chart's own strict
// cutoffs, and the target ranges include both ends, same as meetsTarget.
function goalCountLines(goalId, swings) {
  const spec = GOAL_COUNT_SPECS[goalId]
  if (!spec) return []
  const v = goalCountValues(goalId, swings)

  switch (goalId) {
    case 'power':
      // Both lines predate Slice 8b and are kept verbatim. The 15-degree
      // threshold is the one number here that lives in neither
      // GOAL_COUNT_SPECS nor goalTargets: it is the shipped line's own
      // literal, named nowhere in the prompt prose, kept as found.
      return [
        `- Swings with launch angle strictly below 15 degrees (not including 15): ${swingCountPhrase(v.underFifteen.count)} — numbers: ${v.underFifteen.swings.join(', ')}`,
        `- Swings in power zone (EV >= ${spec.exitVelocity} mph AND launch angle ${spec.launchAngle.min}-${spec.launchAngle.max} degrees): ${swingCountPhrase(v.powerZone.count)}`,
      ]
    case 'contact':
      return [
        `- Swings with launch angle in the target ${spec.launchAngle.min}-${spec.launchAngle.max} degrees (including both ${spec.launchAngle.min} and ${spec.launchAngle.max}): ${swingCountPhrase(v.contactTargetBand.count)}`,
        `- Swings with exit velocity ${spec.exitVelocity} mph or higher: ${swingCountPhrase(v.contactHardHit.count)}`,
        `- Swings with launch angle strictly above ${spec.flyBallAngle} degrees (not including ${spec.flyBallAngle}): ${swingCountPhrase(v.contactFlyBall.count)}`,
      ]
    case 'allfields':
      // The "+" before oppoDirection matches the prose's own "+15".
      return [
        `- Swings pull side (direction strictly below ${spec.pullDirection} degrees, not including ${spec.pullDirection}): ${swingCountPhrase(v.pullSide.count)}`,
        `- Swings opposite field (direction strictly above +${spec.oppoDirection} degrees, not including +${spec.oppoDirection}): ${swingCountPhrase(v.oppoField.count)}`,
        `- Swings with exit velocity ${spec.hardContactExitVelocity} mph or higher: ${swingCountPhrase(v.allfieldsHardContact.count)}`,
      ]
    case 'popup':
      return [
        `- Swings popped up (launch angle strictly above ${spec.popUpAngle} degrees, not including ${spec.popUpAngle}): ${swingCountPhrase(v.popUp.count)}`,
        `- Swings hit as weak grounders (launch angle strictly below ${spec.grounderAngle} degrees, not including ${spec.grounderAngle}): ${swingCountPhrase(v.weakGrounder.count)}`,
        `- Swings with launch angle in the target ${spec.launchAngle.min}-${spec.launchAngle.max} degrees (including both ${spec.launchAngle.min} and ${spec.launchAngle.max}): ${swingCountPhrase(v.popupTargetBand.count)}`,
      ]
    default:
      return []
  }
}

// The user half of the debrief prompt: every session the player has seen so far,
// with the current one named at the end. Split out of generateDebrief and
// exported for the bench, for the reason given on DEBRIEF_SYSTEM above.
// generateDebrief immediately below is its only caller in the app.
export function buildDebriefUserMessage({ goal, player, sessions, viewingSessionNumber }) {
  const filteredSessions = sessions.filter((s) => s.sessionNumber <= viewingSessionNumber)

  return `Player: ${player.firstName}
Goal: ${goal.label}
${goalContext(goal)}

Note: All sessions shown here are consecutive rounds of batting practice in a single continuous practice period, like taking multiple rounds of BP in the same cage session. Do not use words like "today" or "yesterday" when comparing sessions. Refer to sessions by number only. Do not imply the current session is the final one unless it is explicitly Session 4.

${filteredSessions.map((s) => `Session ${s.sessionNumber}:
- Avg Exit Velocity: ${s.stats.avgExitVelocity} mph
- Avg Launch Angle: ${s.stats.avgLaunchAngle} degrees
- Pitches in strike zone: ${s.stats.inZoneCount}/${s.stats.totalSwings} (strike zone = height 1.5–3.5ft, side –0.7 to 0.7ft — full per-swing pitch coordinates included above)
${goalCountLines(goal.id, s.swings).map((line) => `${line}\n`).join('')}- Top 3 exit velocities: ${[...s.swings].sort((a, b) => b.hit.launch.exitSpeed - a.hit.launch.exitSpeed).slice(0, 3).map(sw => sw.hit.launch.exitSpeed).join(', ')} mph
- Distance distribution: ${distanceDistributionLine(s.swings)}
- Individual swings: ${s.swings.map((sw, i) => `Swing ${i + 1}: ${sw.hit.launch.exitSpeed}mph EV, ${sw.hit.launch.angle}° LA, ${sw.hit.launch.direction}° direction, ${sw.hit.landing.distance}ft distance, pitch height ${sw.plateLocHeight}ft / pitch side ${sw.plateLocSide}ft`).join(' | ')}`
  ).join('\n\n')}

Current session being debriefed: Session ${viewingSessionNumber}`
}

export async function generateDebrief({ goal, player, sessions, viewingSessionNumber, onRetry }) {
  return callApi({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: DEBRIEF_SYSTEM,
    messages: [{
      role: 'user',
      content: buildDebriefUserMessage({ goal, player, sessions, viewingSessionNumber }),
    }],
  }, { onRetry })
}

export async function sendChatMessage({ goal, player, sessions, viewingSessionNumber, messages }) {
  const filteredSessions = sessions.filter((s) => s.sessionNumber <= viewingSessionNumber)

  const userMessage = `Player: ${player.firstName}
Goal: ${goal.label}
${goalContext(goal)}

${filteredSessions.map((s) => `Session ${s.sessionNumber}:
- Avg Exit Velocity: ${s.stats.avgExitVelocity} mph
- Avg Launch Angle: ${s.stats.avgLaunchAngle} degrees
- In Zone: ${s.stats.inZoneCount}/${s.stats.totalSwings} pitches landed in the strike zone (pitch location only — not related to launch angle or swing outcome)
- Distance distribution: ${distanceDistributionLine(s.swings)}
${s.debrief?.coachingSummary ? `- Previously told player in session summary: ${s.debrief.coachingSummary}` : ''}
${s.debrief?.whatThisMeans ? `- Previously told player in what this means: ${s.debrief.whatThisMeans}` : ''}
- Individual swings: ${s.swings.map((sw, i) => `Swing ${i + 1}: ${sw.hit.launch.exitSpeed}mph EV, ${sw.hit.launch.angle}° LA, ${sw.hit.launch.direction}° direction, ${sw.hit.landing.distance}ft distance, pitch height ${sw.plateLocHeight}ft / pitch side ${sw.plateLocSide}ft`).join(' | ')}`
  ).join('\n\n')}

${filteredSessions.length > 1 ? `Prior session conversations:
${filteredSessions
  .filter(s => s.sessionNumber < viewingSessionNumber)
  .map(s => {
    const realMessages = (s.messages ?? []).filter(m => m.content !== '__tips__')
    if (realMessages.length === 0) return null
    return `Session ${s.sessionNumber} chat summary:\n${realMessages
      .map(m => `${m.role === 'user' ? 'Player' : 'Coach'}: ${m.content}`)
      .join('\n')}`
  })
  .filter(Boolean)
  .join('\n\n')}` : ''}

Current session being viewed: Session ${viewingSessionNumber}

Conversation so far:
${messages.map((m) => `${m.role === 'user' ? 'Player' : 'Coach'}: ${m.content}`).join('\n')}

Player's latest message: ${messages[messages.length - 1]?.content ?? ''}`

  return callApi({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: CHAT_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  })
}
