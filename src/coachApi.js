import { goalTarget, meetsTarget } from './goalTargets'

// The debrief prompt reports a power-zone count for every goal, not just the
// power goal, so it names Power's numbers directly rather than the current
// goal's. Same definition the chart colours swings against.
const POWER = goalTarget('power')

// These two are ALSO pinned at the top of api/coach.js, deliberately, and must be
// kept in step. Production ignores whatever is sent here and uses its own copy.
// These values are what local development actually runs on, because npm run dev
// never touches api/coach.js: vite.config.js proxies /api/coach straight to
// api.anthropic.com, which requires both fields in the body. Change one place
// without the other and local development quietly tests a different model than
// production ships.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

// The coaching context for one goal, in the coach's own words.
//
// The prose is hand-written and stays that way; only the target numbers inside
// it are read from goalTargets.js, so the coach, the goal cards and the charts
// can no longer promise the player three different things. Numbers that are not
// a target zone stay written out here: the pull and opposite-field direction
// cutoffs, the 82 mph that describes hard contact, and the pop-up and grounder
// edges the goal is defined against.
//
// One copy, used by both the debrief prompt and the chat prompt. This block used
// to be written out twice, verbatim, which is half of how the numbers drifted.
export function goalContext(goal) {
  const target = goalTarget(goal?.id)
  switch (goal?.id) {
    case 'power':
      return `Goal context: target launch angle ${target.launchAngle.min}-${target.launchAngle.max} degrees, target exit velocity ${target.exitVelocity}+ mph. These are the conditions for home run distance contact.`
    case 'contact':
      return `Goal context: target launch angle ${target.launchAngle.min}-${target.launchAngle.max} degrees for true line drives, target exit velocity ${target.exitVelocity}+ mph for hard contact. Angles above 20 degrees are fly balls, not line drives.`
    case 'allfields':
      return 'Goal context: goal is meaningful contact to all three zones — at least 3 swings pull side (direction below -15 degrees), at least 3 swings opposite field (direction above +15 degrees), remainder center field. Exit velocity 82+ mph indicates hard contact that challenges fielders.'
    case 'popup':
      return `Goal context: goal is to eliminate pop-ups (launch angles above 35 degrees) while avoiding weak grounders (launch angles below 5 degrees). Target launch angle is ${target.launchAngle.min}-${target.launchAngle.max} degrees — enough loft to drive the ball into the outfield productively without ballooning. Staying consistently between ${target.launchAngle.min}-${target.launchAngle.max} degrees is success.`
    case 'open':
      return 'Goal context: open session with no specific target metrics. Analyze the most interesting patterns in the data.'
    default:
      return ''
  }
}

const DEBRIEF_SYSTEM = `You are B1 Coach, an AI hitting coach built into the TrackMan B1 practice system. You speak like an experienced high school or college hitting coach — direct, encouraging, and plain-spoken. You never sound like a data analyst. You never say 'statistically speaking' or 'your data shows.' You say things like 'your bat speed is there' or 'you're getting under the ball too much.'

Rules:
- Lead with what the player did well before addressing improvements
- Reference specific numbers from the session data when making observations
- Keep observations focused — two or three key insights, not everything
- Speak to a high school or college-aged player, not a professional
- Never make the player feel bad or use harsh criticism
- Be honest but always constructive
- Only reference specific numbers that appear in the session data. Never invent or estimate metrics that were not provided.
- Write all content at an eighth-grade reading level. Short sentences, plain words, no jargon.
- Never use em-dashes.

For tipsIntro: Write one short sentence the way a coach would open after practice — warm but direct. Reference how the session went if it was notable. Example: "Good work out there — two things to focus on before next time." or "Tough day, but here's what we build on." One sentence only.

For nextSessionTips: Write each tip the way a coach would say it out loud walking off the field, not as a written recommendation. Reference one specific number, then give one concrete thing to try. Three sentences per tip, no exceptions. When the session data shows a clear positive pattern worth reinforcing, one of the two tips may celebrate what the player did well and explain the mechanical reason it worked, rather than always focusing on improvement. Only do this when the data genuinely supports it. First sentence is an observation referencing specific numbers from the data. (ex: You only hit to the opposite field on swings 9, 12, and 14, and two of those were your weakest swings at 83 and 86 mph.) Second sentence translates what that means in baseball terms. (ex: That tells me you are reaching for those instead of staying through the ball.) Third sentence is one specific physical cue — something the player can feel in their body or visualize mechanically. Bad: 'Focus on driving the ball the other way.' Good: 'Let the ball travel deeper, keep your hands inside, and extend through contact toward the opposite field gap.' A cue tells the player what to do with their body, not just what outcome to chase. (ex: Try letting the ball travel a little deeper and driving it the other way with some authority.) No fourth sentence under any circumstances.

If multiple sessions are provided, compare the current session to prior sessions and call out specific improvements or regressions by number.

Respond ONLY with valid JSON matching this exact shape, no preamble, no markdown fences:
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

function parseCoachResponse(text) {
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

// Exported for tests. Both callers are in this file; nothing else should use it.
export async function callApi(body, { onRetry } = {}) {
  const url = '/api/coach'
  const headers = { 'content-type': 'application/json' }

  const send = async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response
  }

  let response
  try {
    response = await send()
  } catch {
    // The server answering this call sleeps when idle, and the request that wakes
    // it is the one that fails. One retry covers that. A second would only make a
    // genuinely dead server take longer to say so.
    onRetry?.()
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    response = await send()
  }

  const data = await response.json()
  const text = data.content?.[0]?.text

  if (!text) {
    throw new Error('No text content in API response')
  }

  try {
    return parseCoachResponse(text)
  } catch {
    throw new Error('Failed to parse coach response as JSON')
  }
}

export async function generateDebrief({ goal, player, sessions, viewingSessionNumber, onRetry }) {
  const filteredSessions = sessions.filter((s) => s.sessionNumber <= viewingSessionNumber)

  const userMessage = `Player: ${player.firstName}
