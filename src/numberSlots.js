// Slice 15. The app writes the coach's per-swing numbers; the coach writes the
// sentence around them.
//
// WHY THIS EXISTS. Every lever this project had pulled at the coach before now
// was persuasion: the prompt hands it pre-counted figures and asks it to repeat
// them, and it does, at a high rate and never at exactly every time. Across the
// three most recent measured rounds, roughly a third of the coach's 35 genuine
// errors were pure transcription: copying 86 where the briefing sheet said 88,
// reciting a pair in the wrong order, contradicting a count it had been handed.
// No sharper wording closes that, because wording was never what was binding.
// So for the six per-swing values a slot can name, the coach stops holding the
// pen: it writes {{s4.sw12.ev}} and this module puts the real number there.
//
// WHAT THIS DELIBERATELY DOES NOT FIX, so nobody reads it as more than it is.
// The coach still sees every number and still reasons with them; it just stops
// transcribing them. Errors that happen in the thinking rather than in the
// typing are untouched: a grouping it invents ("three of those four came in
// under 84 mph"), a value put on the wrong side of a threshold it chose itself,
// arithmetic between two figures. Those are the larger half of the measured
// error rate and they stay open. Expected removal was stated as "about a third,
// and under half on every reading" BEFORE anything was built, and the product
// manager approved it on that basis.
//
// ADOPTION IS NOT 100%, WHICH IS WHY THIS IS NOT A GUARANTEE. The probe in
// docs/eval-fixtures/slice15-number-slots/ measured 89% of per-swing values
// coming back as slots across 16 live debriefs. The other 11% the coach typed
// itself and can still get wrong. "A contradicted per-swing number becomes
// impossible" is therefore FALSE as written; the true claim is that it becomes
// impossible for the values the coach hands over, and those were 89% of them.

// One slot holds one value and names its own session and swing. That is
// deliberate rather than terse for its own sake: a pair syntax would have to
// carry an order, and getting a pair's order wrong is the single most common
// transcription error this module exists to remove. Each slot carrying its own
// swing number leaves a transposition nowhere to happen.
// NOT global on purpose, and a review is why. A /g regex carries lastIndex
// between calls, so an exported one answers .test() true, then false, on the
// identical input. The filling below makes its own global copy per call.
export const NUMBER_SLOT_RE = /\{\{\s*s(\d+)\s*\.\s*sw(\d+)\s*\.\s*(\w+)\s*\}\}/

const globalSlotPattern = () => new RegExp(NUMBER_SLOT_RE.source, 'g')

// The six values a slot may name, and how each is read off a swing. Anything
// not in this table is unresolvable by definition, which is what stops the coach
// inventing a field the app does not measure.
const FIELD_READERS = {
  ev: (sw) => sw.hit.launch.exitSpeed,
  la: (sw) => sw.hit.launch.angle,
  dir: (sw) => sw.hit.launch.direction,
  dist: (sw) => sw.hit.landing.distance,
  ht: (sw) => sw.plateLocHeight,
  side: (sw) => sw.plateLocSide,
}

// Pitch position is stored to two decimals on a generated session and one on
// the hand-written first session. A coach says "3.6 feet" and never "3.63
// feet", so the two pitch fields round and the four whole-number fields do not.
// Found by reading the probe's own filled output rather than predicted: the
// unrounded version put "on a pitch at 2.82 feet" in front of a visitor, which
// is the mechanism making the prose read more machine-written than the coach's
// own typing did. Do not "simplify" this into rounding everything.
const ROUNDED_TO_ONE_DECIMAL = new Set(['ht', 'side'])

function readSlot(sessions, sessionNumber, swingNumber, field) {
  const session = sessions?.find?.((s) => s.sessionNumber === sessionNumber)
  const swing = session?.swings?.[swingNumber - 1]
  const reader = Object.prototype.hasOwnProperty.call(FIELD_READERS, field) ? FIELD_READERS[field] : null
  if (!session || !swing || !reader) return null

  const value = reader(swing)
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return String(ROUNDED_TO_ONE_DECIMAL.has(field) ? Math.round(value * 10) / 10 : value)
}

