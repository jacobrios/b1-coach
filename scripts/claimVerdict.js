// The verdict half of the coach-accuracy grader, in plain JavaScript.
//
// Slice 8, Task 3. Built because the grader's first live validation, on
// 17 August 2026, failed: it flagged 72 of 93 debriefs and caught the
// fixture's known errors for the right reason once in seven. The raw run is
// committed at docs/eval-fixtures/slice8-grader-validation/.
//
// THE FAULT THIS MODULE EXISTS TO REMOVE. The old grader asked one model call
// to do two jobs: find a claim in the coach's prose, and rule on it. Its
// required response shape was {field, quote, verdict, actual, reasoning}, in
// that order, so it committed to a verdict BEFORE writing down the evidence.
// Two dozen FALSE verdicts came back carrying reasoning that argued the
// opposite, several saying so in as many words ("the claim is TRUE, not
// FALSE. Correction: verdict should be TRUE"), and the same 305-foot row got
// read as above=4, above=3 and above=0 across different records.
//
// So the model's job is now extraction only. It returns a claim in structured
// form and issues no verdict at all. This module rules on it against the same
// deterministic fact sheet (scripts/factSheet.js), which is a table lookup and
// a comparison, and therefore cannot disagree with itself between two records.
//
// This also follows the project's standing rule that structured extraction
// returns claims, which get validated and normalized before anything branches
// on them, rather than a raw model response deciding an outcome.
//
// THE DELIBERATE NARROWING, which must be reported and not quietly absorbed.
// This code rules only on the claim shapes below. Everything else is
// UNVERIFIABLE **by construction rather than by instruction**, which is the
// point: the old grader was told in prose to answer UNVERIFIABLE when it could
// not settle something, and instead answered FALSE, most memorably after
// correctly working out that 15 minus 9 in-zone is 6. Code cannot make that
// mistake. The cost is that a run's UNVERIFIABLE rate now measures how much of
// the coach's prose this instrument simply does not reach, so it has to be
// reported beside the verdicts rather than dropped from the summary.

import { goalTarget } from '../src/goalTargets.js'

const COMPARISONS = new Set(['above', 'below', 'equal', 'atLeast', 'atMost'])

// Only above/below/equal carry a swing list in the fact sheet; atLeast and
// atMost carry a count alone, deliberately, to keep the sheet's size down.
// See the comment on thresholdCounts in scripts/factSheet.js.
const COMPARISONS_WITH_SWINGS = new Set(['above', 'below', 'equal'])

const unverifiable = (why) => ({ verdict: 'UNVERIFIABLE', actual: null, why })
const ruled = (verdict, actual, why) => ({ verdict, actual, why })

function findSession(factSheet, sessionNumber) {
  if (!Number.isFinite(sessionNumber)) return null
  return (factSheet?.sessions ?? []).find((s) => s.sessionNumber === sessionNumber) ?? null
}

function findThresholdRow(session, metric, threshold) {
  const rows = session.thresholds?.[metric]
  if (!Array.isArray(rows)) return null
  return rows.find((r) => r.threshold === threshold) ?? null
}

const sameSwings = (a, b) => {
  const left = [...a].sort((x, y) => x - y)
  const right = [...b].sort((x, y) => x - y)
  return left.length === right.length && left.every((v, i) => v === right[i])
}

const describeRow = (metric, comparison, threshold, bucket) =>
  `${metric} ${comparison} ${threshold}: ${bucket.count}` +
  (Array.isArray(bucket.swings) ? ` (swings ${bucket.swings.join(', ') || 'none'})` : '')

// A whole-session count against a precomputed threshold row. The error class
// the fixture pinned down: "above 20 degrees" was wrong in every one of the 96
// debriefs that attempted it, because the prompt named that threshold in prose
// and never counted it.
function thresholdVerdict(claim, session) {
  const { metric, threshold, comparison, statedCount, statedSwings } = claim
  if (!COMPARISONS.has(comparison)) return unverifiable(`unknown comparison "${comparison}"`)
  if (!Number.isFinite(threshold)) return unverifiable('no threshold given')
  if (!Number.isFinite(statedCount)) return unverifiable('no stated count given')

  const row = findThresholdRow(session, metric, threshold)
  if (!row) return unverifiable(`no precomputed row for ${metric} at ${threshold}`)
  const bucket = row[comparison]
  if (!bucket || !Number.isFinite(bucket.count)) {
    return unverifiable(`row for ${metric} at ${threshold} carries no "${comparison}" count`)
  }

  const actual = describeRow(metric, comparison, threshold, bucket)
  if (bucket.count !== statedCount) {
    return ruled('FALSE', actual, `claimed ${statedCount}, the row says ${bucket.count}`)
  }

  // A right count with the wrong swings named is still a false statement, and
  // the fixture holds one: six swings claimed above 20 degrees where the count
  // was wrong AND the list omitted two real members while including a swing
  // sitting exactly on the threshold.
  if (Array.isArray(statedSwings) && COMPARISONS_WITH_SWINGS.has(comparison)) {
    if (!sameSwings(statedSwings, bucket.swings ?? [])) {
      return ruled('FALSE', actual, 'the count matches but the named swings do not')
    }
  }
  return ruled('TRUE', actual, 'count matches the precomputed row')
}