Goal: ${goal.label}
${goalContext(goal)}

Note: All sessions shown here are consecutive rounds of batting practice in a single continuous practice period, like taking multiple rounds of BP in the same cage session. Do not use words like "today" or "yesterday" when comparing sessions. Refer to sessions by number only. Do not imply the current session is the final one unless it is explicitly Session 4.

${filteredSessions.map((s) => `Session ${s.sessionNumber}:
- Avg Exit Velocity: ${s.stats.avgExitVelocity} mph
- Avg Launch Angle: ${s.stats.avgLaunchAngle} degrees
- Pitches in strike zone: ${s.stats.inZoneCount}/${s.stats.totalSwings} (strike zone = height 1.5–3.5ft, side –0.7 to 0.7ft — full per-swing pitch coordinates included above)
- Swings with launch angle strictly below 15 degrees (not including 15): ${s.swings.filter(sw => sw.hit.launch.angle < 15).length} swings — numbers: ${s.swings.map((sw, i) => sw.hit.launch.angle < 15 ? i + 1 : null).filter(Boolean).join(', ')}
- Swings in power zone (EV >= ${POWER.exitVelocity} mph AND launch angle ${POWER.launchAngle.min}-${POWER.launchAngle.max} degrees): ${s.swings.filter(sw => meetsTarget('power', sw.hit.launch)).length} swings
- Top 3 exit velocities: ${[...s.swings].sort((a, b) => b.hit.launch.exitSpeed - a.hit.launch.exitSpeed).slice(0, 3).map(sw => sw.hit.launch.exitSpeed).join(', ')} mph
- Distance distribution: 160-220ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 160 && sw.hit.landing.distance < 220).length} swings, 220-260ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 220 && sw.hit.landing.distance < 260).length} swings, 260-300ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 260 && sw.hit.landing.distance < 300).length} swings, 300-340ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 300 && sw.hit.landing.distance < 340).length} swings, 340+ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 340).length} swings
- Individual swings: ${s.swings.map((sw, i) => `Swing ${i + 1}: ${sw.hit.launch.exitSpeed}mph EV, ${sw.hit.launch.angle}° LA, ${sw.hit.launch.direction}° direction, ${sw.hit.landing.distance}ft distance, pitch height ${sw.plateLocHeight}ft / pitch side ${sw.plateLocSide}ft`).join(' | ')}`
  ).join('\n\n')}

Current session being debriefed: Session ${viewingSessionNumber}`

  return callApi({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: DEBRIEF_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
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
- Distance distribution: 160-220ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 160 && sw.hit.landing.distance < 220).length} swings, 220-260ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 220 && sw.hit.landing.distance < 260).length} swings, 260-300ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 260 && sw.hit.landing.distance < 300).length} swings, 300-340ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 300 && sw.hit.landing.distance < 340).length} swings, 340+ft: ${s.swings.filter(sw => sw.hit.landing.distance >= 340).length} swings
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