// An unresolvable slot means the coach is talking about a swing, session or
// measurement that does not exist, so the sentence around it is wrong whatever
// goes in the gap. Three options were weighed: print the braces, which shows a
// visitor the machinery; leave the gap empty, which prints broken grammar; or
// drop the sentence, which removes a statement already known to be false. The
// third is the only one that does not put something untrue or unfinished on the
// screen, so the unit of repair is the sentence, not the slot.
//
// A fourth option, treating it as an unusable reply, was rejected on reading
// the code: a reply that arrives and cannot be used is classified respondedOk
// and is deliberately NOT retried (see isRetryable in coachApi.js), so it would
// put a failure screen in front of a visitor instead of a debrief. That is far
// too harsh for something measured at 0 occurrences in 64 slots.
export function fillNumberSlots(text, sessions) {
  if (typeof text !== 'string' || !text) return text

  // Pass one, and it is the one that runs almost every time: fill everything
  // resolvable across the WHOLE string. No splitting, so every newline, bullet
  // and blank line the coach wrote survives untouched.
  //
  // The first version split into sentences before matching, which did two
  // things wrong at once and an independent review caught both. It flattened
  // markdown structure on every reply, slots or none, and the chat prompt
  // explicitly asks for a bullet per session and paragraphs on longer answers.
  // And because ". sw1" reads as a sentence end, it printed the braces of any
  // slot whose dots carried spaces, which is the exact outcome the drop policy
  // below exists to prevent. Match first, restructure only if forced.
  const filled = text.replace(globalSlotPattern(), (raw, session, swing, field) => {
    const value = readSlot(sessions, Number(session), Number(swing), field)
    return value === null ? raw : value
  })

  // The common case, and the whole point of doing it this way.
  if (!filled.includes('{{')) return filled

  // Pass two, rare: something is still machinery, either a slot naming a swing
  // that does not exist or a brace the model never closed. Either way the
  // sentence around it is already wrong, so it goes. Line by line, so a dropped
  // bullet does not drag its neighbours onto one line.
  const lines = filled.split('\n').map((line) => {
    if (!line.includes('{{')) return line
    return splitSentences(line).filter((sentence) => !sentence.includes('{{')).join(' ').trim()
  })

  // A line emptied by dropping is removed rather than left as a stray blank,
  // but a blank line the coach wrote is a paragraph break and stays.
  const kept = lines.filter((line, i) => line !== '' || filled.split('\n')[i] === '')
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// A sentence ends at . ! or ? followed by whitespace and then something that
// actually starts a new sentence. Requiring a capital or a quote is what stops
// "swing No. 9" and "Well..." being cut in half, both of which a review
// demonstrated handing a visitor a dangling fragment. It splits a real boundary
// ("...86 mph. Swing 9...") and leaves a false one alone.
function splitSentences(line) {
  return line.split(/(?<=[.!?])\s+(?=["'\u201c\u2018]?[A-Z])/)
}

const DEBRIEF_TEXT_FIELDS = ['coachingSummary', 'whatThisMeans', 'tipsIntro']

// Field-level policy, kept apart from the string work above so each can be read
// on its own. The three prose fields are load-bearing: a debrief rendering with
// a blank summary is worse than an honest failure, so emptying one throws. The
// tips are a list and survive losing a member.
export function fillDebriefNumbers(parsed, sessions) {
  const out = { ...parsed }

  for (const field of DEBRIEF_TEXT_FIELDS) {
    const before = parsed?.[field]
    if (typeof before !== 'string' || !before.trim()) continue
    const after = fillNumberSlots(before, sessions)
    if (!after.trim()) {
      throw new Error(`Coach reply emptied: ${field} named a swing that does not exist`)
    }
    out[field] = after
  }

  if (Array.isArray(parsed?.nextSessionTips)) {
    out.nextSessionTips = parsed.nextSessionTips
      .map((tip) => (typeof tip === 'string' ? fillNumberSlots(tip, sessions) : tip))
      .filter((tip) => typeof tip !== 'string' || tip.trim())
  }

  return out
}

// The chat half. Its reply is one prose field and one chart key, so the policy
// is simpler than the debrief's: the message is the whole answer, and an
// emptied one has nothing left to show.
export function fillChatNumbers(parsed, sessions) {
  const out = { ...parsed }
  const before = parsed?.message
  if (typeof before !== 'string' || !before.trim()) return out

  const after = fillNumberSlots(before, sessions)
  if (!after.trim()) {
    throw new Error('Coach reply emptied: the message named a swing that does not exist')
  }
  out.message = after
  return out
}