// One swing's own number, read straight out of the per-swing table.
function swingValueVerdict(claim, session) {
  const { swingNumber, metric, statedValue } = claim
  if (!Number.isFinite(swingNumber)) return unverifiable('no swing number given')
  if (!Number.isFinite(statedValue)) return unverifiable('no stated value given')

  const row = (session.swings ?? []).find((s) => s.n === swingNumber)
  // An impossible reference is a wrong statement, not an unanswerable one: the
  // session demonstrably has no such swing.
  if (!row) {
    return ruled('FALSE', `session ${session.sessionNumber} has ${session.swings?.length ?? 0} swings`,
      `swing ${swingNumber} does not exist in this session`)
  }
  const value = row[metric]
  if (!Number.isFinite(value)) return unverifiable(`swing ${swingNumber} carries no ${metric}`)

  const actual = `swing ${swingNumber} ${metric}: ${value}`
  return value === statedValue
    ? ruled('TRUE', actual, 'matches the per-swing table')
    : ruled('FALSE', actual, `claimed ${statedValue}, the table says ${value}`)
}

// "N of those [swings X, Y, Z] were under T". The one shape that needs a set
// operation rather than a lookup, and the shape of fixture error #4, where the
// list was handed to the coach and the subset count was not.
function subsetVerdict(claim, session) {
  const { metric, threshold, comparison, ofSwings, statedCount } = claim
  if (!Array.isArray(ofSwings) || ofSwings.length === 0) return unverifiable('no subset swings given')
  if (!Number.isFinite(statedCount)) return unverifiable('no stated count given')
  if (!COMPARISONS_WITH_SWINGS.has(comparison)) {
    return unverifiable(`"${comparison}" carries no swing list to intersect`)
  }
  if (!Number.isFinite(threshold)) return unverifiable('no threshold given')

  const row = findThresholdRow(session, metric, threshold)
  if (!row) return unverifiable(`no precomputed row for ${metric} at ${threshold}`)
  const qualifying = row[comparison]?.swings
  if (!Array.isArray(qualifying)) return unverifiable(`row carries no "${comparison}" swing list`)

  const hits = ofSwings.filter((n) => qualifying.includes(n))
  const actual = `${hits.length} of swings ${ofSwings.join(', ')} are ${comparison} ${threshold} ${metric}` +
    (hits.length ? ` (swings ${hits.join(', ')})` : '')
  return hits.length === statedCount
    ? ruled('TRUE', actual, 'intersection size matches')
    : ruled('FALSE', actual, `claimed ${statedCount}, the intersection is ${hits.length}`)
}

// "You only hit the 25-to-35-degree window twice." A range is not a threshold,
// and treating it as one asks a different question: the smoke test on
// 17 August 2026 flattened exactly this claim to "atLeast 25" and produced a
// false FALSE against a real coach sentence.
//
// The count is derived from two precomputed rows rather than recounted:
// members of [min, max] are those at-or-above min, less those strictly above
// max. Both edges must exist as rows, so a range the fact sheet cannot answer
// exactly comes back UNVERIFIABLE instead of approximately right.
function rangeVerdict(claim, session, context) {
  const { metric, min, max, statedCount, ofSwings } = claim
  if (!Number.isFinite(min) || !Number.isFinite(max)) return unverifiable('range needs both edges')
  if (!Number.isFinite(statedCount)) return unverifiable('no stated count given')
  // An inverted range is a bad extraction, not a range of zero swings. Saying
  // so is better than confidently answering the question nobody asked.
  if (min > max) return unverifiable(`inverted range ${min} to ${max}`)

  // "Swings 4, 5, 6, and 7 ... all between 88 and 92 mph" is about the NAMED
  // swings, not the session, and grading it session-wide called correct coach
  // sentences false fifteen times in one run (17 August 2026): the dominant
  // false-positive class of the re-validation. With names in hand the claim
  // is concrete: read each named swing's own value from the per-swing table
  // and count the ones inside the window. No threshold rows are needed, and
  // the goal-window ambiguity below does not arise, because naming the swings
  // pins down exactly what is being counted.
  if (Array.isArray(ofSwings) && ofSwings.length > 0) {
    const rows = session.swings ?? []
    const values = []
    for (const n of ofSwings) {
      const row = rows.find((r) => r.n === n)
      // A named swing that does not exist makes the claim false, not
      // unanswerable, same as swingValueVerdict.
      if (!row) {
        return ruled('FALSE', `session ${session.sessionNumber} has ${rows.length} swings`,
          `swing ${n} does not exist in this session`)
      }
      const v = row[metric]
      if (!Number.isFinite(v)) return unverifiable(`swing ${n} carries no ${metric}`)
      values.push({ n, v })
    }
    const inside = values.filter(({ v }) => v >= min && v <= max)
    const actual = `${inside.length} of swings ${ofSwings.join(', ')} have ${metric} in ${min}-${max}` +
      ` (values ${values.map(({ n, v }) => `${n}:${v}`).join(', ')})`
    return inside.length === statedCount
      ? ruled('TRUE', actual, 'named-swing values match the range count')
      : ruled('FALSE', actual, `claimed ${statedCount}, the named swings give ${inside.length}`)
  }

  // A goal window defined by TWO metrics cannot be checked as a one-metric
  // range. The Power goal asks for 25-35 degrees AND 88+ mph, and the app's
  // own prompt hands the coach the two-metric count, so a coach sentence
  // naming "the 25-to-35-degree power window" is genuinely ambiguous: the
  // launch-angle count and the count the coach was given are different
  // numbers. Answering either one confidently produces a wrong verdict on a
  // sentence the coach got right, which is what the 17 August 2026 smoke test
  // caught. This lives in code because the same rule written into the
  // extraction prompt did not hold.
  const target = goalTarget(context?.goalId)
  if (
    target &&
    metric === 'launchAngle' &&
    Number.isFinite(target.exitVelocity) &&
    min === target.launchAngle?.min &&
    max === target.launchAngle?.max
  ) {
    return unverifiable(
      `the ${min}-${max} window for this goal also requires ${target.exitVelocity}+ mph, ` +
      'so a launch-angle-only count is not what the coach was necessarily claiming',
    )
  }

  const lowRow = findThresholdRow(session, metric, min)
  const highRow = findThresholdRow(session, metric, max)
  if (!lowRow || !highRow) {
    return unverifiable(`no precomputed rows for ${metric} at both ${min} and ${max}`)
  }
  const atLeastMin = lowRow.atLeast?.count
  const aboveMax = highRow.above?.count
  if (!Number.isFinite(atLeastMin) || !Number.isFinite(aboveMax)) {
    return unverifiable(`rows for ${metric} lack the counts a range needs`)
  }

  const inRange = atLeastMin - aboveMax
  const actual = `${metric} between ${min} and ${max} inclusive: ${inRange}`
  return inRange === statedCount
    ? ruled('TRUE', actual, 'range count matches the precomputed rows')
    : ruled('FALSE', actual, `claimed ${statedCount}, the rows give ${inRange}`)
}

// A whole-session number the debrief prompt already handed the coach.
function sessionStatVerdict(claim, session) {
  const { statName, statedValue } = claim
  if (!Number.isFinite(statedValue)) return unverifiable('no stated value given')
  const value = session.stats?.[statName]
  // Deliberately UNVERIFIABLE rather than derived. The failed run marked "six
  // pitches outside the strike zone" FALSE after correctly reasoning that 15
  // minus 9 in-zone is 6; the fact sheet holds no out-of-zone stat, so the
  // honest answer is that this instrument cannot settle it.
  if (!Number.isFinite(value)) return unverifiable(`the fact sheet carries no "${statName}"`)

  const actual = `${statName}: ${value}`
  return value === statedValue
    ? ruled('TRUE', actual, 'matches the session stats')
    : ruled('FALSE', actual, `claimed ${statedValue}, the stats say ${value}`)
}

const RULES = {
  threshold: thresholdVerdict,
  swingValue: swingValueVerdict,
  subset: subsetVerdict,
  range: rangeVerdict,
  sessionStat: sessionStatVerdict,
}

// Rule on one extracted claim. Never throws: an unusable claim is
// UNVERIFIABLE with a stated reason, because a grader that crashes on a
// surprising extraction loses the whole record rather than one claim.
export function verdictForClaim(claim, factSheet, context) {
  if (!claim || typeof claim !== 'object') return unverifiable('claim was not an object')

  const rule = RULES[claim.kind]
  if (!rule) return unverifiable(`no verdict rule for claim kind "${claim.kind}"`)

  const session = findSession(factSheet, claim.sessionNumber)
  if (!session) {
    return unverifiable(`session ${claim.sessionNumber} is not in the fact sheet the coach was shown`)
  }
  return rule(claim, session, context)
}
